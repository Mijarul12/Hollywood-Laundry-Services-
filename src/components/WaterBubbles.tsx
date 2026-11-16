import React from 'react';

interface BubbleSpec {
  left: string;
  size: number;
  dur: string;
  delay: string;
  drift: string;
}

const AMBIENT_BUBBLES: BubbleSpec[] = [
  { left: '6%', size: 22, dur: '15s', delay: '-2s', drift: '14px' },
  { left: '14%', size: 12, dur: '11s', delay: '-7s', drift: '-10px' },
  { left: '23%', size: 30, dur: '18s', delay: '-5s', drift: '18px' },
  { left: '34%', size: 15, dur: '13s', delay: '-11s', drift: '-14px' },
  { left: '46%', size: 26, dur: '16s', delay: '-3s', drift: '12px' },
  { left: '58%', size: 14, dur: '12s', delay: '-8s', drift: '-12px' },
  { left: '69%', size: 34, dur: '19s', delay: '-6s', drift: '16px' },
  { left: '78%', size: 18, dur: '14s', delay: '-12s', drift: '-16px' },
  { left: '87%', size: 24, dur: '16s', delay: '-4s', drift: '11px' },
  { left: '94%', size: 11, dur: '10.5s', delay: '-9s', drift: '-9px' },
];

const HERO_BUBBLES: BubbleSpec[] = [
  { left: '8%', size: 14, dur: '9s', delay: '-1s', drift: '8px' },
  { left: '19%', size: 22, dur: '12s', delay: '-5s', drift: '-10px' },
  { left: '33%', size: 10, dur: '8s', delay: '-3s', drift: '7px' },
  { left: '51%', size: 18, dur: '11s', delay: '-7s', drift: '-9px' },
  { left: '67%', size: 26, dur: '13s', delay: '-2s', drift: '11px' },
  { left: '81%', size: 13, dur: '9.5s', delay: '-6s', drift: '-8px' },
  { left: '91%', size: 19, dur: '10.5s', delay: '-4s', drift: '9px' },
];

const LOGIN_BUBBLES: BubbleSpec[] = [
  { left: '5%', size: 18, dur: '15s', delay: '-3s', drift: '16px' },
  { left: '12%', size: 34, dur: '20s', delay: '-9s', drift: '-14px' },
  { left: '19%', size: 12, dur: '12s', delay: '-6s', drift: '10px' },
  { left: '27%', size: 24, dur: '17s', delay: '-13s', drift: '-18px' },
  { left: '36%', size: 15, dur: '13.5s', delay: '-2s', drift: '12px' },
  { left: '44%', size: 42, dur: '22s', delay: '-10s', drift: '-15px' },
  { left: '56%', size: 14, dur: '12.5s', delay: '-5s', drift: '14px' },
  { left: '64%', size: 28, dur: '18s', delay: '-14s', drift: '-12px' },
  { left: '73%', size: 16, dur: '14s', delay: '-4s', drift: '15px' },
  { left: '82%', size: 38, dur: '21s', delay: '-8s', drift: '-16px' },
  { left: '89%', size: 13, dur: '11.5s', delay: '-7s', drift: '10px' },
  { left: '95%', size: 22, dur: '16s', delay: '-11s', drift: '-11px' },
];

export const WaterBubbles: React.FC<{ variant?: 'ambient' | 'hero' | 'login' }> = ({ variant = 'ambient' }) => {
  const list = variant === 'login' ? LOGIN_BUBBLES : variant === 'hero' ? HERO_BUBBLES : AMBIENT_BUBBLES;
  const cls = variant === 'login' ? 'wb-login' : variant === 'hero' ? 'wb-hero' : 'wb-ambient';
  return (
    <div className={`wb-layer ${cls}`} aria-hidden="true">
      {list.map((b, i) => (
        <span
          key={i}
          className="wb-bubble"
          style={
            {
              left: b.left,
              width: b.size,
              height: b.size,
              '--wb-dur': b.dur,
              '--wb-delay': b.delay,
              '--wb-drift': b.drift,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
};
