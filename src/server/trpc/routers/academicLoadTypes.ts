// src/server/trpc/routers/crudImportExport.ts
import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { sql } from "drizzle-orm";
import { tablesMeta } from "@/lib/table-meta";

const ALLOWED_TABLES = Object.keys(tablesMeta);

export const crudImportExportRouter = router({
  // Экспорт (работает)
  exportAll: adminProcedure
    .input(z.object({ tableName: z.string().refine(t => ALLOWED_TABLES.includes(t)) }))
    .query(async ({ ctx, input }) => {
      const dbTableName = tablesMeta[input.tableName].dbTableName || input.tableName;
      const rows = await ctx.db.execute(sql`SELECT * FROM ${sql.identifier(dbTableName)}`);
      return rows;
    }),

  // Импорт (упрощённый, рабочий)
  importData: adminProcedure
    .input(z.object({
      tableName: z.string().refine(t => ALLOWED_TABLES.includes(t)),
      data: z.array(z.record(z.any())),
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

          // Проверка существования
          const existingRows = await ctx.db.execute(
            sql`SELECT * FROM ${sql.identifier(dbTableName)} WHERE id = ${id}`
          );
          const existing = existingRows[0] as any;

          const { id: _, ...values } = row;

          // Валидация обязательных полей
          const validationErrors: string[] = [];
          for (const field of fields) {
            if (field.dbName === "id") continue;
            const value = row[field.dbName];
            if (field.required && (value === undefined || value === null || value === "")) {
              validationErrors.push(`Поле ${field.displayName} обязательно`);
            }
          }
          if (validationErrors.length) {
            results.errors.push(`id=${id}: ${validationErrors.join(", ")}`);
            continue;
          }

          if (!existing) {
            // Вставка
            const columns = Object.keys(values);
            const placeholders = columns.map(() => "?").join(", ");
            const rawQuery = `INSERT INTO ${dbTableName} (${columns.join(", ")}) VALUES (${placeholders})`;
            await ctx.db.execute(sql.raw(rawQuery, ...Object.values(values)));
            results.inserted++;
          } else {
            // Сравнение
            let needUpdate = false;
            for (const [k, v] of Object.entries(values)) {
              if (String(existing[k]) !== String(v)) {
                needUpdate = true;
                break;
              }
            }
            if (!needUpdate) {
              results.skipped++;
              continue;
            }
            // Обновление
            const setClause = Object.keys(values).map(k => `${k} = ?`).join(", ");
            const rawUpdate = `UPDATE ${dbTableName} SET ${setClause} WHERE id = ?`;
            await ctx.db.execute(sql.raw(rawUpdate, ...Object.values(values), id));
            results.updated++;
          }
        } catch (error: any) {
          results.errors.push(`id=${row.id}: ${error.message}`);
        }
      }
      return results;
    }),
});