import React, { useEffect, useMemo, useRef, useState } from 'react';
import { addD, fLong, LOGO_URL, modTitle, MODULES, T } from '../config/workshopConfig';
import type { EntryRecord, LangId, UserMe, WorkshopSettings } from '../types/workshop';
import { Ico } from './Icons';

export interface ConfirmState {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
}

export interface PromptState {
  title: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  onSubmit: (value: string) => void;
}

export interface ToastState {
  msg: string;
  kind: '' | 'ok' | 'err';
  undo?: { ids: string[]; mod: string; date: string } | null;
}

export const BrandLogo: React.FC = () => <img src={LOGO_URL} alt="HLS" />;

export const TopBar: React.FC<{
  title: string;
  sub?: string;
  back?: boolean;
  lang: LangId;
  onLang: (l: LangId) => void;
  me: UserMe | null;
  unit: string;
  onBack?: () => void;
  onRefresh?: () => void;
  onLogout?: () => void;
  onPickUnit?: () => void;
}> = ({ title, sub, back, lang, onLang, me, unit, onBack, onRefresh, onLogout, onPickUnit }) => {
  const canSwitchUnit = (me?.units?.length || 0) > 1;
  return (
    <header className="top">
      <div className="row">
        {back ? (
          <button className="tbtn" onClick={onBack} aria-label="Back">
            <Ico name="back" />
          </button>
        ) : (
          <div className="mono">
            <BrandLogo />
          </div>
        )}
        <div className="ttl">
          <b className={back ? '' : 'brand'}>{title}</b>
          <span>{sub || ''}</span>
        </div>
        <div className="lang">
          {(['en', 'hi', 'bn'] as LangId[]).map((l) => (
            <button key={l} className={lang === l ? 'on' : ''} onClick={() => onLang(l)}>
              {l === 'en' ? 'EN' : l === 'hi' ? 'हि' : 'বা'}
            </button>
          ))}
        </div>
        {unit && (
          <button
            className={`unitb ${unit}`}
            onClick={canSwitchUnit ? onPickUnit : undefined}
            style={!canSwitchUnit ? { cursor: 'default' } : undefined}
          >
            {unit}
          </button>
        )}
        {!back && me && (
          <button className="uchip" onClick={canSwitchUnit ? onPickUnit : undefined}>
            <i>{me.name.charAt(0).toUpperCase()}</i>
            <span>{me.name}</span>
          </button>
        )}
        {me && unit && (
          <button
            type="button"
            className="tbtn"
            onClick={() => window.dispatchEvent(new CustomEvent('ws:qnav'))}
            title="Switch screen (Ctrl+K)"
            aria-label="Switch screen"
          >
            <Ico name="grid" />
          </button>
        )}
        {onRefresh && (
          <button type="button" className="tbtn" onClick={onRefresh} title={T('Refresh', lang)}>
            <Ico name="refresh" />
          </button>
        )}
        {!back && onLogout && (
          <button type="button" className="tbtn" onClick={onLogout} title={T('Logout', lang)}>
            <Ico name="logout" />
          </button>
        )}
      </div>
    </header>
  );
};

export const DateBar: React.FC<{
  date: string;
  today: string;
  isMgr: boolean;
  lang: LangId;
  onShift: (delta: number) => void;
  onDateChange: (d: string) => void;
}> = ({ date, today, isMgr, lang, onShift, onDateChange }) => {
  const isPastStaff = !isMgr && date < today;
  return (
    <div className="datebar-top">
      {isPastStaff && (
        <button
          type="button"
          className="chip"
          style={{ minHeight: 36, padding: '0 12px', fontSize: 12.5, borderRadius: 11 }}
          onClick={() => onDateChange(today)}
        >
          {T('Today', lang)}
        </button>
      )}
      <div className="datebar">
        <button type="button" onClick={() => onShift(-1)} aria-label="Previous day">
          <Ico name="back" />
        </button>
        <div className="d">
          <input
            type="date"
            max={today}
            value={date}
            onChange={(e) => {
              const v = e.target.value;
              if (v && v <= today) onDateChange(v);
            }}
          />
          <small>
            {date === today ? T('Today', lang) : isMgr ? fLong(date) : 'View only'}
          </small>
        </div>
        <button type="button" onClick={() => onShift(1)} disabled={date >= today} aria-label="Next day">
          <Ico name="next" />
        </button>
      </div>
    </div>
  );
};

