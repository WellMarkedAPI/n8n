import type { IDataObject } from 'n8n-workflow';

/**
 * Split a user-entered list of URLs / patterns into a clean array.
 *
 * Accepts either an array (from a fixedCollection) or a raw string where
 * entries are separated by commas or newlines. Trims each entry and drops
 * blanks, so trailing commas, stray newlines, and " a , b " all normalise
 * cleanly. Anything else (null/number/etc.) yields an empty list.
 */
export function parseUrlList(input: unknown): string[] {
	if (Array.isArray(input)) {
		return input.map((v) => String(v).trim()).filter((v) => v.length > 0);
	}
	if (typeof input === 'string') {
		return input
			.split(/[\n,]+/)
			.map((v) => v.trim())
			.filter((v) => v.length > 0);
	}
	return [];
}

/**
 * Build the `policy` request body from the node's Compliance Overrides
 * collection. Unset fields are omitted (not sent as empty), so an override
 * never accidentally clears the key's own policy server-side — the API can
 * only NARROW from what's sent, and sending nothing narrows nothing.
 */
export function buildPolicy(compliance: IDataObject): IDataObject {
	const policy: IDataObject = {};
	const allow = parseUrlList(compliance.allow_domains);
	const deny = parseUrlList(compliance.deny_patterns);
	if (allow.length > 0) policy.allow_domains = allow;
	if (deny.length > 0) policy.deny_patterns = deny;
	if (compliance.respect_robots) policy.respect_robots = compliance.respect_robots;
	return policy;
}
