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

export const FLAGS = { fr: FlagFR, ar: FlagDZ };
