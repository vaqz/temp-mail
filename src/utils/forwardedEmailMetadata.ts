/**
 * Extract metadata from the first forwarded-message header block.
 *
 * This is intentionally metadata-only: it does not parse verification codes,
 * follow links, or infer that a forwarded message belongs to a customer unless
 * the caller separately validates the extracted recipient.
 */

export interface ForwardedEmailMetadata {
	fromAddress: string | null;
	toAddresses: string[];
	subject: string | null;
}

function htmlToPlainText(input: string): string {
	return input
		.replace(/<\s*br\s*\/?\s*>/gi, "\n")
		.replace(/<\s*\/(?:p|div|tr|li|h[1-6])\s*>/gi, "\n")
		.replace(/<[^>]*>/g, " ")
		.replace(/&nbsp;|&#160;/gi, " ")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&quot;/gi, '"')
		.replace(/&#39;|&apos;/gi, "'")
		.replace(/&amp;/gi, "&");
}

function normalizeAddress(value: string): string | null {
	const angleMatch = value.match(/<\s*([^<>\s]+@[^<>\s]+)\s*>/);
	const candidate = (
		angleMatch?.[1] ||
		value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ||
		""
	)
		.trim()
		.toLowerCase();
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate) ? candidate : null;
}

/**
 * Parses common forwarded headers (From:, To:, Subject:) from plain text or
 * HTML email content. Returns null fields when metadata is absent/ambiguous.
 */
export function extractForwardedEmailMetadata(content: string): ForwardedEmailMetadata {
	const text = htmlToPlainText(content).replace(/\r/g, "");
	const lines = text
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
	const headerStart = lines.findIndex((line) => /^from\s*:/i.test(line));
	if (headerStart < 0) {
		return { fromAddress: null, toAddresses: [], subject: null };
	}

	const headerLines: string[] = [];
	for (let i = headerStart; i < Math.min(lines.length, headerStart + 20); i++) {
		const line = lines[i];
		if (i > headerStart && /^(?:hi\s|hello\s|dear\s|your\s|we\s|if\s)/i.test(line)) break;
		if (/^(?:from|to|cc|sent|date|subject)\s*:/i.test(line)) {
			headerLines.push(line);
		} else if (headerLines.length > 0 && !/^[A-Za-z][A-Za-z -]{0,20}:/.test(line)) {
			headerLines[headerLines.length - 1] += ` ${line}`;
		}
	}

	const field = (name: string) =>
		headerLines
			.find((line) => new RegExp(`^${name}\\s*:`, "i").test(line))
			?.replace(new RegExp(`^${name}\\s*:\\s*`, "i"), "") || "";

	const fromAddress = normalizeAddress(field("from"));
	const toValue = field("to");
	const toAddresses = [...toValue.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map((m) =>
		m[0].toLowerCase(),
	);
	const subject = field("subject").trim() || null;

	return {
		fromAddress,
		toAddresses: [...new Set(toAddresses)],
		subject,
	};
}
