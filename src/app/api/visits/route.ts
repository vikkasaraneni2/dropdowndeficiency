import { NextRequest, NextResponse } from 'next/server';
import { CreateVisitSchema } from '@/lib/schemas';
import { createVisit, listCatalog } from '@/lib/dal';

export async function GET() {
	// For bootstrap/testing: return catalog
	const items = await listCatalog();
	return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
	const body = await req.json();
	const parsed = CreateVisitSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json({ error: parsed.error.message }, { status: 400 });
	}
	const { id } = await createVisit(parsed.data);
	return NextResponse.json({ id });
}




