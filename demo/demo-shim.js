// Downstage demo shim — replaces the unit's REST API with an in-browser
// simulator so the real setup page runs with no hardware behind it.
(function () {
  // the previews are simulated iframes, never real MJPEG streams — kill the
  // "No signal" overlay hard so a failed /stream request can never paint it
  const _s = document.createElement('style');
  _s.textContent = '.preview-offline{display:none!important}';
  (document.head || document.documentElement).appendChild(_s);
  const S = {
    mode: 'local', ip: '',
    hdmi1_source: 'cleantimer', hdmi2_source: 'pattern-card',
    hdmi1_res: '1920x1080', hdmi2_res: '1920x1080',
    hdmi1_rotate: 'normal', hdmi2_rotate: 'normal',
    hdmi1_external_url: '', hdmi2_external_url: '',
    ct: {
      1: { freeze: true, hideprogress: true, hideclock: true, hidecards: true, keycolour: '000000', timercolour: 'ffffff' },
      2: { freeze: true, hideprogress: true, hideclock: true, hidecards: true, keycolour: '000000', timercolour: 'ffffff' },
    },
    watchdog: true, blackout: false, blackoutOut: { 1: false, 2: false },
    testcard: { 1: false, 2: false }, ontime_running: true,
    hotspot: false, outputPower: { 1: true, 2: true },
    presets: [
      { name: 'Show', hdmi1_source: 'cleantimer', hdmi2_source: '/timer' },
      { name: 'Doors', hdmi1_source: '/countdown', hdmi2_source: '/info' },
      { name: 'Line check', hdmi1_source: 'pattern-card', hdmi2_source: 'pattern-bars' },
    ],
    boot: Date.now(),
  };

  function uptime() {
    const s = Math.floor((Date.now() - S.boot) / 1000) + 9000;
    return `${Math.floor(s / 3600)}h ${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}m ${String(s % 60).padStart(2, '0')}s`;
  }
  const jig = (base, amp) => Math.round((base + Math.sin(Date.now() / 9000) * amp) * 10) / 10;

  function status() {
    return {
      ip: S.mode === 'local' ? '127.0.0.1' : S.ip, mode: S.mode,
      hdmi1_source: S.hdmi1_source, hdmi2_source: S.hdmi2_source,
      hdmi1_res: S.hdmi1_res, hdmi2_res: S.hdmi2_res,
      hdmi1_rotate: S.hdmi1_rotate, hdmi2_rotate: S.hdmi2_rotate,
      hdmi1_external_url: S.hdmi1_external_url, hdmi2_external_url: S.hdmi2_external_url,
      connected: S.ontime_running && (S.mode === 'local' || !!S.ip),
      os_version: '1.2.0', serial: 'Serial #',
      local_ip: '192.168.1.20', net_iface: 'eth0', displays: 2,
      ontime_installed: true, ontime_running: S.ontime_running,
      companion_installed: true, companion_running: true,
      blackout: S.blackout || S.blackoutOut[1] || S.blackoutOut[2],
      blackout_outputs: [1, 2].filter(n => S.blackout || S.blackoutOut[n]),
      testcard_outputs: [1, 2].filter(n => S.testcard[n]),
      watchdog: S.watchdog,
      hotspot_active: S.hotspot, hotspot_ssid: 'Downstage-0001',
      cpu_temp: jig(51, 3) + '°C', cpu_percent: jig(7, 5),
      gpu_clock_mhz: 500, ram_used: Math.round(jig(1450, 60)), ram_total: 4045,
      uptime: uptime(), undervolt_now: false, undervolt_boot: false,
    };
  }

  const routes = {
    '/status': () => status(),
    '/save': (b) => {
      Object.assign(S, {
        mode: b.mode, ip: b.ip || '',
        hdmi1_source: b.hdmi1_source, hdmi2_source: b.hdmi2_source,
        hdmi1_res: b.hdmi1_res, hdmi2_res: b.hdmi2_res,
        hdmi1_rotate: b.hdmi1_rotate, hdmi2_rotate: b.hdmi2_rotate,
        hdmi1_external_url: b.hdmi1_external_url || '', hdmi2_external_url: b.hdmi2_external_url || '',
        watchdog: !!b.watchdog,
      });
      for (const n of [1, 2]) for (const k of ['freeze', 'hideprogress', 'hideclock', 'hidecards', 'keycolour', 'timercolour']) {
        const v = b[`hdmi${n}_ct_${k}`];
        if (v !== undefined) S.ct[n][k] = v;
      }
      S.blackout = false;
      S.blackoutOut[1] = S.blackoutOut[2] = false;
      S.testcard[1] = S.testcard[2] = false;
      syncScreens();
      return { ok: true };
    },
    '/check': () => ({ ok: true }),
    '/presets': () => ({ presets: S.presets }),
    '/presets/save': (b) => {
      S.presets = S.presets.filter(p => p.name !== b.name);
      S.presets.push({ name: b.name, hdmi1_source: S.hdmi1_source, hdmi2_source: S.hdmi2_source });
      return { ok: true, presets: S.presets };
    },
    '/presets/apply': (b) => {
      const p = S.presets.find(x => x.name === b.name);
      if (p) { S.hdmi1_source = p.hdmi1_source; S.hdmi2_source = p.hdmi2_source; S.blackout = false; syncScreens(); }
      return { ok: !!p, hdmi1_source: S.hdmi1_source, hdmi2_source: S.hdmi2_source };
    },
    '/presets/delete': (b) => { S.presets = S.presets.filter(p => p.name !== b.name); return { ok: true, presets: S.presets }; },
    '/blackout': (b) => {
      if (b && (b.output === 1 || b.output === 2)) S.blackoutOut[b.output] = true;
      else S.blackout = true;
      syncScreens();
      return { ok: true, blackout: true, outputs: [1, 2].filter(n => S.blackout || S.blackoutOut[n]) };
    },
    '/blackout/clear': (b) => {
      if (b && (b.output === 1 || b.output === 2)) S.blackoutOut[b.output] = false;
      else { S.blackout = false; S.blackoutOut[1] = S.blackoutOut[2] = false; }
      syncScreens();
      const outs = [1, 2].filter(n => S.blackout || S.blackoutOut[n]);
      return { ok: true, blackout: outs.length > 0, outputs: outs };
    },
    '/displays/testcard': (b) => {
      const n = (b && (b.output === 1 || b.output === 2)) ? b.output : 1;
      S.testcard[n] = !(b && b.on === false);
      syncScreens();
      return { ok: true, output: n, testcard: S.testcard[n] };
    },
    '/displays/resync': () => { syncScreens(true); return { ok: true }; },
    '/displays/swap': () => {
      [S.hdmi1_source, S.hdmi2_source] = [S.hdmi2_source, S.hdmi1_source];
      [S.hdmi1_external_url, S.hdmi2_external_url] = [S.hdmi2_external_url, S.hdmi1_external_url];
      [S.ct[1], S.ct[2]] = [S.ct[2], S.ct[1]];
      S.testcard[1] = S.testcard[2] = false;
      syncScreens();
      return { ok: true, hdmi1_source: S.hdmi1_source, hdmi2_source: S.hdmi2_source };
    },
    '/refresh': () => { syncScreens(true); return { ok: true }; },
    '/displays/identify': () => { identify(); return { ok: true, displays: 2 }; },
    '/displays/power': () => ({ ok: false, message: 'Demo — this control is disabled', error: 'Demo — this control is disabled' }),
    '/displays/power-status': () => ({ outputs: [{ index: 1, on: S.outputPower[1] }, { index: 2, on: S.outputPower[2] }] }),
    '/ontime/start': () => ({ ok: false, message: 'Demo — this control is disabled', error: 'Demo — this control is disabled' }),
    '/ontime/stop': () => ({ ok: false, message: 'Demo — this control is disabled', error: 'Demo — this control is disabled' }),
    '/ontime/install': () => ({ ok: false, message: 'Demo — this control is disabled', error: 'Demo — this control is disabled' }),
    '/ontime/update': () => ({ ok: false, message: 'Demo — this control is disabled', error: 'Demo — this control is disabled' }),
    '/update-status': () => ({
      ontime:    { installed: '4.10.0', latest: '4.10.0', update_available: false, checked: true },
      companion: { installed: '4.3.4', latest: '4.3.4', update_available: false, checked: true, channel: 'stable' },
      os:        { installed: '1.2.0', latest: '1.2.0', update_available: false, checked: true, last_result: null },
    }),
    '/updates/recheck': () => ({ ok: true }),
    '/companion/status': () => ({ installed: true, running: true, install_state: 'done' }),
    '/companion/restart': () => ({ ok: false, message: 'Demo — this control is disabled', error: 'Demo — this control is disabled' }),
    '/companion/update': () => ({ ok: false, message: 'Demo — this control is disabled', error: 'Demo — this control is disabled' }),
    '/companion/rescan-usb': () => ({ ok: false, message: 'Demo — this control is disabled', error: 'Demo — this control is disabled' }),
    '/companion/set-channel': () => ({ ok: false, message: 'Demo — this control is disabled', error: 'Demo — this control is disabled' }),
    '/companion/install': () => ({ ok: false, message: 'Demo — this control is disabled', error: 'Demo — this control is disabled' }),
    '/network/info': () => ({ ok: true, iface: 'eth0', method: 'auto', current_ip: '192.168.1.20', address: '' }),
    '/network/apply': () => ({ ok: false, message: 'Demo — this control is disabled', error: 'Demo — this control is disabled' }),
    '/wifi/status': () => wifi(),
    '/wifi/scan': () => wifi(),
    '/wifi/connect': () => ({ ok: false, message: 'Demo — this control is disabled', error: 'Demo — this control is disabled' }),
    '/hotspot/status': () => ({ active: S.hotspot, ssid: 'Downstage-0001', pass: 'demo-pass-01', auto: true }),
    '/hotspot/start': () => ({ ok: false, message: 'Demo — this control is disabled', error: 'Demo — this control is disabled' }),
    '/hotspot/stop': () => ({ ok: false, message: 'Demo — this control is disabled', error: 'Demo — this control is disabled' }),
    '/system/timezone': () => ({ timezone: S.tz || 'America/Denver' }),
    '/system/timezones': () => ({ timezones: ['UTC', 'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Australia/Sydney'] }),
    '/system/timezone/detect': () => ({ ok: false, message: 'Demo — this control is disabled', error: 'Demo — this control is disabled' }),
    '/system/set-time': () => ({ ok: false, message: 'Demo — this control is disabled', error: 'Demo — this control is disabled' }),
    '/logs': () => ({ log: '[demo] Downstage One demo unit\n[demo] All systems nominal\n[epaper] this is a simulated log view' }),
    '/system/restart': () => ({ ok: false, message: 'Demo — this control is disabled', error: 'Demo — this control is disabled' }),
    '/system/shutdown': () => ({ ok: false, message: 'Demo — this control is disabled', error: 'Demo — this control is disabled' }),
    '/system/factory-reset': () => ({ ok: false, message: 'Demo — this control is disabled', error: 'Demo — this control is disabled' }),
    '/os/update': () => ({ ok: false, message: 'Demo — this control is disabled', error: 'Demo — this control is disabled' }),
    '/os/update-file': () => ({ ok: false, message: 'Demo — this control is disabled', error: 'Demo — this control is disabled' }),
    '/config/upload': () => ({ ok: false, message: 'Demo — this control is disabled', error: 'Demo — this control is disabled' }),
    '/reset': () => ({ ok: false, message: 'Demo — this control is disabled', error: 'Demo — this control is disabled' }),
  };
  routes['/system/timezone_post'] = () => ({ ok: false, message: 'Demo — this control is disabled', error: 'Demo — this control is disabled' });

  function wifi() {
    return {
      ok: true, hotspot: S.hotspot,
      current: S.wifiSsid || null,
      networks: [
        { ssid: 'VenueTech-5G', signal: 88, secured: true, active: false },
        { ssid: S.wifiSsid || 'FOH-Production', signal: 74, secured: true, active: !!S.wifiSsid },
        { ssid: 'GreenRoom Guest', signal: 51, secured: false, active: false },
      ],
    };
  }

  const realFetch = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    const u = (typeof url === 'string' ? url : url.url).split('?')[0];
    let handler = routes[u];
    if (u === '/system/timezone' && opts && opts.method === 'POST') handler = routes['/system/timezone_post'];
    if (u === '/logs') handler = routes['/logs'];
    if (!handler && u.startsWith('/')) handler = () => ({ ok: true });
    if (!handler) return realFetch(url, opts);
    let body = {};
    try { if (opts && opts.body && typeof opts.body === 'string') body = JSON.parse(opts.body); } catch (e) {}
    const data = handler(body);
    return new Promise(res => setTimeout(() =>
      res(new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })), 120));
  };

  // ── preview windows: swap MJPEG <img> for live simulated screens ──
  function screenUrl(n) {
    if (!S.outputPower[n]) return 'screen.html?src=off';
    if (S.blackout || S.blackoutOut[n]) return 'screen.html?src=blackout';
    if (S.testcard[n]) return 'screen.html?src=pattern-card';
    let src = S[`hdmi${n}_source`];
    const unconfigured = S.mode === 'remote' && !S.ip;
    const ontimeSrc = !['config', 'off', 'external'].includes(src) && !src.startsWith('pattern-');
    if (ontimeSrc && unconfigured) return 'screen.html?src=welcome';
    if (ontimeSrc && !S.ontime_running && S.mode === 'local') return 'screen.html?src=holding';
    if (src === 'external') return 'screen.html?src=external&url=' + encodeURIComponent(S[`hdmi${n}_external_url`] || '');
    if (src === 'cleantimer') {
      const c = S.ct[n];
      return `screen.html?src=cleantimer&key=${c.keycolour}&tc=${c.timercolour}&freeze=${c.freeze}&hp=${c.hideprogress}&hc=${c.hideclock}`;
    }
    return 'screen.html?src=' + encodeURIComponent(src);
  }
  let frames = {};
  function makeFrames() {
    for (const n of [1, 2]) {
      const img = document.getElementById(`preview-img-${n}`);
      if (!img) continue;
      const f = document.createElement('iframe');
      f.id = `demo-frame-${n}`;
      f.style.cssText = 'width:100%;height:100%;border:0;pointer-events:none;display:block;aspect-ratio:16/9;background:#000';
      img.replaceWith(f);
      const off = document.getElementById(`preview-off-${n}`);
      if (off) off.remove();
      frames[n] = f;
    }
    syncScreens(true);
  }
  function syncScreens(force) {
    for (const n of [1, 2]) {
      if (!frames[n]) continue;
      const u = screenUrl(n);
      if (force || frames[n].dataset.u !== u) { frames[n].src = u; frames[n].dataset.u = u; }
    }
  }
  function identify() {
    for (const n of [1, 2]) {
      if (!frames[n]) continue;
      frames[n].src = screenUrl(n) + (screenUrl(n).includes('?') ? '&' : '?') + 'identify=' + n;
      frames[n].dataset.u = '';
    }
    setTimeout(() => syncScreens(true), 4300);
  }


  // ── demo click guard: everything outside Display Sources gets a quip ──
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
    // cancel any pending re-assert from the previous quip — otherwise old
    // jokes resurface on top of the new one, a few at a time
    sillyTimers.forEach(clearTimeout);
    sillyTimers = [];
    const msg = SILLY[Math.floor(Math.random() * SILLY.length)];
    if (typeof window.showToast === 'function') {
      // the page hides info toasts after 3.5s; its timer is private, so
      // re-assert once — jokes get ~6.5 seconds to land
      window.showToast(msg, 'info');
      sillyTimers.push(setTimeout(() => window.showToast(msg, 'info'), 3000));
    } else console.log(msg);
  }
  function markAllowed() {
    document.querySelectorAll('.field').forEach(f => {
      const l = f.querySelector('.section-label');
      if (l && /display sources/i.test(l.textContent)) f.dataset.demoOk = '1';
    });
    document.querySelectorAll('.save-bar').forEach(b => { b.dataset.demoOk = '1'; });
    // Show/Full tabs and the preview right-click menu are demo-safe
    document.querySelectorAll('.view-toggle').forEach(b => { b.dataset.demoOk = '1'; });
    // the blackout banner's Resume button must work in the demo too
    document.querySelectorAll('.alert-bar').forEach(b => { b.dataset.demoOk = '1'; });
    const ctx = document.getElementById('ctx-menu');
    if (ctx) ctx.dataset.demoOk = '1';
    document.querySelectorAll('button').forEach(b => {
      if (b.textContent.trim() === 'Save & Apply') {
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

  // demo ribbon: product toggle + reset/exit, mobile-safe (full-width strip
  // on phones so it never overlaps the logo)
  function ribbon() {
    const st = document.createElement('style');
    st.textContent =
      '#demo-ribbon{position:fixed;top:0;left:0;right:0;z-index:9999;background:#2FD97B;color:#0B0D10;' +
      'font:600 12px system-ui;padding:5px 14px;letter-spacing:0.05em;' +
      'display:flex;align-items:center;justify-content:center;gap:12px}' +
      'body{padding-top:56px}' +
      '#demo-ribbon a{color:#0B0D10}' +
      '#demo-ribbon .seg{display:inline-flex;background:#0B0D10;border-radius:7px;padding:2px}' +
      '#demo-ribbon .seg a,#demo-ribbon .seg b{padding:2px 11px;border-radius:5px;text-decoration:none;font-weight:700}' +
      '#demo-ribbon .seg b{background:#fff;color:#0B0D10}' +
      '#demo-ribbon .seg a{color:#e8ecef}' +
      '#demo-ribbon .note{font-weight:600;opacity:0.85}' +
      '@media(max-width:600px){#demo-ribbon{padding:4px 8px 6px;' +
      'flex-wrap:wrap;row-gap:3px;column-gap:10px}' +
      '#demo-ribbon .note{flex-basis:100%;text-align:center;font-size:11px;order:-1;opacity:0.95}' +
      'body{padding-top:84px}}';
    document.head.appendChild(st);
    const d = document.createElement('div');
    d.id = 'demo-ribbon';
    d.innerHTML = 'DEMO'
      + '<span class="note">This is a simulated unit — click around, nothing real can break.</span>'
      + '<span class="seg"><b>One</b><a href="view/">View</a></span>'
      + '<a href="#" onclick="location.reload();return false" style="text-decoration:underline">reset</a>'
      + '<a href="/" style="text-decoration:underline">exit demo</a>';
    document.body.appendChild(d);
  }

  function arm() {
    makeFrames(); ribbon(); markAllowed();
    document.addEventListener('pointerdown', guard, true);
    document.addEventListener('click', guard, true);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arm);
  } else { arm(); }
})();
