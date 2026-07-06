#!/usr/bin/env python3
"""Re-extract one or more chapters from their source PDFs and write clean HTML.

- Text-based PDFs: uses pdftotext with smart paragraph assembly that strips
  the Facebook URL watermarks scattered through the text.
- Image-based PDFs: renders each page and OCRs it with Tesseract (Vietnamese).

Usage:
    python3 fix_chapter_from_pdf.py 551              # single chapter
    python3 fix_chapter_from_pdf.py 551 600          # inclusive range
    python3 fix_chapter_from_pdf.py 601 680 753 756  # arbitrary list
    python3 fix_chapter_from_pdf.py --scan 601 1767  # auto-detect & fix corrupted
"""
import os, re, html, subprocess, sys, tempfile
import fitz  # PyMuPDF

PDF_ROOT = "/home/nonobeam/Work/hoason/hoason/Hoa Sơn "
CONTENT  = os.path.join(os.path.dirname(os.path.abspath(__file__)), "content")

NOISE = re.compile(
    r"vlognovel|bản dịch được thực hiện|a-h team|"
    r"đăng tải độc quyền|đón xem bản dịch|"
    r"hoasontai|@hoason|trang web giải trí|"
    r"tài khoản|ngân hàng|mb bank|ib (page|mình)|nhận \d+k",
    re.IGNORECASE,
)
# Strip any URL fragments embedded mid-sentence by OCR (watermark burned into image)
URL_STRIP = re.compile(r"https?://\S*|www\.\S+|htfips?://\S*", re.IGNORECASE)

# Unicode chars that never appear in Vietnamese fiction — strip inline
INLINE_GARBAGE = re.compile(r"[®©œ«»Š\^\x0c\x00-\x08\x0e-\x1f]|`")

# Isolated 1-2 ASCII-only tokens surrounded by spaces/punctuation (OCR watermark noise)
ISOLATED_TOKEN = re.compile(r"(?:^|\s)([A-Za-z]{1,2})(?=\s|[!?.,]|$)")

# 4+ repeated same character = OCR noise (e.g. “Vùuuuuu”, “aaaaa”)
REPEATED_CHAR  = re.compile(r"(.)\1{3,}")

CHAP_HEADER  = re.compile(r"^\s*[^a-zA-ZÀ-ỿ]*\s*(?:Hoa\s+Sơn|chapter)\s", re.IGNORECASE)
OPEN_QUOTE   = re.compile(r"^[“”’]")
CLOSE_QUOTE  = re.compile(r"[“’”]$")
SENTENCE_END = re.compile(r"[.!?]$")


# ── helpers ──────────────────────────────────────────────────────────────────

def find_pdf(num: int) -> str | None:
    for dp, _dirs, files in os.walk(PDF_ROOT):
        for fn in files:
            if not fn.lower().endswith(".pdf"):
                continue
            if re.match(r"\s*" + str(num) + r"\s*$", fn[:-4]):
                return os.path.join(dp, fn)
    return None


def is_image_pdf(path: str) -> bool:
    """True when every page has images but no embedded text."""
    doc = fitz.open(path)
    has_text = any(doc[i].get_text("text").strip() for i in range(doc.page_count))
    doc.close()
    return not has_text


def is_garbage(ln: str) -> bool:
    """Detect watermark fragments and OCR noise lines."""
    if not ln:
        return False
    # Short lines with no Vietnamese chars
    if len(ln) <= 6 and not re.search(r'[À-ỿ]', ln):
        return True
    # Lines with ≥2 garbage Unicode symbols (e.g. "œ® ùu. ^ cŠ Vùuuuu")
    if len(INLINE_GARBAGE.findall(ln)) >= 2:
        return True
    # Lines with 4+ repeated same character (OCR hallucination)
    if REPEATED_CHAR.search(ln):
        return True
    # Lines where >40% of chars are non-Vietnamese, non-Latin (dense symbol noise)
    bad = len(re.findall(r'[^a-zA-ZÀ-ỿ0-9\s.,!?;:()\-\'"""''…–—/*]', ln))
    if bad >= 4 and bad / len(ln) > 0.4:
        return True
    return False


# ── text-PDF path ─────────────────────────────────────────────────────────────

def pdf_to_lines(path: str) -> list[str]:
    r = subprocess.run(
        ["pdftotext", "-enc", "UTF-8", path, "-"],
        capture_output=True, text=True, timeout=60,
    )
    return r.stdout.splitlines()


def build_paragraphs(raw_lines: list[str]) -> list[str]:
    """Assemble clean paragraphs, respecting dialogue lines and dropping
    URL watermark fragments."""
    paras: list[str] = []
    buf:   list[str] = []
    in_quote   = False
    prev_blank = False

    def flush():
        nonlocal in_quote
        if buf:
            paras.append(" ".join(buf))
            buf.clear()
        in_quote = False

    for raw in raw_lines:
        ln = raw.replace("\xa0", " ").strip()
        ln = URL_STRIP.sub("", ln).strip()       # strip watermark URLs
        ln = INLINE_GARBAGE.sub("", ln).strip()  # strip ®©œ«» and control chars
        ln = re.sub(r'\s{2,}', ' ', ln)          # collapse extra spaces
        if not ln:
            prev_blank = True
            continue
        if CHAP_HEADER.search(ln) or NOISE.search(ln) or is_garbage(ln):
            continue

        starts_quote = bool(OPEN_QUOTE.match(ln))
        ends_quote   = bool(CLOSE_QUOTE.search(ln))

        if starts_quote:
            flush()
            buf.append(ln)
            in_quote = True
        elif in_quote:
            buf.append(ln)
        else:
            if prev_blank and buf and (SENTENCE_END.search(buf[-1]) or CLOSE_QUOTE.search(buf[-1])):
                flush()
            buf.append(ln)

        if in_quote and ends_quote:
            flush()

        prev_blank = False

    flush()
    return paras


