import React, { useEffect, useState } from 'react';
import { fLong, hm, mDiff, nowHM, sumNums, T } from '../../config/workshopConfig';
import type { EntryRecord, ModuleResponse } from '../../types/workshop';
import { DateBar, TopBar } from '../CommonUI';
import { Ico } from '../Icons';
import type { ModuleViewProps } from './ReleasePackView';

export const BoilerView: React.FC<ModuleViewProps> = ({
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
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  if (!modData) {
    return (
      <>
        <TopBar
          title={T('Boiler', lang)}
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

  void tick;
  const boilers = (settings.boilers || []).filter(
    (b) => b.unit === unit && (isMgr || !(b.staff || []).length || b.staff.includes(me.name))
  );
  const now = nowHM();
  const live = date === today;
  const openMap: Record<string, EntryRecord> = modData.open || {};

  const tapBoiler = (boilerName: string, what: 'start' | 'stop') => {
    const run = async () => {
      const r = await onApi<ModuleResponse>('boiler.tap', { boiler: boilerName, what });
      onUpdateModData(r);
      onToast(`✓ ${boilerName} · ${T(what === 'start' ? 'Start' : 'Stop', lang)} ${nowHM()}`, 'ok');
    };
    if (what === 'stop') {
      onConfirm(`${T('Stop', lang)} ${boilerName}?`, `Current time: ${now}`, run, true);
    } else {
      run();
    }
  };

  return (
    <>
      <TopBar
        title={T('Boiler', lang)}
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
        {!boilers.length && (
          <div className="card empty">
            No boiler given to you in {unit} — Admin sets this in Settings ▶ Boilers & meters
          </div>
        )}
        {boilers.map((b) => {
          const open = openMap[b.name];
          const rows = modData.rows.filter((e) => e.data.boiler === b.name);
          const mins =
            sumNums(rows.map((e) => e.data.mins)) +
            (open && open.date === today ? mDiff(open.data.start, now) : 0);
          const last = rows.length ? rows[rows.length - 1] : null;
          return (
            <section className={`bpanel ${open ? 'on' : 'off'}`} key={b.name}>
              <div className="bph">
                <div>
                  <div className="bname">{b.name}</div>
                  {(b.staff || []).length > 0 && (
                    <div className="bstaff">
                      <Ico name="user" size={14} /> {b.staff.join(', ')}
                    </div>
                  )}
                </div>
                <div className="bstat">
                  <span className={`bdot ${open ? 'on' : ''}`} />
                  {T(open ? 'Running' : 'Off', lang)}
                </div>
              </div>
              <div className="bnums">
                <div>
                  <span>{open ? 'Running since' : 'Last stopped'}</span>
                  <b>{open ? open.data.start : last?.data.stop || '—'}</b>
                  <small>{open ? open.data.by : last?.data.stopBy || ''}</small>
                </div>
                <div>
                  <span>{T('Running time today', lang)}</span>
                  <b>{hm(mins)}</b>
                  <small>{rows.length} session(s)</small>
                </div>
              </div>
              {live && (
                <button
                  type="button"
                  className={`bigbtn ${open ? 'stop' : 'start'}`}
                  onClick={() => tapBoiler(b.name, open ? 'stop' : 'start')}
                >
                  {open ? '■ ' : '▶ '}
                  {T(open ? 'Stop' : 'Start', lang).toUpperCase()}
                  <small>{now}</small>
                </button>
              )}
              {rows.length > 0 && (
                <div className="bsess">
                  {rows.map((e) => (
                    <span key={e.id}>
                      {e.data.start} – {e.data.stop || <b>now</b>}
                      {e.data.mins ? ` · ${hm(e.data.mins)}` : ''}
                    </span>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </main>
    </>
  );
};
