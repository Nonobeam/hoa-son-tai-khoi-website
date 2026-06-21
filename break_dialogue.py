#!/usr/bin/env python3
"""Format chapter dialogue for the Hoa Sơn Tái Khởi reader.

Each line of speech (“…”) and inner thought (‘…’) is put on its own line: a
break before the opening quote AND after the closing quote, so narration that
follows a quote also starts fresh. Speech in double quotes (“…”) is wrapped in
<em> so it renders italic; thoughts in single quotes are only broken, not
italicised.

The formatter rebuilds each paragraph from its plain text (all inline tags are
stripped first), so it is fully idempotent — re-running reproduces the same
output regardless of any <br>/<em> already present.
"""
import glob
import re
import sys

OPEN = '“‘'   # opening curly quotes (double, single)
CLOSE = '”’'  # closing curly quotes (double, single)
SENT = '\x00'  # segment marker


def format_paragraph(inner: str):
    text = re.sub(r'<[^>]+>', ' ', inner)      # drop existing <br>/<em>/… tags
    text = re.sub(r'\s+', ' ', text).strip()
    if not text:
        return None
    # break before each opening quote and after each closing quote
    text = re.sub(r'(?=[' + OPEN + r'])', SENT, text)
    text = re.sub(r'(?<=[' + CLOSE + r'])', SENT, text)
    parts = [p.strip() for p in text.split(SENT) if p.strip()]
    out = []
    for p in parts:
        if p.startswith('“') and p.endswith('”'):
            out.append('<em>' + p + '</em>')   # italicise speech
        else:
            out.append(p)
    return '<br>'.join(out)


def transform(html: str) -> str:
    def repl(m):
        body = format_paragraph(m.group(1))
        return '' if body is None else '<p>' + body + '</p>'
    return re.sub(r'<p>(.*?)</p>', repl, html, flags=re.S)


def main(argv):
    files = argv or sorted(glob.glob('content/*.html'))
    changed = 0
    for path in files:
        src = open(path, encoding='utf-8').read()
        out = transform(src)
        if out != src:
            open(path, 'w', encoding='utf-8').write(out)
            changed += 1
    print(f'formatted {changed}/{len(files)} files')


if __name__ == '__main__':
    main(sys.argv[1:])
