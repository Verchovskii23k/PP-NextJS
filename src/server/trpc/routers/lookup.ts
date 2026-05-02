// src/server/trpc/routers/lookup.ts
import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { sql } from "drizzle-orm";

// Простая функция перевода snake_case в camelCase
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// Рекурсивное преобразование ключей объекта
function mapKeysToCamel(obj: any): any {
  if (Array.isArray(obj)) return obj.map(mapKeysToCamel);
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([key, val]) => [toCamelCase(key), mapKeysToCamel(val)])
    );
  }
  return obj;
}

export const lookupRouter = router({
  getRow: publicProcedure
    .input(z.object({ tableName: z.string(), id: z.number() }))
    .query(async ({ ctx, input }) => {
      const allowedTables = [
        "institutes", "buildings", "departments", "specialties", "profiles",
        "disciplines", "unit_types", "lesson_types", "classrooms", "employees",
        "students", "study_groups", "units", "lessons", "curriculum",
        "employees_departments", "lesson_classrooms", "unit_roots",
        "curriculum_profiles", "academic_load_types", "control_types",
        "hour_type_mapping", "discipline_teachers", "settings",
        "days_of_week", "pairs", "weeks",
      ];
      if (!allowedTables.includes(input.tableName)) {
        throw new Error(`Таблица "${input.tableName}" не разрешена`);
      }

      try {
        const rows = await ctx.db.execute(
          sql`SELECT * FROM ${sql.identifier(input.tableName)} WHERE id = ${input.id}`
        );
        if (rows.length === 0) return null;
        return mapKeysToCamel(rows[0]); // отдаём объект с camelCase-ключами
      } catch (error) {
        console.error(error);
        throw new Error(`Ошибка загрузки данных из таблицы "${input.tableName}"`);
      }
    }),
});