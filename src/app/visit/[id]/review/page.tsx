"use client";
import { useEffect, useState, use } from 'react';

type ReviewFinding = {
	id: string;
	itemCode: string;
	itemName: string;
	notes: string;
	unit: string;
	quantity: number | null;
	unitPrice: string | null;
	lineTotal: number | null;
	attachments: { id: string; fileName: string }[];
	sendToQuote?: boolean;
	decision?: string;
};

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
	const { id: visitId } = use(params);
	const [findings, setFindings] = useState<ReviewFinding[]>([]);

	useEffect(() => {
		Promise.all([
			fetch(`/api/findings?visitId=${visitId}`).then(r => r.json()),
			fetch(`/api/attachments?visitId=${visitId}`).then(r => r.json()),
		]).then(([fRes, aRes]) => {
			const attachByFinding: Record<string, { id: string; fileName: string }[]> = {};
			(aRes.attachments || []).forEach((a: any) => {
				const key = a.findingId || 'visit';
				(attachByFinding[key] = attachByFinding[key] || []).push({ id: a.id, fileName: a.fileName });
			});
			const mapped: ReviewFinding[] = (fRes.findings || []).map((f: any) => ({
				id: f.id,
				itemCode: f.itemCode || f.item_code,
				itemName: f.itemName || f.item_name || f.itemCode,
				notes: f.notes || '',
				unit: f.unit || '',
				quantity: f.quantity ?? null,
				unitPrice: f.unitPrice || f.unit_price || null,
				lineTotal: f.lineTotal ?? f.line_total ?? null,
				attachments: attachByFinding[f.id] || [],
				sendToQuote: (f.sendToQuote ?? f.send_to_quote) || false,
				decision: f.decision,
			}));
			setFindings(mapped);
		});
	}, [visitId]);

	async function genCustomer() {
		const res = await fetch('/api/reports/customer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitId }) });
		const txt = await res.text();
		if (!res.ok) { alert(`Report error: ${res.status} ${txt}`); return; }
		try { const j = JSON.parse(txt); if (j.url) window.open(j.url, '_blank'); } catch { alert('Report ready but malformed response'); }
	}

	async function genInsurer() {
		const res = await fetch('/api/reports/insurer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitId }) });
		const txt = await res.text();
		if (!res.ok) { alert(`Report error: ${res.status} ${txt}`); return; }
		try { const j = JSON.parse(txt); if (j.url) window.open(j.url, '_blank'); } catch { alert('Report ready but malformed response'); }
	}

	const subtotal = findings.reduce((acc, f) => acc + (Number(f.lineTotal ?? 0) || 0), 0);
	const needsQuote = findings.filter((f) => !!f.sendToQuote).length;
	const billedRows = findings
		.map((f) => {
			const qty = Number(f.quantity ?? 0);
			const unit = parseFloat(String(f.unitPrice ?? '').replace(/[$,\s]/g, ''));
			const line = f.lineTotal != null ? Number(f.lineTotal) : (Number.isFinite(qty) && Number.isFinite(unit) ? qty * unit : 0);
			return { ...f, qty, unit, line };
		})
		.filter((r) => Number(r.line) > 0);

	return (
		<div className="p-4 space-y-4">
			<h1 className="text-xl font-semibold">Review</h1>
			<div className="text-sm opacity-70">{findings.length} findings saved</div>
			<div className="space-y-4">
				{findings.map(f => (
					<div key={f.id} className="border rounded p-3">
						<div className="font-medium mb-1 flex items-center gap-2">
							<span>{f.itemCode} — {f.itemName}</span>
							{f.sendToQuote ? (<span className="inline-block text-xs px-2 py-0.5 border rounded bg-yellow-50">Needs Quote</span>) : null}
						</div>
						{f.notes && <div className="text-sm mb-1">Notes: {f.notes}</div>}
						<div className="text-sm mb-1">Quantity: {f.quantity ?? '—'} {f.unit}</div>
						<div className="text-sm mb-1">Unit price: {f.unitPrice ?? '—'}</div>
						<div className="text-sm mb-2">Line total: {f.lineTotal != null ? `$${Number(f.lineTotal).toFixed(2)}` : '—'}</div>
						{f.attachments.length > 0 && (
							<div className="text-sm">
								<div className="font-medium">Attachments:</div>
								<ul className="list-disc pl-5">
									{f.attachments.map((a, i) => (
										<li key={`${a.id || a.fileName}-${i}`}>{a.fileName}</li>
									))}
								</ul>
							</div>
						)}
					</div>
				))}
				<div className="border rounded p-3">
					<div className="flex justify-between">
						<div>Subtotal</div>
						<div>${subtotal.toFixed(2)}</div>
					</div>
					{needsQuote > 0 && (
						<div className="mt-1 text-sm text-yellow-700">Needs Quote: {needsQuote} item{needsQuote === 1 ? '' : 's'}</div>
					)}
				</div>
			</div>
			{billedRows.length > 0 && (
				<div className="border rounded p-3">
					<div className="font-medium mb-2">Final Bill</div>
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="text-left border-b">
									<th className="py-1 pr-2">Item</th>
									<th className="py-1 pr-2">Quantity</th>
									<th className="py-1 pr-2">Pricing</th>
									<th className="py-1 pr-2">Ext. Pricing</th>
								</tr>
							</thead>
							<tbody>
								{billedRows.map((r) => (
									<tr key={r.id} className="border-b last:border-b-0">
										<td className="py-1 pr-2 whitespace-nowrap">{r.itemCode} — {r.itemName}</td>
										<td className="py-1 pr-2">{Number.isFinite(r.qty) ? r.qty : '—'}</td>
										<td className="py-1 pr-2">{Number.isFinite(r.unit) ? `$${r.unit.toFixed(2)}` : (r.unitPrice ?? '—')}</td>
										<td className="py-1 pr-2">${Number(r.line).toFixed(2)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<div className="mt-2 flex justify-between">
						<div className="opacity-70">Total</div>
						<div className="font-medium">${subtotal.toFixed(2)}</div>
					</div>
				</div>
			)}
			<div className="flex gap-2">
				<button className="px-3 py-2 bg-black text-white rounded" onClick={genCustomer}>Generate Customer Bill</button>
				<button className="px-3 py-2 border rounded" onClick={genInsurer}>Generate Insurer Report</button>
			</div>
		</div>
	);
}


