/**
 * Outbound HTTP for ingestion.
 *
 * Every fetch the platform makes to the outside world goes through here, because a
 * URL is attacker-controlled input the moment we accept manual URL ingestion. The
 * guards are:
 *
 *   - scheme allow-list (http/https only, so no file:, gopher:, data:)
 *   - DNS resolution *before* connecting, with every resolved address checked against
 *     private, loopback, link-local and carrier-grade-NAT ranges
 *   - manual redirect handling, re-validating the host at every hop (a public host
 *     that 302s to 169.254.169.254 is the classic cloud-metadata SSRF)
 *   - a byte ceiling enforced while streaming, not after
 *   - a timeout, an identifying user agent, and no credential forwarding
 */

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { config, ingestDenyHosts } from '@mios/config';

export class FetchBlockedError extends Error {
  constructor(
    readonly url: string,
    readonly reason: string,
  ) {
    super(`Refused to fetch ${url}: ${reason}`);
    this.name = 'FetchBlockedError';
  }
}

export interface FetchedResource {
  url: string;
  finalUrl: string;
  status: number;
  contentType: string;
  body: string;
  bytes: number;
  etag: string | null;
  lastModified: string | null;
}

/** IPv4/IPv6 ranges that must never be reachable from ingestion. */
function isBlockedAddress(address: string, family: number): boolean {
  if (family === 6) {
    const a = address.toLowerCase();
    if (a === '::1' || a === '::') return true;
    if (a.startsWith('fe80:') || a.startsWith('fc') || a.startsWith('fd')) return true;
    // IPv4-mapped IPv6, e.g. ::ffff:169.254.169.254
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(a);
    if (mapped?.[1]) return isBlockedAddress(mapped[1], 4);
    return false;
  }

  const parts = address.split('.').map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a = 0, b = 0] = parts;

  const c = parts[2] ?? 0;

  if (a === 0) return true; // "this" network
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  // 192.0.0.0/24 (IETF protocol assignments) and 192.0.2.0/24 (TEST-NET-1) only.
  // Blocking all of 192.0.0.0/16 would reject legitimate public hosts — 192.0.66.0/24
  // is ordinary public space, and an over-broad rule here silently kills real sources.
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
  if (a === 198 && b === 18) return true; // benchmarking
  if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast + reserved
  return false;
}

async function assertPublicHost(hostname: string): Promise<void> {
  const host = hostname.toLowerCase();

  if (ingestDenyHosts().some((deny) => host === deny || host.endsWith(`.${deny}`))) {
    throw new FetchBlockedError(host, 'host is on INGEST_DENY_HOSTS');
  }
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    throw new FetchBlockedError(host, 'internal hostname');
  }

  const literal = isIP(host);
  if (literal) {
    if (isBlockedAddress(host, literal)) {
      throw new FetchBlockedError(host, 'literal address in a blocked range');
    }
    return;
  }

  let addresses: { address: string; family: number }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new FetchBlockedError(host, 'DNS resolution failed');
  }
  if (addresses.length === 0) throw new FetchBlockedError(host, 'no DNS records');

  for (const { address, family } of addresses) {
    if (isBlockedAddress(address, family)) {
      throw new FetchBlockedError(host, `resolves to blocked address ${address}`);
    }
  }
}

export interface SafeFetchOptions {
  /** Sent as If-None-Match so unchanged feeds cost one 304 instead of a full body. */
  etag?: string | null;
  accept?: string;
  maxBytes?: number;
  timeoutMs?: number;
}

/**
 * Fetches a URL with the guards above. Returns status 304 with an empty body when the
 * caller supplied an ETag and the resource is unchanged.
 */
export async function safeFetch(
  rawUrl: string,
  options: SafeFetchOptions = {},
): Promise<FetchedResource> {
  const env = config();
  if (!env.INGEST_ENABLED) throw new FetchBlockedError(rawUrl, 'INGEST_ENABLED is false');

  const maxBytes = options.maxBytes ?? env.INGEST_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? env.INGEST_TIMEOUT_MS;

  let current: URL;
  try {
    current = new URL(rawUrl);
  } catch {
    throw new FetchBlockedError(rawUrl, 'not a valid URL');
  }

  let response: Response | null = null;
  const maxHops = 5;

  for (let hop = 0; hop <= maxHops; hop++) {
    if (current.protocol !== 'http:' && current.protocol !== 'https:') {
      throw new FetchBlockedError(current.href, `scheme ${current.protocol} is not allowed`);
    }
    // Re-validated on every hop: the redirect target is as untrusted as the original.
    await assertPublicHost(current.hostname);

    const res = await fetch(current.href, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'user-agent': env.INGEST_USER_AGENT,
        accept: options.accept ?? 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8, */*;q=0.5',
        'accept-encoding': 'gzip, deflate',
        ...(options.etag ? { 'if-none-match': options.etag } : {}),
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    // 304 Not Modified is in the 3xx range but is a response, not a redirect —
    // treating it as one turns a successful conditional GET into a hard failure.
    const isRedirect = [301, 302, 303, 307, 308].includes(res.status);
    if (isRedirect) {
      const location = res.headers.get('location');
      if (!location) throw new FetchBlockedError(current.href, `${res.status} without Location`);
      if (hop === maxHops) throw new FetchBlockedError(current.href, 'too many redirects');
      current = new URL(location, current);
      continue;
    }
    response = res;
    break;
  }

  if (!response) throw new FetchBlockedError(rawUrl, 'no response');

  if (response.status === 304) {
    return {
      url: rawUrl,
      finalUrl: current.href,
      status: 304,
      contentType: response.headers.get('content-type') ?? '',
      body: '',
      bytes: 0,
      etag: options.etag ?? null,
      lastModified: response.headers.get('last-modified'),
    };
  }

  if (!response.ok) {
    throw new FetchBlockedError(current.href, `HTTP ${response.status}`);
  }

  const declared = Number.parseInt(response.headers.get('content-length') ?? '0', 10);
  if (declared > maxBytes) {
    throw new FetchBlockedError(current.href, `content-length ${declared} exceeds ${maxBytes}`);
  }

  // Stream so an unbounded or lying response cannot exhaust memory.
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        throw new FetchBlockedError(current.href, `body exceeded ${maxBytes} bytes`);
      }
      chunks.push(value);
    }
  }

  const buffer = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return {
    url: rawUrl,
    finalUrl: current.href,
    status: response.status,
    contentType: response.headers.get('content-type') ?? '',
    body: new TextDecoder('utf-8').decode(buffer),
    bytes: received,
    etag: response.headers.get('etag'),
    lastModified: response.headers.get('last-modified'),
  };
}

/** Exposed for the unit tests that assert the SSRF ranges directly. */
export const __testing = { isBlockedAddress, assertPublicHost };
