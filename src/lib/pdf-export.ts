import { PDFDocument, StandardFonts, rgb, PDFPage } from 'pdf-lib';

// ── Colour palette ────────────────────────────────────────────────────────────
const C = {
    black: rgb(0, 0, 0),
    white: rgb(1, 1, 1),
    accent: rgb(0.039, 0.518, 0.651),   // cyan-ish
    accentDark: rgb(0.02, 0.35, 0.45),
    heading1Bg: rgb(0.039, 0.518, 0.651),
    heading2Fg: rgb(0.02, 0.27, 0.38),
    muted: rgb(0.45, 0.45, 0.45),
    ruleLight: rgb(0.82, 0.82, 0.82),
    ruleMed: rgb(0.65, 0.65, 0.65),
    codeBg: rgb(0.94, 0.94, 0.94),
    blockqFg: rgb(0.35, 0.35, 0.35),
    blockqBar: rgb(0.039, 0.518, 0.651),
    bullet: rgb(0.039, 0.518, 0.651),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strip characters outside WinAnsi (pdf-lib Helvetica range). */
function sanitize(s: string): string {
    return s.replace(/[^\x20-\xFF]/g, (ch) => {
        // Preserve common typographic replacements for standard PDF font compatibility
        const map: Record<string, string> = {
            '\u2014': '--', '\u2013': '-', '\u2018': "'", '\u2019': "'",
            '\u201C': '"', '\u201D': '"', '\u2026': '...', '\u2022': '*',
            '\u00B7': '-', '\u2212': '-', '\u00A0': ' ',
            '\u2122': '™',
        };
        return map[ch] ?? '?';
    });
}

/** Wrap a string into lines that fit within maxWidth at fontSize. */
function wrapText(
    text: string,
    font: any,
    fontSize: number,
    maxWidth: number
): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
        if (!word) continue;
        const candidate = current ? `${current} ${word}` : word;
        const w = font.widthOfTextAtSize(sanitize(candidate), fontSize);
        if (w <= maxWidth || !current) {
            current = candidate;
        } else {
            lines.push(current);
            current = word;
        }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [''];
}

/** Strip inline markdown bold/italic markers for display. */
function stripInlineMarkers(s: string): string {
    return s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/_(.+?)_/g, '$1');
}

// ── Page context ──────────────────────────────────────────────────────────────

interface Ctx {
    doc: PDFDocument;
    page: PDFPage;
    fonts: { regular: any; bold: any; italic: any; boldItalic: any };
    y: number;
    margin: number;
    width: number;
    height: number;
    pageNumber: number;
    totalPages: number;   // filled in post-render
    footerReserve: number;
}

function newPage(ctx: Ctx): Ctx {
    const page = ctx.doc.addPage();
    const { width, height } = page.getSize();
    ctx.page = page;
    ctx.y = height - ctx.margin;
    ctx.width = width;
    ctx.height = height;
    ctx.pageNumber += 1;

    // Subtle top accent bar
    page.drawRectangle({
        x: 0, y: height - 4, width, height: 4,
        color: C.accent,
    });
    // Left margin accent line
    page.drawRectangle({
        x: 0, y: 0, width: 3, height,
        color: rgb(0.9, 0.9, 0.9),
    });

    return ctx;
}

function ensureSpace(ctx: Ctx, needed: number): Ctx {
    if (ctx.y - needed < ctx.margin + ctx.footerReserve) {
        return newPage(ctx);
    }
    return ctx;
}

// ── Drawing helpers ───────────────────────────────────────────────────────────

function drawText(ctx: Ctx, text: string, x: number, y: number, opts: {
    font?: any; size?: number; color?: any;
}) {
    ctx.page.drawText(sanitize(text), {
        x, y,
        font: opts.font ?? ctx.fonts.regular,
        size: opts.size ?? 10,
        color: opts.color ?? C.black,
    });
}

function drawRule(ctx: Ctx, x: number, y: number, w: number, thickness = 0.5, color = C.ruleLight) {
    ctx.page.drawLine({
        start: { x, y },
        end: { x: x + w, y },
        thickness,
        color,
    });
}

// ── Cover / header block ──────────────────────────────────────────────────────

