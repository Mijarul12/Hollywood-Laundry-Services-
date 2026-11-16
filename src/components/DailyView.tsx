import React, { useEffect, useRef, useState } from 'react';
import {
  DAILY,
  daysBetween,
  DSECTIONS,
  fD,
  fDY,
  fLong,
  getSettingPath,
  hm,
  MODULES,
  n0,
  sumNums,
  T,
} from '../config/workshopConfig';
import type { DailyFieldDef, DailyItemDef } from '../config/workshopConfig';
import type { AutosData, DailyResponse, LangId, UserMe, WorkshopSettings } from '../types/workshop';
import { Chips, DateBar, ModalSheet, Stepper, TopBar } from './CommonUI';
import { Ico } from './Icons';

export function dv(x: unknown): boolean {
  return x !== undefined && x !== null && x !== '' && !(Array.isArray(x) && !x.length);
}

export function dShown(f: DailyFieldDef, data: Record<string, any>, autos: AutosData): boolean {
  if (f.show && data[f.show[0]] !== f.show[1]) return false;
  if (f.when === 'ironZero' && autos.iron.entries > 0) return false;
  return true;
}

export function dNeed(f: DailyFieldDef, data: Record<string, any>, autos: AutosData): boolean {
  if (!dShown(f, data, autos)) return false;
  if (f.need && !f.need(data)) return false;
  return true;
}

export function dItemDone(it: DailyItemDef, data: Record<string, any>, autos: AutosData): boolean {
  if (it.auto === 'iron' && autos.iron.entries > 0) return true;
  return it.f.every((f) => !dNeed(f, data, autos) || dv(data[f.k]));
}

