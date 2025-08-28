import { query, withTransaction } from './db';
import { CreateVisit, UpdateVisit, CreateFinding, UpdateFinding } from './schemas';

export async function createVisit(data: CreateVisit) {
	const rows = await query<{ id: string }>(
		`insert into visits (id, site_name, address, verticals, tech_user_id, visit_notes)
		 values (gen_random_uuid(), $1, $2, $3, $4, $5)
		 returning id`,
		[data.siteName, data.address, JSON.stringify(data.verticals), data.techUserId, data.visitNotes],
	);
	return rows[0];
}

export async function getVisit(id: string) {
	const rows = await query(
		`select id, site_name as "siteName", address, verticals, tech_user_id as "techUserId", created_at as "createdAt", updated_at as "updatedAt", visit_notes as "visitNotes" from visits where id = $1`,
		[id],
	);
	return rows[0] ?? null;
}

export async function updateVisit(id: string, data: UpdateVisit) {
	const fields: string[] = [];
	const values: unknown[] = [];
	let i = 1;
	if (data.visitNotes !== undefined) {
		fields.push(`visit_notes = $${i++}`);
		values.push(data.visitNotes);
	}
	if (data.verticals !== undefined) {
		fields.push(`verticals = $${i++}`);
		values.push(JSON.stringify(data.verticals));
	}
	if (fields.length === 0) return await getVisit(id);
	values.push(id);
	await query(`update visits set ${fields.join(', ')}, updated_at = now() where id = $${i}`, values);
	return await getVisit(id);
}

export async function listCatalog() {
	return await query(
		`select code, name, unit, simple, verticals, why_it_matters as "whyItMatters", compliance_refs as "complianceRefs", underwriting_weight as "underwritingWeight" from catalog_items order by code`,
	);
}

export async function createFinding(data: CreateFinding) {
	return await withTransaction(async (client) => {
		const result = await client.query({
			text: `insert into findings (id, visit_id, item_code, decision, other_reason, quantity, unit_price, line_total, send_to_quote, notes, attachments, extra_prompt_fields)
			 values (gen_random_uuid(), $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
			values: [
				data.visitId,
				data.itemCode,
				data.decision,
				data.otherReason ?? null,
				data.quantity ?? null,
				data.unitPrice == null ? null : String(data.unitPrice),
				data.quantity != null && data.unitPrice != null && !Number.isNaN(Number(data.unitPrice))
					? Number(data.quantity) * Number(data.unitPrice)
					: null,
				data.sendToQuote ?? false,
				data.notes ?? '',
				JSON.stringify(data.attachments ?? []),
				JSON.stringify(data.extraPromptFields ?? {}),
			],
		} as { text: string; values: unknown[] });
		return (result.rows as { id: string }[])[0];
	});
}

export async function updateFinding(id: string, data: UpdateFinding) {
	const sets: string[] = [];
	const vals: unknown[] = [];
	let i = 1;
	if (data.decision !== undefined) { sets.push(`decision = $${i++}`); vals.push(data.decision); }
	if (data.otherReason !== undefined) { sets.push(`other_reason = $${i++}`); vals.push(data.otherReason); }
	if (data.quantity !== undefined) { sets.push(`quantity = $${i++}`); vals.push(data.quantity); }
	if (data.unitPrice !== undefined) { sets.push(`unit_price = $${i++}`); vals.push(data.unitPrice == null ? null : String(data.unitPrice)); }
	if (data.sendToQuote !== undefined) { sets.push(`send_to_quote = $${i++}`); vals.push(data.sendToQuote); }
	if (data.notes !== undefined) { sets.push(`notes = $${i++}`); vals.push(data.notes); }
	if (data.attachments !== undefined) { sets.push(`attachments = $${i++}`); vals.push(JSON.stringify(data.attachments)); }
	if (data.extraPromptFields !== undefined) { sets.push(`extra_prompt_fields = $${i++}`); vals.push(JSON.stringify(data.extraPromptFields)); }
	if (sets.length === 0) {
		return await query('select id from findings where id = $1', [id]).then(r => r[0] ?? null);
	}
	vals.push(id);
	// recompute line_total if quantity or unit_price changed
	const recalc = sets.some(s => s.startsWith('quantity') || s.startsWith('unit_price'))
		? ", line_total = (CASE WHEN quantity is not null AND unit_price ~ '^[0-9]+(\\.[0-9]+)?$' THEN (quantity * (unit_price::numeric)) ELSE null END)"
		: '';
	await query(`update findings set ${sets.join(', ')}${recalc} where id = $${i}`, vals);
	return await query('select id from findings where id = $1', [id]).then(r => r[0] ?? null);
}

export async function listFindingsByVisit(visitId: string) {
	return await query(
		`select id, visit_id as "visitId", item_code as "itemCode", decision, other_reason as "otherReason", quantity, unit_price as "unitPrice", line_total as "lineTotal", send_to_quote as "sendToQuote", notes, attachments, extra_prompt_fields as "extraPromptFields" from findings where visit_id = $1 order by id`,
		[visitId],
	);
}


