"use client";
import { useEffect, useMemo, useState } from 'react';
import { enqueueRequest, saveDraft, loadDraft } from '@/lib/offline';
import { v4 as uuidv4 } from 'uuid';

type CatalogItem = { code: string; name: string; unit: string; simple: boolean; verticals: string[]; whyItMatters: string };

type UploadedMeta = { id: string; url: string; fileName: string };
type Decision = {
    decision?: 'Yes'|'No'|'Other';
    otherReason?: string;
    quantity?: number;
    unitPrice?: string;
    sendToQuote?: boolean;
    notes?: string;
    attachments?: string[]; // attachment ids
    uploaded?: UploadedMeta[]; // local display list
    extraPromptFields?: Record<string, unknown>;
};

function Segmented({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
        <div className="inline-flex rounded-full border overflow-hidden">
            {['Yes', 'No', 'Other'].map((opt) => (
                <button key={opt} onClick={() => onChange(opt)} className={`px-3 py-1 text-sm ${value === opt ? 'bg-black text-white' : ''}`}>{opt}</button>
            ))}
        </div>
    );
}

export default function ChecklistClient({ visitId }: { visitId: string }) {
    const [catalog, setCatalog] = useState<CatalogItem[]>([]);
    const [decisions, setDecisions] = useState<Record<string, Decision>>({});
    const [savingAll, setSavingAll] = useState(false);

    useEffect(() => {
        fetch('/api/visits').then(r => r.json()).then((j) => setCatalog(j.items));
        loadDraft<Record<string, Decision>>(`visit_${visitId}_decisions`).then((d) => d && setDecisions(d));
    }, [visitId]);

    function updateDecision(code: string, patch: Partial<Decision>) {
        setDecisions((prev) => {
            const next = { ...prev, [code]: { ...(prev[code] || {}), ...patch } };
            saveDraft(`visit_${visitId}_decisions`, next);
            return next;
        });
    }

    function clearItem(code: string) {
        setDecisions((prev) => {
            const next = { ...prev };
            delete next[code];
            saveDraft(`visit_${visitId}_decisions`, next);
            return next;
        });
    }

    async function saveFinding(code: string) {
        const d = decisions[code];
        if (!d) return;
        const payload = {
            visitId,
            itemCode: code,
            decision: d.decision,
            otherReason: d.otherReason ?? null,
            quantity: d.quantity ?? null,
            unitPrice: d.unitPrice ?? null,
            sendToQuote: d.sendToQuote ?? false,
            notes: d.notes ?? '',
            attachments: d.attachments ?? [],
            extraPromptFields: d.extraPromptFields || {},
        };
        try {
            const res = await fetch('/api/findings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!res.ok) throw new Error('offline');
            const created = await res.json();
            // Link uploaded attachments to this finding
            const attachIds = (d.attachments || []);
            if (attachIds.length > 0 && created?.id) {
                await fetch('/api/attachments/link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ findingId: created.id, attachmentIds: attachIds }) });
            }
            alert('Saved');
        } catch {
            await enqueueRequest({ id: uuidv4(), url: '/api/findings', method: 'POST', body: payload });
            alert('Saved offline');
        }
    }

    async function saveAll() {
        if (savingAll) return;
        setSavingAll(true);
        try {
            const entries = Object.entries(decisions).filter(([_, d]) => !!d?.decision);
            for (const [code, d] of entries) {
                const payload = {
                    visitId,
                    itemCode: code,
                    decision: d.decision,
                    otherReason: d.otherReason ?? null,
                    quantity: d.quantity ?? null,
                    unitPrice: d.unitPrice ?? null,
                    sendToQuote: d.sendToQuote ?? false,
                    notes: d.notes ?? '',
                    attachments: d.attachments ?? [],
                    extraPromptFields: d.extraPromptFields || {},
                };
                try {
                    const res = await fetch('/api/findings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                    if (!res.ok) throw new Error('offline');
                    const created = await res.json();
                    const attachIds = (d.attachments || []);
                    if (attachIds.length > 0 && created?.id) {
                        await fetch('/api/attachments/link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ findingId: created.id, attachmentIds: attachIds }) });
                    }
                } catch {
                    await enqueueRequest({ id: uuidv4(), url: '/api/findings', method: 'POST', body: payload });
                }
            }
            alert('All items saved');
        } finally {
            setSavingAll(false);
        }
    }

    const grouped = useMemo(() => {
        const map: Record<string, CatalogItem[]> = {};
        for (const item of catalog) {
            for (const v of item.verticals) {
                (map[v] = map[v] || []).push(item);
            }
        }
        return map;
    }, [catalog]);

    return (
        <div className="p-2 pb-20">
            {Object.entries(grouped).map(([section, items]) => (
                <div key={section} className="mb-6">
                    <h2 className="text-lg font-semibold mb-2">{section}</h2>
                    <div className="space-y-3">
                        {items.map((it) => {
                            const d = decisions[it.code] || {} as Decision;
                            return (
                                <div key={it.code} className="border rounded p-3">
                                    <div className="flex justify-between items-start gap-2">
                                        <div>
                                            <div className="font-medium">{it.code} — {it.name}</div>
                                            <div className="text-xs opacity-70">{it.whyItMatters}</div>
                                        </div>
                                        <Segmented value={d.decision || ''} onChange={(val) => updateDecision(it.code, { decision: val as Decision['decision'] })} />
                                    </div>
                                    {d.decision === 'Other' && (
                                        <select className="mt-2 border rounded p-2 text-sm" value={d.otherReason || ''} onChange={(e) => updateDecision(it.code, { otherReason: e.target.value })}>
                                            <option value="">Select reason</option>
                                            {['N/A for this site','Info-only observation','Needs follow-up','Access blocked','Shutdown not permitted'].map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                    )}
                                    {d.decision === 'Yes' && it.simple && (
                                        <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                                            <select
                                                className="border rounded p-2"
                                                value={d.quantity ?? ''}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === 'custom') {
                                                        const raw = prompt('Enter custom quantity');
                                                        const num = Number(raw);
                                                        if (Number.isFinite(num) && num > 0) {
                                                            updateDecision(it.code, { quantity: num });
                                                        }
                                                        // revert select display to current quantity (controlled by state)
                                                        return;
                                                    }
                                                    updateDecision(it.code, { quantity: val ? Number(val) : undefined });
                                                }}
                                            >
                                                <option value="">Qty</option>
                                                {[1,2,3,5,10].map(n => <option key={n} value={n}>{n}</option>)}
                                                <option value="custom">Custom</option>
                                            </select>
                                            <div className="relative">
                                                <input className="border rounded p-2 w-full" placeholder="Unit price" value={d.unitPrice || ''} onChange={(e) => updateDecision(it.code, { unitPrice: e.target.value })} onFocus={async () => {
                                                    if (!d.unitPrice) {
                                                        const res = await fetch(`/api/pricing/prefill?visitId=${visitId}&itemCode=${it.code}`);
                                                        const j = await res.json();
                                                        if (j.hint) {
                                                            const ok = confirm(`Use last price: ${j.hint}?`);
                                                            if (ok) updateDecision(it.code, { unitPrice: j.hint });
                                                        }
                                                    }
                                                }} />
                                            </div>
                                            <div className="p-2">{Number(d.quantity) && Number(d.unitPrice) ? `Line: $${(Number(d.quantity) * Number(d.unitPrice)).toFixed(2)}` : 'Line: —'}</div>
                                        </div>
                                    )}
                                    {d.decision === 'Yes' && !it.simple && (
                                        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                                            <input className="border rounded p-2" placeholder="Price (optional)" value={d.unitPrice || ''} onChange={(e) => updateDecision(it.code, { unitPrice: e.target.value })} />
                                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!d.sendToQuote} onChange={(e) => updateDecision(it.code, { sendToQuote: e.target.checked })} /> Send to Quote</label>
                                        </div>
                                    )}
                                    <textarea className="mt-2 w-full border rounded p-2 text-sm" placeholder="Notes" value={d.notes || ''} onChange={(e) => updateDecision(it.code, { notes: e.target.value })} />
                                    <div className="mt-2 flex items-center gap-2 text-sm">
                                        {(() => {
                                            const inputId = `file-${it.code}`;
                                            return (
                                                <>
                                                    <input
                                                        id={inputId}
                                                        className="hidden"
                                                        type="file"
                                                        accept="image/jpeg,image/png,application/pdf"
                                                        multiple
                                                        onChange={async (e) => {
                                                            const inputEl = e.currentTarget as HTMLInputElement | null;
                                                            const files = Array.from((inputEl && inputEl.files) ? inputEl.files : []);
                                                const toBase64 = (buf: ArrayBuffer) => {
                                                    let bin = '';
                                                    const bytes = new Uint8Array(buf);
                                                    for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
                                                    return btoa(bin);
                                                };
                                                for (const file of files) {
                                                    try {
                                                        const arr = await file.arrayBuffer();
                                                        const b64 = toBase64(arr);
                                                        const res = await fetch('/api/attachments', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ visitId, findingId: null, fileName: file.name, mimeType: file.type, dataBase64: b64, tags: ['Photo'] }),
                                                        });
                                                        if (!res.ok) throw new Error('upload failed');
                                                        const j = await res.json();
                                                        // Update local decision state with attachment id and display list
                                                        setDecisions((prev) => {
                                                            const prevDec = (prev[it.code] || {}) as Decision;
                                                            const nextUploads = [...(prevDec.uploaded || []), { id: j.id as string, url: j.url as string, fileName: file.name }];
                                                            const nextAttach = [...(prevDec.attachments || []), j.id as string];
                                                            return { ...prev, [it.code]: { ...prevDec, uploaded: nextUploads, attachments: nextAttach } };
                                                        });
                                                    } catch (err) {
                                                        alert('Attachment upload failed');
                                                    }
                                                }
                                                // Clear input after upload
                                                if (inputEl) inputEl.value = '';
                                            }}
                                                    />
                                                    <button type="button" className="px-3 py-2 border rounded" onClick={() => document.getElementById(inputId)?.click()}>Choose files</button>
                                                </>
                                            );
                                        })()}
                                        <span className="text-xs opacity-70">Attach images/docs here. Uploads immediately.</span>
                                    </div>
                                    { ( (decisions[it.code] as Decision | undefined)?.uploaded || [] ).length > 0 && (
                                        <div className="mt-2 text-xs">
                                            <div className="font-medium mb-1">Uploaded:</div>
                                            <ul className="list-disc pl-5 space-y-1">
                                                {((decisions[it.code] as Decision | undefined)?.uploaded || []).map(u => (
                                                    <li key={u.id} className="truncate"><a className="underline" href={u.url} target="_blank" rel="noreferrer">{u.fileName}</a></li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    <div className="mt-2 flex justify-end gap-2">
                                        <button className="px-3 py-1 border rounded text-sm" type="button" onClick={() => clearItem(it.code)}>Clear</button>
                                        <button className="px-3 py-1 bg-black text-white rounded text-sm" type="button" onClick={() => saveFinding(it.code)}>Save</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}

            <div className="fixed bottom-0 inset-x-0 p-3 bg-white border-t flex justify-between items-center">
                <div className="text-sm">Yes: {Object.values(decisions).filter((d) => d.decision === 'Yes').length}</div>
                <div className="text-sm font-medium">
                    Subtotal: {
                        Object.entries(decisions).reduce((acc, [code, d]) => {
                            const item = catalog.find(c => c.code === code);
                            if (!item || !item.simple || d.decision !== 'Yes') return acc;
                            const q = Number(d.quantity || 0);
                            const up = parseFloat(String(d.unitPrice || '').replace(/[$,\s]/g, ''));
                            if (Number.isFinite(q) && Number.isFinite(up)) return acc + q * up;
                            return acc;
                        }, 0).toFixed(2)
                    }
                </div>
                <div className="flex gap-2">
                    <button className="px-3 py-2 border rounded disabled:opacity-50" disabled={savingAll} onClick={saveAll}>{savingAll ? 'Saving…' : 'Save All'}</button>
                    <a className="px-3 py-2 border rounded" href={`/visit/${visitId}/review`}>Review</a>
                </div>
            </div>
        </div>
    );
}


