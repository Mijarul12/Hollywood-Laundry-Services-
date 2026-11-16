/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiCall } from './api/client';
import {
  ConfirmModal,
  ConfirmState,
  Loader,
  ModalSheet,
  PhotoLightbox,
  PromptModal,
  PromptState,
  QuickNavModal,
  shiftDateClamp,
  Toast,
  ToastState,
} from './components/CommonUI';
import { DailyView } from './components/DailyView';
import { HomeView } from './components/HomeView';
import { LoginView, UnitSelectView } from './components/LoginView';
import { BoilerView } from './components/modules/BoilerView';
import { FormModuleView } from './components/modules/FormModuleView';
import { GrcView } from './components/modules/GrcView';
import { IronmenErrorView } from './components/modules/IronmenErrorView';
import { MeterView } from './components/modules/MeterView';
import { ReleasePackView } from './components/modules/ReleasePackView';
import { RewashView } from './components/modules/RewashView';
import { SareePolishView } from './components/modules/SareePolishView';
import { ScanPendingView } from './components/modules/ScanPendingView';
import { StaffErrorView } from './components/modules/StaffErrorView';
import { WnGarmentsView } from './components/modules/WnGarmentsView';
import { PerformanceOverviewView } from './components/PerformanceOverviewView';
import { PrintDocState, PrintPreviewModal, PrintView } from './components/PrintView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { WaterBubbles } from './components/WaterBubbles';
import { APP_VERSION, fLong, getSettingPath, istToday, T } from './config/workshopConfig';
import type {
  AutosData,
  DailyResponse,
  HomeData,
  LangId,
  ModuleResponse,
  ThemeId,
  UserMe,
  WorkshopSettings,
} from './types/workshop';
import { exportHtmlToPdf, waitForImages } from './utils/pdfExport';
import { buildPrintHeader, dailyDocHtml } from './utils/reportRenderer';

const SESS_KEY = 'ulws3.sess';
const LANG_KEY = 'ulws3.lang';
const LAST_NAME_KEY = 'ulws3.lastName';

const MODULE_IDS = new Set([
  'rp',
  'iron',
  'rewash',
  'repair',
  'spot',
  'quickfix',
  'washerr',
  'grc',
  'staffErr',
  'meter',
  'saree',
  'wn',
  'boiler',
  'scan',
]);

function loadUsage(userName: string | undefined): Record<string, number> {
  if (!userName) return {};
  try {
    return JSON.parse(localStorage.getItem(`ulws3.use.${userName}`) || '{}') || {};
  } catch {
    return {};
  }
}

