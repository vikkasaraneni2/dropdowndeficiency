"use client";
import { set, get, del } from 'idb-keyval';

type PendingRequest = {
	id: string; // uuid
	url: string;
	method: 'POST' | 'PATCH';
	body: unknown;
	headers?: Record<string, string>;
};

const PENDING_KEY = 'cec_pending_requests';
const DRAFT_KEY_PREFIX = 'cec_draft_';

export async function saveDraft<T>(key: string, value: T) {
	await set(DRAFT_KEY_PREFIX + key, value);
}

export async function loadDraft<T>(key: string): Promise<T | undefined> {
	return await get(DRAFT_KEY_PREFIX + key);
}

export async function clearDraft(key: string) {
	await del(DRAFT_KEY_PREFIX + key);
}

async function loadQueue(): Promise<PendingRequest[]> {
	return (await get(PENDING_KEY)) || [];
}

async function saveQueue(q: PendingRequest[]) {
	await set(PENDING_KEY, q);
}

export async function enqueueRequest(req: PendingRequest) {
	const q = await loadQueue();
	q.push(req);
	await saveQueue(q);
}

export async function processQueue() {
	const q = await loadQueue();
	if (!q.length) return;
	const remaining: PendingRequest[] = [];
	for (const item of q) {
		try {
			const res = await fetch(item.url, {
				method: item.method,
				headers: { 'Content-Type': 'application/json', ...(item.headers || {}) },
				body: JSON.stringify(item.body),
			});
			if (!res.ok) throw new Error('non-2xx');
		} catch {
			remaining.push(item);
		}
	}
	await saveQueue(remaining);
}

export function setupBackgroundSync() {
	if (typeof window === 'undefined') return;
	window.addEventListener('online', () => {
		processQueue();
	});
}


