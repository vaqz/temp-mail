import { describe, expect, test } from "bun:test";
import { classifyForwardedOtpEmail } from "./classifyForwardedOtpEmail";

describe("classifyForwardedOtpEmail", () => {
	test("classifies a forwarded Netflix temporary-access message from its original headers", () => {
		expect(
			classifyForwardedOtpEmail({
				fromAddress: "vaqz@vmhub.top",
				outerSubject: "FW: Your Netflix temporary access code",
				body: `---------- Forwarded message ----------
From: Netflix <info@account.netflix.com>
To: customer@example.com
Subject: Your Netflix temporary access code

Hi customer,`,
			}),
		).toMatchObject({
			service: "netflix",
			messageType: "temporary_access",
			confidence: "confirmed_pattern",
		});
	});

	test("classifies direct messages from their stored sender and subject", () => {
		expect(
			classifyForwardedOtpEmail({
				fromAddress: "info@account.netflix.com",
				outerSubject: "Netflix: Your sign-in code",
				body: "No forwarded headers are present.",
			}),
		).toMatchObject({
			service: "netflix",
			messageType: "sign_in",
			confidence: "confirmed_pattern",
		});
	});

	test("does not classify an unknown sender based on subject alone", () => {
		expect(
			classifyForwardedOtpEmail({
				fromAddress: "vaqz@vmhub.top",
				outerSubject: "FW: Your Netflix temporary access code",
				body: "From: unknown@example.com\nTo: customer@example.com\nSubject: Your Netflix temporary access code",
			}),
		).toMatchObject({
			service: null,
			messageType: "unknown",
			confidence: "unknown",
		});
	});
});