export const GlanceGrid: React.FC<{
  a: AutosData;
  lang: LangId;
  can: (mod: string) => boolean;
  onGo?: (mod: string) => void;
}> = ({ a, lang, can, onGo }) => {
  const rp = a.rp;
  const rounds = Object.keys(rp.done);
  const rk = Object.keys(a.rewash.balance);
  const bk = Object.keys(a.boiler);

  const Card = ({
    mod,
    title,
    val,
    sub,
    cls,
  }: {
    mod: string;
    title: string;
    val: React.ReactNode | null;
    sub?: React.ReactNode;
    cls?: string;
  }) => {
    const icon = MODULES.find((m) => m.id === mod)?.icon || 'daily';
    const clickable = can(mod) && onGo;
    return (
      <button
        type="button"
        className={`gc${val === null ? ' none' : ''}`}
        onClick={clickable ? () => onGo(mod) : undefined}
        style={!clickable ? { cursor: 'default' } : undefined}
      >
        <div className="gt">
          <Ico name={icon} size={16} />
          {T(title, lang)}
        </div>
        <div className={`gv ${cls || ''}`}>{val === null ? 'Not filled' : val}</div>
        {sub ? <div className="gs">{sub}</div> : null}
      </button>
    );
  };

  return (
    <div className="glance">
      <Card
        mod="scan"
        title="Scanned today"
        val={
          a.scan.total ? (
            <>
              {n0(a.scan.total)} <small>{T('pcs', lang)}</small>
            </>
          ) : null
        }
        sub={`UL ${n0(a.scan.UL)} · PC ${n0(a.scan.PC)} · ${a.scan.uploads} file(s)`}
      />
      <Card
        mod="scan"
        title="Pending"
        val={a.due ? n0(a.due.total) : null}
        sub={
          a.due ? (
            <>
              UL {a.due.UL} · PC {a.due.PC}
              {a.due.od ? (
                <>
                  {' '}
                  · <b style={{ color: 'var(--bad)' }}>{a.due.od} overdue</b>
                </>
              ) : (
                ' · no overdue'
              )}
            </>
          ) : (
            'Workshop Out not uploaded'
          )
        }
      />
      <Card
        mod="rp"
        title="Release & Pack"
        val={
          rp.entries ? (
            <>
              {rp.entries} <small>entries</small>
            </>
          ) : null
        }
        sub={
          <>
            {rounds
              .map((r) => {
                const st = rp.done[r];
                const rel = Object.keys(st).filter((s) => st[s].Release).length;
                const pk = Object.keys(st).filter((s) => st[s].Pack).length;
                return `${T(r, lang)}: R${rel} P${pk}`;
              })
              .join(' · ')}
            {rp.people.length > 0 && (
              <>
                <br />
                {rp.people.join(', ')}
              </>
            )}
          </>
        }
      />
      <Card
        mod="iron"
        title="Ironmen Error"
        val={
          a.iron.entries ? (
            <>
              {a.iron.points} <small>pts</small>
            </>
          ) : (
            '0'
          )
        }
        sub={
          Object.keys(a.iron.byK)
            .map((k) => `${k} ${a.iron.byK[k]}`)
            .join(' · ') || 'No entry today'
        }
        cls={a.iron.points ? 'bad' : ''}
      />
      <Card
        mod="rewash"
        title="Rewash"
        val={
          <>
            {sumNums(rk.map((k) => a.rewash.balance[k]))} <small>{T('Balance', lang)}</small>
          </>
        }
        sub={rk.map((k, idx) => {
          const t = a.rewash.today[k] || { Given: 0, Received: 0 };
          return (
            <React.Fragment key={k}>
              {idx > 0 && <br />}
              {T(k, lang)}: +{t.Given} / −{t.Received} → {a.rewash.balance[k]}
            </React.Fragment>
          );
        })}
      />
      <Card
        mod="repair"
        title="Repair"
        val={
          <>
            {a.repair.pending} <small>open</small>
          </>
        }
        sub={`Sent today ${a.repair.sentToday} · back ${a.repair.back}${
          a.repair.oldest ? ` · oldest ${fD(a.repair.oldest)}` : ''
        }`}
      />
      <Card
        mod="washerr"
        title="Washing Error"
        val={String(a.washerr.count)}
        sub={`${a.washerr.points} points`}
        cls={a.washerr.count ? 'bad' : 'ok'}
      />
      <Card
        mod="staffErr"
        title="Staff Error"
        val={String(a.staffErr.count)}
        sub={
          Object.keys(a.staffErr.byStaff)
            .map((k) => `${k} ${a.staffErr.byStaff[k]}`)
            .join(' · ') || 'No error noted'
        }
        cls={a.staffErr.count ? 'bad' : 'ok'}
      />
      <Card
        mod="grc"
        title="GRC Count"
        val={a.grc ? String(a.grc.total) : null}
        sub={
          a.grc
            ? Object.keys(a.grc.counts)
                .map((s) => `${s} ${a.grc!.counts[s]}`)
                .join(' · ')
            : ''
        }
      />
      <Card
        mod="meter"
        title="Electricity & Water"
        val={
          a.meter ? (
            <>
              {Object.keys(a.meter.readings).length} <small>readings</small>
            </>
          ) : null
        }
        sub={
          a.meter
            ? Object.keys(a.meter.readings).map((k, idx) => {
                const u = a.meter!.used[k];
                return (
                  <React.Fragment key={k}>
                    {idx > 0 && <br />}
                    {k}: {u == null ? a.meter!.readings[k] : `used ${u}`}
                  </React.Fragment>
                );
              })
            : ''
        }
      />
      <Card
        mod="boiler"
        title="Boiler"
        val={bk.length ? hm(sumNums(bk.map((k) => a.boiler[k].mins))) : null}
        sub={bk.map((k, idx) => (
          <React.Fragment key={k}>
            {idx > 0 && <br />}
            {k}
            {a.boiler[k].on ? ' ● running' : ''} {hm(a.boiler[k].mins)}
          </React.Fragment>
        ))}
      />
      <Card
        mod="wn"
        title="WN Garments"
        val={
          <>
            {a.wn.adjToday} <small>adjusted</small>
          </>
        }
        sub={
          <>
            {a.wn.adjList.length > 0 && (
              <>
                {a.wn.adjList.join(', ')}
                <br />
              </>
            )}
            New today {a.wn.newToday} · pending: {a.wn.pendingG} garments, {a.wn.pendingT} tags
          </>
        }
      />
      <Card
        mod="saree"
        title="Saree Polish"
        val={
          <>
            {a.saree.pending} <small>at polish</small>
          </>
        }
        sub={
          <>
            Sent today {a.saree.sentToday}
            {a.saree.sentTo.length > 0 && ` (${a.saree.sentTo.join(', ')})`} · received {a.saree.recvToday}
            {a.saree.diffToday.length > 0 && (
              <>
                <br />
                <b style={{ color: 'var(--bad)' }}>Diff: {a.saree.diffToday.join(', ')}</b>
              </>
            )}
            {a.saree.oldest && (
              <>
                <br />
                oldest {fD(a.saree.oldest)}
              </>
            )}
          </>
        }
      />
      <Card
        mod="spot"
        title="Spot Treatment"
        val={String(a.spot.count)}
        sub={a.spot.count ? `Avg removed ${a.spot.avg}%` : ''}
      />
      <Card
        mod="quickfix"
        title="Quick Fix"
        val={String(a.quickfix.count)}
        sub={`QF ${a.quickfix.qf} · IR ${a.quickfix.ir}`}
      />
    </div>
  );
};

