CREATE TABLE "schedule_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lesson_classrooms" ADD COLUMN "version_id" integer;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "version_id" integer;--> statement-breakpoint
ALTER TABLE "schedule_display" ADD COLUMN "version_id" integer;--> statement-breakpoint
ALTER TABLE "unit_roots" ADD COLUMN "version_id" integer;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "version_id" integer;--> statement-breakpoint
ALTER TABLE "lesson_classrooms" ADD CONSTRAINT "lesson_classrooms_version_id_schedule_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."schedule_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_version_id_schedule_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."schedule_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_display" ADD CONSTRAINT "schedule_display_version_id_schedule_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."schedule_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_roots" ADD CONSTRAINT "unit_roots_version_id_schedule_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."schedule_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_version_id_schedule_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."schedule_versions"("id") ON DELETE no action ON UPDATE no action;