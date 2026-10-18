import { classifyOtpMessage, type OtpClassification } from "@/config/otpServiceRegistry";
import { extractForwardedEmailMetadata } from "@/utils/forwardedEmailMetadata";

export interface ForwardedOtpClassificationInput {
	fromAddress: string;
	outerSubject: string;
	body: string;
}

/**
 * Classifies direct or forwarded service emails using sender and subject metadata.
 * It intentionally returns classification metadata only; it never extracts or
 * returns authentication codes, follows links, or treats a forwarded recipient
 * as proof of authorization.
 */
export function classifyForwardedOtpEmail(
	input: ForwardedOtpClassificationInput,
): OtpClassification {
	const forwarded = extractForwardedEmailMetadata(input.body);
	return classifyOtpMessage({
		fromAddress: forwarded.fromAddress || input.fromAddress,
		outerSubject: input.outerSubject,
		originalSubject: forwarded.subject,
	});
}
