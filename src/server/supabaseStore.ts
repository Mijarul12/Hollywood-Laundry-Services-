import type { DatabaseSync } from 'node:sqlite';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { EntryRecord, WorkshopSettings } from '../types/workshop.ts';

const DEFAULT_SUPABASE_URL = 'https://ethmnjvcvndhuuhlwvcs.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_AmYfOqgndEykRs7az227VQ_HdYyiPgk';
const PROJECT_ID = 'ethmnjvcvndhuuhlwvcs';
const PROJECT_NAME = 'Hollywood Laundry Services';

const REQUIRED_TABLES = [
  'workshop_users',
  'workshop_settings',
  'daily_reports',
  'workshop_entries',
  'workshop_lots',
  'due_list',
  'workshop_logs',
  'workshop_kv',
  'workshop_photos',
] as const;

function normalizeSupabaseUrl(raw?: string): string {
  const s = String(raw || DEFAULT_SUPABASE_URL).trim();
  return s.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
}

const SUPABASE_URL = normalizeSupabaseUrl(process.env.SUPABASE_URL);
const SUPABASE_KEY = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_KEY
).trim();

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export interface SupabaseSyncStatus {
  configured: boolean;
  projectName: string;
  projectId: string;
  projectUrl: string;
  schemaReady: boolean;
  missingTables: string[];
  lastSyncAt: string | null;
  lastError: string | null;
  pendingOps: number;
}

type SyncOp =
  | { kind: 'entry.upsert'; row: EntryRecord }
  | { kind: 'entry.delete'; id: string }
  | { kind: 'daily.upsert'; row: DailySyncRow }
  | { kind: 'lot.upsert'; row: LotSyncRow }
  | { kind: 'users.replace'; rows: UserSyncRow[] }
  | { kind: 'settings.upsert'; settings: WorkshopSettings }
  | { kind: 'duelist.replace'; rows: DueListSyncRow[] }
  | { kind: 'log.insert'; row: LogSyncRow }
  | { kind: 'kv.upsert'; k: string; v: string }
  | { kind: 'photo.upsert'; id: string; base64: string };

export interface DailySyncRow {
  report_key: string;
  report_date: string;
  unit: string;
  data: Record<string, any>;
  filled: number;
  total: number;
  submitted: string;
  updated_by: string;
  updated_at_text: string;
}

export interface LotSyncRow {
  lot_key: string;
  lot_date: string;
  unit: string;
  lot_type: string;
  cleared: number;
  log: { at: string; by: string; pct: number }[];
  updated_by: string;
  updated_at_text: string;
}

export interface UserSyncRow {
  username: string;
  role: string;
  pin: string;
  modules: string;
  active: boolean;
  units: string;
}

export interface DueListSyncRow {
  due_date: string;
  barcode: string;
  store: string;
  garment: string;
  service: string;
  unit: string;
}

export interface LogSyncRow {
  logged_at: string;
  username: string;
  action: string;
  detail: string;
}

let queue: SyncOp[] = [];
let dbRef: DatabaseSync | null = null;
let schemaReady = false;
let missingTables: string[] = [...REQUIRED_TABLES];
let lastSyncAt: string | null = null;
let lastError: string | null = null;
let lastProbeMs = 0;

function toNumOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapEntryRow(e: EntryRecord) {
  const d = (e.data && typeof e.data === 'object' ? e.data : {}) as Record<string, any>;
  const workerName =
    String(
      d.karigar ||
        d.by ||
        d.staff ||
        (Array.isArray(d.names) ? d.names.join(', ') : '') ||
        d.to ||
        d.sentTo ||
        ''
    ).trim();
  const statusVal = String(d.status || d.type || d.kind || '').trim();
  const qtyVal = toNumOrNull(d.qty ?? d.total ?? d.recvQty);
  const pointsVal = toNumOrNull(d.points ?? d.pct ?? d.mins);
  const remarksVal = String(
    d.note || d.reason || d.adjNote || d.damage || d.spot || d.repair || ''
  ).trim();

  return {
    id: String(e.id),
    mod: String(e.mod),
    entry_date: String(e.date),
    unit: String(e.unit),
    store: String(e.store || ''),
    summary: String(e.summary || ''),
    garment: String(d.garment || ''),
    tag: String(d.tag || ''),
    invoice_no: String(d.inv || ''),
    worker_name: workerName,
    status: statusVal,
    qty: qtyVal,
    points: pointsVal,
    remarks: remarksVal,
    data: d,
    created_by: String(e.by || ''),
    entry_time: String(e.at || ''),
    stamp: String(e.stamp || ''),
  };
}

