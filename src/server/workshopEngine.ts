import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type {
  AutosData,
  BackupStats,
  DailyResponse,
  EntryRecord,
  HomeData,
  LotsInfo,
  ModuleResponse,
  PerformanceDayPoint,
  PerformanceModuleRow,
  PerformanceOverviewData,
  PerformanceWeekPoint,
  Role,
  ThemeId,
  UnitMetricsBucket,
  UserMe,
  UserRecord,
  WorkshopSettings,
} from '../types/workshop.ts';
import {
  clearSyncQueue,
  fetchPhotoFromSupabase,
  flushSupabaseQueue,
  forceFullSupabaseSync,
  getSupabaseStatus,
  initSupabaseSync,
  queueDailyUpsert,
  queueDueListReplace,
  queueEntryDelete,
  queueEntryUpsert,
  queueKvUpsert,
  queueLogInsert,
  queueLotUpsert,
  queuePhotoUpsert,
  queueSettingsUpsert,
  queueUsersReplace,
} from './supabaseStore.ts';
import {
  enqueueFormspree,
  getFormspreeStatus,
  moduleLabel,
  type FormspreeEvent,
} from './formspree.ts';

const TZ = 'Asia/Kolkata';
const WINDOW_DAYS = 60;
const MAX_PIN_TRIES = 5;
const BACKUP_VERSION = 1;

export const ALL_MODULES = [
  'daily',
  'rp',
  'iron',
  'scan',
  'wn',
  'saree',
  'rewash',
  'repair',
  'washerr',
  'grc',
  'staffErr',
  'meter',
  'spot',
  'quickfix',
  'boiler',
  'reports',
  'performance',
  'settings',
];

export const OFFICE_MODULES = ['rp', 'iron', 'scan', 'wn', 'saree', 'rewash', 'repair', 'washerr', 'grc', 'meter'];
export const PROCESS_MODULES = ['spot', 'quickfix', 'boiler'];

export const SEED_USERS = {
  office: ['Sunny', 'Ajay', 'Raja', 'Naushad', 'Bikash', 'Suman', 'Raju', 'Mija'],
  process: ['Ranjit', 'Nitu', 'Dilip', 'Altaf', 'Amod', 'Munna'],
};

export const STAFF_LISTS = [
  'teams.office',
  'sareeTo',
  'extraItems',
  'garments',
  'spotTypes',
  'repairTypes',
  'damageTypes',
  'repairPlaces',
  'repairTo',
  'staffErrTypes',
  'teams.iron',
  'teams.wash',
  'teams.spot',
  'teams.qf',
];

export const DEFAULT_SETTINGS: WorkshopSettings = {
  units: ['UL', 'PC'],
  stores: [
    { code: 'BB', aliases: [], pc: false, email: '' },
    { code: 'MG', aliases: [], pc: false, email: '' },
    { code: 'MP', aliases: [], pc: false, email: '' },
    { code: 'SL', aliases: [], pc: false, email: '' },
    { code: 'AC', aliases: [], pc: true, email: '' },
    { code: 'GT', aliases: ['HGT'], pc: true, email: '' },
    { code: 'LT', aliases: [], pc: true, email: '' },
  ],
  itCodes: ['IT'],
  rounds: ['Urgent', 'Lot 1 – Morning', 'Lot 2 – Evening'],
  teams: {
    office: ['Sunny', 'Ajay', 'Raja', 'Naushad', 'Bikash', 'Suman', 'Raju', 'Mija'],
    iron: ['Munna', 'Dilip', 'Altaf', 'Nitu', 'Ashok', 'Nathu', 'Azad'],
    wash: ['Prabhu', 'Shyam', 'Laxmi', 'Ranjit', 'Akash'],
    spot: ['Ranjit'],
    qf: ['Nitu'],
  },
  rewashTypes: ['Full wash', 'Spotting'],
  garments: ['Shirt', 'T Shirt', 'Pant', 'Jeans', 'Kurta', 'Saree', 'Ladies Top', 'Coat', 'Bedsheet', 'Blanket', 'Parda', 'Carpet'],
  spotTypes: ['Oil', 'Ink', 'Colour', 'Rust', 'Food', 'Haldi'],
  repairTypes: ['Button', 'Stitch', 'Zip', 'Hem', 'Hook', 'Patch'],
  damageTypes: ['Colour bleed', 'Shrink', 'Tear / Hole', 'Stain', 'Button broken'],
  damagePoints: { 'Colour bleed': 3, Shrink: 3, 'Tear / Hole': 5, Stain: 1, 'Button broken': 1 },
  repairPlaces: ['PP'],
  sareeTo: ['Polish man'],
  extraItems: ['Garment', 'Hanger', 'Bag', 'Box', 'Cover', 'Sticker roll'],
  staffErrTypes: ['Late coming', 'Wrong packing', 'Wrong tagging', 'Garment misplaced', 'Careless work', 'Other'],
  boilers: [{ name: 'Boiler 1', unit: 'UL', staff: [] }],
  meters: [
    { name: 'Electricity', measure: 'kWh' },
    { name: 'Water', measure: 'KL' },
  ],
  alerts: { admin: '', manager: '', account: '' },
  theme: 'hollywood',
  brandV: 1,
};

interface InternalUser extends UserRecord {
  pin: string;
}

interface TableDef {
  cols: number;
  key?: number;
  date?: number;
}

const TABLES: Record<string, TableDef> = {
  Users: { cols: 6, key: 0 },
  Settings: { cols: 2, key: 0 },
  Daily: { cols: 9, key: 0, date: 1 },
  Entries: { cols: 9, key: 0, date: 2 },
  Lots: { cols: 8, key: 0, date: 1 },
  DueList: { cols: 6 },
  Log: { cols: 4 },
};

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
const PHOTOS_DIR = path.join(DATA_DIR, 'photos');
fs.mkdirSync(PHOTOS_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'workshop.db'));
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = NORMAL;');
db.exec('PRAGMA busy_timeout = 5000;');

for (const [name, def] of Object.entries(TABLES)) {
  const cols: string[] = [];
  for (let i = 1; i <= def.cols; i++) {
    cols.push(`c${i}${def.key === i - 1 ? ' UNIQUE' : ''}`);
  }
  db.exec(`CREATE TABLE IF NOT EXISTS "${name}" (rid INTEGER PRIMARY KEY AUTOINCREMENT, ${cols.join(', ')})`);
  if (def.date !== undefined) {
    db.exec(`CREATE INDEX IF NOT EXISTS "ix_${name}_date" ON "${name}"(c${def.date + 1})`);
  }
}
db.exec('CREATE INDEX IF NOT EXISTS ix_Entries_mod ON Entries(c2, c3)');
db.exec('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)');

const pinTryCache = new Map<string, { n: number; exp: number }>();

