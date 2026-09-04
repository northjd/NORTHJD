/**
 * The rights gate.
 *
 * Enforces the rule that "publicly reachable" is not "permitted to ingest, store or
 * process". Two decisions are made here and nowhere else:
 *
 *   1. may we fetch this source at all?
 *   2. how much of what we fetch may we keep?
 *
 * Both derive from the stored `source_policies` row. A source with no policy, or one
 * still in review, is refused while `INGEST_REQUIRE_RIGHTS_REVIEW` is on — which is
 * the default and the setting the README tells operators to leave alone.
 */

import { config } from '@mios/config';
import type { RightsStatus, StorageScope } from '@mios/domain';

export interface SourcePolicyView {
  rightsStatus: RightsStatus;
  allowedToIngest: boolean;
  allowedToStoreMetadata: boolean;
  allowedToStoreExcerpts: boolean;
  allowedToStoreFullText: boolean;
  allowedForAiProcessing: boolean;
  storageScope: StorageScope;
  requiredAttribution: string;
  rateLimitPerHour: number;
}

export interface RightsDecision {
  allowed: boolean;
  /** The most we may retain if we do fetch. */
  storageScope: StorageScope;
  aiProcessingAllowed: boolean;
  /** Shown verbatim in the admin source registry when a source is refused. */
  reason: string;
}

export function evaluateRights(policy: SourcePolicyView | null): RightsDecision {
  const strict = config().INGEST_REQUIRE_RIGHTS_REVIEW;

  if (!policy) {
    return {
      allowed: !strict,
      storageScope: 'metadata',
      aiProcessingAllowed: false,
      reason: strict
        ? 'No source policy on record. A source must pass rights review before it is fetched.'
        : 'No source policy on record; rights-review enforcement is disabled, retaining metadata only.',
    };
  }

  if (policy.rightsStatus === 'denied') {
    return {
      allowed: false,
      storageScope: 'metadata',
      aiProcessingAllowed: false,
      reason: 'Rights review concluded this source may not be ingested.',
    };
  }

  if (policy.rightsStatus === 'pending_review' && strict) {
    return {
      allowed: false,
      storageScope: 'metadata',
      aiProcessingAllowed: false,
      reason:
        'Rights review is still pending. Registered as a candidate; the connector stays disabled.',
    };
  }

  if (policy.rightsStatus === 'restricted') {
    return {
      allowed: false,
      storageScope: 'metadata',
      aiProcessingAllowed: false,
      reason: 'Access is restricted (licence, jurisdiction or contractual limitation).',
    };
  }

  if (!policy.allowedToIngest) {
    return {
      allowed: false,
      storageScope: 'metadata',
      aiProcessingAllowed: false,
      reason: 'The policy for this source does not permit automated ingestion.',
    };
  }

  // Never retain more than the policy allows, whatever the connector returns.
  const scope: StorageScope = policy.allowedToStoreFullText
    ? 'full_text'
    : policy.allowedToStoreExcerpts
      ? 'excerpt'
      : 'metadata';

  return {
    allowed: true,
    storageScope: scope,
    aiProcessingAllowed: policy.allowedForAiProcessing,
    reason:
      policy.rightsStatus === 'metadata_only'
        ? 'Metadata-only: headline, link and dates are stored; body text is not retained.'
        : `Approved for ingestion; retaining ${scope.replace('_', ' ')}.`,
  };
}

/**
 * Applies the storage scope to a document body. Truncation of an excerpt is
 * deliberate and conservative — a short quote for identification, not a substitute
 * for the original.
 */
export function applyStorageScope(
  scope: StorageScope,
  body: string,
  excerpt: string,
): { normalizedText: string; excerpt: string } {
  switch (scope) {
    case 'full_text':
      return { normalizedText: body, excerpt: excerpt || body.slice(0, 500) };
    case 'excerpt': {
      const short = excerpt || body.slice(0, 500);
      return { normalizedText: short, excerpt: short };
    }
    case 'metadata':
    default:
      return { normalizedText: '', excerpt: '' };
  }
}

/**
 * Whether we may derive evidence-backed claims. Metadata-only sources can still
 * produce an event (a headline and a date are facts about what was published) but
 * they cannot produce quoted evidence spans, and the UI must not imply otherwise.
 */
export function canExtractEvidence(scope: StorageScope): boolean {
  return scope !== 'metadata';
}
