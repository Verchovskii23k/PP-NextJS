import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { lessonTypes } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { safeDelete } from "@/lib/safeDelete";
export const lessonTypesRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: lessonTypes.id,
        name: lessonTypes.name,
        abbreviation: lessonTypes.abbreviation,
        isActive: lessonTypes.isActive,   // ← добавили
        display: sql<string>`CASE ${lessonTypes.name}
          WHEN 'lecture' THEN 'лекция'
          WHEN 'workshop' THEN 'практика'
          WHEN 'guidedStudy' THEN 'КСР'
          WHEN 'lab' THEN 'лабораторная работа'
          ELSE ${lessonTypes.name}
        END`.as('display'),
      })
      .from(lessonTypes);
  }),
  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: lessonTypes.id,
          name: lessonTypes.name,
          abbreviation: lessonTypes.abbreviation,
          isActive: lessonTypes.isActive,   // ← добавили
          display: sql<string>`CASE ${lessonTypes.name}
            WHEN 'lecture' THEN 'лекция'
            WHEN 'workshop' THEN 'практика'
            WHEN 'guidedStudy' THEN 'КСР'
            WHEN 'lab' THEN 'лабораторная работа'
            ELSE ${lessonTypes.name}
          END`.as('display'),
        })
        .from(lessonTypes)
        .where(eq(lessonTypes.id, input.id))
        .limit(1);
      return rows[0] ?? null;
    }),
  create: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      abbreviation: z.string().min(1),   // обязательно
      isActive: z.boolean().default(true)
    }))
    .mutation(async ({ ctx, input }) => ctx.db.insert(lessonTypes).values(input).returning()),
  update: adminProcedure
    .input(z.object({ 
      id: z.number(), 
      name: z.string().min(1).optional(), 
      abbreviation: z.string().optional(),   // ← исправили на optional
      isActive: z.boolean().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(lessonTypes).set(data).where(eq(lessonTypes.id, id)).returning();
    }),
delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => safeDelete(lessonTypes, input.id)),
});