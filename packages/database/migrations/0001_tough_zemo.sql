-- Product feedback.
--
-- The search_vector ALTERs that drizzle-kit generated alongside this were removed by
-- hand. Those columns already exist as GENERATED columns created by
-- packages/database/sql/001_search.sql, which drizzle-kit does not model; re-adding them
-- as plain tsvector columns fails on a fresh database and would silently break search on
-- an existing one. See the note in scripts/db-migrate.ts.

CREATE TABLE "product_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" varchar(32) DEFAULT 'other' NOT NULL,
	"message" text NOT NULL,
	"route" varchar(300) DEFAULT '' NOT NULL,
	"user_agent" varchar(400) DEFAULT '' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_feedback" ADD CONSTRAINT "product_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_feedback" ADD CONSTRAINT "product_feedback_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "product_feedback_created_idx" ON "product_feedback" USING btree ("created_at");
