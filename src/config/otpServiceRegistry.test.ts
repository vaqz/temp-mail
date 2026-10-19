import { describe, expect, test } from "bun:test";
import { classifyOtpMessage } from "./otpServiceRegistry";

describe("classifyOtpMessage", () => {
	test("classifies a direct Netflix temporary-access email", () => {
		expect(
			classifyOtpMessage({
				fromAddress: "info@account.netflix.com",
				outerSubject: "Your Netflix temporary access code",
			}),
		).toMatchObject({
			service: "netflix",
			messageType: "temporary_access",
			confidence: "confirmed_pattern",
		});
	});

	test("classifies a forwarded Netflix sign-in email using the original subject", () => {
		expect(
			classifyOtpMessage({
				fromAddress: "info@account.netflix.com",
				outerSubject: "FW: Netflix: Your sign-in code",
				originalSubject: "Netflix: Your sign-in code",
			}),
		).toMatchObject({
			service: "netflix",
			messageType: "sign_in",
			matchedSubject: "Netflix: Your sign-in code",
			confidence: "confirmed_pattern",
		});
	});

	test("does not guess when the sender is not a known Netflix sender", () => {
		expect(
			classifyOtpMessage({
				fromAddress: "someone@example.com",
				outerSubject: "Your Netflix temporary access code",
			}),
		).toMatchObject({
			service: null,
			messageType: "unknown",
			confidence: "unknown",
		});
	});

	test("leaves unconfigured services unknown until their real patterns are confirmed", () => {
		expect(
			classifyOtpMessage({
				fromAddress: "no-reply@spotify.example",
				outerSubject: "Your Spotify sign-in code",
			}),
		).toMatchObject({
			service: null,
			messageType: "unknown",
			confidence: "unknown",
		});
	});
});
