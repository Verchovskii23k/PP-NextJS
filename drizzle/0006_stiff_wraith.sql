ALTER TABLE "security_center" ADD COLUMN "reset_token" text;--> statement-breakpoint
ALTER TABLE "security_center" ADD COLUMN "reset_token_expires" timestamp with time zone;