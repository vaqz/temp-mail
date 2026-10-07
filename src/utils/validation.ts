import { ERR } from "@/utils/http";
import { getDomain } from "@/utils/mail";
import { isActiveMailboxDomain } from "@/utils/mailboxDomains";

/**
 * Validate email domain against the active D1 mailbox-domain configuration.
 */
export async function validateEmailDomain(db: D1Database, emailAddress: string) {
	const domain = getDomain(emailAddress).trim().toLowerCase();
	const supported = await isActiveMailboxDomain(db, domain);

	if (!supported) {
		const supportedDomains = await db
			.prepare(
				`SELECT domain
				 FROM mailbox_domains
				 WHERE is_active = 1
				 ORDER BY domain ASC`,
			)
			.all<{ domain: string }>();

		return {
			valid: false,
			error: ERR("Domain not supported", "DomainError", {
				supported_domains: supportedDomains.results.map((row) => String(row.domain).toLowerCase()),
			}),
		};
	}

	return { valid: true };
}
