import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const visitId = searchParams.get('visitId');
	const itemCode = searchParams.get('itemCode');
	if (!visitId || !itemCode) return NextResponse.json({ error: 'visitId and itemCode required' }, { status: 400 });
	const visits = await query<{ siteName: string }>(`select site_name as "siteName" from visits where id = $1`, [visitId]);
	if (!visits[0]) return NextResponse.json({ hint: null });
	const siteName = visits[0].siteName;
	const rows = await query<{ unit_price: string | null }>(
		`select f.unit_price from findings f join visits v on v.id = f.visit_id where v.site_name = $1 and f.item_code = $2 and f.unit_price is not null order by f.id desc limit 1`,
		[siteName, itemCode],
	);
	return NextResponse.json({ hint: rows[0]?.unit_price ?? null });
}




