// The One page's live thing: two screens on two HDMI cables. Both follow one rundown,
// so "Add a minute" reaches every screen at once, the way the real box does.
(function () {
  const rig = document.getElementById('hdmi');
  if (!rig) return;
  const one = rig.querySelector('.hdmi-one');
  const svg = rig.querySelector('svg.cables');
  const mons = { 1: rig.querySelector('.mon[data-out="1"]'), 2: rig.querySelector('.mon[data-out="2"]') };

  // The rundown, in show time. The keynote runs 9:40 to 10:10; we join it at 10:07:40.
  const RUN = [['9:00', 'Doors'], ['9:30', 'Welcome'], ['9:40', 'Opening keynote'], ['10:10', 'Panel: the room at scale'], ['10:55', 'Coffee break'], ['11:15', 'Breakouts']];
  const CUR = 2, START = 9 * 3600 + 40 * 60, DUR = 30 * 60;
  const T0 = 10 * 3600 + 7 * 60 + 40;
  let clock = T0, end = START + DUR;
  const WARN = 120, DANGER = 60, LOOP = -20;   // this event's warning and danger times, and when the demo starts over

  const NAMES = { stage: 'Stage timer', studio: 'Studio clock', back: 'Backstage', lobby: 'Lobby', bars: 'Test card', web: 'Any web page' };
  const view = { 1: 'stage', 2: 'back' };

  const pad = n => String(n).padStart(2, '0');
  const hm = s => { s = ((s % 86400) + 86400) % 86400; const h = Math.floor(s / 3600) % 12 || 12; return h + ':' + pad(Math.floor(s / 60) % 60); };
  const mmss = s => (s < 0 ? '-' : '') + Math.floor(Math.abs(s) / 60) + ':' + pad(Math.abs(s) % 60);

  function html(v) {
    if (v === 'stage') return '<div class="v v-stage"><p class="ttl">' + RUN[CUR][1] + '</p><p class="big" data-t="remain"></p><p class="msg" data-t="msg"></p><div class="bar"><i data-t="bar"></i></div></div>';
    if (v === 'studio') {
      let dots = '';
      for (let i = 0; i < 60; i++) dots += '<span' + (i % 5 ? '' : ' class="h"') + ' style="transform:rotate(' + (i * 6) + 'deg) translateY(-23cqw)"></span>';
      return '<div class="v v-studio"><p class="day">Ballroom A</p><p class="air">ON AIR</p><div class="ring">' + dots + '</div><p class="hm" data-t="hm"></p><p class="ss" data-t="ss"></p></div>';
    }
    if (v === 'back') {
      const rows = RUN.map((r, i) => '<li class="' + (i < CUR ? 'past' : i === CUR ? 'cur' : '') + '"><span>' + r[0] + '</span>' + r[1] + '</li>').join('');
      return '<div class="v v-back"><header><b>Backstage</b><span data-t="hm"></span></header><div><div class="now"><small>Now</small><p>' + RUN[CUR][1] + '</p><p class="tm" data-t="remain"></p></div><div class="next"><small>Next, at <span data-t="end"></span></small><p>' + RUN[CUR + 1][1] + '</p></div></div><ol>' + rows + '</ol></div>';
    }
    if (v === 'lobby') {
      const rows = RUN.slice(2).map((r, i) => '<li><span>' + r[0] + '</span>' + r[1] + (i === 0 ? '<em>ON NOW</em>' : '') + '</li>').join('');
      return '<div class="v v-lobby"><h4>Today in Ballroom A</h4><p class="sub">Spring Summit, day one</p><p class="clk" data-t="hm"></p><ol>' + rows + '</ol></div>';
    }
    if (v === 'bars') {
      const top = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'];
      const mid = ['#0000c0', '#131313', '#c000c0', '#131313', '#00c0c0', '#131313', '#c0c0c0'];
      const low = ['#00214c', '#ffffff', '#32006a', '#131313', '#131313', '#090909', '#1d1d1d', '#131313'];
      const row = cs => '<div>' + cs.map(c => '<i style="background:' + c + '"></i>').join('') + '</div>';
      return '<div class="v v-bars">' + row(top) + row(mid) + row(low) + '<p class="lbl"><b>HDMI <span data-t="out"></span></b>1920 &times; 1080, 60 Hz</p></div>';
    }
    return '<div class="v v-web"><div class="chrome"><i></i><i></i><i></i><span>springsummit.example/welcome</span></div><div class="pg"><h4>Welcome to<br>Spring Summit.</h4><p>Coffee in the foyer until 9:30. Lunch at 12:30 in the Atrium.</p><div class="wcards"><div><b>WiFi</b>Summit-Guest</div><div><b>Hashtag</b>#SpringSummit</div><div><b>Help</b>Ask the desk</div></div></div></div>';
  }

  function show(out) {
    const scr = mons[out].querySelector('.scr');
    scr.querySelector('.view').innerHTML = html(view[out]);
    scr.setAttribute('aria-label', 'HDMI ' + out + ' showing ' + NAMES[view[out]]);
    mons[out].querySelector('.tag span').textContent = NAMES[view[out]];
    const o = scr.querySelector('[data-t="out"]'); if (o) o.textContent = out;
    document.querySelectorAll('.out-ctl[data-out="' + out + '"] .chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view[out])));
    tick(true);
  }

  function tick(still) {
    if (!still) {
      clock++;
      if (end - clock < LOOP) { clock = T0; end = START + DUR; }
    }
    const left = end - clock;
    const state = left < 0 ? 'over' : left <= DANGER ? 'danger' : left <= WARN ? 'warn' : '';
    rig.querySelectorAll('[data-t]').forEach(el => {
      const t = el.dataset.t;
      if (t === 'remain') el.textContent = mmss(left);
      else if (t === 'msg') el.textContent = left < 0 ? 'TIME' : left <= DANGER ? 'WRAP UP' : '';
      else if (t === 'bar') el.style.width = Math.min(100, Math.max(0, (clock - START) / (end - START) * 100)) + '%';
      else if (t === 'hm') el.textContent = hm(clock);
      else if (t === 'ss') el.textContent = pad(clock % 60);
      else if (t === 'end') el.textContent = hm(end);
    });
    rig.querySelectorAll('.v-stage').forEach(el => el.className = 'v v-stage ' + state);
    rig.querySelectorAll('.v-back .tm').forEach(el => el.className = 'tm ' + (state === 'over' ? 'danger' : state));
    rig.querySelectorAll('.v-studio .ring').forEach(r => {
      const s = clock % 60;
      r.querySelectorAll('span').forEach((d, i) => d.classList.toggle('on', i <= s));
    });
  }

  // The cables: out of each HDMI jack on the One's back, down under the box, across, and up to its screen.
  const PORT = { 2: [0.211, 0.435], 1: [0.279, 0.435] };
  function cables() {
    const R = rig.getBoundingClientRect(), B = one.getBoundingClientRect();
    if (!B.width) return;
    const W = R.width, w = Math.max(4, W * 0.007), r = W * 0.03;
    let out = '';
    [2, 1].forEach((n, k) => {
      const px = B.left - R.left + B.width * PORT[n][0], py = B.top - R.top + B.height * PORT[n][1];
      const f = mons[n].querySelector('.foot').getBoundingClientRect();
      const sx = f.left - R.left + f.width / 2, sy = f.bottom - R.top;
      const ly = B.top - R.top + B.height * 0.86 + W * (k ? 0.05 : 0.028);   // each cable runs at its own height
      const dir = sx < px ? -1 : 1;
      const ph = B.height * 0.2, pw = B.width * 0.034;
      const d = 'M' + px + ' ' + (py + ph / 2) + ' L' + px + ' ' + (ly - r) + ' Q' + px + ' ' + ly + ' ' + (px + dir * r) + ' ' + ly +
        ' L' + (sx - dir * r) + ' ' + ly + ' Q' + sx + ' ' + ly + ' ' + sx + ' ' + (ly - r) + ' L' + sx + ' ' + sy;
      out += '<path class="wire" d="' + d + '" stroke-width="' + w + '"/>' +
        '<path class="shine" d="' + d + '" stroke-width="' + (w * 0.22) + '" transform="translate(' + (-w * 0.2) + ' 0)"/>' +
        '<path class="sig" d="' + d + '" stroke-width="' + (w * 0.42) + '"/>' +
        '<rect class="plug" x="' + (px - pw / 2) + '" y="' + (py - ph / 2) + '" width="' + pw + '" height="' + ph + '" rx="' + (pw * 0.18) + '"/>' +
        '<rect class="plug" x="' + (px - pw * 0.32) + '" y="' + (py + ph / 2 - 1) + '" width="' + (pw * 0.64) + '" height="' + (ph * 0.28) + '" rx="' + (pw * 0.15) + '"/>';
    });
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + R.height);
    svg.innerHTML = out;
  }

  let sel = 1;
  function select(n) { sel = n; mons[1].classList.toggle('sel', n === 1); mons[2].classList.toggle('sel', n === 2); }
  [1, 2].forEach(n => {
    mons[n].addEventListener('click', () => select(n));
    show(n);
  });
  document.querySelectorAll('.out-ctl').forEach(g => {
    const n = +g.dataset.out;
    g.addEventListener('click', e => {
      const b = e.target.closest('.chip'); if (!b) return;
      view[n] = b.dataset.view; select(n); show(n);
    });
  });
  document.getElementById('add-min').addEventListener('click', () => { end += 60; tick(true); });
  const bo = document.getElementById('blackout');
  bo.addEventListener('click', () => {
    const on = !rig.classList.contains('black');
    rig.classList.toggle('black', on); bo.setAttribute('aria-pressed', String(on));
    bo.textContent = on ? 'Back from blackout' : 'Blackout';
  });

  cables();
  if (one.complete) cables(); else one.addEventListener('load', cables);
  if ('ResizeObserver' in window) new ResizeObserver(cables).observe(rig); else addEventListener('resize', cables);
  setInterval(() => tick(false), 1000);
})();
