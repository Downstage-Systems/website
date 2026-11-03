// "View in 3D": the Cue Mini, Cue 360 and Hex as real 3D models, turned by hand.
// The models come from the case designs (static/3d/*.glb). Google's <model-viewer>
// loads only when someone opens the viewer, so the page itself stays light.
(function () {
  const dlg = document.getElementById('v3d');
  if (!dlg) return;
  const mv = dlg.querySelector('model-viewer');
  const MV = 'https://unpkg.com/@google/model-viewer@3.5.0/dist/model-viewer.min.js';
  const DEV = {
    mini: { src: '/static/3d/cue-mini.glb?v=8', orbit: '-20deg 80deg auto', alt: 'A Cue Mini in 3D' },
    '360': { src: '/static/3d/cue-360.glb?v=7', orbit: '-58deg 68deg auto', alt: 'A Cue 360 in 3D' },
    hex: { src: '/static/3d/cue-hex.glb?v=4', orbit: '-26deg 80deg auto', alt: 'The Hex talent light in 3D' }
  };
  // the 360's tower glow and the LEDs, per tally state
  const GLOW = { program: [1.0, 0.02, 0.015], preview: [0.01, 1.0, 0.09], off: [0, 0, 0] };
  let dev = 'mini', state = 'program', loaded = null;

  function press(group, attr, val) {
    dlg.querySelectorAll('[data-' + attr + ']').forEach(b => b.setAttribute('aria-pressed', String(b.dataset[attr] === val)));
  }
  // the Hex stays dark in preview: say so, rather than look broken
  function setNote() { const n = dlg.querySelector('.v3d-note'); if (n) n.hidden = !(dev === 'hex' && state === 'preview'); }
  async function paint() {
    // the Hex is red on air and dark otherwise: in preview it stays off
    const shown = dev === 'hex' && state === 'preview' ? 'off' : state;
    dlg.dataset.glow = shown;
    setNote();
    if (!mv.model) return;
    const mats = mv.model.materials;
    {
      // The glow is emissive with no reflections, so it shows the button's colour at full strength: the 360's skin over its frosted tower
      // (faded out when off, leaving the real frosted white), and the LEDs (dark chips when off).
      const lit = shown !== 'off';
      mats.forEach(m => {
        if (m.name === 'glow') { m.setEmissiveFactor(GLOW[shown]); m.pbrMetallicRoughness.setBaseColorFactor([0, 0, 0, lit ? 0.94 : 0]); }
        // the Mini's diffuser over its LEDs: the colour, the pixels only faintly through; frosted dark when off
        else if (m.name === 'haze') { m.setEmissiveFactor(GLOW[shown]); m.pbrMetallicRoughness.setBaseColorFactor(lit ? [0, 0, 0, 0.93] : [0.07, 0.07, 0.075, 0.9]); }
        else if (m.name === 'leds') { m.setEmissiveFactor(GLOW[shown]); m.pbrMetallicRoughness.setBaseColorFactor(lit ? [0, 0, 0, 1] : [0.2, 0.2, 0.21, 1]); }
        else if (m.name === 'tower') { m.setEmissiveFactor([0, 0, 0]); m.pbrMetallicRoughness.setBaseColorFactor([0.82, 0.82, 0.84, 1]); }
      });
    }
  }
  function show(d) {
    dev = d; press(null, 'dev', d); setNote();
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
  // a link straight to it: /shop/#view3d (the Mini), /shop/#view3d-360 or /shop/#view3d-hex
  const m = location.hash.match(/^#view3d(?:-(mini|360|hex))?$/);
  if (m) open(m[1] || 'mini');
})();
