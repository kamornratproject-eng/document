/**
 * export-d1.mjs — อ่าน data/document.db (SQLite ท้องถิ่น) แล้วพิมพ์คำสั่ง INSERT
 * ออกมาเป็นไฟล์ SQL เพื่อใช้ import เข้า Cloudflare D1:
 *
 *   node scripts/export-d1.mjs > data/migrate.sql
 *   npx wrangler d1 execute <db-name> --remote --file=data/migrate.sql
 */
import { DatabaseSync } from "node:sqlite";

const FILE = process.env.SQLITE_PATH || "data/document.db";
const TABLES = ["users", "sessions", "documents", "notifications", "audit_logs"];

const db = new DatabaseSync(FILE);

function lit(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "bigint") return v.toString();
  if (v instanceof Uint8Array) return `x'${Buffer.from(v).toString("hex")}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

let total = 0;
for (const t of TABLES) {
  let rows;
  try {
    rows = db.prepare(`SELECT * FROM ${t}`).all();
  } catch {
    continue;
  }
  if (rows.length === 0) continue;
  const cols = Object.keys(rows[0]);
  process.stderr.write(`${t}: ${rows.length} rows\n`);
  total += rows.length;
  process.stdout.write(`-- ${t}\n`);
  process.stdout.write(`DELETE FROM ${t};\n`);
  for (const r of rows) {
    process.stdout.write(
      `INSERT INTO ${t} (${cols.join(", ")}) VALUES (${cols.map((c) => lit(r[c])).join(", ")});\n`
    );
  }
  process.stdout.write("\n");
}
process.stderr.write(`total rows: ${total}\n`);
