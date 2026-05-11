/* global React */
const { useState, useEffect, useRef } = React;

// -----------------------------
// Mic icon (3 styles)
// -----------------------------
function MicIcon({ style = 'classic', size = 56, color = '#7aa2f7', glow = true }) {
  if (style === 'minimal') {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
        <rect x="22" y="10" width="12" height="24" rx="6" stroke={color} strokeWidth="2.5"/>
        <path d="M16 26c0 6.6 5.4 12 12 12s12-5.4 12-12" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M28 38v8" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    );
  }
  if (style === 'wave') {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
        <rect x="24" y="14" width="8" height="22" rx="4" fill={color}/>
        <g stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.55">
          <path d="M14 22v12"/>
          <path d="M18 18v20"/>
          <path d="M38 18v20"/>
          <path d="M42 22v12"/>
        </g>
        <path d="M28 40v6" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    );
  }
  // classic
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      {glow && (
        <circle cx="28" cy="26" r="18" fill={color} opacity="0.12"/>
      )}
      <rect x="22" y="12" width="12" height="22" rx="6" fill={color}/>
      <path d="M16 26c0 6.6 5.4 12 12 12s12-5.4 12-12" stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      <path d="M28 38v8" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M22 46h12" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}

// -----------------------------
// Key cap
// -----------------------------
function Kbd({ children, theme }) {
  const isDark = theme === 'dark';
  return (
    <kbd style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 24,
      height: 24,
      padding: '0 7px',
      borderRadius: 6,
      fontFamily: 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace',
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.02em',
      background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,20,25,0.05)',
      color: isDark ? '#c8d3e0' : '#3a4452',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,20,25,0.08)'}`,
      boxShadow: isDark
        ? 'inset 0 -1px 0 rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.04)'
        : 'inset 0 -1px 0 rgba(15,20,25,0.06), 0 1px 0 rgba(255,255,255,0.8)',
    }}>{children}</kbd>
  );
}

// -----------------------------
// Window chrome (GNOME-style)
// -----------------------------
function WindowChrome({ title, theme, children, statusbar = true, statusContent }) {
  const isDark = theme === 'dark';
  const C = isDark ? darkTokens : lightTokens;

  return (
    <div style={{
      width: '100%',
      height: '100%',
      borderRadius: 14,
      overflow: 'hidden',
      background: C.bg,
      color: C.fg,
      fontFamily: 'system-ui, -apple-system, "Cantarell", "Segoe UI", "SF Pro Text", sans-serif',
      display: 'flex',
      flexDirection: 'column',
      border: `1px solid ${C.windowBorder}`,
      boxShadow: isDark
        ? '0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.02)'
        : '0 24px 60px rgba(15,20,25,0.18), 0 0 0 1px rgba(15,20,25,0.04)',
    }}>
      {/* Header bar */}
      <div style={{
        height: 44,
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px 0 16px',
        background: C.headerBg,
        borderBottom: `1px solid ${C.divider}`,
        position: 'relative',
        flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute',
          left: 0, right: 0,
          textAlign: 'center',
          fontSize: 13,
          fontWeight: 600,
          color: C.fgMuted,
          pointerEvents: 'none',
        }}>{title}</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <WindowBtn theme={theme} type="min"/>
          <WindowBtn theme={theme} type="max"/>
          <WindowBtn theme={theme} type="close"/>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {children}
      </div>

      {/* Statusbar */}
      {statusbar && (
        <div style={{
          height: 30,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: 10,
          borderTop: `1px solid ${C.divider}`,
          background: C.statusBg,
          fontSize: 11,
          color: C.fgMuted,
          flexShrink: 0,
        }}>
          {statusContent}
        </div>
      )}
    </div>
  );
}

