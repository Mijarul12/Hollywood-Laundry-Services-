import React, { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { addD, fD, hm, n0, T, weekStartC } from '../config/workshopConfig';
import type { LangId, PerformanceOverviewData, UserMe } from '../types/workshop';
import { TopBar } from './CommonUI';
import { Ico } from './Icons';

type MetricMode = 'output' | 'scan' | 'grc' | 'finishing' | 'errors';
type CategoryFilter = 'All' | 'Volume' | 'Process & Finishing' | 'Quality' | 'Utilities';

const UNIT_COLORS: Record<string, { stroke: string; fill: string }> = {
  UL: { stroke: '#1B6B4F', fill: '#1B6B4F' },
  PC: { stroke: '#B87324', fill: '#B87324' },
};

const FALLBACK_COLORS = [
  { stroke: '#2B4378', fill: '#2B4378' },
  { stroke: '#7A3E65', fill: '#7A3E65' },
  { stroke: '#3B4C28', fill: '#3B4C28' },
];

function unitPalette(unitCode: string, idx: number) {
  return UNIT_COLORS[unitCode] || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}

const METRIC_OPTIONS: { id: MetricMode; label: string; suffix: string }[] = [
  { id: 'output', label: 'Combined Output', suffix: 'ops / pcs' },
  { id: 'scan', label: 'Scanned', suffix: 'pcs' },
  { id: 'grc', label: 'GRC Count', suffix: 'pcs' },
  { id: 'finishing', label: 'Finishing & Rewash', suffix: 'items' },
  { id: 'errors', label: 'Quality Errors', suffix: 'pts' },
];

function metricDataKey(unitCode: string, mode: MetricMode): string {
  if (mode === 'output') return unitCode;
  return `${unitCode}_${mode}`;
}

const ChartTooltip: React.FC<{
  active?: boolean;
  payload?: any[];
  label?: string;
  suffix?: string;
}> = ({ active, payload, label, suffix }) => {
  if (!active || !payload || !payload.length) return null;
  const total = payload.reduce((sum, p) => sum + (Number(p.value) || 0), 0);
  return (
    <div
      style={{
        background: 'var(--card, #ffffff)',
        border: '1px solid var(--line, #d7d0be)',
        borderRadius: 10,
        padding: '10px 12px',
        boxShadow: '0 8px 24px rgba(28, 36, 20, 0.12)',
        fontSize: 12.5,
        minWidth: 165,
      }}
    >
      <div style={{ fontWeight: 700, color: 'var(--ink, #1C2414)', marginBottom: 6 }}>{label}</div>
      {payload.map((entry) => (
        <div
          key={entry.dataKey}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            padding: '2px 0',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span style={{ color: 'var(--ink2, #5A6351)', fontWeight: 600 }}>{entry.name}</span>
          <span style={{ color: 'var(--ink, #1C2414)', fontWeight: 700 }}>
            {n0(entry.value)} {suffix || ''}
          </span>
        </div>
      ))}
      {payload.length > 1 && (
        <div
          style={{
            borderTop: '1px solid var(--line2, #ece6d9)',
            marginTop: 5,
            paddingTop: 5,
            display: 'flex',
            justifyContent: 'space-between',
            fontWeight: 800,
            color: 'var(--ink, #1C2414)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span>Total</span>
          <span>
            {n0(total)} {suffix || ''}
          </span>
        </div>
      )}
    </div>
  );
};

export const PerformanceOverviewView: React.FC<{
  me: UserMe;
  today: string;
  unit: string;
  lang: LangId;
  onLang: (l: LangId) => void;
  onBack: () => void;
  onPickUnit: () => void;
  onNavigate: (view: string) => void;
  onApi: <T = any>(action: string, p?: Record<string, any>, quiet?: boolean) => Promise<T>;
}> = ({ me, today, unit, lang, onLang, onBack, onPickUnit, onNavigate, onApi }) => {
  const [anchor, setAnchor] = useState(today);
  const [selectedUnit, setSelectedUnit] = useState<string>(me.units.length > 1 ? 'ALL' : unit);
  const [metric, setMetric] = useState<MetricMode>('output');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('All');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<PerformanceOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    onApi<PerformanceOverviewData>(
      'performance.overview',
      { anchor, unit: selectedUnit },
      true
    )
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [anchor, selectedUnit, refreshTick, onApi]);

  const currentWeekStart = weekStartC(today);
  const activeWeekStart = weekStartC(anchor);
  const isAtLatestWeek = activeWeekStart >= currentWeekStart;

  const shiftWeek = (delta: number) => {
    const next = addD(anchor, delta * 7);
    setAnchor(next > today ? today : next);
  };

  const activeMetricMeta = METRIC_OPTIONS.find((m) => m.id === metric) || METRIC_OPTIONS[0];
  const displayUnits = useMemo(() => {
    if (!data) return me.units;
    return data.selectedUnit === 'ALL' ? data.units : [data.selectedUnit];
  }, [data, me.units]);

  const filteredModules = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.moduleBreakdown.filter((row) => {
      if (categoryFilter !== 'All' && row.category !== categoryFilter) return false;
      if (q && !row.name.toLowerCase().includes(q) && !row.category.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, categoryFilter, query]);

  const moduleBarData = useMemo(() => {
    if (!data) return [];
    return data.moduleBreakdown
      .filter((r) => r.category !== 'Utilities' && r.category !== 'Quality')
      .slice()
      .sort((a, b) => b.total - a.total)
      .slice(0, 6)
      .map((r) => {
        const entry: Record<string, any> = { name: r.name };
        displayUnits.forEach((un) => {
          entry[un] = r.byUnit[un] || 0;
        });
        return entry;
      });
  }, [data, displayUnits]);

  const formatDelta = (pct: number | null, invertGood = false) => {
    if (pct === null) return <span style={{ color: 'var(--muted)', fontSize: 12 }}>No prior week baseline</span>;
    const isZero = pct === 0;
    const positive = pct > 0;
    const toneColor = isZero
      ? 'var(--muted)'
      : invertGood
      ? positive
        ? 'var(--bad)'
        : 'var(--ok)'
      : positive
      ? 'var(--ok)'
      : 'var(--bad)';
    return (
      <span style={{ color: toneColor, fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {positive ? `+${pct}%` : `${pct}%`} vs prior week
      </span>
    );
  };

  const unitChoices = me.units.length > 1 ? ['ALL', ...me.units] : me.units;
  const subLabel = data
    ? `${fD(data.from)} – ${fD(data.to)} · ${data.selectedUnit === 'ALL' ? data.units.join(' + ') : data.selectedUnit}`
    : `Week of ${fD(activeWeekStart)}`;

  const handleExportCsv = () => {
    if (!data) return;
    const escCsv = (v: unknown) => {
      const s = String(v == null ? '' : v);
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows: (string | number | null | undefined)[][] = [
      ['Weekly Module Breakdown', `${data.from} to ${data.to}`, `Unit: ${data.selectedUnit}`],
      ['Module', 'Category', ...displayUnits, 'This Week', 'Prior Week', 'Unit Label', 'Delta %'],
      ...data.moduleBreakdown.map((m) => [
        m.name,
        m.category,
        ...displayUnits.map((un) => m.byUnit[un] || 0),
        m.total,
        m.prevTotal,
        m.unitLabel,
        m.deltaPct ?? '',
      ]),
      [],
      ['Daily Breakdown', ...displayUnits.map((un) => `${un} (${activeMetricMeta.label})`), 'Total'],
      ...data.dailySeries.map((pt) => {
        const vals = displayUnits.map((un) => Number(pt[metricDataKey(un, metric)] || 0));
        return [pt.date, ...vals, vals.reduce((a, b) => a + b, 0)];
      }),
    ];
    const csv = '\uFEFF' + rows.map((r) => r.map(escCsv).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `workshop-performance-${data.from}-to-${data.to}-${data.selectedUnit}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <>
      <TopBar
        title={T('Performance Overview', lang)}
        sub={subLabel}
        back
        lang={lang}
        onLang={onLang}
        me={me}
        unit={unit}
        onBack={onBack}
        onRefresh={() => setRefreshTick((t) => t + 1)}
        onPickUnit={onPickUnit}
      />

      <main className="wide" style={{ paddingBottom: 48 }}>
        {/* Filter & Week Controls Bar */}
        <section
          aria-label="Overview controls"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--line)',
            borderRadius: 16,
            padding: '12px 16px',
            display: 'grid',
            gap: 10,
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
              {unitChoices.length > 1 && (
                <div className="rseg" role="group" aria-label="Production unit filter">
                  {unitChoices.map((uCode) => (
                    <button
                      key={uCode}
                      type="button"
                      className={selectedUnit === uCode ? 'on' : ''}
                      style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                      onClick={() => setSelectedUnit(uCode)}
                    >
                      {uCode === 'ALL' ? 'All Units' : uCode}
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                className="btn ghost sm"
                disabled={!data}
                style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                onClick={handleExportCsv}
              >
                <Ico name="down" /> Download CSV
              </button>
            </div>

            <div className="rper" style={{ marginLeft: 'auto' }}>
              <button type="button" onClick={() => shiftWeek(-1)} aria-label="Previous week">
                <Ico name="back" size={16} />
              </button>
              <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {data ? `${fD(data.from)} – ${fD(data.to)}` : `${fD(activeWeekStart)}`}
              </span>
              <button type="button" disabled={isAtLatestWeek} onClick={() => shiftWeek(1)} aria-label="Next week">
                <Ico name="next" size={16} />
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
            <div className="rseg" role="group" aria-label="Chart metric selector">
              {METRIC_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={metric === opt.id ? 'on' : ''}
                  style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                  onClick={() => setMetric(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Loading Skeleton */}
        {loading && !data ? (
          <div style={{ display: 'grid', gap: 16 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                gap: 12,
              }}
            >
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--line)',
                    borderRadius: 16,
                    padding: 18,
                    height: 106,
                  }}
                />
              ))}
            </div>
            <div
              style={{
                background: 'var(--card)',
                border: '1px solid var(--line)',
                borderRadius: 16,
                padding: 20,
                height: 360,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <div className="spin" />
            </div>
          </div>
        ) : !data ? (
          <div
            style={{
              background: 'var(--card)',
              border: '1px solid var(--line)',
              borderRadius: 16,
              padding: 32,
              textAlign: 'center',
            }}
          >
            <b style={{ fontSize: 16 }}>Could not load performance data</b>
            <p className="muted mt" style={{ fontSize: 13.5 }}>
              Retry loading weekly module metrics from the workshop database.
            </p>
            <button
              type="button"
              className="btn gold sm mt"
              onClick={() => setRefreshTick((t) => t + 1)}
            >
              Refresh Data
            </button>
          </div>
        ) : !data.hasActivity ? (
          <div
            style={{
              background: 'var(--card)',
              border: '1px solid var(--line)',
              borderRadius: 16,
              padding: '36px 24px',
              textAlign: 'center',
            }}
          >
            <Ico name="trend" size={34} />
            <h2 style={{ fontSize: 19, fontWeight: 700, marginTop: 12, textWrap: 'balance' as any }}>
              No weekly output recorded for {fD(data.from)} – {fD(data.to)}
            </h2>
            <p className="muted" style={{ fontSize: 14, maxWidth: 520, margin: '8px auto 0' }}>
              Production trends populate automatically as Scanned & Pending uploads, GRC counts, Release & Pack entries,
              Rewash, Saree Polish, Spot Treatment, and Quality logs are saved across units ({data.units.join(' / ')}).
            </p>
            <div className="flex" style={{ justifyContent: 'center', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
              {me.modules.includes('scan') && (
                <button type="button" className="btn gold sm" onClick={() => onNavigate('scan')}>
                  Log Scanned & Pending
                </button>
              )}
              {me.modules.includes('grc') && (
                <button type="button" className="btn ghost sm" onClick={() => onNavigate('grc')}>
                  Log GRC Count
                </button>
              )}
              <button type="button" className="btn ghost sm" onClick={() => shiftWeek(-1)}>
                View Prior Week
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {/* 4-Column KPI Summary Strip */}
            <section
              aria-label="Weekly summary totals"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12,
              }}
            >
              <div
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--line)',
                  borderRadius: 16,
                  padding: '16px 18px',
                }}
              >
                <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>Weekly Production Output</div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    marginTop: 4,
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1.15,
                  }}
                >
                  {n0(data.summary.totalOutput)}
                </div>
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {formatDelta(data.summary.outputDeltaPct)}
                  <span style={{ fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {displayUnits.map((un) => `${un} ${n0(data.summary.byUnitOutput[un] || 0)}`).join(' · ')}
                  </span>
                </div>
              </div>

              <div
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--line)',
                  borderRadius: 16,
                  padding: '16px 18px',
                }}
              >
                <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>Scanned Garments</div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    marginTop: 4,
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1.15,
                  }}
                >
                  {n0(data.summary.totalScanned)}{' '}
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>pcs</span>
                </div>
                <div style={{ marginTop: 6 }}>{formatDelta(data.summary.scannedDeltaPct)}</div>
              </div>

              <div
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--line)',
                  borderRadius: 16,
                  padding: '16px 18px',
                }}
              >
                <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>GRC & Finishing Activity</div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    marginTop: 4,
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1.15,
                  }}
                >
                  {n0(data.summary.totalGrc)}{' '}
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>GRC</span>
                </div>
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {formatDelta(data.summary.grcDeltaPct)}
                  <span style={{ fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {n0(data.summary.finishingAndRewash)} finishing / rewash entries
                  </span>
                </div>
              </div>

              <div
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--line)',
                  borderRadius: 16,
                  padding: '16px 18px',
                }}
              >
                <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>Quality Error Points</div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    marginTop: 4,
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1.15,
                  }}
                >
                  {n0(data.summary.qualityPoints)}{' '}
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>pts</span>
                </div>
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {formatDelta(data.summary.qualityDeltaPct, true)}
                  <span style={{ fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                    Boiler runtime: {hm(data.summary.boilerMins)}
                  </span>
                </div>
              </div>
            </section>

            {/* Primary Recharts Visualization: 4-Week Production Unit Trend */}
            <section
              style={{
                background: 'var(--card)',
                border: '1px solid var(--line)',
                borderRadius: 16,
                padding: '18px 20px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 8,
                  marginBottom: 14,
                }}
              >
                <div>
                  <h2 style={{ fontSize: 17, fontWeight: 700, textWrap: 'balance' as any }}>
                    4-Week Production Unit Trend — {activeMetricMeta.label}
                  </h2>
                  <p className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                    Week-over-week output across {displayUnits.join(' & ')} ({activeMetricMeta.suffix})
                  </p>
                </div>
                <span style={{ fontSize: 12.5, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                  Ending {fD(data.to)}
                </span>
              </div>

              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.weeklyTrends} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      {displayUnits.map((un, idx) => {
                        const pal = unitPalette(un, idx);
                        return (
                          <linearGradient key={un} id={`grad_${un}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={pal.fill} stopOpacity={0.28} />
                            <stop offset="95%" stopColor={pal.fill} stopOpacity={0.02} />
                          </linearGradient>
                        );
                      })}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5decb" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#5A6351', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#5A6351', fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
                    <Tooltip content={<ChartTooltip suffix={activeMetricMeta.suffix} />} />
                    <Legend wrapperStyle={{ fontSize: 12.5, paddingTop: 8 }} />
                    {displayUnits.map((un, idx) => {
                      const pal = unitPalette(un, idx);
                      return (
                        <Area
                          key={un}
                          type="monotone"
                          dataKey={metricDataKey(un, metric)}
                          name={`Unit ${un}`}
                          stroke={pal.stroke}
                          strokeWidth={2.5}
                          fill={`url(#grad_${un})`}
                          activeDot={{ r: 5 }}
                        />
                      );
                    })}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Secondary Visualizations Grid */}
            <section
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: 16,
              }}
            >
              {/* Daily Production Cadence */}
              <div
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--line)',
                  borderRadius: 16,
                  padding: '18px 20px',
                }}
              >
                <div style={{ marginBottom: 14 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>Daily Breakdown (Mon – Sun)</h3>
                  <p className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                    {activeMetricMeta.label} per day split by unit
                  </p>
                </div>
                <div style={{ width: '100%', height: 270 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.dailySeries} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5decb" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: '#5A6351', fontSize: 11.5 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis tick={{ fill: '#5A6351', fontSize: 11.5 }} axisLine={false} tickLine={false} width={44} />
                      <Tooltip content={<ChartTooltip suffix={activeMetricMeta.suffix} />} />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
                      {displayUnits.map((un, idx) => {
                        const pal = unitPalette(un, idx);
                        return (
                          <Bar
                            key={un}
                            dataKey={metricDataKey(un, metric)}
                            name={`Unit ${un}`}
                            stackId="units"
                            fill={pal.fill}
                            radius={idx === displayUnits.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                          />
                        );
                      })}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Module Output Mix */}
              <div
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--line)',
                  borderRadius: 16,
                  padding: '18px 20px',
                }}
              >
                <div style={{ marginBottom: 14 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>Module Volume Contributions</h3>
                  <p className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                    Active output across highest-volume workshop modules this week
                  </p>
                </div>
                <div style={{ width: '100%', height: 270 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={moduleBarData}
                      layout="vertical"
                      margin={{ top: 4, right: 16, left: 10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5decb" horizontal={false} />
                      <XAxis type="number" tick={{ fill: '#5A6351', fontSize: 11.5 }} axisLine={false} tickLine={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={118}
                        tick={{ fill: '#1C2414', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
                      {displayUnits.map((un, idx) => {
                        const pal = unitPalette(un, idx);
                        return (
                          <Bar
                            key={un}
                            dataKey={un}
                            name={`Unit ${un}`}
                            stackId="mod"
                            fill={pal.fill}
                            radius={idx === displayUnits.length - 1 ? [0, 6, 6, 0] : [0, 0, 0, 0]}
                          />
                        );
                      })}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>

            {/* Module Weekly Ledger Table */}
            <section
              style={{
                background: 'var(--card)',
                border: '1px solid var(--line)',
                borderRadius: 16,
                padding: '18px 20px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  marginBottom: 14,
                }}
              >
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>Weekly Output by Module</h3>
                  <p className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                    {fD(data.from)} – {fD(data.to)} compared to previous week
                  </p>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                  <div className="rseg" role="group" aria-label="Module category filter">
                    {(['All', 'Volume', 'Process & Finishing', 'Quality', 'Utilities'] as CategoryFilter[]).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        className={categoryFilter === cat ? 'on' : ''}
                        style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                        onClick={() => setCategoryFilter(cat)}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <input
                    type="search"
                    value={query}
                    placeholder="Filter modules…"
                    onChange={(e) => setQuery(e.target.value)}
                    style={{ width: 190, minHeight: 38, padding: '6px 12px', fontSize: 13 }}
                  />
                </div>
              </div>

              <div className="tw">
                <table className="tbl sm">
                  <thead>
                    <tr>
                      <th>Module</th>
                      <th>Category</th>
                      {displayUnits.map((un) => (
                        <th key={un} className="n">
                          {un}
                        </th>
                      ))}
                      <th className="n">This Week</th>
                      <th className="n">Prior Week</th>
                      <th className="n">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredModules.length ? (
                      filteredModules.map((row) => {
                        const canOpen = me.modules.includes(row.id);
                        return (
                          <tr
                            key={row.id}
                            style={{ cursor: canOpen ? 'pointer' : 'default' }}
                            onClick={() => {
                              if (canOpen) onNavigate(row.id);
                            }}
                          >
                            <td>
                              <b>{row.name}</b>
                            </td>
                            <td className="muted">{row.category}</td>
                            {displayUnits.map((un) => (
                              <td key={un} className="n" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                {n0(row.byUnit[un] || 0)}
                              </td>
                            ))}
                            <td className="n" style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                              {n0(row.total)}{' '}
                              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)' }}>
                                {row.unitLabel}
                              </span>
                            </td>
                            <td className="n" style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--muted)' }}>
                              {n0(row.prevTotal)}
                            </td>
                            <td className="n" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {row.deltaPct === null ? (
                                <span className="muted">—</span>
                              ) : (
                                <span
                                  style={{
                                    fontWeight: 700,
                                    color:
                                      row.deltaPct === 0
                                        ? 'var(--muted)'
                                        : row.category === 'Quality'
                                        ? row.deltaPct > 0
                                          ? 'var(--bad)'
                                          : 'var(--ok)'
                                        : row.deltaPct > 0
                                        ? 'var(--ok)'
                                        : 'var(--bad)',
                                  }}
                                >
                                  {row.deltaPct > 0 ? `+${row.deltaPct}%` : `${row.deltaPct}%`}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={displayUnits.length + 5} className="empty">
                          No matching modules
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </main>
    </>
  );
};