export const ModHead: React.FC<{
  id: string;
  sub?: string;
  date: string;
  today: string;
  unit: string;
  isMgr: boolean;
  lang: LangId;
  onLang: (l: LangId) => void;
  me: UserMe | null;
  onBack: () => void;
  onRefresh: () => void;
  onShiftDate: (delta: number) => void;
  onDateChange: (d: string) => void;
  onPickUnit: () => void;
}> = ({
  id,
  sub,
  date,
  today,
  unit,
  isMgr,
  lang,
  onLang,
  me,
  onBack,
  onRefresh,
  onShiftDate,
  onDateChange,
  onPickUnit,
}) => (
  <>
    <TopBar
      title={T(modTitle(id), lang)}
      sub={`${sub ? `${sub} · ` : ''}${fLong(date)} · ${unit}`}
      back
      lang={lang}
      onLang={onLang}
      me={me}
      unit={unit}
      onBack={onBack}
      onRefresh={onRefresh}
      onPickUnit={onPickUnit}
    />
    <main className="pb-anchor">
      <DateBar date={date} today={today} isMgr={isMgr} lang={lang} onShift={onShiftDate} onDateChange={onDateChange} />
    </main>
  </>
);

export const SaveBar: React.FC<{
  meName: string;
  unit: string;
  label?: string;
  disabled?: boolean;
  inline?: boolean;
  onSave: () => void;
}> = ({ meName, unit, label, disabled, inline, onSave }) => (
  <div className={inline ? 'savebar-inline' : 'savebar'}>
    <div className="row">
      <span className="pill">
        {meName} · {unit}
      </span>
      <span className="grow" />
      <button type="button" className="btn gold btn-save" disabled={disabled} onClick={onSave}>
        <Ico name="check" /> {label || 'Save'}
      </button>
    </div>
  </div>
);

export const Stepper: React.FC<{
  value: number | string | undefined | null;
  onChange: (n: number) => void;
  cls?: string;
  min?: number;
  quick?: number[];
}> = ({ value, onChange, cls = '', min = 0 }) => {
  const numVal = Number(value || 0);
  const inputRef = useRef<HTMLInputElement>(null);

  const step = (delta: number) => {
    const next = Math.max(min, numVal + delta);
    onChange(next);
  };

  return (
    <div className={`step ${cls}`}>
      <button type="button" onClick={() => step(-1)}>
        −
      </button>
      <input
        ref={inputRef}
        inputMode="numeric"
        pattern="[0-9]*"
        value={value == null || value === '' ? '' : String(value)}
        onFocus={() => setTimeout(() => inputRef.current?.select(), 0)}
        onChange={(e) => {
          const raw = e.target.value.replace(/\D/g, '');
          onChange(raw === '' ? min : Math.max(min, Number(raw)));
        }}
      />
      <button type="button" onClick={() => step(1)}>
        +
      </button>
    </div>
  );
};

export const Chips: React.FC<{
  list: string[];
  value: string | string[];
  multi?: boolean;
  onToggle: (v: string) => void;
  canAdd?: boolean;
  onAdd?: () => void;
  lang: LangId;
}> = ({ list, value, multi, onToggle, canAdd, onAdd, lang }) => {
  const arr = Array.isArray(value) ? value : [];
  return (
    <div className="chips">
      {list.map((item) => {
        const on = multi ? arr.includes(item) : value === item;
        return (
          <button key={item} type="button" className={`chip${on ? ' on' : ''}`} onClick={() => onToggle(item)}>
            {item}
          </button>
        );
      })}
      {canAdd && onAdd && (
        <button type="button" className="chip add" onClick={onAdd}>
          + {T('Add', lang)}
        </button>
      )}
    </div>
  );
};

export const WhoBox: React.FC<{
  me: UserMe;
  settings: WorkshopSettings;
  value: string | string[];
  multi?: boolean;
  onToggle: (name: string) => void;
  onAddOffice: () => void;
  lang: LangId;
}> = ({ me, settings, value, multi, onToggle, onAddOffice, lang }) => {
  const isMgr = me.role === 'Admin' || me.role === 'Manager';
  if (!isMgr) {
    return (
      <div className="who">
        <i>{me.name.charAt(0).toUpperCase()}</i>
        {T('Saved as', lang)}: {me.name}
      </div>
    );
  }
  return (
    <Chips
      list={settings.teams.office || []}
      value={value}
      multi={multi}
      onToggle={onToggle}
      canAdd
      onAdd={onAddOffice}
      lang={lang}
    />
  );
};

