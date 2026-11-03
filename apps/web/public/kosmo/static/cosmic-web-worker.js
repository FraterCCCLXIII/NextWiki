// Builds the cosmic web off the main thread (about a second of FFT work) and hands the result back as transferable arrays.
import { makeWeb } from './cosmic-web.js';
self.onmessage = e => {
  const w = makeWeb(e.data);
  self.postMessage({ id: e.data.id, N: w.N, L: w.L, lat: w.lat, psi: w.psi, rho: w.rho }, [w.lat.buffer, w.psi.buffer, w.rho.buffer]);
};
