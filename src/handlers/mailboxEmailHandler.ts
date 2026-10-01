import { getActiveDomainDestinations, getActiveMailboxDomains } from "@/routes/domainRoutes";
import { handleEmail as storeAndProcessEmail } from "@/handlers/emailHandler";

const LEGACY_GMAIL_COPY_DOMAINS = new Set([
	"vaqzmobiz.com",
	"vmhub.top",
]);

/**
 * Main email entrypoint.
 *
 * The existing email handler remains responsible for parsing, storing,
 * attachments, and the legacy Gmail copy. This wrapper adds database-driven
 * Gmail destinations for newly configured domains without changing the
 * existing mailbox processing path.
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
	if (LEGACY_GMAIL_COPY_DOMAINS.has(domain)) return;

	const activeDomains = await getActiveMailboxDomains(env.D1);
	if (!activeDomains.includes(domain)) return;

	const destinations = await getActiveDomainDestinations(env.D1, domain);
	if (!destinations.length || !message.canBeForwarded) return;

	ctx.waitUntil(
		(async () => {
			for (const destination of destinations) {
				try {
					await message.forward(destination);
					console.log(
						`Mailbox copy: ${recipient} forwarded to ${destination}`,
					);
				} catch (error) {
					console.error(
						`Mailbox copy failed: ${recipient} -> ${destination}`,
						error,
					);
				}
			}
		})(),
	);
}
