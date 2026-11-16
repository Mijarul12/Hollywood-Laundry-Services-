import React, { useEffect, useState } from 'react';
import { daysBetween, fD, fLong, FORMS, getSettingPath, modTitle, T } from '../../config/workshopConfig';
import type { EntryRecord, ModuleResponse } from '../../types/workshop';
import { Chips, DateBar, EntryList, LockNote, SaveBar, Stepper, TopBar } from '../CommonUI';
import type { ModuleViewProps } from './ReleasePackView';

export const FormModuleView: React.FC<
  ModuleViewProps & { mod: 'repair' | 'spot' | 'quickfix' | 'washerr' }
> = ({
  mod,
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
  const fields = FORMS[mod];
  const [form, setForm] = useState<Record<string, any>>({});

  useEffect(() => {
    const init: Record<string, any> = {};
    fields.forEach((f) => {
      if (f.def !== undefined) init[f.k] = f.def;
    });
    setForm(init);
  }, [mod]);

  if (!modData) {
    return (
      <>
        <TopBar
          title={T(modTitle(mod), lang)}
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

  const storeList = settings.stores.map((s) => s.code);

  const setField = (k: string, v: any, toggle = false) => {
    setForm((prev) => {
      const next = { ...prev };
      next[k] = toggle && prev[k] === v ? '' : v;
      if (mod === 'washerr' && k === 'damage' && !prev.points && next[k]) {
        next.points = (settings.damagePoints || {})[next[k]] || 1;
      }
      return next;
    });
  };

  const handleSave = async () => {
    const miss = fields.filter((f) => !f.opt && (form[f.k] === undefined || String(form[f.k]).trim() === ''));
    if (miss.length) {
      onToast(`Fill: ${miss.map((f) => T(f.l, lang)).join(', ')}`, 'err');
      return;
    }
    const r = await onApi<ModuleResponse>('e.add', { mod, date, items: [form] });
    onUpdateModData(r);
    const keep: Record<string, any> = {};
    for (const k of ['store', 'by', 'sentTo', 'kind', 'garment']) {
      if (form[k] !== undefined) keep[k] = form[k];
    }
    setForm(keep);
    onToast(`✓ ${T('Saved', lang)}`, 'ok');
  };

  const handleRepairStep = async (id: string, step: 'Back' | 'Released', label: string) => {
    const r = await onApi<ModuleResponse>('repair.step', { id, step });
    onUpdateModData(r);
    onToast(`✓ ${label}`, 'ok');
  };

  const handleDelete = (e: EntryRecord) => {
    onConfirm(
      `${T('Delete', lang)}?`,
      e.summary,
      async () => {
        const r = await onApi<ModuleResponse>('e.del', { id: e.id, mod, date: e.date });
        onUpdateModData(r);
      },
      true
    );
  };

  const openRepairs: EntryRecord[] = Array.isArray(modData.open) ? modData.open : [];

  return (
    <>
      <TopBar
        title={T(modTitle(mod), lang)}
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
        <div className="cols2">
          <div className="card">
            <div className="form">
              {fields.map((f) => {
                const label = (
                  <label className="lbl">
                    {T(f.l, lang)}
                    {f.opt && <small> (optional)</small>}
                  </label>
                );
                const val = form[f.k];

                if (f.t === 'store') {
                  return (
                    <div className="wide" key={f.k}>
                      {label}
                      <Chips list={storeList} value={val || ''} onToggle={(v) => setField(f.k, v, true)} lang={lang} />
                    </div>
                  );
                }

                if (f.t === 'list') {
                  const src = f.src === 'repairTo' ? 'repairPlaces' : f.src || '';
                  let opts = [...((getSettingPath(settings, src) as string[]) || [])];
                  if (mod === 'repair' && f.k === 'sentTo') {
                    const otherUnits = (settings.units || []).filter((x) => x !== unit);
                    opts = [...otherUnits, ...opts.filter((x) => !otherUnits.includes(x))];
                  }
                  return (
                    <div className="wide" key={f.k}>
                      {label}
                      <Chips
                        list={opts}
                        value={val || ''}
                        onToggle={(v) => setField(f.k, v, true)}
                        canAdd
                        onAdd={() => onAddList(src, (added) => setField(f.k, added, false))}
                        lang={lang}
                      />
                    </div>
                  );
                }

                if (f.t === 'seg') {
                  return (
                    <div key={f.k}>
                      {label}
                      <div className="seg">
                        {(f.opts || []).map(([ov, ol]) => (
                          <button
                            key={ov}
                            type="button"
                            className={val === ov ? 'on' : ''}
                            onClick={() => setField(f.k, ov, true)}
                          >
                            {ol}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                }

                if (f.t === 'text') {
                  return (
                    <div key={f.k}>
                      {label}
                      <input
                        value={val || ''}
                        autoCapitalize={f.caps ? 'characters' : undefined}
                        onChange={(e) => setField(f.k, f.caps ? e.target.value.toUpperCase() : e.target.value)}
                      />
                    </div>
                  );
                }

                if (f.t === 'num') {
                  return (
                    <div key={f.k}>
                      {label}
                      <Stepper value={val} onChange={(n) => setField(f.k, n)} />
                    </div>
                  );
                }

                if (f.t === 'pct') {
                  return (
                    <div className="wide pct" key={f.k}>
                      {label}
                      <div className="pv">{val === undefined || val === '' ? '—' : `${val}%`}</div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={val || 0}
                        onChange={(e) => setField(f.k, Number(e.target.value))}
                      />
                      <div className="q">
                        {[0, 25, 50, 75, 100].map((x) => (
                          <button
                            key={x}
                            type="button"
                            className={Number(val) === x && val !== '' && val !== undefined ? 'on' : ''}
                            onClick={() => setField(f.k, x)}
                          >
                            {x}%
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                }

                return null;
              })}
            </div>
            <LockNote isMgr={isMgr} lang={lang} />
            {(isMgr || date === today) && (
              <SaveBar inline meName={me.name} unit={unit} label={T('Save', lang)} onSave={handleSave} />
            )}
          </div>

          <div>
            {mod === 'repair' && (
              <>
                <div className="h2" style={{ marginTop: 0 }}>
                  {T('Open repairs', lang)}
                  <span className="cnt">{openRepairs.length}</span>
                </div>
                <div className="card tight list">
                  {openRepairs.length ? (
                    openRepairs.map((e) => {
                      const dd = daysBetween(e.date, today);
                      const backLabel = `${T('Back from repair', lang)}${
                        (settings.units || []).includes(e.data.sentTo) ? ` (${e.data.sentTo})` : ''
                      }`;
                      const relLabel = T('Released to store', lang);
                      return (
                        <div className="li" key={e.id} style={{ flexWrap: 'wrap' }}>
                          <div className="main" style={{ flex: '1 1 100%' }}>
                            <b>
                              <span className="badge b-gold">
                                {e.unit} → {e.data.sentTo}
                              </span>{' '}
                              {e.store} · {e.data.tag} · {e.data.garment}
                            </b>
                            <small>
                              {e.data.damage} · sent {fD(e.date)} ·{' '}
                              <span style={{ color: dd > 3 ? 'var(--bad)' : 'inherit' }}>
                                {dd} {T('days', lang)}
                              </span>
                              {e.data.status === 'Back' && (
                                <>
                                  {' '}
                                  · <b style={{ color: 'var(--ok)' }}>back {fD(e.data.backAt)}</b>
                                </>
                              )}
                            </small>
                          </div>
                          {e.data.status !== 'Back' && (
                            <button
                              type="button"
                              className="btn sm ghost"
                              onClick={() => handleRepairStep(e.id, 'Back', backLabel)}
                            >
                              {backLabel}
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn sm ok"
                            onClick={() => handleRepairStep(e.id, 'Released', relLabel)}
                          >
                            {relLabel}
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <div className="empty">✓ Nothing pending</div>
                  )}
                </div>
              </>
            )}

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
          </div>
        </div>
      </main>
    </>
  );
};
