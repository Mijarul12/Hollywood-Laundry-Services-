import React, { useState } from 'react';
import { daysBetween, fD, fLong, sumNums, T } from '../../config/workshopConfig';
import type { EntryRecord, ModuleResponse } from '../../types/workshop';
import { Chips, DateBar, EntryList, LockNote, SaveBar, Stepper, TopBar } from '../CommonUI';
import { Ico } from '../Icons';
import type { ModuleViewProps } from './ReleasePackView';

export const SareePolishView: React.FC<ModuleViewProps> = ({
  me,
  settings,
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
  onAddList,
  onConfirm,
}) => {
  const isMgr = me.role === 'Admin' || me.role === 'Manager';
  const [sendForm, setSendForm] = useState<{ to: string; qty: number | ''; note: string }>({
    to: '',
    qty: '',
    note: '',
  });
  const [recvMap, setRecvMap] = useState<Record<string, { qty?: number; reason?: string }>>({});

  if (!modData) {
    return (
      <>
        <TopBar
          title={T('Saree Polish', lang)}
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

  const openList: EntryRecord[] = Array.isArray(modData.open) ? modData.open : [];
  const recvToday: EntryRecord[] = modData.recvToday || [];
  const pendingQty = sumNums(openList.map((e) => e.data.qty));
  const sentTodayQty = sumNums(modData.rows.map((e) => e.data.qty));
  const recvTodayQty = sumNums(recvToday.map((e) => e.data.recvQty));

  const handleSend = async () => {
    if (!sendForm.to) {
      onToast(`${T('Sent to', lang)}?`, 'err');
      return;
    }
    if (!(Number(sendForm.qty) > 0)) {
      onToast('Enter quantity', 'err');
      return;
    }
    const r = await onApi<ModuleResponse>('e.add', {
      mod: 'saree',
      date,
      items: [{ to: sendForm.to, qty: Number(sendForm.qty), note: sendForm.note }],
    });
    onUpdateModData(r);
    onToast(`✓ ${sendForm.qty} → ${sendForm.to}`, 'ok');
    setSendForm((prev) => ({ to: prev.to, qty: '', note: '' }));
  };

  const handleReceive = async (e: EntryRecord) => {
    const r = recvMap[e.id] || {};
    const q = r.qty !== undefined ? Number(r.qty) : Number(e.data.qty);
    if (q !== Number(e.data.qty) && !(r.reason || '').trim()) {
      onToast(`Sent ${e.data.qty}, received ${q} — write the reason`, 'err');
      return;
    }
    const next = await onApi<ModuleResponse>('saree.receive', {
      id: e.id,
      qty: q,
      reason: r.reason || '',
      date,
    });
    onUpdateModData(next);
    setRecvMap((prev) => {
      const copy = { ...prev };
      delete copy[e.id];
      return copy;
    });
    onToast(`✓ ${T('Received', lang)} ${q}`, 'ok');
  };

  const handleDelete = (e: EntryRecord) => {
    onConfirm(
      `${T('Delete', lang)}?`,
      e.summary,
      async () => {
        const r = await onApi<ModuleResponse>('e.del', { id: e.id, mod: 'saree', date: e.date });
        onUpdateModData(r);
      },
      true
    );
  };

  const combinedLog = [
    ...modData.rows,
    ...recvToday.filter((e) => !modData.rows.some((x) => x.id === e.id)),
  ];

  return (
    <>
      <TopBar
        title={T('Saree Polish', lang)}
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

        <div className="grid g3">
          <div className="kpi gold">
            <div className="l">At polish</div>
            <div className="v">{pendingQty}</div>
            <div className="s">{openList.length} lot(s)</div>
          </div>
          <div className="kpi">
            <div className="l">Sent today</div>
            <div className="v">{sentTodayQty}</div>
          </div>
          <div className="kpi ok">
            <div className="l">Received today</div>
            <div className="v">{recvTodayQty}</div>
          </div>
        </div>

        <div className="cols2 mt">
          <div className="card">
            <div className="steph">
              <Ico name="saree" /> Send for polish
            </div>
            <label className="lbl">{T('Sent to', lang)}</label>
            <Chips
              list={settings.sareeTo || []}
              value={sendForm.to}
              onToggle={(v) => setSendForm((p) => ({ ...p, to: p.to === v ? '' : v }))}
              canAdd
              onAdd={() => onAddList('sareeTo', (val) => setSendForm((p) => ({ ...p, to: val })))}
              lang={lang}
            />
            <label className="lbl">{T('Quantity (pcs)', lang)}</label>
            <Stepper
              value={sendForm.qty}
              onChange={(n) => setSendForm((p) => ({ ...p, qty: n }))}
            />
            <label className="lbl">
              {T('Note', lang)} <small>(optional)</small>
            </label>
            <input
              value={sendForm.note}
              onChange={(e) => setSendForm((p) => ({ ...p, note: e.target.value }))}
            />
            <LockNote isMgr={isMgr} lang={lang} />
            {(isMgr || date === today) && (
              <SaveBar meName={me.name} unit={unit} label="Send for polish" onSave={handleSend} />
            )}
          </div>

          <div>
            <div className="h2" style={{ marginTop: 0 }}>
              {T('Sent for polish — pending', lang)}
              <span className="cnt">oldest first</span>
            </div>
            <div className="card tight list">
              {openList.length ? (
                openList.map((e) => {
                  const r = recvMap[e.id] || {};
                  const q = r.qty !== undefined ? r.qty : Number(e.data.qty);
                  const diff = q - Number(e.data.qty);
                  const dd = daysBetween(e.date, today);
                  return (
                    <div className="li" key={e.id} style={{ flexWrap: 'wrap' }}>
                      <div className="main" style={{ flex: '1 1 100%' }}>
                        <b>
                          {e.data.qty} {T('pcs', lang)} → {e.data.to}
                        </b>
                        <small>
                          Sent {fD(e.date)} {e.at} · {e.by}
                          {e.data.note ? ` · ${e.data.note}` : ''} ·{' '}
                          <span style={{ color: dd > 3 ? 'var(--bad)' : 'inherit' }}>
                            {dd} {T('days', lang)}
                          </span>
                        </small>
                      </div>
                      <div className="sarow">
                        <div>
                          <div className="mini">{T('Received', lang)}</div>
                          <Stepper
                            cls="sm"
                            value={q}
                            onChange={(n) =>
                              setRecvMap((prev) => ({ ...prev, [e.id]: { ...r, qty: n } }))
                            }
                          />
                        </div>
                        <div className="grow">
                          <div className="mini" style={{ color: diff ? 'var(--bad)' : 'var(--muted)' }}>
                            {diff
                              ? `Difference ${diff > 0 ? '+' : ''}${diff} — ${T('Reason for difference', lang)}`
                              : `${T('Reason for difference', lang)} (if any)`}
                          </div>
                          <input
                            value={r.reason || ''}
                            onChange={(ev) =>
                              setRecvMap((prev) => ({
                                ...prev,
                                [e.id]: { ...r, reason: ev.target.value },
                              }))
                            }
                          />
                        </div>
                        <button type="button" className="btn sm ok" onClick={() => handleReceive(e)}>
                          {T('Receive', lang)}
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="empty">✓ Nothing at polish</div>
              )}
            </div>

            <EntryList
              rows={combinedLog}
              title={T('Today', lang)}
              me={me}
              lang={lang}
              renderMain={(e) => (
                <>
                  <b>{e.summary}</b>
                  <small>
                    {fD(e.date)} {e.at} · by {e.by}
                    {e.data.recvBy
                      ? ` · received by ${e.data.recvBy} ${String(e.data.recvAt || '').slice(11)}`
                      : ''}
                  </small>
                </>
              )}
              onDelete={handleDelete}
            />
          </div>
        </div>
      </main>
    </>
  );
};
