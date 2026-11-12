import { PLATFORMS } from "@/lib/services";

/** Simple one-colour platform logos (drawn in the current text colour, 24×24). Unknown platforms fall back to letters. */
const GLYPHS: Record<string, React.ReactNode> = {
  tiktok: <path fill="currentColor" d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />,
  instagram: (
    <g fill="none" stroke="currentColor" strokeWidth="2.2">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="0.6" fill="currentColor" />
    </g>
  ),
  youtube: (
    <g>
      <rect x="1.5" y="5" width="21" height="14" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path fill="currentColor" d="M10 8.8v6.4l5.4-3.2z" />
    </g>
  ),
  facebook: <path fill="currentColor" d="M13.5 22v-8.2h2.8l.4-3.3h-3.2V8.4c0-.9.3-1.6 1.6-1.6h1.7V3.9c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.4H7.3v3.3h2.8V22h3.4z" />,
  x: <path fill="currentColor" d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.68l7.73-8.84L1.25 2.25h6.83l4.71 6.23zm-1.16 17.52h1.83L7.08 4.13H5.12z" />,
  telegram: <path fill="currentColor" d="M21.4 3.6 2.9 10.7c-1.3.5-1.2 1.2-.2 1.5l4.7 1.5 1.8 5.5c.2.6.1.9.8.9.5 0 .7-.2 1-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8l3.1-14.6c.3-1.3-.5-1.9-1.5-1.4zM9.4 14.4l-.4 4.1-1.4-4.6 10.2-6.4-8.4 6.9z" />,
  spotify: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" strokeWidth="1.8" />
      <path d="M7 9.5c3.5-1 7.3-.7 10.3 1M7.6 12.8c2.8-.8 5.8-.5 8.2.9M8.3 15.9c2.1-.5 4.2-.3 6 .7" />
    </g>
  ),
  whatsapp: <path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-1.4-.6-2.6-1.7-3.3-3-.1-.2 0-.4.1-.5l.4-.5.3-.5v-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.8.8-1.1 1.8-.9 2.9.4 1.5 1.3 2.9 2.5 4 1.3 1.2 2.9 2 4.6 2.3.9.1 1.9-.2 2.5-.9.3-.3.4-.8.4-1.2-.1-.2-.2-.2-.4-.3z" />,
};

/** Coloured square with the platform's logo (home, order, trial, orders list). */
export function PlatformIcon({ slug, size = 38, radius = 11, color }: { slug: string; size?: number; radius?: number; color?: string | null }) {
  const info = PLATFORMS[slug];
  const glyph = GLYPHS[slug];
  return (
    <span className="grid flex-none place-items-center font-extrabold text-white" style={{ width: size, height: size, borderRadius: radius, background: color ?? info?.color ?? "#334155", fontSize: Math.round(size * 0.36) }} aria-hidden>
      {glyph ? <svg width={Math.round(size * 0.58)} height={Math.round(size * 0.58)} viewBox="0 0 24 24">{glyph}</svg> : info?.letter ?? "•"}
    </span>
  );
}
