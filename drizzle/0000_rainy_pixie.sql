CREATE TYPE "public"."role" AS ENUM('admin', 'teacher', 'student', 'inactive');--> statement-breakpoint
CREATE TABLE "academic_load_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"abbreviation" text
);
--> statement-breakpoint
CREATE TABLE "buildings" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" integer NOT NULL,
	CONSTRAINT "buildings_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "classrooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"building_id" integer NOT NULL,
	"room_number" text NOT NULL,
	"capacity" integer NOT NULL,
	"department_id" integer,
	"priority_lecture" integer DEFAULT 3,
	"priority_workshop" integer DEFAULT 3,
	"priority_guided_study" integer DEFAULT 3,
	"priority_lab" integer DEFAULT 3,
	"usage_metric" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "control_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"abbreviation" text
);
--> statement-breakpoint
CREATE TABLE "curriculum" (
	"id" serial PRIMARY KEY NOT NULL,
	"course" integer NOT NULL,
	"semester" integer NOT NULL,
	"discipline_id" integer NOT NULL,
	"hours_lecture" integer DEFAULT 0,
	"hours_guided_study" integer DEFAULT 0,
	"hours_workshop" integer DEFAULT 0,
	"hours_lab" integer DEFAULT 0,
	"additional_task_id" integer,
	"control_type_id" integer
);
--> statement-breakpoint
CREATE TABLE "curriculum_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"curriculum_id" integer NOT NULL,
	"profile_id" integer NOT NULL,
	CONSTRAINT "curriculum_profiles_curriculum_id_profile_id_unique" UNIQUE("curriculum_id","profile_id")
);
--> statement-breakpoint
CREATE TABLE "days_of_week" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"abbreviation" text NOT NULL,
	"institute_id" integer NOT NULL,
	"department_code" integer NOT NULL,
	"head_id" integer,
	CONSTRAINT "departments_abbreviation_unique" UNIQUE("abbreviation"),
	CONSTRAINT "departments_department_code_unique" UNIQUE("department_code")
);
--> statement-breakpoint
CREATE TABLE "discipline_teachers" (
	"id" serial PRIMARY KEY NOT NULL,
	"lesson_type_id" integer NOT NULL,
	"discipline_id" integer NOT NULL,
	"teacher_department_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disciplines" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"abbreviation" text NOT NULL,
	"department_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "education" (
	"id" serial PRIMARY KEY NOT NULL,
	"level_id" integer NOT NULL,
	"form_id" integer NOT NULL,
	"duration_months" integer,
	CONSTRAINT "education_level_id_form_id_unique" UNIQUE("level_id","form_id")
);
--> statement-breakpoint
CREATE TABLE "education_forms" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"abbreviation" text,
	CONSTRAINT "education_forms_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "education_levels" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"abbreviation" text,
	CONSTRAINT "education_levels_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"surname" text NOT NULL,
	"name" text NOT NULL,
	"patronymic" text,
	"phone" text,
	"email" text,
	"authentication_id" integer,
	"is_inactive" boolean DEFAULT false,
	CONSTRAINT "employees_email_unique" UNIQUE("email"),
	CONSTRAINT "employees_authentication_id_unique" UNIQUE("authentication_id")
);
--> statement-breakpoint
CREATE TABLE "employees_departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"department_id" integer NOT NULL,
	"employment_type" text,
	"position" text,
	CONSTRAINT "employees_departments_employee_id_department_id_unique" UNIQUE("employee_id","department_id")
);
--> statement-breakpoint
CREATE TABLE "hour_type_mapping" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_hour_column" text NOT NULL,
	"priority_column" text NOT NULL,
	"lesson_type_id" integer NOT NULL,
	CONSTRAINT "hour_type_mapping_plan_hour_column_unique" UNIQUE("plan_hour_column")
);
--> statement-breakpoint
CREATE TABLE "institutes" (
	"id" serial PRIMARY KEY NOT NULL,
	"university_code" integer NOT NULL,
	"name" text NOT NULL,
	"director_id" integer,
	CONSTRAINT "institutes_university_code_unique" UNIQUE("university_code")
);
--> statement-breakpoint
CREATE TABLE "lesson_classrooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"lesson_id" integer NOT NULL,
	"classroom_id" integer NOT NULL,
	CONSTRAINT "lesson_classrooms_lesson_id_classroom_id_unique" UNIQUE("lesson_id","classroom_id")
);
--> statement-breakpoint
CREATE TABLE "lesson_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"abbreviation" text NOT NULL,
	CONSTRAINT "lesson_types_name_unique" UNIQUE("name"),
	CONSTRAINT "lesson_types_abbreviation_unique" UNIQUE("abbreviation")
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" serial PRIMARY KEY NOT NULL,
	"curriculum_id" integer NOT NULL,
	"unit_id" integer NOT NULL,
	"lesson_type_id" integer NOT NULL,
	"discipline_id" integer NOT NULL,
	"teacher_id" integer NOT NULL,
	"count_per_semester" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pairs" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"specialty_id" integer NOT NULL,
	"letter_code" text NOT NULL,
	CONSTRAINT "unique_profile_code" UNIQUE("letter_code","specialty_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "schedule" (
	"id" serial PRIMARY KEY NOT NULL,
	"week_number" integer NOT NULL,
	"day_of_week_id" integer NOT NULL,
	"pair_number_id" integer NOT NULL,
	"lesson_id" integer NOT NULL,
	"classroom_id" integer,
	"merge_flag" integer,
	"position_flag" integer,
	"classroom_flag" integer
);
--> statement-breakpoint
CREATE TABLE "security_center" (
	"id" serial PRIMARY KEY NOT NULL,
	"login" text NOT NULL,
	"password_hash" text NOT NULL,
	"role_id" integer NOT NULL,
	"password_changed_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"failed_login_attempts" integer DEFAULT 0,
	"locked_until" timestamp with time zone,
	CONSTRAINT "security_center_login_unique" UNIQUE("login")
);
--> statement-breakpoint
CREATE TABLE "specialties" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"department_id" integer NOT NULL,
	CONSTRAINT "specialties_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" serial PRIMARY KEY NOT NULL,
	"surname" text NOT NULL,
	"name" text NOT NULL,
	"admission_year" integer NOT NULL,
	"profile_id" integer NOT NULL,
	"study_group_id" integer,
	"course" integer,
	"phone" text,
	"email" text,
	"authentication_id" integer,
	"is_inactive" boolean DEFAULT false,
	CONSTRAINT "students_email_unique" UNIQUE("email"),
	CONSTRAINT "students_authentication_id_unique" UNIQUE("authentication_id")
);
--> statement-breakpoint
CREATE TABLE "study_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"profile_id" integer NOT NULL,
	"course" integer NOT NULL,
	"student_count" integer NOT NULL,
	"curator_id" integer,
	CONSTRAINT "study_groups_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "unit_roots" (
	"id" serial PRIMARY KEY NOT NULL,
	"unit_code" text NOT NULL,
	"study_group_id" integer NOT NULL,
	CONSTRAINT "unit_roots_unit_code_study_group_id_unique" UNIQUE("unit_code","study_group_id")
);
--> statement-breakpoint
CREATE TABLE "unit_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"max_size" integer NOT NULL,
	"priority_lecture" integer DEFAULT 3 NOT NULL,
	"priority_workshop" integer DEFAULT 3 NOT NULL,
	"priority_guided_study" integer DEFAULT 3 NOT NULL,
	"priority_lab" integer DEFAULT 3 NOT NULL,
	CONSTRAINT "unit_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"unit_type_id" integer NOT NULL,
	CONSTRAINT "units_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "weeks" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum" ADD CONSTRAINT "curriculum_discipline_id_disciplines_id_fk" FOREIGN KEY ("discipline_id") REFERENCES "public"."disciplines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum" ADD CONSTRAINT "curriculum_additional_task_id_academic_load_types_id_fk" FOREIGN KEY ("additional_task_id") REFERENCES "public"."academic_load_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum" ADD CONSTRAINT "curriculum_control_type_id_control_types_id_fk" FOREIGN KEY ("control_type_id") REFERENCES "public"."control_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_profiles" ADD CONSTRAINT "curriculum_profiles_curriculum_id_curriculum_id_fk" FOREIGN KEY ("curriculum_id") REFERENCES "public"."curriculum"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_profiles" ADD CONSTRAINT "curriculum_profiles_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discipline_teachers" ADD CONSTRAINT "discipline_teachers_lesson_type_id_lesson_types_id_fk" FOREIGN KEY ("lesson_type_id") REFERENCES "public"."lesson_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discipline_teachers" ADD CONSTRAINT "discipline_teachers_discipline_id_disciplines_id_fk" FOREIGN KEY ("discipline_id") REFERENCES "public"."disciplines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discipline_teachers" ADD CONSTRAINT "discipline_teachers_teacher_department_id_employees_departments_id_fk" FOREIGN KEY ("teacher_department_id") REFERENCES "public"."employees_departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disciplines" ADD CONSTRAINT "disciplines_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "education" ADD CONSTRAINT "education_level_id_education_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."education_levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "education" ADD CONSTRAINT "education_form_id_education_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."education_forms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_authentication_id_security_center_id_fk" FOREIGN KEY ("authentication_id") REFERENCES "public"."security_center"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees_departments" ADD CONSTRAINT "employees_departments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees_departments" ADD CONSTRAINT "employees_departments_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hour_type_mapping" ADD CONSTRAINT "hour_type_mapping_lesson_type_id_lesson_types_id_fk" FOREIGN KEY ("lesson_type_id") REFERENCES "public"."lesson_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_classrooms" ADD CONSTRAINT "lesson_classrooms_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_classrooms" ADD CONSTRAINT "lesson_classrooms_classroom_id_classrooms_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_curriculum_id_curriculum_id_fk" FOREIGN KEY ("curriculum_id") REFERENCES "public"."curriculum"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_lesson_type_id_lesson_types_id_fk" FOREIGN KEY ("lesson_type_id") REFERENCES "public"."lesson_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_discipline_id_disciplines_id_fk" FOREIGN KEY ("discipline_id") REFERENCES "public"."disciplines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_teacher_id_employees_departments_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."employees_departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_specialty_id_specialties_id_fk" FOREIGN KEY ("specialty_id") REFERENCES "public"."specialties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule" ADD CONSTRAINT "schedule_day_of_week_id_days_of_week_id_fk" FOREIGN KEY ("day_of_week_id") REFERENCES "public"."days_of_week"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule" ADD CONSTRAINT "schedule_pair_number_id_pairs_id_fk" FOREIGN KEY ("pair_number_id") REFERENCES "public"."pairs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule" ADD CONSTRAINT "schedule_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule" ADD CONSTRAINT "schedule_classroom_id_classrooms_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_center" ADD CONSTRAINT "security_center_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "specialties" ADD CONSTRAINT "specialties_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_study_group_id_study_groups_id_fk" FOREIGN KEY ("study_group_id") REFERENCES "public"."study_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_authentication_id_security_center_id_fk" FOREIGN KEY ("authentication_id") REFERENCES "public"."security_center"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_groups" ADD CONSTRAINT "study_groups_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_roots" ADD CONSTRAINT "unit_roots_unit_code_units_code_fk" FOREIGN KEY ("unit_code") REFERENCES "public"."units"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_roots" ADD CONSTRAINT "unit_roots_study_group_id_study_groups_id_fk" FOREIGN KEY ("study_group_id") REFERENCES "public"."study_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_unit_type_id_unit_types_id_fk" FOREIGN KEY ("unit_type_id") REFERENCES "public"."unit_types"("id") ON DELETE no action ON UPDATE no action;