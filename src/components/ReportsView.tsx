import React, { useEffect, useState } from 'react';
import { addD, dObj, RMENU, T } from '../config/workshopConfig';
import type { LangId, UserMe, WorkshopSettings } from '../types/workshop';
import { buildReportCsv, renderReportHtml, reportLabelFor, reportRangeFor } from '../utils/reportRenderer';
import { TopBar } from './CommonUI';
import { Ico } from './Icons';

export const ReportsView: React.FC<{
  me: UserMe;
  settings: WorkshopSettings;
  today: string;
  unit: string;
  lang: LangId;
  onLang: (l: LangId) => void;
  onBack: () => void;
  onPickUnit: () => void;
  onApi: <T = any>(action: string, p?: Record<string, any>, quiet?: boolean) => Promise<T>;
  onPrintReport: (title: string, sub: string, bodyHtml: string, signs: boolean, cls: string, filename?: string) => void;
  onDownloadPdf?: (title: string, sub: string, bodyHtml: string, signs: boolean, cls: string, filename: string) => void;
  pdfBusy?: boolean;
  onToast?: (msg: string, kind?: '' | 'ok' | 'err') => void;
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
  onPrintReport,
  onDownloadPdf,
  pdfBusy,
  onToast,
}) => {
  const [kind, setKind] = useState<string | null>(null);
  const [per, setPer] = useState<'day' | 'week' | 'month'>('week');
  const [anchor, setAnchor] = useState(today);
  const [repUnit, setRepUnit] = useState(unit);
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const repTitle = (k: string): string => {
    for (const g of RMENU) {
      for (const item of g[1]) {
        if (item[0] === k) return item[1];
      }
    }
    return k;
  };

  useEffect(() => {
    if (!kind) return;
    let cancelled = false;
    setData(null);
    const [from, to] = reportRangeFor(anchor, per, kind);
    onApi<Record<string, any>>('report', {
      kind,
      from,
      to: to > today ? today : to,
      unit: repUnit,
    }).then((res) => {
      if (!cancelled) setData(res);
    });
    return () => {
      cancelled = true;
    };
  }, [kind, per, anchor, repUnit, today, refreshTick]);

  const shiftPeriod = (delta: number) => {
    const effPer = kind === 'daily' ? 'day' : per;
    let next = anchor;
    if (effPer === 'day') {
      next = addD(anchor, delta);
    } else if (effPer === 'week') {
      next = addD(anchor, 7 * delta);
    } else {
      const dt = dObj(anchor);
      dt.setUTCDate(1);
      dt.setUTCMonth(dt.getUTCMonth() + delta);
      next = dt.toISOString().slice(0, 10);
    }
    if (next > today) next = today;
    setAnchor(next);
  };

  const units = me.units.length > 1 ? [...me.units, 'ALL'] : me.units;
  const [, rangeTo] = reportRangeFor(anchor, per, kind);
  const renderedHtml = kind && data ? renderReportHtml(kind, data, settings, today, lang) : '';

  const getExportPayload = () => {
    if (!kind || !data) return null;
    const from = String(data.from || anchor);
    const to = String(data.to || from);
    const datePart = to && to !== from ? `${from}-to-${to}` : from;
    const filename = `workshop-${kind}-${datePart}-${repUnit}.pdf`;
    if (kind === 'daily') {
      const body = renderReportHtml('daily', data, settings, today, lang).replace(
        /<div class="pbreak"><\/div>/g,
        '<div class="pbreak" style="page-break-after:always"></div>'
      );
      return {
        title: 'Daily Workshop Report',
        sub: `${reportLabelFor(anchor, per, 'daily')} · ${(data.days as any[]).map((x) => x.unit).join(' + ')}`,
        body,
        signs: true,
        cls: 'one',
        filename,
      };
    }
    return {
      title: repTitle(kind),
      sub: `${reportLabelFor(anchor, per, kind)} · ${repUnit === 'ALL' ? 'UL + PC' : repUnit}`,
      body: renderedHtml,
      signs: false,
      cls: '',
      filename,
    };
  };

  const handlePrint = () => {
    const p = getExportPayload();
    if (!p) return;
    onPrintReport(p.title, p.sub, p.body, p.signs, p.cls, p.filename);
  };

  const handleDownloadPdf = () => {
    const p = getExportPayload();
    if (!p || !onDownloadPdf) return;
    onDownloadPdf(p.title, p.sub, p.body, p.signs, p.cls, p.filename);
  };

  const handleDownloadCsv = () => {
    if (!kind || !data) return;
    const csv = buildReportCsv(kind, data, settings, today);
    const from = String(data.from || anchor);
    const to = String(data.to || from);
    const datePart = to && to !== from ? `${from}-to-${to}` : from;
    const filename = `workshop-${kind}-${datePart}-${repUnit}.csv`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    onToast?.('✓ CSV downloaded', 'ok');
  };

  return (
    <>
      <TopBar
        title={T('Reports', lang)}
        sub="Daily · weekly · monthly"
        back
        lang={lang}
        onLang={onLang}
        me={me}
        unit={unit}
        onBack={onBack}
        onRefresh={() => {
          if (kind) setRefreshTick((t) => t + 1);
        }}
        onPickUnit={onPickUnit}
      />
      <main className="wide">
        <div className={`rlay${kind ? ' has' : ''}`}>
          <nav className="rmenu">
            {RMENU.map(([groupName, items]) => (
              <React.Fragment key={groupName}>
                <div className="rgt">{groupName}</div>
                {items.map(([id, title, icon]) => (
                  <button
                    key={id}
                    type="button"
                    className={`ritem${kind === id ? ' on' : ''}`}
                    onClick={() => setKind(id)}
                  >
                    <span className="ri">
                      <Ico name={icon} />
                    </span>
                    {title}
                  </button>
                ))}
              </React.Fragment>
            ))}
          </nav>

          <section className="rpane">
            {!kind ? (
              <div className="rdoc empty">
                <Ico name="chart" size={40} />
                <br />
                Choose a report
              </div>
            ) : (
              <>
                <div className="rbar">
                  <div className="rbar-row">
                    <button type="button" className="rback" onClick={() => setKind(null)}>
                      <Ico name="back" /> All reports
                    </button>
                    <h2>{repTitle(kind)}</h2>
                    <div className="rbar-dates">
                      {kind !== 'daily' && (
                        <div className="rseg">
                          {(
                            [
                              ['day', 'Day'],
                              ['week', 'Week'],
                              ['month', 'Month'],
                            ] as const
                          ).map(([p, lbl]) => (
                            <button
                              key={p}
                              type="button"
                              className={per === p ? 'on' : ''}
                              onClick={() => setPer(p)}
                            >
                              {lbl}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="rper">
                        <button type="button" onClick={() => shiftPeriod(-1)}>
                          <Ico name="back" size={16} />
                        </button>
                        <span>{reportLabelFor(anchor, per, kind)}</span>
                        <button type="button" disabled={rangeTo >= today} onClick={() => shiftPeriod(1)}>
                          <Ico name="next" size={16} />
                        </button>
                      </div>
                      {kind === 'daily' && (
                        <input
                          type="date"
                          style={{ width: 'auto', minHeight: 38 }}
                          max={today}
                          value={anchor}
                          onChange={(e) => {
                            if (e.target.value && e.target.value <= today) setAnchor(e.target.value);
                          }}
                        />
                      )}
                    </div>
                  </div>
                  <div className="rbar-actions">
                    {units.length > 1 && (
                      <div className="rseg">
                        {units.map((u) => (
                          <button
                            key={u}
                            type="button"
                            className={repUnit === u ? 'on' : ''}
                            onClick={() => setRepUnit(u)}
                          >
                            {u === 'ALL' ? 'Both' : u}
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      className="btn ghost sm"
                      disabled={!data}
                      style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                      onClick={handleDownloadCsv}
                    >
                      <Ico name="down" /> Download CSV
                    </button>
                    <button
                      type="button"
                      className="btn ghost sm"
                      disabled={!data || pdfBusy}
                      style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                      onClick={handleDownloadPdf}
                    >
                      <Ico name="pdf" /> {pdfBusy ? 'Generating…' : 'Download PDF'}
                    </button>
                    <button
                      type="button"
                      className="btn sm"
                      disabled={!data}
                      style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                      onClick={handlePrint}
                    >
                      <Ico name="print" /> Print
                    </button>
                  </div>
                </div>
                <div className="rdoc">
                  {data ? (
                    <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
                  ) : (
                    <div className="empty">
                      <div className="spin" />
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </>
  );
};
