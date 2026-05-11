/* global React */
const { useState, useEffect, useRef } = React;

// -----------------------------
// Waveform
// -----------------------------
function Waveform({ color, bars = 28, animated = true, height = 22 }) {
  const [seed, setSeed] = useState(0);
  useEffect(() => {
    if (!animated) return;
    const id = setInterval(() => setSeed(s => s + 1), 110);
    return () => clearInterval(id);
  }, [animated]);

  const getBar = (i) => {
    const phase = (seed * 0.7 + i * 0.45);
    const v = (Math.sin(phase) * 0.5 + 0.5) * (Math.sin(phase * 0.3 + i) * 0.4 + 0.6);
    return Math.max(0.18, Math.min(1, v));
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      height,
    }}>
      {Array.from({ length: bars }).map((_, i) => {
        const v = animated ? getBar(i) : (Math.sin(i * 0.6) * 0.4 + 0.5);
        return (
          <div key={i} style={{
            width: 2.5,
            height: `${v * 100}%`,
            background: color,
            borderRadius: 1,
            opacity: 0.6 + v * 0.4,
            transition: 'height 110ms ease',
          }}/>
        );
      })}
    </div>
  );
}

// -----------------------------
// Pulsing rec dot
// -----------------------------
function RecDot({ color }) {
  return (
    <div style={{ position: 'relative', width: 10, height: 10 }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '50%',
        background: color,
        animation: 'vfPulse 1.6s ease-in-out infinite',
      }}/>
      <div style={{
        position: 'absolute',
        inset: 1,
        borderRadius: '50%',
        background: color,
      }}/>
      <style>{`
        @keyframes vfPulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// -----------------------------
// Spinner
// -----------------------------
function Spinner({ color, size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ animation: 'vfSpin 0.9s linear infinite' }}>
      <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.6" fill="none" opacity="0.2"/>
      <path d="M14 8a6 6 0 00-6-6" stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none"/>
      <style>{`@keyframes vfSpin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  );
}

// -----------------------------
// Overlay
// -----------------------------
const overlayDark = {
  bg: 'rgba(20, 25, 33, 0.92)',
  border: 'rgba(255,255,255,0.08)',
  fg: '#e4ecf5',
  fgMuted: '#9aa6b8',
  accent: '#7aa2f7',
  rec: '#f7768e',
  done: '#7dd3a0',
};
const overlayLight = {
  bg: 'rgba(255, 255, 255, 0.94)',
  border: 'rgba(15,20,25,0.1)',
  fg: '#1a2330',
  fgMuted: '#5a6678',
  accent: '#3b6fd6',
  rec: '#d33b5e',
  done: '#2d8f5a',
};

function Overlay({ state = 'recording', theme = 'dark', duration = '0:14', text = '', dim = false }) {
  const C = theme === 'dark' ? overlayDark : overlayLight;

  const shell = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 16px',
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: 100,
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    boxShadow: theme === 'dark'
      ? '0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)'
      : '0 12px 40px rgba(15,20,25,0.18), inset 0 1px 0 rgba(255,255,255,0.7)',
    fontFamily: 'system-ui, -apple-system, "Cantarell", "Segoe UI", sans-serif',
    fontSize: 13,
    color: C.fg,
    minWidth: 220,
    height: 44,
    boxSizing: 'border-box',
    opacity: dim ? 0.5 : 1,
  };

  if (state === 'recording') {
    return (
      <div style={shell}>
        <RecDot color={C.rec}/>
        <Waveform color={C.accent}/>
        <span style={{
          marginLeft: 'auto',
          fontFamily: 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace',
          fontSize: 12,
          color: C.fgMuted,
          fontWeight: 500,
          fontVariantNumeric: 'tabular-nums',
        }}>{duration}</span>
      </div>
    );
  }

  if (state === 'transcribing') {
    return (
      <div style={shell}>
        <Spinner color={C.accent}/>
        <span style={{ color: C.fgMuted, fontWeight: 500, letterSpacing: '0.01em' }}>Transcribing</span>
        <ThreeDots color={C.fgMuted}/>
        <span style={{
          marginLeft: 'auto',
          fontFamily: 'ui-monospace, monospace',
          fontSize: 12,
          color: C.fgMuted,
          fontVariantNumeric: 'tabular-nums',
        }}>{duration}</span>
      </div>
    );
  }

  if (state === 'done') {
    return (
      <div style={{ ...shell, minWidth: 280, maxWidth: 380 }}>
        <div style={{
          width: 18, height: 18,
          borderRadius: '50%',
          background: `${C.done}26`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5l2 2 4-4" stroke={C.done} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <span style={{
          flex: 1,
          color: C.fg,
          fontSize: 12.5,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontWeight: 500,
        }}>{text || 'Pasted to clipboard'}</span>
      </div>
    );
  }

  return null;
}

function ThreeDots({ color }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2, marginLeft: -6 }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 3, height: 3, borderRadius: '50%',
          background: color,
          animation: `vfDot 1.2s ease-in-out ${i * 0.15}s infinite`,
        }}/>
      ))}
      <style>{`
        @keyframes vfDot {
          0%, 60%, 100% { opacity: 0.2; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-2px); }
        }
      `}</style>
    </span>
  );
}

Object.assign(window, { Overlay, Waveform });
