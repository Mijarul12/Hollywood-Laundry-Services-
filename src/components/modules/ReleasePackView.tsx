import React, { useEffect, useState } from 'react';
import { fLong, T, uniq } from '../../config/workshopConfig';
import type { EntryRecord, LangId, ModuleResponse, UserMe, WorkshopSettings } from '../../types/workshop';
import { DateBar, EntryList, LockNote, TopBar, WhoBox } from '../CommonUI';

export interface ModuleViewProps {
  me: UserMe;
  settings: WorkshopSettings;
  today: string;
  date: string;
  unit: string;
  lang: LangId;
  modData: ModuleResponse | null;
  onLang: (l: LangId) => void;
  onBack: () => void;
  onRefresh: () => void;
  onPickUnit: () => void;
  onShiftDate: (delta: number) => void;
  onDateChange: (d: string) => void;
  onApi: <T = any>(action: string, p?: Record<string, any>, quiet?: boolean) => Promise<T>;
  onUpdateModData: (next: ModuleResponse) => void;
  onToast: (msg: string, kind?: '' | 'ok' | 'err') => void;
  onAddList: (listPath: string, onAdded?: (val: string) => void) => void;
  onPrompt: (title: string, placeholder: string, defaultValue: string, onSubmit: (val: string) => void) => void;
  onConfirm: (title: string, msg: string, fn: () => void, danger?: boolean) => void;
  onLoading?: (on: boolean, msg?: string) => void;
  onOpenPhoto?: (url: string) => void;
}

export const ReleasePackView: React.FC<ModuleViewProps> = ({
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
  onPrompt,
  onConfirm,
}) => {
  const isMgr = me.role === 'Admin' || me.role === 'Manager';
  const [round, setRound] = useState<string>('');
  const [extraRounds, setExtraRounds] = useState<string[]>([]);
  const [names, setNames] = useState<string[]>([]);

  const allRounds = (() => {
    const r = [...(settings.rounds || ['Urgent', 'Lot 1 – Morning', 'Lot 2 – Evening'])];
    (modData?.rows || []).forEach((e) => {
      if (e.data.round && !r.includes(e.data.round)) r.push(e.data.round);
    });
    extraRounds.forEach((x) => {
      if (!r.includes(x)) r.push(x);
    });
    return r;
  })();

  useEffect(() => {
    if (!round || !allRounds.includes(round)) {
      if (allRounds[0]) setRound(allRounds[0]);
    }
  }, [allRounds.join('|')]);

  const activeRound = round || allRounds[0] || 'Urgent';

  if (!modData) {
    return (
      <>
        <TopBar
          title={T('Release & Pack', lang)}
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

  const rows = modData.rows || [];
  const cur = rows.filter((e) => e.data.round === activeRound);
  const storeList = settings.stores.map((s) => s.code);
  const cell = (s: string, t: 'Release' | 'Pack') => cur.filter((e) => e.store === s && e.data.type === t);
  const relCount = storeList.filter((s) => cell(s, 'Release').length > 0).length;
  const packCount = storeList.filter((s) => cell(s, 'Pack').length > 0).length;

  const handleTap = async (store: string, type: 'Release' | 'Pack') => {
    if (isMgr && !names.length) {
      onToast(`① ${T('Choose at least one name', lang)}`, 'err');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const useNames = isMgr ? [...names] : [me.name];
    const r = await onApi<ModuleResponse>('e.add', {
      mod: 'rp',
      date,
      items: [{ round: activeRound, store, type, names: useNames }],
    });
    onUpdateModData(r);
    onToast(`✓ ${T(activeRound, lang)} · ${store} · ${T(type, lang)} — ${useNames.join(', ')}`, 'ok');
  };

  const handleDelete = (e: EntryRecord) => {
    onConfirm(
      `${T('Delete', lang)}?`,
      e.summary,
      async () => {
        const r = await onApi<ModuleResponse>('e.del', { id: e.id, mod: 'rp', date: e.date });
        onUpdateModData(r);
      },
      true
    );
  };

  return (
    <>
      <TopBar
        title={T('Release & Pack', lang)}
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

        <div className="rtabs">
          {allRounds.map((r) => {
            const cnt = rows.filter((e) => e.data.round === r).length;
            return (
              <button
                key={r}
                type="button"
                className={activeRound === r ? 'on' : ''}
                onClick={() => setRound(r)}
              >
                {T(r, lang)}
                {cnt > 0 && <i>{cnt}</i>}
              </button>
            );
          })}
          <button
            type="button"
            className="add"
            onClick={() =>
              onPrompt('Name of the new round', 'Round name', `Lot ${allRounds.length}`, (val) => {
                if (!allRounds.includes(val)) setExtraRounds((prev) => [...prev, val]);
                setRound(val);
              })
            }
          >
            + {T('Add', lang)}
          </button>
        </div>

        <div className="card">
          <div className="steph">
            <span className="stepn">1</span>
            {T(isMgr ? 'Tap names' : 'Who did it?', lang)}
          </div>
          <div className="mt">
            <WhoBox
              me={me}
              settings={settings}
              value={names}
              multi
              onToggle={(n) => setNames((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]))}
              onAddOffice={() => onAddList('teams.office')}
              lang={lang}
            />
          </div>
        </div>

        <div className="card">
          <div className="steph between">
            <span className="flex" style={{ gap: 8 }}>
              <span className="stepn">2</span>
              {T('Tap store', lang)}
            </span>
            <span className="badge b-gold" style={{ marginLeft: 'auto' }}>
              {T(activeRound, lang)}
            </span>
          </div>
          <div className="flex mt" style={{ gap: 6 }}>
            <span className="badge b-ok">
              {T('Release', lang)} {relCount}/{storeList.length}
            </span>
            <span className="badge b-UL">
              {T('Pack', lang)} {packCount}/{storeList.length}
            </span>
          </div>
          <div className="rpgrid">
            {storeList.map((s) => (
              <div className="rprow" key={s}>
                <div className="sc">{s}</div>
                {(['Release', 'Pack'] as const).map((t) => {
                  const es = cell(s, t);
                  const who = uniq(es.flatMap((e) => (e.data.names as string[]) || []));
                  return (
                    <button
                      key={t}
                      type="button"
                      className={`rpc${es.length ? ` done ${t}` : ''}`}
                      disabled={!isMgr && date < today}
                      onClick={() => handleTap(s, t)}
                    >
                      <b>
                        {es.length ? '✓ ' : ''}
                        {T(t, lang)}
                      </b>
                      <small>{es.length ? who.join(', ') : T('Pending', lang)}</small>
                      {es.length > 0 && <em>{es[es.length - 1].at}</em>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <LockNote isMgr={isMgr} lang={lang} />
        </div>

        <EntryList
          rows={rows}
          title={T('Today', lang)}
          me={me}
          lang={lang}
          renderMain={(e) => (
            <>
              <b>
                <span className={`badge ${e.data.type === 'Release' ? 'b-ok' : 'b-UL'}`}>
                  {T(e.data.type, lang)}
                </span>{' '}
                {T(e.data.round, lang)} · {e.store}
              </b>
              <small>
                {(e.data.names || []).join(', ')} · {e.at} · by {e.by}
              </small>
            </>
          )}
          onDelete={handleDelete}
        />
      </main>
    </>
  );
};
