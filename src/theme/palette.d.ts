/** Types for the plain-JS palette that `tailwind.config.js` also consumes. */

export interface DomainPaletteEntry {
  base: string;
  /** Derived: base lifted toward white, for fills that must carry text. */
  bright: string;
  /** Derived: base sat down onto the shell, for chip and gradient fills. */
  dim: string;
}

declare const palette: {
  neutral: {
    bg: string;
    surface: string;
    raised: string;
    overlay: string;
    border: string;
    borderSubtle: string;
    /** A finding card — a surface read as an object, not a division. */
    borderStrong: string;
    /** Something you can press: the drawer toggle, an unselected chip. */
    borderControl: string;
    /** The rank numeral on a finding. Below `textHint` on purpose. */
    textGhost: string;
    text: string;
    textSecondary: string;
    textMuted: string;
    /** The label on an unselected segmented control. */
    textDim: string;
    textFaint: string;
    /** Helper copy under a field — the sentence explaining what it does. */
    textHint: string;
  };
  semantic: {
    win: string;
    loss: string;
    draw: string;
    /** Foregrounds for a count sitting inside a filled result segment. */
    onWin: string;
    onLoss: string;
    /** The accent as a state — a selected chip, an opened drawer. */
    accentSoft: string;
    accentBorder: string;
    accentBright: string;
    provisional: string;
    warning: string;
    danger: string;
    info: string;
  };
  /** The single coral accent: primary action, active tab, current selection. */
  accent: string;
  onAccent: string;
  domains: Record<
    'Fury' | 'Calm' | 'Mind' | 'Body' | 'Chaos' | 'Order' | 'Colorless',
    DomainPaletteEntry
  >;
  domainUtilities: Record<string, string>;
  onDomainBase: string;
  scrim: string;
};

export default palette;