function drawCoverHeader(ctx: Ctx, title: string, subtitle: string, metadata: Record<string, string>) {
    const { margin, width, fonts } = ctx;
    const contentW = width - margin * 2;

    // Background bar
    ctx.page.drawRectangle({
        x: margin - 10, y: ctx.y - 62,
        width: contentW + 20, height: 68,
        color: C.heading1Bg,
    });

    // Title with dynamic scaling
    let titleSize = 18;
    const sanitizedTitle = sanitize(title).toUpperCase();
    let titleW = fonts.bold.widthOfTextAtSize(sanitizedTitle, titleSize);
    
    // Scale down if too wide, minimum size 12
    if (titleW > contentW) {
        titleSize = Math.max(12, 18 * (contentW / titleW));
        titleW = fonts.bold.widthOfTextAtSize(sanitizedTitle, titleSize);
    }

    drawText(ctx, sanitizedTitle, margin, ctx.y - 14, {
        font: fonts.bold, size: titleSize, color: C.white,
    });
    // Subtitle
    drawText(ctx, sanitize(subtitle), margin, ctx.y - 34, {
        font: fonts.regular, size: 9, color: rgb(0.8, 0.93, 0.97),
    });
    // Divider line below bar
    ctx.y -= 72;
    drawRule(ctx, margin, ctx.y, contentW, 0.5, C.accent);
    ctx.y -= 12;

    // Metadata grid: two columns
    const col1 = margin;
    const col2 = margin + contentW / 2;
    const metaSize = 8.5;
    const lineH = 14;
    const entries = Object.entries(metadata);
    for (let i = 0; i < entries.length; i += 2) {
        ctx = ensureSpace(ctx, lineH + 4);
        const [k1, v1] = entries[i];
        const label1 = k1.endsWith(':') ? k1 : `${k1}:`;
        drawText(ctx, label1, col1, ctx.y, { font: fonts.bold, size: metaSize, color: C.muted });
        drawText(ctx, sanitize(v1), col1 + 90, ctx.y, { font: fonts.regular, size: metaSize });

        if (i + 1 < entries.length) {
            const [k2, v2] = entries[i + 1];
            const label2 = k2.endsWith(':') ? k2 : `${k2}:`;
            drawText(ctx, label2, col2, ctx.y, { font: fonts.bold, size: metaSize, color: C.muted });
            drawText(ctx, sanitize(v2), col2 + 90, ctx.y, { font: fonts.regular, size: metaSize });
        }
        ctx.y -= lineH;
    }

    ctx.y -= 8;
    drawRule(ctx, margin, ctx.y, contentW, 0.5, C.ruleMed);
    ctx.y -= 16;
}

// ── Section heading renderers ─────────────────────────────────────────────────

function drawH1(ctx: Ctx, text: string): Ctx {
    const { margin, width, fonts } = ctx;
    const contentW = width - margin * 2;
    ctx = ensureSpace(ctx, 36);
    ctx.y -= 6;
    ctx.page.drawRectangle({ x: margin - 10, y: ctx.y - 20, width: contentW + 20, height: 26, color: C.accent });
    drawText(ctx, sanitize(text).toUpperCase(), margin, ctx.y - 14, { font: fonts.bold, size: 14, color: C.white });
    ctx.y -= 28;
    return ctx;
}

function drawH2(ctx: Ctx, text: string): Ctx {
    const { margin, width, fonts } = ctx;
    const contentW = width - margin * 2;
    ctx = ensureSpace(ctx, 28);
    ctx.y -= 8;
    drawText(ctx, sanitize(text), margin, ctx.y, { font: fonts.bold, size: 12, color: C.heading2Fg });
    ctx.y -= 4;
    drawRule(ctx, margin, ctx.y, contentW, 1, C.accent);
    ctx.y -= 10;
    return ctx;
}

function drawH3(ctx: Ctx, text: string): Ctx {
    const { margin, fonts } = ctx;
    ctx = ensureSpace(ctx, 22);
    ctx.y -= 6;
    drawText(ctx, sanitize(text), margin, ctx.y, { font: fonts.bold, size: 11, color: C.black });
    ctx.y -= 14;
    return ctx;
}

// ── Paragraph / bullet renderers ─────────────────────────────────────────────

function drawParagraph(ctx: Ctx, text: string, opts?: { indent?: number; italic?: boolean; small?: boolean }): Ctx {
    const { margin, width, fonts } = ctx;
    const indent = opts?.indent ?? 0;
    const font = opts?.italic ? fonts.italic : fonts.regular;
    const size = opts?.small ? 9 : 10;
    const maxW = width - margin * 2 - indent;
    const lineH = size * 1.55;
    const clean = stripInlineMarkers(text);
    const lines = wrapText(clean, font, size, maxW);

    for (const line of lines) {
        ctx = ensureSpace(ctx, lineH + 2);
        drawText(ctx, line, margin + indent, ctx.y, { font, size, color: C.black });
        ctx.y -= lineH;
    }
    return ctx;
}

