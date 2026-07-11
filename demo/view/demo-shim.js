// Downstage View demo shim — replaces the display node's REST API with an
// in-browser simulator so the real setup page runs with no hardware behind it.
(function () {
  const S = {
    ip: '192.168.1.20', source: 'cleantimer', external_url: '',
    cleantimer_freeze: true, cleantimer_hideprogress: true,
    cleantimer_hideclock: true, cleantimer_hidecards: true,
    cleantimer_keycolour: '000000', cleantimer_timercolour: 'ffffff',
    watchdog: true, hotspot: false,
  };

  function status() {
    return {
      connected: true, ip: S.ip, local_ip: '192.168.1.31',
      serial: 'Serial #', source: S.source, external_url: S.external_url,
      watchdog: S.watchdog, watchdog_override: false,
      os_version: '1.2.1', os_latest: '1.2.1',
      os_update_available: false, os_checked: true, os_update_result: null,
    };
  }

  const NO = () => ({ ok: false, message: 'Demo — this control is disabled', error: 'Demo — this control is disabled' });

  const routes = {
    '/status': () => status(),
    '/save': (b) => { Object.assign(S, b || {}); return { ok: true }; },
    '/check': () => ({ ok: true }),
    '/refresh': () => ({ ok: true }),
    '/displays/identify': () => ({ ok: true, displays: 1 }),
    '/displays/power': NO,
    '/displays/power-status': () => ({ outputs: [{ index: 1, on: true }] }),
    '/wifi/status': () => wifi(),
    '/wifi/scan': () => wifi(),
    '/wifi/connect': NO,
    '/network/info': () => ({ ok: true, iface: 'wlan0', method: 'auto', current_ip: '192.168.1.31', address: '' }),
    '/network/apply': NO,
    '/hotspot/status': () => ({ active: false, ssid: 'DownstageView-0001', pass: 'demo-pass-01', auto: true }),
    '/system/timezone': () => ({ timezone: 'America/Denver' }),
    '/system/timezones': () => ({ timezones: ['UTC', 'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Australia/Sydney'] }),
    '/system/timezone/detect': NO,
    '/system/set-time': NO,
    '/system/restart': NO,
    '/system/shutdown': NO,
    '/system/factory-reset': NO,
    '/os/update': NO,
    '/os/update-file': NO,
    '/os/recheck': () => ({ ok: true }),
    '/reset': NO,
    '/logs': () => ({ log: '[demo] Downstage View demo unit\n[demo] All systems nominal\n[epaper] this is a simulated log view' }),
  };

  function wifi() {
    return {
      ok: true, hotspot: false, current: 'FOH-Production',
      networks: [
        { ssid: 'VenueTech-5G', signal: 88, secured: true, active: false },
        { ssid: 'FOH-Production', signal: 74, secured: true, active: true },
        { ssid: 'GreenRoom Guest', signal: 51, secured: false, active: false },
      ],
    };
  }

  const realFetch = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    const u = (typeof url === 'string' ? url : url.url).split('?')[0];
    let handler = routes[u];
    if (u === '/system/timezone' && opts && opts.method === 'POST') handler = NO;
    if (!handler && u.startsWith('/')) handler = () => ({ ok: true });
    if (!handler) return realFetch(url, opts);
    let body = {};
    try { if (opts && opts.body && typeof opts.body === 'string') body = JSON.parse(opts.body); } catch (e) {}
    const data = handler(body);
    return new Promise(res => setTimeout(() =>
      res(new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })), 120));
  };

  // ── demo click guard: everything outside Display Source gets a quip ──
  const SILLY = [
    'Disabled in demo mode — this button is wired to hardware you have not bought yet.',
    'On a real unit, that does the thing. In the demo, it does this message.',
    'Demo unit says no. Politely, but no.',
    'That control moves actual electrons. The demo has none to spare.',
    'Nice try. The demo unit is imaginary and cannot be shut down.',
    'This works great at 192.168.your.venue — less so in a browser tab.',
    'Settings like this one ship with the real thing. Doors.',
    'Disabled in demo mode. Unlike show bacon, which is always enabled.',
    'This button is off duty. Kind of like the one guy who forgot to hit record.',
  ];
  let lastToast = 0, sillyTimers = [];
  function silly() {
    const now = Date.now();
    if (now - lastToast < 700) return;
    lastToast = now;
    sillyTimers.forEach(clearTimeout);
    sillyTimers = [];
    const msg = SILLY[Math.floor(Math.random() * SILLY.length)];
    if (typeof window.showToast === 'function') {
      window.showToast(msg, 'info');
      sillyTimers.push(setTimeout(() => window.showToast(msg, 'info'), 3000));
    } else console.log(msg);
  }
  function markAllowed() {
    document.querySelectorAll('.field').forEach(f => {
      const l = f.querySelector('.section-label');
      if (l && /display source/i.test(l.textContent)) f.dataset.demoOk = '1';
    });
    document.querySelectorAll('.view-toggle').forEach(b => { b.dataset.demoOk = '1'; });
    document.querySelectorAll('button').forEach(b => {
      if (/save & apply/i.test(b.textContent.trim())) {
        b.dataset.demoOk = '1';
        if (b.parentElement) b.parentElement.dataset.demoOk = '1';
      }
    });
  }
  function guard(e) {
    const t = e.target;
    if (!(t.closest)) return;
    const interactive = t.closest('button, select, input, textarea, a, .toggle, .channel-btn');
    if (!interactive) return;
    if (t.closest('[data-demo-ok]') || t.closest('#demo-ribbon')) return;
    e.preventDefault();
    e.stopImmediatePropagation ? e.stopImmediatePropagation() : e.stopPropagation();
    if (e.type === 'click') silly();
  }

  // ── demo ribbon: product toggle + reset/exit, mobile-safe ──
  function ribbon() {
    const st = document.createElement('style');
    st.textContent =
      '#demo-ribbon{position:fixed;top:0;right:0;z-index:9999;background:#2FD97B;color:#0B0D10;' +
      'font:600 12px system-ui;padding:5px 14px;border-radius:0 0 0 10px;letter-spacing:0.05em;' +
      'display:flex;align-items:center;gap:12px}' +
      '#demo-ribbon a{color:#0B0D10}' +
      '#demo-ribbon .seg{display:inline-flex;background:#0B0D10;border-radius:7px;padding:2px}' +
      '#demo-ribbon .seg a,#demo-ribbon .seg b{padding:2px 11px;border-radius:5px;text-decoration:none;font-weight:700}' +
      '#demo-ribbon .seg b{background:#fff;color:#0B0D10}' +
      '#demo-ribbon .seg a{color:#e8ecef}' +
      '@media(max-width:600px){#demo-ribbon{left:0;right:0;border-radius:0;justify-content:center;padding:5px 8px}' +
      'body{padding-top:38px}}';
    document.head.appendChild(st);
    const d = document.createElement('div');
    d.id = 'demo-ribbon';
    d.innerHTML = 'DEMO'
      + '<span class="seg"><a href="../">One</a><b>View</b></span>'
      + '<a href="#" onclick="location.reload();return false" style="text-decoration:underline">reset</a>'
      + '<a href="/" style="text-decoration:underline">exit demo</a>';
    document.body.appendChild(d);
  }

  function arm() {
    ribbon(); markAllowed();
    document.addEventListener('pointerdown', guard, true);
    document.addEventListener('click', guard, true);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arm);
  } else { arm(); }
})();