export const LockNote: React.FC<{ isMgr: boolean; lang: LangId }> = ({ isMgr, lang }) => {
  if (isMgr) return null;
  return (
    <small className="muted" style={{ display: 'block', marginTop: 8 }}>
      Note: only Manager / Admin can edit or delete after saving. {T('Locked after saving', lang)}.
    </small>
  );
};

export function canUserDeleteEntry(e: EntryRecord, me: UserMe): boolean {
  if (me.role === 'Admin' || me.role === 'Manager') return true;
  if (e.by !== me.name) return false;
  const iso = e.stamp.replace(' ', 'T') + '+05:30';
  const ageMin = (Date.now() - new Date(iso).getTime()) / 60000;
  if (!(ageMin >= 0 && ageMin <= 5)) return false;
  if (['repair', 'saree', 'wn'].includes(e.mod)) {
    const reqStatus = e.mod === 'saree' || e.mod === 'repair' ? 'Sent' : 'Pending';
    if (e.data.status !== reqStatus) return false;
  }
  return true;
}

export const EntryList: React.FC<{
  rows: EntryRecord[];
  title?: string;
  me: UserMe;
  lang: LangId;
  renderMain: (e: EntryRecord) => React.ReactNode;
  onEdit?: (e: EntryRecord) => void;
  onDelete: (e: EntryRecord) => void;
}> = ({ rows, title, me, lang, renderMain, onEdit, onDelete }) => {
  const isMgr = me.role === 'Admin' || me.role === 'Manager';
  return (
    <>
      <div className="h2">
        {title || T('Today', lang)}
        <span className="cnt">{rows.length}</span>
      </div>
      <div className="card tight list">
        {rows.length ? (
          rows
            .slice()
            .reverse()
            .map((e) => (
              <div className="li" key={e.id}>
                <div className="main">{renderMain(e)}</div>
                {isMgr && onEdit && (
                  <button type="button" className="ibtn" title="Edit" onClick={() => onEdit(e)}>
                    <Ico name="edit" />
                  </button>
                )}
                {canUserDeleteEntry(e, me) && (
                  <button type="button" className="ibtn" title={T('Delete', lang)} onClick={() => onDelete(e)}>
                    <Ico name="trash" />
                  </button>
                )}
              </div>
            ))
        ) : (
          <div className="empty">{T('Nothing yet', lang)}</div>
        )}
      </div>
    </>
  );
};

export const ModalSheet: React.FC<{ open: boolean; onClose: () => void; children: React.ReactNode }> = ({
  open,
  onClose,
  children,
}) => {
  if (!open) return null;
  return (
    <div
      className="ov"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet">
        <div className="grab" />
        {children}
      </div>
    </div>
  );
};

export const ConfirmModal: React.FC<{
  state: ConfirmState | null;
  lang: LangId;
  onClose: () => void;
}> = ({ state, lang, onClose }) => (
  <ModalSheet open={!!state} onClose={onClose}>
    {state && (
      <>
        <b style={{ fontSize: 18, display: 'block' }}>{state.title}</b>
        {state.message && (
          <p className="muted" style={{ marginTop: 8, whiteSpace: 'pre-line', fontSize: 14.5 }}>
            {state.message}
          </p>
        )}
        <div className="flex mt2">
          <button type="button" className="btn ghost" onClick={onClose}>
            {T('Cancel', lang)}
          </button>
          <button
            type="button"
            className={`btn grow ${state.danger ? 'bad' : 'gold'}`}
            onClick={() => {
              const fn = state.onConfirm;
              onClose();
              fn();
            }}
          >
            <Ico name="check" /> {state.confirmLabel || 'OK'}
          </button>
        </div>
      </>
    )}
  </ModalSheet>
);

export const PromptModal: React.FC<{
  state: PromptState | null;
  lang: LangId;
  onClose: () => void;
}> = ({ state, lang, onClose }) => {
  const [val, setVal] = useState('');
  useEffect(() => {
    if (state) setVal(state.defaultValue || '');
  }, [state]);

  return (
    <ModalSheet open={!!state} onClose={onClose}>
      {state && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = val.trim();
            if (!trimmed) return;
            const fn = state.onSubmit;
            onClose();
            fn(trimmed);
          }}
        >
          <b style={{ fontSize: 18, display: 'block' }}>{state.title}</b>
          <input
            autoFocus
            className="mt"
            placeholder={state.placeholder || ''}
            value={val}
            onChange={(e) => setVal(e.target.value)}
          />
          <div className="flex mt2">
            <button type="button" className="btn ghost" onClick={onClose}>
              {T('Cancel', lang)}
            </button>
            <button type="submit" className="btn gold grow">
              <Ico name="check" /> {state.confirmLabel || T('Add', lang)}
            </button>
          </div>
        </form>
      )}
    </ModalSheet>
  );
};