export default function App() {
  const [booted, setBooted] = useState(false);
  const [token, setToken] = useState<string>('');
  const [me, setMe] = useState<UserMe | null>(null);
  const [settings, setSettings] = useState<WorkshopSettings | null>(null);
  const [today, setToday] = useState<string>(() => istToday());
  const [date, setDate] = useState<string>(() => istToday());
  const [unit, setUnit] = useState<string>('');
  const [view, setView] = useState<string>('login');
  const [lang, setLangState] = useState<LangId>(() => {
    const saved = localStorage.getItem(LANG_KEY);
    return saved === 'hi' || saved === 'bn' ? saved : 'en';
  });
  const [lastName, setLastName] = useState<string>(() => localStorage.getItem(LAST_NAME_KEY) || '');
  const [theme, setTheme] = useState<ThemeId>('hollywood');
  const [usage, setUsage] = useState<Record<string, number>>({});

  const [homeData, setHomeData] = useState<HomeData | null>(null);
  const [dailyData, setDailyData] = useState<DailyResponse | null>(null);
  const [modData, setModData] = useState<ModuleResponse | null>(null);

  const [toast, setToast] = useState<ToastState | null>(null);
  const [loadCount, setLoadCount] = useState(0);
  const [loadMsg, setLoadMsg] = useState('Saving…');
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [promptState, setPromptState] = useState<PromptState | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [printDoc, setPrintDoc] = useState<PrintDocState | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [quickNavOpen, setQuickNavOpen] = useState(false);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUndoRef = useRef<{ ids: string[]; mod: string; date: string } | null>(null);
  const tokenRef = useRef(token);
  const unitRef = useRef(unit);
  const viewRef = useRef(view);
  const dateRef = useRef(date);
  tokenRef.current = token;
  unitRef.current = unit;
  viewRef.current = view;
  dateRef.current = date;

  useEffect(() => {
    document.body.dataset.theme = theme || 'hollywood';
  }, [theme]);

  useEffect(() => {
    document.body.className = lang === 'en' ? '' : `lang-${lang}`;
  }, [lang]);

  useEffect(() => {
    const onOpen = () => {
      if (me && unitRef.current) setQuickNavOpen(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        if (me && unitRef.current) {
          e.preventDefault();
          setQuickNavOpen((v) => !v);
        }
      }
    };
    window.addEventListener('ws:qnav', onOpen);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('ws:qnav', onOpen);
      window.removeEventListener('keydown', onKey);
    };
  }, [me]);

  const setLang = (next: LangId) => {
    setLangState(next);
    localStorage.setItem(LANG_KEY, next);
  };

  const setLoading = useCallback((on: boolean, msg = 'Saving…') => {
    if (on) setLoadMsg(msg);
    setLoadCount((c) => Math.max(0, c + (on ? 1 : -1)));
  }, []);

  const showToast = useCallback((msg: string, kind: '' | 'ok' | 'err' = '') => {
    const undo = kind === 'ok' && pendingUndoRef.current ? pendingUndoRef.current : null;
    pendingUndoRef.current = null;
    setToast({ msg, kind, undo });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, undo ? 6000 : 2800);
  }, []);

  const callApi = useCallback(
    async <T = any,>(action: string, p: Record<string, any> = {}, quiet = false): Promise<T> => {
      if (!quiet) setLoading(true, action === 'login' ? 'Checking PIN…' : 'Saving…');
      try {
        const res = await apiCall<T>(action, p, tokenRef.current || undefined, unitRef.current || undefined);
        const anyRes = res as any;
        if (anyRes && Array.isArray(anyRes.added) && anyRes.added.length && anyRes.mod) {
          pendingUndoRef.current = {
            ids: anyRes.added,
            mod: anyRes.mod,
            date: anyRes.date || dateRef.current,
          };
        }
        return res;
      } catch (e: any) {
        const msg = e?.message || 'Error';
        showToast(msg, 'err');
        throw e;
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [setLoading, showToast]
  );

  const loadViewData = useCallback(
    async (targetView: string, targetUnit: string, targetDate: string) => {
      if (targetView === 'home') {
        setHomeData(null);
        const h = await apiCall<HomeData>('home', { unit: targetUnit }, tokenRef.current, targetUnit);
        setHomeData(h);
      } else if (targetView === 'daily') {
        setDailyData(null);
        const d = await apiCall<DailyResponse>(
          'daily.get',
          { unit: targetUnit, date: targetDate },
          tokenRef.current,
          targetUnit
        );
        setDailyData(d);
      } else if (MODULE_IDS.has(targetView)) {
        setModData(null);
        const m = await apiCall<ModuleResponse>(
          'e.get',
          { mod: targetView, unit: targetUnit, date: targetDate },
          tokenRef.current,
          targetUnit
        );
        setModData(m);
      }
    },
    []
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const b = await apiCall<{ today: string; theme: ThemeId }>('boot');
        if (!active) return;
        setToday(b.today);
        setDate(b.today);
        setTheme(b.theme || 'hollywood');

        const rawSess = localStorage.getItem(SESS_KEY);
        if (rawSess) {
          try {
            const sess = JSON.parse(rawSess);
            if (sess?.token) {
              tokenRef.current = sess.token;
              const init = await apiCall<{ me: UserMe; settings: WorkshopSettings; today: string }>(
                'init',
                {},
                sess.token
              );
              if (!active) return;
              setToken(sess.token);
              setMe(init.me);
              setSettings(init.settings);
              setToday(init.today);
              setDate(init.today);
              setTheme(init.settings.theme || 'hollywood');
              setUsage(loadUsage(init.me.name));
              if (init.me.units.length === 1) {
                const u0 = init.me.units[0];
                unitRef.current = u0;
                setUnit(u0);
                setView('home');
                loadViewData('home', u0, init.today).catch(() => {});
              } else {
                setView('unit');
              }
            }
          } catch {
            localStorage.removeItem(SESS_KEY);
            tokenRef.current = '';
          }
        }
      } catch {
        // Ignore boot network hiccup
      } finally {
        if (active) setBooted(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadViewData]);

  const handleLogin = async (name: string, pin: string) => {
    const r = await callApi<{
      token: string;
      me: UserMe;
      today: string;
    }>('login', { name, pin });
    tokenRef.current = r.token;
    const init = await callApi<{ me: UserMe; settings: WorkshopSettings; today: string }>('init', {}, true);
    localStorage.setItem(SESS_KEY, JSON.stringify({ token: r.token, me: init.me, day: init.today }));
    localStorage.setItem(LAST_NAME_KEY, init.me.name);
    try {
      const prev = JSON.parse(localStorage.getItem('ulws3.recentNames') || '[]');
      const arr = Array.isArray(prev) ? prev.filter((x) => typeof x === 'string' && x !== init.me.name) : [];
      localStorage.setItem('ulws3.recentNames', JSON.stringify([init.me.name, ...arr].slice(0, 4)));
    } catch {
      // ignore storage error
    }
    setToken(r.token);
    setMe(init.me);
    setLastName(init.me.name);
    setSettings(init.settings);
    setToday(init.today);
    setDate(init.today);
    setTheme(init.settings.theme || 'hollywood');
    setUsage(loadUsage(init.me.name));
    if (init.me.units.length === 1) {
      const u0 = init.me.units[0];
      unitRef.current = u0;
      setUnit(u0);
      setView('home');
      await loadViewData('home', u0, init.today);
    } else {
      setUnit('');
      setView('unit');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(SESS_KEY);
    tokenRef.current = '';
    unitRef.current = '';
    setToken('');
    setMe(null);
    setSettings(null);
    setUnit('');
    setHomeData(null);
    setDailyData(null);
    setModData(null);
    setView('login');
  };

  const handleSelectUnit = (u: string) => {
    unitRef.current = u;
    setUnit(u);
    setUnitModalOpen(false);
    const targetView = view === 'unit' || view === 'login' ? 'home' : view;
    setView(targetView);
    loadViewData(targetView, u, date).catch((e: any) => showToast(e.message || 'Failed to load', 'err'));
  };

  const navigateTo = (nextView: string) => {
    if (me && nextView !== 'home' && nextView !== 'unit' && nextView !== 'login') {
      const nextUsage = { ...usage, [nextView]: (usage[nextView] || 0) + 1 };
      setUsage(nextUsage);
      localStorage.setItem(`ulws3.use.${me.name}`, JSON.stringify(nextUsage));
    }
    const targetDate = nextView === 'home' ? today : today;
    setDate(targetDate);
    setView(nextView);
    window.scrollTo({ top: 0, behavior: 'auto' });
    loadViewData(nextView, unitRef.current, targetDate).catch((e: any) =>
      showToast(e.message || 'Failed to load', 'err')
    );
  };

  const handleRefresh = () => {
    loadViewData(viewRef.current, unitRef.current, dateRef.current)
      .then(() => showToast('Refreshed', 'ok'))
      .catch((e: any) => showToast(e.message || 'Refresh failed', 'err'));
  };

  const handleShiftDate = (delta: number) => {
    const next = shiftDateClamp(date, delta, today);
    if (next === date) return;
    setDate(next);
    loadViewData(view, unit, next).catch((e: any) => showToast(e.message || 'Failed to load', 'err'));
  };

  const handleDateChange = (next: string) => {
    if (!next || next > today || next === date) return;
    setDate(next);
    loadViewData(view, unit, next).catch((e: any) => showToast(e.message || 'Failed to load', 'err'));
  };

  const handleUndo = async () => {
    const u = toast?.undo;
    if (!u) return;
    setToast(null);
    try {
      const r = await callApi<ModuleResponse>('e.del', { ids: u.ids, mod: u.mod, date: u.date });
      if (viewRef.current === u.mod) setModData(r);
      showToast('Undone');
    } catch {
      // toast handled by callApi
    }
  };

  const openConfirm = (title: string, message: string, onConfirm: () => void, danger = false) => {
    setConfirmState({
      title,
      message,
      confirmLabel: danger ? T('Delete', lang) : 'OK',
      danger,
      onConfirm,
    });
  };

  const openPrompt = (
    title: string,
    placeholder: string,
    defaultValue: string,
    onSubmit: (value: string) => void
  ) => {
    setPromptState({
      title,
      placeholder,
      defaultValue,
      confirmLabel: T('Add', lang),
      onSubmit,
    });
  };

  const handleAddList = (listPath: string, onAdded?: (val: string) => void) => {
    if (!settings) return;
    openPrompt('Add to list', 'Enter name', '', async (val) => {
      const copy: WorkshopSettings = JSON.parse(JSON.stringify(settings));
      const arr = (getSettingPath(copy, listPath) as string[]) || [];
      if (!arr.includes(val)) arr.push(val);
      const keys = listPath.split('.');
      let cur: any = copy;
      for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
      cur[keys[keys.length - 1]] = arr;

      const updated = await callApi<WorkshopSettings>('settings.save', { settings: copy });
      setSettings(updated);
      onAdded?.(val);
      showToast(`✓ Added "${val}"`, 'ok');
    });
  };

  const buildDailyPrintDoc = (
    days: { unit: string; data: Record<string, any>; meta: any; autos: AutosData }[],
    repDate: string
  ): PrintDocState | null => {
    if (!settings || !me) return null;
    const body = days.map((x) => dailyDocHtml(x, repDate, lang)).join('<div class="pbreak" style="page-break-after:always"></div>');
    const title = 'Daily Workshop Report';
    const sub = `${fLong(repDate)} · ${days.map((x) => x.unit).join(' + ')}`;
    const html = buildPrintHeader(title, sub, today, me.name, body, true, 'one');
    const unitTag = days.map((x) => x.unit).join('-') || unit || 'ALL';
    return { title, sub, html, filename: `workshop-daily-${repDate}-${unitTag}.pdf` };
  };

  const openPrintPreviewAndPrint = (doc: PrintDocState) => {
    setPrintDoc(doc);
    requestAnimationFrame(() => {
      setTimeout(async () => {
        await waitForImages(document.getElementById('print'));
        try {
          window.print();
        } catch {
          // Preview modal remains open with Download PDF fallback
        }
      }, 120);
    });
  };

  const runPdfDownload = async (html: string, filename: string) => {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      await exportHtmlToPdf(html, filename);
      showToast('✓ PDF downloaded', 'ok');
    } catch (e: any) {
      showToast(e?.message || 'PDF generation failed', 'err');
    } finally {
      setPdfBusy(false);
    }
  };

  const handlePrintDaily = (
    days: { unit: string; data: Record<string, any>; meta: any; autos: AutosData }[],
    repDate: string
  ) => {
    const doc = buildDailyPrintDoc(days, repDate);
    if (!doc) return;
    openPrintPreviewAndPrint(doc);
  };

  const handleDownloadDailyPdf = async (
    days: { unit: string; data: Record<string, any>; meta: any; autos: AutosData }[],
    repDate: string
  ) => {
    const doc = buildDailyPrintDoc(days, repDate);
    if (!doc) return;
    await runPdfDownload(doc.html, doc.filename);
  };

  const handlePrintReport = (
    title: string,
    sub: string,
    bodyHtml: string,
    signs: boolean,
    cls: string,
    filename?: string
  ) => {
    if (!me) return;
    const html = buildPrintHeader(title, sub, today, me.name, bodyHtml, signs, cls);
    openPrintPreviewAndPrint({
      title,
      sub,
      html,
      filename: filename || `workshop-report-${today}.pdf`,
    });
  };

  const handleDownloadReportPdf = async (
    title: string,
    sub: string,
    bodyHtml: string,
    signs: boolean,
    cls: string,
    filename: string
  ) => {
    if (!me) return;
    const html = buildPrintHeader(title, sub, today, me.name, bodyHtml, signs, cls);
    await runPdfDownload(html, filename);
  };

  const modProps =
    me && settings
      ? {
          me,
          settings,
          today,
          date,
          unit,
          lang,
          modData,
          onLang: setLang,
          onBack: () => navigateTo('home'),
          onRefresh: handleRefresh,
          onPickUnit: () => setUnitModalOpen(true),
          onShiftDate: handleShiftDate,
          onDateChange: handleDateChange,
          onApi: callApi,
          onUpdateModData: (next: ModuleResponse) => setModData(next),
          onToast: showToast,
          onAddList: handleAddList,
          onPrompt: openPrompt,
          onConfirm: openConfirm,
          onLoading: setLoading,
          onOpenPhoto: (url: string) => setPhotoUrl(url),
        }
      : null;

  const renderMain = () => {
    if (!booted) {
      return (
        <div className="empty" style={{ marginTop: 80 }}>
          <div className="spin" />
        </div>
      );
    }

    if (view === 'login' || !me || !settings) {
      return <LoginView lang={lang} lastName={lastName} onLang={setLang} onSubmitPin={handleLogin} />;
    }

    if (view === 'unit' || !unit) {
      return (
        <UnitSelectView
          me={me}
          lang={lang}
          onLang={setLang}
          onSelectUnit={handleSelectUnit}
          onLogout={handleLogout}
        />
      );
    }

    switch (view) {
      case 'home':
        return (
          <HomeView
            me={me}
            today={today}
            unit={unit}
            lang={lang}
            homeData={homeData}
            usage={usage}
            onLang={setLang}
            onRefresh={handleRefresh}
            onLogout={handleLogout}
            onPickUnit={() => setUnitModalOpen(true)}
            onNavigate={navigateTo}
          />
        );

      case 'daily':
        return (
          <DailyView
            me={me}
            settings={settings}
            today={today}
            date={date}
            unit={unit}
            lang={lang}
            dailyData={dailyData}
            onLang={setLang}
            onBack={() => navigateTo('home')}
            onRefresh={handleRefresh}
            onPickUnit={() => setUnitModalOpen(true)}
            onShiftDate={handleShiftDate}
            onDateChange={handleDateChange}
            onGoModule={navigateTo}
            onApi={callApi}
            onToast={showToast}
            onAddList={handleAddList}
            onConfirm={openConfirm}
            onPrintDaily={handlePrintDaily}
            onDownloadDailyPdf={handleDownloadDailyPdf}
            pdfBusy={pdfBusy}
          />
        );

      case 'reports':
        return (
          <ReportsView
            me={me}
            settings={settings}
            today={today}
            unit={unit}
            lang={lang}
            onLang={setLang}
            onBack={() => navigateTo('home')}
            onPickUnit={() => setUnitModalOpen(true)}
            onApi={callApi}
            onPrintReport={handlePrintReport}
            onDownloadPdf={handleDownloadReportPdf}
            pdfBusy={pdfBusy}
            onToast={showToast}
          />
        );

      case 'performance':
        return (
          <PerformanceOverviewView
            me={me}
            today={today}
            unit={unit}
            lang={lang}
            onLang={setLang}
            onBack={() => navigateTo('home')}
            onPickUnit={() => setUnitModalOpen(true)}
            onNavigate={navigateTo}
            onApi={callApi}
          />
        );

      case 'settings':
        return (
          <SettingsView
            me={me}
            settings={settings}
            today={today}
            unit={unit}
            lang={lang}
            onLang={setLang}
            onBack={() => navigateTo('home')}
            onPickUnit={() => setUnitModalOpen(true)}
            onApi={callApi}
            onSettingsUpdated={(next) => {
              setSettings(next);
              setTheme(next.theme || 'hollywood');
            }}
            onPreviewTheme={(t) => setTheme(t)}
            onToast={showToast}
            onConfirm={openConfirm}
            onLoading={setLoading}
          />
        );

      case 'rp':
        return modProps ? <ReleasePackView {...modProps} /> : null;
      case 'iron':
        return modProps ? <IronmenErrorView {...modProps} /> : null;
      case 'rewash':
        return modProps ? <RewashView {...modProps} /> : null;
      case 'repair':
      case 'spot':
      case 'quickfix':
      case 'washerr':
        return modProps ? <FormModuleView {...modProps} mod={view} /> : null;
      case 'grc':
        return modProps ? <GrcView {...modProps} /> : null;
      case 'staffErr':
        return modProps ? <StaffErrorView {...modProps} /> : null;
      case 'meter':
        return modProps ? <MeterView {...modProps} /> : null;
      case 'saree':
        return modProps ? <SareePolishView {...modProps} /> : null;
      case 'wn':
        return modProps ? <WnGarmentsView {...modProps} /> : null;
      case 'boiler':
        return modProps ? <BoilerView {...modProps} /> : null;
      case 'scan':
        return modProps ? <ScanPendingView {...modProps} /> : null;
      default:
        return null;
    }
  };

  const hasStickyBar =
    view === 'daily' ||
    view === 'settings' ||
    view === 'grc' ||
    view === 'meter' ||
    view === 'repair' ||
    view === 'spot' ||
    view === 'quickfix' ||
    view === 'washerr';

  return (
    <>
      {booted && view !== 'login' && me && settings && <WaterBubbles variant="ambient" />}
      <div id="app">
        <div key={view} className="view-stage">
          {renderMain()}
        </div>
        {booted && view !== 'login' && me && settings && (
          <footer className={`appver${hasStickyBar ? ' has-bar' : ''}`}>Version {APP_VERSION}</footer>
        )}
      </div>

      <PrintView html={printDoc?.html || ''} />
      <PrintPreviewModal
        doc={printDoc}
        pdfBusy={pdfBusy}
        onClose={() => setPrintDoc(null)}
        onDownloadPdf={() => {
          if (printDoc) runPdfDownload(printDoc.html, printDoc.filename);
        }}
      />
      <QuickNavModal
        open={quickNavOpen}
        me={me}
        currentView={view}
        lang={lang}
        onClose={() => setQuickNavOpen(false)}
        onNavigate={navigateTo}
      />
      <Toast toast={toast} onUndo={handleUndo} />
      <Loader active={loadCount > 0} msg={loadMsg} />
      <ConfirmModal state={confirmState} lang={lang} onClose={() => setConfirmState(null)} />
      <PromptModal state={promptState} lang={lang} onClose={() => setPromptState(null)} />
      <PhotoLightbox url={photoUrl} onClose={() => setPhotoUrl(null)} />

      <ModalSheet open={unitModalOpen} onClose={() => setUnitModalOpen(false)}>
        {me && (
          <>
            <b style={{ fontSize: 18 }}>{T('Choose unit', lang)}</b>
            <div className="ucards mt2">
              {me.units.map((u) => (
                <button
                  key={u}
                  type="button"
                  className={`ucard ${u}`}
                  onClick={() => handleSelectUnit(u)}
                >
                  <b>{u}</b>
                  {T('Unit', lang)}
                </button>
              ))}
            </div>
          </>
        )}
      </ModalSheet>
    </>
  );
}
