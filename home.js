// Home page: manga info, progress summary, and a searchable chapter list
// driven by the cookie tracker. Chapter data comes from content/chapters.json.

(function () {
  // --- Static manga info ---
  const coverEl = document.getElementById("cover");
  const coverImg = document.getElementById("coverImg");
  if (MANGA.cover) {
    coverImg.src = MANGA.cover;
    coverEl.classList.add("has-image");
  } else {
    coverImg.remove();
    coverEl.textContent = MANGA.title;
  }
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

  function goToChapter(num, page) {
    let url = `reader.html?chapter=${num}`;
    if (page) url += `&page=${page}`;
    location.href = url;
  }

  function refreshSummary() {
    const total = CHAPTERS.length;
    const read = readCount();
    document.getElementById("readNum").textContent = read;
    document.getElementById("totalNum").textContent = total;
    const pct = total ? Math.round((read / total) * 100) : 0;
    document.getElementById("progressFill").style.width = pct + "%";
    document.getElementById("percentLabel").textContent = pct + "%";
  }

  function refreshResume() {
    const last = getLastPosition();
    const resumeBtn = document.getElementById("resumeBtn");
    const continueBtn = document.getElementById("continueBtn");
    if (last && getChapter(last.chapter)) {
      resumeBtn.style.display = "inline-flex";
      resumeBtn.textContent = `Đọc tiếp · Chương ${last.chapter}`;
      resumeBtn.onclick = () => goToChapter(last.chapter, last.page);
      continueBtn.style.display = "inline-block";
      continueBtn.onclick = () => goToChapter(last.chapter, last.page);
    } else {
      resumeBtn.style.display = "none";
      continueBtn.style.display = "none";
    }
  }

  const grid = document.getElementById("chapterGrid");

  function makeCard(ch, last) {
    const read = isChapterRead(ch.num);
    const isCurrent = last && last.chapter === ch.num && !read;
    const card = document.createElement("div");
    card.className = "chapter-card" + (read ? " read" : "");
    card.onclick = () => goToChapter(ch.num);

    const left = document.createElement("div");
    const sub = ch.type === "image" ? `${ch.pages} trang ảnh` : "Văn bản";
    left.innerHTML =
      `<div class="ch-name">${escapeHtml(ch.title)}</div>` +
      `<div class="ch-sub">${sub}</div>`;

    const right = document.createElement("div");
    if (read) right.innerHTML = `<span class="badge-read">✓ Đã đọc</span>`;
    else if (isCurrent) right.innerHTML = `<span class="badge-continue">Đang đọc</span>`;

    card.appendChild(left);
    card.appendChild(right);
    return card;
  }

  function renderChapters(filter) {
    const last = getLastPosition();
    const q = (filter || "").trim().toLowerCase();
    grid.innerHTML = "";
    const frag = document.createDocumentFragment();
    let shown = 0;
    for (const ch of CHAPTERS) {
      if (q) {
        const hay = (ch.title + " " + ch.num).toLowerCase();
        if (!hay.includes(q)) continue;
      }
      frag.appendChild(makeCard(ch, last));
      shown++;
      if (shown >= 400 && !q) break; // cap initial render; search reveals the rest
    }
    grid.appendChild(frag);
    const note = document.getElementById("listNote");
    if (note) {
      if (!q && CHAPTERS.length > 400)
        note.textContent = `Hiển thị 400/${CHAPTERS.length} chương đầu — dùng ô tìm kiếm để xem tất cả.`;
      else note.textContent = `${shown} chương`;
    }
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  // --- Buttons & search ---
  document.getElementById("resetBtn").onclick = () => {
    if (confirm("Xóa toàn bộ lịch sử đọc?")) {
      clearProgress();
      refreshSummary();
      refreshResume();
      renderChapters(document.getElementById("search").value);
    }
  };

  const search = document.getElementById("search");
  let timer;
  search.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => renderChapters(search.value), 120);
  });

  // --- Boot ---
  loadChapters()
    .then(() => {
      document.getElementById("startBtn").onclick = () => goToChapter(CHAPTERS[0].num);
      refreshSummary();
      refreshResume();
      renderChapters("");
    })
    .catch((err) => {
      grid.innerHTML = `<div class="end-note">Lỗi tải dữ liệu: ${err.message}<br/>Hãy chạy qua server (xem README).</div>`;
    });
})();
