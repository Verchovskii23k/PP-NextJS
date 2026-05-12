import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { scheduleVersions, units, unitRoots, lessons, lessonClassrooms, scheduleDisplay } from "@/db/schema";
import { eq, isNull } from "drizzle-orm";

export const scheduleVersionsRouter = router({
  /** Получить список всех версий */
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(scheduleVersions).orderBy(scheduleVersions.createdAt);
  }),

  /** Сохранить активную версию с заданным именем */
  saveActive: adminProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      // Создаём запись версии
      const [version] = await ctx.db
        .insert(scheduleVersions)
        .values({ name: input.name })
        .returning({ id: scheduleVersions.id });

      // Обновляем все активные записи, присваивая им versionId
      const tables = [units, unitRoots, lessons, lessonClassrooms, scheduleDisplay];
      for (const table of tables) {
        await ctx.db
          .update(table)
          .set({ versionId: version.id })
          .where(isNull(table.versionId));
      }

      return { versionId: version.id };
    }),

  /** Удалить версию и все связанные данные */
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const tables = [scheduleDisplay, lessonClassrooms, lessons, unitRoots, units];
      for (const table of tables) {
        await ctx.db.delete(table).where(eq(table.versionId, input.id));
      }
      await ctx.db.delete(scheduleVersions).where(eq(scheduleVersions.id, input.id));
      return { success: true };
    }),
});