/**
 * Code.gs — Google Apps Script สำหรับระบบจัดเก็บเอกสารเพื่อการต่ออายุ
 * ---------------------------------------------------------------------
 * หน้าที่:
 *   1) upload    : รับไฟล์จากเว็บ (base64) แล้วสร้างไฟล์ลง Google Drive (โควตาไดรฟ์ของผู้ใช้)
 *   2) delete    : ลบไฟล์เดิมออกจาก Google Drive ทันที (เมื่อแก้ไข/ลบเอกสาร)
 *   3) sendEmail : ส่งอีเมลแจ้งเตือน 30 วันก่อนหมดอายุ ผ่าน GmailApp
 *
 * วิธีติดตั้ง:
 *   1. Google Drive → ใหม่ → Google Apps Script (วางไฟล์นี้เป็น Code.gs)
 *   2. Project Settings → Script properties → เพิ่ม:
 *        GAS_SECRET = ค่าเดียวกับ env GAS_SECRET ของระบบ (สร้างเอง สุ่มยาว ๆ)
 *        (ตัวเลือก) FILE_ACCESS = link   → แชร์ไฟล์ให้คนที่มีลิงก์ดูได้
 *   3. Deploy → New deployment → Type: Web app
 *        Execute as: Me | Who has access: Anyone
 *      กด Deploy แล้วคัดลอก URL ที่ลงท้าย /exec ไปตั้งเป็น GAS_WEBAPP_URL
 */

var FOLDER_ID = '1AtnkpeRcZ7KVD2wpgwIi2hNsq8Mt-E2Q';

// เวอร์ชันของสคริปต์ — ใช้เช็คว่าโค้ดใหม่ถูก deploy แล้วหรือยัง (เรียกดูด้วย ?action=ping)
var SCRIPT_VERSION = '1.2.0';

function getProp_(key, fallback) {
  var v = PropertiesService.getScriptProperties().getProperty(key);
  return v === null || v === undefined || v === '' ? (fallback || '') : v;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function ok_(payload) {
  payload = payload || {};
  payload.ok = true;
  return json_(payload);
}

function err_(message, status) {
  return json_({ ok: false, error: String(message || 'unknown error'), status: status || 400 });
}

/** ตรวจ token (ถ้าไม่ได้ตั้งค่า GAS_SECRET ใน Script properties จะอนุญาตทั้งหมด) */
function authorized_(token) {
  var secret = getProp_('GAS_SECRET', '');
  if (!secret) return true;
  return String(token || '') === secret;
}

/**
 * สร้างลิงก์เปิดไฟล์จาก Google Drive
 *  - รูปภาพ        → https://lh5.googleusercontent.com/d/<fileId> (ดูรูปเต็ม)
 *  - PDF / ไฟล์อื่น → เปิดแบบปกติ: /view
 */
function driveLink_(file) {
  var id = file.getId();
  var mime = '';
  try { mime = file.getMimeType() || ''; } catch (e) {}
  if (mime && mime.indexOf('image/') === 0) {
    return 'https://lh5.googleusercontent.com/d/' + id;
  }
  return 'https://drive.google.com/file/d/' + id + '/view';
}

/* ============================ GET (ลบไฟล์) ============================ */
/**
 * /exec?action=delete&fileId=xxxx&token=xxxx
 */
function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (!authorized_(p.token)) return err_('unauthorized', 401);

    if (p.action === 'ping') {
      return ok_({ message: 'Apps Script พร้อมใช้งาน', folderId: FOLDER_ID, version: SCRIPT_VERSION });
    }

    if (p.action === 'delete') {
      if (!p.fileId) return err_('fileId ไม่ถูกต้อง', 400);
      var file = DriveApp.getFileById(p.fileId);
      var name = file.getName();
      file.setTrashed(true); // ลบออกจาก Drive ทันที (กู้คืนได้จากถังขยะ 30 วัน)
      return ok_({ fileId: p.fileId, name: name, deleted: true });
    }

    return err_('ไม่รู้จัก action: ' + p.action, 400);
  } catch (err) {
    return err_(err.message || err, 500);
  }
}

