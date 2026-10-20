// Live faces for the Downstage Cue and the Cue Lite, drawn the way the real
// screens look: the Lite shows its camera number inside a tally ring, the Cue
// runs a countdown inside a tally ring that empties as it counts. Colours come
// from html[data-tally] (see site.css), so the tally control repaints them all.
// Without script the plain device icons stay.
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const LITE = `
    <rect x="26" y="14" width="68" height="92" rx="13" fill="#1c2229" stroke="#313a44" stroke-width="1.4"/>
    <rect x="31" y="19" width="58" height="72" rx="8" fill="#050608"/>
    <rect class="ring" x="35" y="23" width="50" height="64" rx="6" fill="none" stroke-width="4"/>
    <text class="s-off cap" x="60" y="34" text-anchor="middle">CAMERA</text>
    <text class="num" x="60" y="53" text-anchor="middle" dominant-baseline="central">2</text>
    <g class="s-program"><rect class="chip" x="40" y="69" width="40" height="11" rx="3"/><text class="cap dark" x="60" y="77.4" text-anchor="middle">PROGRAM</text></g>
    <text class="s-preview cap tint" x="60" y="77.4" text-anchor="middle">PREVIEW</text>
    <rect x="52" y="96" width="16" height="3" rx="1.5" fill="#2a323b"/>`;
  const CUE = `
    <circle cx="60" cy="60" r="52" fill="#1c2229" stroke="#313a44" stroke-width="1.4"/>
    <circle cx="60" cy="60" r="45" fill="#050608"/>
    <circle cx="60" cy="60" r="39" fill="none" stroke="#1a2027" stroke-width="5"/>
    <circle class="arc" cx="60" cy="60" r="39" fill="none" stroke-width="5" stroke-linecap="round" pathLength="100" transform="rotate(-90 60 60)"/>
    <text class="cap soft" x="60" y="40" text-anchor="middle">CAM 1</text>
    <text class="cd" x="60" y="61" text-anchor="middle" dominant-baseline="central">5:00</text>
    <text class="s-program cap tint" x="60" y="82" text-anchor="middle">PROGRAM</text>
    <text class="s-preview cap tint" x="60" y="82" text-anchor="middle">PREVIEW</text>
    <text class="s-off cap soft" x="60" y="82" text-anchor="middle">STANDBY</text>`;

  document.querySelectorAll('img[data-dev="lite"], img[data-dev="cue"]').forEach(img => {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 120 120');
    svg.setAttribute('class', 'face ' + (img.className || ''));
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', img.alt || (img.dataset.dev === 'cue' ? 'Downstage Cue' : 'Cue Lite'));
    if (!img.alt) svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = img.dataset.dev === 'cue' ? CUE : LITE;
    img.replaceWith(svg);
  });

  // One countdown for every Cue on the page: five minutes, round and round.
  const TOTAL = 300;
  let left = TOTAL;
  const cds = document.querySelectorAll('.face .cd');
  const arcs = document.querySelectorAll('.face .arc');
  function tick() {
    const m = Math.floor(left / 60), s = left % 60;
    const txt = m + ':' + String(s).padStart(2, '0');
    cds.forEach(t => { t.textContent = txt; });
    arcs.forEach(a => { a.setAttribute('stroke-dasharray', (left / TOTAL * 100).toFixed(2) + ' 100'); });
    left = left > 0 ? left - 1 : TOTAL;
  }
  if (cds.length) { left = 42 + 4 * 60; tick(); setInterval(tick, 1000); }
})();
