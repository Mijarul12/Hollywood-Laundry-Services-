import { icoHtml } from '../components/Icons';
import {
  addD,
  DAILY,
  daysBetween,
  dObj,
  DSECTIONS,
  fD,
  fDY,
  fLong,
  hm,
  MODULES,
  MON,
  n0,
  nowHM,
  sumNums,
  T,
  uniq,
} from '../config/workshopConfig';
import type { AutosData, EntryRecord, LangId, WorkshopSettings } from '../types/workshop';

export function esc(s: unknown): string {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return map[c] || c;
  });
}

export function daysOf(from: string, to: string): string[] {
  const a: string[] = [];
  for (let d = from; d <= to && a.length < 62; d = addD(d, 1)) a.push(d);
  return a;
}

function pk(items: [string, string | number, string?][]): string {
  return `<div class="pk">${items
    .map((x) => `<div class="${x[2] || ''}"><b>${x[1]}</b><span>${esc(x[0])}</span></div>`)
    .join('')}</div>`;
}

function tbl(head: string[], rows: string[], foot = '', cls = 'sm'): string {
  return `<div class="tw"><table class="tbl ${cls}"><tr>${head
    .map((x) => `<th${x.startsWith('#') ? ' class="n"' : ''}>${esc(x.replace(/^#/, ''))}</th>`)
    .join('')}</tr>${rows.join('')}${foot}</table></div>`;
}

function tr(cells: (string | number)[], cls = ''): string {
  return `<tr${cls ? ` class="${cls}"` : ''}>${cells
    .map((c) => (typeof c === 'number' ? `<td class="n">${c || ''}</td>` : `<td>${c}</td>`))
    .join('')}</tr>`;
}

function matrix<TItem extends { date: string }>(
  rows: TItem[],
  keyF: (x: TItem) => string,
  valF: (x: TItem) => number,
  days: string[],
  label: string,
  lang: LangId
): string {
  const names = uniq(rows.map(keyF)).sort();
  if (!names.length) return `<div class="empty">${esc(T('Nothing yet', lang))}</div>`;
  const cell: Record<string, number> = {};
  const rt: Record<string, number> = {};
  const ct: Record<string, number> = {};
  rows.forEach((e) => {
    const k = keyF(e);
    const v = Number(valF(e)) || 0;
    cell[`${k}|${e.date}`] = (cell[`${k}|${e.date}`] || 0) + v;
    rt[k] = (rt[k] || 0) + v;
    ct[e.date] = (ct[e.date] || 0) + v;
  });
  const short = days.length > 8;
  return tbl(
    [label, ...days.map((d) => '#' + (short ? d.slice(8) : fD(d))), '#Total'],
    names.map((n) => tr([`<b>${esc(n)}</b>`, ...days.map((d) => cell[`${n}|${d}`] || 0), rt[n] || 0])),
    tr(['Total', ...days.map((d) => ct[d] || 0), sumNums(names.map((n) => rt[n]))], 'tot')
  );
}

function byKey<TItem>(rows: TItem[], keyF: (x: TItem) => string, valF?: (x: TItem) => number): Record<string, number> {
  const o: Record<string, number> = {};
  rows.forEach((e) => {
    const k = keyF(e);
    o[k] = (o[k] || 0) + (valF ? Number(valF(e)) || 0 : 1);
  });
  return o;
}

function listTbl(rows: EntryRecord[], cols: [string, (e: EntryRecord) => any][], repUnit: string, lang: LangId): string {
  if (!rows.length) return `<div class="empty">${esc(T('Nothing yet', lang))}</div>`;
  return tbl(
    ['Date', ...cols.map((c) => c[0]), 'By'],
    rows.map((e) =>
      tr([
        `${fD(e.date)} <small>${esc(e.at)}</small>`,
        ...cols.map((c) => {
          const v = c[1](e);
          return v == null ? '' : typeof v === 'number' ? v : esc(v);
        }),
        `${esc(e.by)}${repUnit === 'ALL' ? ` <span class="badge b-${esc(e.unit)}">${esc(e.unit)}</span>` : ''}`,
      ])
    )
  );
}

function gcardHtml(mod: string, title: string, val: string | null, subl: string, cls: string, lang: LangId): string {
  const icon = MODULES.find((m) => m.id === mod)?.icon || 'daily';
  return `<button type="button" class="gc${val === null ? ' none' : ''}"><div class="gt">${icoHtml(icon)}${esc(
    T(title, lang)
  )}</div><div class="gv ${cls || ''}">${val === null ? 'Not filled' : val}</div>${
    subl ? `<div class="gs">${subl}</div>` : ''
  }</button>`;
}

export function glanceHtmlString(a: AutosData, lang: LangId): string {
  const rp = a.rp;
  const rounds = Object.keys(rp.done);
  const rk = Object.keys(a.rewash.balance);
  const bk = Object.keys(a.boiler);

  let h = '<div class="glance">';
  h += gcardHtml(
    'scan',
    'Scanned today',
    a.scan.total ? `${n0(a.scan.total)} <small>${esc(T('pcs', lang))}</small>` : null,
    `UL ${n0(a.scan.UL)} · PC ${n0(a.scan.PC)} · ${a.scan.uploads} file(s)`,
    '',
    lang
  );
  h += gcardHtml(
    'scan',
    'Pending',
    a.due ? n0(a.due.total) : null,
    a.due
      ? `UL ${a.due.UL} · PC ${a.due.PC}${
          a.due.od ? ` · <b style="color:var(--bad)">${a.due.od} overdue</b>` : ' · no overdue'
        }`
      : 'Workshop Out not uploaded',
    '',
    lang
  );
  h += gcardHtml(
    'rp',
    'Release & Pack',
    rp.entries ? `${rp.entries} <small>entries</small>` : null,
    rounds
      .map((r) => {
        const st = rp.done[r];
        const rel = Object.keys(st).filter((s) => st[s].Release).length;
        const pkc = Object.keys(st).filter((s) => st[s].Pack).length;
        return `${esc(T(r, lang))}: R${rel} P${pkc}`;
      })
      .join(' · ') + (rp.people.length ? `<br>${esc(rp.people.join(', '))}` : ''),
    '',
    lang
  );
  h += gcardHtml(
    'iron',
    'Ironmen Error',
    a.iron.entries ? `${a.iron.points} <small>pts</small>` : '0',
    Object.keys(a.iron.byK)
      .map((k) => `${esc(k)} ${a.iron.byK[k]}`)
      .join(' · ') || 'No entry today',
    a.iron.points ? 'bad' : '',
    lang
  );
  h += gcardHtml(
    'rewash',
    'Rewash',
    `${sumNums(rk.map((k) => a.rewash.balance[k]))} <small>${esc(T('Balance', lang))}</small>`,
    rk
      .map((k) => {
        const t = a.rewash.today[k] || { Given: 0, Received: 0 };
        return `${esc(T(k, lang))}: +${t.Given} / −${t.Received} → ${a.rewash.balance[k]}`;
      })
      .join('<br>'),
    '',
    lang
  );
  h += gcardHtml(
    'repair',
    'Repair',
    `${a.repair.pending} <small>open</small>`,
    `Sent today ${a.repair.sentToday} · back ${a.repair.back}${
      a.repair.oldest ? ` · oldest ${fD(a.repair.oldest)}` : ''
    }`,
    '',
    lang
  );
  h += gcardHtml('washerr', 'Washing Error', String(a.washerr.count), `${a.washerr.points} points`, a.washerr.count ? 'bad' : 'ok', lang);
  h += gcardHtml(
    'staffErr',
    'Staff Error',
    String(a.staffErr.count),
    Object.keys(a.staffErr.byStaff)
      .map((k) => `${esc(k)} ${a.staffErr.byStaff[k]}`)
      .join(' · ') || 'No error noted',
    a.staffErr.count ? 'bad' : 'ok',
    lang
  );
  h += gcardHtml(
    'grc',
    'GRC Count',
    a.grc ? String(a.grc.total) : null,
    a.grc
      ? Object.keys(a.grc.counts)
          .map((s) => `${esc(s)} ${a.grc!.counts[s]}`)
          .join(' · ')
      : '',
    '',
    lang
  );
  h += gcardHtml(
    'meter',
    'Electricity & Water',
    a.meter ? `${Object.keys(a.meter.readings).length} <small>readings</small>` : null,
    a.meter
      ? Object.keys(a.meter.readings)
          .map((k) => {
            const u = a.meter!.used[k];
            return `${esc(k)}: ${u == null ? a.meter!.readings[k] : `used ${u}`}`;
          })
          .join('<br>')
      : '',
    '',
    lang
  );
  h += gcardHtml(
    'boiler',
    'Boiler',
    bk.length ? hm(sumNums(bk.map((k) => a.boiler[k].mins))) : null,
    bk.map((k) => `${esc(k)}${a.boiler[k].on ? ' ● running' : ''} ${hm(a.boiler[k].mins)}`).join('<br>'),
    '',
    lang
  );
  h += gcardHtml(
    'wn',
    'WN Garments',
    `${a.wn.adjToday} <small>adjusted</small>`,
    `${a.wn.adjList.length ? `${esc(a.wn.adjList.join(', '))}<br>` : ''}New today ${a.wn.newToday} · pending: ${
      a.wn.pendingG
    } garments, ${a.wn.pendingT} tags`,
    '',
    lang
  );
  h += gcardHtml(
    'saree',
    'Saree Polish',
    `${a.saree.pending} <small>at polish</small>`,
    `Sent today ${a.saree.sentToday}${a.saree.sentTo.length ? ` (${esc(a.saree.sentTo.join(', '))})` : ''} · received ${
      a.saree.recvToday
    }${a.saree.diffToday.length ? `<br><b style="color:var(--bad)">Diff: ${esc(a.saree.diffToday.join(', '))}</b>` : ''}${
      a.saree.oldest ? `<br>oldest ${fD(a.saree.oldest)}` : ''
    }`,
    '',
    lang
  );
  h += gcardHtml('spot', 'Spot Treatment', String(a.spot.count), a.spot.count ? `Avg removed ${a.spot.avg}%` : '', '', lang);
  h += gcardHtml('quickfix', 'Quick Fix', String(a.quickfix.count), `QF ${a.quickfix.qf} · IR ${a.quickfix.ir}`, '', lang);
  h += '</div>';
  return h;
}

export interface DailyDocDay {
  unit: string;
  data: Record<string, any>;
  meta: { filled: number; total: number; submitted: string; by?: string } | null;
  autos: AutosData;
}

export function dailyDocHtml(x: DailyDocDay, date: string, lang: LangId): string {
  const data = x.data || {};
  let h = `<h3>${esc(x.unit)} · ${esc(fLong(date))} — ${
    x.meta && x.meta.submitted
      ? `✓ Submitted ${esc(x.meta.submitted)}`
      : `<span style="color:var(--bad)">Not submitted${x.meta ? ` (${x.meta.filled}/${x.meta.total} filled)` : ''}</span>`
  }</h3>`;
  h += glanceHtmlString(x.autos, lang);

  const L = x.autos.lots;
  const clearedWash = L.Wash.today.filter((o) => o.cleared >= 100).map((o) => `Wash ${fD(o.name)}`);
  const clearedIron = L.Iron.today.filter((o) => o.cleared >= 100).map((o) => `Iron ${fD(o.name)}`);
  h += `<h3>${esc(T('Lots', lang))}</h3>${tbl(
    ['Washing lots pending', 'Iron lots pending', 'Cleared today'],
    [
      tr([
        L.Wash.pending.map((l) => fD(l.name)).join(', ') || '✓ none',
        L.Iron.pending.map((l) => fD(l.name)).join(', ') || '✓ none',
        [...clearedWash, ...clearedIron].join(', ') || '—',
      ]),
    ]
  )}`;

  let num = 0;
  const rows: string[] = [];
  DSECTIONS.forEach((s) => {
    rows.push(`<tr class="tot"><td colspan="3">${esc(s.t)}</td></tr>`);
    DAILY.filter((it) => it.s === s.id).forEach((it) => {
      num += 1;
      let ans = it.f
        .filter((f) => {
          if (f.show && data[f.show[0]] !== f.show[1]) return false;
          if (f.when === 'ironZero' && x.autos.iron.entries > 0) return false;
          return true;
        })
        .map((f) => {
          const v = data[f.k];
          if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return '';
          if (f.t === 'rows') {
            return (
              '<br>' +
              (v as Record<string, any>[])
                .map((r) =>
                  (f.cols || [])
                    .map((c) => esc(c.t === 'date' ? fDY(r[c.k]) : r[c.k]))
                    .join(' · ')
                )
                .join('<br>')
            );
          }
          return `<b>${esc(Array.isArray(v) ? v.join(', ') : v)}</b>${
            f.t !== 'yn' ? ` <small>${esc(f.l)}</small>` : ''
          }`;
        })
        .filter(Boolean)
        .join(' · ');

      if (it.auto === 'iron' && x.autos.iron.entries) {
        ans = `✓ ${x.autos.iron.entries} entries · ${x.autos.iron.points} pts`;
      }
      if (it.auto === 'wn') {
        const w = x.autos.wn;
        ans = `Adjusted <b>${w.adjToday}</b>${w.adjList.length ? `: ${esc(w.adjList.join(', '))}` : ''} · pending ${
          w.pendingG
        } garments, ${w.pendingT} tags`;
      }
      if (it.auto === 'saree') {
        const sa = x.autos.saree;
        ans = `Sent <b>${sa.sentToday}</b>${sa.sentTo.length ? ` (${esc(sa.sentTo.join(', '))})` : ''} · received <b>${
          sa.recvToday
        }</b>${sa.diffToday.length ? ` · diff ${esc(sa.diffToday.join(', '))}` : ''} · at polish ${sa.pending}`;
      }
      rows.push(tr([String(num), esc(it.l), ans || '<span style="color:var(--bad)">—</span>']));
    });
  });

  return `${h}<h3>Checklist</h3>${tbl(['#', 'Point', 'Answer'], rows)}`;
}

export function renderReportHtml(
  kind: string,
  d: Record<string, any>,
  settings: WorkshopSettings,
  today: string,
  lang: LangId
): string {
  const repUnit = String(d.unit || 'ALL');
  switch (kind) {
    case 'daily':
      return (d.days as DailyDocDay[]).map((x) => dailyDocHtml(x, d.from, lang)).join('<div class="pbreak"></div>');

    case 'checklist': {
      const days = daysOf(d.from, d.to);
      const mods = MODULES.filter((m) => !['daily', 'reports', 'settings', 'performance'].includes(m.id));
      const cnt: Record<string, number> = {};
      (d.rows as { mod: string; date: string }[]).forEach((e) => {
        const k = `${e.mod}|${e.date}`;
        cnt[k] = (cnt[k] || 0) + 1;
      });
      const dl: Record<string, { filled: number; total: number; submitted: string }[]> = {};
      (d.daily as { date: string; filled: number; total: number; submitted: string }[]).forEach((r) => {
        (dl[r.date] = dl[r.date] || []).push(r);
      });
      const rows = [
        tr([
          '<b>Daily Report</b>',
          ...days.map((x) => {
            const l = dl[x] || [];
            if (!l.length) return '<span class="dot">—</span>';
            const sub = l.every((r) => r.submitted);
            const pct = Math.round(
              (sumNums(l.map((r) => r.filled)) / Math.max(1, sumNums(l.map((r) => r.total)))) * 100
            );
            return `<span class="dot ${sub ? 'ok' : 'half'}">${sub ? '✓' : `${pct}%`}</span>`;
          }),
        ]),
      ];
      mods.forEach((m) => {
        rows.push(
          tr([
            `<b>${esc(m.t)}</b>`,
            ...days.map((x) => {
              const n = cnt[`${m.id}|${x}`] || 0;
              return `<span class="dot ${n ? 'ok' : ''}">${n || '·'}</span>`;
            }),
          ])
        );
      });
      return `<div class="legend muted" style="font-size:12px;margin-bottom:8px">Number = entries saved that day · ✓ = daily report submitted</div>${tbl(
        ['Screen', ...days.map((x) => (days.length > 8 ? x.slice(8) : fD(x)))],
        rows,
        '',
        'sm'
      )}`;
    }

    case 'rp': {
      const eRows = d.rows as EntryRecord[];
      const days = daysOf(d.from, d.to);
      const people = byKey(
        eRows.flatMap((e) => ((e.data.names as string[]) || []).map((n) => ({ n }))),
        (x) => x.n
      );
      const rel = eRows.filter((e) => e.data.type === 'Release');
      const pkd = eRows.filter((e) => e.data.type === 'Pack');
      const rounds = settings.rounds || [];
      let h = pk([
        ['Entries', eRows.length],
        ['Release', rel.length, 'ok'],
        ['Pack', pkd.length],
        ['People', Object.keys(people).length],
      ]);
      h +=
        '<h3>Stores done per day (Release / Pack)</h3>' +
        tbl(
          ['Day', ...rounds, '#Entries'],
          days.map((x) => {
            const de = eRows.filter((e) => e.date === x);
            return tr([
              fD(x),
              ...rounds.map((r) => {
                const re = de.filter((e) => e.data.round === r);
                if (!re.length) return '—';
                const rc = uniq(re.filter((e) => e.data.type === 'Release').map((e) => e.store)).length;
                const pc = uniq(re.filter((e) => e.data.type === 'Pack').map((e) => e.store)).length;
                return `R ${rc} · P ${pc}`;
              }),
              de.length,
            ]);
          })
        );
      h +=
        '<h3>Work by person</h3>' +
        tbl(
          ['Name', '#Entries'],
          Object.keys(people)
            .sort((a, b) => people[b] - people[a])
            .map((n) => tr([`<b>${esc(n)}</b>`, people[n]]))
        );
      return h;
    }

    case 'scan': {
      const eRows = d.rows as EntryRecord[];
      const days = daysOf(d.from, d.to);
      const sc: Record<string, { UL: number; PC: number }> = {};
      const du: Record<string, EntryRecord> = {};
      eRows.forEach((e) => {
        if (e.mod === 'scan') {
          const s = (sc[e.date] = sc[e.date] || { UL: 0, PC: 0 });
          if (e.unit === 'UL' || e.unit === 'PC') s[e.unit] += Number(e.data.total || 0);
        } else {
          du[e.date] = e;
        }
      });
      const tUL = sumNums(Object.keys(sc).map((k) => sc[k].UL));
      const tPC = sumNums(Object.keys(sc).map((k) => sc[k].PC));
      return (
        pk([
          ['Scanned UL', n0(tUL)],
          ['Scanned PC', n0(tPC)],
          ['Scanned total', n0(tUL + tPC), 'ok'],
        ]) +
        '<h3>Day by day</h3>' +
        tbl(
          ['Day', '#Scanned UL', '#Scanned PC', '#Scanned total', '#Pending', '#Pend. UL', '#Pend. PC', '#Overdue'],
          days.map((x) => {
            const s = sc[x] || { UL: 0, PC: 0 };
            const u = du[x];
            return tr([
              fD(x),
              s.UL,
              s.PC,
              s.UL + s.PC,
              u ? u.data.total : 0,
              u ? u.data.UL : 0,
              u ? u.data.PC : 0,
              u ? `<b style="color:var(--bad)">${u.data.od}</b>` : '',
            ]);
          }),
          tr(['Total', tUL, tPC, tUL + tPC, '', '', '', ''], 'tot')
        )
      );
    }

    case 'rewash': {
      const eRows = d.rows as EntryRecord[];
      const kinds = settings.rewashTypes || [];
      const days = daysOf(d.from, d.to);
      const bal: Record<string, number> = {};
      kinds.forEach((k) => {
        bal[k] = d.opening?.[k] || 0;
      });
      const rows = days.map((x) => {
        const de = eRows.filter((e) => e.date === x);
        const cells: (string | number)[] = [fD(x)];
        kinds.forEach((k) => {
          const g = sumNums(de.filter((e) => e.data.kind === k && e.data.type === 'Given').map((e) => e.data.qty));
          const r = sumNums(de.filter((e) => e.data.kind === k && e.data.type === 'Received').map((e) => e.data.qty));
          bal[k] += g - r;
          cells.push(g, r, `<b>${bal[k]}</b>`);
        });
        return tr(cells);
      });
      const head = ['Day'];
      kinds.forEach((k) => head.push(`#${k} given`, '#received', '#balance'));
      return (
        pk([
          ...kinds.map((k): [string, number] => [`Opening ${k}`, d.opening?.[k] || 0]),
          ...kinds.map((k): [string, number, string] => [`Closing ${k}`, bal[k], 'bad']),
        ]) +
        tbl(head, rows) +
        '<h3>Entries</h3>' +
        listTbl(
          eRows,
          [
            ['Type', (e) => e.data.kind],
            ['Given / Received', (e) => e.data.type],
            ['Pcs', (e) => e.data.qty],
            ['Done by', (e) => e.data.by],
          ],
          repUnit,
          lang
        )
      );
    }

    case 'repair': {
      const eRows = d.rows as EntryRecord[];
      const open = eRows.filter((e) => e.data.status !== 'Released');
      return (
        pk([
          ['Sent', eRows.filter((e) => e.date >= d.from).length],
          ['Still open', open.length, 'bad'],
          ['Released', eRows.filter((e) => e.data.status === 'Released').length, 'ok'],
        ]) +
        listTbl(
          eRows,
          [
            ['Store', (e) => e.store],
            ['Invoice', (e) => e.data.tag],
            ['Garment', (e) => e.data.garment],
            ['Damage', (e) => e.data.damage],
            ['To', (e) => e.data.sentTo],
            ['Status', (e) => e.data.status],
            ['Back', (e) => fD(e.data.backAt)],
            ['Released', (e) => fD(e.data.releasedAt)],
          ],
          repUnit,
          lang
        )
      );
    }

    case 'lots': {
      const lotRows = d.rows as { key: string; date: string; unit: string; type: string; cleared: number; log: { at: string; by: string; pct: number }[] }[];
      return lotRows.length
        ? tbl(
            ['Lot date', 'Unit', 'Type', 'Status', 'Cleared on'],
            lotRows.map((r) => {
              const k = r.key.split('|')[2] || r.date;
              const c = r.log.filter((l) => l.pct >= 100).pop();
              return tr([
                `<b>${fD(k)}${k.includes('#') ? ` ${k.split(' ')[1]}` : ''}</b>`,
                r.unit,
                r.type === 'Wash' ? 'Washing' : 'Iron',
                r.cleared >= 100
                  ? '<b style="color:var(--ok)">✓ Cleared</b>'
                  : `<b style="color:var(--bad)">Pending ${daysBetween(r.date, today)}d</b>`,
                c ? `${fD(c.at)} ${c.at.slice(11)} · ${esc(c.by)}` : '',
              ]);
            })
          )
        : '<div class="empty">—</div>';
    }

    case 'wn': {
      const eRows = d.rows as EntryRecord[];
      const g = eRows.filter((e) => e.data.kind === 'garment');
      const t = eRows.filter((e) => e.data.kind === 'tag');
      return (
        pk([
          ['WN garments', g.length],
          ['Adjusted', g.filter((e) => e.data.status === 'Adjusted').length, 'ok'],
          ['Still pending', g.filter((e) => e.data.status !== 'Adjusted').length, 'bad'],
          ['Detached tags', t.length],
          ['Tags pending', t.filter((e) => e.data.status !== 'Adjusted').length, 'bad'],
        ]) +
        '<h3>WN garments (tag missing)</h3>' +
        listTbl(
          g,
          [
            ['Garment', (e) => e.data.garment],
            ['Ironed by', (e) => e.data.karigar],
            ['Invoice', (e) => e.data.inv || 'pending'],
            ['Store', (e) => e.data.adjStore],
            ['Adjusted on', (e) => (e.data.adjAt ? fD(e.data.adjAt) : '')],
          ],
          repUnit,
          lang
        ) +
        '<h3>Detached tags</h3>' +
        listTbl(
          t,
          [
            ['Tag / invoice', (e) => e.data.tag],
            ['Store', (e) => e.store],
            ['Garment', (e) => e.data.garment],
            ['Status', (e) => (e.data.status === 'Adjusted' ? `Adjusted ${fD(e.data.adjAt)}` : 'Pending')],
          ],
          repUnit,
          lang
        )
      );
    }

    case 'saree': {
      const eRows = d.rows as EntryRecord[];
      const sent = sumNums(eRows.map((e) => e.data.qty));
      const rec = eRows.filter((e) => e.data.status === 'Received');
      return (
        pk([
          ['Sent', sent],
          ['Received', sumNums(rec.map((e) => e.data.recvQty)), 'ok'],
          ['Still at polish', sumNums(eRows.filter((e) => e.data.status !== 'Received').map((e) => e.data.qty)), 'bad'],
          ['Difference', sumNums(rec.map((e) => e.data.diff))],
        ]) +
        listTbl(
          eRows,
          [
            ['Sent to', (e) => e.data.to],
            ['Sent', (e) => e.data.qty],
            ['Received', (e) => (e.data.status === 'Received' ? e.data.recvQty : 'pending')],
            ['On', (e) => (e.data.recvAt ? fD(e.data.recvAt) : '')],
            ['Diff', (e) => e.data.diff || ''],
            ['Reason', (e) => e.data.reason],
          ],
          repUnit,
          lang
        )
      );
    }

    case 'iron': {
      const eRows = d.rows as EntryRecord[];
      const days = daysOf(d.from, d.to);
      const notes = eRows.filter((e) => e.data.note);
      return (
        pk([
          ['Total points', sumNums(eRows.map((e) => e.data.points)), 'bad'],
          ['Karigars', uniq(eRows.map((e) => e.data.karigar)).length],
          ['Entries', eRows.length],
        ]) +
        '<h3>Points by karigar</h3>' +
        matrix(eRows, (e) => e.data.karigar, (e) => e.data.points, days, 'Karigar', lang) +
        (notes.length
          ? '<h3>Remarks</h3>' +
            listTbl(
              notes,
              [
                ['Karigar', (e) => e.data.karigar],
                ['Pts', (e) => e.data.points],
                ['Remarks', (e) => e.data.note],
              ],
              repUnit,
              lang
            )
          : '')
      );
    }

    case 'washerr': {
      const eRows = d.rows as EntryRecord[];
      const days = daysOf(d.from, d.to);
      return (
        pk([
          ['Errors', eRows.length, 'bad'],
          ['Points', sumNums(eRows.map((e) => e.data.points))],
        ]) +
        '<h3>Points by person</h3>' +
        matrix(eRows, (e) => e.data.by, (e) => e.data.points, days, 'Damage by', lang) +
        '<h3>Entries</h3>' +
        listTbl(
          eRows,
          [
            ['Store', (e) => e.store],
            ['Tag', (e) => e.data.tag],
            ['Garment', (e) => e.data.garment],
            ['Damage', (e) => e.data.damage],
            ['Pts', (e) => e.data.points],
            ['Damage by', (e) => e.data.by],
            ['Details', (e) => e.data.note],
          ],
          repUnit,
          lang
        )
      );
    }

    case 'staffErr': {
      const eRows = d.rows as EntryRecord[];
      const days = daysOf(d.from, d.to);
      return (
        pk([
          ['Errors', eRows.length, 'bad'],
          ['Staff', uniq(eRows.map((e) => e.data.staff)).length],
        ]) +
        '<h3>Errors by staff</h3>' +
        matrix(eRows, (e) => e.data.staff, () => 1, days, 'Staff', lang) +
        '<h3>Entries</h3>' +
        listTbl(
          eRows,
          [
            ['Staff', (e) => e.data.staff],
            ['Details', (e) => e.data.note],
          ],
          repUnit,
          lang
        )
      );
    }

    case 'grc': {
      const eRows = d.rows as EntryRecord[];
      const days = daysOf(d.from, d.to);
      const flat: { date: string; s: string; v: number }[] = [];
      eRows.forEach((e) => {
        Object.keys(e.data.counts || {}).forEach((s) => {
          flat.push({ date: e.date, s, v: Number(e.data.counts[s] || 0) });
        });
      });
      return (
        pk([
          ['Total GRC', sumNums(flat.map((x) => x.v)), 'bad'],
          ['Days filled', `${uniq(eRows.map((e) => e.date)).length} / ${days.length}`],
        ]) +
        '<h3>Store × day</h3>' +
        matrix(flat, (x) => x.s, (x) => x.v, days, 'Store', lang)
      );
    }

    case 'spot': {
      const eRows = d.rows as EntryRecord[];
      const by = byKey(eRows, (e) => e.data.by);
      return (
        pk([
          ['Garments', eRows.length],
          ['Avg removed', `${eRows.length ? Math.round(sumNums(eRows.map((e) => e.data.pct)) / eRows.length) : 0}%`, 'ok'],
          ['Fully removed', eRows.filter((e) => e.data.pct >= 100).length],
        ]) +
        '<h3>By person</h3>' +
        tbl(
          ['Name', '#Garments', '#Avg %'],
          Object.keys(by).map((n) => {
            const l = eRows.filter((e) => e.data.by === n);
            return tr([esc(n), l.length, Math.round(sumNums(l.map((e) => e.data.pct)) / l.length)]);
          })
        ) +
        '<h3>Entries</h3>' +
        listTbl(
          eRows,
          [
            ['Store', (e) => e.store],
            ['Tag', (e) => e.data.tag],
            ['Garment', (e) => e.data.garment],
            ['Spot', (e) => e.data.spot],
            ['Removed %', (e) => e.data.pct],
            ['Done by', (e) => e.data.by],
          ],
          repUnit,
          lang
        )
      );
    }

    case 'quickfix': {
      const eRows = d.rows as EntryRecord[];
      const by = byKey(eRows, (e) => e.data.by);
      return (
        pk([
          ['Total', eRows.length],
          ['Quick Fix (QF)', eRows.filter((e) => e.data.kind === 'QF').length],
          ['Internal Repair (IR)', eRows.filter((e) => e.data.kind === 'IR').length],
        ]) +
        '<h3>By person</h3>' +
        tbl(
          ['Name', '#QF', '#IR'],
          Object.keys(by).map((n) => {
            const l = eRows.filter((e) => e.data.by === n);
            return tr([
              esc(n),
              l.filter((e) => e.data.kind === 'QF').length,
              l.filter((e) => e.data.kind === 'IR').length,
            ]);
          })
        ) +
        '<h3>Entries</h3>' +
        listTbl(
          eRows,
          [
            ['Store', (e) => e.store],
            ['Tag', (e) => e.data.tag],
            ['Garment', (e) => e.data.garment],
            ['Repair', (e) => e.data.repair],
            ['Type', (e) => e.data.kind],
            ['Done by', (e) => e.data.by],
          ],
          repUnit,
          lang
        )
      );
    }

    case 'meter': {
      const eRows = d.rows as EntryRecord[];
      const ms = settings.meters || [];
      const days = daysOf(d.from, d.to);
      const by: Record<string, EntryRecord[]> = {};
      eRows.forEach((e) => {
        (by[e.date] = by[e.date] || []).push(e);
      });
      const head = ['Day'];
      ms.forEach((m) => head.push(`#${m.name} reading`, `#Used (${m.measure})`));
      const tot: Record<string, number> = {};
      const rows = days.map((x) => {
        const cells: (string | number)[] = [fD(x)];
        ms.forEach((m) => {
          let r = 0;
          let u = 0;
          (by[x] || []).forEach((e) => {
            if (e.data.readings?.[m.name] != null) {
              r = Number(e.data.readings[m.name]);
              u += Number(e.data.used?.[m.name]) || 0;
            }
          });
          tot[m.name] = (tot[m.name] || 0) + u;
          cells.push(r, u);
        });
        return tr(cells);
      });
      return (
        pk(ms.map((m): [string, string] => [`Used · ${m.name}`, `${Math.round((tot[m.name] || 0) * 100) / 100} ${m.measure}`])) +
        tbl(head, rows, tr(['Total', ...ms.flatMap((m) => ['', Math.round((tot[m.name] || 0) * 100) / 100])], 'tot'))
      );
    }

    case 'boiler': {
      const eRows = d.rows as EntryRecord[];
      const days = daysOf(d.from, d.to);
      return (
        pk([
          ['Running time', hm(sumNums(eRows.map((e) => e.data.mins))), 'ok'],
          ['Sessions', eRows.length],
        ]) +
        '<h3>Hours by boiler (minutes)</h3>' +
        matrix(eRows, (e) => e.data.boiler, (e) => e.data.mins, days, 'Boiler', lang) +
        '<h3>Sessions</h3>' +
        listTbl(
          eRows,
          [
            ['Boiler', (e) => e.data.boiler],
            ['Start', (e) => e.data.start],
            ['Stop', (e) => e.data.stop || 'running'],
            ['Time', (e) => (e.data.mins ? hm(e.data.mins) : '')],
          ],
          repUnit,
          lang
        )
      );
    }

    default:
      return '<div class="empty">—</div>';
  }
}

