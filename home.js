// Home page: renders manga info, the chapter list with read/continue badges,
// and progress summary driven by the cookie-based tracker.

(function () {
  // --- Manga info ---
  document.getElementById("cover").textContent = MANGA.title;
  document.getElementById("title").textContent = MANGA.title;
  document.getElementById("altTitle").textContent = MANGA.altTitle;
  document.getElementById("author").textContent = MANGA.author;
  document.getElementById("status").textContent = MANGA.status;
  document.getElementById("synopsis").textContent = MANGA.synopsis;

  const genresEl = document.getElementById("genres");
  MANGA.genres.forEach((g) => {
    const span = document.createElement("span");
    span.className = "genre";
    span.textContent = g;
    genresEl.appendChild(span);
  });

  // --- Progress summary ---
  function refreshSummary() {
    const total = CHAPTERS.length;
    const read = readCount();
    document.getElementById("readNum").textContent = read;
    document.getElementById("totalNum").textContent = total;
    const pct = total ? Math.round((read / total) * 100) : 0;
    document.getElementById("progressFill").style.width = pct + "%";
    document.getElementById("percentLabel").textContent = pct + "%";
  }

  // --- Resume / continue buttons ---
  function refreshResume() {
    const last = getLastPosition();
    const resumeBtn = document.getElementById("resumeBtn");
    const continueBtn = document.getElementById("continueBtn");
    if (last && getChapter(last.chapter)) {
      const label = `Đọc tiếp · Chương ${last.chapter}`;
      resumeBtn.style.display = "inline-flex";
      resumeBtn.textContent = label;
      resumeBtn.onclick = () => goToChapter(last.chapter, last.page);
      continueBtn.style.display = "inline-block";
      continueBtn.onclick = () => goToChapter(last.chapter, last.page);
    } else {
      resumeBtn.style.display = "none";
      continueBtn.style.display = "none";
    }
  }

  function goToChapter(id, page) {
    let url = `reader.html?chapter=${id}`;
    if (page) url += `&page=${page}`;
    location.href = url;
  }

  // --- Chapter grid ---
  function renderChapters() {
    const grid = document.getElementById("chapterGrid");
    grid.innerHTML = "";
    const last = getLastPosition();
    CHAPTERS.forEach((ch) => {
      const read = isChapterRead(ch.id);
      const isCurrent = last && last.chapter === ch.id && !read;

      const card = document.createElement("div");
      card.className = "chapter-card" + (read ? " read" : "");
      card.onclick = () => goToChapter(ch.id);

      const left = document.createElement("div");
      left.innerHTML =
        `<div class="ch-name">${ch.title}</div>` +
        `<div class="ch-sub">${ch.pages} trang</div>`;

      const right = document.createElement("div");
      if (read) {
        right.innerHTML = `<span class="badge-read">✓ Đã đọc</span>`;
      } else if (isCurrent) {
        right.innerHTML = `<span class="badge-continue">Đang đọc</span>`;
      }

      card.appendChild(left);
      card.appendChild(right);
      grid.appendChild(card);
    });
  }

  // --- Buttons ---
  document.getElementById("startBtn").onclick = () =>
    goToChapter(CHAPTERS[0].id);

  document.getElementById("resetBtn").onclick = () => {
    if (confirm("Xóa toàn bộ lịch sử đọc?")) {
      clearProgress();
      refreshSummary();
      refreshResume();
      renderChapters();
    }
  };

  refreshSummary();
  refreshResume();
  renderChapters();
})();
