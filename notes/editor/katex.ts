/* KaTeX for equations in notes, with mhchem so \ce{H2SO4} reads as chemistry.
   Loaded the first time a page has an equation; until it lands an equation
   shows its source in the mono face, which is never wrong, only plain. */

type Katex = typeof import('katex').default;

let katex: Katex | null = null;
let loading: Promise<Katex> | null = null;

export const loadKatex = (): Promise<Katex> => {
  if (katex) return Promise.resolve(katex);
  if (!loading) {
    loading = Promise.all([
      import('katex'),
      import('katex/dist/katex.min.css'),
    ]).then(async ([m]) => {
      await import('katex/contrib/mhchem');
      katex = m.default;
      return katex;
    });
  }
  return loading;
};

/** Render into `el`; returns false when the source does not parse. */
export const renderTex = (el: HTMLElement, latex: string, display: boolean): boolean => {
  const src = latex.trim();
  if (!src) {
    el.textContent = display ? 'Add an equation' : 'equation';
    el.classList.add('is-empty');
    return true;
  }
  el.classList.remove('is-empty');
  if (!katex) {
    el.textContent = src;
    el.classList.add('is-source');
    void loadKatex().then(() => renderTex(el, latex, display));
    return true;
  }
  el.classList.remove('is-source');
  try {
    katex.render(src, el, { displayMode: display, throwOnError: true, strict: 'ignore', trust: false, maxExpand: 500 });
    el.classList.remove('is-error');
    return true;
  } catch {
    el.textContent = src;
    el.classList.add('is-error');
    return false;
  }
};