function drawBullet(ctx: Ctx, text: string, depth = 0): Ctx {
    const { margin, width, fonts } = ctx;
    const indent = 14 + depth * 12;
    const size = 10;
    const maxW = width - margin * 2 - indent - 10;
    const lineH = size * 1.55;
    const clean = stripInlineMarkers(text);
    const lines = wrapText(clean, fonts.regular, size, maxW);

    for (let i = 0; i < lines.length; i++) {
        ctx = ensureSpace(ctx, lineH + 2);
        if (i === 0) {
            ctx.page.drawCircle({ x: margin + indent - 7, y: ctx.y + 3, size: 2, color: C.bullet });
        }
        drawText(ctx, lines[i], margin + indent, ctx.y, { font: fonts.regular, size, color: C.black });
        ctx.y -= lineH;
    }
    return ctx;
}

function drawBlockquote(ctx: Ctx, text: string): Ctx {
    const { margin, width, fonts } = ctx;
    const indent = 18;
    const size = 9.5;
    const maxW = width - margin * 2 - indent - 6;
    const lineH = size * 1.6;
    const clean = stripInlineMarkers(text);
    const lines = wrapText(clean, fonts.italic, size, maxW);
    const blockH = lines.length * lineH + 8;

    ctx = ensureSpace(ctx, blockH + 4);
    ctx.page.drawRectangle({ x: margin, y: ctx.y - blockH + lineH, width: 3, height: blockH - 4, color: C.blockqBar });
    ctx.page.drawRectangle({ x: margin + 4, y: ctx.y - blockH + lineH, width: maxW + indent - 4, height: blockH - 4, color: rgb(0.96, 0.98, 0.99) });

    for (const line of lines) {
        drawText(ctx, line, margin + indent, ctx.y, { font: fonts.italic, size, color: C.blockqFg });
        ctx.y -= lineH;
    }
    ctx.y -= 4;
    return ctx;
}

function drawCodeBlock(ctx: Ctx, text: string): Ctx {
    const { margin, width, fonts } = ctx;
    const size = 8.5;
    const lineH = size * 1.5;
    const lines = text.split('\n');
    const blockH = lines.length * lineH + 12;
    const maxW = width - margin * 2;

    ctx = ensureSpace(ctx, Math.min(blockH, 100));
    ctx.page.drawRectangle({ x: margin, y: ctx.y - blockH + lineH, width: maxW, height: blockH, color: C.codeBg });

    ctx.y -= 6;
    for (const line of lines) {
        ctx = ensureSpace(ctx, lineH + 2);
        // Wrap long code lines
        const wrapped = wrapText(line || ' ', fonts.regular, size, maxW - 10);
        for (const wl of wrapped) {
            drawText(ctx, wl, margin + 6, ctx.y, { font: fonts.regular, size, color: C.black });
            ctx.y -= lineH;
        }
    }
    ctx.y -= 6;
    return ctx;
}

// ── Footer / Page Numbering ──────────────────────────────────────────────────

function stampFooters(doc: PDFDocument, fonts: any, totalPages: number, jobId: string) {
    const pages = doc.getPages();
    for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        const { width } = p.getSize();
        const footerY = 24;
        const text = `ACEPLACE Intelligence Report -- job-${jobId}   Page ${i + 1} of ${totalPages}`;
        const size = 7;
        const textW = fonts.regular.widthOfTextAtSize(text, size);

        p.drawText(text, {
            x: (width - textW) / 2,
            y: footerY,
            size,
            font: fonts.regular,
            color: rgb(0.5, 0.5, 0.5),
        });
    }
}

// ── Main Export ───────────────────────────────────────────────────────────────

