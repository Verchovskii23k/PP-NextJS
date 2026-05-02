import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { hourTypeMapping } from "@/db/schema";
import { eq } from "drizzle-orm";

export const hourTypeMappingRouter = router({
  list: adminProcedure.query(async ({ ctx }) => ctx.db.select().from(hourTypeMapping)),
  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(hourTypeMapping).where(eq(hourTypeMapping.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),
  create: adminProcedure
    .input(z.object({
      planHourColumn: z.string().min(1),
      priorityColumn: z.string().min(1),
      lessonTypeId: z.number().int(),
    }))
    .mutation(async ({ ctx, input }) => ctx.db.insert(hourTypeMapping).values(input).returning()),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      planHourColumn: z.string().min(1).optional(),
      priorityColumn: z.string().min(1).optional(),
      lessonTypeId: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(hourTypeMapping).set(data).where(eq(hourTypeMapping.id, id)).returning();
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => ctx.db.delete(hourTypeMapping).where(eq(hourTypeMapping.id, input.id))),
});