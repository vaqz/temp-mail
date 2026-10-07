/**
 * Database-backed mailbox domain and destination helpers.
 *
 * D1 is the single source of truth for supported mailbox domains and
 * configured copy destinations. There are intentionally no hardcoded
 * production-domain fallbacks here.
 */

export async function getActiveMailboxDomains(db: D1Database): Promise<string[]> {
	const result = await db
		.prepare(
			`SELECT domain
			 FROM mailbox_domains
			 WHERE is_active = 1
			 ORDER BY domain ASC`,
		)
		.all<{ domain: string }>();

	return result.results.map((row) => String(row.domain).trim().toLowerCase()).filter(Boolean);
}

export async function getActiveDomainDestinations(
	db: D1Database,
	domain: string,
): Promise<string[]> {
	const normalizedDomain = domain.trim().toLowerCase();

	const result = await db
		.prepare(
			`SELECT destination_email
			 FROM mailbox_domain_destinations
			 WHERE domain = ?
			   AND is_active = 1
			 ORDER BY destination_email ASC`,
		)
		.bind(normalizedDomain)
		.all<{ destination_email: string }>();

	return result.results
		.map((row) => String(row.destination_email).trim().toLowerCase())
		.filter(Boolean);
}

export async function isActiveMailboxDomain(db: D1Database, domain: string): Promise<boolean> {
	const normalizedDomain = domain.trim().toLowerCase();

	const result = await db
		.prepare(
			`SELECT 1
			 FROM mailbox_domains
			 WHERE domain = ?
			   AND is_active = 1
			 LIMIT 1`,
		)
		.bind(normalizedDomain)
		.first();

	return Boolean(result);
}
