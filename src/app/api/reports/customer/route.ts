import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { put } from '@vercel/blob';
import { ReportRequestSchema } from '@/lib/schemas';
import { query } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { createPdfDoc, tryRegisterGeorgia, formatCurrency, slugify } from '@/lib/pdf';
import { format } from 'date-fns';
// No explicit image-size; rely on PDFKit's fit to preserve aspect ratio
import sharp from 'sharp';

type VisitRow = { id: string; siteName: string; address: string; verticals: string[]; techUserId: string; createdAt: string };
type FindingYesRow = { id: string; item_code: string; item_name: string; unit: string; quantity: number | null; unit_price: string | null; line_total: number | null; notes: string; whyItMatters: string };
type FindingNoRow = { id: string; item_code: string; item_name: string };

async function fetchReportData(visitId: string) {
    const visits = await query<VisitRow>(
        `select id, site_name as "siteName", address, verticals, tech_user_id as "techUserId", created_at as "createdAt" from visits where id = $1`,
        [visitId]
    );
    const visit = visits[0];
    const yesFindings = await query<FindingYesRow>(
        `select f.*, c.name as item_name, c.unit, c.why_it_matters as "whyItMatters" from findings f join catalog_items c on f.item_code = c.code where f.visit_id = $1 and f.decision = 'Yes' order by c.code`,
        [visitId]
    );
    const noFindings = await query<FindingNoRow>(
        `select f.id, f.item_code, c.name as item_name from findings f join catalog_items c on f.item_code = c.code where f.visit_id = $1 and f.decision = 'No' order by c.code`,
        [visitId]
    );
    const attachments = await query<{ finding_id: string | null; blob_url: string; file_name: string; mime_type: string; tags: string[] }>(
        `select finding_id, blob_url, file_name, mime_type, tags from attachments where visit_id = $1 order by file_name`,
        [visitId]
    );
    return { visit, yesFindings, noFindings, attachments };
}

