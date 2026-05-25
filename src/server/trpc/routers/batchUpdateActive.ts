/**
 * Роутер для массового включения/отключения активности записей в любой CRUD-таблице,
 * имеющей ручное управление флагом `isActive` (поле с `inputType: "toggle"` в метаданных).
 *
 * Доступен только администратору. Проверяет, что таблица зарегистрирована в `tablesMeta`
 * и действительно содержит `isActive` с типом `toggle`. При деактивации (`isActive = false`)
 * для каждой изменённой записи вызывается {@link cascadeDeactivate}, чтобы каскадно
 * отключить все дочерние сущности с ручным управлением активностью.
 * При активации (`isActive = true`) каскад не применяется – флаг просто поднимается.
 *
 * ## Мутация `updateMany`
 * @input { tableName: string, ids: number[], isActive: boolean }
 *   - `tableName` – ключ таблицы из `tablesMeta`.
 *   - `ids` – массив ID записей, для которых требуется изменить активность (минимум 1 элемент).
 *   - `isActive` – целевое состояние: `true` для активации, `false` для деактивации.
 *
 * @returns Объект `{ updated: number }`, где `updated` – количество записей, чьё состояние
 *   действительно изменилось (т.е. записи, уже имевшие нужный флаг, не учитываются).
 *
 * ## Ошибки
 * @throws {TRPCError} с кодом `BAD_REQUEST`:
 *   - если таблица не найдена в `tablesMeta`;
 *   - если таблица не поддерживает ручное управление активностью (нет поля `isActive` с `toggle`).
 * @throws {TRPCError} с кодом `INTERNAL_SERVER_ERROR`, если не удалось определить
 *   ключ родительской таблицы для вызова `cascadeDeactivate`.
 *
 * ## Важные детали
 * - Запросы для активации и деактивации написаны так, чтобы обновлять только те записи,
 *   у которых текущее значение флага отличается от целевого (`IS DISTINCT FROM`).
 *   Это даёт точный подсчёт изменённых строк и исключает холостые UPDATE.
 * - Деактивация обёрнута в одну большую транзакцию: сначала вычисляются действительно
 *   изменённые ID, затем для каждого из них вызывается каскад, после чего возвращается
 *   количество изменённых записей. Такой подход гарантирует атомарность и точное число.
 * - Каскад затрагивает только сущности с ручным `toggle` (проверяется внутри
 *   {@link cascadeDeactivate} на основе `tablesMeta`).
 *
 * ## Пример использования (фронтенд)
 * ```ts
 * const result = await trpc.batchUpdateActive.updateMany.mutateAsync({
 *   tableName: "institutes",
 *   ids: [1, 2, 3],
 *   isActive: false,
 * });
 * // result.updated – число институтов, действительно деактивированных
 * ```
 *
 * @remarks
 * - Русские названия таблиц для проверок берутся из `tablesMeta`.
 * - При добавлении нового справочника с ручным toggle достаточно заполнить его
 *   метаданные – роутер подхватит его автоматически.
 */
import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { tablesMeta } from "@/lib/table-meta";
import { cascadeDeactivate } from "@/lib/cascadeDeactivate";
import { TRPCError } from "@trpc/server";

export const batchUpdateActiveRouter = router({
  updateMany: adminProcedure
    .input(
      z.object({
        tableName: z.string(),
        ids: z.array(z.number()).min(1),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ input }) => {
      const { tableName, ids, isActive } = input;
      // Проверяем, что таблица существует в метаданных и имеет toggle isActive
      const meta = tablesMeta[tableName];
      if (!meta) throw new TRPCError({ code: "BAD_REQUEST", message: "Таблица не найдена" });
      
      const hasToggleActive = meta.fields.some(
        (f) => f.dbName === "isActive" && f.inputType === "toggle"
      );
      if (!hasToggleActive) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Таблица не поддерживает ручное управление активностью",
        });
      }

      const dbTableName = meta.dbTableName || tableName;

      // Получаем ключ родительской таблицы для cascadeDeactivate
      // Ищем ключ в tablesMeta по dbTableName
      let parentKey: string | undefined;
      for (const [key, m] of Object.entries(tablesMeta)) {
        if (m.dbTableName === dbTableName) {
          parentKey = key;
          break;
        }
      }
      if (!parentKey) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Не удалось определить ключ таблицы" });
      }

      const idsList = ids.join(", ");

      // Если отключаем — каскадно деактивируем каждого
    if (isActive) {
        const result = await db.execute<{ id: number }>(
        sql`UPDATE ${sql.identifier(dbTableName)} SET is_active = true WHERE id IN (${sql.raw(idsList)}) AND is_active IS DISTINCT FROM true RETURNING id`
        );
        const updatedCount = Array.isArray(result) ? result.length : 0;
        return { updated: updatedCount };
    } else {
        // Деактивация с каскадом
        return await db.transaction(async (tx) => {
            // Сначала обновляем тех, кто ещё активен, и запоминаем их id
            const changedIdsResult = await tx.execute<{ id: number }>(
                sql`UPDATE ${sql.identifier(dbTableName)} SET is_active = false WHERE id IN (${sql.raw(idsList)}) AND is_active IS DISTINCT FROM false RETURNING id`
            );
            const changedIds: number[] = Array.isArray(changedIdsResult) ? changedIdsResult.map(r => r.id) : [];

            // Для каждого изменённого id вызываем каскад
            for (const id of changedIds) {
                await cascadeDeactivate(tx, parentKey!, id);
            }
            return { updated: changedIds.length };
        })}
    })
})
