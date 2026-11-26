ALTER TABLE "exercises" ADD COLUMN "feasibility" jsonb;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "instructions" text;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "focus" jsonb;