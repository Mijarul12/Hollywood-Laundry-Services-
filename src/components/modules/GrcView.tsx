import React, { useEffect, useState } from 'react';
import { fLong, sumNums, T } from '../../config/workshopConfig';
import type { ModuleResponse } from '../../types/workshop';
import { DateBar, LockNote, SaveBar, Stepper, TopBar } from '../CommonUI';
import type { ModuleViewProps } from './ReleasePackView';

export const GrcView: React.FC<ModuleViewProps> = ({
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
}) => {
  const isMgr = me.role === 'Admin' || me.role === 'Manager';
  const [counts, setCounts] = useState<Record<string, number | ''>>({});

  useEffect(() => {
    const saved = modData?.rows?.find((x) => x.unit === unit);
    if (saved) {
      setCounts({ ...(saved.data.counts || {}) });
    } else {
      setCounts({});
    }
  }, [modData, unit]);

  if (!modData) {
    return (
      <>
        <TopBar
          title={T('GRC Count', lang)}
          sub={`Garment Remarks Correction · ${fLong(date)} · ${unit}`}
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

  const saved = modData.rows.find((x) => x.unit === unit);
  const locked = !isMgr && (!!saved || date < today);
  const yesterdayCounts: Record<string, number> = modData.yesterday?.data?.counts || {};
  const storeList = settings.stores.map((s) => s.code);
  const total = sumNums(storeList.map((s) => counts[s]));

  const handleSave = async () => {
    if (!storeList.some((s) => counts[s] !== undefined && counts[s] !== '')) {
      onToast('Enter at least one store', 'err');
      return;
    }
    const r = await onApi<ModuleResponse>('grc.save', { date, counts });
    onUpdateModData(r);
    onToast(`✓ ${T('Saved', lang)}`, 'ok');
  };

  return (
    <>
      <TopBar
        title={T('GRC Count', lang)}
        sub={`Garment Remarks Correction · ${fLong(date)} · ${unit}`}
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
        {saved && (
          <div className="card" style={{ background: 'var(--okbg)', color: 'var(--ok)', fontWeight: 800 }}>
            ✓ {T('Saved', lang)} — {saved.by} {saved.at}
          </div>
        )}
        <div className="card">
          <div className="rows">
            {storeList.map((s) => (
              <div className="r" key={s}>
                <div className="nm">
                  {s}
                  <small>Yesterday: {yesterdayCounts[s] != null ? yesterdayCounts[s] : '—'}</small>
                </div>
                {locked ? (
                  <div className="tbox">{counts[s] != null ? counts[s] : '—'}</div>
                ) : (
                  <Stepper
                    cls="sm"
                    value={counts[s]}
                    onChange={(n) => setCounts((prev) => ({ ...prev, [s]: n }))}
                  />
                )}
              </div>
            ))}
            <div className="r" style={{ borderTop: '2px solid var(--ink)' }}>
              <div className="nm">{T('Total', lang)}</div>
              <div className="tbox ok" style={{ minWidth: 90 }}>
                {total}
              </div>
            </div>
          </div>
          <LockNote isMgr={isMgr} lang={lang} />
          {!locked && <SaveBar meName={me.name} unit={unit} label={T('Save', lang)} onSave={handleSave} />}
        </div>
      </main>
    </>
  );
};
