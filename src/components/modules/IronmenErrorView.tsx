import React, { useState } from 'react';
import { fLong, T } from '../../config/workshopConfig';
import type { EntryRecord, ModuleResponse } from '../../types/workshop';
import { DateBar, EntryList, LockNote, Stepper, TopBar } from '../CommonUI';
import { Ico } from '../Icons';
import type { ModuleViewProps } from './ReleasePackView';

export const IronmenErrorView: React.FC<ModuleViewProps> = ({
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
  const [drafts, setDrafts] = useState<Record<string, { points: number; note: string }>>({});

  if (!modData) {
    return (
      <>
        <TopBar
          title={T('Ironmen Error', lang)}
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

  const ks = settings.teams.iron || [];
  const todayMap: Record<string, number> = {};
  const weekMap: Record<string, number> = {};
  modData.rows.forEach((e) => {
    todayMap[e.data.karigar] = (todayMap[e.data.karigar] || 0) + Number(e.data.points || 0);
  });
  (modData.week || []).forEach((e) => {
    weekMap[e.data.karigar] = (weekMap[e.data.karigar] || 0) + Number(e.data.points || 0);
  });

  const handleSave = async () => {
    const items = ks
      .map((k) => {
        const d = drafts[k] || { points: 0, note: '' };
        return { karigar: k, points: Number(d.points) || 0, note: (d.note || '').trim() };
      })
      .filter((x) => x.points > 0 || x.note);
    if (!items.length) {
      onToast('Enter points for at least one karigar', 'err');
      return;
    }
    const r = await onApi<ModuleResponse>('iron.save', { date, items });
    onUpdateModData(r);
    setDrafts({});
    onToast(`✓ ${items.length} ${T('Saved', lang)}`, 'ok');
  };

  const handleDelete = (e: EntryRecord) => {
    onConfirm(
      `${T('Delete', lang)}?`,
      e.summary,
      async () => {
        const r = await onApi<ModuleResponse>('e.del', { id: e.id, mod: 'iron', date: e.date });
        onUpdateModData(r);
      },
      true
    );
  };

  const readOnly = !isMgr && date < today;
  const totalTodayPts = Object.values(todayMap).reduce((s, n) => s + (Number(n) || 0), 0);

  return (
    <>
      <TopBar
        title={T('Ironmen Error', lang)}
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
        <div className="card iron-card">
          <div className="iron-top">
            <div className="iron-meta">
              <b>{T('Karigar', lang)}</b>
              <span className="muted">
                {ks.length} active · {totalTodayPts} pts today
              </span>
            </div>
            {!readOnly && (
              <button type="button" className="chip add iron-add-btn" onClick={() => onAddList('teams.iron')}>
                + {T('Add', lang)}
              </button>
            )}
          </div>
          <div className="rows iron" style={readOnly ? { pointerEvents: 'none', opacity: 0.85 } : undefined}>
            <div className="r rhead">
              <div className="mini">{T('Karigar', lang)}</div>
              <div className="mini" style={{ textAlign: 'center' }}>
                {T('Today total', lang)}
              </div>
              <div className="mini" style={{ textAlign: 'center' }}>
                {T('Points', lang)}
              </div>
              <div className="mini hide-sm">{T('Remarks', lang)}</div>
            </div>
            {ks.map((k) => {
              const d = drafts[k] || { points: 0, note: '' };
              const tot = todayMap[k] || 0;
              const active = tot > 0 || d.points > 0 || !!d.note.trim();
              return (
                <div className={`r${active ? ' is-active' : ''}`} key={k}>
                  <div className="nm">
                    {k}
                    <small>
                      {T('This week', lang)}: {weekMap[k] || 0} pts
                    </small>
                  </div>
                  <div className={`tbox ${tot ? 'has' : ''}`}>
                    {tot}
                    <small>pts</small>
                  </div>
                  <Stepper
                    cls="sm"
                    value={d.points || ''}
                    onChange={(n) => setDrafts((prev) => ({ ...prev, [k]: { ...d, points: n } }))}
                  />
                  <div className="full">
                    <input
                      className="rmk"
                      placeholder={T('Remarks', lang)}
                      value={d.note}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [k]: { ...d, note: e.target.value } }))}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <LockNote isMgr={isMgr} lang={lang} />
        </div>

        <EntryList
          rows={modData.rows}
          me={me}
          lang={lang}
          renderMain={(e) => (
            <>
              <b>
                {e.data.karigar} · <span style={{ color: 'var(--bad)' }}>{e.data.points} pts</span>
              </b>
              <small>
                {e.data.note ? `${e.data.note} · ` : ''}
                {e.at} · by {e.by}
              </small>
            </>
          )}
          onDelete={handleDelete}
        />
      </main>
      {!readOnly && (
        <div className="savebar">
          <div className="row">
            <span className="pill">
              {ks.length} {T('Karigar', lang)}
            </span>
            <span className="grow" />
            <button type="button" className="btn gold btn-save" onClick={handleSave}>
              <Ico name="check" /> {T('Save all', lang)}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
