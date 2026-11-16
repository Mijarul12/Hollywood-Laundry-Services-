import React, { useMemo, useState } from 'react';
import { fLong, greet, GROUPS, hm, MODULES, n0, sumNums, T } from '../config/workshopConfig';
import type { AutosData, HomeData, LangId, UserMe } from '../types/workshop';
import { TopBar } from './CommonUI';
import { Ico } from './Icons';
import { WaterBubbles } from './WaterBubbles';

function tileInfo(id: string, a: AutosData | undefined, lang: LangId): { content: React.ReactNode; status: string } {
  if (!a) return { content: <span className="nil">—</span>, status: '' };
  switch (id) {
    case 'rp':
      return a.rp.entries
        ? {
            content: (
              <>
                <em>{a.rp.entries}</em> entries · {a.rp.people.length} people
              </>
            ),
            status: 'ok',
          }
        : { content: <span className="nil">—</span>, status: 'warn' };
    case 'scan':
      return a.scan.total
        ? {
            content: (
              <>
                UL <em>{n0(a.scan.UL)}</em> · PC <em>{n0(a.scan.PC)}</em>
              </>
            ),
            status: a.due ? 'ok' : 'warn',
          }
        : { content: <span className="nil">—</span>, status: 'warn' };
    case 'iron':
      return a.iron.entries
        ? {
            content: (
              <>
                <em>{a.iron.points}</em> pts · {Object.keys(a.iron.byK).length} karigar
              </>
            ),
            status: 'ok',
          }
        : { content: <span className="nil">—</span>, status: 'warn' };
    case 'rewash': {
      const bal = sumNums(Object.values(a.rewash.balance));
      return {
        content: (
          <>
            {T('Balance', lang)} <em>{bal}</em> {T('pcs', lang)}
          </>
        ),
        status: Object.keys(a.rewash.today).length ? 'ok' : '',
      };
    }
    case 'repair':
      return {
        content: (
          <>
            <em>{a.repair.pending}</em> open{a.repair.back ? ` · ${a.repair.back} back` : ''}
          </>
        ),
        status: a.repair.pending ? 'warn' : 'ok',
      };
    case 'washerr':
      return a.washerr.count
        ? {
            content: (
              <>
                <em>{a.washerr.count}</em> · {a.washerr.points} pts
              </>
            ),
            status: 'bad',
          }
        : { content: <span className="nil">0 today</span>, status: '' };
    case 'grc':
      return a.grc
        ? {
            content: (
              <>
                Total <em>{a.grc.total}</em>
              </>
            ),
            status: 'ok',
          }
        : { content: <span className="nil">—</span>, status: 'warn' };
    case 'staffErr':
      return a.staffErr.count
        ? {
            content: (
              <>
                <em>{a.staffErr.count}</em> {T('errors', lang)}
              </>
            ),
            status: 'bad',
          }
        : { content: <span className="nil">0 today</span>, status: '' };
    case 'wn':
      return a.wn.pendingG || a.wn.pendingT
        ? {
            content: (
              <>
                <em>{a.wn.pendingG}</em> garments · <em>{a.wn.pendingT}</em> tags pending
              </>
            ),
            status: a.wn.adjToday ? 'ok' : a.wn.pendingG ? 'warn' : '',
          }
        : {
            content: <span className="nil">—</span>,
            status: a.wn.adjToday ? 'ok' : '',
          };
    case 'saree':
      return a.saree.pending
        ? {
            content: (
              <>
                <em>{a.saree.pending}</em> at polish · {a.saree.batches} lot(s)
              </>
            ),
            status: a.saree.sentToday || a.saree.recvToday ? 'ok' : '',
          }
        : {
            content: <span className="nil">—</span>,
            status: a.saree.sentToday || a.saree.recvToday ? 'ok' : '',
          };
    case 'meter':
      return a.meter
        ? {
            content: (
              <>
                {Object.keys(a.meter.readings).map((k, idx) => {
                  const u = a.meter?.used[k];
                  return (
                    <React.Fragment key={k}>
                      {idx > 0 ? ' · ' : ''}
                      {k} <em>{u == null ? '✓' : u}</em>
                    </React.Fragment>
                  );
                })}
              </>
            ),
            status: 'ok',
          }
        : { content: <span className="nil">—</span>, status: 'warn' };
    case 'spot':
      return a.spot.count
        ? {
            content: (
              <>
                <em>{a.spot.count}</em> · avg {a.spot.avg}%
              </>
            ),
            status: 'ok',
          }
        : { content: <span className="nil">—</span>, status: '' };
    case 'quickfix':
      return a.quickfix.count
        ? {
            content: (
              <>
                <em>{a.quickfix.qf}</em> QF · <em>{a.quickfix.ir}</em> IR
              </>
            ),
            status: 'ok',
          }
        : { content: <span className="nil">—</span>, status: '' };
    case 'boiler': {
      const ks = Object.keys(a.boiler);
      const on = ks.filter((k) => a.boiler[k].on);
      if (on.length) {
        return {
          content: (
            <>
              <em style={{ color: 'var(--ok)' }}>Running</em> · {on.join(', ')}
            </>
          ),
          status: 'ok',
        };
      }
      if (ks.length) {
        return {
          content: <>{hm(sumNums(ks.map((k) => a.boiler[k].mins)))}</>,
          status: '',
        };
      }
      return { content: <>{T('Off', lang)}</>, status: '' };
    }
    case 'reports':
      return { content: 'Daily · weekly · monthly', status: '' };
    case 'performance':
      return { content: 'Weekly trends · units', status: '' };
    case 'settings':
      return { content: 'Stores, staff, users', status: '' };
    default:
      return { content: '', status: '' };
  }
}

