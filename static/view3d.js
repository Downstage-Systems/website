// "View in 3D": the Cue Lite and Cue 360 as real 3D models, turned by hand.
// The models come from the case designs (static/3d/*.glb). Google's <model-viewer>
// loads only when someone opens the viewer, so the page itself stays light.
(function () {
  const dlg = document.getElementById('v3d');
  if (!dlg) return;
  const mv = dlg.querySelector('model-viewer');
  const MV = 'https://unpkg.com/@google/model-viewer@3.5.0/dist/model-viewer.min.js';
  const DEV = {
    lite: { src: '/static/3d/cue-lite.glb?v=5', orbit: '-28deg 78deg auto', alt: 'A Cue Lite in 3D' },
    '360': { src: '/static/3d/cue-360.glb?v=4', orbit: '40deg 68deg auto', alt: 'A Cue 360 in 3D' },
    mini: { src: '/static/3d/cue-mini.glb?v=4', orbit: '-24deg 80deg auto', alt: 'A Cue Mini in 3D' }
  };
  // the 360's tower glow and the Lite's screen picture, per tally state
  const GLOW = { program: [1.0, 0.02, 0.015], preview: [0.01, 1.0, 0.09], off: [0, 0, 0] };
  const SCREEN = s => '/static/3d/lite-screen-' + s + '.png';
  let dev = 'lite', state = 'program', loaded = null;

  function press(group, attr, val) {
    dlg.querySelectorAll('[data-' + attr + ']').forEach(b => b.setAttribute('aria-pressed', String(b.dataset[attr] === val)));
  }
  async function paint() {
    dlg.dataset.glow = dev === 'lite' ? 'none' : state;
    if (!mv.model) return;
    const mats = mv.model.materials;
    if (dev === 'lite') {
      const m = mats.find(x => x.name === 'screen');
      if (m && m.emissiveTexture) m.emissiveTexture.setTexture(await mv.createTexture(SCREEN(state)));
    } else {
      // The glow is unlit, so it shows the button's colour at full strength: the 360's skin over its frosted tower
      // (faded out when off, leaving the real frosted white), and the Mini's LEDs (pale chips when off).
      const lit = state !== 'off';
      mats.forEach(m => {
        if (m.name === 'glow') m.pbrMetallicRoughness.setBaseColorFactor(GLOW[state].concat(lit ? 0.94 : 0));
        else if (m.name === 'leds') m.pbrMetallicRoughness.setBaseColorFactor(lit ? GLOW[state].concat(1) : [0.55, 0.55, 0.57, 1]);
        else if (m.name === 'tower') { m.setEmissiveFactor([0, 0, 0]); m.pbrMetallicRoughness.setBaseColorFactor([0.82, 0.82, 0.84, 1]); }
      });
    }
  }
  function show(d) {
    dev = d; press(null, 'dev', d);
    if (loaded !== d) {
      mv.setAttribute('alt', DEV[d].alt);
      mv.cameraOrbit = DEV[d].orbit;
      mv.src = DEV[d].src; loaded = d;
    } else paint();
  }
  mv.addEventListener('load', () => { mv.cameraOrbit = DEV[dev].orbit; mv.jumpCameraToGoal(); paint(); });

  let ready = null;
  function open(d) {
    if (!ready) ready = import(MV).catch(() => { dlg.classList.add('failed'); });
    dlg.showModal(); document.documentElement.classList.add('v3d-open');
    ready.then(() => show(d));
  }
  function close() { dlg.close(); }
  dlg.addEventListener('close', () => document.documentElement.classList.remove('v3d-open'));
  dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
  dlg.querySelector('.v3d-x').addEventListener('click', close);
  dlg.querySelectorAll('[data-dev]').forEach(b => b.addEventListener('click', () => show(b.dataset.dev)));
  dlg.querySelectorAll('[data-state]').forEach(b => b.addEventListener('click', () => { state = b.dataset.state; press(null, 'state', state); paint(); }));
  document.querySelectorAll('[data-3d]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); open(b.dataset['3d']); }));
  // a link straight to it: /shop/#view3d (the Lite) or /shop/#view3d-360
  const m = location.hash.match(/^#view3d(?:-(lite|360))?$/);
  if (m) open(m[1] || 'lite');
})();