/* ==================== POST (อัปโหลดไฟล์ / ส่งอีเมล) ==================== */
function doPost(e) {
  try {
    var body = {};
    try {
      body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    } catch (parseErr) {
      body = (e && e.parameter) || {};
    }

    if (!authorized_(body.token)) return err_('unauthorized', 401);

    if (body.action === 'sendEmail') {
      return sendEmail_(body);
    }

    if (body.action === 'upload') {
      return upload_(body);
    }

    return err_('ไม่รู้จัก action: ' + body.action, 400);
  } catch (err) {
    return err_(err.message || err, 500);
  }
}

/** อัปโหลดไฟล์เข้าโฟลเดอร์ Google Drive */
function upload_(body) {
  if (!body.content) return err_('ไม่มีเนื้อหาไฟล์', 400);

  var folderId = body.folderId || FOLDER_ID;

  var bytes;
  try {
    bytes = Utilities.base64Decode(body.content);
  } catch (decodeErr) {
    return err_('เนื้อหาไฟล์ base64 ไม่ถูกต้อง: ' + (decodeErr.message || decodeErr), 400);
  }
  var blob = Utilities.newBlob(bytes, body.mimeType || 'application/octet-stream', body.filename || 'file');

  // สร้างไฟล์ในโฟลเดอร์เป้าหมาย ถ้าไม่ได้ (เช่น สิทธ์ไม่พอ/โฟลเดอร์เป็น shared drive) ให้ลองที่ไดรฟ์หลัก
  var candidates = [];
  try {
    candidates.push(DriveApp.getFolderById(folderId));
  } catch (folderErr) {
    // โฟลเดอร์เข้าถึงไม่ได้ → ข้าม ใช้ไดรฟ์หลักแทน
  }
  candidates.push(DriveApp.getRootFolder());

  var file = null;
  var usedFolder = null;
  var createErr = null;
  for (var i = 0; i < candidates.length; i++) {
    try {
      file = candidates[i].createFile(blob);
      usedFolder = candidates[i];
      break;
    } catch (createFileErr) {
      createErr = createFileErr;
    }
  }
  if (!file) return err_('สร้างไฟล์ใน Google Drive ไม่สำเร็จ: ' + ((createErr && createErr.message) || createErr), 500);

  // แชร์แบบ "ผู้มีลิงก์ดูได้" — ถ้าตั้งค่าไม่ได้ ไม่ต้องให้การอัปโหลดทั้งหมดล้มเหลว
  var shared = false;
  var shareDetail = '';
  var access = getProp_('FILE_ACCESS', 'link');
  if (access === 'link') {
    try {
      file.setSharing(DriveApp.ANYONE_WITH_LINK, DriveApp.VIEW);
      shared = true;
    } catch (shareErr) {
      shareDetail = String((shareErr && shareErr.message) || shareErr);
    }
  }

  return ok_({
    fileId: file.getId(),
    name: file.getName(),
    // รูปภาพ → lh5.googleusercontent.com  PDF/ไฟล์อื่น → เปิดแบบปกติ (/view)
    url: driveLink_(file),
    viewLink: driveLink_(file),
    downloadUrl: 'https://drive.google.com/uc?export=download&id=' + file.getId(),
    size: file.getSize(),
    folderId: usedFolder.getId(),
    shared: shared,
    shareDetail: shareDetail
  });
}

/** ส่งอีเมลแจ้งเตือน (ใช้ Gmail ของบัญชีที่ deploy) */
function sendEmail_(body) {
  if (!body.to) return err_('ไม่มีผู้รับ', 400);
  var fromEmail = getProp_('MAIL_FROM_EMAIL', '');
  var emailParams = {
    htmlBody: body.html || '<p>' + (body.text || '') + '</p>',
    name: getProp_('MAIL_FROM_NAME', 'ระบบจัดเก็บเอกสารเพื่อการต่ออายุ')
  };
  if (fromEmail) {
    emailParams.from = fromEmail;
  }
  GmailApp.sendEmail(body.to, body.subject || 'แจ้งเตือน', body.text || '', emailParams);
  return ok_({ sent: true, to: body.to });
}
