/* Particle portrait: the photo is rebuilt from thousands of particles that
   stream in from the flow field, assemble the face, swirl around the cursor
   and resolve into the real photo on click / long hover. */
(function () {
  const box = document.getElementById('portrait');
  if (!box) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const cvs = box.querySelector('canvas');
  const ctx = cvs.getContext('2d');
  const img = new Image();
  img.src = box.dataset.src;

  let W, H, dpr, P = [], started = false, running = false, t = 0;
  let mx = -1e4, my = -1e4, mActive = false, reveal = false, hoverTimer = 0;

  function flow(x, y) { // same flavour as the hero field
    const a = Math.sin(x * 1.7 + Math.sin(y * 1.3 + t * .3)) * Math.cos(y * 1.9 - Math.cos(x * .9 - t * .2));
    return a * Math.PI * 2;
  }

  function build() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = box.clientWidth; H = box.clientHeight;
    cvs.width = W * dpr; cvs.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // draw image "cover"-fitted into an offscreen buffer at low res
    const step = Math.max(3, Math.round(W / 118));
    const cols = Math.ceil(W / step), rows = Math.ceil(H / step);
    const off = document.createElement('canvas');
    off.width = cols; off.height = rows;
    const o = off.getContext('2d', { willReadFrequently: true });
    const s = Math.max(cols / img.width, rows / img.height);
    const iw = img.width * s, ih = img.height * s;
    o.drawImage(img, (cols - iw) / 2, (rows - ih) / 2, iw, ih);
    const d = o.getImageData(0, 0, cols, rows).data;

    const old = P; P = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const lum = (r * .299 + g * .587 + b * .114) / 255;
      if (lum < .07) continue;                       // dark background stays empty
      const hx = x * step + step / 2, hy = y * step + step / 2;
      const prev = old[P.length];
      P.push({
        hx, hy,
        x: prev ? prev.x : Math.random() * W * 1.4 - W * .2,
        y: prev ? prev.y : (Math.random() < .5 ? -20 - Math.random() * H * .5 : H + 20 + Math.random() * H * .5),
        vx: 0, vy: 0,
        size: step * (.45 + lum * .75),
        c: `rgb(${Math.min(255, r * 1.08 + 6) | 0},${g | 0},${Math.max(0, b * .92) | 0})`,
        delay: Math.random() * 60 + (hy / H) * 50,
        k: .028 + Math.random() * .02
      });
    }
  }

  function frame() {
    t += .01;
    ctx.fillStyle = 'rgba(11,12,16,.34)';
    ctx.fillRect(0, 0, W, H);
    const R = Math.min(W, H) * .22, R2 = R * R;
    for (const p of P) {
      if (p.delay > 0) { // still drifting in the flow
        p.delay--;
        const a = flow(p.x * .004, p.y * .004);
        p.x += Math.cos(a) * 1.6; p.y += Math.sin(a) * 1.6;
      } else {
        let ax = (p.hx - p.x) * p.k, ay = (p.hy - p.y) * p.k;
        if (mActive && !reveal) {
          const dx = p.x - mx, dy = p.y - my, d2 = dx * dx + dy * dy;
          if (d2 < R2) {
            const f = (1 - d2 / R2), d = Math.sqrt(d2) + .01;
            ax += (dx / d) * f * 2.2 + (-dy / d) * f * 3.4;   // push + swirl
            ay += (dy / d) * f * 2.2 + (dx / d) * f * 3.4;
          }
        }
        p.vx = (p.vx + ax) * .86; p.vy = (p.vy + ay) * .86;
        p.x += p.vx; p.y += p.vy;
      }
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    if (running) requestAnimationFrame(frame);
  }

  function start() {
    if (started || !img.complete || !img.naturalWidth) return;
    started = true;
    box.classList.add('live');
    build();
    ctx.fillStyle = '#0b0c10'; ctx.fillRect(0, 0, W, H);
    running = true; frame();
  }

  // run only while visible
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) {
      if (!started) start();
      else if (!running) { running = true; frame(); }
    } else running = false;
  }), { threshold: .2 });
  img.decode ? img.decode().then(() => io.observe(box)).catch(() => {}) : (img.onload = () => io.observe(box));

  function pos(e) { const r = cvs.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; }
  box.addEventListener('pointermove', e => {
    pos(e); mActive = true;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => { mActive = false; }, 900);  // settle when the cursor rests
  });
  box.addEventListener('pointerleave', () => { mActive = false; });
  box.addEventListener('click', () => { reveal = !reveal; box.classList.toggle('reveal', reveal); });

  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (started) build(); }, 200); });

  // allow swapping the source (e.g. a different portrait)
  window.setPortrait = src => { box.dataset.src = src; box.querySelector('img').src = src; img.src = src; img.decode().then(() => started && build()); };
})();
