#!/usr/bin/env python3
"""OCR the scanned-image chapters into text. Reads content/chapters.json,
runs Tesseract (Vietnamese) over every page of each image chapter in parallel,
writes content/<num>.html, and flips the index entry from image -> text."""
import os, re, json, html, subprocess
from concurrent.futures import ProcessPoolExecutor

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "content")
IMGDIR = os.path.join(OUT, "img")
TESSDATA = os.path.join(ROOT, "tessdata")

NOISE = re.compile(
    r"(vlognovel|bản dịch được thực hiện|a-h team|đăng tải độc quyền|"
    r"đón xem bản dịch|^\s*·\s*$|^\s*hoa sơn tái khởi\s*$|^\s*sơn hoa khởi tái\s*$|"
    r"\d+\s*tháng\s*\d+|lúc\s*\d+:\d+)",
    re.IGNORECASE,
)
CHAP_RE = re.compile(r"^\s*(?:Chapter|Chương)\s+(\d+)[.:]?\s*(.*)$", re.IGNORECASE)


def ocr_page(path):
    # Cache OCR text next to the image so re-runs are instant.
    cache = path + ".txt"
    if os.path.exists(cache) and os.path.getsize(cache) > 0:
        with open(cache, encoding="utf-8") as f:
            return f.read()
    try:
        r = subprocess.run(
            ["tesseract", path, "stdout", "-l", "vie",
             "--tessdata-dir", TESSDATA, "--psm", "3"],
            capture_output=True, text=True, timeout=120,
        )
        out = r.stdout
    except Exception:
        out = ""
    if out.strip():
        with open(cache, "w", encoding="utf-8") as f:
            f.write(out)
    return out


def clean_lines(text):
    out = []
    for ln in text.splitlines():
        ln = ln.replace("\xa0", " ").strip()
        if not ln:
            out.append("")
            continue
        if NOISE.search(ln):
            continue
        out.append(ln)
    return out


def to_html(lines):
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


def parse(num, text):
    lines = clean_lines(text)
    title, start = None, 0
    for i, ln in enumerate(lines):
        m = CHAP_RE.match(ln)
        if m:
            t = m.group(2).strip()
            title = f"Chương {num}" + (f" — {t}" if t else "")
            start = i + 1
            break
    if title is None:
        title = f"Chương {num}"
    return title, to_html(lines[start:])


def main():
    idx = json.load(open(os.path.join(OUT, "chapters.json"), encoding="utf-8"))
    image_chapters = [c for c in idx if c.get("type") == "image"]
    print(f"{len(image_chapters)} image chapters to OCR")

    # flatten all pages -> parallel OCR
    jobs = []  # (num, page_index, path)
    for c in image_chapters:
        d = os.path.join(IMGDIR, str(c["num"]))
        for i, fn in enumerate(sorted(c["files"])):
            jobs.append((c["num"], i, os.path.join(d, fn)))
    print(f"{len(jobs)} pages total")

    results = {}  # num -> {page_index: text}
    done = 0
    with ProcessPoolExecutor(max_workers=os.cpu_count()) as ex:
        futs = {ex.submit(ocr_page, p): (num, i) for (num, i, p) in jobs}
        for fut in futs:
            pass
        # collect as they finish
        from concurrent.futures import as_completed
        for fut in as_completed(futs):
            num, i = futs[fut]
            results.setdefault(num, {})[i] = fut.result()
            done += 1
            if done % 100 == 0:
                print(f"  OCR {done}/{len(jobs)} pages...", flush=True)

    # assemble per chapter, write text, build a fresh index (no in-place mutation)
    converted = 0
    new_idx = []
    for c in idx:
        if c.get("type") == "image" and c["num"] in results:
            pages = results[c["num"]]
            text = "\n\n".join(pages[i] for i in sorted(pages))
            title, body = parse(c["num"], text)
            if body.strip():
                with open(os.path.join(OUT, f"{c['num']}.html"), "w", encoding="utf-8") as f:
                    f.write(body)
                new_idx.append({"num": c["num"], "title": title, "type": "text"})
                converted += 1
                continue
        new_idx.append(c)  # keep as-is (image with no OCR text, or already text)

    json.dump(new_idx, open(os.path.join(OUT, "chapters.json"), "w", encoding="utf-8"),
              ensure_ascii=False)
    types = {}
    for c in new_idx:
        types[c["type"]] = types.get(c["type"], 0) + 1
    print(f"DONE: converted {converted} image chapters to text. types={types}")


if __name__ == "__main__":
    main()
