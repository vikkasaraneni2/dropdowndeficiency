import { createPool } from '@vercel/postgres';
import { getPostgresUrl } from './env';

type QueryConfig = { text: string; values?: unknown[] };
type PoolClient = { query: (cfg: QueryConfig) => Promise<{ rows: unknown[] }>; release: () => void };
type Pool = { connect: () => Promise<PoolClient> };

let pool: Pool | null = null;
function getPool(): Pool {
	if (!pool) {
		const connectionString = getPostgresUrl();
		if (!connectionString) {
			throw new Error('Missing DATABASE_URL/POSTGRES_URL env var for Postgres connection');
		}
		pool = createPool({ connectionString }) as unknown as Pool;
	}
	return pool;
}

export async function query<T = unknown>(sql: string, params: ReadonlyArray<unknown> = []) {
	const client = await getPool().connect();
	try {
		const cfg: QueryConfig = { text: sql, values: params as unknown[] };
		const result = await client.query(cfg);
		return result.rows as T[];
	} finally {
		client.release();
	}
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
	const client = await getPool().connect();
	try {
		await client.query({ text: 'BEGIN' });
		const result = await fn(client);
		await client.query({ text: 'COMMIT' });
		return result;
	} catch (err) {
		await client.query({ text: 'ROLLBACK' });
		throw err;
	} finally {
		client.release();
	}
}