function isMissingTableError(err: any, status?: number): boolean {
  const msg = String(err?.message || '');
  const code = String(err?.code || '');
  return (
    status === 404 ||
    code === 'PGRST205' ||
    code === '42P01' ||
    /Could not find the table/i.test(msg) ||
    /does not exist/i.test(msg)
  );
}

async function probeSchema(): Promise<{ ready: boolean; missing: string[]; error: string | null }> {
  lastProbeMs = Date.now();
  const missing: string[] = [];
  let fatalError: string | null = null;

  const checks = await Promise.all(
    REQUIRED_TABLES.map(async (tbl) => {
      const { error, status } = await supabase.from(tbl).select('*').limit(1);
      return { tbl, error, status };
    })
  );

  for (const { tbl, error, status } of checks) {
    if (!error && status < 400) continue;
    if (isMissingTableError(error, status)) {
      missing.push(tbl);
    } else if (!fatalError) {
      fatalError = `${tbl}: ${error?.message || `HTTP ${status}`}`;
    }
  }

  missingTables = missing;
  schemaReady = missing.length === 0 && !fatalError;
  if (fatalError) {
    lastError = fatalError;
  } else if (missing.length > 0) {
    lastError = `Missing tables in Supabase (${missing.length}/${REQUIRED_TABLES.length}). Run supabase/schema.sql in Supabase SQL Editor.`;
  } else {
    lastError = null;
  }

  return { ready: schemaReady, missing, error: lastError };
}