export function reportRangeFor(anchor: string, per: 'day' | 'week' | 'month', kind: string | null): [string, string] {
  const effectivePer = kind === 'daily' ? 'day' : per;
  if (effectivePer === 'day') return [anchor, anchor];
  if (effectivePer === 'week') {
    const start = addD(anchor, -((dObj(anchor).getUTCDay() + 6) % 7));
    return [start, addD(start, 6)];
  }
  const m = `${anchor.slice(0, 8)}01`;
  const e = addD(`${addD(m, 32).slice(0, 8)}01`, -1);
  return [m, e];
}

export function reportLabelFor(anchor: string, per: 'day' | 'week' | 'month', kind: string | null): string {
  const [from, to] = reportRangeFor(anchor, per, kind);
  if (from === to) return fLong(from);
  if (per === 'month') {
    const dt = dObj(from);
    return `${MON[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
  }
  return `${fD(from)} – ${fD(to)}`;
}

export function buildPrintHeader(title: string, sub: string, today: string, by: string, body: string, signs = false, cls = ''): string {
  return `<div class="pdoc ${cls}"><div class="phead"><div class="pmono"><img src="/icons/hollywood-logo.png" alt="HLS"></div><div class="pt"><b>Hollywood Laundry Service</b><span>Workshop Operational Control</span></div><div class="pr"><b>${esc(
    title
  )}</b><span>${esc(sub)}</span></div></div><div class="rdoc">${body}</div>${
    signs
      ? '<div class="signs"><div><span></span>Supervisor</div><div><span></span>Manager</div><div><span></span>Approved by</div></div>'
      : ''
  }<div class="pfoot"><span>Printed ${fDY(today)} ${nowHM()} · ${esc(by)}</span><span>Workshop Operational Control</span></div></div>`;
}

function csvCell(v: unknown): string {
  const s = String(v == null ? '' : v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: (string | number | undefined | null)[][]): string {
  return '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

export function buildReportCsv(
  kind: string,
  d: Record<string, any>,
  settings: WorkshopSettings,
  today: string
): string {
  const from = String(d.from || '');
  const to = String(d.to || from);

  switch (kind) {
    case 'daily': {
      const days = (d.days as DailyDocDay[]) || [];
      const rows: (string | number)[][] = [
        [
          'Date',
          'Unit',
          'Status',
          'Submitted',
          'Scanned Total',
          'Pending Total',
          'Overdue',
          'Release & Pack Entries',
          'Ironmen Error Pts',
          'Rewash Balance',
          'Open Repairs',
          'Washing Error Pts',
          'Staff Errors',
          'GRC Total',
          'Boiler Time',
          'WN Adjusted',
          'Saree At Polish',
          'Spot Count',
          'Quick Fix Count',
        ],
      ];
      days.forEach((x) => {
        const a = x.autos;
        rows.push([
          from,
          x.unit,
          x.meta?.submitted ? 'Submitted' : 'Draft',
          x.meta?.submitted || `${x.meta?.filled || 0}/${x.meta?.total || DAILY.length}`,
          a.scan.total,
          a.due?.total ?? 0,
          a.due?.od ?? 0,
          a.rp.entries,
          a.iron.points,
          sumNums(Object.values(a.rewash.balance)),
          a.repair.pending,
          a.washerr.points,
          a.staffErr.count,
          a.grc?.total ?? 0,
          hm(sumNums(Object.values(a.boiler).map((b) => b.mins))),
          a.wn.adjToday,
          a.saree.pending,
          a.spot.count,
          a.quickfix.count,
        ]);
      });
      rows.push([]);
      rows.push(['Date', 'Unit', 'Point #', 'Section', 'Question', 'Answer']);
      days.forEach((x) => {
        const data = x.data || {};
        let num = 0;
        DSECTIONS.forEach((s) => {
          DAILY.filter((it) => it.s === s.id).forEach((it) => {
            num += 1;
            let ans = it.f
              .filter((f) => {
                if (f.show && data[f.show[0]] !== f.show[1]) return false;
                if (f.when === 'ironZero' && x.autos.iron.entries > 0) return false;
                return true;
              })
              .map((f) => {
                const v = data[f.k];
                if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return '';
                if (f.t === 'rows') {
                  return (v as Record<string, any>[])
                    .map((r) => (f.cols || []).map((c) => (c.t === 'date' ? fDY(r[c.k]) : r[c.k])).join(' / '))
                    .join('; ');
                }
                return `${Array.isArray(v) ? v.join(', ') : v}${f.t !== 'yn' ? ` (${f.l})` : ''}`;
              })
              .filter(Boolean)
              .join(' | ');
            if (it.auto === 'iron' && x.autos.iron.entries) {
              ans = `${x.autos.iron.entries} entries (${x.autos.iron.points} pts)`;
            } else if (it.auto === 'wn') {
              ans = `Adjusted ${x.autos.wn.adjToday}; pending ${x.autos.wn.pendingG} garments, ${x.autos.wn.pendingT} tags`;
            } else if (it.auto === 'saree') {
              ans = `Sent ${x.autos.saree.sentToday}; received ${x.autos.saree.recvToday}; at polish ${x.autos.saree.pending}`;
            }
            rows.push([from, x.unit, num, s.t, it.l, ans]);
          });
        });
      });
      return toCsv(rows);
    }

    case 'checklist': {
      const days = daysOf(from, to);
      const mods = MODULES.filter((m) => !['daily', 'reports', 'settings', 'performance'].includes(m.id));
      const cnt: Record<string, number> = {};
      ((d.rows as { mod: string; date: string }[]) || []).forEach((e) => {
        const k = `${e.mod}|${e.date}`;
        cnt[k] = (cnt[k] || 0) + 1;
      });
      const dl: Record<string, { filled: number; total: number; submitted: string }[]> = {};
      ((d.daily as { date: string; filled: number; total: number; submitted: string }[]) || []).forEach((r) => {
        (dl[r.date] = dl[r.date] || []).push(r);
      });
      const rows: (string | number)[][] = [['Screen', ...days]];
      rows.push([
        'Daily Report',
        ...days.map((x) => {
          const l = dl[x] || [];
          if (!l.length) return '';
          if (l.every((r) => r.submitted)) return 'Submitted';
          return `${Math.round((sumNums(l.map((r) => r.filled)) / Math.max(1, sumNums(l.map((r) => r.total)))) * 100)}%`;
        }),
      ]);
      mods.forEach((m) => {
        rows.push([m.t, ...days.map((x) => cnt[`${m.id}|${x}`] || 0)]);
      });
      return toCsv(rows);
    }

    case 'rp': {
      const eRows = (d.rows as EntryRecord[]) || [];
      return toCsv([
        ['Date', 'Unit', 'Round', 'Store', 'Type', 'Done By', 'Time', 'Saved By'],
        ...eRows.map((e) => [
          e.date,
          e.unit,
          e.data.round || '',
          e.store,
          e.data.type || '',
          ((e.data.names as string[]) || []).join(', '),
          e.at,
          e.by,
        ]),
      ]);
    }

    case 'scan': {
      const eRows = (d.rows as EntryRecord[]) || [];
      const days = daysOf(from, to);
      const sc: Record<string, { UL: number; PC: number }> = {};
      const du: Record<string, EntryRecord> = {};
      eRows.forEach((e) => {
        if (e.mod === 'scan') {
          const s = (sc[e.date] = sc[e.date] || { UL: 0, PC: 0 });
          if (e.unit === 'UL' || e.unit === 'PC') s[e.unit] += Number(e.data.total || 0);
        } else {
          du[e.date] = e;
        }
      });
      return toCsv([
        ['Date', 'Scanned UL', 'Scanned PC', 'Scanned Total', 'Pending Total', 'Pending UL', 'Pending PC', 'Overdue'],
        ...days.map((x) => {
          const s = sc[x] || { UL: 0, PC: 0 };
          const u = du[x];
          return [
            x,
            s.UL,
            s.PC,
            s.UL + s.PC,
            u ? Number(u.data.total || 0) : 0,
            u ? Number(u.data.UL || 0) : 0,
            u ? Number(u.data.PC || 0) : 0,
            u ? Number(u.data.od || 0) : 0,
          ];
        }),
      ]);
    }

    case 'rewash': {
      const eRows = (d.rows as EntryRecord[]) || [];
      const kinds = settings.rewashTypes || [];
      const days = daysOf(from, to);
      const bal: Record<string, number> = {};
      kinds.forEach((k) => {
        bal[k] = d.opening?.[k] || 0;
      });
      const rows: (string | number)[][] = [
        ['Date', ...kinds.flatMap((k) => [`${k} Given`, `${k} Received`, `${k} Balance`])],
      ];
      days.forEach((x) => {
        const de = eRows.filter((e) => e.date === x);
        const row: (string | number)[] = [x];
        kinds.forEach((k) => {
          const g = sumNums(de.filter((e) => e.data.kind === k && e.data.type === 'Given').map((e) => e.data.qty));
          const r = sumNums(de.filter((e) => e.data.kind === k && e.data.type === 'Received').map((e) => e.data.qty));
          bal[k] += g - r;
          row.push(g, r, bal[k]);
        });
        rows.push(row);
      });
      rows.push([]);
      rows.push(['Date', 'Unit', 'Type', 'Given / Received', 'Pcs', 'Done By', 'Time', 'Saved By']);
      eRows.forEach((e) => {
        rows.push([e.date, e.unit, e.data.kind || '', e.data.type || '', Number(e.data.qty || 0), e.data.by || '', e.at, e.by]);
      });
      return toCsv(rows);
    }

    case 'repair': {
      const eRows = (d.rows as EntryRecord[]) || [];
      return toCsv([
        ['Date', 'Unit', 'Store', 'Invoice / Tag', 'Garment', 'Damage', 'Sent To', 'Status', 'Back Date', 'Released Date', 'Note', 'Saved By'],
        ...eRows.map((e) => [
          e.date,
          e.unit,
          e.store,
          e.data.tag || '',
          e.data.garment || '',
          e.data.damage || '',
          e.data.sentTo || '',
          e.data.status || '',
          e.data.backAt || '',
          e.data.releasedAt || '',
          e.data.note || '',
          e.by,
        ]),
      ]);
    }

    case 'lots': {
      const lotRows =
        (d.rows as { key: string; date: string; unit: string; type: string; cleared: number; log: { at: string; by: string; pct: number }[] }[]) ||
        [];
      return toCsv([
        ['Lot Date', 'Unit', 'Type', 'Status', 'Pending Days', 'Cleared At', 'Cleared By'],
        ...lotRows.map((r) => {
          const c = r.log.filter((l) => l.pct >= 100).pop();
          return [
            r.date,
            r.unit,
            r.type === 'Wash' ? 'Washing' : 'Iron',
            r.cleared >= 100 ? 'Cleared' : 'Pending',
            r.cleared >= 100 ? 0 : daysBetween(r.date, today),
            c ? c.at : '',
            c ? c.by : '',
          ];
        }),
      ]);
    }

    case 'wn': {
      const eRows = (d.rows as EntryRecord[]) || [];
      return toCsv([
        ['Date', 'Unit', 'Kind', 'Garment', 'Ironed By', 'Tag', 'Store', 'Invoice', 'Status', 'Adjusted Store', 'Adjusted At', 'Adjusted By'],
        ...eRows.map((e) => [
          e.date,
          e.unit,
          e.data.kind === 'tag' ? 'Detached Tag' : 'WN Garment',
          e.data.garment || '',
          e.data.karigar || '',
          e.data.tag || '',
          e.store || '',
          e.data.inv || '',
          e.data.status || '',
          e.data.adjStore || '',
          e.data.adjAt || '',
          e.data.adjBy || '',
        ]),
      ]);
    }

    case 'saree': {
      const eRows = (d.rows as EntryRecord[]) || [];
      return toCsv([
        ['Date', 'Unit', 'Sent To', 'Sent Qty', 'Status', 'Received Qty', 'Received On', 'Difference', 'Reason', 'Saved By'],
        ...eRows.map((e) => [
          e.date,
          e.unit,
          e.data.to || '',
          Number(e.data.qty || 0),
          e.data.status || '',
          e.data.status === 'Received' ? Number(e.data.recvQty || 0) : '',
          e.data.recvAt || '',
          e.data.diff ?? '',
          e.data.reason || '',
          e.by,
        ]),
      ]);
    }

    case 'iron': {
      const eRows = (d.rows as EntryRecord[]) || [];
      return toCsv([
        ['Date', 'Unit', 'Karigar', 'Points', 'Remarks', 'Time', 'Saved By'],
        ...eRows.map((e) => [e.date, e.unit, e.data.karigar || '', Number(e.data.points || 0), e.data.note || '', e.at, e.by]),
      ]);
    }

    case 'washerr': {
      const eRows = (d.rows as EntryRecord[]) || [];
      return toCsv([
        ['Date', 'Unit', 'Store', 'Tag', 'Garment', 'Damage', 'Severity Points', 'Damage By', 'Details', 'Time', 'Saved By'],
        ...eRows.map((e) => [
          e.date,
          e.unit,
          e.store,
          e.data.tag || '',
          e.data.garment || '',
          e.data.damage || '',
          Number(e.data.points || 0),
          e.data.by || '',
          e.data.note || '',
          e.at,
          e.by,
        ]),
      ]);
    }

    case 'staffErr': {
      const eRows = (d.rows as EntryRecord[]) || [];
      return toCsv([
        ['Date', 'Unit', 'Staff', 'Details', 'Time', 'Saved By'],
        ...eRows.map((e) => [e.date, e.unit, e.data.staff || '', e.data.note || '', e.at, e.by]),
      ]);
    }

    case 'grc': {
      const eRows = (d.rows as EntryRecord[]) || [];
      const stores = uniq([
        ...(settings.stores || []).map((s) => s.code),
        ...eRows.flatMap((e) => Object.keys(e.data.counts || {})),
      ]);
      return toCsv([
        ['Date', 'Unit', ...stores, 'Total', 'Saved By'],
        ...eRows.map((e) => [
          e.date,
          e.unit,
          ...stores.map((s) => Number(e.data.counts?.[s] || 0)),
          Number(e.data.total || 0),
          e.by,
        ]),
      ]);
    }

    case 'spot': {
      const eRows = (d.rows as EntryRecord[]) || [];
      return toCsv([
        ['Date', 'Unit', 'Store', 'Tag', 'Garment', 'Spot Type', 'Removed %', 'Done By', 'Time', 'Saved By'],
        ...eRows.map((e) => [
          e.date,
          e.unit,
          e.store,
          e.data.tag || '',
          e.data.garment || '',
          e.data.spot || '',
          Number(e.data.pct || 0),
          e.data.by || '',
          e.at,
          e.by,
        ]),
      ]);
    }

    case 'quickfix': {
      const eRows = (d.rows as EntryRecord[]) || [];
      return toCsv([
        ['Date', 'Unit', 'Store', 'Tag', 'Garment', 'Repair', 'Type', 'Done By', 'Time', 'Saved By'],
        ...eRows.map((e) => [
          e.date,
          e.unit,
          e.store,
          e.data.tag || '',
          e.data.garment || '',
          e.data.repair || '',
          e.data.kind || '',
          e.data.by || '',
          e.at,
          e.by,
        ]),
      ]);
    }

    case 'meter': {
      const eRows = (d.rows as EntryRecord[]) || [];
      const ms = settings.meters || [];
      const days = daysOf(from, to);
      const by: Record<string, EntryRecord[]> = {};
      eRows.forEach((e) => {
        (by[e.date] = by[e.date] || []).push(e);
      });
      return toCsv([
        ['Date', ...ms.flatMap((m) => [`${m.name} Reading`, `${m.name} Used (${m.measure})`])],
        ...days.map((x) => {
          const row: (string | number)[] = [x];
          ms.forEach((m) => {
            let r = 0;
            let u = 0;
            (by[x] || []).forEach((e) => {
              if (e.data.readings?.[m.name] != null) {
                r = Number(e.data.readings[m.name]);
                u += Number(e.data.used?.[m.name]) || 0;
              }
            });
            row.push(r, Math.round(u * 100) / 100);
          });
          return row;
        }),
      ]);
    }

    case 'boiler': {
      const eRows = (d.rows as EntryRecord[]) || [];
      return toCsv([
        ['Date', 'Unit', 'Boiler', 'Start', 'Stop', 'Minutes', 'Duration', 'Started By'],
        ...eRows.map((e) => [
          e.date,
          e.unit,
          e.data.boiler || '',
          e.data.start || '',
          e.data.stop || 'running',
          Number(e.data.mins || 0),
          e.data.mins ? hm(e.data.mins) : '',
          e.by,
        ]),
      ]);
    }

    default:
      return toCsv([['Info'], ['No CSV export available for this report']]);
  }
}
