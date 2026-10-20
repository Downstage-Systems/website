// The phone menu: a button that opens the page links full screen, as the
// links themselves are hidden in the bar below 734px.
(function () {
  const btn = document.querySelector('.menu-btn');
  if (!btn) return;
  const root = document.documentElement;
  function set(open) {
    root.classList.toggle('menu-open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Menu');
  }
  btn.addEventListener('click', () => set(!root.classList.contains('menu-open')));
  document.querySelectorAll('.nav nav a').forEach(a => a.addEventListener('click', () => set(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
  matchMedia('(min-width: 735px)').addEventListener('change', e => { if (e.matches) set(false); });
})();
