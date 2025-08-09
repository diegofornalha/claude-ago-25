CREATE TABLE "webfetch_docs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"domain" text NOT NULL,
	"title" text,
	"description" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"captured_at" timestamp,
	"last_updated" timestamp,
	"indexed_at" timestamp,
	"content_hash" text,
	"document_id" text,
	"sections" integer DEFAULT 0,
	"words" integer DEFAULT 0,
	"auto_update" boolean DEFAULT false,
	"update_frequency" text DEFAULT 'manual',
	"max_depth" integer DEFAULT 1,
	"category" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"search_count" integer DEFAULT 0,
	"last_searched" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "webfetch_docs_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "webfetch_search_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query" text NOT NULL,
	"mode" text DEFAULT 'hybrid',
	"results_count" integer DEFAULT 0,
	"matched_docs" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webfetch_subpages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"depth" integer NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "webfetch_subpages" ADD CONSTRAINT "webfetch_subpages_parent_id_webfetch_docs_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."webfetch_docs"("id") ON DELETE cascade ON UPDATE no action;