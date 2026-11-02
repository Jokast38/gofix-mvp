// Inline SVG flags (no emoji: Windows renders flag emoji as letters; no external image).
export function FlagFR({ className = "" }) {
  return (
    <svg viewBox="0 0 3 2" className={className} aria-hidden="true" focusable="false">
      <path fill="#002654" d="M0 0h1v2H0z" />
      <path fill="#fff" d="M1 0h1v2H1z" />
      <path fill="#CE1126" d="M2 0h1v2H2z" />
    </svg>
  );
}

export function FlagDZ({ className = "" }) {
  return (
    <svg viewBox="0 0 900 600" className={className} aria-hidden="true" focusable="false">
      <path fill="#fff" d="M0 0h900v600H0z" />
      <path fill="#006633" d="M0 0h450v600H0z" />
      <path fill="#D21034" d="M579.904 225A150 150 0 1 0 579.904 375 120 120 0 1 1 579.904 225M585.676 300 450 255.916 533.853 371.329v-142.658L450 344.084z" />
    </svg>
  );
}

export function FlagGB({ className = "" }) {
  return (
    <svg viewBox="0 0 60 40" className={className} aria-hidden="true" focusable="false">
      <path fill="#012169" d="M0 0h60v40H0z" />
      <path stroke="#fff" strokeWidth="8" d="M0 0l60 40M60 0L0 40" />
      <path stroke="#C8102E" strokeWidth="3" d="M0 0l60 40M60 0L0 40" />
      <path fill="#fff" d="M23 0h14v40H23zM0 13h60v14H0z" />
      <path fill="#C8102E" d="M26 0h8v40h-8zM0 16h60v8H0z" />
    </svg>
  );
}

export const FLAGS = { fr: FlagFR, ar: FlagDZ, en: FlagGB };
