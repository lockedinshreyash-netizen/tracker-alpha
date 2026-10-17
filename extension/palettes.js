/* ── New-tab themes ──
   Separate from Alpha's own look, and deliberately lighter: a student who
   finds the black-and-red page too serious can make it Sky, Mint or Peach.
   A theme changes exactly two things: the background and the accent (the
   ring, the button, focus, the ASCII field's dots and its ripple). The glass,
   the layout and the type stay the same; a theme only picks whether the light
   or the dark glass sits on its background.

   Loaded in <head>, before anything paints, and read from localStorage
   synchronously, so a new tab never flashes the default colours first. The
   design board passes ?palette=<id> instead, which is never saved. */

(() => {
  const PALETTES = [
    { id: 'alpha', name: 'Alpha', base: 'auto', bg: null, hi: '#ff6159', deep: '#d70015', rgb: '225 6 0', note: 'Follows your computer' },
    { id: 'paper', name: 'Paper', base: 'light', bg: '#f6f1e7', hi: '#f0834a', deep: '#d4622a', rgb: '232 116 59' },
    { id: 'sky', name: 'Sky', base: 'light', bg: '#eaf2fc', hi: '#4c8dff', deep: '#2563eb', rgb: '47 127 245' },
    { id: 'mint', name: 'Mint', base: 'light', bg: '#e9f6ef', hi: '#2bc48a', deep: '#0e9a68', rgb: '22 180 126' },
    { id: 'lilac', name: 'Lilac', base: 'light', bg: '#f2eefc', hi: '#9b7bff', deep: '#6d48ea', rgb: '138 99 255' },
    { id: 'peach', name: 'Peach', base: 'light', bg: '#fff0e8', hi: '#ff8a62', deep: '#ec5f35', rgb: '255 123 84' },
    { id: 'sunshine', name: 'Sunshine', base: 'light', bg: '#fbf6df', hi: '#f2b705', deep: '#c98f00', rgb: '224 168 0', ink: '#1d1d1f' },
    { id: 'bubblegum', name: 'Bubblegum', base: 'light', bg: '#fdeef5', hi: '#ff6fb1', deep: '#e0408c', rgb: '255 90 165' },
    { id: 'midnight', name: 'Midnight', base: 'dark', bg: '#0b1020', hi: '#8aa6ff', deep: '#4f6fe0', rgb: '124 156 255' },
    { id: 'forest', name: 'Forest', base: 'dark', bg: '#0b1512', hi: '#4ee0a1', deep: '#1fae72', rgb: '61 220 151' },
  ];
  const KEY = 'alpha_ext_palette';
  const root = document.documentElement;
  const params = new URLSearchParams(location.search);
  const fromUrl = params.get('palette');
  /* The board's ?theme= (Alpha light/dark) is honoured only for Alpha. */
  const forcedBase = params.get('theme');

  const byId = (id) => PALETTES.find(p => p.id === id) || PALETTES[0];

  const read = () => {
    if (fromUrl) return fromUrl;
    try { return localStorage.getItem(KEY) || 'alpha'; } catch { return 'alpha'; }
  };

  const apply = (id) => {
    const p = byId(id);
    const st = root.style;
    root.dataset.palette = p.id;
    if (p.base === 'auto') {
      if (forcedBase === 'light' || forcedBase === 'dark') root.dataset.theme = forcedBase;
      else delete root.dataset.theme;
    } else {
      root.dataset.theme = p.base;
    }
    if (p.bg) st.setProperty('--bg', p.bg); else st.removeProperty('--bg');
    st.setProperty('--accent-hi', p.hi);
    st.setProperty('--accent-deep', p.deep);
    st.setProperty('--accent-rgb', p.rgb);
    st.setProperty('--on-accent', p.ink || '#ffffff');
    /* Alpha keeps neutral dots with a red crest; every other theme tints the
       whole field with its accent. */
    if (p.id === 'alpha') st.removeProperty('--field-ink'); else st.setProperty('--field-ink', p.deep);
    return p;
  };

  const save = (id) => {
    if (fromUrl) return;
    try { localStorage.setItem(KEY, id); } catch { /* stays for this tab only */ }
  };

  apply(read());
  window.AlphaPalettes = { list: PALETTES, current: () => byId(read()), apply, save, byId };
})();
