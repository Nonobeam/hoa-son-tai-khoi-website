# Fix Chapter from PDF

Fix a chapter's HTML content by re-extracting clean text from its source PDF.
Automatically handles both text-based PDFs and scanned/image-based PDFs.

## When to use
When a chapter in `content/<N>.html` has corrupted text — URL fragments, watermark
noise, OCR garbage, or garbled paragraphs — replace it with clean text from the PDF.

## Steps

1. **Run the extraction script**:
   ```
   cd /home/nonobeam/Work/hoason/hoa-son-tai-khoi-website
   python3 fix_chapter_from_pdf.py <chapter_number>
   ```
   Or for a range:
   ```
   python3 fix_chapter_from_pdf.py 551 600
   ```

2. **What the script does automatically**:
   - Finds the source PDF in `/home/nonobeam/Work/hoason/hoason/Hoa Sơn /`
   - **Text PDF**: uses `pdftotext` with smart paragraph assembly, strips URL watermarks
   - **Image/scanned PDF**: renders pages and runs Tesseract OCR (Vietnamese)
   - Writes clean HTML to `content/<N>.html`

3. **Verify** — Check `content/<N>.html` has clean readable text with no stray
   short `<p>` tags (1-4 chars) or URL fragments like `tp`, `ht`, `//w`, `.fa`.

## PDF source folder
`/home/nonobeam/Work/hoason/hoason/Hoa Sơn /` (note trailing space in folder name)

Subfolders: `77-200`, `201-400`, `401-600`, `601-800`, `800-1000`, `1001-1200`,
`1200-1326`, `1326-1500`, `1500-1700 HSTK-...`, `1700-2000`

## Requirements
- `pdftotext` (poppler-utils) — for text PDFs
- `tesseract` + `tesseract-ocr-vie` — for scanned/image PDFs
- `pymupdf` (fitz) — for page rendering and PDF type detection
