import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { lessonClassrooms } from "@/db/schema";
import { eq } from "drizzle-orm";

export const lessonClassroomsRouter = router({
  list: adminProcedure.query(async ({ ctx }) => ctx.db.select().from(lessonClassrooms)),
  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(lessonClassrooms).where(eq(lessonClassrooms.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),
  create: adminProcedure
    .input(z.object({
      lessonId: z.coerce.number().int(),
      classroomId: z.coerce.number().int(),
    }))
    .mutation(async ({ ctx, input }) => ctx.db.insert(lessonClassrooms).values(input).returning()),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      lessonId: z.coerce.number().int().optional(),
      classroomId: z.coerce.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(lessonClassrooms).set(data).where(eq(lessonClassrooms.id, id)).returning();
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => ctx.db.delete(lessonClassrooms).where(eq(lessonClassrooms.id, input.id))),
});