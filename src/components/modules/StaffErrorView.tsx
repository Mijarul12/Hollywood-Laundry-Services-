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
  const readOnly = !isMgr && date < today;
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});

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

  const checkedStaff = allStaff.filter((name) => !!selected[name]);
  const allChecked = allStaff.length > 0 && checkedStaff.length === allStaff.length;

  const toggleAll = () => {
    if (allChecked) {
      setSelected({});
    } else {
      const next: Record<string, boolean> = {};
      allStaff.forEach((n) => {
        next[n] = true;
      });
      setSelected(next);
    }
  };

  const handleSaveOne = async (staff: string) => {
    const note = (notes[staff] || '').trim();
    if (!note) {
      onToast(`Write details for ${staff}`, 'err');
      return;
    }
    const r = await onApi<ModuleResponse>('e.add', { mod: 'staffErr', date, items: [{ staff, note }] });
    onUpdateModData(r);
    setNotes((prev) => {
      const next = { ...prev };
      delete next[staff];
      return next;
    });
    setSelected((prev) => {
      const next = { ...prev };
      delete next[staff];
      return next;
    });
    onToast(`✓ ${staff} ${T('Saved', lang)}`, 'ok');
  };

  const handleSaveAll = async () => {
    if (!checkedStaff.length) {
      onToast('Tick checkboxes to save all', 'err');
      return;
    }
    const missing = checkedStaff.filter((staff) => !(notes[staff] || '').trim());
    if (missing.length) {
      onToast(`Write details for: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''}`, 'err');
      return;
    }
    const items = checkedStaff.map((staff) => ({ staff, note: (notes[staff] || '').trim() }));
    const r = await onApi<ModuleResponse>('e.add', { mod: 'staffErr', date, items });
    onUpdateModData(r);
    setNotes((prev) => {
      const next = { ...prev };
      checkedStaff.forEach((n) => delete next[n]);
      return next;
    });
    setSelected({});
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
          {!readOnly && allStaff.length > 0 && (
            <div className="se-toolbar">
              <label className="se-check-all">
                <input
                  type="checkbox"
                  className="se-cb"
                  checked={allChecked}
                  onChange={toggleAll}
                />
                <span>Select all</span>
              </label>
              <span className="muted" style={{ fontSize: 12.5, fontWeight: 700 }}>
                {checkedStaff.length > 0 ? `${checkedStaff.length} selected` : 'Tick checkboxes for Save all'}
              </span>
            </div>
          )}
          <div className="rows se" style={readOnly ? { pointerEvents: 'none', opacity: 0.85 } : undefined}>
            {allStaff.map((name) => {
              const list = byStaff[name] || [];
              const isChecked = !!selected[name];
              const noteVal = notes[name] || '';
              const active = list.length > 0 || isChecked || !!noteVal.trim();
              return (
                <div className={`r${active ? ' is-active' : ''}`} key={name}>
                  <div className="se-who">
                    {!readOnly && (
                      <input
                        type="checkbox"
                        className="se-cb"
                        aria-label={`Select ${name}`}
                        checked={isChecked}
                        onChange={(e) => setSelected((prev) => ({ ...prev, [name]: e.target.checked }))}
                      />
                    )}
                    <div className="nm">
                      {name}
                      {list.length > 0 && (
                        <small style={{ color: 'var(--bad)' }}>{list.map((e) => e.data.note).join(' · ')}</small>
                      )}
                    </div>
                  </div>
                  <div className="se-entry">
                    <input
                      className="rmk"
                      placeholder={T('Details', lang)}
                      value={noteVal}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNotes((prev) => ({ ...prev, [name]: val }));
                        if (val.trim()) {
                          setSelected((prev) => (prev[name] ? prev : { ...prev, [name]: true }));
                        } else {
                          setSelected((prev) => {
                            if (!prev[name]) return prev;
                            const next = { ...prev };
                            delete next[name];
                            return next;
                          });
                        }
                      }}
                    />
                    {!readOnly && (
                      <button
                        type="button"
                        className="btn sm gold se-save-btn"
                        onClick={() => handleSaveOne(name)}
                      >
                        <Ico name="check" /> {T('Save', lang)}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <LockNote isMgr={isMgr} lang={lang} />
          {!readOnly && (
            <div className="card-save-row se-save-all-row">
              <span className="pill">
                {checkedStaff.length} selected · {me.name}
              </span>
              <button
                type="button"
                className="btn gold btn-save"
                disabled={checkedStaff.length === 0}
                onClick={handleSaveAll}
              >
                <Ico name="check" /> {T('Save all', lang)}
                {checkedStaff.length > 0 ? ` (${checkedStaff.length})` : ''}
              </button>
            </div>
          )}
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
    </>
  );
};
