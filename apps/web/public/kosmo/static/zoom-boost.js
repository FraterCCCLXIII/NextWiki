// Stronger, smoother zoom for trackpads (and notched mice) on a three.js OrbitControls camera.
//
// Why: OrbitControls zooms by 0.95^(zoomSpeed * |deltaY| / 100) per wheel event. A trackpad pinch arrives as ctrl+wheel events with
// tiny deltas (typically 1-8) and a two-finger scroll as small deltas at 60 Hz, so the stock zoom crawls: a whole pinch changes the
// distance by only a few percent. Here every wheel event is turned into an exponential dolly with a much higher gain for pinch, and
// the step per event is capped so a hard flick (or a mouse notch) cannot jump the camera.
//
//   boostTrackpadZoom(controls, renderer.domElement, { pinchGain, scrollGain, maxStep });
//
// It runs in the capture phase on the same element and stops the event there, so OrbitControls' own wheel handler does not also zoom.
export function boostTrackpadZoom(controls, dom = controls.domElement, { pinchGain = 0.02, scrollGain = 0.0032, maxStep = 0.32 } = {}) {
  const off = controls.object.position.clone();
  dom.addEventListener('wheel', e => {
    e.preventDefault();
    e.stopImmediatePropagation();
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 16; else if (e.deltaMode === 2) dy *= 400;   // lines / pages -> pixels
    if (!dy) return;
    const step = Math.max(-maxStep, Math.min(maxStep, dy * (e.ctrlKey ? pinchGain : scrollGain)));   // > 0 zooms out
    const cam = controls.object, target = controls.target;
    off.copy(cam.position).sub(target);
    const d = off.length() || 1;
    const nd = Math.min(controls.maxDistance, Math.max(controls.minDistance, d * Math.exp(step)));
    cam.position.copy(target).addScaledVector(off.divideScalar(d), nd);
  }, { passive: false, capture: true });
}

// Zoom factor for a wheel event on a 2D canvas (used where there is no OrbitControls): same gains, same cap.
export function wheelZoomFactor(e, { pinchGain = 0.02, scrollGain = 0.0045, maxStep = 0.32 } = {}) {
  let dy = e.deltaY;
  if (e.deltaMode === 1) dy *= 16; else if (e.deltaMode === 2) dy *= 400;
  return Math.exp(-Math.max(-maxStep, Math.min(maxStep, dy * (e.ctrlKey ? pinchGain : scrollGain))));
}