export const PhotoLightbox: React.FC<{ url: string | null; onClose: () => void }> = ({ url, onClose }) => (
  <ModalSheet open={!!url} onClose={onClose}>
    {url && (
      <div style={{ textAlign: 'center' }}>
        <img
          src={url}
          alt="WN Garment"
          style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 14, margin: '0 auto', display: 'block' }}
        />
        <button type="button" className="btn ghost block mt" onClick={onClose}>
          Close
        </button>
      </div>
    )}
  </ModalSheet>
);

export const Toast: React.FC<{
  toast: ToastState | null;
  onUndo: () => void;
}> = ({ toast, onUndo }) => (
  <div id="toast" className={toast ? `show ${toast.kind}${toast.undo && toast.kind === 'ok' ? ' act' : ''}` : ''}>
    {toast && (
      <>
        <span>{toast.msg}</span>
        {toast.undo && toast.kind === 'ok' && (
          <button type="button" onClick={onUndo}>
            Undo
          </button>
        )}
      </>
    )}
  </div>
);

export const Loader: React.FC<{ active: boolean; msg: string }> = ({ active, msg }) => (
  <div id="loader" className={active ? 'on' : ''}>
    <div style={{ textAlign: 'center' }}>
      <div className="spin" />
      <div id="loadMsg">{msg}</div>
    </div>
  </div>
);

export const QuickNavModal: React.FC<{
  open: boolean;
  me: UserMe | null;
  currentView: string;
  lang: LangId;
  onClose: () => void;
  onNavigate: (view: string) => void;
}> = ({ open, me, currentView, lang, onClose, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);

  const items = useMemo(() => {
    if (!me) return [];
    const base = [
      { id: 'home', label: T('Workshop Operational Control', lang), sub: 'Main dashboard', icon: 'grid' },
      ...MODULES.filter((m) => me.modules.includes(m.id)).map((m) => ({
        id: m.id,
        label: T(m.t, lang),
        sub: m.grp === 'office' ? 'Office work' : m.grp === 'process' ? 'Process work' : m.grp === 'admin' ? 'Manage' : 'Daily',
        icon: m.icon,
      })),
    ];
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (it) =>
        it.label.toLowerCase().includes(q) ||
        it.sub.toLowerCase().includes(q) ||
        it.id.toLowerCase().includes(q)
    );
  }, [me, lang, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
    }
  }, [open]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  if (!open || !me) return null;

  return (
    <div
      className="ov qnav-ov"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="qnav" role="dialog" aria-label="Quick screen switcher">
        <div className="qnav-head">
          <Ico name="search" size={18} />
          <input
            autoFocus
            type="search"
            value={query}
            placeholder="Jump to screen (Daily, Scan, Performance, Reports…)"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                onClose();
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setCursor((c) => (items.length ? (c + 1) % items.length : 0));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setCursor((c) => (items.length ? (c - 1 + items.length) % items.length : 0));
              } else if (e.key === 'Enter' && items[cursor]) {
                e.preventDefault();
                onNavigate(items[cursor].id);
                onClose();
              }
            }}
          />
          <button type="button" className="btn ghost sm" style={{ minHeight: 34, padding: '0 10px' }} onClick={onClose}>
            Esc
          </button>
        </div>
        <div className="qnav-list">
          {items.length ? (
            items.map((it, idx) => (
              <button
                key={it.id}
                type="button"
                className={`qnav-item${idx === cursor ? ' sel' : ''}${it.id === currentView ? ' cur' : ''}`}
                onMouseEnter={() => setCursor(idx)}
                onClick={() => {
                  onNavigate(it.id);
                  onClose();
                }}
              >
                <span className="ri">
                  <Ico name={it.icon} size={18} />
                </span>
                <span className="grow" style={{ textAlign: 'left', minWidth: 0 }}>
                  <b>{it.label}</b>
                  <small>{it.sub}</small>
                </span>
                {it.id === currentView && <span className="qnav-cur">Current</span>}
              </button>
            ))
          ) : (
            <div className="empty" style={{ padding: 24 }}>
              No matching screen
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export function shiftDateClamp(cur: string, delta: number, today: string): string {
  const next = addD(cur, delta);
  return next > today ? today : next;
}
