// Live faces for the Downstage Cue and the Cue Lite, drawn the way the real
// screens look: the Lite shows its camera number inside a tally ring, the Cue
// runs a countdown inside a tally ring that empties as it counts. Colours come
// from html[data-tally] (see site.css), so the tally control repaints them all.
// Without script the plain device icons stay.
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  // The Lite is landscape, with the outside lip as a thin rim and no chin
  // (Rob, 2026-10-20; Cue repo docs/device-icons/README.md).
  const LITE = `
    <rect x="12" y="21" width="96" height="80" rx="20" fill="#141920" stroke="#313a44" stroke-width="1.4"/>
    <rect x="15" y="24" width="90" height="74" rx="17" fill="#1c2229" stroke="#262e37" stroke-width="1"/>
    <rect x="22" y="30" width="76" height="62" rx="8" fill="#050608"/>
    <rect class="ring" x="26" y="34" width="68" height="54" rx="6" fill="none" stroke-width="4"/>
    <text class="s-off cap soft" x="60" y="42" text-anchor="middle">CAMERA</text>
    <text class="num" x="60" y="56" text-anchor="middle" dominant-baseline="central">2</text>
    <g class="s-program"><rect class="chip" x="41" y="72.5" width="38" height="10" rx="3"/><text class="cap chipcap dark" x="60" y="79.6" text-anchor="middle">PROGRAM</text></g>
    <text class="s-preview cap chipcap tint" x="60" y="79.6" text-anchor="middle">PREVIEW</text>`;
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
