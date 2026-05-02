import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { unitTypes } from "@/db/schema";
import { eq } from "drizzle-orm";

export const unitTypesRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(unitTypes);
  }),
  create: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      maxSize: z.number().int().optional(),
      priorityLecture: z.number().int().optional(),
      priorityWorkshop: z.number().int().optional(),
      priorityGuidedStudy: z.number().int().optional(),
      priorityLab: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.insert(unitTypes).values(input).returning();
    }),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      maxSize: z.number().int().optional(),
      priorityLecture: z.number().int().optional(),
      priorityWorkshop: z.number().int().optional(),
      priorityGuidedStudy: z.number().int().optional(),
      priorityLab: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(unitTypes).set(data).where(eq(unitTypes.id, id)).returning();
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.delete(unitTypes).where(eq(unitTypes.id, input.id));
    }),
  get: adminProcedure
  .input(z.object({ id: z.number() }))
  .query(async ({ ctx, input }) => {
    const rows = await ctx.db.select().from(unitTypes).where(eq(unitTypes.id, input.id)).limit(1);
    return rows[0] ?? null;
  }),
  getByName: adminProcedure
  .input(z.object({ name: z.string() }))
  .query(async ({ ctx, input }) => {
    const rows = await ctx.db.select().from(unitTypes).where(eq(unitTypes.name, input.name)).limit(1);
    return rows[0] ?? null;
  }),
});