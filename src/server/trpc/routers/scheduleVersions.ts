/**
 * Роутер для управления версиями расписания.
 *
 * Все процедуры доступны только администратору (`adminProcedure`).
 * Оперирует динамическими таблицами, перечисленными в `dynamicTables`:
 * `scheduleDisplay`, `schedule`, `lessonClassrooms`, `lessons`, `unitRoots`, `units`.
 *
 * ## Модель версионирования
 * - **Активная версия** — записи с `isActive = true` и `versionId IS NULL`.
 *   Идентификатор активной версии хранится на клиенте (`selectedVersionId`).
 * - **Архивная версия** — записи с `isActive = false` и `versionId = ID версии`.
 *
 * ## Процедуры
 * - `list` — список всех сохранённых версий.
 * - `switchToVersion` — переключает активное расписание на указанную версию или «чистый лист».
 * - `saveActive` — создать новую версию из текущего активного расписания.
 * - `delete` — удалить версию и все её данные.
 * - `update` — переименовать версию.
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
import { eq, and, isNull, ne } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const dynamicTables = [scheduleDisplay, schedule, lessonClassrooms, lessons, unitRoots, units] as const;

export const scheduleVersionsRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(scheduleVersions).orderBy(scheduleVersions.createdAt);
  }),

  /**
   * Переключает активное расписание.
   * - `targetVersionId === null` — активируется «чистый лист» (все активные записи деактивируются).
   * - `targetVersionId !== null` — активируется указанная версия.
   * 
   * @param currentVersionId - ID текущей активной версии (null, если активен чистый лист).
   * @param targetVersionId - ID версии, которую нужно сделать активной (null для чистого листа).
   */
  switchToVersion: adminProcedure
    .input(
      z.object({
        currentVersionId: z.number().nullable(),
        targetVersionId: z.number().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { currentVersionId, targetVersionId } = input;

      // 1. Если есть активная версия, деактивируем её записи
      if (currentVersionId !== null) {
        for (const table of dynamicTables) {
          await ctx.db
            .update(table)
            .set({ isActive: false, versionId: currentVersionId })
            .where(and(eq(table.isActive, true), isNull(table.versionId)));
        }
      }

      // 2. Если нужно активировать конкретную версию
      if (targetVersionId !== null) {
        const [version] = await ctx.db
          .select()
          .from(scheduleVersions)
          .where(eq(scheduleVersions.id, targetVersionId));
        if (!version) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Версия не найдена" });
        }

        for (const table of dynamicTables) {
          await ctx.db
            .update(table)
            .set({ isActive: true, versionId: null })
            .where(and(eq(table.versionId, targetVersionId), eq(table.isActive, false)));
        }
      }

      return { success: true };
    }),

  /**
   * Сохраняет текущее активное расписание как новую версию с заданным именем.
   * 
   * - Проверяет уникальность имени (при совпадении выбрасывает CONFLICT).
   * - Копирует все активные записи из таблиц `scheduleDisplay`, `schedule`,
   *   `lessons`, `unitRoots`, `units` в архив с `isActive = false` и привязкой
   *   к новой версии. Таблица `lessonClassrooms` не копируется, так как её
   *   уникальный ключ (`lesson_id`, `classroom_id`) не позволяет дублировать связи;
   *   аудитории можно назначить заново генератором.
   * - Исходные активные записи (оригинальная версия) остаются без изменений.
   *
   * @param name - название новой версии (уникальное).
   * @returns ID созданной версии.
   * @throws TRPCError CONFLICT – если версия с таким именем уже существует.
   */
saveActive: adminProcedure
  .input(z.object({ name: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    // Проверка на дубликат имени
    const [existingName] = await ctx.db
      .select({ id: scheduleVersions.id })
      .from(scheduleVersions)
      .where(eq(scheduleVersions.name, input.name))
      .limit(1);
    if (existingName) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Версия с названием «${input.name}» уже существует`,
      });
    }

    // Создаём новую версию
    const [newVersion] = await ctx.db
      .insert(scheduleVersions)
      .values({ name: input.name })
      .returning({ id: scheduleVersions.id });

    const versionId = newVersion.id;

    // Копируем активные записи в архив для новой версии,
    // НЕ трогая оригинал (isActive остаётся true у исходных записей)
    const tablesToCopy = [scheduleDisplay, schedule, lessons, unitRoots, units] as const;
    for (const table of tablesToCopy) {
      const activeRows = await ctx.db
        .select()
        .from(table)
        .where(and(eq(table.isActive, true), isNull(table.versionId)));

      if (activeRows.length > 0) {
        const rowsToInsert = activeRows.map(row => ({
          ...row,
          id: undefined, // автоинкремент
          isActive: false,
          versionId,
        }));
        await ctx.db.insert(table).values(rowsToInsert);
      }
    }
    return { versionId };
  }),

  /**
   * Удаляет версию и все её данные из динамических таблиц.
   * Может удалять как архивные, так и активную версию (предварительно деактивированную).
   */
  delete: adminProcedure
    .input(z.object({ versionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { versionId } = input;

      // Удаляем записи динамических таблиц, принадлежащие версии (любая активность)
      for (const table of dynamicTables) {
        await ctx.db
          .delete(table)
          .where(eq(table.versionId, versionId));
      }

      // Удаляем саму версию
      await ctx.db
        .delete(scheduleVersions)
        .where(eq(scheduleVersions.id, versionId));

      return { success: true };
    }),

  /**
   * Обновляет имя существующей версии.
   */
  update: adminProcedure
    .input(z.object({ versionId: z.number(), name: z.string().min(1).optional() }))
    .mutation(async ({ ctx, input }) => {
      if (input.name) {
      const conflict = await ctx.db
        .select({ id: scheduleVersions.id })
        .from(scheduleVersions)
        .where(
          and(
            eq(scheduleVersions.name, input.name),
            ne(scheduleVersions.id, input.versionId)
          )
        )
        .limit(1);
      if (conflict.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Версия с названием «${input.name}» уже существует`,
        });
      }
      if (input.name) {
        await ctx.db
          .update(scheduleVersions)
          .set({ name: input.name, createdAt: new Date() })
          .where(eq(scheduleVersions.id, input.versionId));
      }
    }
      return { success: true };
  }),
});