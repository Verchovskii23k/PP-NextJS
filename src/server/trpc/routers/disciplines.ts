
import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { disciplines } from "@/db/schema";
import { eq } from "drizzle-orm";

export const disciplinesRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(disciplines);
  }),
  create: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      abbreviation: z.string().optional(),
      departmentId: z.coerce.number().int(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.insert(disciplines).values(input).returning();
    }),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      abbreviation: z.string().min(1),
      departmentId: z.coerce.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(disciplines).set(data).where(eq(disciplines.id, id)).returning();
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.delete(disciplines).where(eq(disciplines.id, input.id));
    }),
  get: adminProcedure
  .input(z.object({ id: z.number() }))
  .query(async ({ ctx, input }) => {
    const rows = await ctx.db.select().from(disciplines).where(eq(disciplines.id, input.id)).limit(1);
    return rows[0] ?? null;
  }),
});