export async function exportToPDF(content: string, filename: string) {
    const doc = await PDFDocument.create();
    const regular = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
    const boldItalic = await doc.embedFont(StandardFonts.HelveticaBoldOblique);

    const fonts = { regular, bold, italic, boldItalic };
    const margin = 45;
    const footerReserve = 30;

    // Create first page
    const firstPage = doc.addPage();
    const { width, height } = firstPage.getSize();
    firstPage.drawRectangle({ x: 0, y: height - 4, width, height: 4, color: C.accent });
    firstPage.drawRectangle({ x: 0, y: 0, width: 3, height, color: rgb(0.9, 0.9, 0.9) });

    let ctx: Ctx = {
        doc, page: firstPage, fonts,
        y: height - margin,
        margin, width, height,
        pageNumber: 1, totalPages: 1,
        footerReserve,
    };

    // Parse content — look for special metadata block at top
    const rawLines = content.replace(/\r\n/g, '\n').split('\n');

    // We'll detect cover block: first ### Audit Metadata section
    let coverMetadata: Record<string, string> = {};
    let coverTitle = '';
    let coverSubtitle = '';
    let bodyLines: string[] = [];
    let inMetaBlock = false;
    let headerParsed = false;

    for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i];
        if (!headerParsed && line.startsWith('# ')) {
            coverTitle = line.slice(2).trim();
            continue;
        }
        if (!headerParsed && line.startsWith('## Audit Metadata')) {
            inMetaBlock = true;
            headerParsed = true;
            continue;
        }
        if (inMetaBlock) {
            const m = line.match(/^\*\s*\*\*(.+?)\*\*[:\s]+(.+)$/);
            if (m) {
                coverMetadata[m[1].trim()] = m[2].trim();
                continue;
            }
            if (line.startsWith('## ') || line.startsWith('# ')) {
                inMetaBlock = false;
                bodyLines.push(line);
                continue;
            }
            if (line.trim() === '') continue; // skip blanks in meta block
            inMetaBlock = false;
            bodyLines.push(line);
        } else {
            bodyLines.push(line);
        }
    }

    // Draw cover header block
    const generatedAt = coverMetadata['Generated At'] || new Date().toLocaleString();
    const status = coverMetadata['Status'] || '';
    const jobId = coverMetadata['Job ID'] || filename.replace('-full-report.pdf', '');

    // Remove Generated At from the grid since it goes in subtitle
    const gridMeta: Record<string, string> = {};
    for (const [k, v] of Object.entries(coverMetadata)) {
        if (k !== 'Generated At') gridMeta[k] = v;
    }

    coverSubtitle = `Generated: ${generatedAt}  |  Status: ${status}`;
    drawCoverHeader(ctx, coverTitle || 'Intelligence Report', coverSubtitle, gridMeta);

    // ── Render body ───────────────────────────────────────────────────────────
    let inCodeBlock = false;
    let codeBuf: string[] = [];

    for (let i = 0; i < bodyLines.length; i++) {
        const raw = bodyLines[i];

        // Code block fence
        if (raw.trim().startsWith('```')) {
            if (!inCodeBlock) {
                inCodeBlock = true;
                codeBuf = [];
            } else {
                inCodeBlock = false;
                ctx = drawCodeBlock(ctx, codeBuf.join('\n'));
                codeBuf = [];
            }
            continue;
        }
        if (inCodeBlock) { codeBuf.push(raw); continue; }

        // Blank line
        if (!raw.trim()) {
            ctx.y -= 6;
            continue;
        }

        // Headings
        if (raw.startsWith('# ')) {
            ctx = drawH1(ctx, raw.slice(2).trim());
            continue;
        }
        if (raw.startsWith('## ')) {
            ctx = drawH2(ctx, raw.slice(3).trim());
            continue;
        }
        if (raw.startsWith('### ')) {
            ctx = drawH3(ctx, raw.slice(4).trim());
            continue;
        }
        if (raw.startsWith('#### ')) {
            ctx = ensureSpace(ctx, 18);
            ctx.y -= 4;
            drawText(ctx, raw.slice(5).trim(), ctx.margin, ctx.y, { font: fonts.boldItalic, size: 10, color: C.black });
            ctx.y -= 14;
            continue;
        }

        // Horizontal rule
        if (/^[-*]{3,}$/.test(raw.trim())) {
            ctx = ensureSpace(ctx, 10);
            drawRule(ctx, ctx.margin, ctx.y, ctx.width - ctx.margin * 2, 0.5, C.ruleMed);
            ctx.y -= 10;
            continue;
        }

        // Blockquote
        if (raw.startsWith('> ')) {
            ctx = drawBlockquote(ctx, raw.slice(2).trim());
            continue;
        }

        // Bullets: *, -, + at top level or indented
        const bulletMatch = raw.match(/^(\s*)[*\-+]\s+(.+)$/);
        if (bulletMatch) {
            const depth = Math.floor(bulletMatch[1].length / 2);
            ctx = drawBullet(ctx, bulletMatch[2], depth);
            continue;
        }

        // Numbered list
        const numMatch = raw.match(/^(\s*)\d+[.)]\s+(.+)$/);
        if (numMatch) {
            const depth = Math.floor(numMatch[1].length / 2);
            ctx = drawBullet(ctx, numMatch[2], depth);
            continue;
        }

        // Normal paragraph (may contain **bold**)
        ctx = drawParagraph(ctx, raw);
    }

    // Flush any unclosed code block
    if (inCodeBlock && codeBuf.length) {
        ctx = drawCodeBlock(ctx, codeBuf.join('\n'));
    }

    // Stamp footers with final page count
    const totalPages = doc.getPageCount();
    stampFooters(doc, fonts, totalPages, jobId);

    // Save & download
    const pdfBytes = await doc.save();
    const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
