CREATE TABLE "exercises" (
	"id" text PRIMARY KEY NOT NULL,
	"student_cognome" text DEFAULT '' NOT NULL,
	"student_nome" text DEFAULT '' NOT NULL,
	"student_data" text DEFAULT '' NOT NULL,
	"student_classe" text DEFAULT '' NOT NULL,
	"source_text" text NOT NULL,
	"type" text NOT NULL,
	"options_count" integer DEFAULT 3 NOT NULL,
	"exercise" jsonb NOT NULL,
	"answers" jsonb,
	"score" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
