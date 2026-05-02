import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";

export const profilesRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(profiles);
  }),
  create: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      specialtyId: z.number().int(),
      letterCode: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.insert(profiles).values(input).returning();
    }),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      specialtyId: z.number().int().optional(),
      letterCode: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(profiles).set(data).where(eq(profiles.id, id)).returning();
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.delete(profiles).where(eq(profiles.id, input.id));
    }),
  get: adminProcedure
  .input(z.object({ id: z.number() }))
  .query(async ({ ctx, input }) => {
    const rows = await ctx.db.select().from(profiles).where(eq(profiles.id, input.id)).limit(1);
    return rows[0] ?? null;
  }),
});