CREATE TYPE "public"."mission_status" AS ENUM('pending', 'processing', 'completed', 'error');--> statement-breakpoint
CREATE TABLE "missions" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "mission_status" DEFAULT 'pending' NOT NULL,
	"sessionId" text,
	"response" text,
	"error" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "missions_sessionId_unique" UNIQUE("sessionId")
);
--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "updatedAt" timestamp with time zone;