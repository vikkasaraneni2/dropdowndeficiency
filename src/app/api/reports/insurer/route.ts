import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { put } from '@vercel/blob';
import { ReportRequestSchema } from '@/lib/schemas';
import { query } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { createPdfDoc, tryRegisterGeorgia, maskCurrencyNotes, slugify } from '@/lib/pdf';
import { format } from 'date-fns';
// No explicit image-size; rely on PDFKit 'fit' to keep aspect ratio
import sharp from 'sharp';

type VisitRow = { id: string; siteName: string; address: string; verticals: string[]; techUserId: string; createdAt: string };
type FindingRow = { id: string; item_code: string; item_name: string; unit: string; quantity: number | null; notes: string; whyItMatters: string };

async function fetchReportData(visitId: string) {
	const visits = await query<VisitRow>(`select id, site_name as "siteName", address, verticals, tech_user_id as "techUserId", created_at as "createdAt" from visits where id = $1`, [visitId]);
	const visit = visits[0];
	const findings = await query<FindingRow>(
		`select f.*, c.name as item_name, c.unit, c.verticals, c.why_it_matters as "whyItMatters" from findings f join catalog_items c on f.item_code = c.code where f.visit_id = $1 and f.decision = 'Yes' order by c.code`,
		[visitId],
	);
	const attachments = await query<{ finding_id: string | null; blob_url: string; file_name: string; mime_type: string; tags: string[] }>(
		`select finding_id, blob_url, file_name, mime_type, tags from attachments where visit_id = $1 order by file_name`,
		[visitId],
	);
	return { visit, findings, attachments };
}

export async function POST(req: NextRequest) {
	const json = await req.json();
	const parsed = ReportRequestSchema.safeParse(json);
	if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

	const { visit, findings, attachments } = await fetchReportData(parsed.data.visitId);
	if (!visit) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });

	const { doc, margins } = await createPdfDoc({ marginsIn: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 } });
	const chunks: Uint8Array[] = [];
	doc.on('data', (c: unknown) => chunks.push(c as Uint8Array));
	const done: Promise<Buffer> = new Promise((resolve) => { doc.on('end', () => resolve(Buffer.concat(chunks))); });
	const fontName = tryRegisterGeorgia(doc);
	// Create the first page after selecting a real TTF font
	(doc as unknown as { addPage: () => void }).addPage();
	(doc as unknown as { info: Record<string, unknown> }).info = {
		Title: 'Insurer Report',
		Author: 'CEC',
		Subject: visit.siteName,
		Keywords: 'CEC, Electrical, PM, Report',
		CreationDate: new Date(),
		ModDate: new Date(),
	};
	// Cover + summary
	(doc as unknown as { font: (name: string) => void }).font('CEC_PRIMARY');
	doc.fontSize(14).fillColor('#111111').text('Insurer Report', { align: 'center' });
	doc.moveDown(0.5);
	doc.fontSize(10).fillColor('#111111').text(`Site: ${visit.siteName}`);
	doc.text(`Address: ${visit.address}`);
	doc.text(`Technician: ${visit.techUserId}`);
	doc.moveDown(0.5);
	const yesCount = findings.length;
	doc.fontSize(10).fillColor('#111111').text(`Deficiencies: ${yesCount}`);
	doc.moveDown(0.25);

	for (const f of findings) {
		doc.text(`${f.item_code} — ${f.item_name}`);
		doc.text(`Qty: ${f.quantity ?? 0} ${f.unit}`);
		if (f.notes) doc.text(`Notes: ${maskCurrencyNotes(f.notes)}`);
		if (f.whyItMatters) doc.text(`Underwriting Rationale: ${f.whyItMatters}`);
		doc.moveDown(0.5);
		const imgs = attachments.filter(a => a.finding_id === f.id && a.mime_type.startsWith('image/'));
		for (const [idx, img] of imgs.entries()) {
			doc.addPage();
			const res = await fetch(img.blob_url, { cache: 'no-store' });
			let buf = Buffer.from(await res.arrayBuffer());
			try {
				const meta = await sharp(buf).metadata();
				const format = meta.format || '';
				if (!['jpeg','jpg','png'].includes(format)) {
					buf = await sharp(buf).png().toBuffer();
				}
			} catch {}
			const pageW = (doc as unknown as { page: { width: number } }).page.width as number;
			const pageH = (doc as unknown as { page: { height: number } }).page.height as number;
			const availW = pageW - margins.left - margins.right;
			const captionSpace = 24;
			const availH = pageH - margins.top - margins.bottom - captionSpace;
			const x = margins.left;
			const y = margins.top;
			const dataUrl = `data:image/png;base64,${buf.toString('base64')}`;
			const imageOpts = { fit: [availW, availH], align: 'center', valign: 'center' } as unknown as Record<string, unknown>;
			doc.image(dataUrl, x, y, imageOpts);
			doc.fontSize(9).fillColor('#555555').text(`${f.item_code} ${f.item_name} · Photo ${idx + 1}/${imgs.length}`, margins.left, y + availH + 6, { width: availW, align: 'center' });
		}
	}

	doc.end();
	const buffer = await done;

	const id = uuidv4();
	const siteSlug = slugify(visit.siteName);
	const dateStr = format(new Date(), 'yyyyMMdd');
	const fileKey = `reports/${visit.id}/CEC_insurer_${siteSlug}_${visit.id}_${dateStr}.pdf`;
	const blob = await put(fileKey, buffer, { access: 'public', contentType: 'application/pdf', addRandomSuffix: true });

	const snapshot = { visit, findings, attachmentsIncluded: attachments.filter(a => a.finding_id).map(a => a.finding_id) };
	await query(
		`insert into reports (id, visit_id, type, generated_by_user_id, pdf_url, included_finding_ids, snapshot)
		 values ($1,$2,'insurer',$3,$4,$5,$6)`,
		[id, visit.id, visit.techUserId, blob.url, JSON.stringify(findings.map((f) => (f as unknown as { id: string }).id)), JSON.stringify(snapshot)],
	);

	return NextResponse.json({ id, url: blob.url });
}