# ── image-PDF / OCR path ──────────────────────────────────────────────────────

def ocr_page_image(img_path: str) -> str:
    """Run Tesseract (Vietnamese) on a PNG/JPG, return plain text."""
    r = subprocess.run(
        ["tesseract", img_path, "stdout", "-l", "vie", "--psm", "3"],
        capture_output=True, text=True, timeout=120,
    )
    return r.stdout


def ocr_pdf(path: str) -> list[str]:
    """Render each page of an image PDF to PNG and OCR it; return all text lines."""
    doc  = fitz.open(path)
    lines: list[str] = []
    with tempfile.TemporaryDirectory() as tmp:
        for i in range(doc.page_count):
            page    = doc[i]
            mat     = fitz.Matrix(3, 3)          # 3× zoom → ~225 DPI render, better OCR accuracy
            pix     = page.get_pixmap(matrix=mat)
            img_out = os.path.join(tmp, f"p{i:04d}.png")
            pix.save(img_out)
            text = ocr_page_image(img_out)
            lines.extend(text.splitlines())
            lines.append("")                     # blank between pages
    doc.close()
    return lines


# ── HTML builder ──────────────────────────────────────────────────────────────

def to_html(paras: list[str]) -> str:
    rows = []
    for p in paras:
        if not p.strip():
            continue
        escaped = html.escape(p)
        if OPEN_QUOTE.match(p):
            rows.append(f"<p><em>{escaped}</em></p>")
        else:
            rows.append(f"<p>{escaped}</p>")
    return "\n".join(rows)


# ── main entry ────────────────────────────────────────────────────────────────

def fix_chapter(num: int) -> bool:
    path = find_pdf(num)
    if path is None:
        print(f"  [{num}] PDF not found — skipped")
        return False

    if is_image_pdf(path):
        print(f"  [{num}] image PDF → OCR …", end=" ", flush=True)
        raw_lines = ocr_pdf(path)
        mode = "OCR"
    else:
        raw_lines = pdf_to_lines(path)
        mode = "text"

    if not raw_lines:
        print(f"  [{num}] empty output — skipped")
        return False

    paras = build_paragraphs(raw_lines)
    body  = to_html(paras)
    if not body.strip():
        print(f"  [{num}] no body after cleaning — skipped")
        return False

    out_path = os.path.join(CONTENT, f"{num}.html")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(body)
    print(f"  [{num}] OK [{mode}] → {out_path}  ({len(paras)} paragraphs)")
    return True


def main():
    """
    Usage:
      fix_chapter_from_pdf.py 551              # single chapter
      fix_chapter_from_pdf.py 551 600          # inclusive range
      fix_chapter_from_pdf.py 601 680 753 756  # arbitrary list of chapters
      fix_chapter_from_pdf.py --scan 601 1767  # scan range, fix only corrupted ones
    """
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(1)

    # --scan mode: scan HTML files in a range, fix only corrupted ones
    if args[0] == "--scan":
        scan_start = int(args[1]) if len(args) > 1 else 1
        scan_end   = int(args[2]) if len(args) > 2 else 9999
        chapters   = _find_corrupted(scan_start, scan_end)
        print(f"Found {len(chapters)} corrupted chapters in {scan_start}–{scan_end}")
    elif len(args) == 2 and args[0].isdigit() and args[1].isdigit():
        # Two numbers → treat as range
        chapters = list(range(int(args[0]), int(args[1]) + 1))
    else:
        # One or more numbers → treat as explicit list
        chapters = [int(a) for a in args if a.isdigit()]

    ok = fail = 0
    for n in chapters:
        if fix_chapter(n):
            ok += 1
        else:
            fail += 1

    print(f"\nDone: {ok} fixed, {fail} skipped")


def _find_corrupted(start: int, end: int) -> list[int]:
    """Return chapter numbers whose HTML shows any sign of OCR garbage."""
    SHORT_P    = re.compile(r'<p>(?:<em>)?(.{1,5})(?:</em>)?</p>')
    OCR_SYMBOL = re.compile(r'[®©œ«»Š]')   # garbage Unicode never in Vietnamese fiction
    found = []
    for fn in sorted(os.listdir(CONTENT)):
        m = re.match(r'^(\d+)\.html$', fn)
        if not m:
            continue
        num = int(m.group(1))
        if not (start <= num <= end):
            continue
        text = open(os.path.join(CONTENT, fn), encoding='utf-8').read()
        # Old-style junk: ≥3 short ASCII-only <p> tags
        junk = [p for p in SHORT_P.findall(text)
                if len(p.strip()) <= 4 and not re.search(r'[À-ỿ]', p)]
        # New-style junk: OCR garbage symbols present anywhere in the file
        has_ocr_symbols = bool(OCR_SYMBOL.search(text))
        if len(junk) >= 3 or has_ocr_symbols:
            found.append(num)
    return found


if __name__ == "__main__":
    main()
