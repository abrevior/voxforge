export type MicStyle = "classic" | "minimal" | "wave";

interface Props {
  style?: MicStyle;
  size?: number;
  color?: string;
  glow?: boolean;
}

export function MicIcon({
  style = "classic",
  size = 56,
  color = "var(--accent)",
  glow = true,
}: Props) {
  if (style === "minimal") {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
        <rect x="22" y="10" width="12" height="24" rx="6" stroke={color} strokeWidth="2.5" />
        <path d="M16 26c0 6.6 5.4 12 12 12s12-5.4 12-12" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M28 38v8" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (style === "wave") {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
        <rect x="24" y="14" width="8" height="22" rx="4" fill={color} />
        <g stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.55">
          <path d="M14 22v12" />
          <path d="M18 18v20" />
          <path d="M38 18v20" />
          <path d="M42 22v12" />
        </g>
        <path d="M28 40v6" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      {glow && <circle cx="28" cy="26" r="18" fill={color} opacity="0.12" />}
      <rect x="22" y="12" width="12" height="22" rx="6" fill={color} />
      <path d="M16 26c0 6.6 5.4 12 12 12s12-5.4 12-12" stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M28 38v8" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M22 46h12" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
