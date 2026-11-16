import React, { useState } from 'react';
import { daysBetween, fD, fLong, T } from '../../config/workshopConfig';
import type { EntryRecord, ModuleResponse } from '../../types/workshop';
import { DateBar, EntryList, LockNote, SaveBar, Stepper, TopBar, WhoBox } from '../CommonUI';
import type { ModuleViewProps } from './ReleasePackView';

export const RewashView: React.FC<ModuleViewProps> = ({
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
  const [by, setBy] = useState('');
  const [lines, setLines] = useState<Record<string, { given: number; received: number }>>({});

  if (!modData) {
    return (
      <>
        <TopBar
          title={T('Rewash', lang)}
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

  const kinds = settings.rewashTypes || ['Full wash', 'Spotting'];
  const st = modData.state || {};

  const handleSave = async () => {
    if (isMgr && !by) {
      onToast(T('Who did it?', lang), 'err');
      return;
    }
    const payload = kinds
      .map((k) => {
        const d = lines[k] || { given: 0, received: 0 };
        return { kind: k, given: Number(d.given) || 0, received: Number(d.received) || 0 };
      })
      .filter((x) => x.given || x.received);
    if (!payload.length) {
      onToast('Enter quantity', 'err');
      return;
    }
    const r = await onApi<ModuleResponse>('rewash.save', { date, by, lines: payload });
    onUpdateModData(r);
    setLines({});
    onToast(`✓ ${T('Saved', lang)}`, 'ok');
  };

  const handleDelete = (e: EntryRecord) => {
    onConfirm(
      `${T('Delete', lang)}?`,
      e.summary,
      async () => {
        const r = await onApi<ModuleResponse>('e.del', { id: e.id, mod: 'rewash', date: e.date });
        onUpdateModData(r);
      },
      true
    );
  };

  return (
    <>
      <TopBar
        title={T('Rewash', lang)}
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

        <div className="card">
          <div className="steph">
            <span className="stepn">1</span>
            {T('Who did it?', lang)}
          </div>
          <div className="mt">
            <WhoBox
              me={me}
              settings={settings}
              value={by}
              onToggle={(n) => setBy((prev) => (prev === n ? '' : n))}
              onAddOffice={() => onAddList('teams.office')}
              lang={lang}
            />
          </div>
        </div>

        <div className="card">
          <div className="steph">
            <span className="stepn">2</span>
            {T('Given', lang)} / {T('Received', lang)}
          </div>
          <div className="rows rw mt">
            {kinds.map((k) => {
              const d = lines[k] || { given: 0, received: 0 };
              const bal = st[k]?.balance || 0;
              const nb = bal + Number(d.given || 0) - Number(d.received || 0);
              return (
                <div className="r" key={k}>
                  <div className="nm">
                    {T(k, lang)}
                    <small>
                      {T('Balance', lang)}: <b style={{ color: 'var(--navy)' }}>{bal}</b>
                    </small>
                  </div>
                  <div
                    className="tbox"
                    style={nb < 0 ? { background: 'var(--badbg)', color: 'var(--bad)' } : undefined}
                  >
                    {nb}
                    <small>new bal</small>
                  </div>
                  <div className="full">
                    <div className="mini">{T('Given', lang)}</div>
                    <Stepper
                      cls="sm"
                      value={d.given || ''}
                      quick={[5, 10]}
                      onChange={(n) => setLines((prev) => ({ ...prev, [k]: { ...d, given: n } }))}
                    />
                  </div>
                  <div className="full">
                    <div className="mini">{T('Received', lang)}</div>
                    <Stepper
                      cls="sm"
                      value={d.received || ''}
                      quick={[5, 10]}
                      onChange={(n) => setLines((prev) => ({ ...prev, [k]: { ...d, received: n } }))}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <LockNote isMgr={isMgr} lang={lang} />
        </div>

        {(isMgr || date === today) && (
          <SaveBar meName={me.name} unit={unit} label={T('Save', lang)} onSave={handleSave} />
        )}

        <div className="h2">
          {T('Pending by date', lang)}
          <span className="cnt">oldest first</span>
        </div>
        <div className="g2d">
          {kinds.map((k) => {
            const s = st[k] || { pending: [], balance: 0 };
            return (
              <div className="card" key={k}>
                <div className="flex between">
                  <b>{T(k, lang)}</b>
                  <span className={`badge ${s.balance ? 'b-warn' : 'b-ok'}`}>
                    {T('Balance', lang)} {s.balance}
                  </span>
                </div>
                {s.pending.length ? (
                  <table className="tbl sm mt">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th className="n">{T('Given', lang)}</th>
                        <th className="n">{T('Still pending', lang)}</th>
                        <th className="n">{T('days', lang)}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.pending.map((p) => {
                        const dd = daysBetween(p.date, date);
                        return (
                          <tr key={p.date} className={dd >= 2 ? 'od' : ''}>
                            <td>{fD(p.date)}</td>
                            <td className="n">{p.given}</td>
                            <td className="n">
                              <b>{p.left}</b>
                            </td>
                            <td className="n">{dd}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="empty">✓ Nothing pending</div>
                )}
              </div>
            );
          })}
        </div>

        <EntryList
          rows={modData.rows}
          me={me}
          lang={lang}
          renderMain={(e) => (
            <>
              <b>
                {T(e.data.kind, lang)} ·{' '}
                <span className={`badge ${e.data.type === 'Given' ? 'b-warn' : 'b-ok'}`}>
                  {T(e.data.type, lang)}
                </span>{' '}
                {e.data.qty} {T('pcs', lang)}
              </b>
              <small>
                {e.data.by} · {e.at}
              </small>
            </>
          )}
          onDelete={handleDelete}
        />
      </main>
    </>
  );
};
