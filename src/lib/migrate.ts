import { config } from 'dotenv';
config({ path: '.env.local' });
config();
import { query } from './db';

async function migrate() {
	try {
		await query(`
			create table if not exists catalog_items (
				code text primary key,
				name text not null,
				unit text not null,
				simple boolean not null default true,
				verticals jsonb not null,
				why_it_matters text not null,
				compliance_refs jsonb not null default '[]',
				underwriting_weight text not null
			);

			create table if not exists visits (
				id uuid primary key,
				site_name text not null,
				address text not null,
				verticals jsonb not null,
				tech_user_id text not null,
				created_at timestamptz not null default now(),
				updated_at timestamptz not null default now(),
				visit_notes text default ''
			);

			create table if not exists attachments (
				id uuid primary key,
				visit_id uuid not null references visits(id) on delete cascade,
				finding_id uuid null,
				blob_url text not null,
				file_name text not null,
				mime_type text not null,
				size_bytes integer not null,
				tags jsonb not null default '[]'
			);

			create table if not exists findings (
				id uuid primary key,
				visit_id uuid not null references visits(id) on delete cascade,
				item_code text not null references catalog_items(code),
				decision text not null check (decision in ('Yes','No','Other')),
				other_reason text null,
				quantity numeric null,
				unit_price text null,
				line_total numeric null,
				send_to_quote boolean not null default false,
				notes text not null default '',
				attachments jsonb not null default '[]',
				extra_prompt_fields jsonb not null default '{}'::jsonb
			);

			create table if not exists reports (
				id uuid primary key,
				visit_id uuid not null references visits(id) on delete cascade,
				type text not null check (type in ('customer','insurer')),
				generated_by_user_id text not null,
				generated_at timestamptz not null default now(),
				pdf_url text not null,
				included_finding_ids jsonb not null default '[]',
				snapshot jsonb not null default '{}'
			);
		`);
		console.log('Migration completed');
	} catch (e) {
		console.error(e);
		process.exitCode = 1;
	}
}

migrate();


