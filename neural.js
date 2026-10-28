"use strict";

// The hero: a mountain range built as a neural network. Each ridgeline is a layer of nodes, edges run along
// the ridge and down the slopes to the next layer, and signals ripple from the far peaks toward the viewer.
// Uses seededRandom() and ridgeHeights() from script.js.
(() => {
  const canvas = document.getElementById("neural");
  const hero = document.getElementById("top");
  if (!canvas || !hero) return;
  const ctx = canvas.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const LAYERS = 6;
  const GREEN = "61,255,143";

  let W = 0;
  let H = 0;
  let layers = [];          // layers[0] is the farthest ridge, the last is the nearest
  let ridgeEdges = [];      // per layer: edges along the ridge
  let crossEdges = [];      // per layer: edges down to the next layer
  let tops = [];            // per layer: the highest point, for the shading gradient
  let pulses = [];
  let summit = null;
  let mouse = 0;
  let mouseTarget = 0;
  let visible = true;
  let raf = 0;
  let last = 0;
  let spawnClock = 0;

  const BUMPS = [
    [{ at: 0.78, w: 0.045, h: 0.85 }, { at: 0.5, w: 0.06, h: 0.3 }],   // far range: one tall peak on the right
    [{ at: 0.72, w: 0.05, h: 0.5 }],
    [{ at: 0.22, w: 0.07, h: 0.35 }],
    [], [], [],
  ];

  function build() {
    layers = [];
    ridgeEdges = [];
    crossEdges = [];
    pulses = [];
    const rand = seededRandom(17);

    for (let l = 0; l < LAYERS; l++) {
      const depth = l / (LAYERS - 1);
      const heights = ridgeHeights(40 + l * 7, 0.52, BUMPS[l]);
      const yBase = H * (0.6 + 0.075 * l);
      const amp = H * (0.3 - 0.035 * l);
      const count = 15 + l * 4;
      const span = W * 1.12;
      const x0 = -W * 0.06;
      const nodes = [];
      for (let j = 0; j < count; j++) {
        const along = j / (count - 1);
        const jitter = j > 0 && j < count - 1 ? (rand() - 0.5) * (span / count) * 0.5 : 0;
        nodes.push({ x: x0 + along * span + jitter, y: yBase - amp * heights[Math.round(along * 128)], l, depth, act: 0, links: [] });
      }
      layers.push(nodes);
      tops.push(Math.min(...nodes.map((n) => n.y)));
    }

    for (let l = 0; l < LAYERS; l++) {
      const nodes = layers[l];
      ridgeEdges[l] = [];
      crossEdges[l] = [];
      for (let j = 0; j < nodes.length - 1; j++) {
        const edge = { a: nodes[j], b: nodes[j + 1], kind: "ridge" };
        ridgeEdges[l].push(edge);
        nodes[j].links.push({ to: nodes[j + 1], edge });
        nodes[j + 1].links.push({ to: nodes[j], edge });
      }
      if (l < LAYERS - 1) {                              // each node reaches down to its 2 nearest nodes on the next ridge
        for (const n of nodes) {
          layers[l + 1]
            .map((m) => [m, Math.abs(m.x - n.x)])
            .sort((p, q) => p[1] - q[1])
            .slice(0, 2)
            .forEach(([m]) => {
              const edge = { a: n, b: m, kind: "cross" };
              crossEdges[l].push(edge);
              n.links.push({ to: m, edge });
            });
        }
      }
    }
    summit = layers[0].reduce((best, n) => (n.y < best.y ? n : best), layers[0][0]);
  }

  // Far ridges drift with the mouse a little, near ones more; far ones also scroll away more slowly.
  function offset(l, scrollY) {
    if (reduce) return { x: 0, y: 0 };
    const depth = l / (LAYERS - 1);
    return { x: mouse * (6 + 26 * depth), y: scrollY * (0.02 + 0.28 * (1 - depth)) };
  }

  function spawn(from, gen) {
    if (pulses.length > 80 || !from.links.length) return;
    const forward = from.links.filter((k) => k.edge.kind === "cross");
    const pool = forward.length && Math.random() < 0.75 ? forward : from.links;
    pulses.push({ from, link: pool[Math.floor(Math.random() * pool.length)], t: 0, speed: 130 + Math.random() * 120, gen });
  }

  function step(dt) {
    mouse += (mouseTarget - mouse) * Math.min(1, dt * 4);
    spawnClock += dt;
    while (spawnClock > 0.16) {                          // new signals start on the far peaks
      spawnClock -= 0.16;
      const pool = Math.random() < 0.7 ? layers[0] : layers[1];
      spawn(pool[Math.floor(Math.random() * pool.length)], 0);
    }
    for (let k = pulses.length - 1; k >= 0; k--) {
      const p = pulses[k];
      const len = Math.hypot(p.link.to.x - p.from.x, p.link.to.y - p.from.y) || 1;
      p.t += (dt * p.speed) / len;
      if (p.t < 1) continue;
      pulses.splice(k, 1);
      const node = p.link.to;
      node.act = 1;                                      // the node "fires" and passes the signal on, like a neuron
      if (p.gen < 12 && node.links.some((x) => x.edge.kind === "cross")) {
        if (Math.random() < 0.88) spawn(node, p.gen + 1);
        if (Math.random() < 0.28) spawn(node, p.gen + 1);
      }
    }
    for (const nodes of layers) for (const n of nodes) n.act = Math.max(0, n.act - dt * 1.5);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const sy = Math.min(window.scrollY, H);
    const pos = (n) => {
      const o = offset(n.l, sy);
      return [n.x + o.x, n.y + o.y];
    };

    for (let l = 0; l < LAYERS; l++) {
      const nodes = layers[l];
      const depth = nodes[0].depth;
      const o = offset(l, sy);

      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.beginPath();                                   // the ridge, filled dark so it hides the one behind it
      ctx.moveTo(nodes[0].x, H + 80);
      for (const n of nodes) ctx.lineTo(n.x, n.y);
      ctx.lineTo(nodes[nodes.length - 1].x, H + 80);
      ctx.closePath();
      const shade = ctx.createLinearGradient(0, tops[l], 0, H);
      shade.addColorStop(0, "rgba(9,28,18,0.94)");
      shade.addColorStop(1, "rgba(3,7,5,0.98)");
      ctx.fillStyle = shade;
      ctx.fill();
      ctx.beginPath();
      nodes.forEach((n, i) => (i ? ctx.lineTo(n.x, n.y) : ctx.moveTo(n.x, n.y)));
      ctx.strokeStyle = `rgba(${GREEN},${0.2 + 0.55 * depth})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      if (l < LAYERS - 1) {                              // the connections down the slope
        ctx.strokeStyle = `rgba(${GREEN},${0.06 + 0.2 * depth})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const e of crossEdges[l]) {
          const a = pos(e.a);
          const b = pos(e.b);
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
        }
        ctx.stroke();
      }

      ctx.save();
      ctx.translate(o.x, o.y);
      for (let j = 0; j < nodes.length; j++) {           // the nodes; peaks get a ring
        const n = nodes[j];
        const peak = j > 0 && j < nodes.length - 1 && n.y < nodes[j - 1].y && n.y < nodes[j + 1].y;
        const r = 1.2 + 1.7 * depth;
        const alpha = Math.min(1, 0.35 + 0.55 * depth + n.act * 0.6);
        if (n.act > 0.03) {
          ctx.fillStyle = `rgba(${GREEN},${0.28 * n.act})`;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 7 * n.act, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = `rgba(${GREEN},${alpha})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + n.act * 1.2, 0, Math.PI * 2);
        ctx.fill();
        if (peak && l >= 1) {
          ctx.strokeStyle = `rgba(${GREEN},${0.25 + 0.35 * depth})`;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 3.5, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    const [sx, sY] = pos(summit);                        // the summit, labelled
    ctx.strokeStyle = `rgba(${GREEN},0.8)`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(sx, sY, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(${GREEN},0.75)`;
    ctx.font = "500 11px 'JetBrains Mono', ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillText("8,849 m", sx + 11, sY - 6);

    for (const p of pulses) {                            // signals in flight
      const a = pos(p.from);
      const b = pos(p.link.to);
      const at = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      const head = at(p.t);
      const tail = at(Math.max(0, p.t - 0.14));
      ctx.strokeStyle = `rgba(${GREEN},0.9)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tail[0], tail[1]);
      ctx.lineTo(head[0], head[1]);
      ctx.stroke();
      ctx.fillStyle = `rgba(${GREEN},0.2)`;
      ctx.beginPath();
      ctx.arc(head[0], head[1], 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(225,255,238,0.95)";
      ctx.beginPath();
      ctx.arc(head[0], head[1], 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    step(dt);
    draw();
    raf = visible ? requestAnimationFrame(frame) : 0;
  }

  // Start with signals already travelling, so the very first frame (and the reduced-motion still) looks alive.
  function seed() {
    for (let i = 0; i < 26; i++) {
      const pool = layers[Math.random() < 0.5 ? 0 : 1 + Math.floor(Math.random() * 3)];
      spawn(pool[Math.floor(Math.random() * pool.length)], 0);
      if (pulses.length) pulses[pulses.length - 1].t = Math.random();
    }
    for (const nodes of layers) for (const n of nodes) if (Math.random() < 0.05) n.act = 0.4 + Math.random() * 0.6;
  }

  new ResizeObserver(() => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = hero.clientWidth;
    H = hero.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    tops = [];
    build();
    seed();
    draw();
  }).observe(hero);

  if (!reduce) {
    hero.addEventListener("pointermove", (event) => {
      const box = hero.getBoundingClientRect();
      mouseTarget = (event.clientX - box.left) / box.width - 0.5;
    });
    hero.addEventListener("pointerleave", () => { mouseTarget = 0; });
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    }).observe(hero);
  }
})();
