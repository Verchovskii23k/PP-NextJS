import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { classrooms } from "@/db/schema";
import { eq } from "drizzle-orm";

export const classroomsRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(classrooms);
  }),
  create: adminProcedure
    .input(z.object({
      buildingId: z.coerce.number().int(),
      roomNumber: z.string().min(1),
      capacity: z.coerce.number().int(),
      departmentId: z.coerce.number().int().optional(),
      priorityLecture: z.coerce.number().int().optional(),
      priorityWorkshop: z.coerce.number().int().optional(),
      priorityGuidedStudy: z.coerce.number().int().optional(),
      priorityLab: z.coerce.number().int().optional(),
      usageMetric: z.coerce.number().optional(),
      isActive: z.boolean().default(true)
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.insert(classrooms).values(input).returning();
    }),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      buildingId: z.number().int().optional(),
      roomNumber: z.string().min(1).optional(),
      capacity: z.number().int().optional(),
      departmentId: z.number().int().optional(),
      priorityLecture: z.number().int().optional(),
      priorityWorkshop: z.number().int().optional(),
      priorityGuidedStudy: z.number().int().optional(),
      priorityLab: z.number().int().optional(),
      usageMetric: z.number().optional(),
      isActive: z.boolean().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(classrooms).set(data).where(eq(classrooms.id, id)).returning();
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.delete(classrooms).where(eq(classrooms.id, input.id));
        return { success: true };
      } catch (e: any) {
        if (e?.code === '23503' || e?.message?.includes('foreign key') || e?.cause?.code === '23503') {
          throw new Error('Невозможно удалить – запись используется в других таблицах');
        }
        throw e;
      }
    }),
  get: adminProcedure
  .input(z.object({ id: z.number() }))
  .query(async ({ ctx, input }) => {
    const rows = await ctx.db.select().from(classrooms).where(eq(classrooms.id, input.id)).limit(1);
    return rows[0] ?? null;
  }),
});