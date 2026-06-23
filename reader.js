// Reader with infinite scroll. Chapters are either text (HTML fragment in
// content/<num>.html) or scanned images (content/img/<num>/*.jpg). When the
// reader scrolls past ~80% of the loaded content, the next chapter is fetched
// and appended below — continuous reading, no "next page" click. Progress is
// persisted to cookies (tracker.js).

(function () {
  const reader = document.getElementById("reader");
  const progressBar = document.getElementById("readProgress");
  const nowReading = document.getElementById("nowReading");
  const toTop = document.getElementById("toTop");
  const prevBtn = document.getElementById("prevBtn");
  const menuBtn = document.getElementById("menuBtn");
  const drawer = document.getElementById("drawer");
  const drawerOverlay = document.getElementById("drawerOverlay");
  const drawerClose = document.getElementById("drawerClose");
  const drawerSearch = document.getElementById("drawerSearch");
  const drawerList = document.getElementById("drawerList");
  const tagPopup = document.getElementById("tagPopup");
  const tagToast = document.getElementById("tagToast");

  const params = new URLSearchParams(location.search);
  const wantChapter = Number(params.get("chapter"));
  const startPage = Number(params.get("page")) || 0;

  const APPEND_THRESHOLD = 0.8; // append next chapter at 80% scroll of loaded content
  let loaded = []; // chapter numbers in render order
  let appending = false;
  let currentVisible = null;

  // --- Build the DOM for one chapter and append it ---
  async function renderChapter(ch, isFirst) {
    const block = document.createElement("section");
    block.className = "chapter-block";
    block.dataset.chapter = ch.num;

    const heading = document.createElement("div");
    heading.className = "chapter-heading";
    heading.textContent = ch.title;
    block.appendChild(heading);

    if (ch.type === "image") {
      ch.files.forEach((fn, i) => {
        const img = document.createElement("img");
        img.className = "page-img";
        img.loading = "lazy";
        img.alt = `${ch.title} - trang ${i + 1}`;
        img.dataset.chapter = ch.num;
        img.dataset.page = i + 1;
        img.src = `content/img/${ch.num}/${fn}`;
        block.appendChild(img);
      });
    } else {
      const body = document.createElement("article");
      body.className = "chapter-text";
      body.dataset.chapter = ch.num;
      try {
        const res = await fetch(`content/${ch.num}.html`);
        body.innerHTML = res.ok
          ? await res.text()
          : `<p class="end-note">Không tải được nội dung chương ${ch.num}.</p>`;
      } catch (e) {
        body.innerHTML = `<p class="end-note">Lỗi tải chương ${ch.num}.</p>`;
      }
      block.appendChild(body);
    }

    reader.appendChild(block);
    loaded.push(ch.num);
  }

  function removeFooter() {
    const f = document.getElementById("reader-footer");
    if (f) f.remove();
  }

  function renderFooter() {
    removeFooter();
    const next = getNextChapter(loaded[loaded.length - 1]);
    const footer = document.createElement("div");
    footer.id = "reader-footer";
    if (next) {
      footer.className = "loader";
      footer.innerHTML = `<div class="spinner"></div>Đang tải ${next.title.split("—")[0].trim()}…`;
    } else {
      footer.className = "end-note";
      footer.innerHTML =
        `🎉 Bạn đã đọc tới chương mới nhất hiện có.<br/>` +
        `<a class="btn btn-ghost" style="margin-top:14px" href="index.html">Về mục lục</a>`;
    }
    reader.appendChild(footer);
  }

  async function appendNextChapter() {
    if (appending) return;
    const next = getNextChapter(loaded[loaded.length - 1]);
    if (!next) return;
    appending = true;
    removeFooter();
    const loading = document.createElement("div");
    loading.id = "reader-footer";
    loading.className = "loader";
    loading.innerHTML = `<div class="spinner"></div>Đang tải ${next.title.split("—")[0].trim()}…`;
    reader.appendChild(loading);

    await renderChapter(next, false);
    renderFooter();
    appending = false;
    maybeAppend(); // tall viewport may need another
  }

  function maybeAppend() {
    if (appending) return;
    const doc = document.documentElement;
    const scrollBottom = window.scrollY + window.innerHeight;
    const total = doc.scrollHeight;
    if (total > 0 && scrollBottom >= total * APPEND_THRESHOLD) {
      appendNextChapter();
    }
  }

  function updateReadingState() {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const pct = max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0;
    progressBar.style.width = pct + "%";
    toTop.classList.toggle("show", window.scrollY > 800);

    const blocks = reader.querySelectorAll(".chapter-block");
    const probe = window.scrollY + window.innerHeight * 0.35;
    let visible = currentVisible;
    blocks.forEach((b) => {
      if (b.offsetTop <= probe) visible = Number(b.dataset.chapter);
    });

    if (visible !== currentVisible && visible != null) {
      markEarlierRead(visible);
      currentVisible = visible;
      nowReading.textContent = chapterLabel(visible);
      updateNav();
    }

    const pos = approxVisiblePage();
    if (pos) setLastPosition(pos.chapter, pos.page);
  }

  function chapterLabel(num) {
    const ch = getChapter(num);
    return ch ? `Chương ${num}` : "";
  }

  function markEarlierRead(newChapter) {
    const idx = chapterIndex(newChapter);
    for (let i = 0; i < idx; i++) {
      if (loaded.includes(CHAPTERS[i].num)) markChapterRead(CHAPTERS[i].num);
    }
  }

  function approxVisiblePage() {
    const center = window.scrollY + window.innerHeight * 0.4;
    const imgs = reader.querySelectorAll(".page-img");
    let best = null;
    imgs.forEach((img) => {
      if (img.offsetTop <= center)
        best = { chapter: Number(img.dataset.chapter), page: Number(img.dataset.page) };
    });
    // for text chapters, fall back to the chapter currently in view
    if (!best && currentVisible != null) best = { chapter: currentVisible, page: 1 };
    return best;
  }

  function markFinalIfAtEnd() {
    const doc = document.documentElement;
    if (window.scrollY + window.innerHeight >= doc.scrollHeight - 60) {
      const lastId = loaded[loaded.length - 1];
      if (!getNextChapter(lastId)) markChapterRead(lastId);
    }
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateReadingState();
      maybeAppend();
      markFinalIfAtEnd();
      ticking = false;
    });
  }

  toTop.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });

  // --- Reading font size (persisted in a cookie) ---
  const fontDown = document.getElementById("fontDown");
  const fontUp = document.getElementById("fontUp");
  function applyFontSize() {
    const px = getFontSize();
    document.documentElement.style.setProperty("--reader-font", px + "px");
  }
  function changeFont(delta) {
    const next = setFontSize(getFontSize() + delta);
    document.documentElement.style.setProperty("--reader-font", next + "px");
  }
  fontDown.onclick = () => changeFont(-1);
  fontUp.onclick = () => changeFont(1);

  // --- Previous-chapter navigation (relative to the chapter in view) ---
  function goToChapter(num) {
    // Record the deliberate jump first so a later reload resumes here, instead
    // of the (possibly later) chapter the cookie was last advanced to.
    setLastPosition(num, 1);
    location.href = `reader.html?chapter=${num}`;
  }
  function updateNav() {
    const prev = getPrevChapter(currentVisible);
    prevBtn.disabled = !prev;
    prevBtn.style.opacity = prev ? "1" : "0.4";
    prevBtn.title = prev ? `Chương ${prev.num}` : "Đã ở chương đầu";
    updateDrawerActive();
  }
  prevBtn.onclick = () => {
    const prev = getPrevChapter(currentVisible);
    if (prev) goToChapter(prev.num);
  };

  // --- Chapter drawer (table of contents) ---
  function buildDrawer() {
    const frag = document.createDocumentFragment();
    CHAPTERS.forEach((ch) => {
      const item = document.createElement("div");
      item.className = "drawer-item" + (isChapterRead(ch.num) ? " read" : "");
      item.dataset.chapter = ch.num;
      item.textContent = ch.title;
      item.title = ch.title;
      item.onclick = () => {
        if (ch.num === currentVisible) closeDrawer();
        else goToChapter(ch.num);
      };
      frag.appendChild(item);
    });
    drawerList.appendChild(frag);
  }
  function updateDrawerActive() {
    drawerList.querySelectorAll(".drawer-item").forEach((el) => {
      el.classList.toggle("current", Number(el.dataset.chapter) === currentVisible);
    });
  }
  function openDrawer() {
    drawer.classList.add("open");
    drawerOverlay.classList.add("open");
    updateDrawerActive();
    const active = drawerList.querySelector(".drawer-item.current");
    if (active) active.scrollIntoView({ block: "center" });
  }
  function closeDrawer() {
    drawer.classList.remove("open");
    drawerOverlay.classList.remove("open");
  }
  menuBtn.onclick = () =>
    drawer.classList.contains("open") ? closeDrawer() : openDrawer();
  drawerClose.onclick = closeDrawer;
  drawerOverlay.onclick = closeDrawer;
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });
  drawerSearch.addEventListener("input", () => {
    const q = drawerSearch.value.trim().toLowerCase();
    drawerList.querySelectorAll(".drawer-item").forEach((el) => {
      const hay = (el.textContent + " " + el.dataset.chapter).toLowerCase();
      el.style.display = !q || hay.includes(q) ? "" : "none";
    });
  });

  // --- Manual tag (bookmark): user selects text, taps "Đánh dấu", and the
  // exact spot is saved as { chapter, snippet, occurrence }. Anchoring to the
  // selected text (rather than a DOM index) survives reloads since the
  // chapter HTML is static. ---
  let toastTimer = null;
  function showToast(msg) {
    tagToast.textContent = msg;
    tagToast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => tagToast.classList.remove("show"), 2200);
  }

  function buildTextWalk(container) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let fullText = "";
    let node;
    while ((node = walker.nextNode())) {
      nodes.push({ node, start: fullText.length });
      fullText += node.nodeValue;
    }
    return { nodes, fullText };
  }

  function globalOffset(nodes, targetNode, targetOffset) {
    for (const n of nodes) {
      if (n.node === targetNode) return n.start + targetOffset;
    }
    return null;
  }

  function countOccurrencesBefore(fullText, snippet, beforeIndex) {
    let count = 0,
      idx = 0;
    for (;;) {
      idx = fullText.indexOf(snippet, idx);
      if (idx === -1 || idx >= beforeIndex) break;
      count++;
      idx += 1;
    }
    return count;
  }

  function closestChapterText(node) {
    const el = node.nodeType === 1 ? node : node.parentElement;
    return el ? el.closest(".chapter-text") : null;
  }

  function findRangeForOccurrence(container, snippet, occurrence) {
    const { nodes, fullText } = buildTextWalk(container);
    let searchFrom = 0,
      foundIndex = -1;
    for (let i = 0; i <= occurrence; i++) {
      foundIndex = fullText.indexOf(snippet, searchFrom);
      if (foundIndex === -1) return null;
      searchFrom = foundIndex + 1;
    }
    const endIndex = foundIndex + snippet.length;
    const mapIndex = (idx) => {
      for (const n of nodes) {
        if (idx >= n.start && idx <= n.start + n.node.nodeValue.length) {
          return { node: n.node, offset: idx - n.start };
        }
      }
      return null;
    };
    const startPos = mapIndex(foundIndex);
    const endPos = mapIndex(endIndex);
    if (!startPos || !endPos) return null;
    const range = document.createRange();
    range.setStart(startPos.node, startPos.offset);
    range.setEnd(endPos.node, endPos.offset);
    return range;
  }

  function resolveTagRange(tag) {
    const container = reader.querySelector(`.chapter-text[data-chapter="${tag.chapter}"]`);
    if (!container) return null;
    return findRangeForOccurrence(container, tag.snippet, tag.occurrence);
  }

  function scrollToTag(tag, { flash = false } = {}) {
    const range = resolveTagRange(tag);
    if (!range) {
      clearTag();
      return false;
    }
    const rect = range.getBoundingClientRect();
    const target = Math.max(0, window.scrollY + rect.top - window.innerHeight * 0.3);
    window.scrollTo({ top: target, behavior: "auto" });
    if (flash) {
      const span = document.createElement("span");
      span.className = "tag-highlight";
      try {
        range.surroundContents(span);
        setTimeout(() => {
          const parent = span.parentNode;
          if (!parent) return;
          while (span.firstChild) parent.insertBefore(span.firstChild, span);
          parent.removeChild(span);
        }, 1700);
      } catch (e) {
        // Range crosses element boundaries (e.g. spans an <em>); skip the
        // highlight, the scroll above already landed on the right spot.
      }
    }
    return true;
  }

  let pendingRange = null;
  let selectionTimer = null;
  let interactingWithPopup = false;

  function hideTagPopup() {
    tagPopup.classList.remove("show");
    pendingRange = null;
  }

  function handleSelection() {
    if (interactingWithPopup) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      hideTagPopup();
      return;
    }
    const range = sel.getRangeAt(0);
    const container = closestChapterText(range.startContainer);
    const text = sel.toString().trim();
    if (!container || text.length < 2) {
      hideTagPopup();
      return;
    }
    pendingRange = range.cloneRange();
    const rect = range.getBoundingClientRect();
    tagPopup.style.left = rect.left + rect.width / 2 + "px";
    tagPopup.style.top = Math.max(rect.top - 8, 8) + "px";
    tagPopup.classList.add("show");
  }

  document.addEventListener("selectionchange", () => {
    clearTimeout(selectionTimer);
    selectionTimer = setTimeout(handleSelection, 80);
  });
  reader.addEventListener("mouseup", handleSelection);
  reader.addEventListener("touchend", handleSelection);

  // Once the user starts pressing the popup, lock out handleSelection() so a
  // selection collapsing under the tap (native on touch, occasional on
  // desktop) can't null pendingRange before the click/tap is processed.
  function lockPopup(e) {
    e.preventDefault();
    interactingWithPopup = true;
  }
  tagPopup.addEventListener("mousedown", lockPopup);
  tagPopup.addEventListener("touchstart", lockPopup, { passive: false });

  tagPopup.addEventListener("click", () => {
    interactingWithPopup = false;
    if (!pendingRange) return;
    const container = closestChapterText(pendingRange.startContainer);
    if (!container) {
      hideTagPopup();
      return;
    }
    const chapter = Number(container.dataset.chapter);
    const MAX_LEN = 80;
    let snippet = pendingRange.toString().replace(/\s+/g, " ").trim();
    hideTagPopup();
    window.getSelection().removeAllRanges();
    if (!snippet) return;
    if (snippet.length > MAX_LEN) snippet = snippet.slice(0, MAX_LEN);
    const { nodes, fullText } = buildTextWalk(container);
    const startOffset = globalOffset(nodes, pendingRange.startContainer, pendingRange.startOffset);
    const occurrence = startOffset == null ? 0 : countOccurrencesBefore(fullText, snippet, startOffset);
    setTag({ chapter, snippet, occurrence });
    showToast("Đã thêm đánh dấu.");
  });

  async function init() {
    await loadChapters();

    // Where do we resume? The URL's ?chapter is frozen at whatever chapter the
    // reader was opened on — infinite scroll advances the saved cookie position
    // but never the URL. So on a reload (e.g. the browser discarded the tab while
    // you were away) the URL may point "behind" where you actually were.
    // Rule: trust the URL only when it agrees with the saved position OR was an
    // explicit jump (deliberate jumps write the cookie before navigating, see
    // goToChapter). Otherwise the URL is stale → resume from the cookie.
    const last = getLastPosition();
    let ch, page;
    if (wantChapter && getChapter(wantChapter) && (!last || last.chapter === wantChapter)) {
      ch = getChapter(wantChapter);
      page = startPage || (last && last.page) || 1;
    } else if (last && getChapter(last.chapter)) {
      ch = getChapter(last.chapter);
      page = last.page || 1;
    } else {
      ch = getChapter(wantChapter) || CHAPTERS[0];
      page = startPage || 1;
    }
    currentVisible = ch.num;

    await renderChapter(ch, true);
    renderFooter();
    setLastPosition(ch.num, page);
    nowReading.textContent = chapterLabel(ch.num);

    buildDrawer();
    updateNav();
    applyFontSize();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", maybeAppend);

    // The tag is a single saved spot, independent of the auto-tracked last
    // position. It only wins when it's still inside the chapter we're
    // resuming into — if reading has since moved past that chapter, the
    // resumed (further-along) position takes priority over the old tag.
    const tag = getTag();
    if (tag && tag.chapter === ch.num) {
      requestAnimationFrame(() => {
        if (!scrollToTag(tag, { flash: true }) && page > 1) {
          const target = reader.querySelector(
            `.page-img[data-chapter="${ch.num}"][data-page="${page}"]`
          );
          if (target) target.scrollIntoView();
        }
      });
    } else if (page > 1) {
      requestAnimationFrame(() => {
        const target = reader.querySelector(
          `.page-img[data-chapter="${ch.num}"][data-page="${page}"]`
        );
        if (target) target.scrollIntoView();
      });
    }
    setTimeout(maybeAppend, 400); // first chapter shorter than viewport
  }

  init().catch((err) => {
    reader.innerHTML = `<div class="end-note">Lỗi: ${err.message}<br/>Hãy chạy qua server (xem README).</div>`;
  });
})();
