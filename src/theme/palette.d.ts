/** Types for the plain-JS palette that `tailwind.config.js` also consumes. */

export interface DomainPaletteEntry {
  print: string;
  hue: number;
  base: string;
  bright: string;
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
    text: string;
    textSecondary: string;
    textMuted: string;
    textFaint: string;
  };
  semantic: {
    win: string;
    loss: string;
    draw: string;
    provisional: string;
    warning: string;
    danger: string;
    info: string;
  };
  domains: Record<
    'Fury' | 'Calm' | 'Mind' | 'Body' | 'Chaos' | 'Order' | 'Colorless',
    DomainPaletteEntry
  >;
  domainUtilities: Record<string, string>;
  onDomainBase: string;
  scrim: string;
};

export default palette;
