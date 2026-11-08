import { FLASHER, SHOULDER, kawasakiResidual, solveShoulder, maekawa, deploy, creases, stowedSpan, foldRatio, flasherRadius, lambdaFor, report } from './parts/flasher.js';
console.log('shoulder', SHOULDER.toFixed(6), 'kawasaki residual', kawasakiResidual({ r1: SHOULDER }).toExponential(2));
console.log('shoulder at delta 6 deg', solveShoulder({ delta: Math.PI / 30 }).toFixed(6), 'residual', kawasakiResidual({ r1: solveShoulder({ delta: Math.PI / 30 }), delta: Math.PI / 30 }).toExponential(2));
console.log('maekawa', JSON.stringify(maekawa()));
console.log('creases', creases().length, 'kinds', [...new Set(creases().map(c => c.kind))].join(','));
console.log('fold ratio', foldRatio.toFixed(2), 'linear', Math.sqrt(foldRatio).toFixed(2));
for (const lam of [0.026, 0.064, 0.178, 0.402, 0.543, 1]) {
  const r = report(lam, { radiusM: 10 });
  console.log('lambda', lam.toFixed(3).padStart(5), r.stage.padEnd(9), 'twist', r.twistDeg.toFixed(1).padStart(5), 'deg  span', r.spanM.toFixed(2).padStart(7), 'm  area', r.areaM2.toFixed(1).padStart(7));
}
const R = flasherRadius(294.118e6); // habitat film area
console.log('habitat film R', (R / 1000).toFixed(2), 'km, stowed span', (stowedSpan(R) / 1000).toFixed(2), 'km');
const d1 = deploy(1, { radiusM: 1 });
console.log('flat span check', (2 * Math.hypot(d1.points.O[0][0], d1.points.O[0][2])).toFixed(6), 'hub R', Math.hypot(d1.points.H[0][0], d1.points.H[0][2]).toFixed(4));
console.log('k at 0/0.5/1 ->', [0, 0.5, 1].map(k => lambdaFor(k).toFixed(4)).join(' '));
