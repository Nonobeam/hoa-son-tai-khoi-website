#!/usr/bin/env python3
"""Extract every PDF/DOCX chapter in the drive folder into clean HTML
fragments under content/ plus a chapters.json index for the reader."""
import os, re, json, html, zipfile, subprocess, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "drive-download-20260621T022510Z-3-001")
OUT = os.path.join(ROOT, "content")
IMGDIR = os.path.join(OUT, "img")
os.makedirs(OUT, exist_ok=True)
os.makedirs(IMGDIR, exist_ok=True)

NOISE = re.compile(
    r"(vlognovel|bản dịch được thực hiện|a-h team|đăng tải độc quyền|"
    r"đón xem bản dịch|^\s*·\s*$|^\s*hoa sơn tái khởi\s*$|^\s*sơn hoa khởi tái\s*$|"
    r"\d+\s*tháng\s*\d+|lúc\s*\d+:\d+)",
    re.IGNORECASE,
)
CHAP_RE = re.compile(r"^\s*(?:Chapter|Chương)\s+(\d+)[.:]?\s*(.*)$", re.IGNORECASE)


def pdf_text(path):
    try:
        return subprocess.run(
            ["pdftotext", "-enc", "UTF-8", path, "-"],
            capture_output=True, text=True, timeout=60
        ).stdout
    except Exception as e:
        sys.stderr.write(f"pdf fail {path}: {e}\n")
        return ""


def docx_text(path):
    try:
        with zipfile.ZipFile(path) as z:
            xml = z.read("word/document.xml").decode("utf-8", "ignore")
    except Exception as e:
        sys.stderr.write(f"docx fail {path}: {e}\n")
        return ""
    # paragraph breaks -> newline, tabs, then strip tags
    xml = re.sub(r"</w:p>", "\n", xml)
    xml = re.sub(r"<w:tab/>", "\t", xml)
    xml = re.sub(r"<[^>]+>", "", xml)
    return html.unescape(xml)


def clean_lines(text):
    out = []
    for ln in text.splitlines():
        ln = ln.replace("\xa0", " ").strip()
        if not ln:
            out.append("")  # keep paragraph separators
            continue
        if NOISE.search(ln):
            continue
        out.append(ln)
    return out


def to_html(lines):
    """Join wrapped lines into paragraphs (blank line = new paragraph)."""
    paras, buf = [], []
    for ln in lines:
        if ln == "":
            if buf:
                paras.append(" ".join(buf)); buf = []
        else:
            buf.append(ln)
    if buf:
        paras.append(" ".join(buf))
    return "\n".join(f"<p>{html.escape(p)}</p>" for p in paras if p.strip())


def parse_chapter(num, text):
    """Return (title, html). Pull title from a 'Chapter N. ...' line if present."""
    lines = clean_lines(text)
    title = None
    start = 0
    for i, ln in enumerate(lines):
        m = CHAP_RE.match(ln)
        if m:
            t = m.group(2).strip()
            title = f"Chương {num}" + (f" — {t}" if t else "")
            start = i + 1
            break
    if title is None:
        title = f"Chương {num}"
    body = to_html(lines[start:])
    return title, body


def split_bundle(text):
    """Split a multi-chapter doc into {num: (title, html)} by 'Chapter N' marks."""
    lines = clean_lines(text)
    marks = [(i, CHAP_RE.match(ln)) for i, ln in enumerate(lines)]
    marks = [(i, m) for i, m in marks if m]
    result = {}
    for idx, (i, m) in enumerate(marks):
        num = int(m.group(1))
        t = m.group(2).strip()
        title = f"Chương {num}" + (f" — {t}" if t else "")
        end = marks[idx + 1][0] if idx + 1 < len(marks) else len(lines)
        body = to_html(lines[i + 1 : end])
        result[num] = (title, body)
    return result


def render_images(num, path):
    """Render each page of a scanned/image PDF to a JPG. Returns page count."""
    d = os.path.join(IMGDIR, str(num))
    os.makedirs(d, exist_ok=True)
    existing = [n for n in os.listdir(d) if n.endswith(".jpg")]
    if existing:
        return len(existing)  # already rendered on a previous run
    try:
        subprocess.run(
            ["pdftoppm", "-jpeg", "-r", "110", path, os.path.join(d, "p")],
            capture_output=True, timeout=120, check=True,
        )
    except Exception as e:
        sys.stderr.write(f"render fail {path}: {e}\n")
        return 0
    return len([n for n in os.listdir(d) if n.endswith(".jpg")])


def pick(files):
    """Prefer a file without a '(1)' duplicate suffix; else first sorted."""
    files = sorted(files)
    for f in files:
        if "(1)" not in os.path.basename(f):
            return f
    return files[0]


def main():
    bynum = {}
    bundles = []
    for dp, _, fns in os.walk(SRC):
        for fn in fns:
            low = fn.lower()
            if not low.endswith((".pdf", ".docx")):
                continue
            path = os.path.join(dp, fn)
            m = re.match(r"\s*(\d+)", fn)
            if m and not re.match(r"\s*\d+\s*-\s*\d+", fn):
                bynum.setdefault(int(m.group(1)), []).append(path)
            else:
                bundles.append(path)

    chapters = {}  # num -> {"title":..., "type":..., "pages":?}

    def emit_text(num, title, body):
        if not body.strip():
            return False
        with open(os.path.join(OUT, f"{num}.html"), "w", encoding="utf-8") as f:
            f.write(body)
        chapters[num] = {"num": num, "title": title, "type": "text"}
        return True

    total = len(bynum)
    img_count = 0
    for i, num in enumerate(sorted(bynum), 1):
        path = pick(bynum[num])
        is_pdf = path.lower().endswith(".pdf")
        text = pdf_text(path) if is_pdf else docx_text(path)
        if len(re.sub(r"\s", "", text)) >= 40:
            title, body = parse_chapter(num, text)
            emit_text(num, title, body)
        elif is_pdf:
            # scanned/image chapter -> render pages to JPGs
            pages = render_images(num, path)
            if pages:
                d = os.path.join(IMGDIR, str(num))
                files = sorted(n for n in os.listdir(d) if n.endswith(".jpg"))
                chapters[num] = {
                    "num": num, "title": f"Chương {num}",
                    "type": "image", "pages": len(files), "files": files,
                }
                img_count += 1
        if i % 100 == 0:
            print(f"  {i}/{total} chapters... (image: {img_count})", flush=True)

    print(f"  image chapters: {img_count}")
    index = [chapters[n] for n in sorted(chapters)]
    with open(os.path.join(OUT, "chapters.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False)
    print(f"DONE: {len(index)} chapters, range {index[0]['num']}-{index[-1]['num']}")


if __name__ == "__main__":
    main()
