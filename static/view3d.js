// "View in 3D": the Cue Lite and Cue 360 as real 3D models, turned by hand.
// The models come from the case designs (static/3d/*.glb). Google's <model-viewer>
// loads only when someone opens the viewer, so the page itself stays light.
(function () {
  const dlg = document.getElementById('v3d');
  if (!dlg) return;
  const mv = dlg.querySelector('model-viewer');
  const MV = 'https://unpkg.com/@google/model-viewer@3.5.0/dist/model-viewer.min.js';
  const DEV = {
    lite: { src: '/static/3d/cue-lite.glb?v=4', orbit: '-28deg 78deg auto', alt: 'A Cue Lite in 3D' },
    '360': { src: '/static/3d/cue-360.glb?v=3', orbit: '40deg 68deg auto', alt: 'A Cue 360 in 3D' },
    mini: { src: '/static/3d/cue-mini.glb?v=3', orbit: '-24deg 80deg auto', alt: 'A Cue Mini in 3D' }
  };
  // the 360's tower glow and the Lite's screen picture, per tally state
  const GLOW = { program: [1.0, 0.03, 0.025], preview: [0.03, 1.0, 0.3], off: [0, 0, 0] };
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
      // the LEDs and the tower glow in the button's colour. The tower's own colour carries the hue:
      // a bright emissive alone tone-maps towards white, and red would read as pink.
      mats.filter(x => x.name === 'leds' || x.name === 'tower').forEach(m => {
        const tower = m.name === 'tower', lit = state !== 'off';
        m.setEmissiveFactor(GLOW[state]);
        m.setEmissiveStrength(tower ? 0.9 : 3);
        if (tower) {
          m.pbrMetallicRoughness.setBaseColorFactor(lit ? GLOW[state].map(c => 0.03 + 0.82 * c).concat(1) : [0.8, 0.8, 0.82, 1]);
          m.pbrMetallicRoughness.setRoughnessFactor(lit ? 0.92 : 0.6);
        }
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
