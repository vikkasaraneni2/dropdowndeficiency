import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
    try {
        const { findingId, attachmentIds } = await req.json();
        if (!findingId || !Array.isArray(attachmentIds) || attachmentIds.length === 0) {
            return NextResponse.json({ error: 'findingId and attachmentIds[] required' }, { status: 400 });
        }
        // Update attachments to link to the finding
        await query(
            `update attachments set finding_id = $1 where id = any($2::uuid[])`,
            [findingId, attachmentIds],
        );
        return NextResponse.json({ ok: true });
    } catch (err: unknown) {
        return new NextResponse(`link error: ${err instanceof Error ? err.message : String(err)}`, { status: 500 });
    }
}




