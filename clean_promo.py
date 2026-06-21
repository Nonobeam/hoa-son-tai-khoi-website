#!/usr/bin/env python3
"""Strip the admin/donation (bank/MoMo) blurbs injected into chapter text.

These are commercial solicitations spliced into the story — never part of the
novel. Every known template is matched by a specific opening phrase plus a clear
end anchor (usually the donation account number 2220012000, or a fixed closing
phrase) so only the blurb is removed and surrounding narration is left intact.
Idempotent: once removed the anchors no longer match, so re-running is a no-op.
"""
import glob
import re
import sys

ACCT = '2220012000'

# Tail that can trail the account number: an optional bank token, an optional
# "- Ngo Minh Quang , cảm ơn mọi người nhé", an optional "( momo … )".
GEN_END = (
    ACCT
    + r'(?:\s*(?:mbbank|mb\s*bank))?'
    + r'(?:\s*-?\s*Ngo Minh Quang\s*,\s*cảm ơn mọi người nhé)?'
    + r'(?:\s*\(\s*momo[^)]*\))?'
)

# Opening phrases that lead up to the account number (each unique to a blurb).
STARTS = [
    r'Hello anh em đang đọc',
    r'Ủng\s*hộ\s*mở\s*để\s*mở\s*nhiều\s*chap',
    r'Ủng\s*hộ\s*để\s*mở\s*nhiều\s*chap',
    r'ủng hộ để mua thêm chap',
    r'(?:ủng|ung) hộ mở chap mới',
    r'ủng hộ để mở thêm chap',
    r'ủng hộ chap mới',
    r'ae muốn ủng hộ mình stk',
    r'AE muốn ủng hộ\s*mua thêm chap để leak tiếp lên page qua stk mbbank',
    r'(?:Ho ho\s*)?AE có thể ủng hộ leak truyện',
    r'ae ủng hộ leak truyện',
    r'Mọi người có thể ủng hộ mình qua stk',
]

PROMO = [re.compile(r'\s*' + s + r'.*?' + GEN_END, re.S | re.I) for s in STARTS]

# Templates whose end is a fixed phrase rather than the account number.
PROMO += [
    # chai-nước donor list / thank-you block
    re.compile(
        r'\s*(?:Cảm ơn các bạn mới ủng hộ mình chai nước nhé|'
        r'anh em có thể ủng hộ mình chai nước qua stk)'
        r'.*?động lực rất lớn giúp mình rồi ạ',
        re.S,
    ),
    # "Xin chào anh em … leak truyện … tặng mình 1 like là được )"
    re.compile(
        r'\s*Xin chào anh em\s*,\s*mình là admin page Hoa Sơn Tái Khởi Novel '
        r'leak truyện.*?tặng mình 1 like là được\s*\)',
        re.S,
    ),
    # whole-chapter admin announcement ("Hello anh em , … leak … cảm ơn ae đã đọc")
    re.compile(
        r'\s*Hello anh em\s*,\s*mình là admin page Hoa Sơn Tái Khởi novel '
        r'leak truyện.*?cảm ơn ae đã đọc',
        re.S,
    ),
    # "Chào mọi người , mình là admin đây … (MB Bank referral) … cảm ơn mọi người hihi"
    re.compile(
        r'\s*Chào mọi người\s*,\s*mình là admin đây.*?cảm ơn mọi người hihi',
        re.S,
    ),
    # short MB Bank "30k free" referral lines (whole paragraph)
    re.compile(
        r'\s*Anh em (?:nào|ai)[^<]*?tài khoản MB ?bank[^<]*?'
        r'(?:hướng dẫn nha|ib mình nha)',
        re.S,
    ),
    # "Anh em ủng hộ mình hoặc góp tiền mua truyện qua stk … cảm ơn anh em [hihi]"
    re.compile(
        r'\s*[Aa]nh em ủng hộ mình hoặc góp tiền mua truyện qua stk \d+ '
        r'mbbank nhé\s*,\s*cảm ơn anh em(?:\s*hihi)?',
        re.S,
    ),
    # maintenance notice
    re.compile(r'\s*Anh em chú ý!!!\s*Bảo trì cổng nạp momo đến hết 18/4!!!', re.S),
    # "Truyện do Page … edit lại … ae ghé ủng hộ Page." anti-copy plug
    re.compile(
        r'\s*(?:Truyện do )?[Pp]age (?:Hoa Sơn Tái Kh[ơởờ]i|HSTK)'
        r'.*?ae ghé ủng hộ Page\.?',
        re.S,
    ),
    # "like" plug + hashtags
    re.compile(r'\s*Ủng hộ page hoa sơn tái khởi 1 like nhé ae[^<]*', re.S | re.I),
    # translator / site watermark, e.g.
    #   "(.. ..... .. Bản dịch được thực hiện bởi A-H Team, đăng tải độc quyền
    #    tại VLOGNOVEL.COM. … .. ..... .. )"  — also the "*** … ***" variant.
    re.compile(r'\s*\([^)]*Bản dịch được thực hiện bởi[^)]*\)', re.S),
]

# Catch-all for a stray account number left on its own.
STRAY = re.compile(r'\s*' + ACCT + r'\s*')


def clean(html: str) -> str:
    for pat in PROMO:
        html = pat.sub(' ', html)
    html = STRAY.sub(' ', html)
    html = re.sub(r'[ \t]{2,}', ' ', html)
    # tidy <br> artefacts where a blurb sat at a line boundary
    html = re.sub(r'(<p>)\s*(?:<br>\s*)+', r'\1', html)  # leading break
    html = re.sub(r'(?:<br>\s*)+(</p>)', r'\1', html)  # trailing break
    html = re.sub(r'<br>\s*<br>', '<br>', html)  # doubled break
    html = re.sub(r'\s+</p>', '</p>', html)
    html = re.sub(r'<p>\s*</p>\s*', '', html)
    return html


def main(argv):
    files = argv or sorted(glob.glob('content/*.html'))
    changed = 0
    for path in files:
        src = open(path, encoding='utf-8').read()
        out = clean(src)
        if out != src:
            open(path, 'w', encoding='utf-8').write(out)
            changed += 1
    print(f'cleaned {changed}/{len(files)} files')


if __name__ == '__main__':
    main(sys.argv[1:])
