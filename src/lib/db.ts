/**
 * ชั้นฐานข้อมูล SQLite ที่ใช้ร่วมกันได้ 2 สภาพแวดล้อม
 *  - ตอนพัฒนา / รันบน Node  : ใช้ node:sqlite (ไฟล์ data/document.db)
 *  - ตอน deploy บน Cloudflare: ใช้ D1 binding (env.DB) ซึ่งเป็น SQLite เช่นกัน
 */
import { SCHEMA_SQL, SQLITE_PRAGMAS } from "@/lib/schema";

type Params = ReadonlyArray<unknown>;
type Row = Record<string, unknown>;

// โครงสร้างขั้นต่ำของ D1 (Cloudflare) ที่เราใช้จริง
interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  all<T = Row>(): Promise<{ results: T[] }>;
  first<T = Row>(): Promise<T | null>;
  run(): Promise<{ meta: { changes?: number; last_row_id?: number } }>;
}
interface D1Database {
  prepare(sql: string): D1Statement;
}

// โครงสร้างขั้นต่ำของ node:sqlite DatabaseSync ที่เราใช้จริง
interface SqliteStatement {
  all(...params: unknown[]): Row[];
  get(...params: unknown[]): Row | undefined;
  run(...params: unknown[]): { changes?: number; lastInsertRowid?: number };
}
interface SqliteDatabase {
  prepare(sql: string): SqliteStatement;
  exec(sql: string): void;
}

interface Driver {
  all<T = Row>(sql: string, params: Params): Promise<T[]>;
  get<T = Row>(sql: string, params: Params): Promise<T | null>;
  run(sql: string, params: Params): Promise<{ changes: number; lastRowId: number }>;
  exec(sql: string): Promise<void>;
}

let cfEnvCache: Record<string, unknown> | null = null;
let nodeDb: SqliteDatabase | null = null;
let schemaPromise: Promise<void> | null = null;

function isPlainObject(v: unknown): boolean {
  return typeof v === "object" && v !== null;
}

/** ค่าพารามิเตอร์ต้องเป็น primitive เท่านั้น (รองรับทั้ง node:sqlite และ D1) */
function normalizeParams(params: Params): unknown[] {
  return params.map((v) => {
    if (v === undefined || v === null) return null;
    if (typeof v === "boolean") return v ? 1 : 0;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    if (v instanceof Date) return v.toISOString();
    return v;
  });
}

async function getCloudflareEnv(): Promise<Record<string, unknown> | null> {
  if (cfEnvCache) return cfEnvCache;
  try {
    const mod = (await import("@opennextjs/cloudflare")) as unknown as {
      getCloudflareContextAsync?: () => Promise<{ env?: Record<string, unknown> } | null>;
      getCloudflareContext?: () => { env?: Record<string, unknown> } | null;
    };
    const ctx = mod.getCloudflareContextAsync
      ? await mod.getCloudflareContextAsync()
      : mod.getCloudflareContext?.();
    if (ctx?.env) {
      cfEnvCache = ctx.env;
      return cfEnvCache;
    }
  } catch {
    // ไม่ได้รันบน Cloudflare → ใช้ Node ปกติ
  }
  return null;
}

function d1Driver(db: D1Database): Driver {
  return {
    async all<T>(sql: string, params: Params) {
      const res = await db.prepare(sql).bind(...normalizeParams(params)).all();
      return (res.results ?? []) as T[];
    },
    async get<T>(sql: string, params: Params) {
      const res = await db.prepare(sql).bind(...normalizeParams(params)).first();
      return (res ?? null) as T | null;
    },
    async run(sql: string, params: Params) {
      const res = await db.prepare(sql).bind(...normalizeParams(params)).run();
      const meta = res.meta ?? {};
      return {
        changes: Number(meta.changes ?? 0),
        lastRowId: Number(meta.last_row_id ?? 0),
      };
    },
    async exec(sql: string) {
      // D1 ไม่รองรับ multi-statement exec ที่เสถียร → ตัดคอมเมนต์ออก แยกทีละคำสั่ง แล้ว run ทีละอัน
      const statements = sql
        .replace(/--[^\n]*/g, "")
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      for (const stmt of statements) {
        await db.prepare(stmt).run();
      }
    },
  };
}

