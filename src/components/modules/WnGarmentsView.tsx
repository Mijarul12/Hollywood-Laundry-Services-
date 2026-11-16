import React, { useRef, useState } from 'react';
import { isSamePhotoFingerprint, preparePhotoUpload } from '../../api/client';
import { daysBetween, fD, fLong, photoUrl, T } from '../../config/workshopConfig';
import type { EntryRecord, ModuleResponse } from '../../types/workshop';
import { Chips, DateBar, EntryList, LockNote, SaveBar, TopBar } from '../CommonUI';
import type { ModuleViewProps } from './ReleasePackView';

type AngleKey = 'front' | 'back' | 'left' | 'right';

interface SlotPhoto {
  id: string;
  sha256: string;
  dhash: string;
}

const ANGLES: { key: AngleKey; label: string; short: string; hint: string }[] = [
  { key: 'front', label: 'Front', short: 'F', hint: 'Chest & buttons' },
  { key: 'back', label: 'Back', short: 'B', hint: 'Back & yoke' },
  { key: 'left', label: 'Left', short: 'L', hint: 'Left sleeve/side' },
  { key: 'right', label: 'Right', short: 'R', hint: 'Right sleeve/side' },
];

const ShirtAngleSvg: React.FC<{ angle: AngleKey }> = ({ angle }) => {
  if (angle === 'front') {
    return (
      <svg viewBox="0 0 64 64" className="phsvg" aria-hidden="true">
        <path
          d="M22 10 L12 16 L6 28 L14 32 L18 24 L18 54 L46 54 L46 24 L50 32 L58 28 L52 16 L42 10 C39 16 25 16 22 10 Z"
          fill="rgba(176,125,38,0.12)"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path d="M22 10 L32 21 L42 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <line x1="32" y1="21" x2="32" y2="54" stroke="currentColor" strokeWidth="1.8" strokeDasharray="3 3" />
        <circle cx="32" cy="28" r="1.4" fill="currentColor" />
        <circle cx="32" cy="36" r="1.4" fill="currentColor" />
        <circle cx="32" cy="44" r="1.4" fill="currentColor" />
        <rect x="36" y="26" width="6" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  if (angle === 'back') {
    return (
      <svg viewBox="0 0 64 64" className="phsvg" aria-hidden="true">
        <path
          d="M22 11 L12 16 L6 28 L14 32 L18 24 L18 54 L46 54 L46 24 L50 32 L58 28 L52 16 L42 11 C38 14 26 14 22 11 Z"
          fill="rgba(22,38,59,0.08)"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path d="M16 21 Q32 23 48 21" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <line x1="32" y1="22" x2="32" y2="30" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (angle === 'left') {
    return (
      <svg viewBox="0 0 64 64" className="phsvg" aria-hidden="true">
        <path
          d="M26 10 L38 11 L44 22 L42 54 L22 54 L20 26 L10 34 L6 26 L18 14 Z"
          fill="rgba(176,125,38,0.12)"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path d="M22 25 L11 33" stroke="currentColor" strokeWidth="1.8" />
        <path d="M13 18 L5 18 M5 18 L9 14 M5 18 L9 22" fill="none" stroke="var(--gold)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 64" className="phsvg" aria-hidden="true">
      <path
        d="M38 10 L26 11 L20 22 L22 54 L42 54 L44 26 L54 34 L58 26 L46 14 Z"
        fill="rgba(176,125,38,0.12)"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path d="M42 25 L53 33" stroke="currentColor" strokeWidth="1.8" />
      <path d="M51 18 L59 18 M59 18 L55 14 M59 18 L55 22" fill="none" stroke="var(--gold)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

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
  const [wn, setWn] = useState<{
    garment: string;
    karigar: string;
    angles: Partial<Record<AngleKey, SlotPhoto>>;
    note: string;
  }>({
    garment: '',
    karigar: '',
    angles: {},
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
  const targetAngleRef = useRef<AngleKey>('front');

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

  const uploadedCount = ANGLES.filter((a) => !!wn.angles[a.key]).length;

  const knownFingerprints = () => {
    const fps: { sha256?: string; dhash?: string }[] = [];
    const seenIds = new Set<string>();
    const allSaved = [...openGarments, ...modData.rows, ...adjToday];
    for (const entry of allSaved) {
      if (entry.data.kind !== 'garment' || seenIds.has(entry.id)) continue;
      seenIds.add(entry.id);
      const shas: string[] = Array.isArray(entry.data.photoHashes) ? entry.data.photoHashes : [];
      const dhashes: string[] = Array.isArray(entry.data.photoDHashes) ? entry.data.photoDHashes : [];
      const len = Math.max(shas.length, dhashes.length);
      for (let i = 0; i < len; i++) {
        fps.push({ sha256: shas[i], dhash: dhashes[i] });
      }
    }
    return fps;
  };

  const triggerAngleUpload = (angle: AngleKey) => {
    targetAngleRef.current = angle;
    photoInputRef.current?.click();
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = '';

    const startKey = targetAngleRef.current;
    const slotOrder: AngleKey[] = [
      startKey,
      ...ANGLES.map((a) => a.key).filter((k) => k !== startKey && !wn.angles[k]),
    ];
    const slotsToFill = files.length === 1 ? [startKey] : slotOrder.slice(0, files.length);

    onLoading?.(true, `⏳ Checking & uploading ${files.length > 1 ? `${files.length} photos` : 'photo'}…`);
    try {
      const savedFps = knownFingerprints();
      const nextAngles: Partial<Record<AngleKey, SlotPhoto>> = { ...wn.angles };
      let added = 0;
      let duplicateBlocked = 0;

      for (let i = 0; i < slotsToFill.length && i < files.length; i++) {
        const slot = slotsToFill[i];
        const file = files[i];
        const prepared = await preparePhotoUpload(file, 1100, 0.72);
        const fp = { sha256: prepared.sha256, dhash: prepared.dhash };

        const otherSlots = ANGLES.map((a) => a.key)
          .filter((k) => k !== slot && nextAngles[k])
          .map((k) => nextAngles[k]!);

        if (otherSlots.some((x) => isSamePhotoFingerprint(x, fp)) || savedFps.some((x) => isSamePhotoFingerprint(x, fp))) {
          duplicateBlocked++;
          continue;
        }

        const res = await onApi<{ id: string; url: string; hash?: string }>('photo', { data: prepared.base64, name: `wn_${slot}` }, true);
        nextAngles[slot] = {
          id: res.id,
          sha256: res.hash || prepared.sha256,
          dhash: prepared.dhash,
        };
        added++;
      }

      setWn((prev) => ({ ...prev, angles: nextAngles }));
      if (duplicateBlocked > 0 && added === 0) {
        onToast('Same photo not allowed — upload a new different photo', 'err');
      } else if (duplicateBlocked > 0) {
        onToast(`✓ ${added} uploaded · ${duplicateBlocked} duplicate skipped (use a new photo)`, 'err');
      } else if (added > 0) {
        const total = ANGLES.filter((a) => !!nextAngles[a.key]).length;
        onToast(`✓ ${total} / 4 garment photos ready`, 'ok');
      }
    } catch (err: any) {
      onToast(`Photo: ${err?.message || err}`, 'err');
    } finally {
      onLoading?.(false);
    }
  };

  const handleSaveGarment = async () => {
    const uploaded = ANGLES.map((a) => ({ key: a.key, photo: wn.angles[a.key] })).filter((x) => !!x.photo);
    if (uploaded.length < 1) {
      onToast('Upload at least 1 garment photo (other 3 optional)', 'err');
      return;
    }
    if (!wn.garment || !wn.karigar) {
      onToast(`${T('Garment', lang)} + ${T('Ironed by', lang)}`, 'err');
      return;
    }
    const photoAngles: Partial<Record<AngleKey, string>> = {};
    uploaded.forEach((x) => {
      photoAngles[x.key] = x.photo!.id;
    });
    const r = await onApi<ModuleResponse>('e.add', {
      mod: 'wn',
      date,
      items: [
        {
          kind: 'garment',
          garment: wn.garment,
          karigar: wn.karigar,
          photos: uploaded.map((x) => x.photo!.id),
          photoAngles,
          photoHashes: uploaded.map((x) => x.photo!.sha256),
          photoDHashes: uploaded.map((x) => x.photo!.dhash),
          note: wn.note,
        },
      ],
    });
    onUpdateModData(r);
    setWn((prev) => ({ garment: prev.garment, karigar: prev.karigar, angles: {}, note: '' }));
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

  const renderThumb = (id: string | undefined, big = false, tagLabel?: string) => {
    if (!id) return null;
    const url = photoUrl(id);
    return (
      <button
        key={`${tagLabel || ''}_${id}`}
        type="button"
        className={`wph${big ? ' big' : ''}`}
        onClick={() => onOpenPhoto?.(url)}
        title={tagLabel ? `View ${tagLabel} photo` : 'View photo'}
      >
        <img
          src={url}
          alt={tagLabel ? `${tagLabel} photo` : 'WN photo'}
          onError={(ev) => {
            (ev.currentTarget.parentElement as HTMLElement)?.classList.add('noimg');
          }}
        />
        {tagLabel && <span className="wphtag">{tagLabel}</span>}
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
          multiple
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
                  Shirt / Garment photos{' '}
                  <small>
                    (1 required, other 3 optional · {uploadedCount}/4)
                  </small>
                </label>
                <div className="phgrid4">
                  {ANGLES.map((ang) => {
                    const slotPhoto = wn.angles[ang.key];
                    return (
                      <div className={`phslot${slotPhoto ? ' filled' : ''}`} key={ang.key}>
                        <span className="phbadge">{ang.label}</span>
                        {slotPhoto ? (
                          <div className="phbox">
                            {renderThumb(slotPhoto.id, true, ang.label)}
                            <button
                              type="button"
                              className="phx"
                              aria-label={`Remove ${ang.label}`}
                              onClick={() =>
                                setWn((p) => {
                                  const next = { ...p.angles };
                                  delete next[ang.key];
                                  return { ...p, angles: next };
                                })
                              }
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="phadd-slot"
                            onClick={() => triggerAngleUpload(ang.key)}
                          >
                            <ShirtAngleSvg angle={ang.key} />
                            <b>{ang.label}</b>
                            <small>{ang.hint}</small>
                          </button>
                        )}
                      </div>
                    );
                  })}
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
                  const anglesObj = e.data.photoAngles as Record<string, string> | undefined;
                  const photoItems: { id: string; tag?: string }[] = anglesObj
                    ? ANGLES.map((a) => ({ id: anglesObj[a.key], tag: a.short })).filter((x) => !!x.id)
                    : ((e.data.photos || [e.data.photo]).filter(Boolean) as string[]).map((id, idx) => ({
                        id,
                        tag: ANGLES[idx]?.short,
                      }));
                  return (
                    <div className="li" key={e.id} style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
                      <div className="phs">{photoItems.map((p) => renderThumb(p.id, false, p.tag))}</div>
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