export const DailyView: React.FC<{
  me: UserMe;
  settings: WorkshopSettings;
  today: string;
  date: string;
  unit: string;
  lang: LangId;
  dailyData: DailyResponse | null;
  onLang: (l: LangId) => void;
  onBack: () => void;
  onRefresh: () => void;
  onPickUnit: () => void;
  onShiftDate: (delta: number) => void;
  onDateChange: (d: string) => void;
  onGoModule: (mod: string) => void;
  onApi: <T = any>(action: string, p?: Record<string, any>, quiet?: boolean) => Promise<T>;
  onToast: (msg: string, kind?: '' | 'ok' | 'err') => void;
  onAddList: (listPath: string, onAdded?: (val: string) => void) => void;
  onConfirm: (title: string, msg: string, fn: () => void, danger?: boolean) => void;
  onPrintDaily: (days: { unit: string; data: Record<string, any>; meta: any; autos: AutosData }[], date: string) => void;
  onDownloadDailyPdf?: (days: { unit: string; data: Record<string, any>; meta: any; autos: AutosData }[], date: string) => void;
  pdfBusy?: boolean;
}> = ({
  me,
  settings,
  today,
  date,
  unit,
  lang,
  dailyData,
  onLang,
  onBack,
  onRefresh,
  onPickUnit,
  onShiftDate,
  onDateChange,
  onGoModule,
  onApi,
  onToast,
  onAddList,
  onConfirm,
  onPrintDaily,
  onDownloadDailyPdf,
  pdfBusy,
}) => {
  const isMgr = me.role === 'Admin' || me.role === 'Manager';
  const [localData, setLocalData] = useState<Record<string, any>>({});
  const [meta, setMeta] = useState<DailyResponse['meta']>(null);
  const [autos, setAutos] = useState<AutosData | null>(null);
  const [saveState, setSaveState] = useState<'' | 'saving' | 'saved'>('');
  const [rowDrafts, setRowDrafts] = useState<Record<string, Record<string, string>>>({});
  const [lotModalType, setLotModalType] = useState<'Wash' | 'Iron' | null>(null);
  const [lotModalDate, setLotModalDate] = useState(date);
  const [onlyRemaining, setOnlyRemaining] = useState(false);

  const patchRef = useRef<Record<string, any>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDataRef = useRef<Record<string, any>>({});

  useEffect(() => {
    if (dailyData) {
      setLocalData(dailyData.data || {});
      latestDataRef.current = dailyData.data || {};
      setMeta(dailyData.meta);
      setAutos(dailyData.autos);
      patchRef.current = {};
      setSaveState('');
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [dailyData]);

  const flushSave = async () => {
    const patch = { ...patchRef.current };
    patchRef.current = {};
    if (!Object.keys(patch).length || !autos) return;
    const doneCount = DAILY.filter((it) => dItemDone(it, latestDataRef.current, autos)).length;
    try {
      await onApi(
        'daily.save',
        {
          date: dailyData?.date || date,
          patch,
          filled: doneCount,
          total: DAILY.length,
        },
        true
      );
      setSaveState('saved');
    } catch {
      Object.keys(patch).forEach((k) => {
        if (patchRef.current[k] === undefined) patchRef.current[k] = patch[k];
      });
      setSaveState('');
    }
  };

  const queuePatch = (key: string, val: any, fast = false) => {
    const curDate = dailyData?.date || date;
    if ((meta?.submitted || curDate < today) && !isMgr) return;
    const nextData = { ...latestDataRef.current };
    if (val === '' || val === null) delete nextData[key];
    else nextData[key] = val;
    latestDataRef.current = nextData;
    setLocalData(nextData);
    patchRef.current[key] = val === '' ? null : val;
    setSaveState('saving');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      flushSave();
    }, fast ? 250 : 900);
  };

  if (!dailyData || !autos) {
    return (
      <>
        <TopBar
          title={T('Daily Report', lang)}
          sub=""
          back
          lang={lang}
          onLang={onLang}
          me={me}
          unit={unit}
          onBack={onBack}
          onRefresh={onRefresh}
          onPickUnit={onPickUnit}
        />
        <main>
          <div className="empty">
            <div className="spin" />
          </div>
        </main>
      </>
    );
  }

  const dDate = dailyData.date;
  const locked = !isMgr && (!!meta?.submitted || dDate < today);
  const doneTotal = DAILY.filter((it) => dItemDone(it, localData, autos)).length;
  const missBySection: Record<string, number> = {};
  DAILY.forEach((it) => {
    if (!dItemDone(it, localData, autos)) {
      missBySection[it.s] = (missBySection[it.s] || 0) + 1;
    }
  });

  const handleLotUpdate = async (lotKey: string, pct: number) => {
    const r = await onApi('lot.update', { date: dDate, lot: lotKey, pct });
    setAutos((prev) => (prev ? { ...prev, lots: r } : prev));
    onToast(pct ? `✓ ${T('Cleared', lang)}` : 'Undone', pct ? 'ok' : '');
  };

  const handleCreateLot = async () => {
    if (!lotModalType || !lotModalDate) return;
    const r = await onApi('lot.create', { date: dDate, type: lotModalType, lotDate: lotModalDate });
    setAutos((prev) => (prev ? { ...prev, lots: r } : prev));
    setLotModalType(null);
    onToast(`✓ ${T('Add lot', lang)} ${fD(lotModalDate)}`, 'ok');
  };

  const handleRowAdd = async (f: DailyFieldDef) => {
    const draft = rowDrafts[f.k] || {};
    const row: Record<string, string> = {};
    for (const c of f.cols || []) {
      const v = (draft[c.k] || '').trim();
      if (!v) {
        onToast('Fill all boxes', 'err');
        return;
      }
      row[c.k] = v;
    }
    const r = await onApi<{ rows: Record<string, any>[] }>('daily.row', { date: dDate, key: f.k, row });
    const nextData = { ...latestDataRef.current, [f.k]: r.rows };
    latestDataRef.current = nextData;
    setLocalData(nextData);
    setRowDrafts((prev) => ({ ...prev, [f.k]: {} }));
    const lastRow = r.rows[r.rows.length - 1];
    onToast(
      `✓ ${T('Saved', lang)}${lastRow?.mail && /:/.test(lastRow.mail) ? ' · email sent' : ''}`,
      'ok'
    );
  };

  const handleRowDel = (key: string, idx: number) => {
    onConfirm(
      `${T('Delete', lang)}?`,
      '',
      async () => {
        const r = await onApi<{ rows: Record<string, any>[] }>('daily.rowdel', { date: dDate, key, idx });
        const nextData = { ...latestDataRef.current, [key]: r.rows };
        latestDataRef.current = nextData;
        setLocalData(nextData);
      },
      true
    );
  };

  const handleSubmitReport = () => {
    const miss: number[] = [];
    DAILY.forEach((it, idx) => {
      if (!dItemDone(it, localData, autos)) miss.push(idx + 1);
    });
    if (miss.length) {
      onToast(`${T('Fill all points first', lang)}: ${miss.join(', ')}`, 'err');
      document.getElementById(`q_${miss[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    onConfirm(
      T('Submit report', lang),
      `${fLong(dDate)} (${dailyData.unit})?`,
      async () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        const patch = { ...patchRef.current };
        patchRef.current = {};
        const r = await onApi<{ submitted: string }>('daily.save', {
          date: dDate,
          patch,
          submit: true,
          filled: doneTotal,
          total: DAILY.length,
        });
        setMeta((prev) => ({
          filled: doneTotal,
          total: DAILY.length,
          by: me.name,
          ...(prev || {}),
          submitted: r.submitted,
        }));
        setSaveState('saved');
        onToast(`✓ ${T('Submitted', lang)}`, 'ok');
      },
      false
    );
  };

  const officeTeam = settings.teams.office || [];
  const storeCodes = settings.stores.map((s) => s.code);

  const renderField = (f: DailyFieldDef) => {
    if (!dShown(f, localData, autos)) return null;
    const val = localData[f.k];
    const need = dNeed(f, localData, autos) && !dv(val);
    const wide = ['text', 'rows', 'staffm', 'staff', 'store'].includes(f.t);

    if (f.t === 'rows') {
      const list: Record<string, any>[] = Array.isArray(val) ? val : [];
      const draft = rowDrafts[f.k] || {};
      return (
        <div key={f.k} className={`rowsbox${need ? ' need' : ''}`} id={`fw_${f.k}`}>
          <div className="flex between">
            <b style={{ fontSize: 14 }}>
              {T(f.l, lang)} ({list.length})
            </b>
            {f.mail && <span className="badge b-gold">✉ {f.mail}</span>}
          </div>
          {list.length > 0 && (
            <div className="tw">
              <table className="tbl sm mt">
                <thead>
                  <tr>
                    {(f.cols || []).map((c) => (
                      <th key={c.k}>{T(c.l, lang)}</th>
                    ))}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {list.map((r, idx) => (
                    <tr key={idx}>
                      {(f.cols || []).map((c) => (
                        <td key={c.k}>{c.t === 'date' ? fDY(r[c.k]) : r[c.k]}</td>
                      ))}
                      <td className="n" style={{ whiteSpace: 'nowrap' }}>
                        <small>
                          {r.addedBy || ''} {r.at || ''}
                          {r.mail ? ' ✉' : ''}
                        </small>
                        {isMgr && (
                          <button type="button" className="ibtn" onClick={() => handleRowDel(f.k, idx)}>
                            <Ico name="trash" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!locked && (
            <div className="rowform mt">
              {(f.cols || []).map((c) => {
                const cur = draft[c.k] || '';
                const setCol = (v: string) =>
                  setRowDrafts((prev) => ({
                    ...prev,
                    [f.k]: { ...(prev[f.k] || {}), [c.k]: c.caps ? v.toUpperCase() : v },
                  }));
                if (c.t === 'text') {
                  return (
                    <div key={c.k}>
                      <label className="lbl">{T(c.l, lang)}</label>
                      <input value={cur} onChange={(e) => setCol(e.target.value)} />
                    </div>
                  );
                }
                if (c.t === 'date') {
                  return (
                    <div key={c.k}>
                      <label className="lbl">{T(c.l, lang)}</label>
                      <input type="date" max={today} value={cur} onChange={(e) => setCol(e.target.value)} />
                    </div>
                  );
                }
                const opts =
                  c.t === 'staff'
                    ? officeTeam
                    : c.t === 'store'
                    ? storeCodes
                    : (getSettingPath(settings, c.src || '') as string[]) || [];
                return (
                  <div key={c.k}>
                    <label className="lbl">{T(c.l, lang)}</label>
                    <select value={cur} onChange={(e) => setCol(e.target.value)}>
                      <option value="">—</option>
                      {opts.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
              <div>
                <button
                  type="button"
                  className="btn sm gold"
                  style={{ marginTop: 8 }}
                  onClick={() => handleRowAdd(f)}
                >
                  <Ico name="plus" /> {T('Add', lang)}
                  {f.mail ? ' & email' : ''}
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div key={f.k} className={`fw${need ? ' need' : ''}${wide ? ' wide' : ''}`} id={`fw_${f.k}`}>
        <label className="lbl">{T(f.l, lang)}</label>
        {f.t === 'num' && (
          <div className="flex">
            <Stepper cls="sm" value={val} onChange={(n) => queuePatch(f.k, n, true)} />
            <button
              type="button"
              className={`chip zero${val === 0 ? ' on' : ''}`}
              onClick={() => queuePatch(f.k, 0, true)}
            >
              0 · none
            </button>
          </div>
        )}
        {f.t === 'yn' && (
          <div className="seg">
            {(['Yes', 'No'] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                className={val === opt ? (opt === 'Yes' ? 'yes' : 'no') : ''}
                onClick={() => queuePatch(f.k, opt, true)}
              >
                {T(opt, lang)}
              </button>
            ))}
          </div>
        )}
        {f.t === 'text' && (
          <textarea
            rows={1}
            placeholder={T(f.l, lang)}
            value={val || ''}
            onChange={(e) => queuePatch(f.k, e.target.value, false)}
          />
        )}
        {f.t === 'staff' && (
          <Chips
            list={officeTeam}
            value={val || ''}
            onToggle={(v) => queuePatch(f.k, val === v ? '' : v, true)}
            canAdd
            onAdd={() => onAddList('teams.office')}
            lang={lang}
          />
        )}
        {f.t === 'staffm' && (
          <Chips
            list={officeTeam}
            value={Array.isArray(val) ? val : []}
            multi
            onToggle={(v) => {
              const arr: string[] = Array.isArray(val) ? [...val] : [];
              const idx = arr.indexOf(v);
              if (idx >= 0) arr.splice(idx, 1);
              else arr.push(v);
              queuePatch(f.k, arr, true);
            }}
            canAdd
            onAdd={() => onAddList('teams.office')}
            lang={lang}
          />
        )}
        {f.t === 'store' && (
          <Chips
            list={storeCodes}
            value={val || ''}
            onToggle={(v) => queuePatch(f.k, val === v ? '' : v, true)}
            lang={lang}
          />
        )}
      </div>
    );
  };

  let runningNum = 0;

  return (
    <>
      <TopBar
        title={T('Daily Report', lang)}
        sub={`${fLong(dDate)} · ${dailyData.unit}`}
        back
        lang={lang}
        onLang={onLang}
        me={me}
        unit={unit}
        onBack={onBack}
        onRefresh={onRefresh}
        onPickUnit={onPickUnit}
      />
      <main>
        <DateBar
          date={dDate}
          today={today}
          isMgr={isMgr}
          lang={lang}
          onShift={onShiftDate}
          onDateChange={onDateChange}
        />

        {meta?.submitted && (
          <div
            className="card mb0"
            style={{ background: 'var(--okbg)', color: 'var(--ok)', fontWeight: 800, marginBottom: 12 }}
          >
            ✓ {T('Submitted', lang)} — {meta.submitted}
            {locked ? ` · ${T('Locked after saving', lang)}` : ''}
          </div>
        )}

        <div className="dnav">
          <button
            type="button"
            className={!onlyRemaining ? 'on' : ''}
            onClick={() => setOnlyRemaining(false)}
          >
            All ({DAILY.length})
          </button>
          <button
            type="button"
            className={onlyRemaining ? 'on' : ''}
            onClick={() => setOnlyRemaining(true)}
          >
            Remaining ({DAILY.length - doneTotal})
          </button>
          <button type="button" onClick={() => document.getElementById('sec_G')?.scrollIntoView({ behavior: 'smooth' })}>
            {T('Today at a glance', lang)}
          </button>
          <button type="button" onClick={() => document.getElementById('sec_L')?.scrollIntoView({ behavior: 'smooth' })}>
            {T('Lots', lang)}
          </button>
          {DSECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={missBySection[s.id] ? '' : 'full'}
              onClick={() => document.getElementById(`sec_${s.id}`)?.scrollIntoView({ behavior: 'smooth' })}
            >
              {T(s.t, lang)}
              <span>{missBySection[s.id] ? `· ${missBySection[s.id]}` : '✓'}</span>
            </button>
          ))}
        </div>

        <section className="dsec" id="sec_G">
          <div className="h2">
            {T('Today at a glance', lang)}
            <span className="cnt">auto from other screens</span>
          </div>
          <GlanceGrid
            a={autos}
            lang={lang}
            can={(m) => me.modules.includes(m)}
            onGo={onGoModule}
          />
        </section>

        <section className="dsec" id="sec_L">
          <div className="h2">{T('Lots', lang)}</div>
          <div className="card">
            <div className="g2d">
              {(['Wash', 'Iron'] as const).map((lotType) => {
                const info = autos.lots[lotType] || { pending: [], today: [] };
                const doneToday = info.today.filter((o) => o.cleared >= 100);
                return (
                  <div className="lotcol" key={lotType}>
                    <div className="flex between">
                      <b style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Ico name={lotType === 'Wash' ? 'wash' : 'iron'} size={18} />
                        {T(lotType === 'Wash' ? 'Washing lot' : 'Iron lot', lang)}
                      </b>
                      <span className={`badge ${info.pending.length ? 'b-warn' : 'b-ok'}`}>
                        {T('Pending', lang)} {info.pending.length}
                      </span>
                    </div>
                    {!info.pending.length && (
                      <div className="lotb">
                        <small>✓ All cleared</small>
                      </div>
                    )}
                    {info.pending.map((l) => {
                      const late = daysBetween(l.date, dDate);
                      const nm = fD(l.date) + (l.name.includes('#') ? ` ${l.name.split(' ')[1]}` : '');
                      return (
                        <div className="lotb" key={l.key}>
                          <div className="lt">
                            <b>{nm}</b>
                            {late > 0 ? (
                              <small style={{ color: 'var(--bad)' }}>
                                {late} {T('days', lang)} pending
                              </small>
                            ) : (
                              <small>{T('Today', lang)}</small>
                            )}
                            {!locked && (
                              <button
                                type="button"
                                className="btn sm ok"
                                onClick={() => handleLotUpdate(l.key, 100)}
                              >
                                ✓ {T('Cleared', lang)}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {doneToday.length > 0 && (
                      <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                        ✓ {T('Cleared', lang)} today:{' '}
                        {doneToday.map((o, idx) => (
                          <React.Fragment key={o.key}>
                            {idx > 0 && ' · '}
                            {fD(o.name)} {o.at} {o.by}
                            {isMgr && !locked && (
                              <>
                                {' '}
                                <button
                                  type="button"
                                  style={{ color: 'var(--gold)', fontWeight: 700, textDecoration: 'underline' }}
                                  onClick={() => handleLotUpdate(o.key, 0)}
                                >
                                  undo
                                </button>
                              </>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                    {!locked && (
                      <button
                        type="button"
                        className="chip add mt"
                        onClick={() => {
                          setLotModalDate(dDate);
                          setLotModalType(lotType);
                        }}
                      >
                        + {T('Add lot', lang)} (pending date)
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {onlyRemaining && doneTotal === DAILY.length && (
          <div className="card mt" style={{ textAlign: 'center', padding: '24px 16px', background: 'var(--okbg)', color: 'var(--ok)' }}>
            <b style={{ fontSize: 16 }}>✓ All {DAILY.length} daily report points completed</b>
            <div className="mt">
              <button type="button" className="btn ghost sm" onClick={() => setOnlyRemaining(false)}>
                Show all points
              </button>
            </div>
          </div>
        )}

        {DSECTIONS.map((s) => {
          const allItems = DAILY.filter((it) => it.s === s.id);
          const numberedItems = allItems.map((it) => {
            runningNum += 1;
            const done = dItemDone(it, localData, autos);
            return { it, num: runningNum, done };
          });
          const visibleItems = onlyRemaining ? numberedItems.filter((x) => !x.done) : numberedItems;
          if (!visibleItems.length) return null;
          return (
            <section className="dsec" id={`sec_${s.id}`} key={s.id}>
              <div className="h2">
                {T(s.t, lang)}
                <span className="cnt">
                  {allItems.length - (missBySection[s.id] || 0)}/{allItems.length}
                </span>
              </div>
              <div
                className="card tight"
                style={locked ? { pointerEvents: 'none', opacity: 0.85 } : undefined}
              >
                {visibleItems.map(({ it, num, done }) => {
                  const prevRows =
                    it.carry && Array.isArray(dailyData.prev?.[it.carry]) ? dailyData.prev[it.carry] : [];
                  return (
                    <div className={`dq ${done ? 'done' : 'todo'}`} id={`q_${num}`} key={it.l}>
                      <div className="qt">
                        <span className="no">{done ? '✓' : num}</span>
                        <b>{T(it.l, lang)}</b>
                      </div>
                      <div className="qa">
                        {it.auto === 'wn' && (
                          <div className="autoline">
                            <Ico name="tag" size={14} /> Adjusted today <b>{autos.wn.adjToday}</b>
                            {autos.wn.adjList.length ? `: ${autos.wn.adjList.join(', ')}` : ''} · still pending{' '}
                            <b>{autos.wn.pendingG}</b> garments, <b>{autos.wn.pendingT}</b> tags — fill in the WN
                            Garments screen
                          </div>
                        )}
                        {it.auto === 'saree' && (
                          <div className="autoline">
                            <Ico name="saree" size={14} /> Sent today <b>{autos.saree.sentToday}</b>
                            {autos.saree.sentTo.length ? ` (${autos.saree.sentTo.join(', ')})` : ''} · received{' '}
                            <b>{autos.saree.recvToday}</b>
                            {autos.saree.diffToday.length > 0 && (
                              <>
                                {' '}
                                · <b style={{ color: 'var(--bad)' }}>difference: {autos.saree.diffToday.join(', ')}</b>
                              </>
                            )}{' '}
                            · at polish <b>{autos.saree.pending}</b> — fill in the Saree Polish screen
                          </div>
                        )}
                        {it.auto === 'iron' && (
                          <div className="autoline">
                            {autos.iron.entries
                              ? `✓ ${autos.iron.entries} entries · ${autos.iron.points} points`
                              : 'No ironmen error entered today'}
                          </div>
                        )}
                        {prevRows.length > 0 && (
                          <div className="prevnote">
                            Yesterday: {prevRows.length} noted —{' '}
                            {prevRows.map((r: any) => r.inv || r.st || '').join(', ')}. Check if still open.
                          </div>
                        )}
                        {it.f.map(renderField)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>

      <div className="savebar">
        <div className="row">
          <span className={`pill ${saveState}`} id="dpill">
            {saveState === 'saving'
              ? T('Saving…', lang)
              : saveState === 'saved'
              ? `✓ ${T('Saved', lang)}`
              : 'Auto-save'}
          </span>
          <div className="prog">
            <i style={{ width: `${Math.round((doneTotal / DAILY.length) * 100)}%` }} />
          </div>
          <b style={{ fontSize: 14 }}>
            {doneTotal}/{DAILY.length}
          </b>
          {!locked && (
            <button
              type="button"
              className={`btn btn-save ${meta?.submitted ? 'ghost' : 'gold'}`}
              onClick={handleSubmitReport}
            >
              <Ico name="check" /> {T(meta?.submitted ? 'Submitted' : 'Submit report', lang)}
            </button>
          )}
          {isMgr && (
            <>
              {onDownloadDailyPdf && (
                <button
                  type="button"
                  className="ibtn"
                  title="Download PDF"
                  aria-label="Download PDF"
                  disabled={pdfBusy}
                  onClick={async () => {
                    if (timerRef.current) clearTimeout(timerRef.current);
                    await flushSave();
                    onDownloadDailyPdf([{ unit: dailyData.unit, data: latestDataRef.current, meta, autos }], dDate);
                  }}
                >
                  <Ico name="pdf" />
                </button>
              )}
              <button
                type="button"
                className="ibtn"
                title="Print"
                aria-label="Print"
                onClick={async () => {
                  if (timerRef.current) clearTimeout(timerRef.current);
                  await flushSave();
                  onPrintDaily([{ unit: dailyData.unit, data: latestDataRef.current, meta, autos }], dDate);
                }}
              >
                <Ico name="print" />
              </button>
            </>
          )}
        </div>
      </div>

      <ModalSheet open={!!lotModalType} onClose={() => setLotModalType(null)}>
        {lotModalType && (
          <>
            <b style={{ fontSize: 18 }}>
              {T('Add lot', lang)} · {T(lotModalType === 'Wash' ? 'Washing lot' : 'Iron lot', lang)}
            </b>
            <label className="lbl mt">Lot date</label>
            <input type="date" max={today} value={lotModalDate} onChange={(e) => setLotModalDate(e.target.value)} />
            <div className="flex mt2">
              <button type="button" className="btn ghost" onClick={() => setLotModalType(null)}>
                {T('Cancel', lang)}
              </button>
              <button type="button" className="btn gold grow" onClick={handleCreateLot}>
                <Ico name="plus" /> {T('Add lot', lang)}
              </button>
            </div>
          </>
        )}
      </ModalSheet>
    </>
  );
};
