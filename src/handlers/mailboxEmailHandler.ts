import { handleEmail as storeAndProcessEmail } from "@/handlers/emailHandler";
import { getActiveDomainDestinations, isActiveMailboxDomain } from "@/utils/mailboxDomains";

/**
 * Main email entrypoint.
 *
 * Storage/visibility/attachments are handled by emailHandler. Gmail copies
 * are entirely driven by the active D1 domain and destination configuration.
 */
export async function handleMailboxEmail(
	message: ForwardableEmailMessage,
	env: CloudflareBindings,
	ctx: ExecutionContext,
) {
	await storeAndProcessEmail(message, env, ctx);

	const recipient = message.to.trim().toLowerCase();
	const atIndex = recipient.lastIndexOf("@");
	if (atIndex < 0) return;

	const domain = recipient.slice(atIndex + 1);
	try {
		if (!(await isActiveMailboxDomain(env.D1, domain))) return;

		const destinations = await getActiveDomainDestinations(env.D1, domain);
		if (!destinations.length || !message.canBeForwarded) return;

		ctx.waitUntil(
			(async () => {
				for (const destination of destinations) {
					try {
						await message.forward(destination);
						console.log(`Mailbox copy: ${recipient} forwarded to ${destination}`);
					} catch (error) {
						console.error(`Mailbox copy failed: ${recipient} -> ${destination}`, error);
					}
				}
			})(),
		);
	} catch (error) {
		console.error(`Mailbox destination lookup failed for ${domain}:`, error);
	}
}
