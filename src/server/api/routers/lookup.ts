// server/api/routers/lookup.ts
import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { sql } from "drizzle-orm";

// Преобразование snake_case в camelCase
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function transformRowToCamel(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(row)) {
    result[toCamelCase(key)] = row[key];
  }
  return result;
}

export const lookupRouter = router({
  getRow: publicProcedure
    .input(z.object({ tableName: z.string(), id: z.number() }))
    .query(async ({ ctx, input }) => {
      const allowedTables = [
        "institutes", "buildings", "departments", "specialties", "profiles",
        "disciplines", "unit_types", "lesson_types", "classrooms", "employees",
        "students", "study_groups", "units", "lessons", "curriculum",
        "employees_departments",
      ];
      if (!allowedTables.includes(input.tableName)) {
        throw new Error(`Таблица "${input.tableName}" не разрешена`);
      }

      try {
        const rows = await ctx.db.execute(
          sql`SELECT * FROM ${sql.identifier(input.tableName)} WHERE id = ${input.id}`
        );
        if (!rows || rows.length === 0) return null;
        // Преобразуем ключи первой строки в camelCase
        return transformRowToCamel(rows[0] as Record<string, unknown>);
      } catch (error) {
        console.error(error);
        throw new Error(`Ошибка загрузки данных из таблицы "${input.tableName}"`);
      }
    }),
});