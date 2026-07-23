import { describe, expect, it } from 'vitest';

import { buildPolicy, parseUrlList } from '../nodes/WellMarked/helpers';

describe('parseUrlList', () => {
	it('splits comma/newline-separated strings and trims each entry', () => {
		expect(parseUrlList('a.com, b.com\n c.com ')).toEqual(['a.com', 'b.com', 'c.com']);
	});

	it('drops blanks from trailing/repeated separators', () => {
		expect(parseUrlList('a.com,,\n,b.com,')).toEqual(['a.com', 'b.com']);
	});

	it('passes an array through, stringifying and trimming', () => {
		expect(parseUrlList([' a.com ', 'b.com'])).toEqual(['a.com', 'b.com']);
	});

	it('returns [] for a string of only separators/whitespace', () => {
		expect(parseUrlList('  , \n , ')).toEqual([]);
	});

	it('returns [] for non-string, non-array input', () => {
		expect(parseUrlList(undefined)).toEqual([]);
		expect(parseUrlList(null)).toEqual([]);
		expect(parseUrlList(42)).toEqual([]);
	});
});

describe('buildPolicy', () => {
	it('omits every unset field, so an empty collection narrows nothing', () => {
		expect(buildPolicy({})).toEqual({});
	});

	it('includes only the fields that carry a value', () => {
		expect(
			buildPolicy({ allow_domains: 'a.com, b.com', respect_robots: 'strict' }),
		).toEqual({ allow_domains: ['a.com', 'b.com'], respect_robots: 'strict' });
	});

	it('builds all three fields when present, splitting the lists', () => {
		expect(
			buildPolicy({
				allow_domains: 'a.com',
				deny_patterns: '*.evil.com\n*.bad.com',
				respect_robots: 'lax',
			}),
		).toEqual({
			allow_domains: ['a.com'],
			deny_patterns: ['*.evil.com', '*.bad.com'],
			respect_robots: 'lax',
		});
	});

	it('drops an empty-string respect_robots (falsy → omitted)', () => {
		expect(buildPolicy({ respect_robots: '' })).toEqual({});
	});
});
