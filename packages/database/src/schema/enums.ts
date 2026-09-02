/**
 * PostgreSQL enum types, derived from the domain vocabularies so the database and the
 * TypeScript union can never drift apart.
 */

import { pgEnum } from 'drizzle-orm/pg-core';
import {
  CASE_MATURITIES,
  CLAIM_TYPES,
  CLASSIFICATION_ORIGINS,
  COMPANION_MODES,
  CONNECTOR_HEALTH,
  CONNECTOR_TYPES,
  CONVERSATION_APPLICATION_KINDS,
  DEPTH_LEVELS,
  ENTITY_KINDS,
  EVENT_RELATIONSHIPS,
  EVENT_TYPES,
  EVIDENCE_STRENGTHS,
  FEEDBACK_KINDS,
  GENERATORS,
  KNOWLEDGE_EVIDENCE_KINDS,
  KNOWLEDGE_STATES,
  LEARNING_CONNECTION_KINDS,
  MEMBERSHIP_ROLES,
  NOTIFICATION_KINDS,
  NOVELTY_KINDS,
  OPERATING_MODEL_DIMENSIONS,
  PIPELINE_STAGES,
  RIGHTS_STATUSES,
  RUN_STATUSES,
  SOURCE_PERSPECTIVES,
  SOURCE_TYPES,
  STORAGE_SCOPES,
  STRATEGIC_IMPACTS,
  VERIFICATION_STATUSES,
  WATCHLIST_KINDS,
  BUSINESS_VALUE_LEVERS,
} from '@mios/domain';

export const sourcePerspectiveEnum = pgEnum('source_perspective', SOURCE_PERSPECTIVES);
export const sourceTypeEnum = pgEnum('source_type', SOURCE_TYPES);
export const connectorTypeEnum = pgEnum('connector_type', CONNECTOR_TYPES);
export const rightsStatusEnum = pgEnum('rights_status', RIGHTS_STATUSES);
export const storageScopeEnum = pgEnum('storage_scope', STORAGE_SCOPES);
export const connectorHealthEnum = pgEnum('connector_health', CONNECTOR_HEALTH);

export const claimTypeEnum = pgEnum('claim_type', CLAIM_TYPES);
export const verificationStatusEnum = pgEnum('verification_status', VERIFICATION_STATUSES);
export const evidenceStrengthEnum = pgEnum('evidence_strength', EVIDENCE_STRENGTHS);
export const caseMaturityEnum = pgEnum('case_maturity', CASE_MATURITIES);

export const eventTypeEnum = pgEnum('event_type', EVENT_TYPES);
export const eventRelationshipEnum = pgEnum('event_relationship', EVENT_RELATIONSHIPS);
export const strategicImpactEnum = pgEnum('strategic_impact', STRATEGIC_IMPACTS);
export const noveltyKindEnum = pgEnum('novelty_kind', NOVELTY_KINDS);

export const valueLeverEnum = pgEnum('business_value_lever', BUSINESS_VALUE_LEVERS);
export const operatingModelDimensionEnum = pgEnum(
  'operating_model_dimension',
  OPERATING_MODEL_DIMENSIONS,
);
export const classificationOriginEnum = pgEnum('classification_origin', CLASSIFICATION_ORIGINS);

export const depthLevelEnum = pgEnum('depth_level', DEPTH_LEVELS);
export const knowledgeStateEnum = pgEnum('knowledge_state', KNOWLEDGE_STATES);
export const knowledgeEvidenceKindEnum = pgEnum('knowledge_evidence_kind', KNOWLEDGE_EVIDENCE_KINDS);
export const learningConnectionKindEnum = pgEnum(
  'learning_connection_kind',
  LEARNING_CONNECTION_KINDS,
);

export const conversationApplicationKindEnum = pgEnum(
  'conversation_application_kind',
  CONVERSATION_APPLICATION_KINDS,
);
export const companionModeEnum = pgEnum('companion_mode', COMPANION_MODES);
export const generatorEnum = pgEnum('generator', GENERATORS);

export const feedbackKindEnum = pgEnum('feedback_kind', FEEDBACK_KINDS);
export const entityKindEnum = pgEnum('entity_kind', ENTITY_KINDS);
export const watchlistKindEnum = pgEnum('watchlist_kind', WATCHLIST_KINDS);
export const notificationKindEnum = pgEnum('notification_kind', NOTIFICATION_KINDS);
export const membershipRoleEnum = pgEnum('membership_role', MEMBERSHIP_ROLES);

export const pipelineStageEnum = pgEnum('pipeline_stage', PIPELINE_STAGES);
export const runStatusEnum = pgEnum('run_status', RUN_STATUSES);
