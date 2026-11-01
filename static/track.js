// Counts clicks on links and buttons in Plausible, as a "Click" event with the
// button's words, its section and where it goes. Only ever reads the words on
// links and buttons, never anything typed into a field. Plausible's own script
// already counts downloads, outside links and form submissions, so those are skipped.
(function () {
  function section(el) {
    const s = el.closest('header, footer, section[id], article[id], div.app-panel[id]');
    if (!s) return 'page';
    return s.id || s.tagName.toLowerCase();
  }
  function words(el) {
    return (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60) || '(no text)';
  }
  document.addEventListener('click', function (e) {
    if (!window.plausible || !e.target.closest) return;
    const el = e.target.closest('a[href], button, [role="button"], summary');
    if (!el) return;
    let to = '';
    if (el.tagName === 'A') {
      const u = new URL(el.href, location.href);
      if (u.host !== location.host || /\.zip$/i.test(u.pathname)) return;
      to = u.pathname + u.hash;
    }
    if (el.matches('.app-pick')) {
      if (el.getAttribute('aria-expanded') !== 'true') plausible('App Opened', { props: { app: el.dataset.app } });
      return;
    }
    plausible('Click', { props: { label: words(el), section: section(el), to: to } });
  }, true);
})();
