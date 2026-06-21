#!/usr/bin/env python3
"""Start each line of speech (“…”) and inner thought (‘…’) on its own line.

Source chapters cram a whole conversation into one <p>. This inserts a <br>
before every opening curly quote so each spoken/thought line begins fresh.
Narration between quotes stays attached to the line before it; a <br> that would
land at the very start of a paragraph is dropped. Idempotent: a quote already
preceded by <br> is left alone, so re-running changes nothing.
"""
import glob
import os
import re
import sys

# add <br> before “ or ‘ unless one is already there
INSERT = re.compile(r'(?<!<br>)([“‘])')
# drop a <br> sitting at the start of a paragraph
STRIP_LEADING = re.compile(r'(<p[^>]*>)\s*<br>\s*')


def transform(html: str) -> str:
    html = INSERT.sub(r'<br>\1', html)
    html = STRIP_LEADING.sub(r'\1', html)
    return html


def main(argv):
    files = argv or sorted(glob.glob('content/*.html'))
    changed = 0
    for path in files:
        with open(path, encoding='utf-8') as f:
            src = f.read()
        out = transform(src)
        if out != src:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(out)
            changed += 1
    print(f'updated {changed}/{len(files)} files')


if __name__ == '__main__':
    main(sys.argv[1:])
