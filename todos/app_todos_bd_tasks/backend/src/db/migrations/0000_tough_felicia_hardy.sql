CREATE TABLE "issues" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
