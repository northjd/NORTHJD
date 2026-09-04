import { describe, expect, it } from 'vitest';
import {
  applyStorageScope,
  canExtractEvidence,
  evaluateRights,
  parseFeed,
  __testing,
} from '@mios/connectors';

describe('SSRF guard', () => {
  const blocked = __testing.isBlockedAddress;

  it('blocks loopback, private and link-local ranges', () => {
    expect(blocked('127.0.0.1', 4)).toBe(true);
    expect(blocked('10.1.2.3', 4)).toBe(true);
    expect(blocked('192.168.1.1', 4)).toBe(true);
    expect(blocked('172.16.0.1', 4)).toBe(true);
    expect(blocked('100.64.0.1', 4)).toBe(true);
  });

  it('blocks the cloud metadata address', () => {
    expect(blocked('169.254.169.254', 4)).toBe(true);
  });

  it('blocks IPv6 loopback, link-local and unique-local', () => {
    expect(blocked('::1', 6)).toBe(true);
    expect(blocked('fe80::1', 6)).toBe(true);
    expect(blocked('fd00::1', 6)).toBe(true);
  });

  it('blocks IPv4-mapped IPv6 metadata addresses', () => {
    expect(blocked('::ffff:169.254.169.254', 6)).toBe(true);
  });

  it('allows ordinary public addresses', () => {
    expect(blocked('8.8.8.8', 4)).toBe(false);
    expect(blocked('93.184.216.34', 4)).toBe(false);
    // 192.0.66.0/24 is public space. An over-broad 192.0.0.0/16 rule silently killed a
    // real source before this was narrowed.
    expect(blocked('192.0.66.109', 4)).toBe(false);
  });

  it('still blocks the genuinely reserved 192.0 sub-ranges', () => {
    expect(blocked('192.0.0.1', 4)).toBe(true);
    expect(blocked('192.0.2.1', 4)).toBe(true);
  });
});

describe('rights gate', () => {
  const policy = {
    rightsStatus: 'approved' as const,
    allowedToIngest: true,
    allowedToStoreMetadata: true,
    allowedToStoreExcerpts: true,
    allowedToStoreFullText: false,
    allowedForAiProcessing: true,
    storageScope: 'excerpt' as const,
    requiredAttribution: '',
    rateLimitPerHour: 10,
  };

  it('refuses a source with no policy at all', () => {
    expect(evaluateRights(null).allowed).toBe(false);
  });

  it('refuses a source still in review', () => {
    expect(
      evaluateRights({ ...policy, rightsStatus: 'pending_review', allowedToIngest: false }).allowed,
    ).toBe(false);
  });

  it('refuses a denied source', () => {
    expect(evaluateRights({ ...policy, rightsStatus: 'denied' }).allowed).toBe(false);
  });

  it('allows an approved source and caps retention at the policy', () => {
    const decision = evaluateRights(policy);
    expect(decision.allowed).toBe(true);
    expect(decision.storageScope).toBe('excerpt');
  });

  it('never retains more than the policy permits', () => {
    const decision = evaluateRights({ ...policy, allowedToStoreExcerpts: false });
    expect(decision.storageScope).toBe('metadata');
    const stored = applyStorageScope(decision.storageScope, 'full body text', 'an excerpt');
    expect(stored.normalizedText).toBe('');
    expect(canExtractEvidence(decision.storageScope)).toBe(false);
  });

  it('always explains a refusal', () => {
    expect(evaluateRights(null).reason.length).toBeGreaterThan(20);
  });
});

describe('feed parsing', () => {
  it('parses RSS with a plain link element', () => {
    const feed = parseFeed(
      `<?xml version="1.0"?><rss version="2.0"><channel><title>Feed</title><link>https://example.com</link>
       <item><title>An announcement</title><link>https://example.com/a</link>
       <description>Body text.</description><pubDate>Fri, 29 Aug 2026 09:00:00 GMT</pubDate></item>
       </channel></rss>`,
      'https://example.com',
    );
    expect(feed.items).toHaveLength(1);
    expect(feed.items[0]?.link).toBe('https://example.com/a');
    expect(feed.items[0]?.publishedAt).toBeInstanceOf(Date);
  });

  it('parses Atom with typed links, preferring rel=alternate', () => {
    const feed = parseFeed(
      `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Feed</title>
       <entry><title>An entry</title>
       <link rel="self" href="https://example.com/self"/>
       <link rel="alternate" href="https://example.com/entry"/>
       <summary>Summary text.</summary><updated>2026-08-29T09:00:00Z</updated></entry></feed>`,
      'https://example.com',
    );
    expect(feed.items[0]?.link).toBe('https://example.com/entry');
  });

  it('rejects a document that is not a feed', () => {
    expect(() =>
      parseFeed('<html><body>not a feed</body></html>', 'https://example.com'),
    ).toThrow();
  });

  it('skips items with no usable link rather than inventing one', () => {
    const feed = parseFeed(
      `<?xml version="1.0"?><rss version="2.0"><channel><title>F</title>
       <item><title>No link here</title><description>x</description></item></channel></rss>`,
      'https://example.com',
    );
    expect(feed.items).toHaveLength(0);
  });
});
