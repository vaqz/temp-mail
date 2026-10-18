import { describe, expect, test } from "bun:test";
import { extractForwardedEmailMetadata } from "./forwardedEmailMetadata";

describe("extractForwardedEmailMetadata", () => {
	test("extracts original sender, recipient and subject from a forwarded text email", () => {
		expect(
			extractForwardedEmailMetadata(`---------- Forwarded message ----------
From: Netflix <info@account.netflix.com>
Sent: Sunday, October 18, 2026 1:38:26 PM
To: customer+222@hotmail.com <customer+222@hotmail.com>
Subject: Your Netflix temporary access code

Hi V&M-2,`),
		).toEqual({
			fromAddress: "info@account.netflix.com",
			toAddresses: ["customer+222@hotmail.com"],
			subject: "Your Netflix temporary access code",
		});
	});

	test("extracts metadata from basic HTML line breaks", () => {
		expect(
			extractForwardedEmailMetadata(
				"<p><b>From:</b> Netflix &lt;info@account.netflix.com&gt;<br><b>To:</b> customer@example.com<br><b>Subject:</b> Netflix: Your sign-in code<br><br>Hi there,</p>",
			),
		).toMatchObject({
			fromAddress: "info@account.netflix.com",
			toAddresses: ["customer@example.com"],
			subject: "Netflix: Your sign-in code",
		});
	});

	test("returns empty metadata when no forwarded header block exists", () => {
		expect(extractForwardedEmailMetadata("Hi there, your account is ready.")).toEqual({
			fromAddress: null,
			toAddresses: [],
			subject: null,
		});
	});

	test("does not treat the outer mailbox recipient as the original recipient", () => {
		const result = extractForwardedEmailMetadata(
			"From: Netflix <info@account.netflix.com>\nTo: customer@example.com\nSubject: Your Netflix temporary access code\n\nHi there,",
		);
		expect(result.toAddresses).toEqual(["customer@example.com"]);
		expect(result.toAddresses).not.toContain("vaqz@vmhub.top");
	});
});
