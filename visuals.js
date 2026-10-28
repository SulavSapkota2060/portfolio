"use strict";

// The project visuals, each drawn on a <canvas>. Real ones: the wildfire accuracy ladder (numbers from the
// repo's README), the earthquake cutoff explorer (my dataset) and a small live copy of my gossip model.
// Illustrations: the microplastics scan and the dashboard layout. Uses seededRandom() from script.js.
(() => {
  const $ = (selector) => document.querySelector(selector);
  const TAU = Math.PI * 2;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const GREEN = "61,255,143";
  const BG = "#050a07";
  const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
  const clamp = (lo, value, hi) => Math.max(lo, Math.min(hi, value));

  // Keeps a canvas sharp on high-density screens and calls draw(ctx, width, height, seconds) every
  // frame while the canvas is visible. With reduced motion it draws one still frame at staticTime.
  function animate(canvas, draw, staticTime) {
    const ctx = canvas.getContext("2d");
    const started = performance.now();
    let w = 1;
    let h = 1;
    let visible = false;
    let raf = 0;
    const paint = (t) => draw(ctx, w, h, t);
    const frame = (now) => {
      paint((now - started) / 1000);
      raf = visible ? requestAnimationFrame(frame) : 0;
    };
    new ResizeObserver(() => {
      const box = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, Math.round(box.width));
      h = Math.max(1, Math.round(box.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint(reduceMotion ? staticTime : (performance.now() - started) / 1000);
    }).observe(canvas);
    if (reduceMotion) return;
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(frame);
    }).observe(canvas);
  }

  // For visuals that only change when you touch them: draws on resize and when you call the returned function.
  function still(canvas, draw) {
    const ctx = canvas.getContext("2d");
    let w = 1;
    let h = 1;
    const redraw = () => draw(ctx, w, h);
    new ResizeObserver(() => {
      const box = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, Math.round(box.width));
      h = Math.max(1, Math.round(box.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      redraw();
    }).observe(canvas);
    return redraw;
  }

  // ---------------------------------------------------------------------------
  // 1. Wildfire: how accuracy climbed as features were added (real numbers from the repo's README)
  // ---------------------------------------------------------------------------
  function ladderVisual() {
    const canvas = $("#viz-ladder");
    const rows = [
      ["simple rule", 68.9],
      ["local features", 81.1],
      ["whole-fire split", 84.0],
      ["local + split", 89.8],
      ["+ distance, expanded", 91.4],
      ["XGBoost, final", 91.5],
    ];
    const LO = 50;
    const HI = 100;
    const ease = (x) => 1 - (1 - x) ** 3;

    animate(canvas, (ctx, w, h, t) => {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, w, h);
      const fs = clamp(10.5, w * 0.026, 14);
      ctx.font = `700 ${fs}px ${MONO}`;                    // size the label column to the longest label
      const left = Math.max(w * 0.3, Math.max(...rows.map(([label]) => ctx.measureText(label).width)) + 24);
      const right = w - fs * 4.2;
      const top = h * 0.18;
      const bottom = h * 0.84;
      const rowH = (bottom - top) / rows.length;
      const X = (v) => left + ((v - LO) / (HI - LO)) * (right - left);

      ctx.textAlign = "left";
      ctx.font = `700 ${fs}px ${MONO}`;
      ctx.fillStyle = `rgba(${GREEN},0.95)`;
      ctx.fillText("accuracy by approach", 14, fs + 8);

      ctx.font = `${fs * 0.85}px ${MONO}`;
      ctx.textAlign = "center";
      for (let v = LO; v <= HI; v += 10) {                 // faint gridlines every 10 points
        ctx.strokeStyle = `rgba(${GREEN},0.09)`;
        ctx.beginPath();
        ctx.moveTo(X(v), top - 6);
        ctx.lineTo(X(v), bottom);
        ctx.stroke();
        ctx.fillStyle = "rgba(125,149,135,0.9)";
        ctx.fillText(`${v}`, X(v), bottom + fs * 1.15);
      }

      const c = t % 9.5;                                   // grow, hold, fade, repeat
      const fade = c > 8.6 ? (9.5 - c) / 0.9 : 1;
      ctx.globalAlpha = fade;
      rows.forEach(([label, value], i) => {
        const p = ease(clamp(0, (c - 0.3 - i * 0.32) / 1.0, 1));
        const last = i === rows.length - 1;
        const y = top + i * rowH + rowH * 0.18;
        const bh = rowH * 0.64;
        ctx.textAlign = "right";
        ctx.font = `${last ? 700 : 500} ${fs}px ${MONO}`;
        ctx.fillStyle = last ? "#ecfff4" : "rgba(198,214,204,0.85)";
        ctx.fillText(label, left - 10, y + bh * 0.72);

        const len = (X(value) - left) * p;
        const bar = ctx.createLinearGradient(left, 0, left + Math.max(len, 1), 0);
        if (i === 0) {
          bar.addColorStop(0, "rgba(125,149,135,0.35)");
          bar.addColorStop(1, "rgba(125,149,135,0.75)");
        } else {
          bar.addColorStop(0, `rgba(${GREEN},0.25)`);
          bar.addColorStop(1, `rgba(${GREEN},${last ? 1 : 0.78})`);
        }
        ctx.save();
        if (last) { ctx.shadowColor = `rgba(${GREEN},0.7)`; ctx.shadowBlur = 12; }
        ctx.fillStyle = bar;
        ctx.beginPath();
        ctx.roundRect(left, y, Math.max(len, 0), bh, 3);
        ctx.fill();
        ctx.restore();

        ctx.textAlign = "left";
        ctx.font = `${last ? 700 : 500} ${fs}px ${MONO}`;
        ctx.fillStyle = last ? `rgba(${GREEN},1)` : "rgba(236,255,244,0.85)";
        ctx.fillText(`${(LO + (value - LO) * p).toFixed(1)}%`, left + len + 8, y + bh * 0.72);
      });
      ctx.globalAlpha = 1;

      ctx.textAlign = "left";
      ctx.font = `${fs * 0.85}px ${MONO}`;
      ctx.fillStyle = "rgba(125,149,135,0.95)";
      ctx.fillText("5-fold, fire-grouped cross-validation · axis starts at 50%", 14, h - 9);
    }, 5);
  }

  // ---------------------------------------------------------------------------
  // 2. Quake Atlas: drag the completeness cutoff and watch the b-value move (real data)
  // ---------------------------------------------------------------------------
  async function quakeExplorer() {
    const canvas = $("#viz-quake");
    const slider = $("#cutoff");
    const output = $("#cutoff-out");
    let data;
    try {
      const response = await fetch("quake-data.json");
      if (!response.ok) throw new Error(response.status);
      data = await response.json();
    } catch (err) {
      return;
    }
    const byMag = new Map(data.histogram.map(([m, n]) => [m.toFixed(1), n]));
    const mags = [];
    const counts = [];
    for (let i = 40; i <= 78; i++) {                       // M4.0 to M7.8 in steps of 0.1
      mags.push(i / 10);
      counts.push(byMag.get((i / 10).toFixed(1)) || 0);
    }
    const curve = data.b_vs_mc;
    let index = Number(slider.value);
    output.textContent = `M${(4 + index / 10).toFixed(1)}`;

    const redraw = still(canvas, (ctx, w, h) => {
      const cutoff = 4 + index / 10;
      const row = curve[index];
      const fs = clamp(10.5, w * 0.024, 13.5);
      const padL = 34;
      const padR = 12;
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, w, h);

      // top: the magnitude histogram on a log scale
      const hTop = fs * 4.3;
      const hBot = h * 0.58;
      const maxN = Math.max(...counts);
      const yMax = Math.log10(maxN * 1.25);
      const yMin = Math.log10(0.6);
      const Y = (n) => hBot - ((Math.log10(Math.max(n, 0.6)) - yMin) / (yMax - yMin)) * (hBot - hTop);
      const bw = (w - padL - padR) / counts.length;

      ctx.font = `${fs * 0.85}px ${MONO}`;
      ctx.textAlign = "right";
      for (const v of [1, 10, 100, 1000]) {
        if (v > maxN * 1.25) continue;
        ctx.strokeStyle = `rgba(${GREEN},0.09)`;
        ctx.beginPath();
        ctx.moveTo(padL, Y(v));
        ctx.lineTo(w - padR, Y(v));
        ctx.stroke();
        ctx.fillStyle = "rgba(125,149,135,0.9)";
        ctx.fillText(String(v), padL - 6, Y(v) + 3.5);
      }
      counts.forEach((n, i) => {
        if (!n) return;
        const used = mags[i] >= cutoff - 1e-9;
        ctx.fillStyle = used ? `rgba(${GREEN},0.85)` : "rgba(125,149,135,0.32)";
        const y = Y(n);
        ctx.fillRect(padL + i * bw + 1, y, Math.max(1, bw - 2), hBot - y);
      });
      const cx = padL + ((cutoff - 4) / 0.1) * bw;
      ctx.strokeStyle = "rgba(236,255,244,0.9)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx, hTop - 8);
      ctx.lineTo(cx, hBot);
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.fillStyle = "#ecfff4";
      ctx.font = `700 ${fs}px ${MONO}`;
      ctx.fillText(`M${cutoff.toFixed(1)}`, clamp(padL + 14, cx, w - 24), hTop - 12);
      ctx.font = `${fs * 0.85}px ${MONO}`;
      ctx.fillStyle = "rgba(125,149,135,0.9)";
      for (const m of [4, 5, 6, 7]) ctx.fillText(`M${m}`, padL + ((m - 4) / 0.1) * bw + bw / 2, hBot + fs * 1.1);

      // readout, top right
      ctx.textAlign = "right";
      ctx.font = `700 ${fs * 1.15}px ${MONO}`;
      ctx.fillStyle = `rgba(${GREEN},1)`;
      ctx.fillText(`b = ${row.b.toFixed(3)} ± ${row.se.toFixed(3)}`, w - padR, fs + 6);
      ctx.font = `${fs * 0.9}px ${MONO}`;
      ctx.fillStyle = "rgba(198,214,204,0.85)";
      ctx.fillText(`${row.n.toLocaleString("en-US")} quakes at or above the cutoff`, w - padR, fs * 2.25 + 6);
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(125,149,135,0.9)";
      ctx.fillText("shallow quakes per magnitude, log scale", padL, fs + 6);

      // bottom: b at every cutoff, with the current one marked
      const cTop = h * 0.7;
      const cBot = h - fs * 1.9;
      const lo = 0.7;
      const hi = 1.4;
      const X2 = (mc) => padL + ((mc - 4) / 1.2) * (w - padL - padR);
      const Y2 = (b) => cBot - ((b - lo) / (hi - lo)) * (cBot - cTop);
      ctx.beginPath();
      curve.forEach((r, i) => (i ? ctx.lineTo(X2(r.mc), Y2(r.b + r.se)) : ctx.moveTo(X2(r.mc), Y2(r.b + r.se))));
      for (let i = curve.length - 1; i >= 0; i--) ctx.lineTo(X2(curve[i].mc), Y2(curve[i].b - curve[i].se));
      ctx.closePath();
      ctx.fillStyle = `rgba(${GREEN},0.13)`;
      ctx.fill();
      ctx.beginPath();
      curve.forEach((r, i) => (i ? ctx.lineTo(X2(r.mc), Y2(r.b)) : ctx.moveTo(X2(r.mc), Y2(r.b))));
      ctx.strokeStyle = `rgba(${GREEN},0.9)`;
      ctx.lineWidth = 2;
      ctx.stroke();
      curve.forEach((r, i) => {
        ctx.fillStyle = i === index ? "#ecfff4" : `rgba(${GREEN},0.9)`;
        ctx.beginPath();
        ctx.arc(X2(r.mc), Y2(r.b), i === index ? 5 : 2.6, 0, TAU);
        ctx.fill();
      });
      ctx.strokeStyle = `rgba(${GREEN},0.55)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(X2(row.mc), Y2(row.b), 9, 0, TAU);
      ctx.stroke();
      ctx.font = `${fs * 0.85}px ${MONO}`;
      ctx.fillStyle = "rgba(125,149,135,0.9)";
      ctx.textAlign = "left";
      ctx.fillText("b-value at each cutoff (band = ±1 standard error)", padL, h - 7);
    });

    slider.addEventListener("input", () => {
      index = Number(slider.value);
      output.textContent = `M${(4 + index / 10).toFixed(1)}`;
      redraw();
    });
  }

  // ---------------------------------------------------------------------------
  // 3. Rumor Mill: a small live version of the gossip model (the same rules, fewer nodes)
  // ---------------------------------------------------------------------------
  function gossipVisual() {
    const canvas = $("#viz-gossip");
    const buttons = [...document.querySelectorAll("[data-fanout]")];
    const N = 110;                // nodes (the C++ runs use 1,000)
    const LOSS = 0.15;            // chance a message is lost
    const STEP = 0.55;            // seconds between rounds (0.5 simulated time units)
    const TRAVEL = 0.42;          // seconds a message takes to arrive
    const PAUSE = 3.2;            // seconds to rest on the finished spread

    // A random connected graph: each node links to its 5 nearest neighbours; redraw until it is connected.
    const rand = seededRandom(2026);
    let nodes;
    let adj;
    const isConnected = () => {
      const seen = new Set([0]);
      const stack = [0];
      while (stack.length) {
        const u = stack.pop();
        for (const v of adj[u]) if (!seen.has(v)) { seen.add(v); stack.push(v); }
      }
      return seen.size === N;
    };
    do {
      nodes = Array.from({ length: N }, () => ({ x: 0.05 + rand() * 0.9, y: 0.1 + rand() * 0.8 }));
      adj = nodes.map(() => new Set());
      nodes.forEach((a, i) => {
        nodes
          .map((b, j) => [j, (a.x - b.x) ** 2 + (a.y - b.y) ** 2])
          .filter(([j]) => j !== i)
          .sort((p, q) => p[1] - q[1])
          .slice(0, 5)
          .forEach(([j]) => { adj[i].add(j); adj[j].add(i); });
      });
    } while (!isConnected());
    const neighbours = adj.map((s) => [...s]);
    const origin = nodes.reduce((best, n, i) =>
      ((n.x - 0.5) ** 2 + (n.y - 0.5) ** 2 < (nodes[best].x - 0.5) ** 2 + (nodes[best].y - 0.5) ** 2 ? i : best), 0);

    let fanout = 1;
    let clock = 0;
    let informed, informedAt, packets, nextStep, startedAt, messages, delivered, duplicates, count, doneAt, t99, pick;
    let frozen = false;

    function reset() {
      informed = new Uint8Array(N);
      informedAt = new Float32Array(N).fill(-9);
      informed[origin] = 1;
      informedAt[origin] = clock;
      count = 1;
      packets = [];
      messages = 0;
      delivered = 0;
      duplicates = 0;
      doneAt = null;
      t99 = null;
      startedAt = clock + 0.6;
      nextStep = startedAt;
      pick = seededRandom(Math.floor(Math.random() * 1e9));
    }

    function sendRound() {
      for (let i = 0; i < N; i++) {
        if (!informed[i]) continue;
        const pool = neighbours[i].slice();
        for (let k = Math.min(fanout, pool.length); k > 0; k--) {
          const j = pool.splice(Math.floor(pick() * pool.length), 1)[0];
          messages++;
          packets.push({ from: i, to: j, born: clock, lost: pick() < LOSS });
        }
      }
    }

    function advance(dt) {
      clock += dt;
      while (doneAt === null && clock >= nextStep) {
        sendRound();
        nextStep += STEP;
      }
      for (let k = packets.length - 1; k >= 0; k--) {
        const p = packets[k];
        if (clock - p.born < TRAVEL) continue;
        if (!p.lost) {
          delivered++;
          if (informed[p.to]) {
            duplicates++;
          } else {
            informed[p.to] = 1;
            informedAt[p.to] = clock;
            count++;
            if (t99 === null && count >= 0.99 * N) t99 = ((clock - startedAt) / STEP) * 0.5;
          }
        }
        packets.splice(k, 1);
      }
      if (count === N && doneAt === null) doneAt = clock;
      if (doneAt !== null && !frozen && clock - doneAt > PAUSE) reset();
    }

    function settle() {                                // for reduced motion: run it to the end at once
      reset();
      frozen = true;
      for (let i = 0; i < 4000 && doneAt === null; i++) advance(0.05);
    }

    function draw(ctx, w, h) {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, w, h);
      const X = (n) => n.x * w;
      const Y = (n) => n.y * h;

      ctx.strokeStyle = `rgba(${GREEN},0.13)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        for (const j of neighbours[i]) {
          if (j > i) { ctx.moveTo(X(nodes[i]), Y(nodes[i])); ctx.lineTo(X(nodes[j]), Y(nodes[j])); }
        }
      }
      ctx.stroke();

      for (const p of packets) {                       // messages in flight; lost ones fade out partway
        const f = Math.min(1, (clock - p.born) / TRAVEL);
        if (p.lost && f > 0.55) continue;
        const a = nodes[p.from];
        const b = nodes[p.to];
        ctx.fillStyle = p.lost ? "rgba(255,90,90,0.9)" : "rgba(236,255,244,0.95)";
        ctx.beginPath();
        ctx.arc(X(a) + (X(b) - X(a)) * f, Y(a) + (Y(b) - Y(a)) * f, 2.4, 0, TAU);
        ctx.fill();
      }

      for (let i = 0; i < N; i++) {
        const n = nodes[i];
        const hot = informed[i] === 1;
        const age = clock - informedAt[i];
        if (hot && age < 0.7) {
          ctx.strokeStyle = `rgba(${GREEN},${1 - age / 0.7})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(X(n), Y(n), 4 + age * 18, 0, TAU);
          ctx.stroke();
        }
        ctx.fillStyle = hot ? `rgb(${GREEN})` : "#3a5a48";
        ctx.beginPath();
        ctx.arc(X(n), Y(n), hot ? 4.2 : 3.2, 0, TAU);
        ctx.fill();
      }

      const fs = Math.max(11, w * 0.026);
      ctx.textAlign = "left";
      ctx.font = `700 ${fs}px ${MONO}`;
      ctx.fillStyle = "rgba(236,255,244,0.95)";
      ctx.fillText(`${count} of ${N} know the rumor`, 12, fs + 8);
      ctx.font = `${fs * 0.88}px ${MONO}`;
      ctx.fillStyle = "rgba(198,214,204,0.8)";
      ctx.fillText(`messages sent: ${messages}`, 12, fs * 2.2 + 8);
      ctx.fillText(`duplicates: ${delivered ? Math.round((100 * duplicates) / delivered) : 0}% of deliveries`, 12, fs * 3.2 + 8);
      if (t99 !== null) {
        ctx.fillStyle = `rgb(${GREEN})`;
        ctx.fillText(`99% reached at t = ${t99.toFixed(1)}`, 12, fs * 4.2 + 8);
      }
    }

    function setFanout(value) {
      fanout = value;
      buttons.forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.fanout) === value)));
      if (reduceMotion) settle(); else reset();
    }
    buttons.forEach((b) => b.addEventListener("click", () => setFanout(Number(b.dataset.fanout))));

    if (reduceMotion) settle(); else reset();
    let last = null;
    animate(canvas, (ctx, w, h, t) => {
      if (!frozen && last !== null) advance(Math.min(0.05, Math.max(0, t - last)));
      last = t;
      draw(ctx, w, h);
    }, 0);
  }

  // ---------------------------------------------------------------------------
  // 4. Microplastics: an illustration of finding five particle types under the microscope
  // ---------------------------------------------------------------------------
  function microVisual() {
    const canvas = $("#viz-micro");
    const rand = seededRandom(5);
    const TYPES = ["foam", "pellet", "film", "fiber", "fragment"];
    const TYPE_COLOR = { foam: "#ffd24a", pellet: "#4df3ff", film: "#ff6ad5", fiber: "#3dff8f", fragment: "#ff8a4d" };
    const BODY = ["#d9443f", "#2f6fdb", "#1d1d1f", "#e8c13b", "#3aa76d", "#f2f2f2", "#8a5cd6"];
    const body = () => BODY[Math.floor(rand() * BODY.length)];

    function shape(type, cx, cy) {
      const pts = [];
      const extra = {};
      const rot = rand() * TAU;
      const rotate = (x, y) => [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)];
      if (type === "fiber") {                          // a thin curved line
        const len = 0.11 + rand() * 0.14;
        const bend = (rand() - 0.5) * 0.14;
        for (let k = 0; k <= 10; k++) {
          const u = k / 10 - 0.5;
          pts.push(rotate(u * len, bend * Math.sin(u * Math.PI * 1.4)));
        }
      } else if (type === "pellet") {                  // a smooth little bead
        const r0 = 0.04 + rand() * 0.02;
        for (let k = 0; k < 14; k++) {
          const a = (k / 14) * TAU;
          pts.push(rotate(Math.cos(a) * r0 * 1.1, Math.sin(a) * r0 * (0.92 + rand() * 0.06)));
        }
      } else if (type === "film") {                    // a thin, wide, wrinkled sheet
        const rx = 0.09 + rand() * 0.05;
        const ry = 0.04 + rand() * 0.025;
        for (let k = 0; k < 9; k++) {
          const a = (k / 9) * TAU;
          const j = 0.8 + rand() * 0.4;
          pts.push(rotate(Math.cos(a) * rx * j, Math.sin(a) * ry * j));
        }
        extra.creases = [0, 1, 2].map(() => [rotate((rand() - 0.5) * rx, (rand() - 0.5) * ry), rotate((rand() - 0.5) * rx, (rand() - 0.5) * ry)]);
      } else if (type === "foam") {                    // a puffy blob full of tiny pores
        const r0 = 0.05 + rand() * 0.03;
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * TAU;
          pts.push(rotate(Math.cos(a) * r0 * (0.82 + rand() * 0.36), Math.sin(a) * r0 * (0.82 + rand() * 0.36)));
        }
        extra.pores = Array.from({ length: 7 }, () => {
          const a = rand() * TAU;
          const d = Math.sqrt(rand()) * r0 * 0.6;
          return [cx + Math.cos(a) * d, cy + Math.sin(a) * d, 0.006 + rand() * 0.008];
        });
      } else {                                         // fragment: a sharp, angular chip
        const sides = 5 + Math.floor(rand() * 3);
        const r0 = 0.04 + rand() * 0.04;
        for (let k = 0; k < sides; k++) {
          const a = (k / sides) * TAU;
          pts.push(rotate(Math.cos(a) * r0 * (0.5 + rand() * 0.6), Math.sin(a) * r0 * (0.5 + rand() * 0.6)));
        }
      }
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      return { type, pts, color: body(), ...extra, minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
    }

    // 15 particles, three of each type, spread out so they do not overlap
    const particles = [];
    const order = TYPES.flatMap((t) => [t, t, t]).sort(() => rand() - 0.5);
    for (const type of order) {
      let cx = 0;
      let cy = 0;
      for (let tries = 0; tries < 80; tries++) {
        const a = rand() * TAU;
        const r = Math.sqrt(rand()) * 0.76;
        cx = Math.cos(a) * r;
        cy = Math.sin(a) * r;
        if (particles.every((p) => Math.hypot(p.cx - cx, p.cy - cy) > 0.2)) break;
      }
      particles.push({ ...shape(type, cx, cy), cx, cy });
    }
    particles.sort((a, b) => a.minX - b.minX);
    const specks = Array.from({ length: 140 }, () => {
      const a = rand() * TAU;
      const r = Math.sqrt(rand());
      return [Math.cos(a) * r, Math.sin(a) * r, 0.4 + rand() * 1.2];
    });

    animate(canvas, (ctx, w, h, t) => {
      const R = Math.min(w, h) * 0.46;
      const cx = w / 2;
      const cy = h / 2;
      const P = (p) => [cx + p[0] * R, cy + p[1] * R];
      const trace = (pts, close) => {
        ctx.beginPath();
        pts.forEach((pt, i) => { const [x, y] = P(pt); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        if (close) ctx.closePath();
      };
      const LOOP = 9;
      const SWEEP = 6;
      const c = t % LOOP;
      const scan = -1 + 2 * Math.min(1, c / SWEEP);

      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, TAU);
      ctx.clip();
      const field = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R);
      field.addColorStop(0, "#dfe6ea");
      field.addColorStop(1, "#a9b6be");
      ctx.fillStyle = field;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(90,100,110,0.22)";
      for (const [x, y, r] of specks) { ctx.beginPath(); ctx.arc(cx + x * R, cy + y * R, r, 0, TAU); ctx.fill(); }

      for (const p of particles) {                     // the particles themselves, each drawn like its type
        if (p.type === "fiber") {
          trace(p.pts, false);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(2.5, R * 0.022);
          ctx.lineCap = "round";
          ctx.stroke();
        } else if (p.type === "film") {
          trace(p.pts, true);
          ctx.fillStyle = "rgba(225,235,245,0.62)";
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.9)";
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.strokeStyle = "rgba(90,110,130,0.55)";
          for (const [a, b] of p.creases) {
            const [x1, y1] = P(a);
            const [x2, y2] = P(b);
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
          }
        } else if (p.type === "foam") {
          trace(p.pts, true);
          ctx.fillStyle = "#efe6c8";
          ctx.fill();
          ctx.strokeStyle = "rgba(120,105,70,0.7)";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = "rgba(130,115,80,0.5)";
          for (const [x, y, r] of p.pores) { ctx.beginPath(); ctx.arc(cx + x * R, cy + y * R, r * R, 0, TAU); ctx.fill(); }
        } else if (p.type === "pellet") {
          trace(p.pts, true);
          ctx.fillStyle = p.color;
          ctx.fill();
          const [hx, hy] = P([p.cx - 0.012, p.cy - 0.014]);
          ctx.fillStyle = "rgba(255,255,255,0.65)";
          ctx.beginPath(); ctx.arc(hx, hy, R * 0.012, 0, TAU); ctx.fill();
        } else {
          trace(p.pts, true);
          ctx.fillStyle = p.color;
          ctx.fill();
        }
      }

      const found = Object.fromEntries(TYPES.map((type) => [type, 0]));
      let total = 0;
      for (const p of particles) {                     // detections appear as the scan passes
        if (p.minX > scan) continue;
        total++;
        found[p.type]++;
        const color = TYPE_COLOR[p.type];
        trace(p.pts, p.type !== "fiber");
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
        const [bx, by] = P([p.minX, p.minY]);
        const [ex, ey] = P([p.maxX, p.maxY]);
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bx - 4, by - 4, ex - bx + 8, ey - by + 8);
        ctx.fillStyle = color;
        ctx.font = `700 ${Math.max(9, R * 0.072)}px ${MONO}`;
        ctx.textAlign = "left";
        ctx.fillText(p.type, bx - 4, by - 8);
      }

      if (c < SWEEP) {                                 // the scan line
        const x = cx + scan * R;
        ctx.save();
        ctx.shadowColor = `rgb(${GREEN})`;
        ctx.shadowBlur = 12;
        ctx.strokeStyle = `rgba(${GREEN},0.95)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, cy - R);
        ctx.lineTo(x, cy + R);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();

      ctx.strokeStyle = "#1b2a22";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, TAU);
      ctx.stroke();

      const fs = Math.max(10.5, w * 0.026);
      ctx.textAlign = "left";
      ctx.font = `700 ${fs}px ${MONO}`;
      ctx.fillStyle = "rgba(236,255,244,0.95)";
      ctx.fillText(`particles found: ${total}`, 12, fs + 8);
      ctx.textAlign = "right";
      ctx.font = `${fs * 0.95}px ${MONO}`;
      const legendWidth = ctx.measureText("fragment 3").width;
      TYPES.forEach((type, i) => {                     // a live count for each type
        const y = fs * 2.3 + 8 + i * fs * 1.45;
        ctx.fillStyle = TYPE_COLOR[type];
        ctx.fillRect(w - 12 - legendWidth - fs * 1.1, y - fs * 0.62, fs * 0.7, fs * 0.7);
        ctx.fillStyle = "rgba(236,255,244,0.9)";
        ctx.fillText(`${type} ${found[type]}`, w - 12, y);
      });
    }, 7);
  }

  // ---------------------------------------------------------------------------
  // 5. Health dashboard: an illustration of the layout (seven provinces, twelve indicators)
  // ---------------------------------------------------------------------------
  function dashVisual() {
    const canvas = $("#viz-dash");
    animate(canvas, (ctx, w, h, t) => {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, w, h);
      const fs = Math.max(10, w * 0.026);
      ctx.fillStyle = "rgba(236,255,244,0.92)";
      ctx.font = `700 ${fs}px ${MONO}`;
      ctx.textAlign = "left";
      ctx.fillText("12 indicators · 7 provinces", w * 0.05, h * 0.12);

      const mx = w * 0.05;
      const my = h * 0.2;
      const mw = w * 0.56;
      const mh = h * 0.62;
      for (let i = 0; i < 7; i++) {                    // seven columns, one per province
        const cw = mw / 7;
        const v = 0.5 + 0.5 * Math.sin(t * 0.9 + i * 1.3);
        const bar = mh * (0.3 + 0.62 * v);
        ctx.fillStyle = `rgba(${GREEN},${0.28 + 0.62 * v})`;
        ctx.beginPath();
        ctx.roundRect(mx + i * cw + 2, my + mh - bar, cw - 4, bar, [4, 4, 0, 0]);
        ctx.fill();
        ctx.fillStyle = "rgba(125,149,135,0.95)";
        ctx.font = `${fs * 0.8}px ${MONO}`;
        ctx.textAlign = "center";
        ctx.fillText(`P${i + 1}`, mx + i * cw + cw / 2, my + mh + fs * 1.2);
      }

      const gx = w * 0.66;
      const gy = h * 0.2;
      const tw = (w * 0.29) / 3;
      const th = (h * 0.66) / 4;
      for (let k = 0; k < 12; k++) {                   // twelve small indicator tiles
        const x = gx + (k % 3) * (tw + 4);
        const y = gy + Math.floor(k / 3) * (th + 4);
        ctx.fillStyle = `rgba(${GREEN},0.06)`;
        ctx.strokeStyle = `rgba(${GREEN},0.18)`;
        ctx.beginPath();
        ctx.roundRect(x, y, tw, th, 4);
        ctx.fill();
        ctx.stroke();
        for (let b = 0; b < 5; b++) {
          const v = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.1 + k * 0.8 + b * 0.9));
          const bw = (tw - 14) / 5;
          ctx.fillStyle = k % 4 === 0 ? "#4df3ff" : `rgba(${GREEN},0.9)`;
          ctx.fillRect(x + 7 + b * bw + 1, y + th - 6 - (th - 14) * v, bw - 3, (th - 14) * v);
        }
      }
    }, 3);
  }

  ladderVisual();
  quakeExplorer();
  gossipVisual();
  microVisual();
  dashVisual();
})();
