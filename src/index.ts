import app from "@/app";

import { handleMailboxEmail } from "@/handlers/mailboxEmailHandler";
import { handleScheduled } from "@/handlers/scheduledHandler";

export default {
	fetch: app.fetch,

	email: handleMailboxEmail,

	scheduled: (event: ScheduledEvent, env: CloudflareBindings, ctx: ExecutionContext) => {
		switch (event.cron) {
			case "0 */2 * * *":
				return handleScheduled(event, env, ctx);
		}
	},
};
