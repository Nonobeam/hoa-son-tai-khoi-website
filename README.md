# Hoa Sơn Tái Khởi — Web đọc truyện

Trang web đọc manga **Hoa Sơn Tái Khởi** (Return of the Mount Hua Sect).
Thuần front-end, **không cần database** — toàn bộ lịch sử đọc lưu trong **cookie**.

## Tính năng

- 📖 Đọc truyện theo dạng cuộn dọc (webtoon).
- ♾️ **Cuộn vô hạn**: khi cuộn tới ~80% chương hiện tại, chương kế tiếp tự
  động được nối vào bên dưới — không cần bấm "trang sau".
- ✅ **Theo dõi đã đọc**: chương đã đọc xong được đánh dấu, lưu bằng cookie.
- ▶️ **Đọc tiếp**: nhớ vị trí đọc gần nhất để quay lại đúng chỗ.
- 📊 Thanh tiến độ tổng (đã đọc N/M chương) và thanh tiến độ cuộn trong chương.
- 🗑️ Nút xóa lịch sử.

## Chạy thử

Cookie bị nhiều trình duyệt chặn khi mở trực tiếp bằng `file://`, nên hãy chạy
qua một static server bất kỳ:

```bash
# Python (có sẵn trên máy)
python3 -m http.server 8000

# hoặc Node
npx serve .
```

Rồi mở http://localhost:8000

## Cấu trúc

| File          | Vai trò                                                   |
| ------------- | --------------------------------------------------------- |
| `index.html`  | Trang chủ: thông tin truyện + danh sách chương            |
| `reader.html` | Trang đọc                                                  |
| `data.js`     | Metadata truyện + danh sách chương                        |
| `page.js`     | Sinh ảnh trang giả lập (SVG) — thay bằng URL ảnh thật      |
| `tracker.js`  | Đọc/ghi tiến độ trong cookie                              |
| `home.js`     | Logic trang chủ                                           |
| `reader.js`   | Logic đọc + cuộn vô hạn                                   |

## Dùng ảnh thật

Sửa `makePageDataUri(chapterNum, pageNum)` trong `page.js` để trả về URL ảnh
thật, ví dụ: `` return `/images/ch${chapterNum}/${pageNum}.jpg`; ``
