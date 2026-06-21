// Manga/novel metadata + chapter index loader for "Hoa Sơn Tái Khởi".
// The real chapter list lives in content/chapters.json (built by extract.py
// from the provided PDF/DOCX files). No backend — just static JSON + files.

const MANGA = {
  title: "Hoa Sơn Tái Khởi",
  cover: "assets/cover.webp",
  altTitle: "Return of the Mount Hua Sect / 화산귀환",
  author: "Bich Hwa Ban / LICO",
  synopsis:
    "Sau khi đánh bại Thiên Ma và hy sinh thân mình, Đại hiệp Thanh Mai Kiếm Tôn " +
    "Trần Trường Sinh của phái Hoa Sơn tỉnh dậy sau một trăm năm trong thân xác " +
    "một thiếu niên. Hoa Sơn nay đã suy tàn chỉ còn lại vài đệ tử. Hành trình " +
    "tái khởi môn phái và tìm lại vinh quang của Hoa Sơn bắt đầu.",
  genres: ["Hành động", "Võ thuật", "Phiêu lưu", "Hài hước", "Tu tiên"],
  status: "Đang tiến hành",
};

// Populated by loadChapters(). Each item: {num, title, type:'text'|'image', ...}
let CHAPTERS = [];
let _byNum = new Map();

async function loadChapters() {
  if (CHAPTERS.length) return CHAPTERS;
  const res = await fetch("content/chapters.json");
  if (!res.ok) throw new Error("Không tải được danh sách chương");
  CHAPTERS = await res.json();
  _byNum = new Map(CHAPTERS.map((c) => [c.num, c]));
  return CHAPTERS;
}

function getChapter(num) {
  return _byNum.get(Number(num)) || null;
}

function chapterIndex(num) {
  return CHAPTERS.findIndex((c) => c.num === Number(num));
}

function getNextChapter(num) {
  const i = chapterIndex(num);
  return i === -1 || i === CHAPTERS.length - 1 ? null : CHAPTERS[i + 1];
}

function getPrevChapter(num) {
  const i = chapterIndex(num);
  return i <= 0 ? null : CHAPTERS[i - 1];
}