export const HomeView: React.FC<{
  me: UserMe;
  today: string;
  unit: string;
  lang: LangId;
  homeData: HomeData | null;
  usage: Record<string, number>;
  onLang: (l: LangId) => void;
  onRefresh: () => void;
  onLogout: () => void;
  onPickUnit: () => void;
  onNavigate: (view: string) => void;
}> = ({ me, today, unit, lang, homeData, usage, onLang, onRefresh, onLogout, onPickUnit, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState<'all' | 'office' | 'process' | 'admin'>('all');

  const can = (m: string) => me.modules.includes(m);
  const a = homeData?.autos;
  const dl = homeData?.daily;
  const pct = dl && dl.total ? Math.round((dl.filled / dl.total) * 100) : 0;
  const rewashBal = a ? sumNums(Object.values(a.rewash.balance)) : 0;
  const qNorm = query.trim().toLowerCase();

  const availableGroups = useMemo(
    () =>
      GROUPS.filter(([grpId]) => {
        if (grpId === 'daily') return false;
        return MODULES.some((m) => m.grp === grpId && can(m.id));
      }),
    [me.modules]
  );

  const visibleCount = useMemo(() => {
    let total = 0;
    GROUPS.forEach(([grpId]) => {
      if (grpId !== 'daily' && groupFilter !== 'all' && grpId !== groupFilter) return;
      MODULES.forEach((m) => {
        if (m.grp !== grpId || !can(m.id)) return;
        const label = T(m.t, lang).toLowerCase();
        if (qNorm && !label.includes(qNorm) && !m.t.toLowerCase().includes(qNorm) && !m.id.toLowerCase().includes(qNorm)) {
          return;
        }
        total += 1;
      });
    });
    return total;
  }, [me.modules, groupFilter, qNorm, lang]);

  return (
    <>
      <TopBar
        title={T('Workshop Operational Control', lang)}
        sub={`Hollywood Laundry Service · ${unit}`}
        lang={lang}
        onLang={onLang}
        me={me}
        unit={unit}
        onRefresh={onRefresh}
        onLogout={onLogout}
        onPickUnit={onPickUnit}
      />
      <main>
        <div className="hero">
          <WaterBubbles variant="hero" />
          <div className="flex between" style={{ alignItems: 'flex-start', position: 'relative', zIndex: 1, gap: 12 }}>
            <div>
              <div className="hi">{T(greet(), lang)},</div>
              <div className="nm">{me.name}</div>
              <div className="dt">Unit {unit}</div>
            </div>
            <div className="hero-top-right">
              <div className="hero-date">{fLong(today)}</div>
              {can('daily') && (
                <button
                  type="button"
                  className="ring"
                  style={{ '--p': dl?.submitted ? 100 : pct } as React.CSSProperties}
                  onClick={() => onNavigate('daily')}
                  title="Open Daily Report"
                >
                  <div>
                    {dl?.submitted ? '✓' : `${pct}%`}
                    <small>DAILY</small>
                  </div>
                </button>
              )}
            </div>
          </div>
          {a && (
            <div className="hstats">
              <button
                type="button"
                className={`hstat-btn${can('scan') ? '' : ' disabled'}`}
                disabled={!can('scan')}
                onClick={() => can('scan') && onNavigate('scan')}
              >
                <b>{n0(a.scan.total)}</b>
                <span>{T('Scanned today', lang)}</span>
              </button>
              <button
                type="button"
                className={`hstat-btn${can('scan') ? '' : ' disabled'}`}
                disabled={!can('scan')}
                onClick={() => can('scan') && onNavigate('scan')}
              >
                <b>{a.due ? n0(a.due.total) : '—'}</b>
                <span>
                  {T('Pending', lang)}
                  {a.due && a.due.od > 0 && (
                    <>
                      {' '}
                      · <span style={{ color: '#FFB4A6' }}>{a.due.od} {T('Overdue', lang)}</span>
                    </>
                  )}
                </span>
              </button>
              <button
                type="button"
                className={`hstat-btn${can('rewash') ? '' : ' disabled'}`}
                disabled={!can('rewash')}
                onClick={() => can('rewash') && onNavigate('rewash')}
              >
                <b>{rewashBal}</b>
                <span>
                  {T('Rewash', lang)} {T('Balance', lang)}
                </span>
              </button>
              <button
                type="button"
                className={`hstat-btn${can('repair') ? '' : ' disabled'}`}
                disabled={!can('repair')}
                onClick={() => can('repair') && onNavigate('repair')}
              >
                <b>{a.repair.pending}</b>
                <span>{T('Open repairs', lang)}</span>
              </button>
            </div>
          )}
        </div>

        {/* Daily Spotlight + Quick Filter Toolbar */}
        {can('daily') && (
          <div className="tiles mt">
            <button type="button" className="tile wide" onClick={() => onNavigate('daily')}>
              <div className="ic">
                <Ico name="daily" />
              </div>
              <div className="grow">
                <b>{T('Daily Report', lang)}</b>
                <div className="tv">
                  {dl?.submitted ? (
                    <>
                      <em style={{ color: 'var(--ok)' }}>✓ {T('Submitted', lang)}</em> · {dl.submitted}
                    </>
                  ) : dl ? (
                    <>
                      <em>
                        {dl.filled}/{dl.total}
                      </em>{' '}
                      points filled
                    </>
                  ) : (
                    'Not started'
                  )}
                </div>
              </div>
              <Ico name="next" />
            </button>
          </div>
        )}

        <div className="home-filter mt">
          <div className="home-search">
            <Ico name="search" size={16} />
            <input
              type="search"
              value={query}
              placeholder="Find screen (Scan, GRC, Performance, Reports…)"
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {availableGroups.length > 1 && (
            <div className="rseg" role="group" aria-label="Filter screens by group">
              <button
                type="button"
                className={groupFilter === 'all' ? 'on' : ''}
                style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                onClick={() => setGroupFilter('all')}
              >
                All
              </button>
              {availableGroups.map(([grpId, grpLabel]) => (
                <button
                  key={grpId}
                  type="button"
                  className={groupFilter === grpId ? 'on' : ''}
                  style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                  onClick={() => setGroupFilter(grpId as any)}
                >
                  {T(grpLabel, lang)}
                </button>
              ))}
            </div>
          )}
        </div>

        {GROUPS.filter(([g]) => g !== 'daily').map(([grpId, grpLabel]) => {
          if (groupFilter !== 'all' && grpId !== groupFilter) return null;
          const ms = MODULES.filter((m) => m.grp === grpId && can(m.id))
            .filter((m) => {
              if (!qNorm) return true;
              const lbl = T(m.t, lang).toLowerCase();
              return lbl.includes(qNorm) || m.t.toLowerCase().includes(qNorm) || m.id.toLowerCase().includes(qNorm);
            })
            .map((m, i) => ({ m, i }))
            .sort((x, y) => (usage[y.m.id] || 0) - (usage[x.m.id] || 0) || x.i - y.i)
            .map((x) => x.m);
          if (!ms.length) return null;
          return (
            <React.Fragment key={grpId}>
              {grpLabel && (
                <div className="h2">
                  <span>{T(grpLabel, lang)}</span>
                  <span className="cnt">{ms.length} screens</span>
                </div>
              )}
              <div className="tiles">
                {ms.map((m) => {
                  const ti = tileInfo(m.id, a, lang);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className={`tile s-${ti.status || 'none'}`}
                      onClick={() => onNavigate(m.id)}
                    >
                      <div className="ic">
                        <Ico name={m.icon} />
                      </div>
                      <div className="tt">
                        <b>{T(m.t, lang)}</b>
                        <div className="tv">{ti.content}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </React.Fragment>
          );
        })}

        {visibleCount === 0 && (
          <div className="card mt" style={{ textAlign: 'center', padding: '28px 16px' }}>
            <b style={{ fontSize: 15 }}>No screens match “{query}”</b>
            <div className="mt">
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => {
                  setQuery('');
                  setGroupFilter('all');
                }}
              >
                Show all screens
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
};
