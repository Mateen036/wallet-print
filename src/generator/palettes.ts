export interface Palette {
  name: string;
  bg: string;
  k: string;
  c: string;
  m: string;
  y: string;
  dark: boolean;
}

// 6 light (multiply blend) + 6 dark (screen blend)
// The artwork provides all color; the UI background is always near-black
export const PALETTES: Palette[] = [
  // --- Light backgrounds ---
  {
    name: 'CMYK-01',
    bg: '#FFFFFF',
    k: '#0D0D0D',
    c: '#00AEEF',
    m: '#EC008C',
    y: '#FFF100',
    dark: false,
  },
  {
    name: 'CMYK-02',
    bg: '#F5F0E8',
    k: '#1A0F06',
    c: '#1E4CB0',
    m: '#CC2233',
    y: '#C9980A',
    dark: false,
  },
  {
    name: 'CMYK-03',
    bg: '#FAFAFA',
    k: '#0D0D0D',
    c: '#333333',
    m: '#666666',
    y: '#999999',
    dark: false,
  },
  {
    name: 'CMYK-04',
    bg: '#EEF2FF',
    k: '#0A1230',
    c: '#1040CC',
    m: '#8800CC',
    y: '#BB9900',
    dark: false,
  },
  {
    name: 'CMYK-05',
    bg: '#FFF5F2',
    k: '#1A0500',
    c: '#BB3300',
    m: '#AA0033',
    y: '#CC7700',
    dark: false,
  },
  {
    name: 'CMYK-06',
    bg: '#F2F9EC',
    k: '#060F02',
    c: '#116622',
    m: '#55991A',
    y: '#CCEE00',
    dark: false,
  },
  // --- Dark backgrounds ---
  {
    name: 'CMYK-07',
    bg: '#080808',
    k: '#F2F2F2',
    c: '#00CCFF',
    m: '#FF2288',
    y: '#FFEE00',
    dark: true,
  },
  {
    name: 'CMYK-08',
    bg: '#04101C',
    k: '#C0DCFF',
    c: '#3399EE',
    m: '#1155CC',
    y: '#66AAFF',
    dark: true,
  },
  {
    name: 'CMYK-09',
    bg: '#110006',
    k: '#FFE0F4',
    c: '#FF66BB',
    m: '#EE0055',
    y: '#FF5500',
    dark: true,
  },
  {
    name: 'CMYK-10',
    bg: '#050E06',
    k: '#DFFFD8',
    c: '#33EE66',
    m: '#88EE22',
    y: '#EEFF44',
    dark: true,
  },
  {
    name: 'CMYK-11',
    bg: '#0E0900',
    k: '#FFFAD0',
    c: '#FFD044',
    m: '#FF9900',
    y: '#E8FF44',
    dark: true,
  },
  {
    name: 'CMYK-12',
    bg: '#000000',
    k: '#FFFFFF',
    c: '#AAAAAA',
    m: '#666666',
    y: '#333333',
    dark: true,
  },
  {
    name: 'NEON-13',
    bg: '#F2F0E6',
    k: '#17151F',
    c: '#00B8D9',
    m: '#FF3D81',
    y: '#B8F000',
    dark: false,
  },
  {
    name: 'EMBER-14',
    bg: '#FFF1DE',
    k: '#29120C',
    c: '#007C91',
    m: '#E43D30',
    y: '#FF9E1B',
    dark: false,
  },
  {
    name: 'SIGNAL-15',
    bg: '#10151B',
    k: '#F7F3E8',
    c: '#00D9FF',
    m: '#FF4FA3',
    y: '#D4FF3F',
    dark: true,
  },
  {
    name: 'VIOLET-16',
    bg: '#120D20',
    k: '#FFF4D6',
    c: '#2ED8FF',
    m: '#A66CFF',
    y: '#FFCA3A',
    dark: true,
  },
];

export function getPaletteColor(palette: Palette, plateId: 'K' | 'C' | 'M' | 'Y'): string {
  return { K: palette.k, C: palette.c, M: palette.m, Y: palette.y }[plateId];
}
