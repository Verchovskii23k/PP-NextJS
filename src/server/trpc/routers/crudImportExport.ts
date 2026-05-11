// src/server/trpc/routers/crudImportExport.ts
import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { sql } from "drizzle-orm";
import { tablesMeta } from "@/lib/table-meta";

const ALLOWED_TABLES = Object.keys(tablesMeta);
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
        const dbRow: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(row)) {
          const snakeKey = key.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
          dbRow[snakeKey] = val;
        }

        const {...values } = dbRow;

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
          const valueLiterals = Object.values(values).map(v => sql`${v}`);
          await ctx.db.execute(
            sql`INSERT INTO ${sql.identifier(dbTableName)} (${sql.join(columns.map(c => sql.identifier(c)), sql`, `)}) VALUES (${sql.join(valueLiterals, sql`, `)})`
          );
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
          const setParts = Object.entries(values).map(([k, v]) => sql`${sql.identifier(k)} = ${v}`);
          await ctx.db.execute(
            sql`UPDATE ${sql.identifier(dbTableName)} SET ${sql.join(setParts, sql`, `)} WHERE id = ${id}`
          );
          results.updated++;
        }
      } catch (e: unknown) {
        console.error(`Import error for id=${row.id}:`, e);
        const message = e instanceof Error ? e.message : "Неизвестная ошибка";
        results.errors.push(`id=${row.id}: ${message}`);
      }
    }
    return results;
  }),
});