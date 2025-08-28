import { NextRequest, NextResponse } from 'next/server';
import { getVisit, updateVisit } from '@/lib/dal';
import { UpdateVisitSchema } from '@/lib/schemas';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
	const { id } = await params;
	const visit = await getVisit(id);
	if (!visit) return NextResponse.json({ error: 'Not found' }, { status: 404 });
	return NextResponse.json(visit);
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
	const body = await req.json();
	const parsed = UpdateVisitSchema.safeParse(body);
	if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
	const { id } = await params;
	const updated = await updateVisit(id, parsed.data);
	return NextResponse.json(updated);
}


