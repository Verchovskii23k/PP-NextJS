import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { lessonTypes } from "@/db/schema";
import { eq } from "drizzle-orm";

export const lessonTypesRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(lessonTypes);
  }),
  create: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      abbreviation: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.insert(lessonTypes).values(input).returning();
    }),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      abbreviation: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(lessonTypes).set(data).where(eq(lessonTypes.id, id)).returning();
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.delete(lessonTypes).where(eq(lessonTypes.id, input.id));
    }),
  get: adminProcedure
  .input(z.object({ id: z.number() }))
  .query(async ({ ctx, input }) => {
    const rows = await ctx.db.select().from(lessonTypes).where(eq(lessonTypes.id, input.id)).limit(1);
    return rows[0] ?? null;
  }),
});