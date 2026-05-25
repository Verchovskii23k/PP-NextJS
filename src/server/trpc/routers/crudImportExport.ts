/**
 * @module crudImportExportRouter
 * @description Роутер для импорта и экспорта данных справочных таблиц.
 *
 * Позволяет администратору выгружать любую таблицу из `tablesMeta` в виде JSON
 * и загружать обратно с проверкой существования записей, валидацией полей
 * и последующим INSERT или UPDATE.
 *
 * Процедуры:
 * - `exportAll` – экспорт таблицы.
 * - `importData` – импорт данных с детальным отчётом.
 * Экспортирует все строки указанной таблицы в виде массива объектов.
 *
 * @param {object} input - Входные параметры.
 * @param {string} input.tableName - Имя таблицы из `tablesMeta`.
 * @returns {Promise<unknown[]>} Массив строк таблицы.
 * @throws {TRPCError} Если `tableName` отсутствует в `ALLOWED_TABLES` (проверка через Zod).
 * Импортирует данные в указанную таблицу.
 *
 * Алгоритм для каждой строки:
 * 1. Приводит ключи к snake_case.
 * 2. Проверяет обязательные поля (определены в `tablesMeta[tableName].fields`).
 * 3. Если запись с таким `id` отсутствует – выполняет INSERT.
 * 4. Если запись существует и данные отличаются – UPDATE, иначе пропускает.
 *
 * @param {object} input - Входные параметры.
 * @param {string} input.tableName - Имя таблицы (должно быть в `ALLOWED_TABLES`).
 * @param {unknown[]} input.data - Массив объектов для импорта.
 * @returns {Promise<{
 *   total: number,
 *   inserted: number,
 *   updated: number,
 *   skipped: number,
 *   errors: string[]
 * }>} Статистика импорта: общее количество, сколько вставлено, обновлено, пропущено, а также список ошибок с описанием.
 */
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
        const { id: _rowId, ...values } = dbRow;

        // Проверяем, есть ли хоть одно поле для вставки/обновления
        if (Object.keys(values).length === 0) {
          results.errors.push(`id=${id}: нет данных для импорта (все поля null или отсутствуют)`);
          continue;
        }

        // Валидация обязательных полей
        const validationErrors: string[] = [];
        for (const field of fields) {
          if (field.dbName === "id") continue;
          // Преобразуем camelCase dbName в snake_case для сопоставления с values
          const snakeFieldName = field.dbName.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
          const value = values[snakeFieldName];
          if (field.required && (value === undefined || value === null || value === "")) {
            validationErrors.push(`Поле ${field.displayName} обязательно`);
          }
        }
        if (validationErrors.length) {
          results.errors.push(`id=${id}: ${validationErrors.join(", ")}`);
          continue;
        }

        // Проверка существования
          const [{ count }] = await ctx.db.execute<{ count: number }>(
            sql`SELECT COUNT(*)::int as count FROM ${sql.identifier(dbTableName)} WHERE id = ${id}`
          );
          const exists = count > 0;

        if (!exists) {
          // INSERT: добавляем id в колонки, чтобы сохранить исходный идентификатор
          const columns = ['id', ...Object.keys(values)];
          const valueLiterals = [sql`${id}`, ...Object.values(values).map(v => sql`${v}`)];
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