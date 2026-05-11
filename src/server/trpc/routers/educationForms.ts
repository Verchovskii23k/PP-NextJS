import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { educationForms } from "@/db/schema";
import { eq } from "drizzle-orm";
import { safeDelete } from "@/lib/safeDelete";
export const educationFormsRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(educationForms);
  }),
  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(educationForms).where(eq(educationForms.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),
  create: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      abbreviation: z.string().optional(),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => ctx.db.insert(educationForms).values(input).returning()),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      abbreviation: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(educationForms).set(data).where(eq(educationForms.id, id)).returning();
    }),
delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => safeDelete(educationForms, input.id)),
});