"use strict";

// Page behaviour: prayer flags, wire ridges, typing, the status bar, scrolling, tabs and reveals.
// neural.js (the hero) and visuals.js (the project visuals) reuse the helpers defined here.

const $ = (selector) => document.querySelector(selector);
const SVG_NS = "http://www.w3.org/2000/svg";
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// A tiny seeded random generator (mulberry32), so the mountains look the same on every visit.
function seededRandom(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function svgEl(name, attrs = {}) {
  const el = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  return el;
}

// Midpoint displacement: start with a flat line, then repeatedly nudge each midpoint up or down by a
// shrinking random amount. Smaller "rough" means smoother hills. Returns 129 heights, roughly 0 to 1,
// and each bump adds one big peak at a position (0 to 1) along the range.
function ridgeHeights(seed, rough, bumps = []) {
  const rand = seededRandom(seed);
  const n = 128;
  const h = new Array(n + 1).fill(0);
  h[0] = rand() - 0.5;
  h[n] = rand() - 0.5;
  let scale = 1;
  for (let step = n; step > 1; step /= 2) {
    const half = step / 2;
    for (let i = half; i < n; i += step) {
      h[i] = (h[i - half] + h[i + half]) / 2 + (rand() - 0.5) * scale;
    }
    scale *= rough;
  }
  const lo = Math.min(...h);
  const hi = Math.max(...h);
  return h.map((value, i) => {
    let level = (value - lo) / (hi - lo);
    for (const b of bumps) level += b.h * Math.exp(-((i / n - b.at) ** 2) / (2 * b.w * b.w));
    return level;
  });
}

// ---------- wire ridges: a mountain drawn as a tiny neural network ----------
function wireRidge({ seed, width = 1440, height = 100, backAmp = 62, frontAmp = 38 }) {
  const svg = svgEl("svg", { class: "wire", viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: "xMidYMax slice" });
  const line = (heights, count, base, amp) => Array.from({ length: count }, (_, j) => {
    const along = j / (count - 1);
    return [along * width, height - (base + amp * heights[Math.round(along * 128)])];
  });
  const back = line(ridgeHeights(seed, 0.55), 34, 14, backAmp);
  const front = line(ridgeHeights(seed + 50, 0.5), 26, 2, frontAmp);

  for (const [x, y] of back) {                          // each back node reaches for its nearest front node
    const near = front.reduce((best, f) => (Math.abs(f[0] - x) < Math.abs(best[0] - x) ? f : best), front[0]);
    svg.appendChild(svgEl("line", { class: "link", x1: x.toFixed(1), y1: y.toFixed(1), x2: near[0].toFixed(1), y2: near[1].toFixed(1) }));
  }
  const poly = (points, cls) => svg.appendChild(svgEl("polyline", { class: cls, points: points.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ") }));
  poly(back, "back");
  poly(front, "front");
  for (const [x, y] of back) svg.appendChild(svgEl("circle", { class: "n-back", cx: x.toFixed(1), cy: y.toFixed(1), r: 1.7 }));
  for (const [x, y] of front) svg.appendChild(svgEl("circle", { class: "n-front", cx: x.toFixed(1), cy: y.toFixed(1), r: 2 }));
  return svg;
}

function buildRidges() {
  for (const el of document.querySelectorAll(".ridge")) {
    el.appendChild(wireRidge({ seed: Number(el.dataset.seed) }));
  }
  $("#footer-ridge").appendChild(wireRidge({ seed: 61, height: 180, backAmp: 120, frontAmp: 70 }));
}

// ---------- prayer flags ----------
// A string sagging between three points (a quadratic curve) with flags hanging from it in the
// traditional order: blue, white, red, green, yellow.
const FLAG_COLORS = ["#2f6fdb", "#f4f4f2", "#e0443e", "#2e9b57", "#f2c230"];

function flagString(svg, { p0, p1, p2, count, flagW, flagH, seed }) {
  const pointAt = (t) => [0, 1].map((i) => (1 - t) * (1 - t) * p0[i] + 2 * (1 - t) * t * p1[i] + t * t * p2[i]);
  svg.appendChild(svgEl("path", { class: "string", d: `M${p0[0]},${p0[1]} Q${p1[0]},${p1[1]} ${p2[0]},${p2[1]}` }));
  const rand = seededRandom(seed);
  for (let i = 0; i < count; i++) {
    const [x, y] = pointAt((i + 0.5) / count);
    const flag = svgEl("rect", {
      class: "flag",
      x: (x - flagW / 2).toFixed(1),
      y: y.toFixed(1),
      width: flagW,
      height: flagH,
      rx: 1.5,
      fill: FLAG_COLORS[i % FLAG_COLORS.length],
    });
    flag.style.animationDelay = `${(-rand() * 3).toFixed(2)}s`;
    svg.appendChild(flag);
  }
}

function buildHeroFlags() {
  const svg = $("#flags");
  const w = svg.clientWidth;
  const h = svg.clientHeight;
  if (!w) return;
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.replaceChildren();
  flagString(svg, { p0: [-10, 16], p1: [w / 2, 104], p2: [w + 10, 44], count: Math.max(8, Math.round(w / 36)), flagW: 22, flagH: 17, seed: 3 });
}

function buildBunting() {
  for (const svg of document.querySelectorAll(".bunting")) {
    const count = Number(svg.dataset.flags || 7);
    const w = count * 24 + 10;
    svg.setAttribute("viewBox", `0 0 ${w} 40`);
    svg.setAttribute("width", w);
    svg.setAttribute("height", 40);
    flagString(svg, { p0: [0, 4], p1: [w / 2, 24], p2: [w, 4], count, flagW: 16, flagH: 13, seed: count * 7 });
  }
}

// ---------- hero: typed tagline and status bar ----------
function typeTagline() {
  const full = $("#tagline-full");
  const typed = $("#tagline-typed");
  if (reduceMotion) return;
  const text = full.textContent.trim();
  full.classList.add("sr-only");                        // screen readers get the whole sentence at once
  typed.hidden = false;
  let i = 0;
  const tick = () => {
    typed.textContent = text.slice(0, ++i);
    if (i < text.length) setTimeout(tick, 20 + Math.random() * 32);
  };
  setTimeout(tick, 1000);
}

function timeAgo(ms) {
  const minutes = Math.max(1, Math.round((Date.now() - ms) / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hours ago`;
  return `${Math.round(hours / 24)} days ago`;
}

function tickClock() {
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/New_York", timeZoneName: "short",
  }).format(new Date());
  $("#clock").textContent = `Lexington, VA ${time}`;
}

// The public repo I pushed to most recently (GitHub's repo list is current; its activity feed lags behind).
// Private repos never show up here. If GitHub is unreachable the line stays hidden.
async function showLastPush() {
  try {
    const response = await fetch("https://api.github.com/users/SulavSapkota2060/repos?sort=pushed&direction=desc&per_page=1");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const [repo] = await response.json();
    if (!repo || !/^[\w.-]+$/.test(repo.name)) return;
    const link = document.createElement("a");
    link.href = `https://github.com/SulavSapkota2060/${repo.name}`;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = repo.name;
    const line = $("#lastpush");
    line.replaceChildren(document.createTextNode("last push: "), link, document.createTextNode(`, ${timeAgo(Date.parse(repo.pushed_at))}`));
    line.hidden = false;
  } catch (err) {
    // no network or rate-limited: nothing to show
  }
}

// ---------- scrolling: nav, the altimeter, and a gust through the flags ----------
// The altimeter climbs from Kathmandu to the summit of Everest as you scroll down the page.
const KATHMANDU_M = 1400;
const EVEREST_M = 8849;
const MILESTONES = [
  [1400, "Kathmandu"],
  [3440, "Namche Bazaar"],
  [3867, "Tengboche"],
  [4940, "Lobuche"],
  [5364, "Everest Base Camp"],
  [8849, "Summit of Everest"],
];

let gustTimer;
function updateOnScroll() {
  const y = window.scrollY;
  const heroHeight = $("#top").offsetHeight;
  $("#nav").classList.toggle("show", y > heroHeight - 80);

  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const progress = maxScroll > 0 ? Math.min(1, Math.max(0, y / maxScroll)) : 0;
  const metres = Math.round(KATHMANDU_M + progress * (EVEREST_M - KATHMANDU_M));
  $("#alt-m").textContent = metres.toLocaleString("en-US");
  const here = MILESTONES.filter(([m]) => metres >= m).pop();
  $("#alt-place").textContent = here ? here[1] : "";
  $("#altimeter").classList.toggle("show", y > 40);

  if (!reduceMotion && y < heroHeight) {
    $("#flags").classList.add("gust");
    clearTimeout(gustTimer);
    gustTimer = setTimeout(() => $("#flags").classList.remove("gust"), 600);
  }
}

let waiting = false;
window.addEventListener("scroll", () => {
  if (waiting) return;
  waiting = true;
  requestAnimationFrame(() => {
    updateOnScroll();
    waiting = false;
  });
}, { passive: true });

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    buildHeroFlags();
    updateOnScroll();
  }, 150);
});

// ---------- tabs, reveal on scroll, card tilt, current nav link ----------
// Each .tabs group lists every panel it controls (data-all); each tab says which ones to show (data-show).
function setupTabs() {
  for (const group of document.querySelectorAll(".tabs")) {
    const all = group.dataset.all.split(",");
    const buttons = [...group.querySelectorAll(".tab")];
    for (const button of buttons) {
      button.addEventListener("click", () => {
        const show = button.dataset.show.split(",");
        for (const id of all) {
          const panel = document.getElementById(id);
          if (panel) panel.hidden = !show.includes(id);
        }
        buttons.forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      });
    }
  }
}

function setupReveal() {
  const items = [...document.querySelectorAll(".reveal")];
  items.forEach((el) => {
    const siblings = [...el.parentElement.children].filter((c) => c.classList.contains("reveal"));
    el.style.setProperty("--i", Math.max(0, siblings.indexOf(el)) % 4);
  });
  if (reduceMotion || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("in"));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        observer.unobserve(entry.target);
      }
    }
  }, { threshold: 0.12 });
  items.forEach((el) => observer.observe(el));
}

