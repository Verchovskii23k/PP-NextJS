// lookup.ts
import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { sql } from "drizzle-orm";

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
        return rows[0] ?? null; // возвращаем как есть (snake_case ключи)
      } catch (error) {
        console.error(error);
        throw new Error(`Ошибка загрузки данных из таблицы "${input.tableName}"`);
      }
    }),
});