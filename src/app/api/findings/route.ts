import { NextRequest, NextResponse } from 'next/server';
import { CreateFindingSchema } from '@/lib/schemas';
import { createFinding, listFindingsByVisit } from '@/lib/dal';

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const visitId = searchParams.get('visitId');
	if (!visitId) return NextResponse.json({ error: 'visitId required' }, { status: 400 });
	const rows = await listFindingsByVisit(visitId);
	return NextResponse.json({ findings: rows });
}

export async function POST(req: NextRequest) {
	const body = await req.json();
	const parsed = CreateFindingSchema.safeParse(body);
	if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
	const idRow = await createFinding(parsed.data);
	return NextResponse.json(idRow);
}




