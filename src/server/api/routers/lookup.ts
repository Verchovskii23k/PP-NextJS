import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import {
  institutes, buildings, departments, specialties, profiles,
  disciplines, unitTypes, lessonTypes, classrooms, employees,
  students, studyGroups, units, lessons, curriculum,
  employeesDepartments, controlTypes, academicLoadTypes,
  educationLevels, educationForms, education,
  hourTypeMapping, disciplineTeachers, weeks, daysOfWeek, pairs,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

// Все таблицы, которые могут быть запрошены через тултипы
const tableMap: Record<string, PgTable<any>> = {
  institutes,
  buildings,
  departments,
  specialties,
  profiles,
  disciplines,
  unit_types: unitTypes,
  lesson_types: lessonTypes,
  classrooms,
  employees,
  students,
  study_groups: studyGroups,
  units,
  lessons,
  curriculum,
  employees_departments: employeesDepartments,
  control_types: controlTypes,
  academic_load_types: academicLoadTypes,
  education_levels: educationLevels,
  education_forms: educationForms,
  education,
  hour_type_mapping: hourTypeMapping,
  discipline_teachers: disciplineTeachers,
  weeks,
  days_of_week: daysOfWeek,
  pairs,
};

export const lookupRouter = router({
  getRow: publicProcedure
    .input(z.object({ tableName: z.string(), id: z.number() }))
    .query(async ({ ctx, input }) => {
      const table = tableMap[input.tableName];
      if (!table) {
        throw new Error(`Таблица "${input.tableName}" не найдена в lookup`);
      }

      try {
        const rows = await ctx.db
          .select()
          .from(table)
          .where(eq(table.id as any, input.id))
          .limit(1);
        return rows[0] ?? null;
      } catch (error) {
        console.error(`Lookup error for table ${input.tableName}, id ${input.id}:`, error);
        throw new Error(`Не удалось загрузить данные из таблицы "${input.tableName}"`);
      }
    }),
});