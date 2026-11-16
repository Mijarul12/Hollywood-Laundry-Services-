const DEFAULT_FORMSPREE_URL = 'https://formspree.io/f/mrpqpyvj';

const FORMSPREE_URL = String(process.env.FORMSPREE_URL || DEFAULT_FORMSPREE_URL).trim();

const MOD_LABELS: Record<string, string> = {
  daily: 'Daily Workshop Report',
  rp: 'Release & Pack',
  iron: 'Ironmen Error',
  scan: 'Scanned & Pending',
  due: 'Workshop Out (Due List)',
  wn: 'WN Garments & Tags',
  saree: 'Saree Polish',
  rewash: 'Rewash',
  repair: 'Repair',
  washerr: 'Washing Error',
  grc: 'GRC Count',
  staffErr: 'Staff Error',
  meter: 'Electricity & Water',
  spot: 'Spot Treatment',
  quickfix: 'Quick Fix',
  boiler: 'Boiler',
  lot: 'Washing & Iron Lots',
  settings: 'Settings',
  users: 'Users & Access',
  backup: 'Backup Import',
};

export interface FormspreeEvent {
  action: string;
  activity: string;
  unit: string;
  date: string;
  time: string;
  user: string;
  role?: string;
  store?: string;
  summary: string;
  details: Record<string, any>;
}

export interface FormspreeStatus {
  configured: boolean;
  endpoint: string;
  sentCount: number;
  failedCount: number;
  lastSentAt: string | null;
  lastError: string | null;
  pendingCount: number;
}

const pendingQueue: FormspreeEvent[] = [];
let workerPromise: Promise<void> | null = null;
let sentCount = 0;
let failedCount = 0;
let lastSentAt: string | null = null;
let lastError: string | null = null;

export function moduleLabel(mod: string): string {
  return MOD_LABELS[mod] || mod;
}

function buildFormspreePayload(ev: FormspreeEvent): Record<string, any> {
  const d = ev.details || {};
  const payload: Record<string, any> = {
    _subject: `[Hollywood Laundry] ${ev.activity}${ev.unit ? ` · ${ev.unit}` : ''}${ev.date ? ` · ${ev.date}` : ''} (${ev.user})`,
    project: 'Hollywood Laundry Services',
    action: ev.action,
    activity: ev.activity,
    unit: ev.unit,
    date: ev.date,
    time: ev.time,
    submitted_by: ev.role ? `${ev.user} (${ev.role})` : ev.user,
    summary: ev.summary,
  };

  if (ev.store) payload.store = ev.store;
  if (d.garment) payload.garment = d.garment;
  if (d.tag) payload.tag = d.tag;
  if (d.inv) payload.invoice_no = d.inv;
  if (d.karigar || d.by || d.staff) payload.worker_name = d.karigar || d.by || d.staff;
  if (Array.isArray(d.names) && d.names.length) payload.staff_names = d.names.join(', ');
  if (d.status || d.type || d.kind) payload.status = d.status || d.type || d.kind;
  if (d.qty !== undefined) payload.qty = d.qty;
  if (d.total !== undefined) payload.total = d.total;
  if (d.points !== undefined) payload.points = d.points;
  if (d.mins !== undefined) payload.running_mins = d.mins;
  if (d.note || d.reason || d.adjNote) payload.remarks = d.note || d.reason || d.adjNote;

  const appUrl = String(process.env.APP_URL || '').replace(/\/+$/, '');
  const photoIds: string[] = Array.isArray(d.photos)
    ? d.photos
    : d.photo
    ? [String(d.photo)]
    : [];
  if (photoIds.length) {
    payload.photos = photoIds.map((id) => (appUrl ? `${appUrl}/photo/${id}` : `/photo/${id}`)).join(', ');
  }

  payload.details_json = JSON.stringify(d, null, 2);
  return payload;
}

async function processQueue(): Promise<void> {
  while (pendingQueue.length > 0) {
    const ev = pendingQueue.shift()!;
    try {
      const body = buildFormspreePayload(ev);
      const res = await fetch(FORMSPREE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}${text ? `: ${text.slice(0, 180)}` : ''}`);
      }
      sentCount += 1;
      lastSentAt = new Date().toISOString();
      lastError = null;
    } catch (err: any) {
      failedCount += 1;
      lastError = String(err?.message || err);
      console.warn(`[Formspree] Submission warning (${ev.action}): ${lastError}`);
    }

    if (pendingQueue.length > 0) {
      await new Promise((r) => setTimeout(r, 150));
    }
  }
}

export function enqueueFormspree(ev: FormspreeEvent): void {
  if (!FORMSPREE_URL) return;
  pendingQueue.push(ev);
  if (!workerPromise) {
    workerPromise = processQueue().finally(() => {
      workerPromise = null;
      if (pendingQueue.length > 0) {
        workerPromise = processQueue().finally(() => {
          workerPromise = null;
        });
      }
    });
  }
}

export async function flushFormspreeForTest(): Promise<void> {
  if (workerPromise) await workerPromise;
}

export function getFormspreeStatus(): FormspreeStatus {
  return {
    configured: Boolean(FORMSPREE_URL),
    endpoint: FORMSPREE_URL,
    sentCount,
    failedCount,
    lastSentAt,
    lastError,
    pendingCount: pendingQueue.length,
  };
}
