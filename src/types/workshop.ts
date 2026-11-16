export type Role = 'Admin' | 'Manager' | 'Staff';
export type LangId = 'en' | 'hi' | 'bn';
export type ThemeId = 'hollywood' | 'emerald' | 'navy' | 'plum' | 'charcoal';

export interface UserMe {
  name: string;
  role: Role;
  modules: string[];
  units: string[];
}

export interface UserRecord {
  name: string;
  role: Role;
  pin?: string;
  modules: string[];
  active: boolean;
  units: string[];
}

export interface StoreConfig {
  code: string;
  aliases: string[];
  pc: boolean;
  email?: string;
}

export interface BoilerConfig {
  name: string;
  unit: string;
  staff: string[];
}

export interface MeterConfig {
  name: string;
  measure: string;
}

export interface WorkshopSettings {
  units: string[];
  stores: StoreConfig[];
  itCodes: string[];
  rounds: string[];
  teams: {
    office: string[];
    iron: string[];
    wash: string[];
    spot: string[];
    qf: string[];
    [key: string]: string[];
  };
  rewashTypes: string[];
  garments: string[];
  spotTypes: string[];
  repairTypes: string[];
  damageTypes: string[];
  damagePoints: Record<string, number>;
  repairPlaces: string[];
  repairTo?: string[];
  sareeTo: string[];
  extraItems: string[];
  staffErrTypes: string[];
  boilers: BoilerConfig[];
  meters: MeterConfig[];
  alerts: {
    admin: string;
    manager: string;
    account: string;
  };
  theme: ThemeId;
  brandV?: number;
}

export interface EntryRecord<T = Record<string, any>> {
  id: string;
  mod: string;
  date: string;
  unit: string;
  store: string;
  summary: string;
  data: T;
  by: string;
  at: string;
  stamp: string;
}

export interface LotPendingItem {
  key: string;
  name: string;
  date: string;
  cleared: number;
}

export interface LotTodayItem {
  key: string;
  name: string;
  cleared: number;
  at: string;
  by: string;
}

export interface LotsInfo {
  Wash: { pending: LotPendingItem[]; today: LotTodayItem[] };
  Iron: { pending: LotPendingItem[]; today: LotTodayItem[] };
  [key: string]: { pending: LotPendingItem[]; today: LotTodayItem[] };
}

export interface AutosData {
  rp: { entries: number; people: string[]; done: Record<string, Record<string, Record<string, number>>> };
  iron: { entries: number; points: number; byK: Record<string, number> };
  scan: { UL: number; PC: number; total: number; uploads: number };
  due: {
    total: number;
    UL: number;
    PC: number;
    od: number;
    odUL: number;
    odPC: number;
    byDate: Record<string, { UL: number; PC: number }>;
    byStore: Record<string, { UL: number; PC: number; od: number }>;
    time: string;
  } | null;
  rewash: {
    today: Record<string, { Given: number; Received: number }>;
    balance: Record<string, number>;
  };
  repair: { sentToday: number; pending: number; back: number; oldest: string };
  spot: { count: number; avg: number };
  quickfix: { count: number; qf: number; ir: number };
  washerr: { count: number; points: number };
  staffErr: { count: number; byStaff: Record<string, number> };
  grc: { counts: Record<string, number>; total: number } | null;
  meter: { readings: Record<string, number>; used: Record<string, number | null> } | null;
  boiler: Record<string, { mins: number; on: boolean; sessions: number }>;
  wn: { adjToday: number; adjList: string[]; newToday: number; pendingG: number; pendingT: number };
  saree: {
    sentToday: number;
    sentTo: string[];
    recvToday: number;
    diffToday: string[];
    pending: number;
    batches: number;
    oldest: string;
  };
  lots: LotsInfo;
}

export interface HomeData {
  date: string;
  unit: string;
  autos: AutosData;
  daily: { filled: number; total: number; submitted: string } | null;
}

export interface DailyResponse {
  date: string;
  unit: string;
  prev: Record<string, any>;
  data: Record<string, any>;
  meta: { filled: number; total: number; submitted: string; by: string } | null;
  autos: AutosData;
}

export interface ModuleResponse {
  mod: string;
  unit: string;
  date: string;
  rows: EntryRecord[];
  added?: string[];
  state?: Record<string, { balance: number; pending: { date: string; given: number; left: number }[] }>;
  open?: any;
  adjToday?: EntryRecord[];
  recvToday?: EntryRecord[];
  week?: EntryRecord[];
  weekStart?: string;
  last?: Record<string, { date: string; reading: number }>;
  yesterday?: EntryRecord | null;
  history?: { date: string; total: number; ul: number; pc: number; overdue: number }[];
  list?: [string, string, string, string, string, string][];
  linked?: string;
}

export interface BackupStats {
  entries: number;
  daily: number;
  lots: number;
  log: number;
  users: number;
  cells: number;
  limit: number;
  db?: boolean;
}

export interface UnitMetricsBucket {
  scan: number;
  grc: number;
  rp: number;
  process: number;
  saree: number;
  rewash: number;
  repair: number;
  wn: number;
  errors: number;
  boilerMins: number;
  output: number;
}

export interface PerformanceDayPoint {
  date: string;
  label: string;
  byUnit: Record<string, UnitMetricsBucket>;
  totalOutput: number;
  totalScan: number;
  totalGrc: number;
  totalErrors: number;
  [key: string]: any;
}

export interface PerformanceWeekPoint {
  weekStart: string;
  weekEnd: string;
  label: string;
  byUnit: Record<string, UnitMetricsBucket>;
  totalOutput: number;
  totalScan: number;
  totalGrc: number;
  totalErrors: number;
  totalBoilerMins: number;
  [key: string]: any;
}

export interface PerformanceModuleRow {
  id: string;
  name: string;
  category: 'Volume' | 'Process & Finishing' | 'Quality' | 'Utilities';
  unitLabel: string;
  total: number;
  prevTotal: number;
  deltaPct: number | null;
  byUnit: Record<string, number>;
}

export interface PerformanceOverviewData {
  from: string;
  to: string;
  anchor: string;
  selectedUnit: string;
  units: string[];
  hasActivity: boolean;
  summary: {
    totalOutput: number;
    outputDeltaPct: number | null;
    totalScanned: number;
    scannedDeltaPct: number | null;
    totalGrc: number;
    grcDeltaPct: number | null;
    finishingAndRewash: number;
    qualityPoints: number;
    qualityDeltaPct: number | null;
    boilerMins: number;
    byUnitOutput: Record<string, number>;
  };
  dailySeries: PerformanceDayPoint[];
  weeklyTrends: PerformanceWeekPoint[];
  moduleBreakdown: PerformanceModuleRow[];
}

