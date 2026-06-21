// Reader with infinite scroll. When the reader scrolls past ~80% of the
// last-loaded chapter, the next chapter is appended below so reading is
// continuous — no "next page" click needed. Progress is saved to cookies.

(function () {
  const reader = document.getElementById("reader");
  const progressBar = document.getElementById("readProgress");
  const nowReading = document.getElementById("nowReading");
  const toTop = document.getElementById("toTop");

  const params = new URLSearchParams(location.search);
  let startChapter = Number(params.get("chapter")) || CHAPTERS[0].id;
  const startPage = Number(params.get("page")) || 0;

  if (!getChapter(startChapter)) startChapter = CHAPTERS[0].id;

  const APPEND_THRESHOLD = 0.8; // append next chapter at 80% of current one
  let loadedChapters = []; // ids in render order
  let appending = false;
  let currentVisibleChapter = startChapter;

  // --- Render a single chapter block ---
  function renderChapter(ch, isFirst) {
    const block = document.createElement("section");
    block.className = "chapter-block";
    block.dataset.chapter = ch.id;

    const heading = document.createElement("div");
    heading.className = isFirst ? "chapter-heading" : "chapter-heading";
    heading.textContent = `${ch.title} — Hoa Sơn Tái Khởi`;
    block.appendChild(heading);

    for (let p = 1; p <= ch.pages; p++) {
      const img = document.createElement("img");
      img.className = "page-img";
      img.loading = "lazy";
      img.alt = `${ch.title} - trang ${p}`;
      img.dataset.chapter = ch.id;
      img.dataset.page = p;
      img.src = makePageDataUri(ch.number, p);
      block.appendChild(img);
    }
    reader.appendChild(block);
    loadedChapters.push(ch.id);
  }

  // --- Loader element shown while waiting for next chapter ---
  function renderLoaderOrEnd() {
    removeFooter();
    const lastId = loadedChapters[loadedChapters.length - 1];
    const next = getNextChapter(lastId);
    const footer = document.createElement("div");
    footer.id = "reader-footer";
    if (next) {
      footer.className = "loader";
      footer.innerHTML =
        `<div class="spinner"></div>Đang tải ${next.title}…`;
    } else {
      footer.className = "end-note";
      footer.innerHTML =
        `🎉 Bạn đã đọc tới chương mới nhất.<br/>` +
        `<a class="btn btn-ghost" style="margin-top:14px" href="index.html">Về mục lục</a>`;
    }
    reader.appendChild(footer);
  }

  function removeFooter() {
    const f = document.getElementById("reader-footer");
    if (f) f.remove();
  }

  // --- Append the next chapter ---
  function appendNextChapter() {
    if (appending) return;
    const lastId = loadedChapters[loadedChapters.length - 1];
    const next = getNextChapter(lastId);
    if (!next) return;

    appending = true;
    removeFooter();
    // tiny delay so the loader is perceptible and layout settles
    setTimeout(() => {
      renderChapter(next, false);
      renderLoaderOrEnd();
      appending = false;
      // a second append may already be needed on very tall screens
      maybeAppend();
    }, 350);
  }

  // --- Decide whether we are near the end and should append ---
  function maybeAppend() {
    if (appending) return;
    const doc = document.documentElement;
    const scrollBottom = window.scrollY + window.innerHeight;
    const total = doc.scrollHeight;
    if (total <= 0) return;
    // append when within (1 - threshold) of the very bottom of loaded content
    if (scrollBottom >= total * APPEND_THRESHOLD) {
      appendNextChapter();
    }
  }

  // --- Track which chapter is currently in view + reading progress ---
  function updateReadingState() {
    // top reading-progress bar across all loaded content
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const pct = max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0;
    progressBar.style.width = pct + "%";

    toTop.classList.toggle("show", window.scrollY > 800);

    // find the chapter block whose top is closest above the viewport center
    const blocks = reader.querySelectorAll(".chapter-block");
    const probe = window.scrollY + window.innerHeight * 0.35;
    let visible = currentVisibleChapter;
    blocks.forEach((b) => {
      if (b.offsetTop <= probe) visible = Number(b.dataset.chapter);
    });

    if (visible !== currentVisibleChapter) {
      // moved into a new chapter -> the previous one is considered read
      onChapterChanged(visible);
    }
    currentVisibleChapter = visible;

    nowReading.textContent = `Chương ${visible}`;

    // save approximate page position for resume
    const visImg = getApproxVisiblePage();
    if (visImg) {
      setLastPosition(visImg.chapter, visImg.page);
    }
  }

  function onChapterChanged(newChapter) {
    // mark every chapter before the new one as fully read
    const idx = CHAPTERS.findIndex((c) => c.id === newChapter);
    for (let i = 0; i < idx; i++) {
      if (loadedChapters.includes(CHAPTERS[i].id)) {
        markChapterRead(CHAPTERS[i].id);
      }
    }
  }

  function getApproxVisiblePage() {
    const center = window.scrollY + window.innerHeight * 0.4;
    const imgs = reader.querySelectorAll(".page-img");
    let best = null;
    imgs.forEach((img) => {
      if (img.offsetTop <= center) {
        best = { chapter: Number(img.dataset.chapter), page: Number(img.dataset.page) };
      }
    });
    return best;
  }

  // --- Mark the last loaded chapter read when user reaches the end ---
  function markFinalIfAtEnd() {
    const doc = document.documentElement;
    if (window.scrollY + window.innerHeight >= doc.scrollHeight - 60) {
      const lastId = loadedChapters[loadedChapters.length - 1];
      // if there's no next chapter, finishing the scroll means it's read
      if (!getNextChapter(lastId)) markChapterRead(lastId);
    }
  }

  // --- Scroll handling (throttled with rAF) ---
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

  // --- Init ---
  function init() {
    const ch = getChapter(startChapter);
    renderChapter(ch, true);
    renderLoaderOrEnd();
    setLastPosition(ch.id, startPage || 1);
    nowReading.textContent = `Chương ${ch.id}`;

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", maybeAppend);

    // jump to requested page after images have a size
    if (startPage > 1) {
      requestAnimationFrame(() => {
        const target = reader.querySelector(
          `.page-img[data-chapter="${startChapter}"][data-page="${startPage}"]`
        );
        if (target) target.scrollIntoView();
      });
    }
    // in case the first chapter is shorter than the viewport
    setTimeout(maybeAppend, 400);
  }

  init();
})();
