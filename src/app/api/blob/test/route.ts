import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';

export async function GET() {
	// Write a small text blob and return its public URL
	const key = `test/${Date.now()}.txt`;
	const blob = await put(key, 'Hello World!', { access: 'public', contentType: 'text/plain' });
	return NextResponse.json({ url: blob.url });
}

export async function POST(req: NextRequest) {
	const { path, content } = await req.json().catch(() => ({ path: `test/${Date.now()}.txt`, content: 'Hello World!' }));
	const blob = await put(path || `test/${Date.now()}.txt`, content || 'Hello World!', { access: 'public', contentType: 'text/plain' });
	return NextResponse.json({ url: blob.url });
}




