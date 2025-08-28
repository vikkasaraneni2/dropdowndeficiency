export function getPostgresUrl(): string | undefined {
	return process.env.DATABASE_URL || process.env.POSTGRES_URL;
}

export function getBlobToken(): string | undefined {
	return process.env.BLOB_READ_WRITE_TOKEN;
}




