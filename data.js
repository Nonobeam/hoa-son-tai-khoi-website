// Manga metadata and chapter list for "Hoa Sơn Tái Khởi".
// No backend: chapters are defined here and page images are generated
// on the fly (see page.js) so the whole thing runs from the filesystem.

const MANGA = {
  title: "Hoa Sơn Tái Khởi",
  altTitle: "Return of the Mount Hua Sect",
  author: "BiJ / LICO",
  synopsis:
    "Sau khi đánh bại Thiên Ma và hy sinh thân mình, Đại hiệp Thanh Mai Kiếm Tôn " +
    "Trần Trường Sinh của phái Hoa Sơn tỉnh dậy sau một trăm năm trong thân xác " +
    "một thiếu niên. Hoa Sơn nay đã suy tàn chỉ còn lại vài đệ tử. Hành trình " +
    "tái khởi môn phái và tìm lại vinh quang của Hoa Sơn bắt đầu.",
  genres: ["Hành động", "Võ thuật", "Phiêu lưu", "Hài hước", "Tu tiên"],
  status: "Đang tiến hành",
};

// Generate a chapter list. Each chapter has a deterministic page count so the
// generated placeholder pages stay stable across reloads.
const CHAPTERS = Array.from({ length: 24 }, (_, i) => {
  const num = i + 1;
  const pages = 8 + ((num * 7) % 9); // 8..16 pages, stable per chapter
  return {
    id: num,
    number: num,
    title: `Chương ${num}`,
    pages,
  };
});

function getChapter(id) {
  return CHAPTERS.find((c) => c.id === Number(id)) || null;
}

function getNextChapter(id) {
  const idx = CHAPTERS.findIndex((c) => c.id === Number(id));
  if (idx === -1 || idx === CHAPTERS.length - 1) return null;
  return CHAPTERS[idx + 1];
}

function getPrevChapter(id) {
  const idx = CHAPTERS.findIndex((c) => c.id === Number(id));
  if (idx <= 0) return null;
  return CHAPTERS[idx - 1];
}
