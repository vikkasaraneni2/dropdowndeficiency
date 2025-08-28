"use client";
import { useState } from 'react';
import { enqueueRequest, saveDraft, clearDraft } from '@/lib/offline';
import { v4 as uuidv4 } from 'uuid';

const ALL_VERTICALS = [
	'All Sites',
	'Restaurants/Food Service',
	'Schools/Offices',
	'YMCA/Natatorium/Pools',
	'Light Manufacturing/Warehouse',
	'Rooftop/Exterior/Renewables/EV',
];

export default function NewVisitPage() {
	const [siteName, setSiteName] = useState('');
	const [address, setAddress] = useState('');
	const [verticals, setVerticals] = useState<string[]>(['All Sites']);
	const [techUserId] = useState('tech-demo');

	async function submit() {
		const payload = { siteName, address, verticals, techUserId, visitNotes: '' };
		const draftKey = `visit_new`;
		await saveDraft(draftKey, payload);
		try {
			const res = await fetch('/api/visits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
			if (!res.ok) throw new Error('offline?');
			const { id } = await res.json();
			await clearDraft(draftKey);
			window.location.href = `/visit/${id}/checklist`;
		} catch {
			await enqueueRequest({ id: uuidv4(), url: '/api/visits', method: 'POST', body: payload });
			alert('Saved offline. Will sync when online.');
		}
	}

	return (
		<div className="p-6 max-w-screen-sm mx-auto space-y-4">
			<h1 className="text-2xl font-semibold">Start a Visit</h1>
			<input className="w-full border border-black/20 rounded p-3" placeholder="Site name" value={siteName} onChange={(e) => setSiteName(e.target.value)} />
			<input className="w-full border border-black/20 rounded p-3" placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
			<button className="w-full bg-black text-white rounded p-3 disabled:opacity-50" disabled={!siteName || !address} onClick={submit}>
				Create Visit
			</button>
		</div>
	);
}


