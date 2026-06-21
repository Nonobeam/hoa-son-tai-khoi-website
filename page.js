// Generates a webtoon-style placeholder "page" as an inline SVG data URI.
// Real readers swap this for actual hosted image URLs; here we render
// deterministic art so the site is fully self-contained and offline-friendly.

const PAGE_PALETTES = [
  ["#1f2937", "#374151", "#9ca3af"],
  ["#312e81", "#4338ca", "#a5b4fc"],
  ["#7c2d12", "#b45309", "#fcd34d"],
  ["#064e3b", "#047857", "#6ee7b7"],
  ["#4c1d95", "#7e22ce", "#d8b4fe"],
  ["#7f1d1d", "#b91c1c", "#fca5a5"],
];

// Simple deterministic hash so the same chapter/page always looks identical.
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makePageDataUri(chapterNum, pageNum) {
  const W = 800;
  const H = 1130;
  const seed = hash(`${chapterNum}-${pageNum}`);
  const rnd = mulberry32(seed);
  const pal = PAGE_PALETTES[seed % PAGE_PALETTES.length];

  // A few comic-style panels with abstract silhouettes.
  let panels = "";
  const rows = 2 + (seed % 2); // 2 or 3 panels
  const gap = 18;
  const pad = 24;
  const usableH = H - pad * 2 - gap * (rows - 1);
  let y = pad;
  for (let r = 0; r < rows; r++) {
    const ph = usableH / rows;
    const fill = pal[r % pal.length];
    panels += `<rect x="${pad}" y="${y}" width="${W - pad * 2}" height="${ph}" rx="6" fill="${fill}"/>`;
    // scatter a couple of accent shapes inside the panel
    const shapes = 2 + Math.floor(rnd() * 3);
    for (let s = 0; s < shapes; s++) {
      const cx = pad + 40 + rnd() * (W - pad * 2 - 80);
      const cy = y + 30 + rnd() * (ph - 60);
      const rr = 16 + rnd() * 70;
      const accent = pal[2];
      const op = (0.12 + rnd() * 0.22).toFixed(2);
      if (rnd() > 0.5) {
        panels += `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${rr.toFixed(0)}" fill="${accent}" opacity="${op}"/>`;
      } else {
        panels += `<rect x="${(cx - rr).toFixed(0)}" y="${(cy - rr).toFixed(0)}" width="${(rr * 2).toFixed(0)}" height="${(rr * 1.4).toFixed(0)}" fill="${accent}" opacity="${op}" transform="rotate(${(rnd() * 30 - 15).toFixed(1)} ${cx.toFixed(0)} ${cy.toFixed(0)})"/>`;
      }
    }
    y += ph + gap;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#0b0e14"/>
    ${panels}
    <text x="${W / 2}" y="64" text-anchor="middle" font-family="Georgia, serif" font-size="34" fill="#ffffff" opacity="0.92">Hoa Sơn Tái Khởi</text>
    <text x="${W / 2}" y="${H - 40}" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="#ffffff" opacity="0.7">Chương ${chapterNum} · Trang ${pageNum}</text>
  </svg>`;

  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
