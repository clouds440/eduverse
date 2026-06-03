import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb, type RGB } from 'pdf-lib';

export const PDF_PAGE_PRESETS = {
    letterPortrait: { width: 612, height: 792 },
    letterLandscape: { width: 792, height: 612 },
} as const;

export type PdfFontWeight = 'regular' | 'bold';

export interface PdfBuilderOptions {
    page?: keyof typeof PDF_PAGE_PRESETS | { width: number; height: number };
    margin?: number;
    title?: string;
    author?: string;
}

export interface PdfTextOptions {
    size?: number;
    font?: PdfFontWeight;
    color?: string;
    maxWidth?: number;
    lineHeight?: number;
}

export interface PdfRectOptions {
    x: number;
    y: number;
    width: number;
    height: number;
    fill?: string;
    stroke?: string;
    borderWidth?: number;
}

export interface PdfTableColumn<T> {
    header: string;
    width: number;
    align?: 'left' | 'center' | 'right';
    render: (row: T) => string;
}

export interface PdfTableOptions<T> {
    x: number;
    y: number;
    columns: PdfTableColumn<T>[];
    rows: T[];
    rowHeight?: number;
    headerHeight?: number;
    fontSize?: number;
    headerFill?: string;
    borderColor?: string;
}

interface PdfImageOptions {
    rounded?: boolean;
}

function resolvePageSize(page: PdfBuilderOptions['page']) {
    if (!page) return PDF_PAGE_PRESETS.letterPortrait;
    if (typeof page === 'string') return PDF_PAGE_PRESETS[page];
    return page;
}

export function sanitizePdfFilename(value: string, fallback = 'document') {
    return value.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase() || fallback;
}

export function hexToRgb(hex: string): RGB {
    const normalized = hex.trim().replace('#', '');
    const safe = /^[0-9a-f]{6}$/i.test(normalized) ? normalized : '111827';
    const intValue = Number.parseInt(safe, 16);
    return rgb(
        ((intValue >> 16) & 255) / 255,
        ((intValue >> 8) & 255) / 255,
        (intValue & 255) / 255,
    );
}

export function downloadPdfBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function wrapPdfText(value: string, maxWidth: number, font: PDFFont, size: number) {
    const words = value.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = '';

    words.forEach((word) => {
        const next = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) > maxWidth && current) {
            lines.push(current);
            current = word;
        } else {
            current = next;
        }
    });

    if (current) lines.push(current);
    return lines.length > 0 ? lines : [''];
}

function bytesToArrayBuffer(bytes: Uint8Array) {
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    return buffer;
}

async function toRoundedPngBytes(bytes: Uint8Array, contentType: string, width: number, height: number) {
    if (typeof document === 'undefined') return null;

    const blob = new Blob([bytesToArrayBuffer(bytes)], { type: contentType || 'image/png' });
    const url = URL.createObjectURL(blob);

    try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });
        const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
        const drawWidth = image.naturalWidth * scale;
        const drawHeight = image.naturalHeight * scale;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * 2));
        canvas.height = Math.max(1, Math.round(height * 2));
        const context = canvas.getContext('2d');
        if (!context) return null;

        context.scale(2, 2);
        context.clearRect(0, 0, width, height);
        context.save();
        const radius = Math.min(width, height) / 2;
        context.beginPath();
        context.moveTo(radius, 0);
        context.lineTo(width - radius, 0);
        context.quadraticCurveTo(width, 0, width, radius);
        context.lineTo(width, height - radius);
        context.quadraticCurveTo(width, height, width - radius, height);
        context.lineTo(radius, height);
        context.quadraticCurveTo(0, height, 0, height - radius);
        context.lineTo(0, radius);
        context.quadraticCurveTo(0, 0, radius, 0);
        context.closePath();
        context.clip();
        context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
        context.restore();

        const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (!pngBlob) return null;
        return new Uint8Array(await pngBlob.arrayBuffer());
    } finally {
        URL.revokeObjectURL(url);
    }
}

export class PdfDocumentBuilder {
    readonly doc: PDFDocument;
    readonly width: number;
    readonly height: number;
    readonly margin: number;
    readonly fonts: Record<PdfFontWeight, PDFFont>;

    page: PDFPage;
    cursorY: number;

    constructor({
        doc,
        page,
        width,
        height,
        margin,
        fonts,
    }: {
        doc: PDFDocument;
        page: PDFPage;
        width: number;
        height: number;
        margin: number;
        fonts: Record<PdfFontWeight, PDFFont>;
    }) {
        this.doc = doc;
        this.page = page;
        this.width = width;
        this.height = height;
        this.margin = margin;
        this.fonts = fonts;
        this.cursorY = height - margin;
    }

    addPage() {
        this.page = this.doc.addPage([this.width, this.height]);
        this.cursorY = this.height - this.margin;
        return this.page;
    }

    ensureSpace(height: number) {
        if (this.cursorY - height >= this.margin) return false;
        this.addPage();
        return true;
    }

    font(weight: PdfFontWeight = 'regular') {
        return this.fonts[weight];
    }

    wrapText(value: string, maxWidth: number, options: { size?: number; font?: PdfFontWeight } = {}) {
        return wrapPdfText(value, maxWidth, this.font(options.font), options.size ?? 10);
    }

