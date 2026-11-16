import React, { useEffect, useState } from 'react';
import {
  getSettingPath,
  LISTS,
  MODULES,
  n0,
  OFFICE_M,
  PROCESS_M,
  SPANELS,
  T,
  THEMES,
  uniq,
} from '../config/workshopConfig';
import type {
  BackupStats,
  LangId,
  Role,
  ThemeId,
  UserMe,
  UserRecord,
  WorkshopSettings,
} from '../types/workshop';
import { ModalSheet, TopBar } from './CommonUI';
import { Ico } from './Icons';

function cloneSettings(s: WorkshopSettings): WorkshopSettings {
  return JSON.parse(JSON.stringify(s));
}

function setSettingPath(obj: any, path: string, val: any) {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!cur[keys[i]]) cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = val;
}

const ListEditorCard: React.FC<{
  title: string;
  items: string[];
  onChange: (next: string[]) => void;
}> = ({ title, items, onChange }) => {
  const [draft, setDraft] = useState('');

  const addItem = () => {
    const v = draft.trim();
    if (!v) return;
    if (!items.includes(v)) onChange([...items, v]);
    setDraft('');
  };

  return (
    <div className="card ledit">
      <b>{title}</b>
      <div className="chips mt">
        {items.map((item, idx) => (
          <span className="chip" key={`${item}-${idx}`}>
            {item}
            <button
              type="button"
              aria-label={`Remove ${item}`}
              onClick={() => onChange(items.filter((_, i) => i !== idx))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="addin">
        <input
          value={draft}
          placeholder={`Add ${title.toLowerCase()}`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addItem();
            }
          }}
        />
        <button type="button" className="btn sm gold" onClick={addItem}>
          + Add
        </button>
      </div>
    </div>
  );
};

export const SettingsView: React.FC<{
  me: UserMe;
  settings: WorkshopSettings;
  today: string;
  unit: string;
  lang: LangId;
  onLang: (l: LangId) => void;
  onBack: () => void;
  onPickUnit: () => void;
  onApi: <T = any>(action: string, p?: Record<string, any>, quiet?: boolean) => Promise<T>;
  onSettingsUpdated: (next: WorkshopSettings) => void;
  onPreviewTheme: (theme: ThemeId) => void;
  onToast: (msg: string, kind?: '' | 'ok' | 'err') => void;
  onConfirm: (title: string, msg: string, fn: () => void, danger?: boolean) => void;
  onLoading: (on: boolean, msg?: string) => void;
}> = ({
  me,
  settings,
  today,
  unit,
  lang,
  onLang,
  onBack,
  onPickUnit,
  onApi,
  onSettingsUpdated,
  onPreviewTheme,
  onToast,
  onConfirm,
  onLoading,
}) => {
  const [panel, setPanel] = useState<string | null>(null);
  const [draft, setDraft] = useState<WorkshopSettings>(() => cloneSettings(settings));
  const [users, setUsers] = useState<UserRecord[] | null>(null);
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [exportModal, setExportModal] = useState<{
    filename: string;
    full: boolean;
    entries: number;
    lots: number;
    users: number;
    daily?: number;
  } | null>(null);

  useEffect(() => {
    setDraft(cloneSettings(settings));
  }, [settings]);

  const loadPanel = async (id: string) => {
    setPanel(id);
    if (id === 'users' && !users) {
      try {
        const list = await onApi<UserRecord[]>('users.list', {}, true);
        setUsers(list);
      } catch (e: any) {
        onToast(e.message || 'Failed to load users', 'err');
      }
    }
    if (id === 'backup' && !stats) {
      try {
        const st = await onApi<BackupStats>('backup.stats', {}, true);
        setStats(st);
      } catch (e: any) {
        onToast(e.message || 'Failed to load stats', 'err');
      }
    }
  };

  const handleSaveSettings = async () => {
    const clean = cloneSettings(draft);
    clean.units = clean.units.map((u) => u.trim().toUpperCase()).filter(Boolean);
    if (!clean.units.length) {
      onToast('Keep at least one unit', 'err');
      return;
    }
    clean.stores = clean.stores
      .map((s) => ({
        ...s,
        code: s.code.trim().toUpperCase(),
        aliases: s.aliases.map((a) => a.trim().toUpperCase()).filter(Boolean),
        email: (s.email || '').trim(),
      }))
      .filter((s) => s.code);
    const res = await onApi<WorkshopSettings>('settings.save', { settings: clean });
    onSettingsUpdated(res);
    setDraft(cloneSettings(res));
    onToast(`✓ ${T('Saved', lang)}`, 'ok');
  };

  const handleSaveUsers = async () => {
    if (!users) return;
    const clean = users.filter((u) => u.name.trim());
    const res = await onApi<UserRecord[]>('users.save', { users: clean });
    setUsers(res);
    onToast(`✓ ${T('Saved', lang)}`, 'ok');
  };

  const handleExport = async (all: boolean) => {
    onLoading(true, all ? 'Creating FULL backup…' : 'Creating backup…');
    try {
      const r = await onApi<{ data: Record<string, any>; url: string }>(
        all ? 'backup.exportAll' : 'backup.export',
        {}
      );
      const filename = `workshop-${all ? 'FULL' : 'backup'}-${today}.json`;
      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' });
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
      const c = r.data.counts || {};
      setExportModal({
        filename,
        full: all,
        entries: Number(c.entries || 0),
        lots: Number(c.lots || 0),
        users: Number(c.users || 0),
        daily: c.daily !== undefined ? Number(c.daily) : undefined,
      });
      onToast('✓ Backup exported', 'ok');
    } finally {
      onLoading(false);
    }
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const d = JSON.parse(text);
      if (!d || d.app !== 'Workshop Operational Control' || !d.settings || !Array.isArray(d.users)) {
        onToast('This is not a Workshop backup file', 'err');
        return;
      }
      const c = d.counts || {};
      const msg = [
        `From: ${d.exportedAt || '?'}`,
        `Users: ${d.users.length}`,
        `Stores: ${(d.settings.stores || []).length}`,
        `Entries: ${c.entries ?? (d.entries || []).length}`,
        `Lots: ${c.lots ?? (d.lots || []).length}`,
        ...(d.daily ? [`Daily reports: ${d.daily.length}`] : []),
        '',
        'Settings and users will match the backup. Existing entries will not be duplicated.',
      ].join('\n');

      onConfirm('Import backup?', msg, async () => {
        onLoading(true, 'Importing backup…');
        try {
          const r = await onApi<{
            entries: number;
            lots: number;
            users: number;
            daily: number;
            settings: WorkshopSettings;
          }>('backup.import', { data: d });
          onSettingsUpdated(r.settings);
          setDraft(cloneSettings(r.settings));
          setUsers(null);
          const freshStats = await onApi<BackupStats>('backup.stats', {}, true);
          setStats(freshStats);
          onToast(
            `✓ Imported: ${r.entries} entries, ${r.lots} lots${r.daily ? `, ${r.daily} daily` : ''}`,
            'ok'
          );
        } finally {
          onLoading(false);
        }
      });
    } catch {
      onToast('Could not read JSON backup file', 'err');
    }
  };

  const visiblePanels = SPANELS.filter(([, , , , adminOnly]) => !adminOnly || me.role === 'Admin');
  const activePanelMeta = visiblePanels.find(([id]) => id === panel) || null;
  const allStaffPool = uniq([
    ...(draft.teams.office || []),
    ...(draft.teams.iron || []),
    ...(draft.teams.wash || []),
    ...(draft.teams.spot || []),
    ...(draft.teams.qf || []),
  ]);

  const updateList = (path: string, next: string[]) => {
    const copy = cloneSettings(draft);
    setSettingPath(copy, path, next);
    setDraft(copy);
  };

  const renderPanelContent = () => {
    if (!panel) return null;

    switch (panel) {
      case 'general':
        return (
          <div className="sgrid">
            <div className="card">
              <b>Colour theme</b>
              <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                Tap to preview. Save to apply for all users.
              </p>
              <div className="themes mt">
                {THEMES.map(([id, name, cols]) => (
                  <button
                    key={id}
                    type="button"
                    className={draft.theme === id ? 'on' : ''}
                    onClick={() => {
                      setDraft((prev) => ({ ...prev, theme: id }));
                      onPreviewTheme(id);
                    }}
                  >
                    <div className="sw">
                      {cols.map((c) => (
                        <i key={c} style={{ background: c }} />
                      ))}
                    </div>
                    {name}
                  </button>
                ))}
              </div>
            </div>
            <ListEditorCard
              title="Workshop units"
              items={draft.units}
              onChange={(next) => setDraft((prev) => ({ ...prev, units: next.map((u) => u.toUpperCase()) }))}
            />
          </div>
        );

      case 'stores':
        return (
          <div className="card">
            <div className="flex between">
              <div>
                <b>Stores</b>
                <p className="muted" style={{ fontSize: 13 }}>
                  Store email receives Missing Sticker, Missing Garment, Pending GRC and WN adjustment alerts.
                </p>
              </div>
              <button
                type="button"
                className="btn sm gold"
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    stores: [...prev.stores, { code: '', aliases: [], pc: false, email: '' }],
                  }))
                }
              >
                + Store
              </button>
            </div>
            <div className="srow stores-row sh mt">
              <span>Code</span>
              <span>Other names</span>
              <span>Unit</span>
              <span />
              <span className="sem">Store email</span>
            </div>
            {draft.stores.map((s, idx) => (
              <div className="srow stores-row" key={idx}>
                <input
                  value={s.code}
                  placeholder="Code"
                  onChange={(e) => {
                    const next = [...draft.stores];
                    next[idx] = { ...s, code: e.target.value.toUpperCase() };
                    setDraft((prev) => ({ ...prev, stores: next }));
                  }}
                />
                <input
                  value={(s.aliases || []).join(', ')}
                  placeholder="Comma separated"
                  onChange={(e) => {
                    const next = [...draft.stores];
                    next[idx] = {
                      ...s,
                      aliases: e.target.value
                        .split(',')
                        .map((x) => x.trim().toUpperCase())
                        .filter(Boolean),
                    };
                    setDraft((prev) => ({ ...prev, stores: next }));
                  }}
                />
                <button
                  type="button"
                  className={`btn sm ${s.pc ? 'gold' : 'ghost'}`}
                  onClick={() => {
                    const next = [...draft.stores];
                    next[idx] = { ...s, pc: !s.pc };
                    setDraft((prev) => ({ ...prev, stores: next }));
                  }}
                >
                  {s.pc ? 'PC' : 'UL'}
                </button>
                <button
                  type="button"
                  className="ibtn"
                  title="Remove store"
                  onClick={() =>
                    onConfirm(
                      'Delete store?',
                      s.code || 'Remove this store row?',
                      () => {
                        setDraft((prev) => ({
                          ...prev,
                          stores: prev.stores.filter((_, i) => i !== idx),
                        }));
                      },
                      true
                    )
                  }
                >
                  <Ico name="trash" />
                </button>
                <input
                  type="email"
                  className="sem"
                  placeholder="store@email.com (for alerts)"
                  value={s.email || ''}
                  onChange={(e) => {
                    const next = [...draft.stores];
                    next[idx] = { ...s, email: e.target.value };
                    setDraft((prev) => ({ ...prev, stores: next }));
                  }}
                />
              </div>
            ))}
          </div>
        );

      case 'staff':
        return (
          <div className="sgrid">
            {LISTS.filter(([p]) => p.startsWith('teams.')).map(([path, title]) => (
              <ListEditorCard
                key={path}
                title={title}
                items={(getSettingPath(draft, path) as string[]) || []}
                onChange={(next) => updateList(path, next)}
              />
            ))}
          </div>
        );

      case 'lists':
        return (
          <div className="sgrid">
            {LISTS.filter(([p]) => !p.startsWith('teams.')).map(([path, title]) => (
              <ListEditorCard
                key={path}
                title={title}
                items={(getSettingPath(draft, path) as string[]) || []}
                onChange={(next) => updateList(path, next)}
              />
            ))}
            <div className="card">
              <b>Washing error — default severity points (1–10)</b>
              <div className="tw mt">
                <table className="tbl sm">
                  <tbody>
                    {(draft.damageTypes || []).map((dt) => (
                      <tr key={dt}>
                        <td>{dt}</td>
                        <td className="n" style={{ width: 90 }}>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={draft.damagePoints?.[dt] ?? 5}
                            style={{ minHeight: 34, padding: '4px 8px', textAlign: 'right' }}
                            onChange={(e) => {
                              const n = Math.min(10, Math.max(1, Number(e.target.value) || 5));
                              setDraft((prev) => ({
                                ...prev,
                                damagePoints: { ...prev.damagePoints, [dt]: n },
                              }));
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      case 'boilers':
        return (
          <div className="sgrid">
            <div className="card">
              <div className="flex between">
                <b>Boilers</b>
                <button
                  type="button"
                  className="btn sm gold"
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      boilers: [
                        ...prev.boilers,
                        { name: `Boiler ${prev.boilers.length + 1}`, unit: prev.units[0] || 'UL', staff: [] },
                      ],
                    }))
                  }
                >
                  + Boiler
                </button>
              </div>
              {draft.boilers.map((b, idx) => (
                <div className="mt" key={idx} style={{ paddingTop: idx > 0 ? 10 : 0, borderTop: idx > 0 ? '1px solid var(--line2)' : 'none' }}>
                  <div className="flex" style={{ gap: 8 }}>
                    <input
                      value={b.name}
                      placeholder="Boiler name"
                      onChange={(e) => {
                        const next = [...draft.boilers];
                        next[idx] = { ...b, name: e.target.value };
                        setDraft((prev) => ({ ...prev, boilers: next }));
                      }}
                    />
                    <select
                      value={b.unit}
                      style={{ width: 92 }}
                      onChange={(e) => {
                        const next = [...draft.boilers];
                        next[idx] = { ...b, unit: e.target.value };
                        setDraft((prev) => ({ ...prev, boilers: next }));
                      }}
                    >
                      {draft.units.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="ibtn"
                      title="Delete boiler"
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          boilers: prev.boilers.filter((_, i) => i !== idx),
                        }))
                      }
                    >
                      <Ico name="trash" />
                    </button>
                  </div>
                  <div className="lbl mt">Boiler staff</div>
                  <div className="chips">
                    {allStaffPool.map((st) => {
                      const on = (b.staff || []).includes(st);
                      return (
                        <button
                          key={st}
                          type="button"
                          className={`chip${on ? ' on' : ''}`}
                          onClick={() => {
                            const next = [...draft.boilers];
                            const cur = b.staff || [];
                            next[idx] = {
                              ...b,
                              staff: cur.includes(st) ? cur.filter((x) => x !== st) : [...cur, st],
                            };
                            setDraft((prev) => ({ ...prev, boilers: next }));
                          }}
                        >
                          {st}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="flex between">
                <b>Electricity & Water meters</b>
                <button
                  type="button"
                  className="btn sm gold"
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      meters: [...prev.meters, { name: '', measure: 'kWh' }],
                    }))
                  }
                >
                  + Meter
                </button>
              </div>
              {draft.meters.map((m, idx) => (
                <div className="flex mt" style={{ gap: 8 }} key={idx}>
                  <input
                    value={m.name}
                    placeholder="Meter name"
                    onChange={(e) => {
                      const next = [...draft.meters];
                      next[idx] = { ...m, name: e.target.value };
                      setDraft((prev) => ({ ...prev, meters: next }));
                    }}
                  />
                  <input
                    value={m.measure}
                    placeholder="Unit (kWh / L)"
                    style={{ width: 110 }}
                    onChange={(e) => {
                      const next = [...draft.meters];
                      next[idx] = { ...m, measure: e.target.value };
                      setDraft((prev) => ({ ...prev, meters: next }));
                    }}
                  />
                  <button
                    type="button"
                    className="ibtn"
                    title="Delete meter"
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        meters: prev.meters.filter((_, i) => i !== idx),
                      }))
                    }
                  >
                    <Ico name="trash" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );

      case 'alerts':
        return (
          <div className="card">
            <b>Email recipients</b>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Separate multiple email addresses with commas. Store emails are set in the Stores panel.
            </p>
            <div className="mt">
              <label className="lbl">Admin email</label>
              <input
                type="text"
                placeholder="admin@company.com"
                value={draft.alerts.admin || ''}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, alerts: { ...prev.alerts, admin: e.target.value } }))
                }
              />
            </div>
            <div className="mt">
              <label className="lbl">Manager email</label>
              <input
                type="text"
                placeholder="manager@company.com"
                value={draft.alerts.manager || ''}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, alerts: { ...prev.alerts, manager: e.target.value } }))
                }
              />
            </div>
            <div className="mt">
              <label className="lbl">Accounts email</label>
              <input
                type="text"
                placeholder="accounts@company.com"
                value={draft.alerts.account || ''}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, alerts: { ...prev.alerts, account: e.target.value } }))
                }
              />
            </div>

            <div className="h2 mt2">Alert routing</div>
            <div className="tw">
              <table className="tbl sm">
                <thead>
                  <tr>
                    <th>Trigger</th>
                    <th>Sent to</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Challan name entry error (Daily)</td>
                    <td>Admin + Accounts</td>
                  </tr>
                  <tr>
                    <td>Extra sticker / missing garment (Daily)</td>
                    <td>Admin + Store</td>
                  </tr>
                  <tr>
                    <td>Extra garment / missing sticker (Daily)</td>
                    <td>Admin + Store</td>
                  </tr>
                  <tr>
                    <td>Previous day GRC pending (Daily)</td>
                    <td>Admin + Store</td>
                  </tr>
                  <tr>
                    <td>Garment repair sent / released</td>
                    <td>Manager / Store</td>
                  </tr>
                  <tr>
                    <td>WN garment logged / adjusted</td>
                    <td>Admin + Store</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'users':
        return (
          <div className="card">
            <div className="flex between">
              <div>
                <b>Users & access</b>
                <p className="muted" style={{ fontSize: 13 }}>
                  Leave PIN blank to keep existing PIN. Enter 4 digits to change or add a user.
                </p>
              </div>
              <button
                type="button"
                className="btn sm gold"
                onClick={() =>
                  setUsers((prev) => [
                    ...(prev || []),
                    { name: '', role: 'Staff', pin: '', modules: [...OFFICE_M], active: true, units: [draft.units[0] || 'UL'] },
                  ])
                }
              >
                + User
              </button>
            </div>
            {!users ? (
              <div className="empty">
                <div className="spin" />
              </div>
            ) : (
              <>
                <div className="mt">
                  {users.map((u, idx) => (
                    <div className="urow" key={idx}>
                      <div className="g">
                        <input
                          value={u.name}
                          placeholder="Name"
                          onChange={(e) => {
                            const next = [...users];
                            next[idx] = { ...u, name: e.target.value };
                            setUsers(next);
                          }}
                        />
                        <select
                          value={u.role}
                          onChange={(e) => {
                            const next = [...users];
                            next[idx] = { ...u, role: e.target.value as Role };
                            setUsers(next);
                          }}
                        >
                          <option value="Admin">Admin</option>
                          <option value="Manager">Manager</option>
                          <option value="Staff">Staff</option>
                        </select>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={4}
                          placeholder="4-digit"
                          value={u.pin || ''}
                          onChange={(e) => {
                            const next = [...users];
                            next[idx] = { ...u, pin: e.target.value.replace(/\D/g, '').slice(0, 4) };
                            setUsers(next);
                          }}
                        />
                      </div>
                      <div className="chips mt">
                        {draft.units.map((un) => {
                          const hasU = u.units.includes(un);
                          return (
                            <button
                              key={un}
                              type="button"
                              className={`chip${hasU ? ' on' : ''}`}
                              onClick={() => {
                                const next = [...users];
                                next[idx] = {
                                  ...u,
                                  units: hasU ? u.units.filter((x) => x !== un) : [...u.units, un],
                                };
                                setUsers(next);
                              }}
                            >
                              {un}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          className={`chip${u.active ? ' on' : ''}`}
                          onClick={() => {
                            const next = [...users];
                            next[idx] = { ...u, active: !u.active };
                            setUsers(next);
                          }}
                        >
                          {u.active ? 'Active' : 'Disabled'}
                        </button>
                        <button
                          type="button"
                          className="chip"
                          onClick={() => {
                            const next = [...users];
                            next[idx] = { ...u, modules: [...OFFICE_M] };
                            setUsers(next);
                          }}
                        >
                          Office set
                        </button>
                        <button
                          type="button"
                          className="chip"
                          onClick={() => {
                            const next = [...users];
                            next[idx] = { ...u, modules: [...PROCESS_M] };
                            setUsers(next);
                          }}
                        >
                          Process set
                        </button>
                        {u.role !== 'Admin' && (
                          <button
                            type="button"
                            className="chip"
                            style={{ color: 'var(--bad)' }}
                            onClick={() =>
                              onConfirm(
                                'Remove user?',
                                u.name || 'Delete this user?',
                                () => setUsers(users.filter((_, i) => i !== idx)),
                                true
                              )
                            }
                          >
                            Delete
                          </button>
                        )}
                      </div>
                      <div className="chips mt">
                        {MODULES.map((m) => {
                          const hasM = u.modules.includes(m.id);
                          return (
                            <button
                              key={m.id}
                              type="button"
                              className={`chip${hasM ? ' on' : ''}`}
                              onClick={() => {
                                const next = [...users];
                                next[idx] = {
                                  ...u,
                                  modules: hasM ? u.modules.filter((x) => x !== m.id) : [...u.modules, m.id],
                                };
                                setUsers(next);
                              }}
                            >
                              {m.t}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" className="btn gold block mt2" onClick={handleSaveUsers}>
                  <Ico name="check" /> Save users
                </button>
              </>
            )}
          </div>
        );

      case 'backup': {
        const sizeMB = stats ? Math.round((stats.cells / (1024 * 1024)) * 100) / 100 : 0;
        return (
          <div className="sgrid">
            <div className="card">
              <b>Database status</b>
              {!stats ? (
                <div className="empty">
                  <div className="spin" />
                </div>
              ) : (
                <div className="pk mt">
                  <div>
                    <b>{n0(stats.entries)}</b>
                    <span>Entries</span>
                  </div>
                  <div>
                    <b>{n0(stats.daily)}</b>
                    <span>Daily reports</span>
                  </div>
                  <div>
                    <b>{n0(stats.lots)}</b>
                    <span>Lots</span>
                  </div>
                  <div>
                    <b>{n0(stats.users)}</b>
                    <span>Users</span>
                  </div>
                  <div>
                    <b>{sizeMB} MB</b>
                    <span>Database size</span>
                  </div>
                  <div>
                    <b>{n0(stats.log)}</b>
                    <span>Audit log</span>
                  </div>
                </div>
              )}
            </div>

            <div className="card">
              <b>Export & move</b>
              <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                Download a JSON backup file of open pending work & masters, or the full database archive.
              </p>
              <button type="button" className="btn gold block mt2" onClick={() => handleExport(false)}>
                <Ico name="up" /> Export masters & pending
              </button>
              <button type="button" className="btn ghost block mt" onClick={() => handleExport(true)}>
                <Ico name="up" /> Export ALL data
              </button>
              <label className="btn ghost block mt" style={{ cursor: 'pointer' }}>
                <Ico name="plus" /> Import backup file
                <input
                  type="file"
                  accept=".json,application/json"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) handleImportFile(f);
                  }}
                />
              </label>
              <button
                type="button"
                className="btn ghost block mt"
                onClick={async () => {
                  onLoading(true, 'Syncing to Supabase…');
                  try {
                    const st = await onApi<{
                      schemaReady: boolean;
                      missingTables: string[];
                      lastError: string | null;
                    }>('backup.syncSupabase', {});
                    if (!st.schemaReady) {
                      onToast(
                        st.lastError ||
                          `Create Supabase tables first using supabase/schema.sql (${st.missingTables.length} missing)`,
                        'err'
                      );
                    } else {
                      onToast('✓ All workshop data synced to Supabase', 'ok');
                    }
                  } finally {
                    onLoading(false);
                  }
                }}
              >
                <Ico name="up" /> Sync all data to Supabase
              </button>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <>
      <TopBar
        title={T('Settings', lang)}
        sub="Masters, themes, users & backup"
        back
        lang={lang}
        onLang={onLang}
        me={me}
        unit={unit}
        onBack={onBack}
        onPickUnit={onPickUnit}
      />
      <main className="wide">
        <div className={`slay${panel ? ' has' : ''}`}>
          <nav className="smenu">
            {visiblePanels.map(([id, title, icon, desc]) => (
              <button
                key={id}
                type="button"
                className={`sitem${panel === id ? ' on' : ''}`}
                onClick={() => loadPanel(id)}
              >
                <span className="ri">
                  <Ico name={icon} />
                </span>
                <span className="st">
                  <b>{title}</b>
                  <small>{desc}</small>
                </span>
                <Ico name="next" />
              </button>
            ))}
          </nav>

          <section className="spane">
            {!panel ? (
              <div className="card empty">
                <Ico name="gear" size={40} />
                <br />
                Choose a setting
              </div>
            ) : (
              <>
                <div className="rbar">
                  <button type="button" className="rback" onClick={() => setPanel(null)}>
                    <Ico name="back" /> All settings
                  </button>
                  <h2>{activePanelMeta?.[1]}</h2>
                </div>
                {renderPanelContent()}
              </>
            )}
          </section>
        </div>
      </main>

      {panel && panel !== 'users' && panel !== 'backup' && (
        <div className="savebar">
          <div className="row">
            <span className="pill">{activePanelMeta?.[1]}</span>
            <span className="grow" />
            <button type="button" className="btn gold btn-save" onClick={handleSaveSettings}>
              <Ico name="check" /> Save settings
            </button>
          </div>
        </div>
      )}

      <ModalSheet open={!!exportModal} onClose={() => setExportModal(null)}>
        {exportModal && (
          <>
            <b style={{ fontSize: 18 }}>
              ✓ {exportModal.full ? 'Full backup downloaded' : 'Backup downloaded'}
            </b>
            <p className="muted mt" style={{ fontSize: 13.5 }}>
              File saved: <b>{exportModal.filename}</b>
            </p>
            <div className="pk mt">
              <div>
                <b>{exportModal.users}</b>
                <span>Users</span>
              </div>
              <div>
                <b>{exportModal.entries}</b>
                <span>Entries</span>
              </div>
              <div>
                <b>{exportModal.lots}</b>
                <span>Lots</span>
              </div>
              {exportModal.daily !== undefined && (
                <div>
                  <b>{exportModal.daily}</b>
                  <span>Daily</span>
                </div>
              )}
            </div>
            <button type="button" className="btn gold block mt2" onClick={() => setExportModal(null)}>
              Done
            </button>
          </>
        )}
      </ModalSheet>
    </>
  );
};
