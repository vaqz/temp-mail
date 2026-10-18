/**
 * Service email classification registry.
 *
 * This module classifies message metadata only. It does not extract OTPs,
 * follow verification links, or deliver authentication codes.
 *
 * Add service patterns only after confirming real sender/subject examples.
 */

export type OtpServiceId = "netflix" | "spotify" | "canva" | "hbo_max" | "disney_plus" | "loklok";

export type OtpMessageType = "temporary_access" | "sign_in" | "verification" | "unknown";

export interface OtpServiceRule {
	id: OtpServiceId;
	displayName: string;
	/**
	 * Exact sender domains or addresses confirmed from real messages.
	 * Empty means not configured yet.
	 */
	senderPatterns: RegExp[];
	/** Match either the outer subject or the original subject from a forwarded message. */
	subjectPatterns: Partial<Record<Exclude<OtpMessageType, "unknown">, RegExp[]>>;
}

export const OTP_SERVICE_REGISTRY: OtpServiceRule[] = [
	{
		id: "netflix",
		displayName: "Netflix",
		senderPatterns: [/^info@account\.netflix\.com$/i],
		subjectPatterns: {
			temporary_access: [/your netflix temporary access code/i],
			sign_in: [/netflix: your sign-in code/i, /enter this code to sign in/i],
		},
	},
	{
		id: "spotify",
		displayName: "Spotify",
		senderPatterns: [],
		subjectPatterns: {},
	},
	{
		id: "canva",
		displayName: "Canva",
		senderPatterns: [],
		subjectPatterns: {},
	},
	{
		id: "hbo_max",
		displayName: "HBO Max",
		senderPatterns: [],
		subjectPatterns: {},
	},
	{
		id: "disney_plus",
		displayName: "Disney+",
		senderPatterns: [],
		subjectPatterns: {},
	},
	{
		id: "loklok",
		displayName: "Loklok",
		senderPatterns: [],
		subjectPatterns: {},
	},
];

export interface OtpMessageMetadata {
	fromAddress: string;
	outerSubject: string;
	/** Subject parsed from the forwarded message headers, when available. */
	originalSubject?: string | null;
}

export interface OtpClassification {
	service: OtpServiceId | null;
	serviceName: string | null;
	messageType: OtpMessageType;
	matchedSubject: string | null;
	confidence: "confirmed_pattern" | "unknown";
}

/**
 * Classifies using known sender + subject metadata. Forwarded subjects are
 * handled by checking the original subject as well as the outer "FW:" subject.
 * It deliberately returns "unknown" rather than guessing when evidence is weak.
 */
export function classifyOtpMessage(metadata: OtpMessageMetadata): OtpClassification {
	const fromAddress = metadata.fromAddress.trim().toLowerCase();
	const subjects = [metadata.originalSubject, metadata.outerSubject]
		.filter((subject): subject is string => Boolean(subject?.trim()))
		.map((subject) => subject.trim());

	for (const rule of OTP_SERVICE_REGISTRY) {
		const senderMatches =
			rule.senderPatterns.length > 0 &&
			rule.senderPatterns.some((pattern) => pattern.test(fromAddress));
		if (!senderMatches) continue;

		for (const [type, patterns] of Object.entries(rule.subjectPatterns) as [
			Exclude<OtpMessageType, "unknown">,
			RegExp[],
		][]) {
			for (const subject of subjects) {
				if (patterns.some((pattern) => pattern.test(subject))) {
					return {
						service: rule.id,
						serviceName: rule.displayName,
						messageType: type,
						matchedSubject: subject,
						confidence: "confirmed_pattern",
					};
				}
			}
		}
	}

	return {
		service: null,
		serviceName: null,
		messageType: "unknown",
		matchedSubject: null,
		confidence: "unknown",
	};
}