function setupTilt() {
  if (reduceMotion || !window.matchMedia("(hover: hover)").matches) return;
  for (const card of document.querySelectorAll(".project")) {
    card.addEventListener("pointermove", (event) => {
      const box = card.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width;
      const y = (event.clientY - box.top) / box.height;
      card.style.setProperty("--ry", `${((x - 0.5) * 4).toFixed(2)}deg`);
      card.style.setProperty("--rx", `${((0.5 - y) * 3).toFixed(2)}deg`);
      card.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
      card.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
    });
    card.addEventListener("pointerleave", () => {
      card.style.removeProperty("--rx");
      card.style.removeProperty("--ry");
    });
  }
}

function setupNavHighlight() {
  if (!("IntersectionObserver" in window)) return;
  const links = new Map([...document.querySelectorAll(".nav ul a")].map((a) => [a.getAttribute("href").slice(1), a]));
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      links.forEach((a) => a.classList.remove("current"));
      const link = links.get(entry.target.id);
      if (link) link.classList.add("current");
    }
  }, { rootMargin: "-40% 0px -55% 0px" });
  for (const id of links.keys()) {
    const section = document.getElementById(id);
    if (section) observer.observe(section);
  }
}

buildRidges();
buildHeroFlags();
buildBunting();
setupTabs();
setupReveal();
setupTilt();
setupNavHighlight();
typeTagline();
tickClock();
setInterval(tickClock, 15000);
showLastPush();
updateOnScroll();