function WindowBtn({ theme, type }) {
  const isDark = theme === 'dark';
  const bg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,20,25,0.06)';
  const fg = isDark ? '#9aa6b8' : '#5a6678';
  const icon = {
    min: <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5h6" stroke={fg} strokeWidth="1.4" strokeLinecap="round"/></svg>,
    max: <svg width="10" height="10" viewBox="0 0 10 10"><rect x="2" y="2" width="6" height="6" rx="1.2" stroke={fg} strokeWidth="1.4" fill="none"/></svg>,
    close: <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke={fg} strokeWidth="1.4" strokeLinecap="round"/></svg>,
  };
  return (
    <div style={{
      width: 26, height: 26,
      borderRadius: '50%',
      background: bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>{icon[type]}</div>
  );
}

// -----------------------------
// Tabs
// -----------------------------
function Tabs({ active, onChange, theme }) {
  const isDark = theme === 'dark';
  const C = isDark ? darkTokens : lightTokens;
  const tabs = [
    { id: 'record', label: 'Record', icon: <CircleDot/> },
    { id: 'history', label: 'History', icon: <ListIcon/> },
    { id: 'settings', label: 'Settings', icon: <GearIcon/> },
  ];
  return (
    <div style={{
      display: 'flex',
      padding: '8px 14px 0',
      gap: 4,
      borderBottom: `1px solid ${C.divider}`,
      background: C.bg,
      flexShrink: 0,
    }}>
      {tabs.map(t => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '8px 14px 10px',
              border: 'none',
              background: 'transparent',
              fontSize: 13,
              fontWeight: 500,
              color: isActive ? C.fg : C.fgMuted,
              cursor: 'pointer',
              borderBottom: `2px solid ${isActive ? C.accent : 'transparent'}`,
              marginBottom: -1,
              fontFamily: 'inherit',
              transition: 'color 160ms ease',
            }}>
            <span style={{ opacity: isActive ? 1 : 0.7, color: isActive ? C.accent : 'currentColor', display: 'flex' }}>{t.icon}</span>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function CircleDot() { return <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/><circle cx="8" cy="8" r="2.4" fill="currentColor"/></svg>; }
function ListIcon() { return <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M3 8h10M3 12h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>; }
function GearIcon() { return <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.4"/><path d="M8 1.5v2M8 12.5v2M14.5 8h-2M3.5 8h-2M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4M12.6 12.6l-1.4-1.4M4.8 4.8L3.4 3.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>; }

// -----------------------------
// Record tab
// -----------------------------
function RecordTab({ theme, micStyle }) {
  const isDark = theme === 'dark';
  const C = isDark ? darkTokens : lightTokens;

  const recents = [
    { time: '2 min ago', text: 'Add a useEffect hook to fetch the user data when the component mounts and clean up on unmount.', dur: '0:14' },
    { time: '18 min ago', text: 'Refactor the auth middleware to use async/await instead of promise chains.', dur: '0:09' },
    { time: '1 hour ago', text: 'The login form should validate email format on blur and show an inline error message.', dur: '0:21' },
  ];

  return (
    <div style={{
      flex: 1,
      display: 'grid',
      gridTemplateRows: '1fr auto',
      padding: '32px 36px 20px',
      gap: 24,
      minHeight: 0,
    }}>
      {/* Hero */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        paddingTop: 12,
      }}>
        {/* Mic with breathing ring */}
        <div style={{ position: 'relative', width: 124, height: 124, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${C.accent}22 0%, transparent 65%)`,
          }}/>
          <div style={{
            position: 'absolute',
            inset: 14,
            borderRadius: '50%',
            border: `1px solid ${C.accent}33`,
            animation: 'vfBreathe 4s ease-in-out infinite',
          }}/>
          <div style={{
            width: 88,
            height: 88,
            borderRadius: 22,
            background: isDark
              ? 'linear-gradient(160deg, #1d2330 0%, #161b25 100%)'
              : 'linear-gradient(160deg, #ffffff 0%, #eef2f7 100%)',
            border: `1px solid ${C.cardBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: isDark
              ? 'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.4)'
              : 'inset 0 1px 0 rgba(255,255,255,0.9), 0 8px 24px rgba(15,20,25,0.08)',
          }}>
            <MicIcon style={micStyle} color={C.accent} size={48}/>
          </div>
        </div>

        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', color: C.fg }}>Ready</div>
          <div style={{ fontSize: 13, color: C.fgMuted }}>Press the hotkey to start recording</div>
        </div>

        {/* Hotkey card */}
        <div style={{
          display: 'flex',
          gap: 10,
          marginTop: 4,
          padding: '12px 18px',
          background: C.cardBg,
          border: `1px solid ${C.cardBorder}`,
          borderRadius: 12,
        }}>
          <HotkeyRow theme={theme} keys={['Ctrl', 'Shift', 'Space']} label="Record"/>
          <div style={{ width: 1, background: C.divider }}/>
          <HotkeyRow theme={theme} keys={['Ctrl', 'Shift', 'H']} label="History"/>
        </div>
      </div>

      {/* Recent transcriptions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.fgFaint }}>Recent</div>
          <div style={{ fontSize: 11, color: C.fgFaint, fontWeight: 500 }}>View all →</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {recents.map((r, i) => (
            <div key={i} style={{
              display: 'grid',
              gridTemplateColumns: '70px 1fr auto',
              alignItems: 'center',
              gap: 14,
              padding: '10px 14px',
              background: C.cardBg,
              border: `1px solid ${C.cardBorder}`,
              borderRadius: 10,
              fontSize: 12.5,
            }}>
              <div style={{ color: C.fgFaint, fontSize: 11, fontWeight: 500 }}>{r.time}</div>
              <div style={{
                color: C.fg,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: 1.4,
              }}>{r.text}</div>
              <div style={{ color: C.fgFaint, fontSize: 11, fontFamily: 'ui-monospace, monospace' }}>{r.dur}</div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes vfBreathe {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.08); opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

function HotkeyRow({ keys, label, theme }) {
  const C = theme === 'dark' ? darkTokens : lightTokens;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {keys.map((k, i) => (
          <React.Fragment key={i}>
            <Kbd theme={theme}>{k}</Kbd>
            {i < keys.length - 1 && <span style={{ color: C.fgFaint, fontSize: 11 }}>+</span>}
          </React.Fragment>
        ))}
      </div>
      <span style={{ fontSize: 11.5, color: C.fgMuted, fontWeight: 500 }}>{label}</span>
    </div>
  );
}

// -----------------------------
// History tab
// -----------------------------
function HistoryTab({ theme }) {
  const isDark = theme === 'dark';
  const C = isDark ? darkTokens : lightTokens;
  const [selected, setSelected] = useState(0);

  const items = [
    { time: '2 min ago', date: 'Today', dur: '0:14', text: 'Add a useEffect hook to fetch the user data when the component mounts and clean up on unmount.', words: 21, model: 'whisper-large-v3' },
    { time: '18 min ago', date: 'Today', dur: '0:09', text: 'Refactor the auth middleware to use async/await instead of promise chains.', words: 12, model: 'whisper-large-v3' },
    { time: '1 hour ago', date: 'Today', dur: '0:21', text: 'The login form should validate email format on blur and show an inline error message below the field.', words: 18, model: 'whisper-large-v3' },
    { time: 'Yesterday', date: 'Yesterday', dur: '0:32', text: 'Set up a GitHub Actions workflow that runs tests on pull requests and deploys to staging on merge to main.', words: 26, model: 'whisper-large-v3' },
    { time: 'Yesterday', date: 'Yesterday', dur: '0:08', text: 'Add a dark mode toggle to the settings panel.', words: 9, model: 'whisper-medium' },
    { time: '3 days ago', date: 'Earlier', dur: '0:45', text: 'Build a context menu component with keyboard navigation, support for nested submenus, and proper focus management when it opens and closes.', words: 32, model: 'whisper-large-v3' },
  ];

  const sel = items[selected];

  return (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '320px 1fr', minHeight: 0 }}>
      {/* List */}
      <div style={{
        borderRight: `1px solid ${C.divider}`,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ padding: '14px 16px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 10px',
            background: C.cardBg,
            border: `1px solid ${C.cardBorder}`,
            borderRadius: 8,
            fontSize: 12.5,
            color: C.fgFaint,
          }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4"/><path d="M10.5 10.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            Search transcriptions
          </div>
        </div>
        {['Today', 'Yesterday', 'Earlier'].map(group => {
          const groupItems = items.filter(it => it.date === group);
          if (!groupItems.length) return null;
          return (
            <div key={group}>
              <div style={{ padding: '10px 16px 6px', fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.fgFaint }}>{group}</div>
              {groupItems.map((it) => {
                const idx = items.indexOf(it);
                const isSel = idx === selected;
                return (
                  <div key={idx} onClick={() => setSelected(idx)} style={{
                    padding: '10px 16px',
                    cursor: 'pointer',
                    background: isSel ? (isDark ? `${C.accent}1a` : `${C.accent}14`) : 'transparent',
                    borderLeft: `2px solid ${isSel ? C.accent : 'transparent'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.fgFaint }}>
                      <span>{it.time}</span>
                      <span style={{ fontFamily: 'ui-monospace, monospace' }}>{it.dur}</span>
                    </div>
                    <div style={{
                      fontSize: 12.5,
                      color: C.fg,
                      lineHeight: 1.4,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}>{it.text}</div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Detail */}
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 11.5, color: C.fgFaint }}>{sel.time}</div>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: C.fgFaint }}/>
            <div style={{ fontSize: 11.5, color: C.fgFaint, fontFamily: 'ui-monospace, monospace' }}>{sel.dur}</div>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: C.fgFaint }}/>
            <div style={{ fontSize: 11.5, color: C.fgFaint }}>{sel.words} words</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <IconBtn theme={theme} icon="copy"/>
            <IconBtn theme={theme} icon="play"/>
            <IconBtn theme={theme} icon="more"/>
          </div>
        </div>
        <div style={{
          padding: 16,
          background: C.cardBg,
          border: `1px solid ${C.cardBorder}`,
          borderRadius: 10,
          fontSize: 14,
          lineHeight: 1.55,
          color: C.fg,
        }}>
          {sel.text}
        </div>
        <div style={{
          fontSize: 11,
          color: C.fgFaint,
          display: 'flex',
          gap: 14,
          padding: '0 4px',
        }}>
          <span>Model: <span style={{ fontFamily: 'ui-monospace, monospace', color: C.fgMuted }}>{sel.model}</span></span>
          <span>Language: <span style={{ color: C.fgMuted }}>English</span></span>
        </div>
      </div>
    </div>
  );
}

function IconBtn({ icon, theme }) {
  const C = theme === 'dark' ? darkTokens : lightTokens;
  const ic = {
    copy: <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M3 11V4a1 1 0 011-1h7" stroke="currentColor" strokeWidth="1.4"/></svg>,
    play: <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M5 3.5l8 4.5-8 4.5v-9z" fill="currentColor"/></svg>,
    more: <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="3.5" cy="8" r="1.2" fill="currentColor"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/><circle cx="12.5" cy="8" r="1.2" fill="currentColor"/></svg>,
  };
  return (
    <button style={{
      width: 28, height: 28,
      border: `1px solid ${C.cardBorder}`,
      background: C.cardBg,
      borderRadius: 7,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: C.fgMuted,
      cursor: 'pointer',
    }}>{ic[icon]}</button>
  );
}

// -----------------------------
// Settings tab
// -----------------------------
function SettingsTab({ theme }) {
  const isDark = theme === 'dark';
  const C = isDark ? darkTokens : lightTokens;

  const Section = ({ title, children }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.fgFaint }}>{title}</div>
      <div style={{
        background: C.cardBg,
        border: `1px solid ${C.cardBorder}`,
        borderRadius: 10,
        overflow: 'hidden',
      }}>{children}</div>
    </div>
  );

  const Row = ({ label, hint, control, last }) => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      alignItems: 'center',
      gap: 16,
      padding: '12px 14px',
      borderBottom: last ? 'none' : `1px solid ${C.divider}`,
    }}>
      <div>
        <div style={{ fontSize: 13, color: C.fg, fontWeight: 500 }}>{label}</div>
        {hint && <div style={{ fontSize: 11.5, color: C.fgFaint, marginTop: 2 }}>{hint}</div>}
      </div>
      <div>{control}</div>
    </div>
  );

  const Select = ({ value }) => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '5px 8px 5px 10px',
      background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,20,25,0.04)',
      border: `1px solid ${C.cardBorder}`,
      borderRadius: 7,
      fontSize: 12.5,
      color: C.fg,
      minWidth: 160,
    }}>
      <span style={{ flex: 1 }}>{value}</span>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 4l3 3 3-3" stroke={C.fgMuted} strokeWidth="1.4" strokeLinecap="round"/></svg>
    </div>
  );

  const Toggle = ({ on }) => (
    <div style={{
      width: 36, height: 20,
      borderRadius: 10,
      background: on ? C.accent : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,20,25,0.12)'),
      position: 'relative',
      transition: 'background 160ms ease',
    }}>
      <div style={{
        position: 'absolute',
        top: 2,
        left: on ? 18 : 2,
        width: 16, height: 16,
        borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        transition: 'left 160ms ease',
      }}/>
    </div>
  );

  return (
    <div style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20, overflow: 'auto' }}>
      <Section title="Transcription">
        <Row label="Model" hint="Larger models are more accurate but slower" control={<Select value="whisper-large-v3"/>}/>
        <Row label="Language" hint="Auto-detect or specify a language" control={<Select value="Auto-detect"/>}/>
        <Row label="Punctuation" hint="Add punctuation and capitalization automatically" control={<Toggle on={true}/>} last/>
      </Section>

      <Section title="Hotkeys">
        <Row label="Start recording" control={
          <div style={{ display: 'flex', gap: 4 }}>
            <Kbd theme={theme}>Ctrl</Kbd><Kbd theme={theme}>Shift</Kbd><Kbd theme={theme}>Space</Kbd>
          </div>
        }/>
        <Row label="Open history" control={
          <div style={{ display: 'flex', gap: 4 }}>
            <Kbd theme={theme}>Ctrl</Kbd><Kbd theme={theme}>Shift</Kbd><Kbd theme={theme}>H</Kbd>
          </div>
        } last/>
      </Section>

      <Section title="Appearance">
        <Row label="Show overlay" hint="Floating recorder pill while recording" control={<Toggle on={true}/>}/>
        <Row label="Auto-paste" hint="Paste transcription into the focused window" control={<Toggle on={true}/>} last/>
      </Section>
    </div>
  );
}

// -----------------------------
// Tokens
// -----------------------------
const darkTokens = {
  bg: '#0f1419',
  headerBg: '#161b22',
  statusBg: '#0c1015',
  fg: '#e4ecf5',
  fgMuted: '#9aa6b8',
  fgFaint: '#5f6b7c',
  divider: 'rgba(255,255,255,0.06)',
  windowBorder: 'rgba(255,255,255,0.08)',
  cardBg: 'rgba(255,255,255,0.03)',
  cardBorder: 'rgba(255,255,255,0.06)',
  accent: '#7aa2f7',
};

const lightTokens = {
  bg: '#fafbfc',
  headerBg: '#f1f3f6',
  statusBg: '#eef1f5',
  fg: '#1a2330',
  fgMuted: '#5a6678',
  fgFaint: '#8b96a8',
  divider: 'rgba(15,20,25,0.07)',
  windowBorder: 'rgba(15,20,25,0.1)',
  cardBg: '#ffffff',
  cardBorder: 'rgba(15,20,25,0.07)',
  accent: '#3b6fd6',
};

// -----------------------------
// Main window
// -----------------------------
function MainWindow({ theme = 'dark', tab = 'record', micStyle = 'classic', statusbar = true }) {
  const C = theme === 'dark' ? darkTokens : lightTokens;
  const [active, setActive] = useState(tab);

  useEffect(() => setActive(tab), [tab]);

  const statusContent = (
    <>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 8px',
        background: `${C.accent}1a`,
        color: C.accent,
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.06em',
      }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.accent }}/>
        READY
      </div>
      <span>VoxForge</span>
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Kbd theme={theme}>Ctrl</Kbd>
        <span style={{ color: C.fgFaint }}>+</span>
        <Kbd theme={theme}>Shift</Kbd>
        <span style={{ color: C.fgFaint }}>+</span>
        <Kbd theme={theme}>Space</Kbd>
        <span style={{ marginLeft: 6 }}>to record</span>
      </span>
    </>
  );

  return (
    <WindowChrome title="VoxForge" theme={theme} statusbar={statusbar} statusContent={statusContent}>
      <Tabs active={active} onChange={setActive} theme={theme}/>
      {active === 'record' && <RecordTab theme={theme} micStyle={micStyle}/>}
      {active === 'history' && <HistoryTab theme={theme}/>}
      {active === 'settings' && <SettingsTab theme={theme}/>}
    </WindowChrome>
  );
}

Object.assign(window, { MainWindow, MicIcon, Kbd, darkTokens, lightTokens });