async function fetchAllRows<T = Record<string, any>>(table: string, orderCol?: string): Promise<T[]> {
  const out: T[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    let q = supabase.from(table).select('*').range(from, from + pageSize - 1);
    if (orderCol) q = q.order(orderCol, { ascending: true });
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    const batch = (data || []) as T[];
    out.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return out;
}

async function upsertInChunks(table: string, rows: Record<string, any>[], onConflict: string): Promise<void> {
  if (!rows.length) return;
  const chunkSize = 250;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

export async function pushAllLocalToSupabase(db: DatabaseSync): Promise<{ pushed: Record<string, number> }> {
  const pushed = {
    users: 0,
    settings: 0,
    daily: 0,
    entries: 0,
    lots: 0,
    dueList: 0,
    logs: 0,
    kv: 0,
  };

  // Users
  const uRows = (db.prepare('SELECT c1,c2,c3,c4,c5,c6 FROM Users ORDER BY rid').all() as Record<string, any>[]).map((r) => ({
    username: String(r.c1 || ''),
    role: String(r.c2 || 'Staff'),
    pin: String(r.c3 || '1111'),
    modules: String(r.c4 || ''),
    active: String(r.c5 || 'TRUE').toUpperCase() !== 'FALSE',
    units: String(r.c6 || 'UL'),
  })).filter((r) => r.username);
  await upsertInChunks('workshop_users', uRows, 'username');
  pushed.users = uRows.length;

  // Settings
  const sRow = db.prepare('SELECT c2 FROM Settings WHERE c1 = ?').get('app') as { c2: string } | undefined;
  if (sRow?.c2) {
    let parsed: Record<string, any> = {};
    try {
      parsed = JSON.parse(sRow.c2);
    } catch {
      parsed = {};
    }
    await upsertInChunks('workshop_settings', [{ key: 'app', settings: parsed }], 'key');
    pushed.settings = 1;
  }

  // Daily
  const dRows = (db.prepare('SELECT c1,c2,c3,c4,c5,c6,c7,c8,c9 FROM Daily ORDER BY rid').all() as Record<string, any>[]).map((r) => {
    let dataObj: Record<string, any> = {};
    try {
      dataObj = JSON.parse(String(r.c4 || '{}'));
    } catch {
      dataObj = {};
    }
    return {
      report_key: String(r.c1 || ''),
      report_date: String(r.c2 || ''),
      unit: String(r.c3 || ''),
      data: dataObj,
      filled: Number(r.c5 || 0),
      total: Number(r.c6 || 0),
      submitted: String(r.c7 || ''),
      updated_by: String(r.c8 || ''),
      updated_at_text: String(r.c9 || ''),
    };
  }).filter((r) => r.report_key);
  await upsertInChunks('daily_reports', dRows, 'report_key');
  pushed.daily = dRows.length;

  // Entries
  const eRows = (db.prepare('SELECT c1,c2,c3,c4,c5,c6,c7,c8,c9 FROM Entries ORDER BY rid').all() as Record<string, any>[]).map((r) => {
    let dataObj: Record<string, any> = {};
    try {
      dataObj = JSON.parse(String(r.c7 || '{}'));
    } catch {
      dataObj = {};
    }
    const stamp = String(r.c9 || '');
    const m = stamp.match(/(\d{1,2}):(\d{2})/);
    const at = m ? ('0' + m[1]).slice(-2) + ':' + m[2] : '';
    const rec: EntryRecord = {
      id: String(r.c1 || ''),
      mod: String(r.c2 || ''),
      date: String(r.c3 || ''),
      unit: String(r.c4 || ''),
      store: String(r.c5 || ''),
      summary: String(r.c6 || ''),
      data: dataObj,
      by: String(r.c8 || ''),
      at,
      stamp,
    };
    return mapEntryRow(rec);
  }).filter((r) => r.id);
  await upsertInChunks('workshop_entries', eRows, 'id');
  pushed.entries = eRows.length;

  // Lots
  const lRows = (db.prepare('SELECT c1,c2,c3,c4,c5,c6,c7,c8 FROM Lots ORDER BY rid').all() as Record<string, any>[]).map((r) => {
    let logArr: any[] = [];
    try {
      logArr = JSON.parse(String(r.c6 || '[]'));
    } catch {
      logArr = [];
    }
    return {
      lot_key: String(r.c1 || ''),
      lot_date: String(r.c2 || ''),
      unit: String(r.c3 || ''),
      lot_type: String(r.c4 || ''),
      cleared: Number(r.c5 || 0),
      log: logArr,
      updated_by: String(r.c7 || ''),
      updated_at_text: String(r.c8 || ''),
    };
  }).filter((r) => r.lot_key);
  await upsertInChunks('workshop_lots', lRows, 'lot_key');
  pushed.lots = lRows.length;

  // DueList (replace if local has rows)
  const dlRows = (db.prepare('SELECT c1,c2,c3,c4,c5,c6 FROM DueList ORDER BY rid').all() as Record<string, any>[])
    .filter((r) => String(r.c2 || '').trim())
    .map((r) => ({
      due_date: String(r.c1 || ''),
      barcode: String(r.c2 || ''),
      store: String(r.c3 || ''),
      garment: String(r.c4 || ''),
      service: String(r.c5 || ''),
      unit: String(r.c6 || ''),
    }));
  if (dlRows.length) {
    await supabase.from('due_list').delete().gte('id', 0);
    for (let i = 0; i < dlRows.length; i += 250) {
      const { error } = await supabase.from('due_list').insert(dlRows.slice(i, i + 250));
      if (error) throw new Error(`due_list: ${error.message}`);
    }
    pushed.dueList = dlRows.length;
  }

  // kv
  const kvRows = (db.prepare('SELECT k, v FROM kv').all() as { k: string; v: string }[]).map((r) => ({
    k: String(r.k),
    v: String(r.v || ''),
  }));
  await upsertInChunks('workshop_kv', kvRows, 'k');
  pushed.kv = kvRows.length;

  // Logs (only if remote workshop_logs is empty, avoid duplicating existing logs on re-sync)
  const { count: remoteLogCount } = await supabase
    .from('workshop_logs')
    .select('*', { head: true, count: 'exact' });
  if (!remoteLogCount) {
    const logRows = (db.prepare('SELECT c1,c2,c3,c4 FROM Log ORDER BY rid').all() as Record<string, any>[]).map((r) => ({
      logged_at: String(r.c1 || ''),
      username: String(r.c2 || ''),
      action: String(r.c3 || ''),
      detail: String(r.c4 || ''),
    }));
    for (let i = 0; i < logRows.length; i += 250) {
      const { error } = await supabase.from('workshop_logs').insert(logRows.slice(i, i + 250));
      if (error) throw new Error(`workshop_logs: ${error.message}`);
    }
    pushed.logs = logRows.length;
  }

  lastSyncAt = new Date().toISOString();
  lastError = null;
  return { pushed };
}

async function hydrateLocalFromSupabase(db: DatabaseSync): Promise<void> {
  // 1. KV
  const remoteKv = await fetchAllRows<{ k: string; v: string }>('workshop_kv');
  if (remoteKv.length) {
    const insKv = db.prepare('INSERT INTO kv(k, v) VALUES(?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v');
    for (const r of remoteKv) {
      if (r.k) insKv.run(String(r.k), String(r.v ?? ''));
    }
  }

  // 2. Users
  const remoteUsers = await fetchAllRows<UserSyncRow>('workshop_users', 'username');
  if (remoteUsers.length && remoteUsers.some((u) => u.role === 'Admin' && u.active !== false)) {
    db.exec('BEGIN');
    try {
      db.exec('DELETE FROM Users');
      const insU = db.prepare('INSERT INTO Users (c1,c2,c3,c4,c5,c6) VALUES (?,?,?,?,?,?)');
      for (const r of remoteUsers) {
        if (!r.username) continue;
        insU.run(
          String(r.username),
          String(r.role || 'Staff'),
          String(r.pin || '1111'),
          String(r.modules || ''),
          r.active === false ? 'FALSE' : 'TRUE',
          String(r.units || 'UL')
        );
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }

  // 3. Settings
  const remoteSettings = await fetchAllRows<{ key: string; settings: Record<string, any> }>('workshop_settings');
  const appSettings = remoteSettings.find((s) => s.key === 'app');
  if (appSettings?.settings) {
    db.prepare('INSERT INTO Settings (c1, c2) VALUES (?, ?) ON CONFLICT(c1) DO UPDATE SET c2 = excluded.c2').run(
      'app',
      JSON.stringify(appSettings.settings)
    );
  }

  // 4. Daily
  const remoteDaily = await fetchAllRows<{
    report_key: string;
    report_date: string;
    unit: string;
    data: Record<string, any>;
    filled: number;
    total: number;
    submitted: string;
    updated_by: string;
    updated_at_text: string;
  }>('daily_reports', 'report_date');
  if (remoteDaily.length) {
    const insD = db.prepare(
      'INSERT INTO Daily (c1,c2,c3,c4,c5,c6,c7,c8,c9) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(c1) DO UPDATE SET c4=excluded.c4,c5=excluded.c5,c6=excluded.c6,c7=excluded.c7,c8=excluded.c8,c9=excluded.c9 WHERE excluded.c9 >= Daily.c9'
    );
    for (const r of remoteDaily) {
      if (!r.report_key) continue;
      insD.run(
        String(r.report_key),
        String(r.report_date),
        String(r.unit),
        JSON.stringify(r.data || {}),
        Number(r.filled || 0),
        Number(r.total || 0),
        String(r.submitted || ''),
        String(r.updated_by || ''),
        String(r.updated_at_text || '')
      );
    }
  }

  // 5. Entries
  const remoteEntries = await fetchAllRows<Record<string, any>>('workshop_entries', 'entry_date');
  if (remoteEntries.length) {
    const insE = db.prepare(
      'INSERT INTO Entries (c1,c2,c3,c4,c5,c6,c7,c8,c9) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(c1) DO UPDATE SET c5=excluded.c5,c6=excluded.c6,c7=excluded.c7'
    );
    for (const r of remoteEntries) {
      if (!r.id) continue;
      insE.run(
        String(r.id),
        String(r.mod || ''),
        String(r.entry_date || ''),
        String(r.unit || ''),
        String(r.store || ''),
        String(r.summary || ''),
        JSON.stringify(r.data || {}),
        String(r.created_by || ''),
        String(r.stamp || '')
      );
    }
  }

  // 6. Lots
  const remoteLots = await fetchAllRows<{
    lot_key: string;
    lot_date: string;
    unit: string;
    lot_type: string;
    cleared: number;
    log: any[];
    updated_by: string;
    updated_at_text: string;
  }>('workshop_lots', 'lot_date');
  if (remoteLots.length) {
    const insL = db.prepare(
      'INSERT INTO Lots (c1,c2,c3,c4,c5,c6,c7,c8) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(c1) DO UPDATE SET c5=excluded.c5,c6=excluded.c6,c7=excluded.c7,c8=excluded.c8 WHERE excluded.c8 >= Lots.c8'
    );
    for (const r of remoteLots) {
      if (!r.lot_key) continue;
      insL.run(
        String(r.lot_key),
        String(r.lot_date || ''),
        String(r.unit || ''),
        String(r.lot_type || ''),
        Number(r.cleared || 0),
        JSON.stringify(r.log || []),
        String(r.updated_by || ''),
        String(r.updated_at_text || '')
      );
    }
  }

  // 7. DueList
  const remoteDue = await fetchAllRows<DueListSyncRow>('due_list', 'id');
  const localDueCount = (db.prepare('SELECT COUNT(*) as n FROM DueList').get() as { n: number }).n;
  if (remoteDue.length && localDueCount === 0) {
    const insDL = db.prepare('INSERT INTO DueList (c1,c2,c3,c4,c5,c6) VALUES (?,?,?,?,?,?)');
    for (const r of remoteDue) {
      if (!r.barcode) continue;
      insDL.run(
        String(r.due_date || ''),
        String(r.barcode),
        String(r.store || ''),
        String(r.garment || ''),
        String(r.service || ''),
        String(r.unit || '')
      );
    }
  }
}

export async function initSupabaseSync(db: DatabaseSync): Promise<SupabaseSyncStatus> {
  dbRef = db;
  try {
    const probe = await probeSchema();
    if (!probe.ready) {
      console.warn(
        `[Supabase] Connected to ${PROJECT_NAME} (${PROJECT_ID}), waiting for schema creation. Missing tables: ${probe.missing.join(', ')}. Run supabase/schema.sql in Supabase SQL Editor.`
      );
      return getSupabaseStatus();
    }

    await hydrateLocalFromSupabase(db);
    await pushAllLocalToSupabase(db);
    console.log(`[Supabase] Connected & synced with ${PROJECT_NAME} (${PROJECT_ID})`);
  } catch (err: any) {
    if (isMissingTableError(err)) schemaReady = false;
    lastError = String(err?.message || err);
    console.warn(`[Supabase] Initial sync warning: ${lastError}`);
  }
  return getSupabaseStatus();
}

export function clearSyncQueue(): void {
  queue = [];
}

export function queueEntryUpsert(row: EntryRecord): void {
  queue.push({ kind: 'entry.upsert', row });
}

export function queueEntryDelete(id: string): void {
  queue.push({ kind: 'entry.delete', id });
}

export function queueDailyUpsert(row: DailySyncRow): void {
  queue.push({ kind: 'daily.upsert', row });
}

export function queueLotUpsert(row: LotSyncRow): void {
  queue.push({ kind: 'lot.upsert', row });
}

export function queueUsersReplace(rows: UserSyncRow[]): void {
  queue.push({ kind: 'users.replace', rows });
}

export function queueSettingsUpsert(settings: WorkshopSettings): void {
  queue.push({ kind: 'settings.upsert', settings });
}

export function queueDueListReplace(rows: DueListSyncRow[]): void {
  queue.push({ kind: 'duelist.replace', rows });
}

export function queueLogInsert(logged_at: string, username: string, action: string, detail: string): void {
  queue.push({ kind: 'log.insert', row: { logged_at, username, action, detail } });
}

export function queueKvUpsert(k: string, v: string): void {
  queue.push({ kind: 'kv.upsert', k, v });
}

export function queuePhotoUpsert(id: string, base64: string): void {
  queue.push({ kind: 'photo.upsert', id, base64 });
}

let flushLock: Promise<void> = Promise.resolve();

export async function flushSupabaseQueue(): Promise<void> {
  const run = async () => {
    if (!queue.length) {
      if (!schemaReady && dbRef && Date.now() - lastProbeMs > 30_000) {
        const probe = await probeSchema();
        if (probe.ready) {
          await pushAllLocalToSupabase(dbRef);
        }
      }
      return;
    }

    const batch = queue.splice(0, queue.length);

    if (!schemaReady) {
      if (Date.now() - lastProbeMs > 15_000) {
        const probe = await probeSchema();
        if (probe.ready && dbRef) {
          await pushAllLocalToSupabase(dbRef);
        }
      }
      if (!schemaReady) return;
    }

    try {
      for (const op of batch) {
        switch (op.kind) {
          case 'entry.upsert': {
            const { error } = await supabase
              .from('workshop_entries')
              .upsert(mapEntryRow(op.row), { onConflict: 'id' });
            if (error) throw new Error(`workshop_entries: ${error.message}`);
            break;
          }
          case 'entry.delete': {
            const { error } = await supabase.from('workshop_entries').delete().eq('id', op.id);
            if (error) throw new Error(`workshop_entries delete: ${error.message}`);
            break;
          }
          case 'daily.upsert': {
            const { error } = await supabase
              .from('daily_reports')
              .upsert(op.row, { onConflict: 'report_key' });
            if (error) throw new Error(`daily_reports: ${error.message}`);
            break;
          }
          case 'lot.upsert': {
            const { error } = await supabase
              .from('workshop_lots')
              .upsert(op.row, { onConflict: 'lot_key' });
            if (error) throw new Error(`workshop_lots: ${error.message}`);
            break;
          }
          case 'users.replace': {
            const names = op.rows.map((r) => r.username).filter(Boolean);
            await upsertInChunks('workshop_users', op.rows, 'username');
            if (names.length) {
              const { data: existing } = await supabase.from('workshop_users').select('username');
              const toDelete = (existing || [])
                .map((r: any) => String(r.username))
                .filter((u) => !names.includes(u));
              if (toDelete.length) {
                await supabase.from('workshop_users').delete().in('username', toDelete);
              }
            }
            break;
          }
          case 'settings.upsert': {
            const { error } = await supabase
              .from('workshop_settings')
              .upsert({ key: 'app', settings: op.settings }, { onConflict: 'key' });
            if (error) throw new Error(`workshop_settings: ${error.message}`);
            break;
          }
          case 'duelist.replace': {
            const { error: delErr } = await supabase.from('due_list').delete().gte('id', 0);
            if (delErr) throw new Error(`due_list delete: ${delErr.message}`);
            for (let i = 0; i < op.rows.length; i += 250) {
              const { error } = await supabase.from('due_list').insert(op.rows.slice(i, i + 250));
              if (error) throw new Error(`due_list insert: ${error.message}`);
            }
            break;
          }
          case 'log.insert': {
            const { error } = await supabase.from('workshop_logs').insert(op.row);
            if (error) throw new Error(`workshop_logs: ${error.message}`);
            break;
          }
          case 'kv.upsert': {
            const { error } = await supabase
              .from('workshop_kv')
              .upsert({ k: op.k, v: op.v }, { onConflict: 'k' });
            if (error) throw new Error(`workshop_kv: ${error.message}`);
            break;
          }
          case 'photo.upsert': {
            const { error } = await supabase
              .from('workshop_photos')
              .upsert({ id: op.id, mime_type: 'image/jpeg', data_base64: op.base64 }, { onConflict: 'id' });
            if (error) throw new Error(`workshop_photos: ${error.message}`);
            break;
          }
        }
      }
      lastSyncAt = new Date().toISOString();
      lastError = null;
    } catch (err: any) {
      lastError = String(err?.message || err);
      if (isMissingTableError(err)) {
        schemaReady = false;
      }
      console.warn(`[Supabase] Sync warning: ${lastError}`);
    }
  };

  flushLock = flushLock.then(run, run);
  return flushLock;
}

export async function forceFullSupabaseSync(): Promise<SupabaseSyncStatus> {
  const probe = await probeSchema();
  if (probe.ready && dbRef) {
    await pushAllLocalToSupabase(dbRef);
  }
  return getSupabaseStatus();
}

export async function fetchPhotoFromSupabase(id: string): Promise<Buffer | null> {
  if (!schemaReady) return null;
  try {
    const { data, error } = await supabase
      .from('workshop_photos')
      .select('data_base64')
      .eq('id', id)
      .maybeSingle();
    if (error || !data?.data_base64) return null;
    return Buffer.from(String(data.data_base64), 'base64');
  } catch {
    return null;
  }
}

export function getSupabaseStatus(): SupabaseSyncStatus {
  return {
    configured: Boolean(SUPABASE_URL && SUPABASE_KEY),
    projectName: PROJECT_NAME,
    projectId: PROJECT_ID,
    projectUrl: SUPABASE_URL,
    schemaReady,
    missingTables,
    lastSyncAt,
    lastError,
    pendingOps: queue.length,
  };
}
