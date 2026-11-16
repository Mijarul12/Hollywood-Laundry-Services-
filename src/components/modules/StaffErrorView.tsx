import React, { useState } from 'react';
import { fLong, T, uniq } from '../../config/workshopConfig';
import type { EntryRecord, ModuleResponse } from '../../types/workshop';
import { DateBar, EntryList, LockNote, TopBar } from '../CommonUI';
import { Ico } from '../Icons';
import type { ModuleViewProps } from './ReleasePackView';

export const StaffErrorView: React.FC<ModuleViewProps> = ({
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
  onConfirm,
}) => {
  const isMgr = me.role === 'Admin' || me.role === 'Manager';
  const [notes, setNotes] = useState<Record<string, string>>({});

  if (!modData) {
    return (
      <>
        <TopBar
          title={T('Staff Error', lang)}
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

  const allStaff = uniq([
    ...(settings.teams.office || []),
    ...(settings.teams.iron || []),
    ...(settings.teams.wash || []),
    ...(settings.teams.spot || []),
    ...(settings.teams.qf || []),
  ]);

  const byStaff: Record<string, EntryRecord[]> = {};
  modData.rows.forEach((e) => {
    (byStaff[e.data.staff] = byStaff[e.data.staff] || []).push(e);
  });

  const handleSave = async () => {
    const items = allStaff
      .map((staff) => ({ staff, note: (notes[staff] || '').trim() }))
      .filter((x) => x.note);
    if (!items.length) {
      onToast('Write details for at least one name', 'err');
      return;
    }
    const r = await onApi<ModuleResponse>('e.add', { mod: 'staffErr', date, items });
    onUpdateModData(r);
    setNotes({});
    onToast(`✓ ${items.length} ${T('Saved', lang)}`, 'ok');
  };

  const handleDelete = (e: EntryRecord) => {
    onConfirm(
      `${T('Delete', lang)}?`,
      e.summary,
      async () => {
        const r = await onApi<ModuleResponse>('e.del', { id: e.id, mod: 'staffErr', date: e.date });
        onUpdateModData(r);
      },
      true
    );
  };

  return (
    <>
      <TopBar
        title={T('Staff Error', lang)}
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
          <div className="rows se" style={!isMgr && date < today ? { pointerEvents: 'none', opacity: 0.85 } : undefined}>
            {allStaff.map((name) => {
              const list = byStaff[name] || [];
              return (
                <div className="r" key={name}>
                  <div className="nm">
                    {name}
                    {list.length > 0 && (
                      <small style={{ color: 'var(--bad)' }}>{list.map((e) => e.data.note).join(' · ')}</small>
                    )}
                  </div>
                  <div className={`tbox ${list.length ? 'has' : ''}`}>{list.length}</div>
                  <div className="full">
                    <input
                      className="rmk"
                      placeholder={T('Details', lang)}
                      value={notes[name] || ''}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [name]: e.target.value }))}
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
              <b>{e.summary}</b>
              <small>
                {e.at} · by {e.by}
              </small>
            </>
          )}
          onDelete={handleDelete}
        />
      </main>
      {(isMgr || date === today) && (
        <div className="savebar">
          <div className="row">
            <span className="pill">
              {me.name} · {unit}
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
