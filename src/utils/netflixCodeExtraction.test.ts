import { describe, expect, test } from "bun:test";
import {
	extractCodeFromNetflixPage,
	extractSignInCodeFromBody,
	parseTemporaryAccessEmail,
} from "./netflixCodeExtraction";

describe("extractSignInCodeFromBody", () => {
	test("extracts a sign-in code near explicit wording", () => {
		expect(
			extractSignInCodeFromBody(
				"",
				"Netflix\nYour sign-in code is 4821\nEnter this code to sign in.",
			),
		).toBe("4821");
	});

	test("extracts code from HTML sign-in email", () => {
		const html = [
			"<html><body><p>Enter this code to sign in</p>",
			"<h1>7390</h1><p>This code expires soon.</p></body></html>",
		].join("");
		expect(extractSignInCodeFromBody(html, "")).toBe("7390");
	});

	test("returns the only four-digit group when wording is absent", () => {
		expect(extractSignInCodeFromBody("", "Welcome back. 9156 is ready.")).toBe("9156");
	});

	test("returns null when multiple ambiguous four-digit groups exist", () => {
		expect(extractSignInCodeFromBody("", "Codes 1111 and 2222 were mentioned.")).toBeNull();
	});

	test("returns null for empty content", () => {
		expect(extractSignInCodeFromBody("", "")).toBeNull();
	});

	test("extracts code when Netflix splits digits across HTML elements", () => {
		const html = [
			"<p>Enter this code to sign in</p>",
			"<td>8</td><td>0</td><td>7</td><td>0</td>",
			"<p>Enter the code above on your device to sign in to Netflix.</p>",
		].join("");
		expect(extractSignInCodeFromBody(html, "")).toBe("8070");
	});

	test("extracts spaced digits from plain forwarded text body", () => {
		const text = [
			"From: Netflix <info@account.netflix.com>",
			"To: customer+24@hotmail.com",
			"Subject: Netflix: Your sign-in code",
			"",
			"Enter this code to sign in",
			"8 0 7 0",
			"Enter the code above on your device to sign in to Netflix.",
			"This code will expire in 15 minutes.",
		].join("\n");
		expect(extractSignInCodeFromBody("", text)).toBe("8070");
	});
});

describe("parseTemporaryAccessEmail", () => {
	test("parses profile and trusted travel-verify link", () => {
		const html = [
			"<p>Hi <span>Family Profile</span>,</p>",
			'<td class="h5 button-td">',
			'<a href="https://www.netflix.com/account/travel/verify?nftoken=abc123">Get Code</a>',
			"</td>",
		].join("\n");
		expect(parseTemporaryAccessEmail(html, "Hi Family Profile,")).toEqual({
			profile: "Family Profile",
			link: "https://www.netflix.com/account/travel/verify?nftoken=abc123",
		});
	});

	test("rejects non-Netflix hostnames", () => {
		const text = "Hi Profile,\nhttps://evil.example/account/travel/verify?x=1";
		expect(parseTemporaryAccessEmail("", text)).toBeNull();
	});

	test("rejects missing profile", () => {
		const text = "https://www.netflix.com/account/travel/verify?nftoken=abc";
		expect(parseTemporaryAccessEmail("", text)).toBeNull();
	});
});

describe("extractCodeFromNetflixPage", () => {
	test("extracts verification code from page text", () => {
		const html = "<html><body><p>Your verification code is <strong>6042</strong></p></body></html>";
		expect(extractCodeFromNetflixPage(html)).toBe("6042");
	});
});
