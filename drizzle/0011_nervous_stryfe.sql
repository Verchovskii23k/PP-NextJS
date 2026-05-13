ALTER TABLE "lesson_classrooms" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "study_groups" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;