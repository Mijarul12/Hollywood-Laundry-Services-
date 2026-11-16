import React, { useEffect, useState } from 'react';
import { fD, fLong, T } from '../../config/workshopConfig';
import type { ModuleResponse } from '../../types/workshop';
import { DateBar, LockNote, SaveBar, TopBar } from '../CommonUI';
import { Ico } from '../Icons';
import type { ModuleViewProps } from './ReleasePackView';

export const MeterView: React.FC<ModuleViewProps> = ({
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
  const [readings, setReadings] = useState<Record<string, string>>({});

  useEffect(() => {
    const saved = modData?.rows?.find((x) => x.unit === unit);
    if (saved) {
      const next: Record<string, string> = {};
      Object.keys(saved.data.readings || {}).forEach((k) => {
        next[k] = String(saved.data.readings[k]);
      });
      setReadings(next);
    } else {
      setReadings({});
    }
  }, [modData, unit]);

  if (!modData) {
    return (
      <>
        <TopBar
          title={T('Electricity & Water', lang)}
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

  const saved = modData.rows.find((x) => x.unit === unit);
  const locked = !isMgr && (!!saved || date < today);
  const meters = settings.meters || [];
  const lastMap = modData.last || {};

  const handleSave = async () => {
    try {
      const r = await onApi<ModuleResponse>('meter.save', { date, readings });
      onUpdateModData(r);
      onToast(`✓ ${T('Saved', lang)}`, 'ok');
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (/lower than last/.test(msg) && isMgr) {
        onConfirm('Lower meter reading', `${msg}\n\nSave anyway (meter changed)?`, async () => {
          const r = await onApi<ModuleResponse>('meter.save', { date, readings, force: true });
          onUpdateModData(r);
          onToast(`✓ ${T('Saved', lang)}`, 'ok');
        });
      }
    }
  };

  return (
    <>
      <TopBar
        title={T('Electricity & Water', lang)}
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
        {saved && (
          <div className="card" style={{ background: 'var(--okbg)', color: 'var(--ok)', fontWeight: 800 }}>
            ✓ {T('Saved', lang)} — {saved.by} {saved.at}
          </div>
        )}
        <div className="g2d">
          {meters.map((m, idx) => {
            const last = lastMap[m.name];
            const val = readings[m.name] ?? '';
            const used =
              val !== '' && last ? Math.round((Number(val) - Number(last.reading)) * 100) / 100 : null;
            return (
              <div className="card" key={m.name}>
                <div className="flex between">
                  <b style={{ fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Ico name={idx ? 'rewash' : 'bolt'} /> {m.name}
                  </b>
                  <span className="badge">{m.measure}</span>
                </div>
                <div className="grid g2 mt">
                  <div className="kpi">
                    <div className="l">{T('Last reading', lang)}</div>
                    <div className="v" style={{ fontSize: 22 }}>
                      {last ? last.reading.toLocaleString('en-IN') : '—'}
                    </div>
                    <div className="s">{last ? fD(last.date) : 'first entry'}</div>
                  </div>
                  <div className={`kpi ${used != null && used < 0 ? 'bad' : 'gold'}`}>
                    <div className="l">{T('Used today', lang)}</div>
                    <div className="v" style={{ fontSize: 22 }}>
                      {used == null ? '—' : used}
                    </div>
                    <div className="s">{m.measure}</div>
                  </div>
                </div>
                <label className="lbl">{T('Today reading', lang)}</label>
                {locked ? (
                  <div className="big">{val}</div>
                ) : (
                  <input
                    inputMode="decimal"
                    style={{ fontSize: 22, fontWeight: 800 }}
                    value={val}
                    onChange={(e) => setReadings((prev) => ({ ...prev, [m.name]: e.target.value }))}
                  />
                )}
              </div>
            );
          })}
        </div>
        <LockNote isMgr={isMgr} lang={lang} />
        {!locked && <SaveBar meName={me.name} unit={unit} label={T('Save', lang)} onSave={handleSave} />}
      </main>
    </>
  );
};
