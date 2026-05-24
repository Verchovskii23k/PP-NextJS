/**
 * Роутер для управления версиями расписания.
 *
 * Все процедуры доступны только администратору (`adminProcedure`).
 * Оперирует динамическими таблицами, перечисленными в `dynamicTables`:
 * `scheduleDisplay`, `schedule`, `lessonClassrooms`, `lessons`, `unitRoots`, `units`.
 *
 * ## Модель версионирования
 * - **Активная версия** — записи с `isActive = true` и `versionId IS NULL`.
 * - **Архивная версия** — записи с `isActive = false` и `versionId = ID версии`.
 *
 * Сохранение версии **не удаляет** данные, а переводит их в архив.
 * Восстановление версии **удаляет** текущие активные записи и возвращает
 * архивные в активное состояние.
 *
 * ## Процедуры
 * - `list` — список всех сохранённых версий.
 * - `saveActive` — создать новую версию из текущего активного расписания.
 * - `restoreAsActive` — заменить активное расписание выбранной архивной версией.
 * - `delete` — удалить архивную версию и все её данные.
 * - `update` — переименовать версию.
 *
 * @remarks
 * - Группы (`studyGroups`) не версионируются и всегда остаются активными.
 * - При удалении версии физически удаляются записи из динамических таблиц.
 * - При восстановлении версии текущие активные данные безвозвратно теряются.
 */
import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import {
  scheduleVersions,
  units,
  unitRoots,
  lessons,
  lessonClassrooms,
  schedule,
  scheduleDisplay,
} from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// Список всех динамических таблиц для единообразной обработки
const dynamicTables = [scheduleDisplay, schedule, lessonClassrooms, lessons, unitRoots, units] as const;

export const scheduleVersionsRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(scheduleVersions).orderBy(scheduleVersions.createdAt);
  }),

  // Сохранить активное расписание как новую версию
  saveActive: adminProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      // 1. Создаём новую версию
      const [newVersion] = await ctx.db
        .insert(scheduleVersions)
        .values({ name: input.name })
        .returning({ id: scheduleVersions.id });

      const versionId = newVersion.id;

      // 2. Помечаем все активные записи как архивные для этой версии
      for (const table of dynamicTables) {
        await ctx.db
          .update(table)
          .set({ isActive: false, versionId })
          .where(and(eq(table.isActive, true), isNull(table.versionId)));
      }

      return { versionId };
    }),

  // Восстановить выбранную архивную версию как активную

restoreAsActive: adminProcedure
  .input(z.object({ versionId: z.number() }))
  .mutation(async ({ ctx, input }) => {
    const { versionId } = input;

    // 1. Проверяем существование версии
    const [version] = await ctx.db
      .select()
      .from(scheduleVersions)
      .where(eq(scheduleVersions.id, versionId));
    if (!version) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Версия не найдена" });
    }

    // 2. Удаляем текущие активные записи во всех динамических таблицах
    for (const table of dynamicTables) {
      await ctx.db
        .delete(table)
        .where(and(eq(table.isActive, true), isNull(table.versionId)));
    }

    // 3. Делаем выбранную версию активной (меняем флаги)
    for (const table of dynamicTables) {
      await ctx.db
        .update(table)
        .set({ isActive: true, versionId: null })
        .where(and(eq(table.versionId, versionId), eq(table.isActive, false)));
    }

    return { success: true };
  }),

  // Удалить версию (только архивную, не активную)
  delete: adminProcedure
    .input(z.object({ versionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { versionId } = input;

      for (const table of dynamicTables) {
        await ctx.db
          .delete(table)
          .where(and(eq(table.versionId, versionId), eq(table.isActive, false)));
      }

      await ctx.db
        .delete(scheduleVersions)
        .where(eq(scheduleVersions.id, versionId));

      return { success: true };
    }),

  // Обновить имя версии
  update: adminProcedure
    .input(z.object({ versionId: z.number(), name: z.string().min(1).optional() }))
    .mutation(async ({ ctx, input }) => {
      if (input.name) {
        await ctx.db
          .update(scheduleVersions)
          .set({ name: input.name, createdAt: new Date() })
          .where(eq(scheduleVersions.id, input.versionId));
      }
      return { success: true };
    }),
});