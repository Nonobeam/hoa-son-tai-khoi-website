// Falling pink apricot-blossom petals rendered on a fixed full-screen canvas
// that sits BEHIND the manga pages (z-index:-1). Petals are only visible in
// the margins around the reading column and through the translucent top bar.
// Lightweight canvas animation, paused when the tab is hidden.

(function () {
  const canvas = document.getElementById("petals");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const PINKS = [
    "#f9a8d4",
    "#f472b6",
    "#fb7185",
    "#fda4af",
    "#fbcfe8",
    "#f8b4cf",
  ];

  let W = 0,
    H = 0,
    dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  // Density scales a bit with viewport width.
  const COUNT = Math.max(18, Math.min(46, Math.round(W / 26)));

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function makePetal(initial) {
    return {
      x: rand(0, W),
      y: initial ? rand(-H, H) : rand(-40, -10),
      size: rand(7, 15),
      speedY: rand(0.4, 1.3),
      swayAmp: rand(12, 46),
      swayFreq: rand(0.4, 1.2),
      phase: rand(0, Math.PI * 2),
      rot: rand(0, Math.PI * 2),
      rotSpeed: rand(-0.02, 0.02),
      color: PINKS[(Math.random() * PINKS.length) | 0],
      opacity: rand(0.35, 0.85),
    };
  }

  let petals = Array.from({ length: COUNT }, () => makePetal(true));

  // Draw a single 5-petal blossom-ish shape (one petal teardrop, repeated).
  function drawPetal(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = p.opacity;
    const s = p.size;
    // a soft teardrop petal using two bezier curves
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.bezierCurveTo(s * 0.9, -s * 0.6, s * 0.7, s * 0.6, 0, s);
    ctx.bezierCurveTo(-s * 0.7, s * 0.6, -s * 0.9, -s * 0.6, 0, -s);
    ctx.fillStyle = p.color;
    ctx.fill();
    // subtle notch/highlight to read as a blossom petal
    ctx.globalAlpha = p.opacity * 0.5;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.7);
    ctx.bezierCurveTo(s * 0.35, -s * 0.3, s * 0.25, s * 0.4, 0, s * 0.7);
    ctx.strokeStyle = "rgba(190, 24, 93, 0.5)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();
  }

  let t = 0;
  let running = true;
  let lastTime = null;

  function frame(now) {
    if (!running) return;
    // Normalize movement to a 60fps baseline so a janky frame (e.g. from
    // infinite-scroll DOM growth) doesn't make petals appear to speed up
    // when the browser catches up.
    const dt = lastTime == null ? 1 : Math.min((now - lastTime) / (1000 / 60), 4);
    lastTime = now;
    t += 0.016 * dt;
    ctx.clearRect(0, 0, W, H);
    for (const p of petals) {
      p.y += p.speedY * dt;
      p.x += Math.sin(t * p.swayFreq + p.phase) * 0.6 * dt;
      p.rot += p.rotSpeed * dt;
      const drawX = p.x + Math.sin(t * p.swayFreq + p.phase) * p.swayAmp;
      const saved = p.x;
      p.x = drawX;
      drawPetal(p);
      p.x = saved;
      // recycle when it falls off the bottom
      if (p.y - p.size > H) Object.assign(p, makePetal(false));
    }
    requestAnimationFrame(frame);
  }

  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    if (running) {
      lastTime = null;
      requestAnimationFrame(frame);
    }
  });

  // Respect reduced-motion preference.
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduce) requestAnimationFrame(frame);
  else {
    // static scatter for reduced-motion users
    petals.forEach(drawPetal);
  }
})();