export async function POST(req: NextRequest) {
    try {
        const json = await req.json();
        const parsed = ReportRequestSchema.safeParse(json);
        if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

        const { visit, yesFindings, noFindings, attachments } = await fetchReportData(parsed.data.visitId);
        console.log('[report:customer] visit', parsed.data.visitId, 'yesFindings', yesFindings.length, 'noFindings', noFindings.length, 'attachments', attachments.length);
        if (!visit) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });

        const { doc, margins } = await createPdfDoc({ marginsIn: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 } });
        const chunks: Uint8Array[] = [];
        doc.on('data', (c: unknown) => chunks.push(c as Uint8Array));
        const done: Promise<Buffer> = new Promise((resolve) => { doc.on('end', () => resolve(Buffer.concat(chunks))); });
        tryRegisterGeorgia(doc);
        (doc as unknown as { addPage: () => void }).addPage();
        (doc as unknown as { info: Record<string, unknown> }).info = {
            Title: 'Customer Bill',
            Author: 'CEC',
            Subject: visit.siteName,
            Keywords: 'CEC, Electrical, PM, Report',
            CreationDate: new Date(),
            ModDate: new Date(),
        };

        // Cover + summary
        doc.fontSize(22).fillColor('#111111').text('Customer Bill', { align: 'center' });
        doc.moveDown(0.75);
        doc.fontSize(14).text(`Site: ${visit.siteName}`, { align: 'center' });
        doc.text(`Address: ${visit.address}`, { align: 'center' });
        doc.text(`Technician: ${visit.techUserId}`, { align: 'center' });
        doc.moveDown(0.75);
        const allYesFindings = yesFindings;
        // brief summary list under the title – include all Yes items (quote or priced)
        doc.fontSize(16).fillColor('#111111').text(`Deficiencies found: ${allYesFindings.length}`);
        for (const f of allYesFindings) {
            const needsQuote = (f as unknown as { send_to_quote?: boolean }).send_to_quote === true;
            doc.fontSize(14).text(`• ${f.item_code} — ${f.item_name}${needsQuote ? '  (Needs Quote)' : ''}`);
            doc.moveDown(0.25);
        }
        doc.moveDown(0.8);
        // Summary of findings (plain language)
        doc.fontSize(16).fillColor('#111111').text('Summary of findings', { align: 'left' });
        doc.moveDown(0.4);
        const humanDescriptions: Record<string, string> = {
            'AO-ALCU': 'Aluminum-to-copper terminations are prone to oxide build-up and loosening over time. Applying antioxidant compound and properly re-torquing helps prevent hot joints that can lead to nuisance trips, equipment damage, or fire risk.',
            'HND-TIE': 'Handle ties or common-trip breakers ensure two circuits that share a neutral (MWBC) or are otherwise paired will disconnect together. Without this, parts of the circuit can remain energized unexpectedly, increasing shock and backfeed hazards.',
            'SVC-UPG': 'Legacy service gear can lack modern safety features or capacity and can be difficult to maintain. Upgrading increases capacity, reliability, and safety while retiring obsolete components that pose operational and compliance risks.'
        };
        for (const f of allYesFindings) {
            const summary = humanDescriptions[f.item_code] || f.whyItMatters || '';
            if (summary) {
                doc.fontSize(12).fillColor('#111111').text(`${f.item_code} — ${summary}`, { width: (doc as unknown as { page: { width: number } }).page.width - margins.left - margins.right });
                doc.moveDown(0.4);
            }
        }
        doc.moveDown(0.75);
        // Start detailed sections on a new page
        try { doc.addPage(); } catch {}

        for (const f of allYesFindings) {
            const qty = f.quantity ?? 0;
            const unitPrice = f.unit_price ? Number(f.unit_price) : 0;
            const line = f.line_total ?? (qty * unitPrice);
            const needsQuote = (f as unknown as { send_to_quote?: boolean }).send_to_quote === true;
            doc.fontSize(12).text(`${f.item_code} — ${f.item_name}${needsQuote ? '  (Needs Quote)' : ''}`);
            doc.moveDown(0.15);
            doc.fontSize(11).text(`Qty: ${qty} ${f.unit}    Unit: ${formatCurrency(unitPrice)}    Line: ${formatCurrency(line || 0)}`);
            if (f.notes) { doc.moveDown(0.15); doc.fontSize(11).text(`Notes: ${f.notes}`); }
            doc.moveDown(0.75);

            const imgs = attachments.filter(a => a.finding_id === f.id && a.mime_type.startsWith('image/'));
            console.log('[report:customer] finding', f.id, f.item_code, 'images', imgs.map(i => ({ id: i.finding_id, name: i.file_name, url: i.blob_url, mime: i.mime_type })));
            for (const [idx, img] of imgs.entries()) {
                try {
                    const res = await fetch(img.blob_url, { cache: 'no-store' });
                    if (!res.ok) {
                        console.error('[report:customer] fetch image failed', img.file_name, img.blob_url, res.status);
                        throw new Error(`fetch ${res.status}`);
                    }
                    const ab = await res.arrayBuffer();
                    let buf = Buffer.from(ab);
                    // Convert unsupported formats to PNG for PDFKit
                    try {
                        const meta = await sharp(buf).metadata();
                        const format = meta.format || '';
                        if (!['jpeg','jpg','png'].includes(format)) {
                            const converted = await sharp(buf).png().toBuffer();
                            buf = Buffer.from(converted);
                        }
                    } catch (e) { console.warn('[report:customer] sharp meta/convert warning for', img.file_name, String(e)); }
                    const pageW = (doc as unknown as { page: { width: number } }).page.width as number;
                    const pageH = (doc as unknown as { page: { height: number } }).page.height as number;
                    const availW = pageW - margins.left - margins.right;
                    const captionSpace = 24;
                    const availH = pageH - margins.top - margins.bottom - captionSpace;
                    const x = margins.left;
                    const y = margins.top;
                    doc.addPage();
                    // Use data URL to avoid any internal fs access paths in pdfkit
                    const dataUrl = `data:image/png;base64,${buf.toString('base64')}`;
                    const imageOpts = { fit: [availW, availH], align: 'center', valign: 'center' } as unknown as Record<string, unknown>;
                    doc.image(dataUrl, x, y, imageOpts);
                    console.log('[report:customer] embedded image', img.file_name, 'size', buf.length);
                    doc.fontSize(9).fillColor('#555555').text(`${f.item_code} ${f.item_name} · Photo ${idx + 1}/${imgs.length}`, margins.left, y + availH + 6, { width: availW, align: 'center' });
                } catch (e) {
                    console.error('[report:customer] embed image error', img.file_name, img.blob_url, String(e));
                    doc.addPage();
                    doc.fontSize(12).fillColor('#111111').text(`Image unavailable: ${img.file_name || 'file'}`, { align: 'center' });
                }
            }
        }

        // Final Bill table (compact)
        try {
            doc.addPage();
        } catch {}
        doc.fontSize(14).fillColor('#111111').text('Final Bill', { align: 'left' });
        doc.moveDown(0.25);
        // Table header
        const pageW = (doc as unknown as { page: { width: number } }).page.width as number;
        const leftX = margins.left;
        const rightEdge = pageW - margins.right;
        const colItemW = Math.round((rightEdge - leftX) * 0.55);
        const colQtyW = Math.round((rightEdge - leftX) * 0.15);
        const colUnitW = Math.round((rightEdge - leftX) * 0.15);
        const colExtW  = Math.round((rightEdge - leftX) * 0.15);
        const startY = (doc as unknown as { y: number }).y as unknown as number;
        doc.fontSize(11).fillColor('#111111');
        doc.text('Item', leftX, startY, { width: colItemW });
        doc.text('Quantity', leftX + colItemW, startY, { width: colQtyW });
        doc.text('Pricing', leftX + colItemW + colQtyW, startY, { width: colUnitW });
        doc.text('Ext. Pricing', leftX + colItemW + colQtyW + colUnitW, startY, { width: colExtW });
        doc.moveDown(0.25);
        doc.strokeColor('#DDDDDD').moveTo(leftX, (doc as unknown as { y: number }).y as unknown as number).lineTo(rightEdge, (doc as unknown as { y: number }).y as unknown as number).stroke();
        doc.moveDown(0.25);
        // Build billed rows and include quote-only rows (TBD pricing)
        const billed = allYesFindings.map(f => {
            const qty = f.quantity ?? 0;
            const unitNum = f.unit_price ? Number(f.unit_price) : NaN;
            const line = Number.isFinite(unitNum) && qty > 0 ? qty * unitNum : 0;
            const needsQuote = (f as unknown as { send_to_quote?: boolean }).send_to_quote === true;
            return { f, qty, unitNum, line, needsQuote };
        });
        const subtotalBillable = billed.reduce((acc, r) => acc + (r.line || 0), 0);
        for (const row of billed) {
            const { f, qty, unitNum, line, needsQuote } = row;
            doc.fontSize(10).fillColor('#111111');
            const itemLabel = `${f.item_code} — ${f.item_name}${needsQuote ? '  (Needs Quote)' : ''}`;
            const rowTop = (doc as unknown as { y: number }).y as unknown as number;
            doc.text(itemLabel, leftX, rowTop, { width: colItemW });
            doc.text(qty ? String(qty) : '—', leftX + colItemW, rowTop, { width: colQtyW });
            doc.text(Number.isFinite(unitNum) && qty > 0 ? formatCurrency(unitNum) : 'TBD', leftX + colItemW + colQtyW, rowTop, { width: colUnitW });
            doc.text(Number.isFinite(unitNum) && qty > 0 ? formatCurrency(line) : 'TBD', leftX + colItemW + colQtyW + colUnitW, rowTop, { width: colExtW });
            // advance to next row
            doc.moveDown(0.35);
        }
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('#111111').text(`Subtotal: ${formatCurrency(subtotalBillable)}`, { align: 'right' });
        doc.fontSize(12).fillColor('#111111').text(`Total: ${formatCurrency(subtotalBillable)}`, { align: 'right' });

        // Appendix for No items
        if (noFindings.length > 0) {
            doc.addPage();
            doc.fontSize(12).fillColor('#111111').text('Items marked No', { align: 'left' });
            doc.moveDown(0.5);
            for (const n of noFindings) {
                doc.fontSize(10).text(`${n.item_code} — ${n.item_name}: No`);
            }
        }

        doc.end();
        const buffer = await done;

        const id = uuidv4();
        const siteSlug = slugify(visit.siteName);
        const dateStr = format(new Date(), 'yyyyMMdd');
        const fileKey = `reports/${visit.id}/CEC_customer_${siteSlug}_${visit.id}_${dateStr}.pdf`;
        const blob = await put(fileKey, buffer, { access: 'public', contentType: 'application/pdf', addRandomSuffix: true });

        const snapshot = { visit, yesFindings: allYesFindings, noFindings, attachmentsIncluded: attachments.filter(a => a.finding_id).map(a => a.finding_id) };
        await query(
            `insert into reports (id, visit_id, type, generated_by_user_id, pdf_url, included_finding_ids, snapshot)
             values ($1,$2,'customer',$3,$4,$5,$6)`,
            [id, visit.id, visit.techUserId, blob.url, JSON.stringify(allYesFindings.map((f) => (f as unknown as { id: string }).id)), JSON.stringify(snapshot)],
        );

        return NextResponse.json({ id, url: blob.url });
    } catch (err: unknown) {
        console.error('Customer report error', err);
        return new NextResponse(`Customer report error: ${err instanceof Error ? err.message : String(err)}`, { status: 500 });
    }
}


