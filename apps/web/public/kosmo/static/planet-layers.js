// planet-layers.js — attaches the optional layers to a planet model made by createModel (kosmo-models.js).
//
//   attachPlanetLayers(THREE, group, spec, kind, { tickers, disposables, sphere })
//
// Each layer module exports  addX(THREE, group, spec, profile, ctx) -> { tick(t), dispose() } | null  and reads layers.state every frame,
// creating its meshes lazily the first time it is switched on and hiding them when it is off. ctx:
//   lightDir   THREE.Vector3  WORLD-space direction from the planet toward the Sun (the app rewrites it every frame)
//   lightView  THREE.Vector3  the same direction in VIEW space (what the body shader dots with its view-space normals); updated per draw
//   helioAU    () => number   heliocentric distance in AU (the app sets group.userData.helioAU; 1 when unknown)
//   spin       () => number   the body's rotation angle about its pole (radians)
//   poleFrame  THREE.Object3D the node whose +Y is the planet's rotation axis and which does NOT spin (group.userData.polarFrame for ringed planets, else null: use `group` and cancel group.rotation.y)
//   sphere     (segments) => unit SphereGeometry that the model's disposables already own
import { profileFor } from './planet-data.js';
import { addAtmosphere } from './atmospheres.js';
import { addMagnetosphere } from './magnetosphere.js';

export function attachPlanetLayers(THREE, group, spec, kind, { tickers, disposables, sphere }) {
  const profile = profileFor(spec, kind); if (!profile) return;
  const ctx = {
    tickers, disposables, sphere, kind,
    get lightDir() { return group.userData.lightDir; }, get lightView() { return group.userData.lightView; },
    helioAU: () => group.userData.helioAU || 1, spin: () => group.rotation.y, get poleFrame() { return group.userData.polarFrame || null; },
  };
  for (const [make, need] of [[addAtmosphere, profile.atm], [addMagnetosphere, profile.mag]]) {
    if (!need) continue;
    try { const l = make(THREE, group, spec, profile, ctx); if (l) { tickers.push(t => l.tick(t)); disposables.push(l); } } catch (err) { console.warn('planet layer', spec.name, err); }
  }
}
