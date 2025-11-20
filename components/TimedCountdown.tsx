import React from 'react';

interface TimedCountdownProps {
  startedAt: string; // ISO
  allowedSeconds: number;
  size?: number; // px
}

function formatSeconds(sec: number) {
  const sign = sec < 0 ? '-' : '';
  const s = Math.abs(Math.round(sec));
  const mm = Math.floor(s / 60).toString().padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return `${sign}${mm}:${ss}`;
}

export default function TimedCountdown({ startedAt, allowedSeconds, size = 32 }: TimedCountdownProps) {
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const started = new Date(startedAt).getTime();
  const elapsed = Math.max(0, Math.floor((now - started) / 1000));
  const remaining = allowedSeconds - elapsed;

  const radius = (size - 4) / 2;
  const stroke = 3;
  const circumference = 2 * Math.PI * radius;

  const progress = Math.min(Math.max(elapsed / allowedSeconds, 0), 1);
  const dash = circumference * progress;

  const over = elapsed > allowedSeconds ? Math.min((elapsed - allowedSeconds) / allowedSeconds, 1) : 0;
  const overDash = circumference * over;

  return (
    <div style={{ width: size, height: size, display: 'inline-block' }} aria-hidden>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`translate(${size/2}, ${size/2})`}>
          {/* background ring */}
          <circle r={radius} cx={0} cy={0} fill="none" stroke="#eef2ff" strokeWidth={stroke} />
          {/* progress ring (blue) */}
          <circle
            r={radius}
            cx={0}
            cy={0}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference - dash}`}
            transform={`rotate(-90)`}
          />
          {/* overage ring (red) grows in opposite direction when over time) */}
          {over > 0 && (
            <circle
              r={radius}
              cx={0}
              cy={0}
              fill="none"
              stroke="#ef4444"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${overDash} ${circumference - overDash}`}
              transform={`scale(-1,1) rotate(-90)`}
            />
          )}
          {/* center text */}
          <text x={0} y={4} textAnchor="middle" fontSize={10} fill={over > 0 ? '#ef4444' : '#1f2937'} style={{ fontFamily: 'monospace' }}>
            {formatSeconds(remaining)}
          </text>
        </g>
      </svg>
    </div>
  );
}
