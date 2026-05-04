CREATE TABLE "schedule_display" (
	"id" serial PRIMARY KEY NOT NULL,
	"lesson_id" integer,
	"week_number" integer NOT NULL,
	"day_of_week_id" integer NOT NULL,
	"pair_number_id" integer NOT NULL,
	"unit_code" text NOT NULL,
	"display_text" text NOT NULL,
	"merge_number" integer DEFAULT 0,
	"position_flag" boolean DEFAULT false,
	"classroom_flag" boolean DEFAULT false,
	"is_buffered" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "schedule_display" ADD CONSTRAINT "schedule_display_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_display" ADD CONSTRAINT "schedule_display_day_of_week_id_days_of_week_id_fk" FOREIGN KEY ("day_of_week_id") REFERENCES "public"."days_of_week"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_display" ADD CONSTRAINT "schedule_display_pair_number_id_pairs_id_fk" FOREIGN KEY ("pair_number_id") REFERENCES "public"."pairs"("id") ON DELETE no action ON UPDATE no action;