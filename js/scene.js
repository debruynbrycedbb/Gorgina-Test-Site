/* ==========================================================
   Scroll-walk scene
   ----------------------------------------------------------
   Every tree and bush has a real position along the path (metres).
   Scrolling moves the camera forward; each cut-out is projected with
   simple perspective, so near ones grow fast and slide off the sides
   while far ones barely move. All drawn on one <canvas>.

   Tune the walk with CONFIG below.
   ========================================================== */
(() => {
  'use strict';

  const root = document.documentElement;
  if (root.classList.contains('reduced-motion')) {
    // Still painting instead of the walk (only downloaded when needed)
    const still = document.querySelector('.scene-static[data-src]');
    if (still) still.src = still.dataset.src;
    return;
  }

  const CONFIG = {
    walkLength: 64,      // metres walked between the top of the page and the light
    walkShare: 0.8,      // share of the scroll spent walking; the rest is arriving in the light
    eyeHeight: 1.6,      // camera height in metres (higher = ground rushes past faster)
    backdropZoom: 0.4,   // how much the background zooms in while walking (0.4 = +40%)
    arrivalZoom: 2.6,    // extra zoom into the light at the end
    smoothing: 0.09,     // 0–1, lower = floatier scroll

    // Where the path disappears in backdrop.webp (fraction of width / height)
    vanishing: { x: 1066 / 1672, y: 545 / 941 },
    horizonOnScreen: 0.56, // where the horizon sits on screen (fraction of height)

    // Path edges in metres (negative = left of the camera)
    pathLeft: -3.1,
    pathRight: 2.1,

    trees: { every: 3.6, height: [7.5, 10.5], setBack: [0.5, 2.6], backRow: 0.45 },
    bushes: { every: 2.4, width: [2.4, 4.4], setBack: [-0.3, 1.0] },
    fade: { from: 52, to: 70 }, // cut-outs fade in from the haze between these distances
    seed: 11,
  };

  /* ---------- assets ---------- */
  const SRC = 'assets/scene/';
  // trunkX = where the trunk meets the ground, as a fraction of image width
  const TREES = [
    { file: 'tree-1.webp', trunkX: 0.345 },
    { file: 'tree-2.webp', trunkX: 0.397 },
    { file: 'tree-3.webp', trunkX: 0.421 },
    { file: 'tree-4.webp', trunkX: 0.18 },
    { file: 'tree-5.webp', trunkX: 0.25 },
    { file: 'tree-6.webp', trunkX: 0.40 },
  ];
  const BUSHES = ['bush-1.webp', 'bush-2.webp', 'bush-3.webp', 'bush-4.webp'].map(file => ({ file }));
  const BACKDROP = { file: 'backdrop.webp' };

  // Phones get lighter cut-outs (55% size) — the painterly style hides the softness
  const small = window.innerWidth < 900;
  const load = a => new Promise(res => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => { a.img = img; res(); });
    img.onerror = () => res(); // a missing layer shouldn't break the page
    img.src = SRC + (small && a !== BACKDROP ? a.file.replace('.webp', '-sm.webp') : a.file);
  });

  /* ---------- build the world (deterministic) ---------- */
  let seed = CONFIG.seed;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const between = ([a, b]) => a + (b - a) * rand();
  const pick = arr => arr[Math.floor(rand() * arr.length)];

  const sprites = [];
  const farthest = CONFIG.walkLength + CONFIG.fade.to + 10;

  // Trees: alternate sides with jitter; canopies lean over the path.
  let side = -1;
  for (let z = 5; z < farthest; z += CONFIG.trees.every * (0.75 + rand() * 0.5)) {
    side = rand() < 0.8 ? -side : side;
    const edge = side < 0 ? CONFIG.pathLeft : CONFIG.pathRight;
    const t = pick(TREES);
    sprites.push({ kind: 'tree', a: t, z, x: edge + side * between(CONFIG.trees.setBack), h: between(CONFIG.trees.height), flip: side > 0 });
    if (rand() < CONFIG.trees.backRow) { // second row deeper in the woods
      const t2 = pick(TREES);
      sprites.push({ kind: 'tree', a: t2, z: z + 1 + rand() * 2, x: edge + side * (3.5 + rand() * 4), h: between(CONFIG.trees.height) * 1.05, flip: side > 0 });
    }
  }
  // Bushes along both verges
  for (let z = 3; z < farthest; z += CONFIG.bushes.every * (0.7 + rand() * 0.6)) {
    for (const s of [-1, 1]) {
      if (rand() < 0.3) continue;
      const edge = s < 0 ? CONFIG.pathLeft : CONFIG.pathRight;
      const w = between(CONFIG.bushes.width);
      sprites.push({ kind: 'bush', a: pick(BUSHES), z: z + rand() * 1.2, x: edge + s * (w * 0.42 + between(CONFIG.bushes.setBack)), w, flip: rand() < 0.5 });
    }
  }
  sprites.sort((p, q) => q.z - p.z); // far first (painter's algorithm)

  /* ---------- canvas & layout ---------- */
  const canvas = document.querySelector('.scene');
  const ctx = canvas.getContext('2d');
  const journey = document.querySelector('.journey');
  const bar = document.querySelector('.progress span');
  const intro = document.querySelector('.intro');

  let W = 0, H = 0, dpr = 1;
  let base = 1, cx = 0, horizonY = 0, focal = 0, xSquash = 1;

  function layout() {
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    // cap the pixel count so big retina screens stay smooth
    dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(4.2e6 / (W * H)));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    const bw = BACKDROP.img ? BACKDROP.img.naturalWidth : 1672;
    const bh = BACKDROP.img ? BACKDROP.img.naturalHeight : 941;
    const vx = CONFIG.vanishing.x, vy = CONFIG.vanishing.y;
    // scale so the backdrop covers the screen with the vanishing point centred
    base = Math.max(W / (2 * Math.min(vx, 1 - vx) * bw), H / bh);
    cx = W / 2;
    const top = Math.min(0, Math.max(H - bh * base, H * CONFIG.horizonOnScreen - vy * bh * base));
    horizonY = top + vy * bh * base;
    focal = bh * base;                              // px per metre at 1 m distance
    xSquash = Math.min(1, Math.max(0.5, (W / H) / 1.5)); // pull trees inward on tall phones
  }

  /* ---------- scroll state ---------- */
  let target = 0, current = 0, raf = 0;

  const clamp01 = v => Math.min(1, Math.max(0, v));
  const ease = t => t * t * (3 - 2 * t);

  function readScroll() {
    const r = journey.getBoundingClientRect();
    const total = r.height - window.innerHeight;
    target = total > 0 ? clamp01(-r.top / total) : 0;
  }

  /* ---------- render ---------- */
  function render(p) {
    const walk = clamp01(p / CONFIG.walkShare);
    const arrive = clamp01((p - CONFIG.walkShare * 0.95) / (1 - CONFIG.walkShare * 0.95));
    const camZ = CONFIG.walkLength * walk;
    const zoom = (1 + CONFIG.backdropZoom * walk) * (1 + CONFIG.arrivalZoom * arrive * arrive);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 1. Backdrop, zoomed around the vanishing point
    if (BACKDROP.img) {
      const s = base * zoom, iw = BACKDROP.img.naturalWidth, ih = BACKDROP.img.naturalHeight;
      ctx.drawImage(BACKDROP.img, cx - CONFIG.vanishing.x * iw * s, horizonY - CONFIG.vanishing.y * ih * s, iw * s, ih * s);
    }

    // 2. Cut-outs in perspective
    for (const sp of sprites) {
      const img = sp.a.img;
      if (!img) continue;
      const d = (sp.z - camZ) / zoom;          // effective distance
      if (d < 0.25) continue;                    // behind us
      const fade = clamp01((CONFIG.fade.to - d) / (CONFIG.fade.to - CONFIG.fade.from));
      if (fade <= 0) continue;
      const k = focal / d;                       // px per metre
      const gx = cx + sp.x * k * xSquash;
      const gy = horizonY + CONFIG.eyeHeight * k;
      const iw = img.naturalWidth, ih = img.naturalHeight;
      let w, h, anchor;
      if (sp.kind === 'tree') { h = sp.h * k; w = h * iw / ih; anchor = sp.a.trunkX; }
      else { w = sp.w * k; h = w * ih / iw; anchor = 0.5; }
      if (sp.flip) anchor = 1 - anchor;
      const left = gx - anchor * w;
      const topY = gy - h * (sp.kind === 'tree' ? 0.985 : 0.94); // sink slightly into the ground
      if (left > W || left + w < 0 || topY > H) continue; // off screen

      ctx.globalAlpha = fade;
      if (sp.flip) {
        ctx.save();
        ctx.translate(left + w, topY);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, w, h);
        ctx.restore();
      } else {
        ctx.drawImage(img, left, topY, w, h);
      }
    }
    ctx.globalAlpha = 1;

    // 3. Warm light at the end of the path, swelling into the gallery
    const glowR = Math.hypot(W, H) * (0.12 + 0.18 * walk + 1.3 * arrive);
    const g = ctx.createRadialGradient(cx, horizonY - 10, 0, cx, horizonY - 10, glowR);
    const a0 = 0.18 + 0.25 * walk + 0.57 * arrive;
    g.addColorStop(0, `rgba(255, 246, 222, ${a0})`);
    g.addColorStop(0.45, `rgba(255, 214, 140, ${a0 * 0.45})`);
    g.addColorStop(1, 'rgba(255, 214, 140, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const wash = ease(clamp01((arrive - 0.45) / 0.55));
    if (wash > 0) {
      ctx.fillStyle = `rgba(244, 236, 223, ${wash})`; // = --cream, so the gallery follows seamlessly
      ctx.fillRect(0, 0, W, H);
    }

    // UI
    bar.style.transform = `scaleX(${walk})`;
    bar.parentElement.style.opacity = 1 - wash;
    intro.style.opacity = 1 - clamp01(p / 0.05);
    root.classList.toggle('is-arrived', wash > 0.6 || p >= 1);
  }

  function tick() {
    current += (target - current) * CONFIG.smoothing;
    if (Math.abs(target - current) < 0.00005) current = target;
    render(current);
    raf = current !== target ? requestAnimationFrame(tick) : 0;
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };

  function onScroll() { readScroll(); kick(); }
  function onResize() { layout(); readScroll(); render(current); }

  // Show the backdrop first, then bring in the cut-outs once loaded
  load(BACKDROP).then(() => {
    layout(); readScroll(); current = target; render(current);
    return Promise.all([...TREES, ...BUSHES].map(load));
  }).then(() => {
    root.classList.add('is-ready');
    render(current);
  });

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onResize);

  // Expose for tuning in the console: e.g. walkScene.config.walkLength = 80; walkScene.redraw()
  window.walkScene = { config: CONFIG, redraw: () => { layout(); render(current); } };
})();
