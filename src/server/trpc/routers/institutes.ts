import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { institutes } from "@/db/schema";
import { eq } from "drizzle-orm";

const instituteSchema = z.object({
  universityCode: z.number().int().positive(),
  name: z.string().min(1),
  directorId: z.number().int().optional(), // ссылка на employees_departments.id, пока может быть nullable
});

export const institutesRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(institutes);
  }),
  create: adminProcedure
    .input(instituteSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.insert(institutes).values(input).returning();
    }),
  update: adminProcedure
    .input(z.object({ id: z.number(), ...instituteSchema.shape }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(institutes).set(data).where(eq(institutes.id, id)).returning();
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.delete(institutes).where(eq(institutes.id, input.id));
    }),
});