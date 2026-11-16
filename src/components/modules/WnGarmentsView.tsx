import React, { useRef, useState } from 'react';
import { shrinkImage } from '../../api/client';
import { daysBetween, fD, fLong, photoUrl, T } from '../../config/workshopConfig';
import type { EntryRecord, ModuleResponse } from '../../types/workshop';
import { Chips, DateBar, EntryList, LockNote, SaveBar, TopBar } from '../CommonUI';
import { Ico } from '../Icons';
import type { ModuleViewProps } from './ReleasePackView';

export const WnGarmentsView: React.FC<ModuleViewProps> = ({
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
  onLoading,
  onOpenPhoto,
}) => {
  const isMgr = me.role === 'Admin' || me.role === 'Manager';
  const [tab, setTab] = useState<'garment' | 'tag'>('garment');
  const [wn, setWn] = useState<{ garment: string; karigar: string; photos: string[]; note: string }>({
    garment: '',
    karigar: '',
    photos: [],
    note: '',
  });
  const [wt, setWt] = useState<{ tag: string; store: string; garment: string; note: string }>({
    tag: '',
    store: '',
    garment: '',
    note: '',
  });
  const [wa, setWa] = useState<Record<string, { inv?: string; store?: string }>>({});
  const photoInputRef = useRef<HTMLInputElement>(null);

  if (!modData) {
    return (
      <>
        <TopBar
          title={T('WN Garments', lang)}
          sub={`Without number · ${fLong(date)} · ${unit}`}
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

  const openItems: EntryRecord[] = Array.isArray(modData.open) ? modData.open : [];
  const openGarments = openItems.filter((e) => e.data.kind === 'garment');
  const openTags = openItems.filter((e) => e.data.kind === 'tag');
  const adjToday: EntryRecord[] = modData.adjToday || [];
  const adjGarmentsToday = adjToday.filter((e) => e.data.kind === 'garment').length;
  const storeList = settings.stores.map((s) => s.code);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    onLoading?.(true, '⏳ Saving photo…');
    try {
      const b64 = await shrinkImage(file, 1100, 0.72);
      const res = await onApi<{ id: string; url: string }>('photo', { data: b64, name: 'wn' }, true);
      setWn((prev) => {
        const nextPhotos = [...prev.photos, res.id].slice(0, 2);
        onToast(`✓ Photo ${nextPhotos.length} saved`, 'ok');
        return { ...prev, photos: nextPhotos };
      });
    } catch (err: any) {
      onToast(`Photo: ${err?.message || err}`, 'err');
    } finally {
      onLoading?.(false);
    }
  };

  const handleSaveGarment = async () => {
    if (!wn.photos.length) {
      onToast(T('Take photo', lang), 'err');
      return;
    }
    if (!wn.garment || !wn.karigar) {
      onToast(`${T('Garment', lang)} + ${T('Ironed by', lang)}`, 'err');
      return;
    }
    const r = await onApi<ModuleResponse>('e.add', {
      mod: 'wn',
      date,
      items: [{ kind: 'garment', garment: wn.garment, karigar: wn.karigar, photos: wn.photos, note: wn.note }],
    });
    onUpdateModData(r);
    setWn((prev) => ({ garment: prev.garment, karigar: prev.karigar, photos: [], note: '' }));
    onToast(`✓ ${T('Saved', lang)}`, 'ok');
  };

  const handleSaveTag = async () => {
    if (!wt.tag || !wt.store) {
      onToast(`Tag no. + ${T('Store', lang)}`, 'err');
      return;
    }
    const r = await onApi<ModuleResponse>('e.add', {
      mod: 'wn',
      date,
      items: [{ kind: 'tag', tag: wt.tag, store: wt.store, garment: wt.garment, note: wt.note }],
    });
    onUpdateModData(r);
    setWt({ tag: '', store: '', garment: '', note: '' });
    onToast(`✓ ${T('Saved', lang)}`, 'ok');
  };

  const handleAdjust = async (e: EntryRecord, isTag = false) => {
    const a = wa[e.id] || {};
    if (!isTag && (!(a.inv || '').trim() || !a.store)) {
      onToast(`${T('Invoice no.', lang)} + ${T('Store', lang)}`, 'err');
      return;
    }
    const r = await onApi<ModuleResponse>('wn.adjust', {
      id: e.id,
      inv: a.inv || '',
      store: a.store || '',
      date,
    });
    onUpdateModData(r);
    setWa((prev) => {
      const copy = { ...prev };
      delete copy[e.id];
      return copy;
    });
    onToast(`✓ ${T('Adjusted', lang)}${r.linked ? ' · tag closed too' : ''}`, 'ok');
  };

  const handleDelete = (e: EntryRecord) => {
    onConfirm(
      `${T('Delete', lang)}?`,
      e.summary,
      async () => {
        const r = await onApi<ModuleResponse>('e.del', { id: e.id, mod: 'wn', date: e.date });
        onUpdateModData(r);
      },
      true
    );
  };

  const renderThumb = (id: string | undefined, big = false) => {
    if (!id) return null;
    const url = photoUrl(id);
    return (
      <button
        key={id}
        type="button"
        className={`wph${big ? ' big' : ''}`}
        onClick={() => onOpenPhoto?.(url)}
        title="View photo"
      >
        <img
          src={url}
          alt="WN photo"
          onError={(ev) => {
            (ev.currentTarget.parentElement as HTMLElement)?.classList.add('noimg');
          }}
        />
      </button>
    );
  };

  const combinedLog = [
    ...modData.rows,
    ...adjToday.filter((e) => !modData.rows.some((x) => x.id === e.id)),
  ];

  return (
    <>
      <TopBar
        title={T('WN Garments', lang)}
        sub={`Without number · ${fLong(date)} · ${unit}`}
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
          ref={photoInputRef}
          type="file"
          accept="image/*"
          className="hide"
          onChange={handlePhotoSelect}
        />

        <div className="grid g3">
          <div className="kpi bad">
            <div className="l">Garments pending</div>
            <div className="v">{openGarments.length}</div>
          </div>
          <div className="kpi gold">
            <div className="l">Tags pending</div>
            <div className="v">{openTags.length}</div>
          </div>
          <div className="kpi ok">
            <div className="l">Adjusted today</div>
            <div className="v">{adjGarmentsToday}</div>
          </div>
        </div>

        <div className="rtabs mt">
          {(
            [
              ['garment', 'Tag missing (WN garment)'],
              ['tag', 'Detached tag'],
            ] as const
          ).map(([k, lbl]) => (
            <button key={k} type="button" className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
              {T(lbl, lang)}
            </button>
          ))}
        </div>

        <div className="cols2">
          <div className="card">
            {tab === 'garment' ? (
              <>
                <label className="lbl">
                  {T('Take photo', lang)} <small>(1 needed, 2nd optional)</small>
                </label>
                <div className="phrow">
                  {wn.photos.map((id, idx) => (
                    <div className="phbox" key={id}>
                      {renderThumb(id, true)}
                      <button
                        type="button"
                        className="phx"
                        aria-label="Remove"
                        onClick={() =>
                          setWn((p) => ({ ...p, photos: p.photos.filter((_, i) => i !== idx) }))
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {wn.photos.length < 2 && (
                    <button
                      type="button"
                      className="phadd"
                      onClick={() => photoInputRef.current?.click()}
                    >
                      <Ico name="cam" size={28} />
                      <b>{wn.photos.length ? '2nd photo' : T('Take photo', lang)}</b>
                      <small>{wn.photos.length ? 'optional — back / mark' : 'garment without tag'}</small>
                    </button>
                  )}
                </div>

                <label className="lbl">{T('Garment', lang)}</label>
                <Chips
                  list={settings.garments || []}
                  value={wn.garment}
                  onToggle={(v) => setWn((p) => ({ ...p, garment: p.garment === v ? '' : v }))}
                  canAdd
                  onAdd={() => onAddList('garments', (val) => setWn((p) => ({ ...p, garment: val })))}
                  lang={lang}
                />

                <label className="lbl">{T('Ironed by', lang)}</label>
                <Chips
                  list={settings.teams.iron || []}
                  value={wn.karigar}
                  onToggle={(v) => setWn((p) => ({ ...p, karigar: p.karigar === v ? '' : v }))}
                  canAdd
                  onAdd={() => onAddList('teams.iron', (val) => setWn((p) => ({ ...p, karigar: val })))}
                  lang={lang}
                />

                <label className="lbl">
                  {T('Note', lang)} <small>(colour, brand, any mark)</small>
                </label>
                <input value={wn.note} onChange={(e) => setWn((p) => ({ ...p, note: e.target.value }))} />

                {(isMgr || date === today) && (
                  <SaveBar meName={me.name} unit={unit} label={T('Save', lang)} onSave={handleSaveGarment} />
                )}
              </>
            ) : (
              <>
                <label className="lbl">Tag / invoice no.</label>
                <input
                  value={wt.tag}
                  autoCapitalize="characters"
                  onChange={(e) => setWt((p) => ({ ...p, tag: e.target.value.toUpperCase() }))}
                />

                <label className="lbl">{T('Store', lang)}</label>
                <Chips
                  list={storeList}
                  value={wt.store}
                  onToggle={(v) => setWt((p) => ({ ...p, store: p.store === v ? '' : v }))}
                  lang={lang}
                />

                <label className="lbl">
                  {T('Garment', lang)} <small>(if written on the tag)</small>
                </label>
                <Chips
                  list={settings.garments || []}
                  value={wt.garment}
                  onToggle={(v) => setWt((p) => ({ ...p, garment: p.garment === v ? '' : v }))}
                  lang={lang}
                />

                <label className="lbl">{T('Note', lang)}</label>
                <input value={wt.note} onChange={(e) => setWt((p) => ({ ...p, note: e.target.value }))} />

                {(isMgr || date === today) && (
                  <SaveBar
                    meName={me.name}
                    unit={unit}
                    label="Save tag & email store"
                    onSave={handleSaveTag}
                  />
                )}
              </>
            )}
            <LockNote isMgr={isMgr} lang={lang} />
          </div>

          <div>
            <div className="h2" style={{ marginTop: 0 }}>
              WN garments — to adjust
              <span className="cnt">oldest first</span>
            </div>
            <div className="card tight list">
              {openGarments.length ? (
                openGarments.map((e) => {
                  const a = wa[e.id] || {};
                  const dd = daysBetween(e.date, today);
                  const matchTag =
                    a.inv && openTags.find((x) => x.data.tag === String(a.inv).toUpperCase());
                  const photoIds: string[] = (e.data.photos || [e.data.photo]).filter(Boolean);
                  return (
                    <div className="li" key={e.id} style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
                      <div className="phs">{photoIds.map((pid) => renderThumb(pid, false))}</div>
                      <div className="main">
                        <b>{e.data.garment}</b>
                        <small>
                          {T('Ironed by', lang)} <b>{e.data.karigar}</b> · {fD(e.date)} ·{' '}
                          <span style={{ color: dd > 2 ? 'var(--bad)' : 'inherit' }}>
                            {dd} {T('days', lang)}
                          </span>
                          {e.data.note ? ` · ${e.data.note}` : ''}
                        </small>
                      </div>
                      <div className="wnadj">
                        <input
                          placeholder={T('Invoice no.', lang)}
                          value={a.inv || ''}
                          onChange={(ev) =>
                            setWa((prev) => ({
                              ...prev,
                              [e.id]: { ...a, inv: ev.target.value.toUpperCase() },
                            }))
                          }
                        />
                        <select
                          value={a.store || ''}
                          onChange={(ev) =>
                            setWa((prev) => ({
                              ...prev,
                              [e.id]: { ...a, store: ev.target.value },
                            }))
                          }
                        >
                          <option value="">{T('Store', lang)}</option>
                          {storeList.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <button type="button" className="btn sm ok" onClick={() => handleAdjust(e, false)}>
                          {T('Adjust', lang)}
                        </button>
                      </div>
                      {matchTag && (
                        <div className="who" style={{ flex: '1 1 100%', marginTop: 6 }}>
                          ✓ Matches detached tag {matchTag.data.tag} ({matchTag.store}) — it will close too
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="empty">✓ No WN garment pending</div>
              )}
            </div>

            <div className="h2">
              Detached tags — garment to find
              <span className="cnt">{openTags.length}</span>
            </div>
            <div className="card tight list">
              {openTags.length ? (
                openTags.map((e) => {
                  const dd = daysBetween(e.date, today);
                  return (
                    <div className="li" key={e.id}>
                      <span className="badge b-gold">{e.store}</span>
                      <div className="main">
                        <b>
                          {e.data.tag}
                          {e.data.garment ? ` · ${e.data.garment}` : ''}
                        </b>
                        <small>
                          {fD(e.date)} · {dd} {T('days', lang)} · {e.by}
                          {e.data.note ? ` · ${e.data.note}` : ''}
                          {e.data.mail
                            ? ` · ${/:/.test(e.data.mail) ? `✉ sent ${e.data.mail}` : `✉ ${e.data.mail}`}`
                            : ''}
                        </small>
                      </div>
                      <button
                        type="button"
                        className="btn sm ghost"
                        onClick={() => handleAdjust(e, true)}
                      >
                        Garment found
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="empty">✓ No detached tag pending</div>
              )}
            </div>

            <EntryList
              rows={combinedLog}
              me={me}
              lang={lang}
              renderMain={(e) => (
                <>
                  <b>{e.summary}</b>
                  <small>
                    {fD(e.date)} {e.at} · {e.by}
                    {e.data.adjBy
                      ? ` · adjusted by ${e.data.adjBy} ${String(e.data.adjAt || '').slice(11)}`
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
