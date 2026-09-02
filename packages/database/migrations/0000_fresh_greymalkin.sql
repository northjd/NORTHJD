CREATE TYPE "public"."case_maturity" AS ENUM('ANNOUNCED', 'CONCEPT', 'PILOT', 'LIMITED_DEPLOYMENT', 'SCALED_DEPLOYMENT', 'QUANTIFIED_BUSINESS_IMPACT', 'INDEPENDENTLY_VALIDATED_IMPACT', 'DISCONTINUED_OR_REVERSED');--> statement-breakpoint
CREATE TYPE "public"."claim_type" AS ENUM('FACT', 'INTERPRETATION', 'HYPOTHESIS', 'FORECAST', 'UNVERIFIED_SIGNAL');--> statement-breakpoint
CREATE TYPE "public"."classification_origin" AS ENUM('stated_in_source', 'inferred', 'human_curated');--> statement-breakpoint
CREATE TYPE "public"."companion_mode" AS ENUM('brief_me', 'explain_it', 'explore_it', 'prepare_me', 'challenge_me', 'teach_me', 'capture_reflect');--> statement-breakpoint
CREATE TYPE "public"."connector_health" AS ENUM('healthy', 'degraded', 'failing', 'stale', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."connector_type" AS ENUM('rss', 'atom', 'rest_api', 'graphql_api', 'webhook', 'filing_api', 'licensed_feed', 'sitemap_discovery', 'structured_page', 'manual_url', 'uploaded_document', 'mcp', 'demo');--> statement-breakpoint
CREATE TYPE "public"."conversation_application_kind" AS ENUM('hypothesis', 'client_implication', 'conversation_starter', 'contrarian_angle', 'follow_up_question');--> statement-breakpoint
CREATE TYPE "public"."depth_level" AS ENUM('foundation', 'executive', 'expert');--> statement-breakpoint
CREATE TYPE "public"."entity_kind" AS ENUM('company', 'consulting_firm', 'person', 'product', 'offering', 'technology', 'institution');--> statement-breakpoint
CREATE TYPE "public"."event_relationship" AS ENUM('follows_up_on', 'corrects', 'contradicts', 'corroborates', 'duplicates', 'supersedes', 'related_to');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('partnership', 'product_launch', 'investment', 'acquisition', 'divestiture', 'leadership_change', 'financial_result', 'research_publication', 'regulation', 'market_entry', 'restructuring', 'technology_deployment', 'legal_action', 'sustainability', 'thought_leadership', 'other');--> statement-breakpoint
CREATE TYPE "public"."evidence_strength" AS ENUM('QUANTIFIED_PRIMARY_EVIDENCE', 'UNQUANTIFIED_PRIMARY_EVIDENCE', 'MULTIPLE_CREDIBLE_SECONDARY_SOURCES', 'SINGLE_CREDIBLE_SECONDARY_SOURCE', 'COMPANY_SELF_REPORTING', 'WEAK_OR_UNVERIFIED_SIGNAL');--> statement-breakpoint
CREATE TYPE "public"."feedback_kind" AS ENUM('already_knew', 'new_to_me', 'need_more_context', 'changed_my_view', 'used_in_conversation', 'not_relevant', 'save_for_later', 'challenge_this');--> statement-breakpoint
CREATE TYPE "public"."generator" AS ENUM('deterministic_extractive', 'llm', 'human_curated', 'seed_demo');--> statement-breakpoint
CREATE TYPE "public"."knowledge_evidence_kind" AS ENUM('insight_read', 'learning_unit_completed', 'knowledge_check_passed', 'knowledge_check_failed', 'used_in_meeting_brief', 'self_assessed', 'content_saved', 'repeatedly_skipped', 'decay');--> statement-breakpoint
CREATE TYPE "public"."knowledge_state" AS ENUM('unseen', 'introduced', 'explored', 'understood', 'applied', 'needs_refresh');--> statement-breakpoint
CREATE TYPE "public"."learning_connection_kind" AS ENUM('industry_concept', 'kpi', 'capability', 'business_model', 'value_chain_stage', 'technology', 'trend', 'operating_model_dimension');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('owner', 'admin', 'member', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('daily_brief_ready', 'high_impact_watchlist_event', 'meeting_prep_ready', 'important_correction', 'weekly_learning_review', 'monthly_state_of_play', 'saved_search_match');--> statement-breakpoint
CREATE TYPE "public"."novelty_kind" AS ENUM('new_to_world', 'new_to_user', 'updated_event', 'repeated_announcement', 'foundational');--> statement-breakpoint
CREATE TYPE "public"."operating_model_dimension" AS ENUM('governance', 'decision_rights', 'organization', 'process', 'data', 'technology', 'talent', 'incentives', 'performance_management', 'funding', 'change_adoption');--> statement-breakpoint
CREATE TYPE "public"."pipeline_stage" AS ENUM('rights_validation', 'ingestion', 'versioning', 'normalization', 'language_detection', 'duplicate_detection', 'entity_extraction', 'entity_resolution', 'classification', 'claim_extraction', 'evidence_linking', 'event_extraction', 'event_clustering', 'contradiction_detection', 'maturity_classification', 'signal_generation', 'insight_generation', 'learning_connection', 'conversation_application', 'quality_evaluation');--> statement-breakpoint
CREATE TYPE "public"."rights_status" AS ENUM('approved', 'metadata_only', 'pending_review', 'restricted', 'denied');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('pending', 'running', 'succeeded', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."source_perspective" AS ENUM('FIRST_PARTY_COMPANY', 'FIRST_PARTY_TECH_PROVIDER', 'FIRST_PARTY_CONSULTING_FIRM', 'FIRST_PARTY_CLIENT', 'INDEPENDENT_BUSINESS_MEDIA', 'INDUSTRY_MEDIA', 'REGULATOR', 'PUBLIC_INSTITUTION', 'RESEARCH_INSTITUTION', 'ACADEMIC_SOURCE', 'LICENSED_PREMIUM', 'AUTHORIZED_INTERNAL', 'USER_PROVIDED');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('official_newsroom', 'official_blog', 'investor_relations', 'regulatory_filing', 'annual_report', 'earnings_release', 'earnings_transcript', 'research_report', 'public_institution', 'regulator', 'independent_news', 'industry_publication', 'academic_publication', 'podcast', 'video', 'conference_content', 'licensed_data_provider', 'user_upload', 'authorized_internal');--> statement-breakpoint
CREATE TYPE "public"."storage_scope" AS ENUM('metadata', 'excerpt', 'full_text');--> statement-breakpoint
CREATE TYPE "public"."strategic_impact" AS ENUM('low', 'moderate', 'high', 'very_high');--> statement-breakpoint
CREATE TYPE "public"."business_value_lever" AS ENUM('revenue_growth', 'margin_improvement', 'productivity', 'cost_reduction', 'working_capital', 'inventory_reduction', 'customer_retention', 'speed_to_market', 'risk_reduction', 'compliance', 'employee_productivity', 'resilience', 'innovation', 'sustainability');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('SINGLE_SOURCE', 'CORROBORATED', 'PRIMARY_SOURCE_CONFIRMED', 'DISPUTED', 'CORRECTED', 'RETRACTED');--> statement-breakpoint
CREATE TYPE "public"."watchlist_kind" AS ENUM('company', 'industry', 'topic', 'technology', 'account', 'prospect', 'competitor');--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"role" "membership_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"threshold" integer DEFAULT 70 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(200) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_missions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"industry_slugs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"topic_slugs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"technology_slugs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"entity_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"is_paused" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"role" varchar(120) DEFAULT '' NOT NULL,
	"seniority" varchar(60) DEFAULT '' NOT NULL,
	"industry_slugs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"function_slugs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"technology_slugs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"topic_slugs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"geography_slugs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"information_goals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"learning_objectives" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"daily_reading_minutes" integer DEFAULT 12 NOT NULL,
	"preferred_depth" "depth_level" DEFAULT 'executive' NOT NULL,
	"response_language" varchar(10) DEFAULT 'en' NOT NULL,
	"keep_original_terms" boolean DEFAULT true NOT NULL,
	"onboarding_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"name" varchar(200) DEFAULT '' NOT NULL,
	"password_hash" text NOT NULL,
	"locale" varchar(10) DEFAULT 'en' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"watchlist_id" uuid NOT NULL,
	"entity_id" uuid,
	"industry_slug" varchar(120),
	"topic_slug" varchar(120),
	"technology_slug" varchar(120),
	"relationship" varchar(40) DEFAULT 'interest' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"name" varchar(200) NOT NULL,
	"kind" "watchlist_kind" DEFAULT 'company' NOT NULL,
	"is_shared" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(200) NOT NULL,
	"home_firm_entity_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"industry_id" uuid,
	"slug" varchar(120) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"economics" text DEFAULT '' NOT NULL,
	"example_company_names" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "capabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"value_chain_stage_id" uuid,
	"operating_model_dimensions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geographies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name" varchar(200) NOT NULL,
	"iso_code" varchar(2),
	"parent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "industries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(200) NOT NULL,
	"parent_id" uuid,
	"definition" text DEFAULT '' NOT NULL,
	"market_structure" text DEFAULT '' NOT NULL,
	"regulatory_environment" text DEFAULT '' NOT NULL,
	"transformation_agenda" text DEFAULT '' NOT NULL,
	"open_questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kpis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"industry_id" uuid,
	"slug" varchar(120) NOT NULL,
	"name" varchar(200) NOT NULL,
	"definition" text DEFAULT '' NOT NULL,
	"formula" text DEFAULT '' NOT NULL,
	"why_it_matters" text DEFAULT '' NOT NULL,
	"parent_id" uuid,
	"value_lever" "business_value_lever",
	"typical_range" varchar(200) DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_concept_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_concept_id" uuid NOT NULL,
	"to_concept_id" uuid NOT NULL,
	"kind" varchar(60) DEFAULT 'related_to' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_concepts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name" varchar(200) NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"industry_id" uuid,
	"kind" varchar(60) DEFAULT 'industry_concept' NOT NULL,
	"ref_slug" varchar(120),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_paths" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"industry_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path_id" uuid,
	"concept_id" uuid,
	"slug" varchar(140) NOT NULL,
	"title" varchar(300) NOT NULL,
	"depth" "depth_level" DEFAULT 'executive' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"objective" text DEFAULT '' NOT NULL,
	"explanation" text DEFAULT '' NOT NULL,
	"structured_model" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"key_terms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"core_metric_slugs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"example_company_names" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"common_misconceptions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"practical_questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"knowledge_check" jsonb DEFAULT 'null'::jsonb,
	"estimated_minutes" integer DEFAULT 5 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "technologies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"layer" varchar(60) DEFAULT 'application' NOT NULL,
	"enables_capability_slugs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "value_chain_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"industry_id" uuid NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name" varchar(200) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"profit_pool_note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "entity_kind" DEFAULT 'company' NOT NULL,
	"slug" varchar(140) NOT NULL,
	"name" varchar(300) NOT NULL,
	"legal_name" varchar(300) DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"official_domain" varchar(253) DEFAULT '' NOT NULL,
	"ticker" varchar(20) DEFAULT '' NOT NULL,
	"lei" varchar(20) DEFAULT '' NOT NULL,
	"cik" varchar(20) DEFAULT '' NOT NULL,
	"registration_number" varchar(60) DEFAULT '' NOT NULL,
	"hq_geography_slug" varchar(120) DEFAULT '' NOT NULL,
	"primary_industry_id" uuid,
	"business_model_slug" varchar(120) DEFAULT '' NOT NULL,
	"public_profile" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"alias" varchar(300) NOT NULL,
	"normalized" varchar(300) NOT NULL,
	"language" varchar(10) DEFAULT 'en' NOT NULL,
	"alias_type" varchar(40) DEFAULT 'trade' NOT NULL,
	"requires_context" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_coverage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"monitored_source_count" integer DEFAULT 0 NOT NULL,
	"first_party_source_count" integer DEFAULT 0 NOT NULL,
	"independent_source_count" integer DEFAULT 0 NOT NULL,
	"last_event_at" timestamp with time zone,
	"known_gaps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_industries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"industry_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_entity_id" uuid NOT NULL,
	"organization_entity_id" uuid NOT NULL,
	"role" varchar(200) NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"source_url" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_entity_id" uuid NOT NULL,
	"to_entity_id" uuid NOT NULL,
	"kind" varchar(60) NOT NULL,
	"claim_id" uuid,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"note" text DEFAULT '' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offerings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"name" varchar(300) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"addresses_capability_slugs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"announced_at" timestamp with time zone,
	"claim_id" uuid,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"title" text NOT NULL,
	"normalized_text" text DEFAULT '' NOT NULL,
	"excerpt" text DEFAULT '' NOT NULL,
	"stored_scope" "storage_scope" DEFAULT 'metadata' NOT NULL,
	"content_hash" varchar(32) NOT NULL,
	"is_correction" boolean DEFAULT false NOT NULL,
	"change_summary" text DEFAULT '' NOT NULL,
	"retrieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_spans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_version_id" uuid NOT NULL,
	"start_offset" integer NOT NULL,
	"end_offset" integer NOT NULL,
	"quote" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connector_id" uuid NOT NULL,
	"pipeline_run_id" uuid,
	"status" "run_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"documents_found" integer DEFAULT 0 NOT NULL,
	"documents_new" integer DEFAULT 0 NOT NULL,
	"documents_updated" integer DEFAULT 0 NOT NULL,
	"documents_skipped" integer DEFAULT 0 NOT NULL,
	"error" text DEFAULT '' NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"workspace_id" uuid,
	"url" text NOT NULL,
	"canonical_url" text NOT NULL,
	"external_id" varchar(512),
	"title" text NOT NULL,
	"author" varchar(300) DEFAULT '' NOT NULL,
	"language" varchar(10) DEFAULT 'en' NOT NULL,
	"published_at" timestamp with time zone,
	"source_updated_at" timestamp with time zone,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"fingerprint" varchar(32) NOT NULL,
	"duplicate_of_id" uuid,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_connectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"connector_type" "connector_type" NOT NULL,
	"endpoint" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"schedule" varchar(100) DEFAULT 'daily' NOT NULL,
	"cursor" text,
	"parsing_version" integer DEFAULT 1 NOT NULL,
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"health" "connector_health" DEFAULT 'disabled' NOT NULL,
	"last_success_at" timestamp with time zone,
	"last_failure_at" timestamp with time zone,
	"last_error" text DEFAULT '' NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"rights_status" "rights_status" DEFAULT 'pending_review' NOT NULL,
	"allowed_to_ingest" boolean DEFAULT false NOT NULL,
	"allowed_to_store_metadata" boolean DEFAULT true NOT NULL,
	"allowed_to_store_excerpts" boolean DEFAULT false NOT NULL,
	"allowed_to_store_full_text" boolean DEFAULT false NOT NULL,
	"allowed_for_ai_processing" boolean DEFAULT false NOT NULL,
	"allowed_for_redistribution" boolean DEFAULT false NOT NULL,
	"storage_scope" "storage_scope" DEFAULT 'metadata' NOT NULL,
	"required_attribution" text DEFAULT '' NOT NULL,
	"retention_days" integer,
	"geographic_restrictions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rate_limit_per_hour" integer DEFAULT 60 NOT NULL,
	"robots_checked_at" timestamp with time zone,
	"robots_allows" boolean,
	"terms_url" text DEFAULT '' NOT NULL,
	"terms_last_reviewed_at" timestamp with time zone,
	"reviewed_by" varchar(200) DEFAULT '' NOT NULL,
	"review_notes" text DEFAULT '' NOT NULL,
	"license_status" varchar(100) DEFAULT 'none' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"slug" varchar(140) NOT NULL,
	"name" varchar(250) NOT NULL,
	"official_domain" varchar(253) NOT NULL,
	"homepage_url" text DEFAULT '' NOT NULL,
	"source_type" "source_type" NOT NULL,
	"perspective" "source_perspective" NOT NULL,
	"source_owner" varchar(250) DEFAULT '' NOT NULL,
	"subject_entity_id" uuid,
	"language" varchar(10) DEFAULT 'en' NOT NULL,
	"geography_slugs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"industry_slugs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"quality_score" integer DEFAULT 50 NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_studies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"subject_entity_id" uuid,
	"provider_entity_id" uuid,
	"industry_id" uuid,
	"what_was_announced" text DEFAULT '' NOT NULL,
	"what_was_implemented" text DEFAULT '' NOT NULL,
	"scope" text DEFAULT '' NOT NULL,
	"geographies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"functions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"maturity" "case_maturity" DEFAULT 'ANNOUNCED' NOT NULL,
	"reported_outcomes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence_strength" "evidence_strength" DEFAULT 'COMPANY_SELF_REPORTING' NOT NULL,
	"independently_confirmed" boolean DEFAULT false NOT NULL,
	"open_questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_verified_at" timestamp with time zone,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_study_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_study_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claim_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"role" varchar(20) DEFAULT 'mentioned' NOT NULL,
	"confidence" double precision DEFAULT 0.5 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claim_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" uuid NOT NULL,
	"evidence_span_id" uuid NOT NULL,
	"relation" varchar(20) DEFAULT 'supports' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_version_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"text" text NOT NULL,
	"claim_type" "claim_type" DEFAULT 'UNVERIFIED_SIGNAL' NOT NULL,
	"verification_status" "verification_status" DEFAULT 'SINGLE_SOURCE' NOT NULL,
	"evidence_strength" "evidence_strength" DEFAULT 'WEAK_OR_UNVERIFIED_SIGNAL' NOT NULL,
	"confidence" double precision DEFAULT 0.5 NOT NULL,
	"quantified" boolean DEFAULT false NOT NULL,
	"event_at" timestamp with time zone,
	"last_verified_at" timestamp with time zone,
	"superseded_by_claim_id" uuid,
	"needs_review" boolean DEFAULT false NOT NULL,
	"review_reason" text DEFAULT '' NOT NULL,
	"generator" "generator" DEFAULT 'deterministic_extractive' NOT NULL,
	"prompt_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contradictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid,
	"claim_a_id" uuid NOT NULL,
	"claim_b_id" uuid NOT NULL,
	"kind" varchar(40) NOT NULL,
	"explanation" text DEFAULT '' NOT NULL,
	"resolution" varchar(20) DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"insight_id" uuid,
	"event_id" uuid,
	"kind" "conversation_application_kind" NOT NULL,
	"text" text NOT NULL,
	"derived_from_claim_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generator" "generator" DEFAULT 'deterministic_extractive' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"is_originating" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"role" varchar(20) DEFAULT 'mentioned' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_event_id" uuid NOT NULL,
	"to_event_id" uuid NOT NULL,
	"kind" "event_relationship" DEFAULT 'related_to' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_taxonomy" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"kind" varchar(40) NOT NULL,
	"slug" varchar(140) NOT NULL,
	"origin" "classification_origin" DEFAULT 'inferred' NOT NULL,
	"confidence" double precision DEFAULT 0.5 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"event_type" "event_type" DEFAULT 'other' NOT NULL,
	"event_at" timestamp with time zone,
	"first_reported_at" timestamp with time zone,
	"last_reported_at" timestamp with time zone,
	"revision" integer DEFAULT 1 NOT NULL,
	"last_material_change_at" timestamp with time zone,
	"change_note" text DEFAULT '' NOT NULL,
	"strategic_impact" "strategic_impact" DEFAULT 'moderate' NOT NULL,
	"case_maturity" "case_maturity" DEFAULT 'ANNOUNCED' NOT NULL,
	"evidence_strength" "evidence_strength" DEFAULT 'WEAK_OR_UNVERIFIED_SIGNAL' NOT NULL,
	"verification_status" "verification_status" DEFAULT 'SINGLE_SOURCE' NOT NULL,
	"source_count" integer DEFAULT 1 NOT NULL,
	"independent_source_count" integer DEFAULT 0 NOT NULL,
	"first_party_only" boolean DEFAULT true NOT NULL,
	"classification_origin" "classification_origin" DEFAULT 'inferred' NOT NULL,
	"value_levers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"operating_model_dimensions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"likely_executive_owners" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"geography_slugs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_suppressed" boolean DEFAULT false NOT NULL,
	"suppression_reason" text DEFAULT '' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insight_impressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"insight_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"first_shown_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opened_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"shown_count" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insight_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"insight_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"signal_id" uuid,
	"headline" text NOT NULL,
	"takeaway" text DEFAULT '' NOT NULL,
	"what_happened" text DEFAULT '' NOT NULL,
	"what_changed" text DEFAULT '' NOT NULL,
	"why_it_matters" text DEFAULT '' NOT NULL,
	"what_is_genuinely_new" text DEFAULT '' NOT NULL,
	"market_context" text DEFAULT '' NOT NULL,
	"consultant_perspective" text DEFAULT '' NOT NULL,
	"client_implications" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"known_unknowns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"counter_signals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"novelty" "novelty_kind" DEFAULT 'new_to_world' NOT NULL,
	"estimated_reading_minutes" integer DEFAULT 2 NOT NULL,
	"generator" "generator" DEFAULT 'deterministic_extractive' NOT NULL,
	"prompt_version_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"review_reason" text DEFAULT '' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"insight_id" uuid,
	"event_id" uuid,
	"concept_id" uuid NOT NULL,
	"kind" "learning_connection_kind" DEFAULT 'industry_concept' NOT NULL,
	"explanation" text DEFAULT '' NOT NULL,
	"strength" double precision DEFAULT 0.5 NOT NULL,
	"generator" "generator" DEFAULT 'deterministic_extractive' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"trend_id" uuid,
	"direction" varchar(20) DEFAULT 'supports' NOT NULL,
	"rationale" text DEFAULT '' NOT NULL,
	"strength" double precision DEFAULT 0.5 NOT NULL,
	"generator" "generator" DEFAULT 'deterministic_extractive' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(140) NOT NULL,
	"name" varchar(300) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"industry_id" uuid,
	"stage" varchar(20) DEFAULT 'emerging' NOT NULL,
	"supporting_signal_count" integer DEFAULT 0 NOT NULL,
	"contradicting_signal_count" integer DEFAULT 0 NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brief_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brief_id" uuid NOT NULL,
	"insight_id" uuid,
	"learning_unit_id" uuid,
	"section" varchar(40) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"score" double precision DEFAULT 0 NOT NULL,
	"why_shown" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"estimated_minutes" integer DEFAULT 2 NOT NULL,
	"read_at" timestamp with time zone,
	"dismissed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "collection_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"item_kind" varchar(30) NOT NULL,
	"item_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"name" varchar(200) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"is_shared" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_turns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"role" varchar(12) NOT NULL,
	"text" text NOT NULL,
	"structured" jsonb DEFAULT 'null'::jsonb,
	"mode" "companion_mode",
	"depth" "depth_level",
	"generator" "generator",
	"context_used" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"input_mode" varchar(12) DEFAULT 'text' NOT NULL,
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"title" varchar(300) DEFAULT '' NOT NULL,
	"mode" "companion_mode" DEFAULT 'explore_it' NOT NULL,
	"had_voice" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"brief_date" varchar(10) NOT NULL,
	"reading_budget_minutes" integer DEFAULT 12 NOT NULL,
	"estimated_minutes" integer DEFAULT 0 NOT NULL,
	"state" varchar(20) DEFAULT 'open' NOT NULL,
	"completed_at" timestamp with time zone,
	"since_at" timestamp with time zone,
	"composition_note" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"coverage_note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "followed_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "followed_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" varchar(20) DEFAULT 'topic' NOT NULL,
	"slug" varchar(140) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_check_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"learning_unit_id" uuid NOT NULL,
	"selected_index" integer NOT NULL,
	"is_correct" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"depth" "depth_level" DEFAULT 'executive' NOT NULL,
	"lookback_days" integer DEFAULT 90 NOT NULL,
	"content" jsonb NOT NULL,
	"generator" "generator" DEFAULT 'deterministic_extractive' NOT NULL,
	"as_of" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"title" varchar(300) NOT NULL,
	"company_entity_id" uuid,
	"company_name" varchar(300) DEFAULT '' NOT NULL,
	"objective" text DEFAULT '' NOT NULL,
	"meeting_at" timestamp with time zone,
	"attendees" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"competitor_names" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"technology_names" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"personal_notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"title" varchar(300) DEFAULT '' NOT NULL,
	"body" text NOT NULL,
	"attached_kind" varchar(30),
	"attached_id" uuid,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"title" varchar(300) NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"href" text DEFAULT '' NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"insight_id" uuid NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"query" text DEFAULT '' NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notify_on_match" boolean DEFAULT false NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"insight_id" uuid,
	"learning_unit_id" uuid,
	"kind" "feedback_kind" NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_knowledge_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"concept_id" uuid NOT NULL,
	"state" "knowledge_state" DEFAULT 'unseen' NOT NULL,
	"confidence" double precision DEFAULT 0.3 NOT NULL,
	"user_asserted" boolean DEFAULT false NOT NULL,
	"last_evidence_kind" "knowledge_evidence_kind",
	"reason" text DEFAULT '' NOT NULL,
	"last_interaction_at" timestamp with time zone,
	"review_due_at" timestamp with time zone,
	"review_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_learning_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"learning_unit_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'not_started' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"stt_provider" varchar(30) DEFAULT 'browser' NOT NULL,
	"tts_provider" varchar(30) DEFAULT 'browser' NOT NULL,
	"audio_persisted" boolean DEFAULT false NOT NULL,
	"items_planned" integer DEFAULT 0 NOT NULL,
	"items_completed" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid,
	"purpose" varchar(60) NOT NULL,
	"provider" varchar(40) NOT NULL,
	"model" varchar(100) DEFAULT '' NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" double precision DEFAULT 0 NOT NULL,
	"succeeded" boolean DEFAULT true NOT NULL,
	"error" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"actor_user_id" uuid,
	"action" varchar(80) NOT NULL,
	"target_kind" varchar(40) DEFAULT '' NOT NULL,
	"target_id" varchar(100) DEFAULT '' NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evaluation_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(140) NOT NULL,
	"suite" varchar(60) NOT NULL,
	"name" varchar(300) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"input" jsonb NOT NULL,
	"expectation" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evaluation_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"run_id" uuid,
	"passed" boolean NOT NULL,
	"score" double precision DEFAULT 0 NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"prompt_version_id" uuid,
	"generator" varchar(40) DEFAULT 'deterministic_extractive' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_configurations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(40) NOT NULL,
	"model" varchar(100) DEFAULT '' NOT NULL,
	"parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"kind" varchar(40) DEFAULT 'full' NOT NULL,
	"status" "run_status" DEFAULT 'running' NOT NULL,
	"trigger" varchar(40) DEFAULT 'manual' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text DEFAULT '' NOT NULL,
	"cost_usd" double precision DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_stage_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"stage" "pipeline_stage" NOT NULL,
	"status" "run_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"items_in" integer DEFAULT 0 NOT NULL,
	"items_out" integer DEFAULT 0 NOT NULL,
	"items_rejected" integer DEFAULT 0 NOT NULL,
	"rejection_reasons" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"version" integer NOT NULL,
	"template" text NOT NULL,
	"template_hash" varchar(32) NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_missions" ADD CONSTRAINT "user_missions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_missions" ADD CONSTRAINT "user_missions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_watchlist_id_watchlists_id_fk" FOREIGN KEY ("watchlist_id") REFERENCES "public"."watchlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlists" ADD CONSTRAINT "watchlists_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlists" ADD CONSTRAINT "watchlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_models" ADD CONSTRAINT "business_models_industry_id_industries_id_fk" FOREIGN KEY ("industry_id") REFERENCES "public"."industries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capabilities" ADD CONSTRAINT "capabilities_value_chain_stage_id_value_chain_stages_id_fk" FOREIGN KEY ("value_chain_stage_id") REFERENCES "public"."value_chain_stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpis" ADD CONSTRAINT "kpis_industry_id_industries_id_fk" FOREIGN KEY ("industry_id") REFERENCES "public"."industries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_concept_relationships" ADD CONSTRAINT "learning_concept_relationships_from_concept_id_learning_concepts_id_fk" FOREIGN KEY ("from_concept_id") REFERENCES "public"."learning_concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_concept_relationships" ADD CONSTRAINT "learning_concept_relationships_to_concept_id_learning_concepts_id_fk" FOREIGN KEY ("to_concept_id") REFERENCES "public"."learning_concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_concepts" ADD CONSTRAINT "learning_concepts_industry_id_industries_id_fk" FOREIGN KEY ("industry_id") REFERENCES "public"."industries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_industry_id_industries_id_fk" FOREIGN KEY ("industry_id") REFERENCES "public"."industries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_units" ADD CONSTRAINT "learning_units_path_id_learning_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."learning_paths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_units" ADD CONSTRAINT "learning_units_concept_id_learning_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."learning_concepts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "value_chain_stages" ADD CONSTRAINT "value_chain_stages_industry_id_industries_id_fk" FOREIGN KEY ("industry_id") REFERENCES "public"."industries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_primary_industry_id_industries_id_fk" FOREIGN KEY ("primary_industry_id") REFERENCES "public"."industries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_aliases" ADD CONSTRAINT "entity_aliases_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_coverage" ADD CONSTRAINT "entity_coverage_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_industries" ADD CONSTRAINT "entity_industries_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_industries" ADD CONSTRAINT "entity_industries_industry_id_industries_id_fk" FOREIGN KEY ("industry_id") REFERENCES "public"."industries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_people" ADD CONSTRAINT "entity_people_person_entity_id_entities_id_fk" FOREIGN KEY ("person_entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_people" ADD CONSTRAINT "entity_people_organization_entity_id_entities_id_fk" FOREIGN KEY ("organization_entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_relationships" ADD CONSTRAINT "entity_relationships_from_entity_id_entities_id_fk" FOREIGN KEY ("from_entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_relationships" ADD CONSTRAINT "entity_relationships_to_entity_id_entities_id_fk" FOREIGN KEY ("to_entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offerings" ADD CONSTRAINT "offerings_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_raw_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."raw_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_spans" ADD CONSTRAINT "evidence_spans_document_version_id_document_versions_id_fk" FOREIGN KEY ("document_version_id") REFERENCES "public"."document_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_connector_id_source_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."source_connectors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_documents" ADD CONSTRAINT "raw_documents_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_documents" ADD CONSTRAINT "raw_documents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_connectors" ADD CONSTRAINT "source_connectors_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_policies" ADD CONSTRAINT "source_policies_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_studies" ADD CONSTRAINT "case_studies_subject_entity_id_entities_id_fk" FOREIGN KEY ("subject_entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_studies" ADD CONSTRAINT "case_studies_provider_entity_id_entities_id_fk" FOREIGN KEY ("provider_entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_studies" ADD CONSTRAINT "case_studies_industry_id_industries_id_fk" FOREIGN KEY ("industry_id") REFERENCES "public"."industries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_study_claims" ADD CONSTRAINT "case_study_claims_case_study_id_case_studies_id_fk" FOREIGN KEY ("case_study_id") REFERENCES "public"."case_studies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_study_claims" ADD CONSTRAINT "case_study_claims_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_entities" ADD CONSTRAINT "claim_entities_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_entities" ADD CONSTRAINT "claim_entities_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_evidence" ADD CONSTRAINT "claim_evidence_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_evidence" ADD CONSTRAINT "claim_evidence_evidence_span_id_evidence_spans_id_fk" FOREIGN KEY ("evidence_span_id") REFERENCES "public"."evidence_spans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_document_version_id_document_versions_id_fk" FOREIGN KEY ("document_version_id") REFERENCES "public"."document_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contradictions" ADD CONSTRAINT "contradictions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contradictions" ADD CONSTRAINT "contradictions_claim_a_id_claims_id_fk" FOREIGN KEY ("claim_a_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contradictions" ADD CONSTRAINT "contradictions_claim_b_id_claims_id_fk" FOREIGN KEY ("claim_b_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_applications" ADD CONSTRAINT "conversation_applications_insight_id_insights_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_applications" ADD CONSTRAINT "conversation_applications_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_claims" ADD CONSTRAINT "event_claims_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_claims" ADD CONSTRAINT "event_claims_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_documents" ADD CONSTRAINT "event_documents_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_documents" ADD CONSTRAINT "event_documents_document_id_raw_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."raw_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_entities" ADD CONSTRAINT "event_entities_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_entities" ADD CONSTRAINT "event_entities_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_relationships" ADD CONSTRAINT "event_relationships_from_event_id_events_id_fk" FOREIGN KEY ("from_event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_relationships" ADD CONSTRAINT "event_relationships_to_event_id_events_id_fk" FOREIGN KEY ("to_event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_taxonomy" ADD CONSTRAINT "event_taxonomy_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight_impressions" ADD CONSTRAINT "insight_impressions_insight_id_insights_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight_impressions" ADD CONSTRAINT "insight_impressions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight_versions" ADD CONSTRAINT "insight_versions_insight_id_insights_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_signal_id_signals_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."signals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_connections" ADD CONSTRAINT "learning_connections_insight_id_insights_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_connections" ADD CONSTRAINT "learning_connections_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_connections" ADD CONSTRAINT "learning_connections_concept_id_learning_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."learning_concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trends" ADD CONSTRAINT "trends_industry_id_industries_id_fk" FOREIGN KEY ("industry_id") REFERENCES "public"."industries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brief_items" ADD CONSTRAINT "brief_items_brief_id_daily_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."daily_briefs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brief_items" ADD CONSTRAINT "brief_items_insight_id_insights_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brief_items" ADD CONSTRAINT "brief_items_learning_unit_id_learning_units_id_fk" FOREIGN KEY ("learning_unit_id") REFERENCES "public"."learning_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_turns" ADD CONSTRAINT "conversation_turns_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_briefs" ADD CONSTRAINT "daily_briefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_briefs" ADD CONSTRAINT "daily_briefs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followed_entities" ADD CONSTRAINT "followed_entities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followed_entities" ADD CONSTRAINT "followed_entities_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followed_entities" ADD CONSTRAINT "followed_entities_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followed_topics" ADD CONSTRAINT "followed_topics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followed_topics" ADD CONSTRAINT "followed_topics_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_check_results" ADD CONSTRAINT "knowledge_check_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_check_results" ADD CONSTRAINT "knowledge_check_results_learning_unit_id_learning_units_id_fk" FOREIGN KEY ("learning_unit_id") REFERENCES "public"."learning_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_briefs" ADD CONSTRAINT "meeting_briefs_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_company_entity_id_entities_id_fk" FOREIGN KEY ("company_entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_insights" ADD CONSTRAINT "saved_insights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_insights" ADD CONSTRAINT "saved_insights_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_insights" ADD CONSTRAINT "saved_insights_insight_id_insights_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_insight_id_insights_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_learning_unit_id_learning_units_id_fk" FOREIGN KEY ("learning_unit_id") REFERENCES "public"."learning_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_knowledge_states" ADD CONSTRAINT "user_knowledge_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_knowledge_states" ADD CONSTRAINT "user_knowledge_states_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_knowledge_states" ADD CONSTRAINT "user_knowledge_states_concept_id_learning_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."learning_concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_learning_progress" ADD CONSTRAINT "user_learning_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_learning_progress" ADD CONSTRAINT "user_learning_progress_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_learning_progress" ADD CONSTRAINT "user_learning_progress_learning_unit_id_learning_units_id_fk" FOREIGN KEY ("learning_unit_id") REFERENCES "public"."learning_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_sessions" ADD CONSTRAINT "voice_sessions_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_sessions" ADD CONSTRAINT "voice_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_run_id_pipeline_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."pipeline_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_results" ADD CONSTRAINT "evaluation_results_case_id_evaluation_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."evaluation_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_results" ADD CONSTRAINT "evaluation_results_prompt_version_id_prompt_versions_id_fk" FOREIGN KEY ("prompt_version_id") REFERENCES "public"."prompt_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_stage_runs" ADD CONSTRAINT "pipeline_stage_runs_run_id_pipeline_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."pipeline_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_user_workspace_key" ON "memberships" USING btree ("user_id","workspace_id");--> statement-breakpoint
CREATE INDEX "memberships_workspace_idx" ON "memberships" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notif_pref_key" ON "notification_preferences" USING btree ("user_id","workspace_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_missions_user_idx" ON "user_missions" USING btree ("user_id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_profiles_user_workspace_key" ON "user_profiles" USING btree ("user_id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "watchlist_items_list_idx" ON "watchlist_items" USING btree ("watchlist_id");--> statement-breakpoint
CREATE INDEX "watchlists_workspace_idx" ON "watchlists" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "workspaces_org_idx" ON "workspaces" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bm_slug_key" ON "business_models" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "capabilities_slug_key" ON "capabilities" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "geographies_slug_key" ON "geographies" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "industries_slug_key" ON "industries" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "industries_parent_idx" ON "industries" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "kpis_slug_key" ON "kpis" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "kpis_industry_idx" ON "kpis" USING btree ("industry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lcr_key" ON "learning_concept_relationships" USING btree ("from_concept_id","to_concept_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "learning_concepts_slug_key" ON "learning_concepts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "lc_industry_idx" ON "learning_concepts" USING btree ("industry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "learning_paths_slug_key" ON "learning_paths" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "learning_units_slug_key" ON "learning_units" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "lu_path_idx" ON "learning_units" USING btree ("path_id","position");--> statement-breakpoint
CREATE INDEX "lu_concept_idx" ON "learning_units" USING btree ("concept_id");--> statement-breakpoint
CREATE UNIQUE INDEX "technologies_slug_key" ON "technologies" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "topics_slug_key" ON "topics" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "vcs_slug_key" ON "value_chain_stages" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "vcs_industry_idx" ON "value_chain_stages" USING btree ("industry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entities_slug_key" ON "entities" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "entities_kind_idx" ON "entities" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "entities_domain_idx" ON "entities" USING btree ("official_domain");--> statement-breakpoint
CREATE INDEX "entities_name_idx" ON "entities" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_aliases_norm_key" ON "entity_aliases" USING btree ("normalized","entity_id");--> statement-breakpoint
CREATE INDEX "entity_aliases_norm_idx" ON "entity_aliases" USING btree ("normalized");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_coverage_entity_key" ON "entity_coverage" USING btree ("entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_industries_key" ON "entity_industries" USING btree ("entity_id","industry_id");--> statement-breakpoint
CREATE INDEX "entity_people_org_idx" ON "entity_people" USING btree ("organization_entity_id");--> statement-breakpoint
CREATE INDEX "entity_rel_from_idx" ON "entity_relationships" USING btree ("from_entity_id","kind");--> statement-breakpoint
CREATE INDEX "entity_rel_to_idx" ON "entity_relationships" USING btree ("to_entity_id","kind");--> statement-breakpoint
CREATE INDEX "offerings_entity_idx" ON "offerings" USING btree ("entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_versions_doc_version_key" ON "document_versions" USING btree ("document_id","version");--> statement-breakpoint
CREATE INDEX "document_versions_doc_idx" ON "document_versions" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "evidence_spans_version_idx" ON "evidence_spans" USING btree ("document_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_spans_range_key" ON "evidence_spans" USING btree ("document_version_id","start_offset","end_offset");--> statement-breakpoint
CREATE INDEX "import_jobs_connector_idx" ON "import_jobs" USING btree ("connector_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "raw_documents_source_url_key" ON "raw_documents" USING btree ("source_id","canonical_url");--> statement-breakpoint
CREATE INDEX "raw_documents_fingerprint_idx" ON "raw_documents" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "raw_documents_published_idx" ON "raw_documents" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "raw_documents_source_idx" ON "raw_documents" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "source_connectors_source_idx" ON "source_connectors" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "source_connectors_active_idx" ON "source_connectors" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "source_policies_source_key" ON "source_policies" USING btree ("source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_slug_key" ON "sources" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "sources_domain_idx" ON "sources" USING btree ("official_domain");--> statement-breakpoint
CREATE INDEX "sources_perspective_idx" ON "sources" USING btree ("perspective");--> statement-breakpoint
CREATE INDEX "case_studies_subject_idx" ON "case_studies" USING btree ("subject_entity_id");--> statement-breakpoint
CREATE INDEX "case_studies_maturity_idx" ON "case_studies" USING btree ("maturity");--> statement-breakpoint
CREATE UNIQUE INDEX "case_study_claims_key" ON "case_study_claims" USING btree ("case_study_id","claim_id");--> statement-breakpoint
CREATE UNIQUE INDEX "claim_entities_key" ON "claim_entities" USING btree ("claim_id","entity_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "claim_evidence_key" ON "claim_evidence" USING btree ("claim_id","evidence_span_id");--> statement-breakpoint
CREATE INDEX "claim_evidence_claim_idx" ON "claim_evidence" USING btree ("claim_id");--> statement-breakpoint
CREATE INDEX "claims_version_idx" ON "claims" USING btree ("document_version_id");--> statement-breakpoint
CREATE INDEX "claims_type_idx" ON "claims" USING btree ("claim_type");--> statement-breakpoint
CREATE INDEX "claims_source_idx" ON "claims" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "claims_review_idx" ON "claims" USING btree ("needs_review");--> statement-breakpoint
CREATE UNIQUE INDEX "contradictions_key" ON "contradictions" USING btree ("claim_a_id","claim_b_id");--> statement-breakpoint
CREATE INDEX "conv_app_insight_idx" ON "conversation_applications" USING btree ("insight_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "event_claims_key" ON "event_claims" USING btree ("event_id","claim_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_documents_key" ON "event_documents" USING btree ("event_id","document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_entities_key" ON "event_entities" USING btree ("event_id","entity_id","role");--> statement-breakpoint
CREATE INDEX "event_entities_entity_idx" ON "event_entities" USING btree ("entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_rel_key" ON "event_relationships" USING btree ("from_event_id","to_event_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "event_taxonomy_key" ON "event_taxonomy" USING btree ("event_id","kind","slug");--> statement-breakpoint
CREATE INDEX "event_taxonomy_slug_idx" ON "event_taxonomy" USING btree ("kind","slug");--> statement-breakpoint
CREATE INDEX "events_event_at_idx" ON "events" USING btree ("event_at");--> statement-breakpoint
CREATE INDEX "events_first_reported_idx" ON "events" USING btree ("first_reported_at");--> statement-breakpoint
CREATE INDEX "events_type_idx" ON "events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "events_maturity_idx" ON "events" USING btree ("case_maturity");--> statement-breakpoint
CREATE UNIQUE INDEX "insight_impressions_key" ON "insight_impressions" USING btree ("insight_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "insight_versions_key" ON "insight_versions" USING btree ("insight_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "insights_workspace_event_key" ON "insights" USING btree ("workspace_id","event_id");--> statement-breakpoint
CREATE INDEX "insights_workspace_idx" ON "insights" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "insights_review_idx" ON "insights" USING btree ("needs_review");--> statement-breakpoint
CREATE INDEX "learning_connections_insight_idx" ON "learning_connections" USING btree ("insight_id");--> statement-breakpoint
CREATE INDEX "learning_connections_concept_idx" ON "learning_connections" USING btree ("concept_id");--> statement-breakpoint
CREATE INDEX "signals_event_idx" ON "signals" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "signals_trend_idx" ON "signals" USING btree ("trend_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trends_slug_key" ON "trends" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "brief_items_brief_idx" ON "brief_items" USING btree ("brief_id","section","position");--> statement-breakpoint
CREATE UNIQUE INDEX "brief_items_brief_insight_key" ON "brief_items" USING btree ("brief_id","insight_id");--> statement-breakpoint
CREATE UNIQUE INDEX "collection_items_key" ON "collection_items" USING btree ("collection_id","item_kind","item_id");--> statement-breakpoint
CREATE INDEX "collections_ws_idx" ON "collections" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_turns_key" ON "conversation_turns" USING btree ("conversation_id","position");--> statement-breakpoint
CREATE INDEX "conversations_user_idx" ON "conversations" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_briefs_user_date_key" ON "daily_briefs" USING btree ("user_id","workspace_id","brief_date");--> statement-breakpoint
CREATE INDEX "daily_briefs_user_idx" ON "daily_briefs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "followed_entities_key" ON "followed_entities" USING btree ("user_id","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "followed_topics_key" ON "followed_topics" USING btree ("user_id","kind","slug");--> statement-breakpoint
CREATE INDEX "kcr_user_idx" ON "knowledge_check_results" USING btree ("user_id","learning_unit_id");--> statement-breakpoint
CREATE INDEX "meeting_briefs_meeting_idx" ON "meeting_briefs" USING btree ("meeting_id","created_at");--> statement-breakpoint
CREATE INDEX "meetings_user_idx" ON "meetings" USING btree ("user_id","meeting_at");--> statement-breakpoint
CREATE INDEX "notes_user_idx" ON "notes" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notes_attached_idx" ON "notes" USING btree ("attached_kind","attached_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_insights_key" ON "saved_insights" USING btree ("user_id","insight_id");--> statement-breakpoint
CREATE INDEX "saved_searches_user_idx" ON "saved_searches" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_feedback_user_idx" ON "user_feedback" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "user_feedback_insight_idx" ON "user_feedback" USING btree ("insight_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uks_key" ON "user_knowledge_states" USING btree ("user_id","workspace_id","concept_id");--> statement-breakpoint
CREATE INDEX "uks_review_idx" ON "user_knowledge_states" USING btree ("user_id","review_due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ulp_key" ON "user_learning_progress" USING btree ("user_id","workspace_id","learning_unit_id");--> statement-breakpoint
CREATE INDEX "voice_sessions_user_idx" ON "voice_sessions" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "ai_usage_run_idx" ON "ai_usage" USING btree ("run_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_ws_idx" ON "audit_log" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_target_idx" ON "audit_log" USING btree ("target_kind","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "evaluation_cases_slug_key" ON "evaluation_cases" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "evaluation_cases_suite_idx" ON "evaluation_cases" USING btree ("suite");--> statement-breakpoint
CREATE INDEX "evaluation_results_case_idx" ON "evaluation_results" USING btree ("case_id","created_at");--> statement-breakpoint
CREATE INDEX "model_configurations_active_idx" ON "model_configurations" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "pipeline_runs_started_idx" ON "pipeline_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "pipeline_stage_runs_run_idx" ON "pipeline_stage_runs" USING btree ("run_id","stage");--> statement-breakpoint
CREATE UNIQUE INDEX "prompt_versions_key" ON "prompt_versions" USING btree ("name","version");