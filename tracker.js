// Reading-progress tracking. Per the requirement this uses cookies only
// (no database, no localStorage). Everything lives in a single JSON cookie.

const COOKIE_NAME = "hstk_progress";
const COOKIE_DAYS = 365;

function setCookie(name, value, days) {
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie =
    name +
    "=" +
    encodeURIComponent(value) +
    ";expires=" +
    d.toUTCString() +
    ";path=/;SameSite=Lax";
}

function getCookie(name) {
  const target = name + "=";
  const parts = document.cookie.split(";");
  for (let c of parts) {
    c = c.trim();
    if (c.indexOf(target) === 0) {
      return decodeURIComponent(c.substring(target.length));
    }
  }
  return null;
}

// Shape: { read: {chapterId: true}, last: {chapter, page}, updated }
function loadProgress() {
  const raw = getCookie(COOKIE_NAME);
  if (!raw) return { read: {}, last: null, updated: null };
  try {
    const data = JSON.parse(raw);
    return {
      read: data.read || {},
      last: data.last || null,
      updated: data.updated || null,
    };
  } catch (e) {
    return { read: {}, last: null, updated: null };
  }
}

function saveProgress(progress) {
  progress.updated = Date.now();
  setCookie(COOKIE_NAME, JSON.stringify(progress), COOKIE_DAYS);
}

function markChapterRead(chapterId) {
  const p = loadProgress();
  p.read[chapterId] = true;
  saveProgress(p);
}

function isChapterRead(chapterId) {
  const p = loadProgress();
  return !!p.read[chapterId];
}

function setLastPosition(chapterId, page) {
  const p = loadProgress();
  p.last = { chapter: Number(chapterId), page: Number(page) };
  saveProgress(p);
}

function getLastPosition() {
  return loadProgress().last;
}

function clearProgress() {
  setCookie(COOKIE_NAME, JSON.stringify({ read: {}, last: null }), -1);
}

function readCount() {
  return Object.keys(loadProgress().read).length;
}

// --- Manual bookmark ("tag"): a single, user-picked spot anchored to a text
// selection, independent of the auto-tracked last-read position above. ---
const TAG_COOKIE = "hstk_tag";

function setTag(tag) {
  setCookie(TAG_COOKIE, JSON.stringify(tag), COOKIE_DAYS);
}

function getTag() {
  const raw = getCookie(TAG_COOKIE);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function clearTag() {
  setCookie(TAG_COOKIE, "", -1);
}

// --- Reading font size (separate cookie) ---
const FONT_COOKIE = "hstk_fontsize";
const FONT_MIN = 14;
const FONT_MAX = 30;
const FONT_DEFAULT = 18;

function getFontSize() {
  const v = parseInt(getCookie(FONT_COOKIE), 10);
  return v >= FONT_MIN && v <= FONT_MAX ? v : FONT_DEFAULT;
}

function setFontSize(px) {
  const clamped = Math.max(FONT_MIN, Math.min(FONT_MAX, px));
  setCookie(FONT_COOKIE, String(clamped), COOKIE_DAYS);
  return clamped;
}
