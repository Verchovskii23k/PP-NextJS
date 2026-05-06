ALTER TABLE "institutes" DROP CONSTRAINT "institutes_director_id_employees_departments_id_fk";
--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_head_id_employees_id_fk" FOREIGN KEY ("head_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institutes" ADD CONSTRAINT "institutes_director_id_employees_id_fk" FOREIGN KEY ("director_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_groups" ADD CONSTRAINT "study_groups_curator_id_employees_id_fk" FOREIGN KEY ("curator_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;