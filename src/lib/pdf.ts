import fs from 'node:fs';
import path from 'node:path';

export type PdfHeaderFooter = {
	siteName: string;
	reportTitle: string;
	renderedAt: string; // already formatted for display
	visitId: string;
};

type PdfMargins = { top: number; right: number; bottom: number; left: number };

type PdfDocLike = {
	registerFont: (name: string, src: string | Buffer) => void;
	font: (name: string) => unknown;
	fontSize: (pt: number) => PdfDocLike;
	fillColor: (hex: string) => PdfDocLike;
	text: (
		text: string,
		xOrOptions?: number | Record<string, unknown>,
		y?: number,
		options?: Record<string, unknown>
	) => PdfDocLike;
	strokeColor: (hex: string) => PdfDocLike;
	moveTo: (x: number, y: number) => PdfDocLike;
	lineTo: (x: number, y: number) => PdfDocLike;
	stroke: () => PdfDocLike;
	save: () => PdfDocLike;
	restore: () => PdfDocLike;
	image: (src: string | Buffer, x: number, y: number, options?: Record<string, unknown>) => PdfDocLike;
	on: (event: 'data' | 'end' | 'pageAdded', handler: (...args: unknown[]) => void) => void;
	end: () => void;
	moveDown: (lines?: number) => PdfDocLike;
	addPage: () => PdfDocLike;
	page: { number?: number; width?: number; height?: number; margins?: { top: number; bottom: number; left: number; right: number } };
};

export function inchesToPt(inches: number): number {
	return Math.round(inches * 72);
}

export function slugify(input: string): string {
	return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export async function createPdfDoc(options?: { marginsIn?: PdfMargins, size?: 'LETTER' | [number, number] }) {
	const m = options?.marginsIn ?? { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 };
	// Use the standalone build so standard fonts are bundled and no AFM files are read from disk.
	const PDFModule = await import('pdfkit/js/pdfkit.standalone');
	const DocCtor = (PDFModule as unknown as { default: new (opts?: unknown) => unknown }).default;
	// Prevent auto-creating the first page with default Helvetica; we'll set our own font.
	const doc = new DocCtor({ size: options?.size ?? 'LETTER', margin: inchesToPt(m.top), autoFirstPage: false }) as unknown as PdfDocLike;
	const left = inchesToPt(m.left);
	const right = inchesToPt(m.right);
	const top = inchesToPt(m.top);
	const bottom = inchesToPt(m.bottom);

	return { doc, margins: { left, right, top, bottom } };
}

export function tryRegisterGeorgia(doc: PdfDocLike) {
	// Prefer a real TTF font to avoid AFM lookups (Helvetica.afm) that can fail under bundlers.
	const candidates: { name: string; path: string }[] = [
		// Prefer Times New Roman if available
		{ name: 'TimesNewRoman', path: path.join(process.cwd(), 'public', 'fonts', 'Times New Roman.ttf') },
		{ name: 'TimesNewRoman', path: '/System/Library/Fonts/Supplemental/Times New Roman.ttf' },
		// Project fonts
		{ name: 'Georgia', path: path.join(process.cwd(), 'public', 'fonts', 'Georgia.ttf') },
		{ name: 'Georgia', path: path.join(process.cwd(), 'public', 'fonts', 'georgia.ttf') },
		{ name: 'Arial', path: path.join(process.cwd(), 'public', 'fonts', 'Arial.ttf') },
		{ name: 'Arial', path: path.join(process.cwd(), 'public', 'fonts', 'arial.ttf') },
		// macOS system fonts
		{ name: 'Georgia', path: '/Library/Fonts/Georgia.ttf' },
		{ name: 'Georgia', path: '/System/Library/Fonts/Supplemental/Georgia.ttf' },
		{ name: 'Arial', path: '/Library/Fonts/Arial.ttf' },
		{ name: 'Arial', path: '/System/Library/Fonts/Supplemental/Arial.ttf' },
		// Windows system fonts
		{ name: 'Georgia', path: 'C:\\Windows\\Fonts\\georgia.ttf' },
		{ name: 'Arial', path: 'C:\\Windows\\Fonts\\arial.ttf' },
		// Common Linux fonts (if present)
		{ name: 'DejaVu', path: '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf' },
		{ name: 'DejaVu', path: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf' },
	];
	for (const cand of candidates) {
		try {
			if (fs.existsSync(cand.path)) {
				// Read TTF into memory and register from Buffer so the standalone build never calls fs itself.
				const fontBuf = fs.readFileSync(cand.path);
				doc.registerFont('CEC_PRIMARY', fontBuf);
				// Force a real TTF-backed font immediately for the current context
				doc.font('CEC_PRIMARY');
				return 'CEC_PRIMARY';
			}
		} catch {}
	}
	// No safe fallback; require a TTF so we never hit AFM.
	throw new Error('No TTF font found. Add public/fonts/Georgia.ttf (or Arial/DejaVu) and retry.');
}

export function drawHeaderFooter(doc: PdfDocLike, h: PdfHeaderFooter) {
	let isDrawing = false;
	const draw = () => {
		if (isDrawing) return;
		isDrawing = true;
		const pageMeta = doc.page as unknown as { width: number; height: number; margins: { top: number; bottom: number; left: number; right: number }, number?: number };
		const { width, height, margins } = pageMeta;
		const yHeader = Math.max(4, margins.top - 14);
		const yFooter = Math.min(height - 8, height - margins.bottom + 4);
		doc.save();
		// Ensure primary font is selected on every draw; guard if not registered
		try { (doc as unknown as { font: (n: string) => void }).font('CEC_PRIMARY'); } catch {}
		doc.fontSize(9).fillColor('#111111');
		// header
		const colW = (width - margins.left - margins.right) / 3;
		doc.text(h.siteName, margins.left, yHeader, { width: colW, align: 'left', lineBreak: false });
		doc.text(h.reportTitle, width / 2 - colW / 2, yHeader, { width: colW, align: 'center', lineBreak: false });
		doc.text(h.renderedAt, width - margins.right - colW, yHeader, { width: colW, align: 'right', lineBreak: false });
		// rule lines
		doc.strokeColor('#DDDDDD').moveTo(margins.left, margins.top - 6).lineTo(width - margins.right, margins.top - 6).stroke();
		doc.strokeColor('#DDDDDD').moveTo(margins.left, height - margins.bottom + 2).lineTo(width - margins.right, height - margins.bottom + 2).stroke();
		// footer
		doc.fillColor('#111111');
		doc.text(`Visit ${h.visitId}`, margins.left, yFooter, { width: colW, align: 'left', lineBreak: false });
		doc.text('CEC', width / 2 - colW / 2, yFooter, { width: colW, align: 'center', lineBreak: false });
		doc.text(`Page ${doc.page.number ?? ''}`, width - margins.right - colW, yFooter, { width: colW, align: 'right', lineBreak: false });
		doc.restore();
		isDrawing = false;
	};

	// draw once for the current page; callers should invoke again after addPage()
	draw();
}

export function formatCurrency(n: unknown) {
	const num = typeof n === 'number' ? n : Number(n);
	if (!isFinite(num)) return '—';
	return `$${num.toFixed(2)}`;
}

export function maskCurrencyNotes(text: string) {
	return text.replace(/\$/g, '');
}


