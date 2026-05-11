import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { unitTypes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { safeDelete } from "@/lib/safeDelete";
export const unitTypesRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(unitTypes);
  }),
  create: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      maxSize: z.coerce.number().int(),   // обязательно
      priorityLecture: z.coerce.number().int().optional(),
      priorityWorkshop: z.coerce.number().int().optional(),
      priorityGuidedStudy: z.coerce.number().int().optional(),
      priorityLab: z.coerce.number().int().optional(),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const data = { ...input };
      // Удаляем undefined, чтобы Drizzle использовал default
      Object.keys(data).forEach(k => {
        if (data[k as keyof typeof data] === undefined) delete data[k as keyof typeof data];
      });
      return ctx.db.insert(unitTypes).values(data).returning();
    }),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      maxSize: z.coerce.number().int().optional(),
      priorityLecture: z.coerce.number().int().optional(),
      priorityWorkshop: z.coerce.number().int().optional(),
      priorityGuidedStudy: z.coerce.number().int().optional(),
      priorityLab: z.coerce.number().int().optional(),
      isActive: z.boolean().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(unitTypes).set(data).where(eq(unitTypes.id, id)).returning();
    }),
delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => safeDelete(unitTypes, input.id)),
  get: adminProcedure
  .input(z.object({ id: z.number() }))
  .query(async ({ ctx, input }) => {
    const rows = await ctx.db.select().from(unitTypes).where(eq(unitTypes.id, input.id)).limit(1);
    return rows[0] ?? null;
  }),
  getByName: adminProcedure
  .input(z.object({ name: z.string(), }))
  .query(async ({ ctx, input }) => {
    const rows = await ctx.db.select().from(unitTypes).where(eq(unitTypes.name, input.name)).limit(1);
    return rows[0] ?? null;
  }),
});