async function nodeDriver(): Promise<Driver> {
  if (!nodeDb) {
    const { DatabaseSync } = await import("node:sqlite");
    const fs = await import("node:fs");
    const path = await import("node:path");
    const file =
      process.env.SQLITE_PATH || path.join(/* turbopackIgnore: true */ process.cwd(), "data", "document.db");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const db = new DatabaseSync(file) as SqliteDatabase;
    db.exec(SQLITE_PRAGMAS);
    nodeDb = db;
  }
  const db = nodeDb;
  return {
    async all<T>(sql: string, params: Params) {
      const rows = db.prepare(sql).all(...normalizeParams(params));
      return rows.map((r) => ({ ...r })) as T[];
    },
    async get<T>(sql: string, params: Params) {
      const row = db.prepare(sql).get(...normalizeParams(params));
      return row ? ({ ...row } as T) : null;
    },
    async run(sql: string, params: Params) {
      const info = db.prepare(sql).run(...normalizeParams(params));
      return {
        changes: Number(info.changes ?? 0),
        lastRowId: Number(info.lastInsertRowid ?? 0),
      };
    },
    async exec(sql: string) {
      db.exec(sql);
    },
  };
}

function extractD1(env: Record<string, unknown> | null): D1Database | null {
  if (!env) return null;
  const direct = (env.DB || (env as Record<string, unknown>).my_db_name) as D1Database | undefined;
  if (direct && isPlainObject(direct) && typeof direct.prepare === "function") {
    return direct;
  }
  for (const val of Object.values(env)) {
    if (val && isPlainObject(val) && typeof (val as D1Database).prepare === "function") {
      return val as D1Database;
    }
  }
  return null;
}

let driverPromise: Promise<Driver> | null = null;

async function getDriver(): Promise<Driver> {
  const env = await getCloudflareEnv();
  const d1 = extractD1(env);
  if (d1) {
    return d1Driver(d1);
  }
  if (!driverPromise) {
    driverPromise = nodeDriver().catch((err) => {
      driverPromise = null; // ลองใหม่ในคำขอถัดไป
      throw err;
    });
  }
  return driverPromise;
}

async function ensureSchema(driver: Driver): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await driver.exec(SCHEMA_SQL);
    })().catch((err) => {
      schemaPromise = null;
      console.error("[db] ensureSchema failed:", err);
      throw err;
    });
  }
  await schemaPromise;
}

export async function dbAll<T = Row>(sql: string, params: Params = []): Promise<T[]> {
  const driver = await getDriver();
  await ensureSchema(driver);
  return driver.all<T>(sql, params);
}

export async function dbGet<T = Row>(
  sql: string,
  params: Params = []
): Promise<T | null> {
  const driver = await getDriver();
  await ensureSchema(driver);
  return driver.get<T>(sql, params);
}

export async function dbRun(
  sql: string,
  params: Params = []
): Promise<{ changes: number; lastRowId: number }> {
  const driver = await getDriver();
  await ensureSchema(driver);
  return driver.run(sql, params);
}

export async function dbExec(sql: string): Promise<void> {
  const driver = await getDriver();
  await ensureSchema(driver);
  return driver.exec(sql);
}

/** true เมื่อระบบกำลังรันบน Cloudflare (ใช้ D1) */
export async function isCloudflareRuntime(): Promise<boolean> {
  const env = await getCloudflareEnv();
  return !!extractD1(env);
}

/** อ่าน environment ทั้งจาก Cloudflare context และ process.env (ค่าเป็น string เป็นหลัก) */
export async function getEnv(): Promise<Record<string, string>> {
  const cf = await getCloudflareEnv();
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === "string") out[k] = v;
  }
  for (const [k, v] of Object.entries(cf ?? {})) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}
