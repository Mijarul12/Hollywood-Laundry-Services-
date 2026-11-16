import * as XLSX from 'xlsx';
import { MON } from '../config/workshopConfig';

export interface ApiResult<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
}

export async function apiCall<T = any>(
  action: string,
  p: Record<string, any> = {},
  token?: string,
  unit?: string
): Promise<T> {
  const payload = { ...p };
  if (payload.unit === undefined && unit) payload.unit = unit;
  const res = await fetch('/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, token, p: payload }),
  });
  if (!res.ok) {
    throw new Error(`server error ${res.status}`);
  }
  const json = (await res.json()) as ApiResult<T>;
  if (!json.ok) {
    throw new Error(json.error || 'Error');
  }
  return json.data as T;
}

export function shrinkImage(file: File, max = 1100, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const w = img.width;
      const h = img.height;
      const s = Math.min(1, max / Math.max(w, h));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * s);
      canvas.height = Math.round(h * s);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas not supported'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1]);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Not an image'));
    };
    img.src = url;
  });
}

function toISO(raw: unknown): string {
  const s = String(raw || '').trim();
  let m = s.match(/^(\d{1,2})[ -]([A-Za-z]{3})[a-z]*[ -](\d{2,4})/);
  if (m) {
    const mo = MON.map((x) => x.toLowerCase()).indexOf(m[2].toLowerCase());
    const y = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    return `${y}-${('0' + (mo + 1)).slice(-2)}-${('0' + m[1]).slice(-2)}`;
  }
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const y2 = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    return `${y2}-${('0' + m[2]).slice(-2)}-${('0' + m[1]).slice(-2)}`;
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[0];
  return s;
}

export interface ParsedScan {
  kind: 'scan';
  name: string;
  unit: string;
  stores: Record<string, number>;
  notes: string[];
  total: number;
  sheets: number;
  fileTotal: number;
  fileBy: Record<string, number>;
}

export interface ParsedDue {
  kind: 'due';
  name: string;
  items: { due: string; barcode: string; store: string; garment: string; service: string }[];
}

export async function parseExcelFile(
  file: File,
  kind: 'scan' | 'due',
  unit: string
): Promise<ParsedScan | ParsedDue> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheets = wb.SheetNames.map((name) =>
    (XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' }) as unknown[][]).map((row) =>
      row.map((c) => String(c == null ? '' : c).trim())
    )
  );

  if (kind === 'scan') {
    const out: ParsedScan = {
      kind: 'scan',
      name: file.name,
      unit,
      stores: {},
      notes: [],
      total: 0,
      sheets: 0,
      fileTotal: 0,
      fileBy: {},
    };
    for (const sr of sheets) {
      let hi = -1;
      sr.forEach((r, i) => {
        const di = r.indexOf('Delivery');
        if (di >= 0) {
          for (let k = di + 1; k < r.length; k++) {
            if (r[k]) {
              r[k]
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
                .forEach((n) => {
                  if (!out.notes.includes(n)) out.notes.push(n);
                });
              break;
            }
          }
        }
        if (hi < 0 && r.includes('Store') && r.join('|').toLowerCase().includes('garment')) hi = i;
      });
      if (hi < 0) continue;
      const H = sr[hi].map((x) => x.toLowerCase());
      const col = (re: RegExp) => H.findIndex((x) => re.test(x));
      const cs = col(/^store/);
      const cg = col(/garment/);
      let store = '';
      let counted = 0;
      for (let r = hi + 1; r < sr.length; r++) {
        const x = sr[r];
        if (/total garments/i.test(x.join('|'))) {
          for (let c = 0; c < x.length; c++) {
            if (/^\d+(\.0+)?$/.test(x[c])) {
              const ft = Number(x[c]);
              out.fileTotal += ft;
              if (store) out.fileBy[store] = (out.fileBy[store] || 0) + ft;
              break;
            }
          }
          break;
        }
        if (cs >= 0 && x[cs]) store = x[cs].toUpperCase();
        const g = cg >= 0 ? x[cg] || '' : '';
        if (!g || g === 'Summary') continue;
        const m = g.match(/^(\d+)\s*-/);
        const q = m ? Number(m[1]) : 1;
        if (!store) continue;
        out.stores[store] = (out.stores[store] || 0) + q;
        out.total += q;
        counted += q;
      }
      if (counted) out.sheets++;
    }
    if (!out.sheets) throw new Error('This is not the Delivery Note Summary (scanned) file');
    return out;
  }

  const rows: string[][] = [];
  for (const s of sheets) rows.push(...s);
  const hi = rows.findIndex((r) => {
    const j = r.join('|').toLowerCase();
    return j.includes('barcode') && j.includes('service');
  });
  if (hi < 0) throw new Error('Header (Barcode / Service) not found — is this the Workshop Out report?');
  const H = rows[hi].map((x) => x.toLowerCase());
  const col = (re: RegExp) => H.findIndex((x) => re.test(x));
  const cDue = col(/due/);
  const cBc = col(/barcode/);
  const cStore = col(/store/);
  const cG = col(/garment/);
  const cSvc = col(/service/);
  const items: ParsedDue['items'] = [];
  for (let r = hi + 1; r < rows.length; r++) {
    const x = rows[r];
    const bc = String(x[cBc] || '')
      .replace(/\*/g, '')
      .trim();
    if (!bc || /barcode/i.test(bc)) continue;
    items.push({
      due: toISO(x[cDue]),
      barcode: bc,
      store: String(x[cStore] || '').trim(),
      garment: x[cG] || '',
      service: String(x[cSvc] || '').trim(),
    });
  }
  return { kind: 'due', name: file.name, items };
}
