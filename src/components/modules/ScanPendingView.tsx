import React, { useRef, useState } from 'react';
import { parseExcelFile, type ParsedDue, type ParsedScan } from '../../api/client';
import { daysBetween, fD, fLong, n0, T } from '../../config/workshopConfig';
import type { EntryRecord, ModuleResponse } from '../../types/workshop';
import { canUserDeleteEntry, DateBar, TopBar } from '../CommonUI';
import { Ico } from '../Icons';
import type { ModuleViewProps } from './ReleasePackView';

export const ScanPendingView: React.FC<ModuleViewProps> = ({
  me,
  today,
  date,
  unit,
  lang,
  modData,
  onLang,
  onBack,
  onRefresh,
  onPickUnit,
  onShiftDate,
  onDateChange,
  onApi,
  onUpdateModData,
  onToast,
  onConfirm,
  onLoading,
}) => {
  const isMgr = me.role === 'Admin' || me.role === 'Manager';
  const [uploadUnit, setUploadUnit] = useState(unit);
  const [pickKind, setPickKind] = useState<'scan' | 'due'>('scan');
  const [preview, setPreview] = useState<ParsedScan | ParsedDue | null>(null);
  const [glScope, setGlScope] = useState<'till' | 'all'>('till');
  const [glUnit, setGlUnit] = useState<'All' | 'UL' | 'PC'>('All');
  const [glQuery, setGlQuery] = useState('');
  const [glLimit, setGlLimit] = useState(60);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!modData) {
    return (
      <>
        <TopBar
          title={T('Scanned & Pending', lang)}
          sub={`${fLong(date)} · ${unit}`}
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
          <DateBar date={date} today={today} isMgr={isMgr} lang={lang} onShift={onShiftDate} onDateChange={onDateChange} />
          <div className="empty">
            <div className="spin" />
          </div>
        </main>
      </>
    );
  }

  const scans = modData.rows.filter((e) => e.mod === 'scan');
  const dues = modData.rows.filter((e) => e.mod === 'due');
  const due = dues.length ? dues[dues.length - 1] : null;
  const tot: Record<string, number> = { UL: 0, PC: 0 };
  scans.forEach((e) => {
    tot[e.unit] = (tot[e.unit] || 0) + Number(e.data.total || 0);
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    onLoading?.(true, `⏳ ${T('Reading file… please wait', lang)}`);
    try {
      const parsed = await parseExcelFile(file, pickKind, uploadUnit);
      setPreview(parsed);
    } catch (err: any) {
      onToast(String(err?.message || err), 'err');
    } finally {
      onLoading?.(false);
    }
  };

  const handleConfirmSave = async () => {
    if (!preview) return;
    if (preview.kind === 'scan') {
      const r = await onApi<ModuleResponse>('scan.upload', {
        unit: preview.unit,
        date,
        stores: preview.stores,
        notes: preview.notes,
        fileTotal: preview.fileTotal,
      });
      onUpdateModData(r);
      onToast(`✓ ${preview.unit} · ${preview.total} ${T('pcs', lang)} ${T('Saved', lang)}`, 'ok');
      setPreview(null);
    } else {
      const r = await onApi<ModuleResponse>('due.upload', {
        date,
        items: preview.items,
      });
      onUpdateModData(r);
      onToast(`✓ ${preview.items.length} garments`, 'ok');
      setPreview(null);
    }
  };

  const handleDelete = (e: EntryRecord) => {
    onConfirm(
      `${T('Delete', lang)}?`,
      e.summary,
      async () => {
        const r = await onApi<ModuleResponse>('e.del', { id: e.id, mod: 'scan', date: e.date });
        onUpdateModData(r);
      },
      true
    );
  };

  const qLower = glQuery.trim().toLowerCase();
  const dueListFiltered = (modData.list || []).filter(
    (r) =>
      (glScope === 'all' || !r[0] || r[0] <= date) &&
      (glUnit === 'All' || r[5] === glUnit) &&
      (!qLower || r.join(' ').toLowerCase().includes(qLower))
  );

  return (
    <>
      <TopBar
        title={T('Scanned & Pending', lang)}
        sub={`${fLong(date)} · ${unit}`}
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
        <DateBar date={date} today={today} isMgr={isMgr} lang={lang} onShift={onShiftDate} onDateChange={onDateChange} />

        <input
          ref={fileRef}
          type="file"
          accept=".xls,.xlsx,.csv"
          className="hide"
          onChange={handleFileChange}
        />

        <div className="h2" style={{ marginTop: 4 }}>
          {T('Scanned today', lang)}
        </div>
        <div className="grid g3">
          <div className="kpi UL">
            <div className="l">UL</div>
            <div className="v">{n0(tot.UL)}</div>
          </div>
          <div className="kpi PC">
            <div className="l">PC</div>
            <div className="v">{n0(tot.PC)}</div>
          </div>
          <div className="kpi">
            <div className="l">{T('Total', lang)}</div>
            <div className="v">{n0(tot.UL + tot.PC)}</div>
          </div>
        </div>

        <div className="card mt">
          {preview && preview.kind === 'scan' ? (
            <div className="preview card mb0" style={{ boxShadow: 'none' }}>
              <div className="steph">
                {T('Check and confirm', lang)} ·{' '}
                <span className={`badge b-${preview.unit}`}>{preview.unit}</span>
              </div>
              <small>
                {preview.name} · {preview.sheets} store sheets · {preview.notes.length} delivery notes
              </small>
              <table className="tbl mt">
                <thead>
                  <tr>
                    <th>{T('Store', lang)}</th>
                    <th className="n">{T('pcs', lang)}</th>
                    <th className="n">File says</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(preview.stores).map((s) => {
                    const f = preview.fileBy[s];
                    return (
                      <tr key={s}>
                        <td>
                          <b>{s}</b>
                        </td>
                        <td className="n">{preview.stores[s]}</td>
                        <td
                          className="n"
                          style={{ color: f && f !== preview.stores[s] ? 'var(--bad)' : 'var(--muted)' }}
                        >
                          {f || ''}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="tot">
                    <td>
                      {T('Total', lang)} → {preview.unit}
                    </td>
                    <td className="n">{preview.total}</td>
                    <td className="n">{preview.fileTotal || ''}</td>
                  </tr>
                </tbody>
              </table>
              {!preview.fileTotal || preview.fileTotal === preview.total ? (
                <div className="who mt">✓ Counted = file total</div>
              ) : (
                <div className="who mt" style={{ background: 'var(--badbg)', color: 'var(--bad)' }}>
                  ⚠ Counted {preview.total} but file says {preview.fileTotal}
                </div>
              )}
              <div className="flex mt" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="btn ghost" style={{ minHeight: 44, height: 44 }} onClick={() => setPreview(null)}>
                  {T('Cancel', lang)}
                </button>
                <button type="button" className="btn gold btn-save" onClick={handleConfirmSave}>
                  <Ico name="check" /> {T('Confirm & save', lang)}
                </button>
              </div>
            </div>
          ) : (
            (date === today || isMgr) && (
              <>
                <label className="lbl">{T('This file is', lang)}</label>
                <div className="seg">
                  {me.units.map((u) => (
                    <button
                      key={u}
                      type="button"
                      className={uploadUnit === u ? 'on' : ''}
                      onClick={() => setUploadUnit(u)}
                    >
                      {u} scan
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="drop mt"
                  onClick={() => {
                    setPickKind('scan');
                    fileRef.current?.click();
                  }}
                >
                  <Ico name="up" />
                  <b>
                    {T('Upload scanned file', lang)} · {uploadUnit}
                  </b>
                  <small>Delivery Note Summary (.xls) — every store sheet is counted</small>
                </button>
              </>
            )
          )}

          {scans.length > 0 && (
            <div className="list mt">
              {scans
                .slice()
                .reverse()
                .map((e) => (
                  <div className="li" key={e.id}>
                    <span className={`badge b-${e.unit}`}>{e.unit}</span>
                    <div className="main">
                      <b>
                        {n0(e.data.total)} {T('pcs', lang)} · {Object.keys(e.data.stores || {}).length} stores
                      </b>
                      <small>
                        {Object.keys(e.data.stores || {})
                          .map((s) => `${s} ${e.data.stores[s]}`)
                          .join(' · ')}
                        <br />
                        {e.at} · {e.by} · {(e.data.notes || []).length} delivery notes
                      </small>
                    </div>
                    {canUserDeleteEntry(e, me) && (
                      <button type="button" className="ibtn" onClick={() => handleDelete(e)}>
                        <Ico name="trash" />
                      </button>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="h2">
          {T('Pending', lang)} · Workshop Out
          {due && (
            <span className="cnt">
              updated {due.data.time || due.at} · {due.by}
            </span>
          )}
        </div>

        {due && (
          <div className="grid g2 g4m">
            <div className="kpi">
              <div className="l">{T('Total', lang)}</div>
              <div className="v">{n0(due.data.total)}</div>
            </div>
            <div className="kpi UL">
              <div className="l">UL</div>
              <div className="v">{n0(due.data.UL)}</div>
            </div>
            <div className="kpi PC">
              <div className="l">PC</div>
              <div className="v">{n0(due.data.PC)}</div>
            </div>
            <div className="kpi bad">
              <div className="l">{T('Overdue', lang)}</div>
              <div className="v">{n0(due.data.od)}</div>
              <div className="s">
                UL {due.data.odUL} · PC {due.data.odPC}
              </div>
            </div>
          </div>
        )}

        <div className="card mt">
          {preview && preview.kind === 'due' ? (
            <div className="preview card mb0" style={{ boxShadow: 'none' }}>
              <div className="steph">{T('Check and confirm', lang)}</div>
              <small>{preview.name}</small>
              <div className="grid g2 mt">
                <div className="kpi">
                  <div className="l">Garments</div>
                  <div className="v">{preview.items.length}</div>
                </div>
                <div className="kpi bad">
                  <div className="l">{T('Overdue', lang)}</div>
                  <div className="v">
                    {preview.items.filter((x) => x.due && x.due < date).length}
                  </div>
                </div>
              </div>
              <div className="flex mt" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="btn ghost" style={{ minHeight: 44, height: 44 }} onClick={() => setPreview(null)}>
                  {T('Cancel', lang)}
                </button>
                <button type="button" className="btn gold btn-save" onClick={handleConfirmSave}>
                  <Ico name="check" /> {T('Confirm & save', lang)}
                </button>
              </div>
            </div>
          ) : (
            (date === today || isMgr) && (
              <button
                type="button"
                className="drop"
                onClick={() => {
                  setPickKind('due');
                  fileRef.current?.click();
                }}
              >
                <Ico name="up" />
                <b>{T('Upload Workshop Out file', lang)}</b>
                <small>Can be uploaded many times a day — the latest one is shown</small>
              </button>
            )
          )}

          {isMgr && dues.length > 1 && (
            <div className="list mt">
              {dues
                .slice()
                .reverse()
                .map((e) => (
                  <div className="li" key={e.id}>
                    <div className="main">
                      <b>
                        {e.at} · {n0(e.data.total)} pcs
                      </b>
                      <small>
                        UL {e.data.UL} · PC {e.data.PC} · overdue {e.data.od} · {e.by}
                      </small>
                    </div>
                    <button type="button" className="ibtn" onClick={() => handleDelete(e)}>
                      <Ico name="trash" />
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>

        {due && (
          <div className="cols2">
            <div className="card">
              <div className="steph">
                {T('Due date-wise', lang)}{' '}
                <small className="muted" style={{ fontWeight: 600 }}>
                  oldest first
                </small>
              </div>
              <div className="tw">
                <table className="tbl mt">
                  <thead>
                    <tr>
                      <th>Due date</th>
                      <th className="n">UL</th>
                      <th className="n">PC</th>
                      <th className="n">{T('Total', lang)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(due.data.byDate || {})
                      .sort()
                      .map((k) => {
                        const b = due.data.byDate[k];
                        const late = k && k < date;
                        return (
                          <tr key={k} className={late ? 'od' : k === date ? 'td' : ''}>
                            <td>
                              <b>{k ? fD(k) : '—'}</b>
                              {late ? (
                                <small style={{ color: 'var(--bad)' }}>
                                  {' '}
                                  {daysBetween(k, date)}d late
                                </small>
                              ) : k === date ? (
                                <small> today</small>
                              ) : null}
                            </td>
                            <td className="n">{b.UL || ''}</td>
                            <td className="n">{b.PC || ''}</td>
                            <td className="n">
                              <b>{(b.UL || 0) + (b.PC || 0)}</b>
                            </td>
                          </tr>
                        );
                      })}
                    <tr className="tot">
                      <td>{T('Total', lang)}</td>
                      <td className="n">{due.data.UL}</td>
                      <td className="n">{due.data.PC}</td>
                      <td className="n">{due.data.total}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <div className="steph">{T('Store-wise', lang)}</div>
              <div className="tw">
                <table className="tbl mt">
                  <thead>
                    <tr>
                      <th>{T('Store', lang)}</th>
                      <th className="n">UL</th>
                      <th className="n">PC</th>
                      <th className="n">{T('Overdue', lang)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(due.data.byStore || {})
                      .sort()
                      .map((s) => {
                        const b = due.data.byStore[s];
                        return (
                          <tr key={s}>
                            <td>
                              <b>{s}</b>
                            </td>
                            <td className="n">{b.UL || ''}</td>
                            <td className="n">{b.PC || ''}</td>
                            <td className="n" style={{ color: 'var(--bad)', fontWeight: 800 }}>
                              {b.od || ''}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {modData.list && modData.list.length > 0 && (
          <>
            <div className="h2">
              {T('Garments due till today', lang)}
              <span className="cnt">{dueListFiltered.length} pcs</span>
            </div>
            <div className="card">
              <div className="flex wrap" style={{ gap: 8 }}>
                <div className="seg">
                  {(
                    [
                      ['till', 'Till today'],
                      ['all', 'All'],
                    ] as const
                  ).map(([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      style={{ minWidth: 0 }}
                      className={glScope === v ? 'on' : ''}
                      onClick={() => {
                        setGlScope(v);
                        setGlLimit(60);
                      }}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <div className="seg">
                  {(['All', 'UL', 'PC'] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      style={{ minWidth: 0 }}
                      className={glUnit === u ? 'on' : ''}
                      onClick={() => {
                        setGlUnit(u);
                        setGlLimit(60);
                      }}
                    >
                      {u}
                    </button>
                  ))}
                </div>
                <input
                  style={{ flex: 1, minWidth: 150 }}
                  placeholder={`${T('Search', lang)} — barcode, store, garment`}
                  value={glQuery}
                  onChange={(e) => {
                    setGlQuery(e.target.value);
                    setGlLimit(60);
                  }}
                />
              </div>
              <div className="tw">
                <table className="tbl sm mt">
                  <thead>
                    <tr>
                      <th>Due</th>
                      <th>Barcode</th>
                      <th>{T('Store', lang)}</th>
                      <th>{T('Garment', lang)}</th>
                      <th>Service</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {dueListFiltered.slice(0, glLimit).map((r, idx) => {
                      const late = r[0] && r[0] < date ? daysBetween(r[0], date) : 0;
                      return (
                        <tr key={`${r[1]}_${idx}`} className={late ? 'od' : r[0] === date ? 'td' : ''}>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <b>{fD(r[0])}</b>
                            {late > 0 && <small style={{ color: 'var(--bad)' }}> {late}d</small>}
                          </td>
                          <td>{r[1]}</td>
                          <td>{r[2]}</td>
                          <td>{r[3]}</td>
                          <td>{r[4]}</td>
                          <td>
                            <span className={`badge b-${r[5]}`}>{r[5]}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {dueListFiltered.length > glLimit && (
                <button
                  type="button"
                  className="btn ghost block mt"
                  onClick={() => setGlLimit((n) => n + 100)}
                >
                  {T('Show more', lang)} ({dueListFiltered.length - glLimit})
                </button>
              )}
            </div>
          </>
        )}

        {isMgr && modData.history && modData.history.length > 0 && (
          <>
            <div className="h2">Last 14 days</div>
            <div className="card">
              <div className="tw">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th className="n">{T('Total', lang)}</th>
                      <th className="n">UL</th>
                      <th className="n">PC</th>
                      <th className="n">{T('Overdue', lang)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modData.history
                      .slice()
                      .reverse()
                      .map((x) => (
                        <tr key={x.date}>
                          <td>{fD(x.date)}</td>
                          <td className="n">
                            <b>{x.total}</b>
                          </td>
                          <td className="n">{x.ul}</td>
                          <td className="n">{x.pc}</td>
                          <td className="n" style={{ color: 'var(--bad)' }}>
                            {x.overdue}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
};
