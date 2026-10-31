// Downstage demo shim - replaces the unit's REST API with an in-browser
// simulator so the real setup page runs with no hardware behind it.
(function () {
  // the previews are simulated iframes, never real MJPEG streams - kill the
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


  // ── the simulated show (1.7.0): a timer that runs, an aux timer, OnTime's
  // messages, an ATEM, and a Relay with five lights. The switcher's M/E 1 drives
  // the lights' tally, so a CUT on the Router tab shows on the Cue tab. Kept for
  // the tab's life, so Touch and Browser show the same show. ──
  const PRESETS = [
    { id: 'p0', label: 'Time Of Day', kind: 'clock', seconds: 0 },
    { id: 'p1', label: 'Doors open', kind: 'countdown', seconds: 1800 },
    { id: 'p2', label: 'Keynote: Welcome', kind: 'countdown', seconds: 600 },
    { id: 'p3', label: 'Panel: The year ahead', kind: 'countdown', seconds: 2700 },
    { id: 'p4', label: 'Break', kind: 'countdown', seconds: 900 },
  ];
  const light = (id, n, name, model, level, battery) => ({ id, n, name, model, carrier: RELAY.serial, online: true, level, battery,
    charging: false, fw: '0.186.3', brightSetting: 80, tallyWord: false, lock: model === 'cue' ? 'off' : undefined,
    follow: null, mirrors: 0, talent: false, state: { brightness: 100, talent: false } });
  const RELAY = { serial: 'DSRLY-0000A1', name: 'Stage Relay', ip: '192.168.1.50' };
  const D = {
    T: { loaded: 'p2', playback: 'play', endsAt: Date.now() + 517000, left: 517000, total: 600000, added: 0 },
    A: { current: 300000, duration: 300000, direction: 'count-down', running: false, playback: 'stop', endsAt: 0 },
    auxShown: 0,
    M: { text: '', visible: false, blink: false, secondary: '', secondary_source: null,
         saved: ['5 minutes', 'Wrap up', "Time's up", 'Speak up', 'Mic check', 'Stand by'] },
    words: [['STANDBY', 'amber'], ['5 MIN', 'amber'], ['1 MIN', 'amber'], ['WRAP UP', 'red'], ['STOP', 'red'],
            ['THANK YOU', 'green'], ['SLOW DOWN', 'white'], ['LOUDER', 'white'], ['LOOK AT CAM 2', 'white'], ['Q AND A NEXT', 'white']],
    touchSrc: ['cleantimer', '/studio', '/info', 'pattern-card', 'aux1', '/timer'],
    R: { mes: [{ n: 1, program: 1, preview: 2, transition: false }, { n: 2, program: 5, preview: 6, transition: false }],
         auxes: [{ n: 1, name: 'IMAG Left', source: 1 }, { n: 2, name: 'IMAG Right', source: 1 },
                 { n: 3, name: 'Confidence', source: 3010 }, { n: 4, name: 'Record', source: 10010 }] },
    cues: [light('DSCUE-0000C1', 1, 'Stage Left', 'cue', -52, 86), light('DSCUE-0000C2', 2, 'Stage Right', 'lite', -58, 72),
           light('DSCUE-0000C3', 3, 'Jib', '360', -61, null), light('DSCUE-0000C4', 4, 'Handheld', 'lite', -66, 64),
           light('DSCUE-0000C5', 5, 'Confidence', 'mini', -57, null)],
    offers: [{ id: 'DSCUE-0000C6', name: 'Cue Mini 00C6', model: 'mini', kind: 'asks', rssi: -63 }],
    alert: false, check: null, hdmiCt: null,
  };
  try {
    const kept = JSON.parse(sessionStorage.getItem('ds_demo') || 'null');
    if (kept) { Object.assign(D, kept.D); Object.assign(S, kept.S); }
  } catch (e) {}
  const keep = () => { if (S.__reset) return; try { sessionStorage.setItem('ds_demo', JSON.stringify({ D, S })); } catch (e) {} };
  setInterval(keep, 1000);
  window.addEventListener('pagehide', keep);

  // ── timer ──
  const preset = id => PRESETS.find(p => p.id === id);
  const onClockNow = () => (preset(D.T.loaded) || {}).kind === 'clock';
  function tLeft() { const t = D.T; return t.playback === 'play' ? t.endsAt - Date.now() : t.left; }
  function timerState() {
    const t = D.T, p = preset(t.loaded), left = tLeft(), run = t.playback === 'play', clock = onClockNow();
    const phase = !p ? 'stopped' : t.playback === 'pause' ? 'paused' : !run ? 'stopped' : left < 0 ? 'over' : left <= 30000 ? 'danger' : left <= 120000 ? 'warning' : 'running';
    const dn = new Date();
    return { phase, playback: t.playback, title: p ? p.label : '', left_ms: clock ? 0 : left, total_ms: clock ? 0 : t.total,
             added_ms: t.added, now: Date.now(), no_timer: false, loaded: t.loaded,
             ontime: { clock: (dn.getHours() * 3600 + dn.getMinutes() * 60 + dn.getSeconds()) * 1000 } };
  }
  function loadPreset(id, go) {
    const p = preset(id); if (!p) return;
    Object.assign(D.T, { loaded: id, playback: go ? 'play' : 'armed', left: p.seconds * 1000, total: p.seconds * 1000, added: 0,
                         endsAt: Date.now() + p.seconds * 1000 });
  }
  function step(dir) {
    const i = PRESETS.findIndex(p => p.id === D.T.loaded), n = PRESETS[i + dir];
    if (n) loadPreset(n.id, false);
  }
  function timerRoute(b) {
    if (!b || !b.action) {
      const i = PRESETS.findIndex(p => p.id === D.T.loaded);
      return { ok: true, state: timerState(), output: output(),
               presets: PRESETS.map((p, k) => Object.assign({ colour: '#A790F5', cue: String(k + 1), loaded: k === i, next: k === i + 1 }, p)) };
    }
    const t = D.T, secs = +b.seconds || 0;
    if (b.action === 'start') { if (!onClockNow()) { t.endsAt = Date.now() + t.left; t.playback = 'play'; } }
    else if (b.action === 'pause') { if (t.playback === 'play') { t.left = t.endsAt - Date.now(); t.playback = 'pause'; } }
    else if (b.action === 'stop' || b.action === 'reset') { const p = preset(t.loaded); t.left = t.total = (p ? p.seconds : 0) * 1000; t.added = 0; t.playback = 'armed'; }
    else if (b.action === 'add') { if (t.playback === 'play') t.endsAt += secs * 1000; else t.left += secs * 1000; t.total += secs * 1000; t.added += secs * 1000; }
    else if (b.action === 'set') {   // from the clock: a countdown first, as the One does
      if (onClockNow()) t.loaded = 'p2';
      Object.assign(t, { left: secs * 1000, total: secs * 1000, added: 0, playback: 'armed', endsAt: Date.now() + secs * 1000 });
    }
    else if (b.action === 'load') loadPreset(b.id, false);
    else if (b.action === 'next') step(1);
    else if (b.action === 'previous') step(-1);
    return { ok: true, state: timerState() };
  }
  // ── the aux timer ──
  function auxNow() {
    const a = D.A;
    const cur = !a.running ? a.current : a.direction === 'count-up' ? a.current + (Date.now() - a.endsAt) : a.current - (Date.now() - a.endsAt);
    return { n: 1, name: 'Aux timer 1', current: cur, duration: a.duration, direction: a.direction, running: a.running, playback: a.running ? 'play' : a.playback };
  }
  function auxFreeze() { const a = D.A; a.current = auxNow().current; a.endsAt = Date.now(); }
  function auxRoute(b) {
    if (!b || !b.action) return { ok: true, aux: [auxNow()], output: output(), control: false };
    const a = D.A; auxFreeze();
    if (b.action === 'start') { a.running = true; a.playback = 'play'; }
    else if (b.action === 'pause') { a.running = false; a.playback = 'pause'; }
    else if (b.action === 'stop') { a.running = false; a.playback = 'stop'; a.current = a.direction === 'count-up' ? 0 : a.duration; }
    else if (b.action === 'add') a.current += (+b.seconds || 0) * 1000;
    else if (b.action === 'set') { a.duration = a.current = (+b.seconds || 0) * 1000; a.running = false; a.playback = 'stop'; }
    else if (b.action === 'direction') { a.direction = b.direction; a.current = b.direction === 'count-up' ? 0 : a.duration; }
    return { ok: true, aux: auxNow() };
  }
  function output() {
    return { aux_shown: D.auxShown, blackout: S.blackout, blackout_outputs: [1, 2].filter(n => S.blackout || S.blackoutOut[n]),
             secondary_source: D.M.secondary_source || (D.auxShown ? 'aux1' : null) };
  }
  // the fake screens read this from their parent, so a preview follows the show
  window.__demo = () => ({ left: tLeft(), total: D.T.total, title: (preset(D.T.loaded) || {}).label || '', clock: onClockNow(),
                           run: D.T.playback === 'play', added: D.T.added / 1000, black: !!S.blackout,
                           prev: (PRESETS[PRESETS.findIndex(p => p.id === D.T.loaded) - 1] || {}).label || '',
                           next: (PRESETS[PRESETS.findIndex(p => p.id === D.T.loaded) + 1] || {}).label || '',
                           aux: auxNow().current, msg: D.M.visible ? D.M.text : '', blink: D.M.blink,
                           secondary: D.M.secondary_source === 'secondary' ? D.M.secondary : '' });

  // ── the ATEM ──
  const SOURCES_R = [];
  for (let i = 1; i <= 8; i++) SOURCES_R.push({ id: i, long: 'Camera ' + i, short: 'CAM' + i, aux: true, me: null });
  SOURCES_R.push({ id: 1000, long: 'Color Bars', short: 'BARS', aux: true, me: null },
                 { id: 3010, long: 'Media Player 1', short: 'MP1', aux: true, me: null },
                 { id: 10010, long: 'M/E 1 Program', short: 'PGM1', aux: true, me: [2] },
                 { id: 10011, long: 'M/E 1 Preview', short: 'PVW1', aux: true, me: [] });
  function routerState() {
    return { ok: true, ip: '192.168.1.240', connected: true, product: 'ATEM Constellation', sources: SOURCES_R,
             mes: D.R.mes, auxes: D.R.auxes, program: D.R.mes.map(m => m.program), preview: D.R.mes.map(m => m.preview) };
  }
  function routerRoute(b) {
    if (b && b.action) {
      const m = D.R.mes.find(x => x.n === +b.me);
      if (m && b.action === 'cut') [m.program, m.preview] = [m.preview, m.program];
      if (m && b.action === 'auto') { m.transition = true; setTimeout(() => { [m.program, m.preview] = [m.preview, m.program]; m.transition = false; }, 1000); }
    } else if (b && b.aux) { const a = D.R.auxes.find(x => x.n === +b.aux); if (a) a.source = +b.source; }
    else if (b && b.me) { const m = D.R.mes.find(x => x.n === +b.me); if (m && b.bus) m[b.bus] = +b.source; }
    return routerState();
  }

  // ── the lights: tally from M/E 1 ──
  function tallyFor(c) {
    const me = D.R.mes[0], n = c.mirrors || c.n;
    return n === me.program ? 'program' : n === me.preview ? 'preview' : '';
  }
  function cuesNow() {
    return D.cues.map(c => Object.assign({}, c, { state: Object.assign({}, c.state, { tally: tallyFor(c) }) }));
  }
  const MODEL = { cue: 'Downstage Cue', lite: 'Cue Lite', 360: 'Cue 360', mini: 'Cue Mini' };
  function fleet() {
    const lights = D.cues.filter(c => c.carrier).map(c => {
      const t = tallyFor(c);
      return { product: 'Cue', serial: c.id, name: c.name, model: MODEL[c.model], ip: '', version: c.fw,
               showing: t === 'program' ? '#ff0000' : t === 'preview' ? '#00ff00' : '#000000', health_ok: true, health_why: '',
               cue: Object.assign({ camera: c.n, battery: c.battery, rssi: c.level, link: { relayed: true, no_ip: true, via: RELAY.serial, via_name: RELAY.name, show: 'own' } },
                                  c.model === 'mini' || c.model === '360' ? { grid: { cols: 8, rows: 8 } } : {}) };
    });
    const linked = lights.length;
    return { ok: true, ts: Date.now() / 1000 - 40, units: [
      { product: 'Relay', name: RELAY.name, ip: RELAY.ip, kind: 'Ethernet', serial: RELAY.serial, version: '0.186.3',
        showing: linked + ' of 12 linked', health_ok: true, health_why: '', upd: false,
        relay: { one: false, host: '192.168.1.20', port: 16622, live: true, mine: true, ch: 6, tune: 'locked', eth: 'Up', mbps: 100, static: false, heard: linked },
        cue: { link: { guests: lights.map(l => ({ id: l.serial, mirror: false })), max: 12, relay: true } } },
    ].concat(lights).concat([
      { product: 'One', name: 'Monitor World', ip: '192.168.1.22', kind: 'WiFi', serial: 'DS1-A-2607-0003', version: '1.6.4',
        showing: '1: Countdown · 2: —', health_ok: false, health_why: 'HDMI 2 no display', upd: true },
    ]) };
  }
  function relayApi(b) {
    const p = b.path, body = b.body || {};
    if (p === 'cues') return { ok: true, cues: cuesNow() };
    if (p === 'status') return { ok: true, live: true, one: true, compHost: '192.168.1.20', alert: D.alert };
    if (p === 'offers') return { ok: true, live: true, adopt: D.offers, switch: [], room: 12 - D.cues.length };
    if (p === 'job') return { ok: true, job: null };
    if (p === 'check' && b.method !== 'POST') return { ok: true, check: D.check };
    if (p === 'check') {
      D.check = { running: false, summary: 'All ' + D.cues.length + ' lights answered.', agoS: 2,
                  lights: D.cues.map(c => ({ id: c.id, name: c.name, state: c.level > -65 ? 'good' : 'weak', cue: c.n })) };
      return { ok: true, message: D.check.summary };
    }
    if (p === 'alert') { D.alert = !!body.on; return { ok: true }; }
    if (p === 'identify') return { ok: true, message: 'It is blinking.' };
    if (p === 'adopt') {
      for (const id of body.ids || []) {
        const o = D.offers.find(x => x.id === id); if (!o) continue;
        D.offers = D.offers.filter(x => x.id !== id);
        const c = light(id, D.cues.length + 1, 'Cue Mini ' + id.slice(-4), 'mini', o.rssi, null);
        D.cues.push(c);
      }
      return { ok: true, message: 'Adopted.' };
    }
    return { ok: true };
  }
  function relayLight(b) {
    const c = D.cues.find(x => x.id === b.id), set = b.set || {};
    if (!c) return { ok: false, error: 'That Relay does not link it' };
    for (const k in set) {
      if (k === 'release') { D.cues = D.cues.filter(x => x !== c); D.offers.push({ id: c.id, name: c.name, model: c.model, kind: 'asks', rssi: c.level }); }
      else if (k === 'mirror') c.mirrors = set.mirror || 0;
      else if (k === 'follow') c.follow = set.follow || null;
      else if (k === 'brightness') c.state.brightness = set.brightness;
      else if (k === 'talent') { c.talent = !!set.talent; c.state.talent = !!set.talent; }
      else if (!/^message/.test(k)) c[k] = set[k];
    }
    return { ok: true };
  }

  // ── Companion's buttons, drawn: the follow pickers and the + XL on the Deck ──
  const KEYS = ['CAM 1', 'CAM 2', 'CAM 3', 'CAM 4', 'CAM 5', 'CAM 6', 'CAM 7', 'CAM 8', 'CUT', 'AUTO', 'BLACK', 'BARS',
                'IMAG L', 'IMAG R', 'CONF', 'REC', 'START', 'PAUSE', '+1', '-1', 'NEXT', 'PREV', 'WALK IN', 'SHOW'];
  function keyPng(label, bg, ink) {
    const c = document.createElement('canvas'); c.width = c.height = 120;
    const g = c.getContext('2d');
    g.fillStyle = bg || '#181D23'; g.fillRect(0, 0, 120, 120);
    g.fillStyle = ink || '#EEF1F3'; g.font = '700 26px Rajdhani, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(label || '', 60, 60);
    return c.toDataURL('image/png');
  }
  const keyFor = i => { const me = D.R.mes[0], l = KEYS[i];
    return keyPng(l, i + 1 === me.program ? '#E5484D' : i + 1 === me.preview ? '#2FD97B' : '#181D23', i + 1 === me.preview ? '#0B0D10' : '#EEF1F3'); };
  function gridRoute(q) {
    const rows = +q.get('rows') || 4, cols = +q.get('cols') || 8, since = +q.get('since') || 0, page = +q.get('page') || 1;
    if (since) return { ok: true, full: false, rev: since, buttons: [] };
    const buttons = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = (r * cols + c + (page - 1) * 8);
      if (i < KEYS.length) buttons.push({ row: r, col: c, fmt: 'png', img: keyFor(i).split(',')[1] });
    }
    return { ok: true, full: true, rev: 1, buttons };
  }
  // the + XL joins Companion over its Satellite socket: stand in for that socket
  const RealWS = window.WebSocket;
  window.WebSocket = function (url, p) {
    if (!/:16623/.test(url)) return new RealWS(url, p);
    const ws = { readyState: 1, close() { ws.readyState = 3; clearInterval(tick); if (ws.onclose) ws.onclose({}); },
      send(line) {
        const m = /KEY-PRESS .*KEY=(\d+) PRESSED=1/.exec(line); if (!m) return;
        const k = +m[1], me = D.R.mes[0];
        if (k < 8) me.preview = k + 1;
        if (k === 8) [me.program, me.preview] = [me.preview, me.program];
        paint();
      } };
    const say = l => ws.onmessage && ws.onmessage({ data: l });
    const paint = () => { for (let k = 0; k < 36; k++) say('KEY-STATE KEY=' + k + ' BITMAP="' + keyFor(k) + '"');
      for (let k = 36; k < 45; k++) say('KEY-STATE KEY=' + k + ' BITMAP="' + keyPng(k % 2 ? 'GAIN' : 'WIPE', '#12161B', '#9AA4AD') + '"'); };
    const tick = setInterval(paint, 2500);
    setTimeout(() => { if (ws.onopen) ws.onopen({}); say('ADD-DEVICE OK DEVICEID="demo"'); paint(); }, 200);
    return ws;
  };

  function uptime() {
    const s = Math.floor((Date.now() - S.boot) / 1000) + 9000;
    return `${Math.floor(s / 3600)}h ${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}m ${String(s % 60).padStart(2, '0')}s`;
  }
  const jig = (base, amp) => Math.round((base + Math.sin(Date.now() / 9000) * amp) * 10) / 10;

  function status() {
    return {
      clock: { epoch: Date.now() / 1000, offset_min: -new Date().getTimezoneOffset() },
      portal: { detected: false, internet: true },
      ip: S.mode === 'local' ? '127.0.0.1' : S.ip, mode: S.mode,
      hdmi1_source: S.hdmi1_source, hdmi2_source: S.hdmi2_source,
      hdmi1_res: S.hdmi1_res, hdmi2_res: S.hdmi2_res,
      hdmi1_rotate: S.hdmi1_rotate, hdmi2_rotate: S.hdmi2_rotate,
      hdmi1_external_url: S.hdmi1_external_url, hdmi2_external_url: S.hdmi2_external_url,
      connected: S.ontime_running && (S.mode === 'local' || !!S.ip),
      os_version: '1.7.0', serial: 'DS1-A-2607-0000',
      local_ip: '192.168.1.20', net_iface: 'eth0', displays: 2,
      ontime_installed: true, ontime_running: S.ontime_running,
      companion_installed: true, companion_running: true,
      companion_emulator_id: 'demo',
      blackout: S.blackout || S.blackoutOut[1] || S.blackoutOut[2],
      blackout_outputs: [1, 2].filter(n => S.blackout || S.blackoutOut[n]),
      testcard_outputs: [1, 2].filter(n => S.testcard[n]),
      watchdog: S.watchdog,
      hotspot_active: S.hotspot, hotspot_ssid: 'Downstage-0000',
      cpu_temp: jig(51, 3) + '°C', cpu_percent: jig(7, 5),
      gpu_clock_mhz: 500, ram_used: Math.round(jig(1450, 60)), ram_total: 4045,
      uptime: uptime(), undervolt_now: false, undervolt_boot: false,
      hdmi_connected: { 1: true, 2: false },
      hdmi_names: { 1: 'SAMSUNG Q60B', 2: '' },
      wifi: { up: false, drops_10m: 0, concern: null },
      primary_kind: 'Ethernet', primary_ip: '192.168.1.20',
      name: S.unitName || 'Main Stage', now_showing: '1: Stage Timer \u00b7 2: —',
      virtual_previews: S.virtPrev !== false,
      audio_cues: S.audioCues || 'off',
      line_tone: !!S.lineTone,
      watchdog_fallback: S.wdFallback || 'holding',
      companion_remote: null,
      satellite: { installed: true, running: false, enabled: false, ip: '',
                   install_state: 'idle', version: '2.1.0' },
      cue_marks: S.cueMarks || [600000, 300000, 120000, 60000, 30000, 10000, 0],
      health: { ok: true, why: '' },
      os_update_available: false,
      interfaces: [{ kind: 'Ethernet', ip: '192.168.1.20', iface: 'eth0' }],
    };
  }

  const SRC_LABELS = { cleantimer: 'Custom Timer', '/timer': 'Stage Timer', '/countdown': 'Countdown', '/backstage': 'Backstage / Crew',
    '/studio': 'Studio Clock', '/timeline': 'Timeline', '/info': 'Public Info', aux1: 'Aux Timer 1', '/op': 'Operator', '/cuesheet': 'Cue Sheet',
    '/rundown': 'Rundown', 'pattern-card': 'Test Card', 'pattern-bars': 'SMPTE Bars', 'pattern-grid': 'Grid', 'pattern-ramp': 'Gray Ramp',
    welcome: 'Unit Info', off: 'Off' };
  const SILLY = [
    'Disabled in demo mode - this button is wired to hardware you have not bought yet.',
    'On a real unit, that does the thing. In the demo, it does this message.',
    'Demo unit says no. Politely, but no.',
    'That control moves actual electrons. The demo has none to spare.',
    'Nice try. The demo unit is imaginary and cannot be shut down.',
    'This works great at 192.168.your.venue - less so in a browser tab.',
    'Settings like this one ship with the real thing. Doors.',
    'Disabled in demo mode. Unlike show bacon, which is always enabled.',
    'This button is off duty. Kind of like the one guy who forgot to hit record.',
  ];
  const quip = () => SILLY[Math.floor(Math.random() * SILLY.length)];
  const no = () => { const m = quip(); return { ok: false, message: m, error: m }; };

  const routes = {
    '/status': () => status(),
    '/api/v1/one/timer': (b) => timerRoute(b),
    '/api/v1/one/aux': (b) => auxRoute(b),
    '/api/v1/one/output': (b) => {
      if (b.aux !== undefined) D.auxShown = b.aux ? 1 : 0;
      if (b.blackout !== undefined) { S.blackout = !!b.blackout; if (!b.blackout) S.blackoutOut[1] = S.blackoutOut[2] = false; syncScreens(); }
      return { ok: true, output: output() };
    },
    '/api/v1/one/message': (b) => {
      if (b.saved) D.M.saved = b.saved;
      for (const k of ['text', 'visible', 'blink', 'secondary']) if (b[k] !== undefined) D.M[k] = b[k];
      if (b.secondary_shown !== undefined) D.M.secondary_source = b.secondary_shown ? 'secondary' : null;
      return Object.assign({ ok: true }, D.M);
    },
    '/api/v1/one/talk-words': (b) => { if (b.words) D.words = b.words; return { ok: true, words: D.words }; },
    '/api/v1/one/touch-sources': (b) => {
      if (b.reset) D.touchSrc = ['cleantimer', '/studio', '/info', 'pattern-card', 'aux1', '/timer'];
      if (b.add && !D.touchSrc.includes(b.add)) D.touchSrc.push(b.add);
      if (b.remove) D.touchSrc = D.touchSrc.filter(k => k !== b.remove);
      return { ok: true, sources: D.touchSrc.map(k => ({ key: k, label: SRC_LABELS[k] || k })),
               all: Object.entries(SRC_LABELS).map(([key, label]) => ({ key, label })) };
    },
    '/api/v1/one/router': (b) => routerRoute(b),
    '/api/v1/one/router/atem': (b) => (b.ip !== undefined ? routerState()
      : { ok: true, found: [{ ip: '192.168.1.240', name: 'ATEM Constellation', from: 'Companion' }] }),
    '/displays/source': (b) => { S['hdmi' + b.output + '_source'] = b.source; S.testcard[b.output] = false; syncScreens(); return { ok: true }; },
    '/displays/custom-timer': (b) => {
      if (b.output) for (const k in b) if (k !== 'output') S.ct[b.output][k] = b[k];
      syncScreens();
      return { ok: true, outputs: S.ct };
    },
    '/fleet/relay/api': (b) => relayApi(b),
    '/fleet/relay/light': (b) => relayLight(b),
    '/fleet/cue/timer-source': (b) => { if (b.mode) D.tsrc = b.mode; return { ok: true, source: D.tsrc || 'auto' }; },
    '/fleet/cue/camop': (b) => { if (b.on !== undefined) D.camop = !!b.on; return { ok: true, on: !!D.camop }; },
    '/companion/pages': () => ({ ok: true, pages: [{ page: 1, name: 'Show' }, { page: 2, name: 'Rig' }, { page: 3, name: 'Timer' }] }),
    '/rig/state': () => ({ ok: true, secured: false }),
    '/rig/unlock': () => ({ ok: true }),
    '/discover/refresh': () => fleet(),
    '/system/patches/status': () => ({ ok: true, available: false }),
    '/discover/last': () => fleet(),
    '/discover': () => fleet(),
    '/fleet/identify': () => ({ ok: true }),
    '/unit-name': (b) => { S.unitName = (b && b.name) || ''; return { ok: true, name: S.unitName }; },
    '/virtual-previews': (b) => { S.virtPrev = !!(b && b.on); return { ok: true, on: S.virtPrev }; },
    '/audio-cues': (b) => {
      if (b && b.mode) S.audioCues = b.mode;
      if (b && b.marks) S.cueMarks = b.marks;
      return { ok: true };
    },
    '/audio-cues/test': () => ({ ok: true }),
    '/audio-cues/line-tone': (b) => { S.lineTone = !!(b && b.on); return { ok: true, on: S.lineTone }; },
    '/power/ack': () => ({ ok: true }),
    '/satellite/status': () => ({ installed: true, running: false, enabled: false, ip: '',
                                  install_state: 'idle', version: '2.1.0' }),
    '/satellite/install': () => ({ ok: true, state: 'installing' }),
    '/satellite/mode': () => ({ ok: false, error: 'Satellite is simulated in the demo' }),
    '/source/url/1': () => ({ ok: true, url: screenUrl(1) }),
    '/source/url/2': () => ({ ok: true, url: screenUrl(2) }),
    '/save': (b) => {
      Object.assign(S, {
        mode: b.mode, ip: b.ip || '',
        hdmi1_source: b.hdmi1_source, hdmi2_source: b.hdmi2_source,
        hdmi1_res: b.hdmi1_res, hdmi2_res: b.hdmi2_res,
        hdmi1_rotate: b.hdmi1_rotate, hdmi2_rotate: b.hdmi2_rotate,
        hdmi1_external_url: b.hdmi1_external_url || '', hdmi2_external_url: b.hdmi2_external_url || '',
        watchdog: !!b.watchdog,
        wdFallback: b.watchdog_fallback || 'holding',
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
      S.presets.push({ name: b.name, hdmi1_source: S.hdmi1_source, hdmi2_source: S.hdmi2_source,
                       hdmi1_external_url: S.hdmi1_external_url, hdmi2_external_url: S.hdmi2_external_url,
                       ct: JSON.parse(JSON.stringify(S.ct)) });
      return { ok: true, presets: S.presets };
    },
    '/presets/apply': (b) => {
      const p = S.presets.find(x => x.name === b.name);
      if (p) {
        S.hdmi1_source = p.hdmi1_source; S.hdmi2_source = p.hdmi2_source;
        if (p.ct) S.ct = JSON.parse(JSON.stringify(p.ct));
        if (p.hdmi1_external_url !== undefined) S.hdmi1_external_url = p.hdmi1_external_url;
        if (p.hdmi2_external_url !== undefined) S.hdmi2_external_url = p.hdmi2_external_url;
        S.blackout = false; syncScreens();
      }
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
    '/displays/power': () => no(),
    '/displays/power-status': () => ({ outputs: [{ index: 1, on: S.outputPower[1] }, { index: 2, on: S.outputPower[2] }] }),
    '/ontime/start': () => no(),
    '/ontime/stop': () => no(),
    '/ontime/install': () => no(),
    '/ontime/update': () => no(),
    '/update-status': () => ({
      ontime:    { installed: '4.15.1', latest: '4.15.1', update_available: false, checked: true },
      companion: { installed: '5.1.1', latest: '5.1.1', update_available: false, checked: true, channel: 'stable' },
      os:        { installed: '1.7.0', latest: '1.7.0', update_available: false, checked: true, last_result: null },
      patches:   { tested_through: '2026-07-13', last_applied: '2026-07-13', available: false, checked: true },
    }),
    '/jobs': () => ({ name: '', label: '', state: 'idle', started: 0, detail: '' }),
    '/updates/recheck': () => ({ ok: true }),
    '/companion/status': () => ({ installed: true, running: true, install_state: 'done' }),
    '/companion/restart': () => no(),
    '/companion/update': () => no(),
    '/companion/rescan-usb': () => no(),
    '/companion/set-channel': () => no(),
    '/companion/install': () => no(),
    '/network/info': () => ({ ok: true, iface: 'eth0', method: 'auto', current_ip: '192.168.1.20', address: '' }),
    '/network/apply': () => no(),
    '/wifi/status': () => wifi(),
    '/wifi/scan': () => wifi(),
    '/wifi/connect': () => no(),
    '/hotspot/status': () => ({ active: S.hotspot, ssid: 'Downstage-0000', pass: 'demo-pass-01', auto: true }),
    '/hotspot/start': () => no(),
    '/hotspot/stop': () => no(),
    '/system/timezone': () => ({ timezone: S.tz || 'America/Denver' }),
    '/system/timezones': () => ({ timezones: ['UTC', 'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Australia/Sydney'] }),
    '/system/timezone/detect': () => no(),
    '/system/set-time': () => no(),
    '/logs': () => ({ log: '[demo] Downstage One demo unit\n[demo] All systems nominal\n[epaper] this is a simulated log view' }),
    '/system/restart': () => no(),
    '/system/shutdown': () => no(),
    '/system/factory-reset': () => no(),
    '/os/update': () => no(),
    '/os/update-file': () => no(),
    '/config/upload': () => no(),
    '/reset': () => no(),
  };
  routes['/system/timezone_post'] = () => no();

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
    const full = typeof url === 'string' ? url : url.url;
    const u = full.split('?')[0];
    let handler = routes[u];
    if (u === '/system/timezone' && opts && opts.method === 'POST') handler = routes['/system/timezone_post'];
    if (u === '/companion/grid') handler = () => gridRoute(new URLSearchParams(full.split('?')[1] || ''));
    if (/^\/source\/url\//.test(u)) handler = () => ({ ok: true, url: screenUrl(+u.split('/').pop()) });
    if (!handler && (u.startsWith('/') || /^https?:/.test(u))) handler = () => ({ ok: true });
    if (!handler) return realFetch(url, opts);
    let body = {};
    try { if (opts && opts.body && typeof opts.body === 'string') body = JSON.parse(opts.body); } catch (e) {}
    const data = handler(body);
    return new Promise(res => setTimeout(() =>
      res(new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })), 60));
  };

  // ── preview windows: swap MJPEG <img> for live simulated screens ──
  function screenUrl(n) {
    if (!S.outputPower[n]) return 'screen.html?src=off';
    if (S.blackout || S.blackoutOut[n]) return 'screen.html?src=blackout';
    if (S.testcard[n]) return 'screen.html?src=pattern-card';
    let src = S[`hdmi${n}_source`];
    const unconfigured = S.mode === 'remote' && !S.ip;
    const ontimeSrc = !['config', 'off', 'external', 'welcome'].includes(src) && !src.startsWith('pattern-');
    if (ontimeSrc && unconfigured) return 'screen.html?src=welcome';
    if (ontimeSrc && !S.ontime_running && S.mode === 'local') return 'screen.html?src=holding';
    if (/^aux/.test(src)) return 'screen.html?src=aux1';
    if (src === 'companion') return 'deck.html';
    if (src === 'external') return 'screen.html?src=external&url=' + encodeURIComponent(S[`hdmi${n}_external_url`] || '');
    if (src === 'cleantimer') {
      const c = S.ct[n];
      return `screen.html?src=cleantimer&key=${c.keycolour}&tc=${c.timercolour}&freeze=${c.freeze}&hp=${c.hideprogress}&hc=${c.hideclock}`;
    }
    return 'screen.html?src=' + encodeURIComponent(src);
  }
  window.__demoCustom = () => { const c = S.ct[1]; return `screen.html?src=cleantimer&key=${c.keycolour}&tc=${c.timercolour}&freeze=${c.freeze}&hp=${c.hideprogress}&hc=${c.hideclock}`; };
  let frames = {};
  function makeFrames() {
    for (const n of [1, 2]) {
      const img = document.getElementById(`preview-img-${n}`);
      if (!img) continue;
      const f = document.createElement('iframe');
      f.id = `demo-frame-${n}`;
      f.style.cssText = 'width:100%;height:100%;border:0;pointer-events:none;display:block;aspect-ratio:16/9;background:#000';
      const shield = document.createElement('div');
      shield.style.cssText = 'position:absolute;inset:0;z-index:1';
      f.insertAdjacentElement && setTimeout(() => { if (f.parentElement) { f.parentElement.style.position = 'relative'; f.parentElement.appendChild(shield); } }, 0);
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


  // ── no click guard now: every control runs, and what would need real
  // hardware answers with a quip from its route. Only a link or window that
  // would leave the demo for a unit is caught here. ──
  function toast(msg) {
    let t = document.getElementById('demo-toast');
    if (!t) {
      t = document.createElement('div'); t.id = 'demo-toast';
      t.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:10000;max-width:min(90vw,520px);padding:12px 18px;' +
        'background:#181D23;color:#EEF1F3;border:1px solid #232A32;border-radius:6px;font:500 14px system-ui;text-align:center';
      document.body.appendChild(t);
    }
    t.textContent = msg; t.hidden = false;
    clearTimeout(t._h); t._h = setTimeout(() => { t.hidden = true; }, 5000);
  }
  const leaves = h => /^\/(?!\/|static|demo)/.test(h) || /:(4001|8000|8080)\b/.test(h) || /\.local\b/.test(h) || /^https?:\/\/(192\.168|10\.|127\.)/.test(h);
  function linkGuard(e) {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.closest('#demo-ribbon')) return;
    if (leaves(a.getAttribute('href'))) { e.preventDefault(); e.stopImmediatePropagation(); toast(quip()); }
  }

  // ribbon: reset, exit (Touch and Browser have their own toggle). In the page's flow on Touch, whose
  // body is a full-height grid; fixed across the top on Browser.
  const isTouch = /touch\.html/.test(location.pathname);
  function ribbon() {
    const st = document.createElement('style');
    st.textContent =
      '#demo-ribbon{background:#2FD97B;color:#0B0D10;font:600 12px system-ui;padding:5px 14px;letter-spacing:0.05em;' +
      'display:flex;align-items:center;justify-content:center;gap:12px;-webkit-user-select:none;user-select:none}' +
      (isTouch ? 'body{grid-template-rows:auto auto auto auto minmax(0,1fr) !important}'
               : '#demo-ribbon{position:fixed;top:0;left:0;right:0;z-index:9999}' +
                 'body{padding-top:var(--demo-ribbon-h,34px)}.top{top:var(--demo-ribbon-h,34px) !important}') +
      '#demo-ribbon a{color:#0B0D10}' +
      '#demo-ribbon .dnote{font-weight:600}' +
      '@media(max-width:700px){#demo-ribbon .dnote{display:none}}';
    document.head.appendChild(st);
    const d = document.createElement('div');
    d.id = 'demo-ribbon';
    d.innerHTML = 'DEMO'
      + '<span class="dnote">A simulated show: run the timer, try the lights, nothing real can break.</span>'
      + '<a href="#" id="demo-reset" style="text-decoration:underline">reset</a>'
      + '<a href="/" style="text-decoration:underline">exit demo</a>';
    document.body.insertBefore(d, document.body.firstChild);
    document.getElementById('demo-reset').onclick = e => {
      e.preventDefault();
      window.removeEventListener('pagehide', keep);
      try { sessionStorage.removeItem('ds_demo'); } catch (x) {}
      S.__reset = true; location.reload();
    };
    if (!isTouch) {
      const setH = () => document.documentElement.style.setProperty('--demo-ribbon-h', d.offsetHeight + 'px');
      setH(); window.addEventListener('resize', setH);
    }
  }

  // Every Companion surface in the real UI points at the unit's :8000 or its
  // /virtual-deck route - neither exists on the static demo. Route them all
  // to the canned mockup: deck.html inline, virtual-deck.html for pop-outs.
  function deckRoutes() {
    const isEmu = u => typeof u === 'string' &&
      (u.includes(':8000/emulator') || u.includes(':8000/tablet') || u.includes('/virtual-deck'));
    const ontimeView = u => { const m = /:4001(\/[a-z]*)/.exec(String(u)); return m ? 'screen.html?src=' + encodeURIComponent(m[1]) : null; };
    const _open = window.open ? window.open.bind(window) : null;
    if (_open) window.open = (u, ...rest) => {
      if (isEmu(u) || /:8000\/?$/.test(String(u))) return _open('virtual-deck.html', ...rest);
      if (ontimeView(u)) return _open(ontimeView(u), ...rest);
      if (leaves(String(u))) { toast(quip()); return null; }
      return _open(u, ...rest);
    };
    if (typeof window.openPanel === 'function') {
      const _op = window.openPanel;
      window.openPanel = (u, ...rest) => _op(isEmu(u) ? 'deck.html' : (ontimeView(u) || u), ...rest);
    }
    if (typeof window.paintShowEmbed === 'function') {
      const _pse = window.paintShowEmbed;
      window.paintShowEmbed = function () {
        _pse.apply(this, arguments);
        const sef = document.getElementById('show-embed-frame');
        if (sef && isEmu(sef.dataset.url)) {
          sef.dataset.url = 'deck.html'; sef.src = 'deck.html';
        }
      };
    }
  }

  function arm() {
    makeFrames(); ribbon(); deckRoutes();
    document.addEventListener('click', linkGuard, true);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arm);
  } else { arm(); }
})();
