import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { AttachmentSchema } from '@/lib/schemas';
import { query } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
	const body = await req.json();
	const parsed = AttachmentSchema.safeParse(body);
	if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

	const { visitId, findingId, fileName, mimeType, dataBase64, tags } = parsed.data;
	const id = uuidv4();

	const buffer = Buffer.from(dataBase64, 'base64');
	if (buffer.length > 25 * 1024 * 1024) {
		return NextResponse.json({ error: 'File too large' }, { status: 400 });
	}

	if (!['image/jpeg', 'image/png', 'application/pdf'].includes(mimeType)) {
		return NextResponse.json({ error: 'Unsupported mime type' }, { status: 400 });
	}

	const blob = await put(`attachments/${visitId}/${id}-${fileName}`, buffer, {
		access: 'public',
		contentType: mimeType,
	});

	await query(
		`insert into attachments (id, visit_id, finding_id, blob_url, file_name, mime_type, size_bytes, tags)
		 values ($1,$2,$3,$4,$5,$6,$7,$8)`,
		[id, visitId, findingId ?? null, blob.url, fileName, mimeType, buffer.length, JSON.stringify(tags ?? [])],
	);

	return NextResponse.json({ id, url: blob.url });
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const visitId = searchParams.get('visitId');
    if (!visitId) return NextResponse.json({ error: 'visitId required' }, { status: 400 });
    const rows = await query(
        `select id, visit_id as "visitId", finding_id as "findingId", blob_url as "blobUrl", file_name as "fileName", mime_type as "mimeType", size_bytes as "sizeBytes", tags from attachments where visit_id = $1 order by file_name`,
        [visitId],
    );
    return NextResponse.json({ attachments: rows });
}