function fmtDate(d: Date, tz: string, f: string): string {
  const p: Record<string, string> = {};
  new Intl.DateTimeFormat('en-GB', {
    timeZone: tz || TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .formatToParts(d)
    .forEach((x) => {
      p[x.type] = x.value;
    });
  if (p.hour === '24') p.hour = '00';
  return f
    .replace('yyyy', p.year)
    .replace('MM', p.month)
    .replace('dd', p.day)
    .replace('HH', p.hour)
    .replace('mm', p.minute)
    .replace('ss', p.second);
}

function today(): string {
  return fmtDate(new Date(), TZ, 'yyyy-MM-dd');
}
function nowStr(): string {
  return fmtDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss');
}
function hmNow(): string {
  return fmtDate(new Date(), TZ, 'HH:mm');
}
function addDays(d: string, n: number): string {
  const p = d.split('-').map(Number);
  const dt = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
function weekStart(d: string): string {
  const p = d.split('-').map(Number);
  const dt = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  return addDays(d, -((dt.getUTCDay() + 6) % 7));
}
function uid(): string {
  return 'E' + crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
}
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function str(v: unknown): string {
  return String(v == null ? '' : v).trim();
}
function validDate(d: unknown): string {
  const s = str(d);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('Bad date');
  return s;
}
function dkey(v: unknown): string {
  return String(v || '').trim();
}
function hm(v: unknown): string {
  const m = String(v || '').match(/(\d{1,2}):(\d{2})/);
  return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : '';
}
function jparse<T>(s: unknown, fallback: T): T {
  try {
    return JSON.parse(String(s || '')) as T;
  } catch {
    return fallback;
  }
}
function cleanVal(v: unknown): string | number {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string' && v.charAt(0) === "'") return v.slice(1);
  if (v === true) return 'TRUE';
  if (v === false) return 'FALSE';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') return JSON.stringify(v);
  return typeof v === 'number' ? v : String(v);
}

function kvGet(k: string): string | null {
  const row = db.prepare('SELECT v FROM kv WHERE k = ?').get(k) as { v: string } | undefined;
  return row ? row.v : null;
}
function kvSet(k: string, v: string): void {
  const val = String(v);
  db.prepare('INSERT INTO kv(k, v) VALUES(?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').run(k, val);
  queueKvUpsert(k, val);
}

function logAction(user: string, action: string, detail: string): void {
  try {
    const ts = nowStr();
    const cleanDetail = String(detail || '').slice(0, 500);
    db.prepare('INSERT INTO Log (c1, c2, c3, c4) VALUES (?, ?, ?, ?)').run(ts, user, action, cleanDetail);
    queueLogInsert(ts, user, action, cleanDetail);
  } catch {
    // ignore log failures
  }
}

let schemaReady = false;
function ensureSchema(): void {
  if (schemaReady) return;
  db.exec('BEGIN');
  try {
    const uCount = (db.prepare('SELECT COUNT(*) as n FROM Users').get() as { n: number }).n;
    if (uCount === 0) {
      const insU = db.prepare('INSERT INTO Users (c1, c2, c3, c4, c5, c6) VALUES (?, ?, ?, ?, ?, ?)');
      insU.run('Admin', 'Admin', '1234', ALL_MODULES.join(','), 'TRUE', 'UL,PC');
      insU.run('Mijarul', 'Admin', '1234', ALL_MODULES.join(','), 'TRUE', 'UL,PC');
      for (const n of SEED_USERS.office) {
        const mods = n === 'Sunny' || n === 'Mija' ? ['daily', 'staffErr', ...OFFICE_MODULES] : OFFICE_MODULES;
        insU.run(n, 'Staff', '1111', mods.join(','), 'TRUE', n === 'Mija' ? 'UL,PC' : 'UL');
      }
      for (const n of SEED_USERS.process) {
        insU.run(n, 'Staff', '1111', PROCESS_MODULES.join(','), 'TRUE', 'UL');
      }
    }
    const sRow = db.prepare('SELECT c2 FROM Settings WHERE c1 = ?').get('app') as { c2: string } | undefined;
    if (!sRow) {
      db.prepare('INSERT INTO Settings (c1, c2) VALUES (?, ?)').run('app', JSON.stringify(DEFAULT_SETTINGS));
    }
    if (!kvGet('seed_mijarul_mija_v1')) {
      const insOrIgn = db.prepare('INSERT OR IGNORE INTO Users (c1, c2, c3, c4, c5, c6) VALUES (?, ?, ?, ?, ?, ?)');
      insOrIgn.run('Mijarul', 'Admin', '1234', ALL_MODULES.join(','), 'TRUE', 'UL,PC');
      insOrIgn.run('Mija', 'Staff', '1111', ['daily', 'staffErr', 'performance', ...OFFICE_MODULES].join(','), 'TRUE', 'UL,PC');
      if (sRow) {
        const curSettings = jparse<Partial<WorkshopSettings>>(sRow.c2, {});
        const curOffice = Array.isArray(curSettings.teams?.office) ? curSettings.teams.office : [];
        if (!curOffice.includes('Mija')) {
          const nextSettings = {
            ...curSettings,
            teams: { ...(curSettings.teams || DEFAULT_SETTINGS.teams), office: [...curOffice, 'Mija'] },
          };
          db.prepare('UPDATE Settings SET c2 = ? WHERE c1 = ?').run(JSON.stringify(nextSettings), 'app');
        }
      }
      kvSet('seed_mijarul_mija_v1', '1');
    }
    if (!kvGet('grant_perf_mija_v1')) {
      const mijaRow = db.prepare('SELECT c4 FROM Users WHERE lower(c1) = ?').get('mija') as { c4: string } | undefined;
      if (mijaRow) {
        const mods = str(mijaRow.c4).split(',').map((x) => x.trim()).filter(Boolean);
        if (!mods.includes('performance')) {
          mods.push('performance');
          db.prepare('UPDATE Users SET c4 = ? WHERE lower(c1) = ?').run(mods.join(','), 'mija');
        }
      }
      kvSet('grant_perf_mija_v1', '1');
    }
    if (!kvGet('SECRET')) {
      kvSet('SECRET', crypto.randomBytes(48).toString('hex'));
    }
    db.exec('COMMIT');
    schemaReady = true;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function getSettings(): WorkshopSettings {
  ensureSchema();
  const row = db.prepare('SELECT c2 FROM Settings WHERE c1 = ?').get('app') as { c2: string } | undefined;
  const saved = jparse<Partial<WorkshopSettings>>(row?.c2, {});
  const merged: WorkshopSettings = {
    ...DEFAULT_SETTINGS,
    ...saved,
    teams: { ...DEFAULT_SETTINGS.teams, ...(saved.teams || {}) },
    alerts: { ...DEFAULT_SETTINGS.alerts, ...(saved.alerts || {}) },
    damagePoints: { ...DEFAULT_SETTINGS.damagePoints, ...(saved.damagePoints || {}) },
  };
  if (!merged.repairPlaces?.length && saved.repairTo?.length) {
    merged.repairPlaces = saved.repairTo;
  }
  return merged;
}

function writeSettings(s: WorkshopSettings): void {
  db.prepare('INSERT INTO Settings (c1, c2) VALUES (?, ?) ON CONFLICT(c1) DO UPDATE SET c2 = excluded.c2').run('app', JSON.stringify(s));
  queueSettingsUpsert(s);
}

function getAllUsers(): InternalUser[] {
  ensureSchema();
  const rows = db.prepare('SELECT c1, c2, c3, c4, c5, c6 FROM Users ORDER BY rid').all() as {
    c1: string;
    c2: string;
    c3: string;
    c4: string;
    c5: string;
    c6: string;
  }[];
  return rows
    .filter((r) => str(r.c1))
    .map((r) => ({
      name: str(r.c1),
      role: (['Admin', 'Manager', 'Staff'].includes(str(r.c2)) ? str(r.c2) : 'Staff') as Role,
      pin: str(r.c3),
      modules: str(r.c4)
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
      active: String(r.c5).toUpperCase() !== 'FALSE',
      units: str(r.c6)
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    }));
}

function findUser(name: string): InternalUser | null {
  const key = str(name).toLowerCase();
  return getAllUsers().find((u) => u.active && u.name.toLowerCase() === key) || null;
}

function isMgr(u: InternalUser): boolean {
  return u.role === 'Admin' || u.role === 'Manager';
}
function modulesFor(u: InternalUser): string[] {
  if (u.role === 'Admin') return ALL_MODULES.slice();
  if (u.role === 'Manager') return ALL_MODULES.filter((m) => m !== 'settings');
  const mods = u.modules.slice();
  if (mods.includes('reports') && !mods.includes('performance')) mods.push('performance');
  return mods;
}
function unitsFor(u: InternalUser): string[] {
  const all = getSettings().units;
  if (isMgr(u) || !u.units.length) return all.slice();
  const allowed = u.units.filter((x) => all.includes(x));
  return allowed.length ? allowed : all.slice();
}
function unitFor(u: InternalUser, p: Record<string, any>, allowAll = false): string {
  const req = str(p.unit).toUpperCase();
  if (allowAll && req === 'ALL' && isMgr(u)) return 'ALL';
  const allowed = unitsFor(u);
  return req && allowed.includes(req) ? req : allowed[0];
}
function meObj(u: InternalUser): UserMe {
  return { name: u.name, role: u.role, modules: modulesFor(u), units: unitsFor(u) };
}

function signToken(payload: string): string {
  const secret = kvGet('SECRET') || 'workshop-secret';
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
function makeToken(u: InternalUser): string {
  const body = Buffer.from(JSON.stringify({ n: u.name, r: u.role, d: today() }), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${body}.${signToken(body)}`;
}
function checkToken(token?: string): InternalUser {
  if (!token || !token.includes('.')) throw new Error('AUTH');
  const [body, sig] = token.split('.');
  if (signToken(body) !== sig) throw new Error('AUTH');
  const pad = body + '==='.slice((body.length + 3) % 4);
  const parsed = JSON.parse(Buffer.from(pad.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')) as {
    n: string;
    r: string;
    d: string;
  };
  if (parsed.d !== today()) throw new Error('AUTH');
  const u = findUser(parsed.n);
  if (!u || u.role !== parsed.r) throw new Error('AUTH');
  return u;
}

function need(u: InternalUser, mod: string): void {
  if (!modulesFor(u).includes(mod)) throw new Error('No access');
}
function dateFor(u: InternalUser, d?: unknown): string {
  const ds = d ? validDate(d) : today();
  if (!isMgr(u) && ds !== today()) throw new Error("Staff can only enter today's data");
  if (ds > today()) throw new Error('Future date not allowed');
  return ds;
}
function seeDate(u: InternalUser, d?: unknown): string {
  const ds = d ? validDate(d) : today();
  if (ds > today()) throw new Error('Future date not allowed');
  return ds;
}
function lockedMsg(): string {
  return 'Saved entries can be changed only by Manager';
}

function login(p: Record<string, any>): { token: string; me: UserMe; today: string } {
  const name = str(p.name);
  const key = `try_${name.toLowerCase()}`;
  const now = Date.now();
  const cached = pinTryCache.get(key);
  const tries = cached && cached.exp > now ? cached.n : 0;
  if (tries >= MAX_PIN_TRIES) throw new Error('Too many wrong tries. Wait 15 minutes.');
  const u = findUser(name);
  if (!u || String(p.pin) !== u.pin) {
    pinTryCache.set(key, { n: tries + 1, exp: now + 900_000 });
    throw new Error('Wrong name or PIN');
  }
  pinTryCache.delete(key);
  logAction(u.name, 'login', '');
  return { token: makeToken(u), me: meObj(u), today: today() };
}

function eRow(r: Record<string, any>): EntryRecord {
  return {
    id: String(r.c1 ?? ''),
    mod: String(r.c2 ?? ''),
    date: dkey(r.c3),
    unit: String(r.c4 ?? ''),
    store: String(r.c5 ?? ''),
    summary: String(r.c6 ?? ''),
    data: jparse(r.c7, {}),
    by: String(r.c8 ?? ''),
    at: hm(r.c9),
    stamp: String(r.c9 ?? ''),
  };
}

function eRange(from: string, to: string, mod?: string | string[] | null, unit?: string): EntryRecord[] {
  const mods = mod ? (Array.isArray(mod) ? mod : [mod]) : null;
  let sql = 'SELECT c1,c2,c3,c4,c5,c6,c7,c8,c9 FROM Entries WHERE c3 >= ? AND c3 <= ?';
  const args: (string | number)[] = [from, to];
  if (mods && mods.length) {
    sql += ` AND c2 IN (${mods.map(() => '?').join(',')})`;
    args.push(...mods);
  }
  if (unit && unit !== 'ALL') {
    sql += " AND (c4 = ? OR c4 = 'ALL')";
    args.push(unit);
  }
  sql += ' ORDER BY c3, c9, rid';
  const rows = db.prepare(sql).all(...args) as Record<string, any>[];
  return rows.map(eRow);
}

function eAppend(rows: (string | number)[][]): void {
  if (!rows.length) return;
  const stmt = db.prepare('INSERT INTO Entries (c1,c2,c3,c4,c5,c6,c7,c8,c9) VALUES (?,?,?,?,?,?,?,?,?)');
  for (const r of rows) {
    const c1 = cleanVal(r[0]);
    const c2 = cleanVal(r[1]);
    const c3 = cleanVal(r[2]);
    const c4 = cleanVal(r[3]);
    const c5 = cleanVal(r[4]);
    const c6 = cleanVal(r[5]);
    const c7 = cleanVal(r[6]);
    const c8 = cleanVal(r[7]);
    const c9 = cleanVal(r[8]);
    stmt.run(c1, c2, c3, c4, c5, c6, c7, c8, c9);
    queueEntryUpsert(eRow({ c1, c2, c3, c4, c5, c6, c7, c8, c9 }));
  }
}

function eMake(u: InternalUser, mod: string, date: string, unit: string, store: string, summary: string, data: Record<string, any>): (string | number)[] {
  return [uid(), mod, date, unit, str(store), String(summary || '').slice(0, 300), JSON.stringify(data || {}), u.name, nowStr()];
}

function eFind(id: string): EntryRecord {
  const row = db.prepare('SELECT c1,c2,c3,c4,c5,c6,c7,c8,c9 FROM Entries WHERE c1 = ?').get(String(id)) as Record<string, any> | undefined;
  if (!row) throw new Error('Not found');
  return eRow(row);
}

function eWrite(e: EntryRecord): void {
  db.prepare('UPDATE Entries SET c5 = ?, c6 = ?, c7 = ? WHERE c1 = ?').run(
    str(e.store),
    String(e.summary).slice(0, 300),
    JSON.stringify(e.data),
    e.id
  );
  queueEntryUpsert(e);
}

function need3(x: Record<string, any>, keys: string[]): void {
  for (const k of keys) {
    if (!str(x[k])) throw new Error('Fill all boxes');
  }
}

function storeMap() {
  const m: Record<string, { code: string; aliases: string[]; pc: boolean; email?: string }> = {};
  for (const s of getSettings().stores) {
    m[s.code.toUpperCase()] = s;
    for (const a of s.aliases || []) {
      m[str(a).toUpperCase()] = s;
    }
  }
  return m;
}

function storeEmail(code: string): string {
  const so = storeMap()[str(code).toUpperCase()];
  return so && so.email ? so.email : '';
}

function sendAlert(u: InternalUser, kind: string, date: string, unit: string, row: Record<string, any>): void {
  const al = getSettings().alerts || { admin: '', manager: '', account: '' };
  const st = str(row.st);
  let to: string[] = [];
  let cc: string[] = [];
  if (kind === 'challan') {
    to = [al.admin, al.account];
  } else {
    to = [storeEmail(st)];
    cc = [al.admin];
  }
  to = to.filter(Boolean);
  cc = cc.filter(Boolean);
  if (!to.length && cc.length) {
    to = cc;
    cc = [];
  }
  if (!to.length) {
    row.mail = 'no email set';
    return;
  }
  row.mail = row.at || hmNow();
  logAction(u.name, `alert.${kind}`, `${to.join(',')}${cc.length ? ` cc ${cc.join(',')}` : ''} (${date} ${unit})`);
}

const HOOK: Record<string, (u: InternalUser, unit: string, x: Record<string, any>, date: string) => { store: string; summary: string; data: Record<string, any> }> = {
  rp(u, _unit, x) {
    const rawNames = ((x.names as string[]) || []).map(str).filter(Boolean);
    const names = rawNames.length ? rawNames : [u.name];
    if (!str(x.round) || !str(x.store) || !['Release', 'Pack'].includes(x.type)) {
      throw new Error('Choose round, store and Release / Pack');
    }
    const d = { round: str(x.round), type: x.type, names };
    return { store: str(x.store), summary: `${d.round} · ${x.store} · ${x.type} · ${names.join(', ')}`, data: d };
  },
  wn(u, unit, x, date) {
    if (x.kind === 'tag') {
      need3(x, ['tag', 'store']);
      const d: Record<string, any> = {
        kind: 'tag',
        tag: str(x.tag).toUpperCase(),
        garment: str(x.garment),
        note: str(x.note),
        status: 'Pending',
      };
      const al: Record<string, any> = { tag: d.tag, st: str(x.store), g: d.garment, note: d.note, at: hmNow() };
      sendAlert(u, 'wntag', date, unit, al);
      d.mail = al.mail;
      return {
        store: str(x.store),
        summary: `Detached tag ${d.tag} · ${x.store}${d.garment ? ` · ${d.garment}` : ''}`,
        data: d,
      };
    }
    need3(x, ['garment', 'karigar']);
    const angleKeys = ['front', 'back', 'left', 'right'] as const;
    const rawAngles = x.photoAngles && typeof x.photoAngles === 'object' ? (x.photoAngles as Record<string, any>) : null;
    const photoAngles: Record<string, string> = {};
    if (rawAngles) {
      for (const k of angleKeys) {
        const val = str(rawAngles[k]);
        if (val) photoAngles[k] = val;
      }
    }
    const anglePhotos = angleKeys.map((k) => photoAngles[k]).filter(Boolean);
    const rawPhotos = anglePhotos.length ? anglePhotos : Array.isArray(x.photos) ? x.photos : x.photo ? [x.photo] : [];
    const photos = rawPhotos.map(str).filter(Boolean).slice(0, 8);
    if (photos.length < 1) throw new Error('Upload at least 1 photo of the garment');
    if (new Set(photos).size !== photos.length) {
      throw new Error('Same photo cannot be uploaded twice — upload a new different photo');
    }
    const photoSha = (id: string): string => {
      const p = path.join(PHOTOS_DIR, `${id}.jpg`);
      if (!fs.existsSync(p)) return '';
      return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    };
    const currentHashes = photos.map(photoSha).filter(Boolean);
    if (new Set(currentHashes).size !== currentHashes.length) {
      throw new Error('Duplicate photo detected — upload different photos for each angle');
    }
    const priorEntries = eRange(addDays(date, -WINDOW_DAYS), addDays(date, 1), 'wn', 'ALL').filter(
      (e) => e.data.kind === 'garment'
    );
    const usedIds = new Set<string>();
    const usedHashes = new Set<string>();
    for (const pe of priorEntries) {
      const pids: string[] = Array.isArray(pe.data.photos)
        ? pe.data.photos
        : pe.data.photo
          ? [pe.data.photo]
          : [];
      for (const pid of pids) {
        if (pid) usedIds.add(String(pid));
      }
      const phs: string[] = Array.isArray(pe.data.photoHashes) ? pe.data.photoHashes : [];
      for (const h of phs) {
        if (h) usedHashes.add(String(h));
      }
    }
    if (photos.some((pid) => usedIds.has(pid)) || currentHashes.some((h) => usedHashes.has(h))) {
      throw new Error('This photo was already uploaded before — please upload a new photo');
    }
    if (!Object.keys(photoAngles).length) {
      photos.forEach((pid, idx) => {
        if (angleKeys[idx]) photoAngles[angleKeys[idx]] = pid;
      });
    }
    const d = {
      kind: 'garment',
      garment: str(x.garment),
      karigar: str(x.karigar),
      photo: photos[0],
      photos,
      photoAngles,
      photoHashes: currentHashes,
      photoDHashes: Array.isArray(x.photoDHashes) ? x.photoDHashes.map(str).filter(Boolean) : [],
      note: str(x.note),
      status: 'Pending',
    };
    return { store: '', summary: `WN ${d.garment} · ironed by ${d.karigar}`, data: d };
  },
  saree(_u, _unit, x, date) {
    const q = Math.round(num(x.qty));
    if (!str(x.to)) throw new Error('Choose to whom sent');
    if (q < 1) throw new Error('Enter quantity');
    const d = { to: str(x.to), qty: q, note: str(x.note), status: 'Sent', sentAt: `${date} ${hmNow()}` };
    return { store: '', summary: `Sent ${q} sarees → ${d.to}`, data: d };
  },
  repair(_u, _unit, x, date) {
    need3(x, ['store', 'garment', 'tag', 'damage']);
    const d = {
      garment: str(x.garment),
      tag: str(x.tag).toUpperCase(),
      damage: str(x.damage),
      sentTo: str(x.sentTo) || 'PP',
      note: str(x.note),
      status: 'Sent',
      sentAt: `${date} ${hmNow()}`,
    };
    return { store: str(x.store), summary: `${x.store} · ${d.tag} · ${d.garment} · ${d.damage} → ${d.sentTo}`, data: d };
  },
  spot(u, _unit, x) {
    need3(x, ['store', 'garment', 'spot', 'tag']);
    const d = {
      garment: str(x.garment),
      spot: str(x.spot),
      tag: str(x.tag).toUpperCase(),
      pct: Math.max(0, Math.min(100, Math.round(num(x.pct)))),
      by: str(x.by) || u.name,
    };
    return { store: str(x.store), summary: `${x.store} · ${d.tag} · ${d.garment} · ${d.spot} → ${d.pct}%`, data: d };
  },
  quickfix(u, _unit, x) {
    need3(x, ['store', 'garment', 'repair', 'kind', 'tag']);
    const d = {
      garment: str(x.garment),
      repair: str(x.repair),
      kind: x.kind === 'IR' ? 'IR' : 'QF',
      tag: str(x.tag).toUpperCase(),
      by: str(x.by) || u.name,
    };
    return { store: str(x.store), summary: `${x.store} · ${d.tag} · ${d.garment} · ${d.repair} (${d.kind})`, data: d };
  },
  washerr(_u, _unit, x) {
    need3(x, ['store', 'tag', 'garment', 'damage', 'by']);
    let pt = Math.round(num(x.points));
    if (!(pt >= 1 && pt <= 10)) pt = num(getSettings().damagePoints[x.damage]) || 1;
    const d = {
      tag: str(x.tag).toUpperCase(),
      garment: str(x.garment),
      damage: str(x.damage),
      points: pt,
      by: str(x.by),
      note: str(x.note),
    };
    return { store: str(x.store), summary: `${x.store} · ${d.tag} · ${d.garment} · ${d.damage} (${pt} pts) · ${d.by}`, data: d };
  },
  staffErr(_u, _unit, x) {
    need3(x, ['staff', 'note']);
    const d = { staff: str(x.staff), note: str(x.note), src: str(x.src) };
    return { store: '', summary: `${d.staff} · ${d.note}`, data: d };
  },
};

function openItems(mod: string, unit: string): EntryRecord[] {
  const t = today();
  return eRange(addDays(t, -WINDOW_DAYS), t, mod, mod === 'repair' ? 'ALL' : unit).filter((e) => {
    if (mod === 'repair') return e.data.status !== 'Released' && (unit === 'ALL' || e.unit === unit || e.data.sentTo === unit);
    if (mod === 'saree') return e.data.status !== 'Received';
    if (mod === 'wn') return e.data.status !== 'Adjusted';
    return true;
  });
}

function rewashState(unit: string, upto: string): Record<string, { balance: number; pending: { date: string; given: number; left: number }[] }> {
  const kinds: Record<string, { given: number; received: number; lots: { date: string; qty: number; left: number }[] }> = {};
  for (const k of getSettings().rewashTypes || ['Full wash', 'Spotting']) {
    kinds[k] = { given: 0, received: 0, lots: [] };
  }
  for (const e of eRange(addDays(upto, -WINDOW_DAYS), upto, 'rewash', unit)) {
    const k = e.data.kind || 'Full wash';
    const K = (kinds[k] = kinds[k] || { given: 0, received: 0, lots: [] });
    const q = num(e.data.qty);
    if (e.data.type === 'Given') {
      K.given += q;
      K.lots.push({ date: e.date, qty: q, left: q });
    } else {
      K.received += q;
      let rem = q;
      for (const l of K.lots) {
        const take = Math.min(l.left, rem);
        l.left -= take;
        rem -= take;
      }
    }
  }
  const out: Record<string, { balance: number; pending: { date: string; given: number; left: number }[] }> = {};
  for (const k of Object.keys(kinds)) {
    const K = kinds[k];
    const byDate: Record<string, { date: string; given: number; left: number }> = {};
    for (const l of K.lots) {
      if (l.left > 0) {
        const b = (byDate[l.date] = byDate[l.date] || { date: l.date, given: 0, left: 0 });
        b.given += l.qty;
        b.left += l.left;
      }
    }
    const pending = Object.keys(byDate)
      .sort()
      .map((d) => byDate[d]);
    out[k] = { balance: pending.reduce((t, x) => t + x.left, 0), pending };
  }
  return out;
}

function meterLast(unit: string, date: string): Record<string, { date: string; reading: number }> {
  const out: Record<string, { date: string; reading: number }> = {};
  for (const e of eRange(addDays(date, -WINDOW_DAYS), addDays(date, -1), 'meter', unit)) {
    const readings = e.data.readings || {};
    for (const m of Object.keys(readings)) {
      out[m] = { date: e.date, reading: num(readings[m]) };
    }
  }
  return out;
}

function boilerOpen(unit: string): Record<string, EntryRecord> {
  const out: Record<string, EntryRecord> = {};
  const t = today();
  for (const e of eRange(addDays(t, -1), t, 'boiler', unit)) {
    if (e.data.start && !e.data.stop) out[e.data.boiler] = e;
  }
  return out;
}

function dueList(): [string, string, string, string, string, string][] {
  const rows = db.prepare('SELECT c1,c2,c3,c4,c5,c6 FROM DueList ORDER BY rid').all() as Record<string, any>[];
  return rows
    .filter((r) => str(r.c2))
    .map((r) => [dkey(r.c1), str(r.c2), str(r.c3), str(r.c4), str(r.c5), str(r.c6)]);
}

function clearDueList(syncRemote = true): void {
  db.exec('DELETE FROM DueList');
  if (syncRemote) queueDueListReplace([]);
}

function latestDue(date: string): EntryRecord | null {
  const l = eRange(date, date, 'due', 'ALL');
  return l.length ? l[l.length - 1] : null;
}

function modGet(u: InternalUser, mod: string, unit: string, date: string): ModuleResponse {
  const mods = mod === 'scan' ? ['scan', 'due'] : mod;
  const out: ModuleResponse = {
    mod,
    unit,
    date,
    rows: eRange(date, date, mods, mod === 'scan' ? 'ALL' : unit),
  };
  if (mod === 'rewash') {
    out.state = rewashState(unit, date);
  } else if (mod === 'repair') {
    out.open = openItems('repair', unit);
  } else if (mod === 'wn') {
    out.open = openItems('wn', unit);
    out.adjToday = eRange(addDays(date, -WINDOW_DAYS), date, 'wn', unit).filter(
      (e) => String(e.data.adjAt || '').slice(0, 10) === date
    );
  } else if (mod === 'saree') {
    out.open = openItems('saree', unit);
    out.recvToday = eRange(addDays(date, -WINDOW_DAYS), date, 'saree', unit).filter(
      (e) => String(e.data.recvAt || '').slice(0, 10) === date
    );
  } else if (mod === 'boiler') {
    out.open = boilerOpen(unit);
    out.week = eRange(addDays(date, -6), date, 'boiler', unit);
  } else if (mod === 'meter') {
    out.last = meterLast(unit, date);
  } else if (mod === 'iron') {
    const ws = weekStart(date);
    out.weekStart = ws;
    out.week = eRange(ws, date, 'iron', unit);
  } else if (mod === 'grc') {
    out.yesterday = eRange(addDays(date, -1), addDays(date, -1), 'grc', unit)[0] || null;
  } else if (mod === 'scan') {
    const my = unitsFor(u);
    out.rows = out.rows.filter((e) => e.mod === 'due' || my.includes(e.unit));
    const last: Record<string, EntryRecord> = {};
    for (const e of eRange(addDays(date, -13), date, 'due', 'ALL')) {
      last[e.date] = e;
    }
    out.history = Object.keys(last)
      .sort()
      .map((k) => {
        const d = last[k].data;
        return { date: k, total: d.total, ul: d.UL, pc: d.PC, overdue: d.od };
      });
    out.list = date === today() ? dueList() : [];
  }
  return out;
}

const LOT_TYPES = ['Wash', 'Iron'];

interface LotRecord {
  key: string;
  date: string;
  unit: string;
  type: string;
  cleared: number;
  log: { at: string; by: string; pct: number }[];
  by: string;
  at: string;
}

function lotRows(unit: string): LotRecord[] {
  const rows = db.prepare('SELECT c1,c2,c3,c4,c5,c6,c7,c8 FROM Lots WHERE c3 = ? ORDER BY rid').all(unit) as Record<string, any>[];
  return rows.map((v) => ({
    key: str(v.c1),
    date: dkey(v.c2),
    unit: str(v.c3),
    type: str(v.c4),
    cleared: num(v.c5),
    log: jparse(v.c6, []),
    by: str(v.c7),
    at: str(v.c8),
  }));
}

function lotName(r: LotRecord): string {
  const parts = r.key.split('|');
  return parts[2] || r.date;
}

function ensureLots(unit: string, date: string): LotRecord[] {
  let rows = lotRows(unit);
  if (date > today()) return rows;
  const ins = db.prepare('INSERT OR IGNORE INTO Lots (c1,c2,c3,c4,c5,c6,c7,c8) VALUES (?,?,?,?,?,?,?,?)');
  let added = false;
  const stamp = nowStr();
  for (const t of LOT_TYPES) {
    const key = `${unit}|${t}|${date}`;
    if (!rows.some((r) => r.key === key)) {
      ins.run(key, date, unit, t, 0, '[]', 'auto', stamp);
      queueLotUpsert({
        lot_key: key,
        lot_date: date,
        unit,
        lot_type: t,
        cleared: 0,
        log: [],
        updated_by: 'auto',
        updated_at_text: stamp,
      });
      added = true;
    }
  }
  if (added) rows = lotRows(unit);
  return rows;
}

function lotsInfo(date: string, unit: string): LotsInfo {
  const rows = ensureLots(unit, date);
  const out: LotsInfo = { Wash: { pending: [], today: [] }, Iron: { pending: [], today: [] } };
  for (const t of LOT_TYPES) {
    const l = rows.filter((r) => r.type === t && r.date <= date);
    out[t] = {
      pending: l
        .filter((r) => r.cleared < 100)
        .map((r) => ({ key: r.key, name: lotName(r), date: r.date, cleared: r.cleared })),
      today: l
        .filter((r) => r.log.some((x) => x.at.slice(0, 10) === date))
        .map((r) => {
          const lg = r.log.filter((x) => x.at.slice(0, 10) === date);
          const lastL = lg[lg.length - 1];
          return { key: r.key, name: lotName(r), cleared: r.cleared, at: lastL.at.slice(11), by: lastL.by };
        }),
    };
  }
  return out;
}

function dailyRow(date: string, unit: string) {
  const r = db
    .prepare('SELECT c1,c2,c3,c4,c5,c6,c7,c8,c9 FROM Daily WHERE c1 = ?')
    .get(`${date}|${unit}`) as Record<string, any> | undefined;
  if (!r) return null;
  return {
    key: str(r.c1),
    data: jparse<Record<string, any>>(r.c4, {}),
    filled: num(r.c5),
    total: num(r.c6),
    submitted: str(r.c7),
    by: str(r.c8),
  };
}

function autos(date: string, unit: string): AutosData {
  const rows = eRange(date, date, null, unit);
  const by: Record<string, EntryRecord[]> = {};
  for (const e of rows) {
    (by[e.mod] = by[e.mod] || []).push(e);
  }
  const g = (m: string) => by[m] || [];
  const sum = (l: EntryRecord[], f: (e: EntryRecord) => number) => l.reduce((t, e) => t + num(f(e)), 0);

  const people: Record<string, number> = {};
  const done: Record<string, Record<string, Record<string, number>>> = {};
  for (const e of g('rp')) {
    for (const n of (e.data.names as string[]) || []) people[n] = 1;
    const r = (done[e.data.round] = done[e.data.round] || {});
    const st = (r[e.store] = r[e.store] || {});
    st[e.data.type] = 1;
  }

  const ironBy: Record<string, number> = {};
  for (const e of g('iron')) {
    ironBy[e.data.karigar] = (ironBy[e.data.karigar] || 0) + num(e.data.points);
  }

  const scan = { UL: 0, PC: 0, total: 0, uploads: 0 };
  for (const e of eRange(date, date, 'scan', 'ALL')) {
    if (e.unit === 'UL' || e.unit === 'PC') {
      scan[e.unit] += num(e.data.total);
    }
    scan.total += num(e.data.total);
    scan.uploads++;
  }

  const due = latestDue(date);
  const rw = rewashState(unit, date);
  const rwToday: Record<string, { Given: number; Received: number }> = {};
  for (const e of g('rewash')) {
    const k = (rwToday[e.data.kind] = rwToday[e.data.kind] || { Given: 0, Received: 0 });
    if (e.data.type === 'Given' || e.data.type === 'Received') {
      k[e.data.type as 'Given' | 'Received'] += num(e.data.qty);
    }
  }

  const openRep = openItems('repair', unit);
  const sar = openItems('saree', unit);
  const sarRecv = eRange(addDays(date, -WINDOW_DAYS), date, 'saree', unit).filter(
    (e) => String(e.data.recvAt || '').slice(0, 10) === date
  );

  const boil: Record<string, { mins: number; on: boolean; sessions: number }> = {};
  for (const e of g('boiler')) {
    const b = (boil[e.data.boiler] = boil[e.data.boiler] || { mins: 0, on: false, sessions: 0 });
    b.sessions++;
    b.mins += num(e.data.mins);
    if (!e.data.stop) b.on = true;
  }

  const se: Record<string, number> = {};
  for (const e of g('staffErr')) {
    se[e.data.staff] = (se[e.data.staff] || 0) + 1;
  }

  const grc = g('grc')[0];
  const meter = g('meter')[0];

  const wnAll = eRange(addDays(date, -WINDOW_DAYS), date, 'wn', unit);
  const wnAdj = wnAll.filter((e) => String(e.data.adjAt || '').slice(0, 10) === date && e.data.kind === 'garment');
  const wnPend = wnAll.filter((e) => e.data.status !== 'Adjusted');

  return {
    rp: { entries: g('rp').length, people: Object.keys(people), done },
    iron: { entries: g('iron').length, points: sum(g('iron'), (e) => e.data.points), byK: ironBy },
    scan,
    due: due ? (due.data as AutosData['due']) : null,
    rewash: {
      today: rwToday,
      balance: Object.keys(rw).reduce<Record<string, number>>((m, k) => {
        m[k] = rw[k].balance;
        return m;
      }, {}),
    },
    repair: {
      sentToday: g('repair').length,
      pending: openRep.length,
      back: openRep.filter((e) => e.data.status === 'Back').length,
      oldest: openRep.length ? openRep[0].date : '',
    },
    spot: {
      count: g('spot').length,
      avg: g('spot').length ? Math.round(sum(g('spot'), (e) => e.data.pct) / g('spot').length) : 0,
    },
    quickfix: {
      count: g('quickfix').length,
      qf: g('quickfix').filter((e) => e.data.kind === 'QF').length,
      ir: g('quickfix').filter((e) => e.data.kind === 'IR').length,
    },
    washerr: { count: g('washerr').length, points: sum(g('washerr'), (e) => e.data.points) },
    staffErr: { count: g('staffErr').length, byStaff: se },
    grc: grc ? (grc.data as AutosData['grc']) : null,
    meter: meter ? (meter.data as AutosData['meter']) : null,
    boiler: boil,
    wn: {
      adjToday: wnAdj.length,
      adjList: wnAdj.map((e) => `${e.data.garment} → ${e.data.inv} (${e.data.adjStore})`),
      newToday: g('wn').length,
      pendingG: wnPend.filter((e) => e.data.kind === 'garment').length,
      pendingT: wnPend.filter((e) => e.data.kind === 'tag').length,
    },
    saree: {
      sentToday: sum(g('saree'), (e) => e.data.qty),
      sentTo: g('saree').map((e) => `${e.data.to} ${e.data.qty}`),
      recvToday: sum(sarRecv, (e) => e.data.recvQty),
      diffToday: sarRecv
        .filter((e) => e.data.diff)
        .map((e) => `${e.data.to} ${e.data.diff > 0 ? '+' : ''}${e.data.diff} (${e.data.reason})`),
      pending: sum(sar, (e) => e.data.qty),
      batches: sar.length,
      oldest: sar.length ? sar[0].date : '',
    },
    lots: lotsInfo(date, unit),
  };
}

function dailyWrite(u: InternalUser, date: string, unit: string, patch: Record<string, any>, p: Record<string, any>) {
  const cur = dailyRow(date, unit);
  const data = cur ? { ...cur.data } : {};
  if (cur && cur.submitted && !isMgr(u)) {
    throw new Error('Report already submitted — only Manager can change it');
  }
  for (const k of Object.keys(patch)) {
    if (patch[k] === null || patch[k] === '') delete data[k];
    else data[k] = patch[k];
  }
  const submitted = p.submit ? `${u.name} @ ${hmNow()}` : cur ? cur.submitted : '';
  const filled = p.total ? num(p.filled) : cur ? cur.filled : 0;
  const total = p.total ? num(p.total) : cur ? cur.total : 0;
  const key = `${date}|${unit}`;
  const updatedAt = nowStr();
  db.prepare(
    'INSERT INTO Daily (c1,c2,c3,c4,c5,c6,c7,c8,c9) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(c1) DO UPDATE SET c4=excluded.c4,c5=excluded.c5,c6=excluded.c6,c7=excluded.c7,c8=excluded.c8,c9=excluded.c9'
  ).run(key, date, unit, JSON.stringify(data), filled, total, submitted, u.name, updatedAt);
  queueDailyUpsert({
    report_key: key,
    report_date: date,
    unit,
    data,
    filled,
    total,
    submitted,
    updated_by: u.name,
    updated_at_text: updatedAt,
  });
  if (p.submit) logAction(u.name, 'daily.submit', `${date} ${unit}`);
  return { submitted };
}

let pendingFormspree: FormspreeEvent[] = [];

function queueFormspreeEvent(ev: FormspreeEvent): void {
  pendingFormspree.push(ev);
}

function withTransaction<T>(fn: () => T): T {
  db.exec('BEGIN');
  try {
    const res = fn();
    db.exec('COMMIT');
    return res;
  } catch (err) {
    db.exec('ROLLBACK');
    clearSyncQueue();
    pendingFormspree = [];
    throw err;
  }
}

function minsDiff(a: string, b: string): number {
  const x = a.split(':').map(Number);
  const y = b.split(':').map(Number);
  const m = y[0] * 60 + y[1] - (x[0] * 60 + x[1]);
  return m < 0 ? m + 1440 : m;
}

function hmTxt(m: number): string {
  return `${Math.floor(m / 60)}h ${('0' + (m % 60)).slice(-2)}m`;
}

function entityFor(storeObj: { pc: boolean } | undefined, services: string, itCodes: string[]): 'UL' | 'PC' {
  const list = String(services || '')
    .toUpperCase()
    .split(/[,/+ ]+/)
    .map(str)
    .filter(Boolean);
  if (list.some((s) => itCodes.includes(s))) return 'UL';
  return storeObj && storeObj.pc ? 'PC' : 'UL';
}

const ROW_ALERTS: Record<string, string> = {
  d16_rows: 'challan',
  d18_rows: 'sticker',
  d19_rows: 'extra',
  d22_rows: 'grc',
};

export function handleApi(reqBody: { action?: string; token?: string; p?: Record<string, any> }): { ok: true; data: any } | { ok: false; error: string } {
  try {
    const req = reqBody || {};
    ensureSchema();
    const a = req.action;
    const p = req.p || {};
    if (a === 'boot') {
      return { ok: true, data: { today: today(), theme: getSettings().theme || 'hollywood' } };
    }
    if (a === 'login') {
      return { ok: true, data: login(p) };
    }
    const u = checkToken(req.token);

    switch (a) {
      case 'init':
        return { ok: true, data: { me: meObj(u), settings: getSettings(), today: today() } };

      case 'home': {
        const unit = unitFor(u, p);
        const date = today();
        const d = dailyRow(date, unit);
        const home: HomeData = {
          date,
          unit,
          autos: autos(date, unit),
          daily: d ? { filled: d.filled, total: d.total, submitted: d.submitted } : null,
        };
        return { ok: true, data: home };
      }

      case 'daily.get': {
        need(u, 'daily');
        const unit = unitFor(u, p);
        const date = seeDate(u, p.date);
        const d = dailyRow(date, unit);
        const y = dailyRow(addDays(date, -1), unit);
        const prev: Record<string, any> = {};
        if (y) {
          for (const k of Object.keys(y.data)) {
            if (/^d(18|19|22)_/.test(k)) prev[k] = y.data[k];
          }
        }
        const resp: DailyResponse = {
          date,
          unit,
          prev,
          data: d ? d.data : {},
          meta: d ? { filled: d.filled, total: d.total, submitted: d.submitted, by: d.by } : null,
          autos: autos(date, unit),
        };
        return { ok: true, data: resp };
      }

      case 'daily.save': {
        need(u, 'daily');
        const unit = unitFor(u, p);
        const date = dateFor(u, p.date);
        const wasSubmitted = Boolean(dailyRow(date, unit)?.submitted);
        const res = withTransaction(() => dailyWrite(u, date, unit, p.patch || {}, p));
        if (p.submit || wasSubmitted) {
          const cur = dailyRow(date, unit);
          queueFormspreeEvent({
            action: p.submit ? 'daily.submit' : 'daily.update',
            activity: p.submit ? 'Daily Workshop Report Submitted' : 'Daily Workshop Report Updated',
            unit,
            date,
            time: hmNow(),
            user: u.name,
            role: u.role,
            summary: `${unit} · ${cur?.filled ?? 0}/${cur?.total ?? 0} points · ${res.submitted || 'Updated'}`,
            details: {
              filled: cur?.filled ?? 0,
              total: cur?.total ?? 0,
              submitted: res.submitted,
              checklist: cur?.data || {},
              autos: autos(date, unit),
            },
          });
        }
        return { ok: true, data: res };
      }

      case 'daily.row': {
        need(u, 'daily');
        const unit = unitFor(u, p);
        const date = dateFor(u, p.date);
        const key = str(p.key);
        if (!/^d\d+_rows$/.test(key)) throw new Error('Bad point');
        const row: Record<string, any> = { ...(p.row || {}) };
        for (const k of Object.keys(row)) {
          row[k] = str(row[k]);
          if (!row[k]) throw new Error('Fill all boxes');
        }
        row.addedBy = u.name;
        row.at = hmNow();
        const kind = ROW_ALERTS[key];
        if (kind) sendAlert(u, kind, date, unit, row);
        const list = withTransaction(() => {
          const cur = dailyRow(date, unit);
          const arr = cur && Array.isArray(cur.data[key]) ? [...cur.data[key]] : [];
          if (key === 'd20_rows') {
            eAppend([eMake(u, 'staffErr', date, unit, '', `${row.by} · Packing / release: ${row.t}`, { staff: row.by, note: `Packing / release mistake: ${row.t}`, src: 'daily' })]);
            row.se = 1;
          }
          arr.push(row);
          dailyWrite(u, date, unit, { [key]: arr }, {});
          return arr;
        });
        queueFormspreeEvent({
          action: 'daily.row',
          activity: `Daily Checklist Row Added (${key})`,
          unit,
          date,
          time: hmNow(),
          user: u.name,
          role: u.role,
          store: str(row.st),
          summary: `${key}: ${Object.entries(row).map(([k, v]) => `${k}=${v}`).join(' · ')}`,
          details: { field: key, row, total_rows: list.length },
        });
        return { ok: true, data: { rows: list } };
      }

      case 'daily.rowdel': {
        need(u, 'daily');
        if (!isMgr(u)) throw new Error(lockedMsg());
        const unit = unitFor(u, p);
        const date = validDate(p.date);
        const key = str(p.key);
        let removed: Record<string, any> | undefined;
        const list = withTransaction(() => {
          const cur = dailyRow(date, unit);
          if (!cur) throw new Error('Not found');
          const arr = Array.isArray(cur.data[key]) ? [...cur.data[key]] : [];
          removed = arr.splice(Number(p.idx), 1)[0];
          dailyWrite(u, date, unit, { [key]: arr }, {});
          return arr;
        });
        queueFormspreeEvent({
          action: 'daily.rowdel',
          activity: `Daily Checklist Row Deleted (${key})`,
          unit,
          date,
          time: hmNow(),
          user: u.name,
          role: u.role,
          summary: `Deleted row #${Number(p.idx) + 1} from ${key}`,
          details: { field: key, removed: removed || null, remaining: list.length },
        });
        return { ok: true, data: { rows: list } };
      }

      case 'lot.update': {
        need(u, 'daily');
        const unit = unitFor(u, p);
        const date = dateFor(u, p.date);
        let pct = Math.round(num(p.pct));
        if (pct < 0 || pct > 100) throw new Error('Enter 0 – 100 %');
        const res = withTransaction(() => {
          const r = ensureLots(unit, today()).find((x) => x.key === p.lot);
          if (!r) throw new Error('Lot not found');
          pct = pct >= 100 ? 100 : 0;
          if (pct < r.cleared && !isMgr(u)) throw new Error('Already cleared — only Manager can undo');
          if (pct === r.cleared) throw new Error(pct ? 'Already cleared' : 'Not cleared yet');
          const nextLog = [...r.log, { at: `${date} ${hmNow()}`, by: u.name, pct }];
          const stamp = nowStr();
          db.prepare('UPDATE Lots SET c5 = ?, c6 = ?, c7 = ?, c8 = ? WHERE c1 = ?').run(pct, JSON.stringify(nextLog), u.name, stamp, r.key);
          queueLotUpsert({
            lot_key: r.key,
            lot_date: r.date,
            unit: r.unit,
            lot_type: r.type,
            cleared: pct,
            log: nextLog,
            updated_by: u.name,
            updated_at_text: stamp,
          });
          logAction(u.name, `lot.${pct ? 'cleared' : 'undo'}`, r.key);
          queueFormspreeEvent({
            action: `lot.${pct ? 'cleared' : 'undo'}`,
            activity: `${r.type} Lot ${pct ? 'Cleared' : 'Reopened'}`,
            unit,
            date,
            time: hmNow(),
            user: u.name,
            role: u.role,
            summary: `${r.key} → ${pct}%`,
            details: { lot_key: r.key, lot_type: r.type, lot_date: r.date, cleared: pct, log: nextLog },
          });
          return lotsInfo(date, unit);
        });
        return { ok: true, data: res };
      }

      case 'lot.create': {
        need(u, 'daily');
        const unit = unitFor(u, p);
        const date = dateFor(u, p.date);
        const ld = validDate(p.lotDate || date);
        const t = str(p.type);
        if (!LOT_TYPES.includes(t)) throw new Error('Choose washing or iron lot');
        if (ld > today()) throw new Error('Future date not allowed');
        const res = withTransaction(() => {
          const rows = ensureLots(unit, today()).filter((r) => r.type === t && r.date === ld);
          const n = rows.length;
          const key = `${unit}|${t}|${ld}${n ? ` #${n + 1}` : ''}`;
          const stamp = nowStr();
          db.prepare('INSERT INTO Lots (c1,c2,c3,c4,c5,c6,c7,c8) VALUES (?,?,?,?,?,?,?,?)').run(key, ld, unit, t, 0, '[]', u.name, stamp);
          queueLotUpsert({
            lot_key: key,
            lot_date: ld,
            unit,
            lot_type: t,
            cleared: 0,
            log: [],
            updated_by: u.name,
            updated_at_text: stamp,
          });
          logAction(u.name, 'lot.create', key);
          queueFormspreeEvent({
            action: 'lot.create',
            activity: `${t} Lot Created`,
            unit,
            date: ld,
            time: hmNow(),
            user: u.name,
            role: u.role,
            summary: `Created lot ${key}`,
            details: { lot_key: key, lot_date: ld, lot_type: t, unit },
          });
          return lotsInfo(date, unit);
        });
        return { ok: true, data: res };
      }

      case 'e.get': {
        need(u, str(p.mod));
        return { ok: true, data: modGet(u, str(p.mod), unitFor(u, p), seeDate(u, p.date)) };
      }

      case 'e.add': {
        const mod = str(p.mod);
        need(u, mod);
        const H = HOOK[mod];
        if (!H) throw new Error('Bad screen');
        const unit = unitFor(u, p);
        const date = dateFor(u, p.date);
        const items = (p.items as Record<string, any>[]) || [];
        if (!items.length) throw new Error('Nothing to save');
        const res = withTransaction(() => {
          const rows = items.map((x) => {
            const r = H(u, unit, x, date);
            return eMake(u, mod, date, unit, r.store, r.summary, r.data);
          });
          eAppend(rows);
          logAction(u.name, `${mod}.add`, `${rows.length} rows`);
          for (const r of rows) {
            const rec = eRow({
              c1: r[0],
              c2: r[1],
              c3: r[2],
              c4: r[3],
              c5: r[4],
              c6: r[5],
              c7: r[6],
              c8: r[7],
              c9: r[8],
            });
            queueFormspreeEvent({
              action: `${mod}.add`,
              activity: `${moduleLabel(mod)} Entry`,
              unit,
              date,
              time: rec.at || hmNow(),
              user: u.name,
              role: u.role,
              store: rec.store,
              summary: rec.summary,
              details: { id: rec.id, mod, ...rec.data },
            });
          }
          const out = modGet(u, mod, unit, date);
          out.added = rows.map((r) => String(r[0]));
          return out;
        });
        return { ok: true, data: res };
      }

      case 'e.update': {
        need(u, str(p.mod));
        if (!isMgr(u)) throw new Error(lockedMsg());
        const res = withTransaction(() => {
          const f = eFind(str(p.id));
          const H = HOOK[f.mod];
          if (!H || f.mod !== p.mod) throw new Error('Cannot edit this entry');
          const r = H(u, f.unit, p.data || {}, f.date);
          const keep = f.data;
          if (f.mod === 'repair') {
            for (const k of ['status', 'sentAt', 'backAt', 'backBy', 'releasedAt', 'releasedBy']) {
              if (keep[k] !== undefined) r.data[k] = keep[k];
            }
          }
          if (f.mod === 'wn') {
            for (const k of ['status', 'inv', 'adjStore', 'adjAt', 'adjBy', 'link', 'photo', 'photos', 'mail']) {
              if (keep[k] !== undefined && (k !== 'photo' || !r.data.photo)) r.data[k] = keep[k];
            }
          }
          if (f.mod === 'saree') {
            for (const k of ['status', 'sentAt', 'recvQty', 'recvAt', 'recvBy', 'reason', 'diff']) {
              if (keep[k] !== undefined) r.data[k] = keep[k];
            }
          }
          f.store = str(r.store);
          f.summary = r.summary;
          f.data = r.data;
          eWrite(f);
          logAction(u.name, 'e.update', f.id);
          queueFormspreeEvent({
            action: `${f.mod}.update`,
            activity: `${moduleLabel(f.mod)} Updated`,
            unit: f.unit,
            date: f.date,
            time: hmNow(),
            user: u.name,
            role: u.role,
            store: f.store,
            summary: f.summary,
            details: { id: f.id, mod: f.mod, ...f.data },
          });
          return modGet(u, f.mod, f.unit, f.date);
        });
        return { ok: true, data: res };
      }

      case 'e.del': {
        need(u, str(p.mod));
        const rawIds = p.ids ? (Array.isArray(p.ids) ? p.ids : [p.ids]) : p.id ? [p.id] : [];
        const ids = rawIds.map(String).filter(Boolean);
        if (!ids.length) throw new Error('Not found');
        const res = withTransaction(() => {
          let last: EntryRecord | null = null;
          const nowMs = Date.now();
          for (const id of ids) {
            const f = eFind(id);
            if (!isMgr(u)) {
              const t = f.stamp.replace(' ', 'T') + '+05:30';
              const age = (nowMs - new Date(t).getTime()) / 60000;
              if (f.by !== u.name || !(age >= 0 && age <= 5)) throw new Error(lockedMsg());
              if (
                ['repair', 'saree', 'wn'].includes(f.mod) &&
                f.data.status !== (f.mod === 'saree' || f.mod === 'repair' ? 'Sent' : 'Pending')
              ) {
                throw new Error(lockedMsg());
              }
            }
            db.prepare('DELETE FROM Entries WHERE c1 = ?').run(f.id);
            queueEntryDelete(f.id);
            logAction(u.name, isMgr(u) ? 'e.del' : 'e.undo', `${f.mod} ${f.summary}`);
            queueFormspreeEvent({
              action: isMgr(u) ? `${f.mod}.delete` : `${f.mod}.undo`,
              activity: `${moduleLabel(f.mod)} ${isMgr(u) ? 'Deleted' : 'Undone'}`,
              unit: f.unit,
              date: f.date,
              time: hmNow(),
              user: u.name,
              role: u.role,
              store: f.store,
              summary: f.summary,
              details: { id: f.id, mod: f.mod, removed_data: f.data },
            });
            if (f.mod === 'due') {
              const l = latestDue(f.date);
              if (!l) clearDueList();
            }
            last = f;
          }
          const unit = last!.unit === 'ALL' ? unitsFor(u)[0] : last!.unit;
          return modGet(u, str(p.mod) || last!.mod, unit, last!.date);
        });
        return { ok: true, data: res };
      }

      case 'iron.save': {
        need(u, 'iron');
        const unit = unitFor(u, p);
        const date = dateFor(u, p.date);
        const items = ((p.items as Record<string, any>[]) || [])
          .map((x) => ({ k: str(x.karigar), pts: Math.round(num(x.points)), note: str(x.note) }))
          .filter((x) => x.k && (x.pts > 0 || x.note));
        if (!items.length) throw new Error('Enter points for at least one karigar');
        const res = withTransaction(() => {
          const rows = items.map((x) =>
            eMake(u, 'iron', date, unit, '', `${x.k} · ${x.pts} pts${x.note ? ` · ${x.note}` : ''}`, {
              karigar: x.k,
              points: x.pts,
              note: x.note,
            })
          );
          eAppend(rows);
          logAction(u.name, 'iron.save', `${items.length} karigars`);
          const totalPts = items.reduce((s, x) => s + x.pts, 0);
          queueFormspreeEvent({
            action: 'iron.save',
            activity: 'Ironmen Error Saved',
            unit,
            date,
            time: hmNow(),
            user: u.name,
            role: u.role,
            summary: `${items.length} karigar(s) · ${totalPts} pts total (${items.map((x) => `${x.k}: ${x.pts}`).join(', ')})`,
            details: { points: totalPts, items },
          });
          const out = modGet(u, 'iron', unit, date);
          out.added = rows.map((r) => String(r[0]));
          return out;
        });
        return { ok: true, data: res };
      }

      case 'rewash.save': {
        need(u, 'rewash');
        const unit = unitFor(u, p);
        const date = dateFor(u, p.date);
        const by = str(p.by) || u.name;
        const lines = ((p.lines as Record<string, any>[]) || [])
          .map((l) => ({
            kind: str(l.kind),
            given: Math.max(0, Math.round(num(l.given))),
            received: Math.max(0, Math.round(num(l.received))),
          }))
          .filter((l) => l.kind && (l.given || l.received));
        if (!lines.length) throw new Error('Enter quantity');
        const res = withTransaction(() => {
          const st = rewashState(unit, date);
          const rows: (string | number)[][] = [];
          for (const l of lines) {
            const bal = (st[l.kind] ? st[l.kind].balance : 0) + l.given;
            if (l.received > bal) throw new Error(`${l.kind}: received ${l.received} but only ${bal} pending`);
            if (l.given) rows.push(eMake(u, 'rewash', date, unit, '', `${l.kind} · Given · ${l.given} pcs · ${by}`, { kind: l.kind, type: 'Given', qty: l.given, by }));
            if (l.received) rows.push(eMake(u, 'rewash', date, unit, '', `${l.kind} · Received · ${l.received} pcs · ${by}`, { kind: l.kind, type: 'Received', qty: l.received, by }));
          }
          eAppend(rows);
          logAction(u.name, 'rewash.save', JSON.stringify(lines));
          const out = modGet(u, 'rewash', unit, date);
          out.added = rows.map((r) => String(r[0]));
          queueFormspreeEvent({
            action: 'rewash.save',
            activity: 'Rewash Saved',
            unit,
            date,
            time: hmNow(),
            user: u.name,
            role: u.role,
            summary: lines.map((l) => `${l.kind}: +${l.given} / -${l.received} (${by})`).join(' · '),
            details: { by, lines, state: out.state },
          });
          return out;
        });
        return { ok: true, data: res };
      }

      case 'repair.step': {
        need(u, 'repair');
        const unit = unitFor(u, p);
        const res = withTransaction(() => {
          const f = eFind(str(p.id));
          const d = f.data;
          const stamp = `${today()} ${hmNow()}`;
          if (f.mod !== 'repair' || (f.unit !== unit && d.sentTo !== unit && !isMgr(u))) throw new Error('Not found');
          if (p.step === 'Back') {
            if (d.backAt) throw new Error('Already marked back');
            d.status = 'Back';
            d.backAt = stamp;
            d.backBy = u.name;
          } else if (p.step === 'Released') {
            if (d.status === 'Released') throw new Error('Already released');
            if (!d.backAt) {
              d.backAt = stamp;
              d.backBy = u.name;
            }
            d.status = 'Released';
            d.releasedAt = stamp;
            d.releasedBy = u.name;
          } else {
            throw new Error('Bad step');
          }
          eWrite(f);
          logAction(u.name, `repair.${p.step}`, f.id);
          queueFormspreeEvent({
            action: `repair.${p.step}`,
            activity: `Repair Checkout — ${p.step === 'Released' ? 'Released to Store' : 'Back from Repair'}`,
            unit,
            date: today(),
            time: hmNow(),
            user: u.name,
            role: u.role,
            store: f.store,
            summary: `${f.store} · ${d.tag} · ${d.garment} → ${d.status}`,
            details: { id: f.id, ...d },
          });
          return modGet(u, 'repair', unit, today());
        });
        return { ok: true, data: res };
      }

      case 'saree.receive': {
        need(u, 'saree');
        const unit = unitFor(u, p);
        const q = Math.round(num(p.qty));
        const date = dateFor(u, p.date);
        if (q < 0) throw new Error('Enter quantity');
        const res = withTransaction(() => {
          const f = eFind(str(p.id));
          const d = f.data;
          if (f.mod !== 'saree' || f.unit !== unit) throw new Error('Not found');
          if (d.status === 'Received') throw new Error('Already received');
          const diff = q - num(d.qty);
          if (diff !== 0 && !str(p.reason)) throw new Error(`Sent ${d.qty}, received ${q} — write the reason for the difference`);
          d.status = 'Received';
          d.recvQty = q;
          d.diff = diff;
          d.reason = str(p.reason);
          d.recvAt = `${date} ${hmNow()}`;
          d.recvBy = u.name;
          f.summary = `Sent ${d.qty} → ${d.to} · received ${q}${diff ? ` (${diff > 0 ? '+' : ''}${diff}: ${d.reason})` : ''}`;
          eWrite(f);
          logAction(u.name, 'saree.receive', `${f.id} ${q}`);
          queueFormspreeEvent({
            action: 'saree.receive',
            activity: 'Saree Polish Received',
            unit,
            date,
            time: hmNow(),
            user: u.name,
            role: u.role,
            summary: f.summary,
            details: { id: f.id, ...d },
          });
          return modGet(u, 'saree', unit, date);
        });
        return { ok: true, data: res };
      }

      case 'wn.adjust': {
        need(u, 'wn');
        const unit = unitFor(u, p);
        const date = dateFor(u, p.date);
        let inv = str(p.inv).toUpperCase();
        let store = str(p.store);
        const res = withTransaction(() => {
          const f = eFind(str(p.id));
          const d = f.data;
          if (f.mod !== 'wn' || f.unit !== unit) throw new Error('Not found');
          if (d.status === 'Adjusted') throw new Error('Already adjusted');
          if (d.kind === 'garment') {
            if (!inv) throw new Error('Enter the invoice number');
            if (!store) throw new Error('Choose the store');
          } else {
            inv = d.tag;
            store = store || f.store;
          }
          d.status = 'Adjusted';
          d.inv = inv;
          d.adjStore = store;
          d.adjAt = `${date} ${hmNow()}`;
          d.adjBy = u.name;
          if (p.note) d.adjNote = str(p.note);
          f.summary = `${d.kind === 'tag' ? `Detached tag ${d.tag}` : `WN ${d.garment}`} · adjusted ${inv} (${store})`;
          let linked = '';
          if (d.kind === 'garment') {
            const matchTag = openItems('wn', unit).find((e) => e.data.kind === 'tag' && e.data.tag === inv);
            if (matchTag) {
              const tf = eFind(matchTag.id);
              tf.data.status = 'Adjusted';
              tf.data.inv = inv;
              tf.data.adjStore = store;
              tf.data.adjAt = d.adjAt;
              tf.data.adjBy = u.name;
              tf.data.link = f.id;
              tf.summary = `Detached tag ${inv} · matched with WN ${d.garment}`;
              eWrite(tf);
              d.link = matchTag.id;
              linked = matchTag.id;
            }
          }
          eWrite(f);
          logAction(u.name, 'wn.adjust', `${f.id} ${inv}`);
          queueFormspreeEvent({
            action: 'wn.adjust',
            activity: 'WN Garment / Tag Adjusted',
            unit,
            date,
            time: hmNow(),
            user: u.name,
            role: u.role,
            store,
            summary: f.summary,
            details: { id: f.id, linked, ...d },
          });
          const out = modGet(u, 'wn', unit, date);
          out.linked = linked;
          return out;
        });
        return { ok: true, data: res };
      }

      case 'photo': {
        if (!p.data) throw new Error('No photo');
        const id = 'P' + crypto.randomBytes(9).toString('hex');
        const b64 = String(p.data);
        const buf = Buffer.from(b64, 'base64');
        if (buf.length > 6 * 1024 * 1024) throw new Error('Photo too big');
        const hash = crypto.createHash('sha256').update(buf).digest('hex');
        fs.writeFileSync(path.join(PHOTOS_DIR, `${id}.jpg`), buf);
        queuePhotoUpsert(id, b64);
        return { ok: true, data: { id, url: `/photo/${id}`, hash } };
      }

      case 'boiler.tap': {
        need(u, 'boiler');
        const unit = unitFor(u, p);
        const date = today();
        const time = hmNow();
        const b = str(p.boiler);
        const bo = (getSettings().boilers || []).find((x) => x.name === b);
        if (!bo) throw new Error('Unknown boiler');
        if (!isMgr(u) && (bo.staff || []).length && !bo.staff.includes(u.name)) {
          throw new Error(`${b} is not given to you`);
        }
        const res = withTransaction(() => {
          const open = boilerOpen(unit)[b];
          let eventSummary = '';
          let eventDetails: Record<string, any> = { boiler: b };
          if (p.what === 'start') {
            if (open) throw new Error(`${b} is already running since ${open.data.start}`);
            eventSummary = `${b} · Start ${time} · ${u.name}`;
            eventDetails = { boiler: b, start: time, by: u.name, status: 'Running' };
            eAppend([eMake(u, 'boiler', date, unit, '', eventSummary, { boiler: b, start: time, by: u.name })]);
          } else {
            if (!open) throw new Error(`${b} is not running`);
            const f = eFind(open.id);
            const d = f.data;
            d.stop = time;
            d.stopBy = u.name;
            d.mins = minsDiff(d.start, time);
            f.summary = `${b} · ${d.start} – ${time} (${hmTxt(d.mins)})`;
            eWrite(f);
            eventSummary = f.summary;
            eventDetails = { id: f.id, ...d, status: 'Stopped' };
          }
          logAction(u.name, `boiler.${p.what}`, b);
          queueFormspreeEvent({
            action: `boiler.${p.what}`,
            activity: `Boiler ${p.what === 'start' ? 'Started' : 'Stopped'}`,
            unit,
            date,
            time,
            user: u.name,
            role: u.role,
            summary: eventSummary,
            details: eventDetails,
          });
          return modGet(u, 'boiler', unit, date);
        });
        return { ok: true, data: res };
      }

      case 'meter.save': {
        need(u, 'meter');
        const unit = unitFor(u, p);
        const date = dateFor(u, p.date);
        const rd = (p.readings as Record<string, any>) || {};
        const last = meterLast(unit, date);
        const readings: Record<string, number> = {};
        const used: Record<string, number | null> = {};
        for (const m of getSettings().meters || []) {
          const v = str(rd[m.name]);
          if (v === '') continue;
          const x = num(v);
          if (x < 0) throw new Error(`Bad reading for ${m.name}`);
          if (last[m.name] && x < last[m.name].reading && !p.force) {
            throw new Error(`${m.name}: today ${x} is lower than last ${last[m.name].reading}. Check the reading.`);
          }
          readings[m.name] = x;
          used[m.name] = last[m.name] ? Math.round((x - last[m.name].reading) * 100) / 100 : null;
        }
        if (!Object.keys(readings).length) throw new Error('Enter a reading');
        const sumTxt = Object.keys(readings)
          .map((k) => `${k} ${readings[k]}${used[k] != null ? ` (used ${used[k]})` : ''}`)
          .join(' · ');
        const res = withTransaction(() => {
          const cur = eRange(date, date, 'meter', unit).find((e) => e.unit === unit);
          if (cur) {
            if (!isMgr(u)) throw new Error(lockedMsg());
            const f = eFind(cur.id);
            f.data = { readings, used };
            f.summary = sumTxt;
            eWrite(f);
          } else {
            eAppend([eMake(u, 'meter', date, unit, '', sumTxt, { readings, used })]);
          }
          logAction(u.name, 'meter.save', sumTxt);
          queueFormspreeEvent({
            action: 'meter.save',
            activity: 'Electricity & Water Readings',
            unit,
            date,
            time: hmNow(),
            user: u.name,
            role: u.role,
            summary: sumTxt,
            details: { readings, used },
          });
          return modGet(u, 'meter', unit, date);
        });
        return { ok: true, data: res };
      }

      case 'grc.save': {
        need(u, 'grc');
        const unit = unitFor(u, p);
        const date = dateFor(u, p.date);
        const counts: Record<string, number> = {};
        let total = 0;
        for (const s of Object.keys(p.counts || {})) {
          const v = str((p.counts as Record<string, any>)[s]);
          if (v === '') continue;
          const n = Math.max(0, Math.round(num(v)));
          counts[s] = n;
          total += n;
        }
        if (!Object.keys(counts).length) throw new Error('Enter at least one store');
        const sumTxt = `GRC ${total} · ${Object.keys(counts)
          .map((s) => `${s} ${counts[s]}`)
          .join(', ')}`;
        const res = withTransaction(() => {
          const cur = eRange(date, date, 'grc', unit).find((e) => e.unit === unit);
          if (cur) {
            if (!isMgr(u)) throw new Error(lockedMsg());
            const f = eFind(cur.id);
            f.data = { counts, total };
            f.summary = sumTxt;
            eWrite(f);
          } else {
            eAppend([eMake(u, 'grc', date, unit, '', sumTxt, { counts, total })]);
          }
          logAction(u.name, 'grc.save', sumTxt);
          queueFormspreeEvent({
            action: 'grc.save',
            activity: 'GRC Count Saved',
            unit,
            date,
            time: hmNow(),
            user: u.name,
            role: u.role,
            summary: sumTxt,
            details: { counts, total },
          });
          return modGet(u, 'grc', unit, date);
        });
        return { ok: true, data: res };
      }

      case 'scan.upload': {
        need(u, 'scan');
        const unit = unitFor(u, p);
        const date = dateFor(u, p.date);
        const notes = ((p.notes as string[]) || []).map(String).filter(Boolean);
        const smap = storeMap();
        const stores: Record<string, number> = {};
        let total = 0;
        for (const raw of Object.keys(p.stores || {})) {
          const so = smap[str(raw).toUpperCase()];
          const code = so ? so.code : str(raw).toUpperCase();
          const q = Math.max(0, Math.round(num((p.stores as Record<string, any>)[raw])));
          if (!code || !q) continue;
          stores[code] = (stores[code] || 0) + q;
          total += q;
        }
        if (!total) throw new Error('No garments found in the file');
        const res = withTransaction(() => {
          if (notes.length) {
            const seen: Record<string, EntryRecord> = {};
            for (const e of eRange(addDays(date, -10), date, 'scan', 'ALL')) {
              for (const n of (e.data.notes as string[]) || []) seen[n] = e;
            }
            const dup = notes.filter((n) => seen[n]);
            if (dup.length) {
              const e = seen[dup[0]];
              throw new Error(
                `This file was already uploaded (${e.unit}, ${e.date.split('-').reverse().join('/')} ${e.at}, ${dup.length} delivery notes) — not counted again. Manager can delete that upload first.`
              );
            }
          }
          const sumTxt = `${unit} ${total} pcs · ${Object.keys(stores)
            .map((s) => `${s} ${stores[s]}`)
            .join(', ')}`;
          eAppend([eMake(u, 'scan', date, unit, '', sumTxt, { stores, total, notes, fileTotal: num(p.fileTotal) })]);
          logAction(u.name, 'scan.upload', sumTxt);
          queueFormspreeEvent({
            action: 'scan.upload',
            activity: 'Scanned Garments Uploaded',
            unit,
            date,
            time: hmNow(),
            user: u.name,
            role: u.role,
            summary: sumTxt,
            details: { stores, total, notes, fileTotal: num(p.fileTotal) },
          });
          return modGet(u, 'scan', unit, date);
        });
        return { ok: true, data: res };
      }

      case 'due.upload': {
        need(u, 'scan');
        const unit = unitFor(u, p);
        const date = dateFor(u, p.date);
        const items = (p.items as Record<string, any>[]) || [];
        if (!items.length) throw new Error('No garments found in the file');
        const smap = storeMap();
        const it = getSettings().itCodes.map((x) => String(x).toUpperCase());
        const byDate: Record<string, { UL: number; PC: number }> = {};
        const byStore: Record<string, { UL: number; PC: number; od: number }> = {};
        const t = { total: 0, UL: 0, PC: 0, od: 0, odUL: 0, odPC: 0 };
        const list: [string, string, string, string, string, string][] = [];
        for (const x of items) {
          const raw = str(x.store).toUpperCase();
          const so = smap[raw];
          const store = so ? so.code : raw;
          const ent = entityFor(so, str(x.service), it);
          const due = str(x.due);
          t.total++;
          t[ent]++;
          const b = (byDate[due] = byDate[due] || { UL: 0, PC: 0 });
          b[ent]++;
          const s = (byStore[store] = byStore[store] || { UL: 0, PC: 0, od: 0 });
          s[ent]++;
          if (due && due < date) {
            t.od++;
            t[ent === 'UL' ? 'odUL' : 'odPC']++;
            s.od++;
          }
          list.push([due, str(x.barcode), store, str(x.garment), str(x.service), ent]);
        }
        list.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
        const res = withTransaction(() => {
          const data = { total: t.total, UL: t.UL, PC: t.PC, od: t.od, odUL: t.odUL, odPC: t.odPC, byDate, byStore, time: hmNow() };
          const summary = `Due ${t.total} (UL ${t.UL} · PC ${t.PC}) · overdue ${t.od}`;
          eAppend([eMake(u, 'due', date, 'ALL', '', summary, data)]);
          if (date === today()) {
            clearDueList(false);
            const ins = db.prepare('INSERT INTO DueList (c1,c2,c3,c4,c5,c6) VALUES (?,?,?,?,?,?)');
            for (const row of list) {
              ins.run(row[0], row[1], row[2], row[3], row[4], row[5]);
            }
            queueDueListReplace(
              list.map((row) => ({
                due_date: row[0],
                barcode: row[1],
                store: row[2],
                garment: row[3],
                service: row[4],
                unit: row[5],
              }))
            );
          }
          logAction(u.name, 'due.upload', `${t.total} pcs`);
          queueFormspreeEvent({
            action: 'due.upload',
            activity: 'Workshop Out (Due List) Uploaded',
            unit: 'ALL',
            date,
            time: hmNow(),
            user: u.name,
            role: u.role,
            summary,
            details: { ...data, due_list_count: list.length },
          });
          return modGet(u, 'scan', unit, date);
        });
        return { ok: true, data: res };
      }

      case 'list.add': {
        const listPath = str(p.list);
        const val = str(p.value);
        if (!STAFF_LISTS.includes(listPath) && !isMgr(u)) throw new Error('No access');
        if (!val) throw new Error('Write a name');
        const res = withTransaction(() => {
          const s = getSettings() as unknown as Record<string, any>;
          const parts = listPath.split('.');
          let o = s;
          for (let i = 0; i < parts.length - 1; i++) {
            o = o[parts[i]] = o[parts[i]] || {};
          }
          const k = parts[parts.length - 1];
          o[k] = o[k] || [];
          if (!o[k].some((x: string) => String(x).toLowerCase() === val.toLowerCase())) {
            o[k].push(val);
            writeSettings(s as WorkshopSettings);
            logAction(u.name, 'list.add', `${listPath} ${val}`);
            queueFormspreeEvent({
              action: 'list.add',
              activity: 'Master List Item Added',
              unit: unitFor(u, p),
              date: today(),
              time: hmNow(),
              user: u.name,
              role: u.role,
              summary: `Added "${val}" to ${listPath}`,
              details: { list: listPath, value: val },
            });
          }
          return { settings: getSettings(), value: val };
        });
        return { ok: true, data: res };
      }

      case 'report': {
        need(u, 'reports');
        const from = validDate(p.from);
        const to = validDate(p.to);
        const k = str(p.kind);
        const unit = unitFor(u, p, true);
        if (to < from) throw new Error('Bad period');
        const out: Record<string, any> = { kind: k, from, to, unit };
        if (k === 'daily') {
          const units = unit === 'ALL' ? unitsFor(u) : [unit];
          out.days = units.map((un) => {
            const d = dailyRow(from, un);
            return {
              unit: un,
              data: d ? d.data : {},
              meta: d ? { submitted: d.submitted, by: d.by, filled: d.filled, total: d.total } : null,
              autos: autos(from, un),
            };
          });
          return { ok: true, data: out };
        }
        if (k === 'checklist') {
          out.rows = eRange(from, to, null, unit).map((e) => ({ mod: e.mod, date: e.date, unit: e.unit }));
          const dRows = db.prepare('SELECT c2,c3,c5,c6,c7 FROM Daily WHERE c2 >= ? AND c2 <= ? ORDER BY rid').all(from, to) as Record<string, any>[];
          out.daily = dRows
            .map((v) => ({ date: dkey(v.c2), unit: str(v.c3), filled: num(v.c5), total: num(v.c6), submitted: str(v.c7) }))
            .filter((r) => unit === 'ALL' || r.unit === unit);
          return { ok: true, data: out };
        }
        if (k === 'lots') {
          const us = unit === 'ALL' ? unitsFor(u) : [unit];
          out.rows = [];
          for (const un of us) {
            for (const r of ensureLots(un, today())) {
              const touched = r.log.some((l) => l.at.slice(0, 10) >= from && l.at.slice(0, 10) <= to);
              if ((r.date >= from && r.date <= to) || touched || (r.date < from && r.cleared < 100)) {
                out.rows.push(r);
              }
            }
          }
          return { ok: true, data: out };
        }
        if (k === 'scan') {
          out.rows = eRange(from, to, ['scan', 'due'], 'ALL').filter((e) => unit === 'ALL' || e.mod === 'due' || e.unit === unit);
          return { ok: true, data: out };
        }
        out.rows = eRange(from, to, k, unit);
        if (k === 'rewash') {
          const us = unit === 'ALL' ? unitsFor(u) : [unit];
          const open: Record<string, number> = {};
          for (const un of us) {
            const st = rewashState(un, addDays(from, -1));
            for (const x of Object.keys(st)) {
              open[x] = (open[x] || 0) + st[x].balance;
            }
          }
          out.opening = open;
        }
        if (k === 'repair' || k === 'saree' || k === 'wn') {
          const seen: Record<string, number> = {};
          for (const e of out.rows) seen[e.id] = 1;
          for (const e of openItems(k, unit)) {
            if (!seen[e.id] && e.date < from) out.rows.unshift(e);
          }
        }
        if (k === 'meter') {
          out.last = unit === 'ALL' ? {} : meterLast(unit, from);
        }
        return { ok: true, data: out };
      }

      case 'performance.overview': {
        need(u, 'performance');
        const allowedUnits = unitsFor(u);
        const rawUnit = str(p.unit).toUpperCase();
        const selectedUnit =
          !rawUnit || rawUnit === 'ALL'
            ? allowedUnits.length > 1
              ? 'ALL'
              : allowedUnits[0]
            : allowedUnits.includes(rawUnit)
            ? rawUnit
            : allowedUnits[0];
        const activeUnits = selectedUnit === 'ALL' ? allowedUnits : [selectedUnit];
        const anchor = validDate(p.anchor || today());
        const from = weekStart(anchor);
        const to = addDays(from, 6);
        const winFrom = addDays(from, -21);
        const allRows = eRange(winFrom, to, null, selectedUnit === 'ALL' ? 'ALL' : activeUnits[0]).filter((e) =>
          activeUnits.includes(e.unit)
        );

        const emptyBucket = (): UnitMetricsBucket => ({
          scan: 0,
          grc: 0,
          rp: 0,
          process: 0,
          saree: 0,
          rewash: 0,
          repair: 0,
          wn: 0,
          errors: 0,
          boilerMins: 0,
          output: 0,
        });

        const applyEntry = (b: UnitMetricsBucket, e: EntryRecord) => {
          switch (e.mod) {
            case 'scan': {
              const q = num(e.data.total);
              b.scan += q;
              b.output += q;
              break;
            }
            case 'grc': {
              const q = num(e.data.total);
              b.grc += q;
              b.output += q;
              break;
            }
            case 'rp':
              b.rp += 1;
              b.output += 1;
              break;
            case 'spot':
            case 'quickfix':
              b.process += 1;
              b.output += 1;
              break;
            case 'saree': {
              const q = num(e.data.qty);
              b.saree += q;
              b.output += q;
              break;
            }
            case 'rewash': {
              const q = num(e.data.qty);
              b.rewash += q;
              b.output += q;
              break;
            }
            case 'repair':
              b.repair += 1;
              b.output += 1;
              break;
            case 'wn':
              b.wn += 1;
              b.output += 1;
              break;
            case 'iron':
            case 'washerr':
              b.errors += num(e.data.points);
              break;
            case 'staffErr':
              b.errors += 1;
              break;
            case 'boiler':
              b.boilerMins += num(e.data.mins);
              break;
            default:
              break;
          }
        };

        const shortDay = (iso: string) => {
          const dt = new Date(`${iso}T00:00:00Z`);
          const dn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dt.getUTCDay()];
          return `${dn} ${iso.slice(8, 10)}`;
        };
        const shortWeek = (ws: string, we: string) => {
          const mons = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const d1 = new Date(`${ws}T00:00:00Z`);
          const d2 = new Date(`${we}T00:00:00Z`);
          return `${d1.getUTCDate()} ${mons[d1.getUTCMonth()]} – ${d2.getUTCDate()} ${mons[d2.getUTCMonth()]}`;
        };

        const dailySeries: PerformanceDayPoint[] = [];
        for (let i = 0; i < 7; i++) {
          const d = addDays(from, i);
          const byUnit: Record<string, UnitMetricsBucket> = {};
          for (const un of activeUnits) byUnit[un] = emptyBucket();
          for (const e of allRows) {
            if (e.date === d && byUnit[e.unit]) applyEntry(byUnit[e.unit], e);
          }
          const pt: PerformanceDayPoint = {
            date: d,
            label: shortDay(d),
            byUnit,
            totalOutput: 0,
            totalScan: 0,
            totalGrc: 0,
            totalErrors: 0,
          };
          for (const un of activeUnits) {
            const b = byUnit[un];
            pt[un] = b.output;
            pt[`${un}_scan`] = b.scan;
            pt[`${un}_grc`] = b.grc;
            pt[`${un}_finishing`] = b.rp + b.process + b.saree + b.rewash + b.repair + b.wn;
            pt[`${un}_errors`] = b.errors;
            pt[`${un}_boilerMins`] = b.boilerMins;
            pt.totalOutput += b.output;
            pt.totalScan += b.scan;
            pt.totalGrc += b.grc;
            pt.totalErrors += b.errors;
          }
          dailySeries.push(pt);
        }

        const weeklyTrends: PerformanceWeekPoint[] = [];
        for (let w = 3; w >= 0; w--) {
          const ws = addDays(from, -7 * w);
          const we = addDays(ws, 6);
          const byUnit: Record<string, UnitMetricsBucket> = {};
          for (const un of activeUnits) byUnit[un] = emptyBucket();
          for (const e of allRows) {
            if (e.date >= ws && e.date <= we && byUnit[e.unit]) applyEntry(byUnit[e.unit], e);
          }
          const wp: PerformanceWeekPoint = {
            weekStart: ws,
            weekEnd: we,
            label: w === 0 ? `Current (${shortWeek(ws, we)})` : shortWeek(ws, we),
            byUnit,
            totalOutput: 0,
            totalScan: 0,
            totalGrc: 0,
            totalErrors: 0,
            totalBoilerMins: 0,
          };
          for (const un of activeUnits) {
            const b = byUnit[un];
            wp[un] = b.output;
            wp[`${un}_scan`] = b.scan;
            wp[`${un}_grc`] = b.grc;
            wp[`${un}_finishing`] = b.rp + b.process + b.saree + b.rewash + b.repair + b.wn;
            wp[`${un}_errors`] = b.errors;
            wp[`${un}_boilerMins`] = b.boilerMins;
            wp.totalOutput += b.output;
            wp.totalScan += b.scan;
            wp.totalGrc += b.grc;
            wp.totalErrors += b.errors;
            wp.totalBoilerMins += b.boilerMins;
          }
          weeklyTrends.push(wp);
        }

        const curW = weeklyTrends[3];
        const prevW = weeklyTrends[2];
        const pctDelta = (cur: number, prev: number): number | null => {
          if (prev <= 0) return cur > 0 ? 100 : null;
          return Math.round(((cur - prev) / prev) * 100);
        };

        const curByUnitOutput: Record<string, number> = {};
        let finishingAndRewash = 0;
        for (const un of activeUnits) {
          const b = curW.byUnit[un];
          curByUnitOutput[un] = b.output;
          finishingAndRewash += b.rp + b.process + b.saree + b.rewash + b.repair + b.wn;
        }

        const modDefs: {
          id: string;
          name: string;
          category: PerformanceModuleRow['category'];
          unitLabel: string;
          extract: (e: EntryRecord) => number;
        }[] = [
          { id: 'scan', name: 'Scanned & Pending', category: 'Volume', unitLabel: 'pcs', extract: (e) => num(e.data.total) },
          { id: 'grc', name: 'GRC Count', category: 'Volume', unitLabel: 'pcs', extract: (e) => num(e.data.total) },
          { id: 'rp', name: 'Release & Pack', category: 'Process & Finishing', unitLabel: 'completions', extract: () => 1 },
          { id: 'saree', name: 'Saree Polish', category: 'Process & Finishing', unitLabel: 'pcs', extract: (e) => num(e.data.qty) },
          { id: 'rewash', name: 'Rewash', category: 'Process & Finishing', unitLabel: 'pcs', extract: (e) => num(e.data.qty) },
          { id: 'spot', name: 'Spot Treatment', category: 'Process & Finishing', unitLabel: 'garments', extract: () => 1 },
          { id: 'quickfix', name: 'Quick Fix', category: 'Process & Finishing', unitLabel: 'garments', extract: () => 1 },
          { id: 'repair', name: 'Repair', category: 'Process & Finishing', unitLabel: 'garments', extract: () => 1 },
          { id: 'wn', name: 'WN Garments', category: 'Process & Finishing', unitLabel: 'items', extract: () => 1 },
          { id: 'iron', name: 'Ironmen Error', category: 'Quality', unitLabel: 'pts', extract: (e) => num(e.data.points) },
          { id: 'washerr', name: 'Washing Error', category: 'Quality', unitLabel: 'pts', extract: (e) => num(e.data.points) },
          { id: 'staffErr', name: 'Staff Error', category: 'Quality', unitLabel: 'errors', extract: () => 1 },
          { id: 'boiler', name: 'Boiler', category: 'Utilities', unitLabel: 'mins', extract: (e) => num(e.data.mins) },
        ];

        const prevFrom = prevW.weekStart;
        const prevTo = prevW.weekEnd;
        const moduleBreakdown: PerformanceModuleRow[] = modDefs.map((md) => {
          const byUnit: Record<string, number> = {};
          for (const un of activeUnits) byUnit[un] = 0;
          let total = 0;
          let prevTotal = 0;
          for (const e of allRows) {
            if (e.mod !== md.id) continue;
            const v = md.extract(e);
            if (e.date >= from && e.date <= to) {
              total += v;
              byUnit[e.unit] = (byUnit[e.unit] || 0) + v;
            } else if (e.date >= prevFrom && e.date <= prevTo) {
              prevTotal += v;
            }
          }
          return {
            id: md.id,
            name: md.name,
            category: md.category,
            unitLabel: md.unitLabel,
            total: Math.round(total),
            prevTotal: Math.round(prevTotal),
            deltaPct: pctDelta(total, prevTotal),
            byUnit,
          };
        });

        const hasActivity = weeklyTrends.some(
          (w) => w.totalOutput > 0 || w.totalErrors > 0 || w.totalBoilerMins > 0
        );

        const payload: PerformanceOverviewData = {
          from,
          to,
          anchor,
          selectedUnit,
          units: allowedUnits,
          hasActivity,
          summary: {
            totalOutput: curW.totalOutput,
            outputDeltaPct: pctDelta(curW.totalOutput, prevW.totalOutput),
            totalScanned: curW.totalScan,
            scannedDeltaPct: pctDelta(curW.totalScan, prevW.totalScan),
            totalGrc: curW.totalGrc,
            grcDeltaPct: pctDelta(curW.totalGrc, prevW.totalGrc),
            finishingAndRewash,
            qualityPoints: curW.totalErrors,
            qualityDeltaPct: pctDelta(curW.totalErrors, prevW.totalErrors),
            boilerMins: curW.totalBoilerMins,
            byUnitOutput: curByUnitOutput,
          },
          dailySeries,
          weeklyTrends,
          moduleBreakdown,
        };
        return { ok: true, data: payload };
      }

      case 'settings.save': {
        need(u, 'settings');
        const s = p.settings as WorkshopSettings;
        if (!s || !s.stores || !s.teams || !s.units || !s.units.length) throw new Error('Bad settings');
        s.units = s.units.map((x) => str(x).toUpperCase()).filter(Boolean);
        s.stores = s.stores
          .filter((x) => str(x.code))
          .map((x) => ({
            code: str(x.code).toUpperCase(),
            aliases: (x.aliases || []).map((a) => str(a).toUpperCase()).filter(Boolean),
            pc: !!x.pc,
            email: str(x.email),
          }));
        s.boilers = (s.boilers || [])
          .filter((b) => str(b.name))
          .map((b) => ({
            name: str(b.name),
            unit: s.units.includes(b.unit) ? b.unit : s.units[0],
            staff: (b.staff || []).map(str).filter(Boolean),
          }));
        s.meters = (s.meters || [])
          .filter((m) => str(m.name))
          .map((m) => ({ name: str(m.name), measure: str(m.measure) }));
        withTransaction(() => writeSettings(s));
        logAction(u.name, 'settings.save', '');
        queueFormspreeEvent({
          action: 'settings.save',
          activity: 'Workshop Settings Updated',
          unit: unitFor(u, p),
          date: today(),
          time: hmNow(),
          user: u.name,
          role: u.role,
          summary: `Units: ${s.units.join(', ')} · Stores: ${s.stores.length}`,
          details: { units: s.units, store_count: s.stores.length, theme: s.theme },
        });
        return { ok: true, data: getSettings() };
      }

      case 'users.list': {
        if (u.role !== 'Admin') throw new Error('Admin only');
        return {
          ok: true,
          data: getAllUsers().map(({ name, role, modules, active, units }) => ({ name, role, modules, active, units })),
        };
      }

      case 'users.save': {
        if (u.role !== 'Admin') throw new Error('Admin only');
        const old: Record<string, InternalUser> = {};
        const seen: Record<string, number> = {};
        for (const x of getAllUsers()) old[x.name.toLowerCase()] = x;
        const rows = ((p.users as UserRecord[]) || [])
          .filter((x) => str(x.name))
          .map((x) => {
            const name = str(x.name);
            const key = name.toLowerCase();
            if (seen[key]) throw new Error(`Name used twice: ${name}`);
            seen[key] = 1;
            const prev = old[key];
            const pin = x.pin ? str(x.pin) : prev?.pin || '';
            if (!/^\d{4}$/.test(pin)) throw new Error(`PIN must be 4 digits for ${name}`);
            const role: Role = ['Admin', 'Manager', 'Staff'].includes(x.role) ? x.role : 'Staff';
            return [name, role, pin, (x.modules || []).join(','), x.active !== false ? 'TRUE' : 'FALSE', (x.units || []).join(',')];
          });
        if (!rows.some((r) => r[1] === 'Admin' && r[4] === 'TRUE')) {
          throw new Error('Keep at least one active Admin');
        }
        withTransaction(() => {
          db.exec('DELETE FROM Users');
          const ins = db.prepare('INSERT INTO Users (c1,c2,c3,c4,c5,c6) VALUES (?,?,?,?,?,?)');
          for (const r of rows) ins.run(r[0], r[1], r[2], r[3], r[4], r[5]);
          queueUsersReplace(
            rows.map((r) => ({
              username: String(r[0]),
              role: String(r[1]),
              pin: String(r[2]),
              modules: String(r[3]),
              active: String(r[4]).toUpperCase() !== 'FALSE',
              units: String(r[5]),
            }))
          );
        });
        logAction(u.name, 'users.save', `${rows.length} users`);
        queueFormspreeEvent({
          action: 'users.save',
          activity: 'Users & Access Updated',
          unit: 'ALL',
          date: today(),
          time: hmNow(),
          user: u.name,
          role: u.role,
          summary: `${rows.length} user accounts saved`,
          details: {
            users: rows.map((r) => ({ name: r[0], role: r[1], active: r[4], units: r[5] })),
          },
        });
        return {
          ok: true,
          data: getAllUsers().map(({ name, role, modules, active, units }) => ({ name, role, modules, active, units })),
        };
      }

      case 'backup.stats': {
        if (u.role !== 'Admin') throw new Error('Admin only');
        const count = (t: string) => (db.prepare(`SELECT COUNT(*) as n FROM "${t}"`).get() as { n: number }).n;
        let size = 0;
        try {
          size = fs.statSync(path.join(DATA_DIR, 'workshop.db')).size;
        } catch {
          // ignore
        }
        const stats: BackupStats = {
          entries: count('Entries'),
          daily: count('Daily'),
          lots: count('Lots'),
          log: count('Log'),
          users: count('Users'),
          cells: size,
          limit: 20 * 1024 * 1024 * 1024,
          db: true,
        };
        return { ok: true, data: stats };
      }

      case 'backup.export': {
        if (u.role !== 'Admin') throw new Error('Admin only');
        const t = today();
        const units = getSettings().units || ['UL'];
        const entries: (string | number)[][] = [];
        const raw = (e: EntryRecord) => [e.id, e.mod, e.date, e.unit, e.store, e.summary, JSON.stringify(e.data), e.by, e.stamp];
        for (const m of ['repair', 'saree', 'wn']) {
          for (const e of openItems(m, 'ALL')) entries.push(raw(e));
        }
        for (const un of units) {
          const st = rewashState(un, t);
          for (const k of Object.keys(st)) {
            for (const x of st[k].pending) {
              entries.push([
                uid(),
                'rewash',
                x.date,
                un,
                '',
                `${k} · Given · ${x.left} pcs · carried forward`,
                JSON.stringify({ kind: k, type: 'Given', qty: x.left, by: 'carried' }),
                u.name,
                `${x.date} 00:00:00`,
              ]);
            }
          }
          const ml = meterLast(un, addDays(t, 1));
          const rd: Record<string, number> = {};
          for (const m of Object.keys(ml)) rd[m] = ml[m].reading;
          if (Object.keys(rd).length) {
            const md = Object.keys(ml)
              .map((m) => ml[m].date)
              .sort()
              .pop()!;
            entries.push([uid(), 'meter', md, un, '', 'Last readings carried forward', JSON.stringify({ readings: rd, used: {} }), u.name, `${md} 00:00:00`]);
          }
        }
        const lots: (string | number)[][] = [];
        for (const un of units) {
          for (const r of ensureLots(un, t)) {
            if (r.cleared < 100) lots.push([r.key, r.date, r.unit, r.type, r.cleared, JSON.stringify(r.log), r.by, r.at]);
          }
        }
        const users = getAllUsers().map((x) => [x.name, x.role, x.pin, x.modules.join(','), x.active, x.units.join(',')]);
        const data = {
          app: 'Workshop Operational Control',
          version: BACKUP_VERSION,
          exportedAt: nowStr(),
          exportedBy: u.name,
          settings: getSettings(),
          users,
          entries,
          lots,
          counts: { entries: entries.length, lots: lots.length, users: users.length },
        };
        logAction(u.name, 'backup.export', `${entries.length} entries, ${lots.length} lots`);
        return { ok: true, data: { data, url: '' } };
      }

      case 'backup.exportAll': {
        if (u.role !== 'Admin') throw new Error('Admin only');
        const entries = (db.prepare('SELECT c1,c2,c3,c4,c5,c6,c7,c8,c9 FROM Entries ORDER BY rid').all() as Record<string, any>[]).map((r) => [
          r.c1,
          r.c2,
          r.c3,
          r.c4,
          r.c5,
          r.c6,
          r.c7,
          r.c8,
          r.c9,
        ]);
        const daily = (db.prepare('SELECT c1,c2,c3,c4,c5,c6,c7,c8,c9 FROM Daily ORDER BY rid').all() as Record<string, any>[]).map((r) => [
          r.c1,
          r.c2,
          r.c3,
          r.c4,
          r.c5,
          r.c6,
          r.c7,
          r.c8,
          r.c9,
        ]);
        const lots = (db.prepare('SELECT c1,c2,c3,c4,c5,c6,c7,c8 FROM Lots ORDER BY rid').all() as Record<string, any>[]).map((r) => [
          r.c1,
          r.c2,
          r.c3,
          r.c4,
          r.c5,
          r.c6,
          r.c7,
          r.c8,
        ]);
        const users = getAllUsers().map((x) => [x.name, x.role, x.pin, x.modules.join(','), x.active, x.units.join(',')]);
        const data = {
          app: 'Workshop Operational Control',
          version: BACKUP_VERSION,
          full: true,
          exportedAt: nowStr(),
          exportedBy: u.name,
          settings: getSettings(),
          users,
          entries,
          lots,
          daily,
          counts: { entries: entries.length, lots: lots.length, users: users.length, daily: daily.length },
        };
        logAction(u.name, 'backup.exportAll', `${entries.length} entries`);
        return { ok: true, data: { data, url: '' } };
      }

      case 'backup.import': {
        if (u.role !== 'Admin') throw new Error('Admin only');
        const d = p.data as Record<string, any>;
        if (!d || d.app !== 'Workshop Operational Control' || !d.settings || !Array.isArray(d.users)) {
          throw new Error('This is not a Workshop backup file');
        }
        if (num(d.version) > BACKUP_VERSION) throw new Error('Backup is from a newer version of the app');
        const res = withTransaction(() => {
          writeSettings(d.settings);
          const users = (d.users as any[][])
            .filter((r) => str(r[0]))
            .map((r) => [
              str(r[0]),
              str(r[1]) || 'Staff',
              str(r[2]).replace(/^'/, ''),
              str(r[3]),
              !(r[4] === false || String(r[4]).toUpperCase() === 'FALSE') ? 'TRUE' : 'FALSE',
              str(r[5]),
            ]);
          if (!users.some((r) => r[1] === 'Admin' && r[4] === 'TRUE')) {
            throw new Error('Backup has no active Admin');
          }
          db.exec('DELETE FROM Users');
          const insU = db.prepare('INSERT INTO Users (c1,c2,c3,c4,c5,c6) VALUES (?,?,?,?,?,?)');
          for (const r of users) insU.run(r[0], r[1], r[2], r[3], r[4], r[5]);
          queueUsersReplace(
            users.map((r) => ({
              username: String(r[0]),
              role: String(r[1]),
              pin: String(r[2]),
              modules: String(r[3]),
              active: String(r[4]).toUpperCase() !== 'FALSE',
              units: String(r[5]),
            }))
          );

          const haveE = new Set<string>(
            (db.prepare('SELECT c1 FROM Entries').all() as { c1: string }[]).map((x) => str(x.c1))
          );
          const eRows = ((d.entries as any[][]) || [])
            .filter((r) => r && r[0] && !haveE.has(str(r[0])))
            .map((r) => [str(r[0]), str(r[1]), str(r[2]).replace(/^'/, ''), str(r[3]), str(r[4]), str(r[5]), str(r[6]), str(r[7]), str(r[8]).replace(/^'/, '')])
            .sort((x, y) => (x[2] < y[2] ? -1 : x[2] > y[2] ? 1 : 0));
          eAppend(eRows);

          const haveL = new Set<string>(
            (db.prepare('SELECT c1 FROM Lots').all() as { c1: string }[]).map((x) => str(x.c1))
          );
          const lRows = ((d.lots as any[][]) || []).filter((r) => r && r[0] && !haveL.has(str(r[0])));
          const insL = db.prepare('INSERT INTO Lots (c1,c2,c3,c4,c5,c6,c7,c8) VALUES (?,?,?,?,?,?,?,?)');
          for (const r of lRows) {
            const c1 = str(r[0]);
            const c2 = str(r[1]);
            const c3 = str(r[2]);
            const c4 = str(r[3]);
            const c5 = num(r[4]);
            const c6 = str(r[5]) || '[]';
            const c7 = str(r[6]);
            const c8 = str(r[7]);
            insL.run(c1, c2, c3, c4, c5, c6, c7, c8);
            queueLotUpsert({
              lot_key: c1,
              lot_date: c2,
              unit: c3,
              lot_type: c4,
              cleared: c5,
              log: jparse(c6, []),
              updated_by: c7,
              updated_at_text: c8,
            });
          }

          let dn = 0;
          if (Array.isArray(d.daily) && d.daily.length) {
            const haveD = new Set<string>(
              (db.prepare('SELECT c1 FROM Daily').all() as { c1: string }[]).map((x) => str(x.c1))
            );
            const dRows = (d.daily as any[][]).filter((r) => r && r[0] && !haveD.has(str(r[0])));
            const insD = db.prepare('INSERT INTO Daily (c1,c2,c3,c4,c5,c6,c7,c8,c9) VALUES (?,?,?,?,?,?,?,?,?)');
            for (const r of dRows) {
              const c1 = str(r[0]);
              const c2 = str(r[1]);
              const c3 = str(r[2]);
              const c4 = str(r[3]);
              const c5 = num(r[4]);
              const c6 = num(r[5]);
              const c7 = str(r[6]);
              const c8 = str(r[7]);
              const c9 = str(r[8]);
              insD.run(c1, c2, c3, c4, c5, c6, c7, c8, c9);
              queueDailyUpsert({
                report_key: c1,
                report_date: c2,
                unit: c3,
                data: jparse(c4, {}),
                filled: c5,
                total: c6,
                submitted: c7,
                updated_by: c8,
                updated_at_text: c9,
              });
            }
            dn = dRows.length;
          }
          logAction(u.name, 'backup.import', `${eRows.length} entries, ${lRows.length} lots, ${users.length} users from ${d.exportedAt}`);
          queueFormspreeEvent({
            action: 'backup.import',
            activity: 'Backup Imported',
            unit: 'ALL',
            date: today(),
            time: hmNow(),
            user: u.name,
            role: u.role,
            summary: `Imported ${eRows.length} entries, ${lRows.length} lots, ${dn} daily reports`,
            details: { exportedAt: d.exportedAt, entries: eRows.length, lots: lRows.length, users: users.length, daily: dn },
          });
          return { entries: eRows.length, lots: lRows.length, users: users.length, daily: dn, settings: getSettings() };
        });
        return { ok: true, data: res };
      }

      default:
        throw new Error('Unknown action');
    }
  } catch (e: any) {
    pendingFormspree = [];
    return { ok: false, error: String((e && e.message) || e) };
  }
}

export async function initEngine() {
  ensureSchema();
  clearSyncQueue();
  pendingFormspree = [];
  return initSupabaseSync(db);
}

export async function handleApiWithSync(reqBody: { action?: string; token?: string; p?: Record<string, any> }) {
  if (reqBody?.action === 'backup.syncSupabase') {
    try {
      ensureSchema();
      const u = checkToken(reqBody.token);
      if (u.role !== 'Admin') throw new Error('Admin only');
      const status = await forceFullSupabaseSync();
      return { ok: true, data: status };
    } catch (e: any) {
      return { ok: false, error: String((e && e.message) || e) };
    }
  }
  pendingFormspree = [];
  const result = handleApi(reqBody);
  const toSend = pendingFormspree.splice(0, pendingFormspree.length);
  if (result.ok) {
    for (const ev of toSend) {
      enqueueFormspree(ev);
    }
  }
  await flushSupabaseQueue();
  return result;
}

export async function triggerSupabaseResync() {
  return forceFullSupabaseSync();
}

export function getPhotoPath(id: string): string | null {
  if (!/^P[a-f0-9]{18}$/.test(id)) return null;
  const p = path.join(PHOTOS_DIR, `${id}.jpg`);
  return fs.existsSync(p) ? p : null;
}

export async function resolvePhotoPath(id: string): Promise<string | null> {
  const local = getPhotoPath(id);
  if (local) return local;
  if (!/^P[a-f0-9]{18}$/.test(id)) return null;
  const remoteBuf = await fetchPhotoFromSupabase(id);
  if (!remoteBuf) return null;
  const p = path.join(PHOTOS_DIR, `${id}.jpg`);
  fs.writeFileSync(p, remoteBuf);
  return p;
}

export function getHealthInfo() {
  return {
    ok: true,
    time: nowStr(),
    supabase: getSupabaseStatus(),
    formspree: getFormspreeStatus(),
  };
}
