# Hoa Sơn Tái Khởi — Web đọc truyện

Trang web đọc **Hoa Sơn Tái Khởi** (Return of the Mount Hua Sect / 화산귀환).
Thuần front-end, **không cần database** — lịch sử đọc lưu trong **cookie**.

Nội dung được trích xuất từ các file PDF/DOCX bạn đặt trong thư mục
`drive-download-.../` (1688 chương, 77 → 1767):

- **1562 chương văn bản** → `content/<số>.html`
- **126 chương ảnh** (bản scan) → `content/img/<số>/p-XX.jpg`
- Mục lục: `content/chapters.json`

## Chạy thử ở local

Cookie và `fetch()` bị chặn khi mở bằng `file://`, nên **phải chạy qua một
HTTP server**:

```bash
./serve.sh              # http://localhost:8000
./serve.sh 9000         # đổi cổng

# hoặc thủ công:
python3 -m http.server 8000
# hoặc: npx serve .
```

Mở **http://localhost:8000** → bấm **Đọc từ đầu**, hoặc tìm số chương (vd `202`)
rồi bấm vào.

## Tính năng

- 📖 Đọc liên tục dạng cuộn dọc — cả chương văn bản lẫn chương ảnh.
- ♾️ **Cuộn vô hạn**: tới ~80% chương hiện tại, chương kế tiếp tự động được nối
  vào bên dưới — không cần bấm "trang sau".
- ✅ **Theo dõi đã đọc** (lưu bằng cookie), đánh dấu ✓ trong mục lục.
- ▶️ **Đọc tiếp** đúng vị trí gần nhất.
- 🔎 Tìm chương theo số/tên (1688 chương).
- 📊 Thanh tiến độ tổng + thanh tiến độ cuộn trong chương.
- 🌸 Hiệu ứng **hoa mai hồng rơi** chạy nền phía sau trang đọc.
- 🗑️ Nút xóa lịch sử.

## Cấu trúc

| File / thư mục | Vai trò                                                |
| -------------- | ------------------------------------------------------ |
| `index.html`   | Trang chủ: thông tin truyện + mục lục + tìm kiếm        |
| `reader.html`  | Trang đọc                                               |
| `data.js`      | Metadata + tải `content/chapters.json`                 |
| `tracker.js`   | Đọc/ghi tiến độ trong cookie                            |
| `home.js`      | Logic trang chủ                                         |
| `reader.js`    | Logic đọc + cuộn vô hạn (văn bản & ảnh)                 |
| `petals.js`    | Hiệu ứng hoa mai rơi (canvas)                           |
| `styles.css`   | Giao diện (dark)                                        |
| `extract.py`   | Script trích xuất PDF/DOCX → `content/`                 |
| `content/`     | Chương đã trích xuất (`.html`, `img/`, `chapters.json`) |

## Trích xuất lại nội dung

Nếu thêm/đổi file nguồn trong `drive-download-.../`, chạy lại:

```bash
python3 extract.py     # cần poppler-utils: pdftotext, pdftoppm
```

Script tự bỏ qua các chương ảnh đã render (giữ lại `content/img/`), trích văn
bản bằng `pdftotext`, đọc `.docx` trực tiếp, và lọc bỏ dòng watermark.

> Ghi chú: file gộp `Hoa-Sơn-Tái-Khởi-1764-1830.docx` là văn bản liền mạch
> không có dấu phân chương nên không tách tự động được — hiện chỉ dùng các
> chương lẻ tới 1767.