    text(value: string, x: number, y: number, options: PdfTextOptions = {}) {
        const size = options.size ?? 10;
        const font = this.font(options.font);
        const color = hexToRgb(options.color ?? '#111827');
        const lines = options.maxWidth ? wrapPdfText(value, options.maxWidth, font, size) : [value];
        const lineHeight = options.lineHeight ?? size * 1.25;

        lines.forEach((line, index) => {
            this.page.drawText(line.replace(/[^\x20-\x7E]/g, ''), {
                x,
                y: y - index * lineHeight,
                size,
                font,
                color,
            });
        });

        return lines;
    }

    rect({ x, y, width, height, fill, stroke, borderWidth = 1 }: PdfRectOptions) {
        this.page.drawRectangle({
            x,
            y,
            width,
            height,
            color: fill ? hexToRgb(fill) : undefined,
            borderColor: stroke ? hexToRgb(stroke) : undefined,
            borderWidth: stroke ? borderWidth : undefined,
        });
    }

    line(x1: number, y1: number, x2: number, y2: number, color = '#E5E7EB', width = 1) {
        this.page.drawLine({
            start: { x: x1, y: y1 },
            end: { x: x2, y: y2 },
            color: hexToRgb(color),
            thickness: width,
        });
    }

    async imageFromUrl(url: string, x: number, y: number, width: number, height: number, options: PdfImageOptions = {}) {
        try {
            const response = await fetch(url);
            if (!response.ok) return false;
            const contentType = response.headers.get('content-type') || '';
            const bytes = new Uint8Array(await response.arrayBuffer());
            const isPng = contentType.includes('png') || /\.png(?:$|\?)/i.test(url);
            const isJpeg = contentType.includes('jpeg') || contentType.includes('jpg') || /\.jpe?g(?:$|\?)/i.test(url);
            const roundedBytes = options.rounded ? await toRoundedPngBytes(bytes, contentType, width, height) : null;
            const image = roundedBytes
                ? await this.doc.embedPng(roundedBytes)
                : isPng
                    ? await this.doc.embedPng(bytes)
                    : isJpeg
                        ? await this.doc.embedJpg(bytes)
                        : null;
            if (!image) return false;

            const scale = Math.min(width / image.width, height / image.height);
            const imageWidth = image.width * scale;
            const imageHeight = image.height * scale;
            this.page.drawImage(image, {
                x: x + (width - imageWidth) / 2,
                y: y + (height - imageHeight) / 2,
                width: imageWidth,
                height: imageHeight,
            });
            return true;
        } catch {
            return false;
        }
    }

    pill(text: string, x: number, y: number, options: { fill?: string; color?: string; width?: number; height?: number; size?: number } = {}) {
        const height = options.height ?? 16;
        const size = options.size ?? 8;
        const font = this.font('bold');
        const width = options.width ?? font.widthOfTextAtSize(text, size) + 12;
        this.rect({ x, y, width, height, fill: options.fill ?? '#F3F4F6', stroke: options.fill ?? '#E5E7EB', borderWidth: 0.5 });
        this.text(text, x + 6, y + 5, { size, font: 'bold', color: options.color ?? '#374151' });
        return { width, height };
    }

    table<T>({ x, y, columns, rows, rowHeight = 24, headerHeight = 22, fontSize = 8, headerFill = '#F3F4F6', borderColor = '#E5E7EB' }: PdfTableOptions<T>) {
        const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);
        this.rect({ x, y: y - headerHeight, width: totalWidth, height: headerHeight, fill: headerFill, stroke: borderColor, borderWidth: 0.5 });
        let columnX = x;
        columns.forEach((column) => {
            this.text(column.header, columnX + 5, y - 14, { size: fontSize, font: 'bold', color: '#4B5563', maxWidth: column.width - 10 });
            columnX += column.width;
        });

        let rowY = y - headerHeight;
        rows.forEach((row) => {
            rowY -= rowHeight;
            this.line(x, rowY, x + totalWidth, rowY, borderColor, 0.5);
            let cellX = x;
            columns.forEach((column) => {
                const value = column.render(row);
                const font = this.font('regular');
                const textWidth = font.widthOfTextAtSize(value, fontSize);
                const textX = column.align === 'right'
                    ? cellX + column.width - textWidth - 5
                    : column.align === 'center'
                        ? cellX + (column.width - textWidth) / 2
                        : cellX + 5;
                this.text(value, textX, rowY + rowHeight - 14, { size: fontSize, maxWidth: column.width - 10 });
                cellX += column.width;
            });
        });

        return y - headerHeight - rows.length * rowHeight;
    }

    async saveAsBlob() {
        const bytes = await this.doc.save();
        return new Blob([bytesToArrayBuffer(bytes)], { type: 'application/pdf' });
    }
}

export async function createPdfBuilder(options: PdfBuilderOptions = {}) {
    const doc = await PDFDocument.create();
    const { width, height } = resolvePageSize(options.page);
    const margin = options.margin ?? 42;
    const regular = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const page = doc.addPage([width, height]);

    if (options.title) doc.setTitle(options.title);
    if (options.author) doc.setAuthor(options.author);
    doc.setCreationDate(new Date());

    return new PdfDocumentBuilder({
        doc,
        page,
        width,
        height,
        margin,
        fonts: { regular, bold },
    });
}
