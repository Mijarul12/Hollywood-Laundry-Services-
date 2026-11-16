import React, { useEffect, useState } from 'react';
import { APP_VERSION, T } from '../config/workshopConfig';
import type { LangId, UserMe } from '../types/workshop';
import { BrandLogo, TopBar } from './CommonUI';
import { Ico } from './Icons';
import { WaterBubbles } from './WaterBubbles';

function readRecentNames(lastName: string): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem('ulws3.recentNames') || '[]');
    const arr = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string' && !!x.trim()) : [];
    if (lastName && !arr.includes(lastName)) return [lastName, ...arr].slice(0, 4);
    return arr.slice(0, 4);
  } catch {
    return lastName ? [lastName] : [];
  }
}

export const LoginView: React.FC<{
  lang: LangId;
  lastName: string;
  onLang: (l: LangId) => void;
  onSubmitPin: (name: string, pin: string) => Promise<void>;
}> = ({ lang, lastName, onLang, onSubmitPin }) => {
  const [name, setName] = useState(lastName || '');
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<'name' | 'pin'>(lastName ? 'pin' : 'name');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const recentNames = readRecentNames(lastName);

  const goPin = (chosenName?: string) => {
    const clean = (chosenName ?? name).trim();
    if (!clean) return;
    setName(clean);
    setPin('');
    setStep('pin');
  };

  const handleDigit = async (d: string) => {
    if (busy || pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      setBusy(true);
      try {
        await onSubmitPin(name.trim(), next);
      } catch {
        setPin('');
        setShake(true);
        setTimeout(() => setShake(false), 420);
      } finally {
        setBusy(false);
      }
    }
  };

  useEffect(() => {
    if (step !== 'pin') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        setPin((p) => p.slice(0, -1));
      } else if (e.key === 'Escape') {
        setPin('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="login">
      <div className="login-backdrop" aria-hidden="true">
        <div className="login-glow login-glow-a" />
        <div className="login-glow login-glow-b" />
        <div className="login-mesh" />
        <div className="login-rings">
          <span />
          <span />
          <span />
        </div>
      </div>
      <WaterBubbles variant="login" />
      <div className="login-shell">
        <div className="lhead">
          <div className="lmono-wrap">
            <div className="lmono">
              <BrandLogo />
            </div>
          </div>
          <h1>
            WORKSHOP
            <small>HOLLYWOOD</small>
          </h1>
          <div className="tag">Hollywood Laundry Service</div>
          <div className="flex" style={{ justifyContent: 'center', marginTop: 10 }}>
            <div className="lang">
              {(['en', 'hi', 'bn'] as LangId[]).map((l) => (
                <button key={l} type="button" className={lang === l ? 'on' : ''} onClick={() => onLang(l)}>
                  {l === 'en' ? 'EN' : l === 'hi' ? 'हिन्दी' : 'বাংলা'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="login-card">
          {step === 'name' ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                goPin();
              }}
            >
              <label className="lbl" style={{ textAlign: 'center', fontSize: 13.5 }}>
                {T('Your name', lang)}
              </label>
              <input
                className="name mt"
                placeholder={T('Type your name', lang)}
                value={name}
                autoComplete="off"
                autoFocus
                onChange={(e) => setName(e.target.value)}
              />
              {recentNames.length > 0 && (
                <div className="recent-names mt">
                  <span className="muted" style={{ fontSize: 11.5, fontWeight: 600 }}>
                    Recent:
                  </span>
                  {recentNames.map((rn) => (
                    <button key={rn} type="button" className="chip" onClick={() => goPin(rn)}>
                      {rn}
                    </button>
                  ))}
                </div>
              )}
              <button type="submit" className="btn gold block mt2">
                {T('Next', lang)} <Ico name="next" />
              </button>
            </form>
          ) : (
            <div>
              <div className="flex between" style={{ marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span className="luser-av">{name.trim().charAt(0).toUpperCase()}</span>
                  <b style={{ fontSize: 16 }}>{name}</b>
                </div>
                <button
                  type="button"
                  className="btn ghost sm"
                  style={{ minHeight: 30, padding: '0 10px', fontSize: 12.5 }}
                  onClick={() => {
                    setStep('name');
                    setPin('');
                  }}
                >
                  Change
                </button>
              </div>
              <div className="lbl" style={{ textAlign: 'center', marginTop: 6, fontSize: 12.5 }}>
                {busy ? 'Checking PIN…' : T('Enter PIN', lang)}
              </div>
              <div className={`dots${shake ? ' shake' : ''}`}>
                {[0, 1, 2, 3].map((i) => (
                  <i key={i} className={pin.length > i ? 'f' : ''} />
                ))}
              </div>
              <div className="pad">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
                  <button key={n} type="button" disabled={busy} onClick={() => handleDigit(n)}>
                    {n}
                  </button>
                ))}
                <button type="button" className="fn" disabled={busy} onClick={() => setPin('')}>
                  Clear
                </button>
                <button type="button" disabled={busy} onClick={() => handleDigit('0')}>
                  0
                </button>
                <button type="button" className="fn" disabled={busy} onClick={() => setPin((p) => p.slice(0, -1))}>
                  ⌫
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="appver">Version {APP_VERSION}</div>
      </div>
    </div>
  );
};

export const UnitSelectView: React.FC<{
  me: UserMe;
  lang: LangId;
  onLang: (l: LangId) => void;
  onSelectUnit: (u: string) => void;
  onLogout: () => void;
}> = ({ me, lang, onLang, onSelectUnit, onLogout }) => (
  <>
    <TopBar
      title={T('Choose unit', lang)}
      sub={me.name}
      lang={lang}
      onLang={onLang}
      me={me}
      unit=""
      onLogout={onLogout}
    />
    <main>
      <div className="card mt2" style={{ textAlign: 'center', maxWidth: 520, margin: '28px auto 0' }}>
        <b style={{ fontSize: 19 }}>{T('Choose unit', lang)}</b>
        <p className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>
          Select the workshop unit for this session
        </p>
        <div className="ucards mt2">
          {me.units.map((u) => (
            <button key={u} type="button" className={`ucard ${u}`} onClick={() => onSelectUnit(u)}>
              <b>{u}</b>
              {T('Unit', lang)}
            </button>
          ))}
        </div>
      </div>
    </main>
  </>
);
