// The phone menu. The bar's links are hidden below 734px; this button opens
// them as a full-screen sheet. The sheet lives on <body>, not inside the bar:
// Safari pins a fixed panel to an ancestor with backdrop-filter (the bar's
// frosted glass), which trapped it inside the 48px bar on iPhone.
(function () {
  const btn = document.querySelector('.menu-btn');
  const links = document.querySelector('.nav nav');
  if (!btn || !links) return;
  const root = document.documentElement;
  const sheet = document.createElement('nav');
  sheet.className = 'menu-sheet';
  sheet.id = 'menu-sheet';
  sheet.setAttribute('aria-label', 'Menu');
  links.querySelectorAll('a').forEach(a => sheet.appendChild(a.cloneNode(true)));
  document.body.appendChild(sheet);
  btn.setAttribute('aria-controls', 'menu-sheet');
  function set(open) {
    root.classList.toggle('menu-open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Menu');
  }
  btn.addEventListener('click', e => { e.preventDefault(); set(!root.classList.contains('menu-open')); });
  sheet.querySelectorAll('a').forEach(a => a.addEventListener('click', () => set(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
  const wide = matchMedia('(min-width: 735px)');
  const onWide = e => { if (e.matches) set(false); };
  if (wide.addEventListener) wide.addEventListener('change', onWide); else if (wide.addListener) wide.addListener(onWide);
})();
