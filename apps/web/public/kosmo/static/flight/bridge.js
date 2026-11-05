/* Bridge between the Orbital Flight Deck and a host page (the Kosmographica space view).
 * Out:  {kosmo:'craft', craft}   - the deck's current state, on every repaint
 * In:   {kosmo:'craft-tab', tab} - switch the deck's section (deck, overview, vehicle, ...)
 * Inert when the page is not framed. See ../craft.js for the host side. */
(function () {
  if (window.parent === window) return;
  document.documentElement.classList.add('embedded');
  const send = m => { try { window.parent.postMessage(m, window.location.origin); } catch (e) { /* no parent */ } };
  let lastSent = 0;
  window.addEventListener('deck-sample', e => {
    const d = e.detail, s = d.sample, now = performance.now();
    if (now - lastSent < 50 && d.running) return;   // ~20 Hz while playing
    lastSent = now;
    send({
      kosmo: 'craft',
      craft: {
        phase: d.phase,                 // 'ascent' | 'cruise' | 'landing'
        t: d.time, duration: d.duration, running: d.running, title: d.title,
        // r, v: metres and m/s. cruise: heliocentric ecliptic (concept orbits, planar);
        // ascent/landing: planet-centred inertial (z = spin axis); landing params name the world.
        r: s ? [s.r[0], s.r[1], s.r[2] || 0] : null, v: s ? [s.v[0], s.v[1], s.v[2] || 0] : null,   // cruise paths are planar (2 components)
        alt: s ? s.alt : null, speed: s ? s.speed : null, mass: s ? s.mass : null, throttle: s ? s.throttle : null,
        world: d.params && d.params.world || (d.phase === 'ascent' ? 'Earth' : null),
        frame: d.phase === 'cruise' ? (d.mission && d.mission.kind === 'solar' ? 'heliocentric-ecliptic' : 'local-concept') : 'planet-inertial'
      }
    });
  });
  window.addEventListener('message', e => {
    if (e.origin !== window.location.origin || !e.data || e.data.kosmo !== 'craft-tab') return;
    const b = document.querySelector('[data-tab="' + CSS.escape(String(e.data.tab)) + '"]');
    if (b) b.click();
  });
  send({ kosmo: 'craft-ready' });
})();
