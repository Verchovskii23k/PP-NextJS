// src/server/trpc/routers/crudImportExport.ts
import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { sql } from "drizzle-orm";
import { tablesMeta } from "@/lib/table-meta";

const ALLOWED_TABLES = Object.keys(tablesMeta);

// Экранирование для SQL
function escapeSqlString(value: any): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return `'${String(value).replace(/'/g, "''")}'`;
}

export const crudImportExportRouter = router({
  exportAll: adminProcedure
    .input(z.object({ tableName: z.string().refine(t => ALLOWED_TABLES.includes(t)) }))
    .query(async ({ ctx, input }) => {
      const dbTableName = tablesMeta[input.tableName].dbTableName || input.tableName;
      const rows = await ctx.db.execute(sql`SELECT * FROM ${sql.identifier(dbTableName)}`);
      return rows;
    }),

  // Упрощённая версия импорта – без ошибок
  importData: adminProcedure
  .input(z.object({
    tableName: z.string().refine(t => ALLOWED_TABLES.includes(t)),
    data: z.array(z.any()),
  }))
  .mutation(async ({ ctx, input }) => {
    const { tableName, data } = input;
    const dbTableName = tablesMeta[tableName].dbTableName || tableName;
    const fields = tablesMeta[tableName].fields;

    const results = {
      total: data.length,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const row of data) {
      try {
        const id = row.id;
        if (id === undefined || id === null) {
          results.errors.push(`Строка без id: ${JSON.stringify(row)}`);
          continue;
        }

        // Преобразуем camelCase → snake_case, если нужно
        const dbRow: any = {};
        for (const [key, val] of Object.entries(row)) {
          const snakeKey = key.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
          dbRow[snakeKey] = val;
        }

        const { id: _, ...values } = dbRow;

        // Проверяем, есть ли хоть одно поле для вставки/обновления
        if (Object.keys(values).length === 0) {
          results.errors.push(`id=${id}: нет данных для импорта (все поля null или отсутствуют)`);
          continue;
        }

        // Валидация обязательных полей
        const validationErrors: string[] = [];
        for (const field of fields) {
          if (field.dbName === "id") continue;
          const value = values[field.dbName];
          if (field.required && (value === undefined || value === null || value === "")) {
            validationErrors.push(`Поле ${field.displayName} обязательно`);
          }
        }
        if (validationErrors.length) {
          results.errors.push(`id=${id}: ${validationErrors.join(", ")}`);
          continue;
        }

        // Проверка существования
        const [existing] = await ctx.db.execute(
          sql`SELECT 1 FROM ${sql.identifier(dbTableName)} WHERE id = ${id}`
        );

        if (!existing) {
          // INSERT с параметрами
          const columns = Object.keys(values);
          const placeholders = columns.map(() => sql.param("?")); // так не работает, лучше собрать массив
          const insertSql = sql`INSERT INTO ${sql.identifier(dbTableName)} (${sql.raw(columns.join(", "))}) VALUES (${sql.join(Object.values(values).map(() => sql`?`), sql`, `)})`;
          // Передаём значения отдельно
          await ctx.db.execute(insertSql, Object.values(values));
          results.inserted++;
        } else {
          // Проверяем, нужно ли обновление
          const [current] = await ctx.db.execute(
            sql`SELECT * FROM ${sql.identifier(dbTableName)} WHERE id = ${id}`
          );
          let needUpdate = false;
          for (const [k, v] of Object.entries(values)) {
            if (String(current[k]) !== String(v)) {
              needUpdate = true;
              break;
            }
          }
          if (!needUpdate) {
            results.skipped++;
            continue;
          }
          // UPDATE с параметрами
          const setClause = sql.join(
            Object.keys(values).map(k => sql`${sql.identifier(k)} = ?`),
            sql`, `
          );
          const updateSql = sql`UPDATE ${sql.identifier(dbTableName)} SET ${setClause} WHERE id = ${id}`;
          await ctx.db.execute(updateSql, Object.values(values));
          results.updated++;
        }
      } catch (error: any) {
        console.error(`Import error for id=${row.id}:`, error);
        results.errors.push(`id=${row.id}: ${error.message}`);
      }
    }
    return results;
  }),
});