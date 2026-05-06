import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { students } from "@/db/schema";
import { eq } from "drizzle-orm";

export const studentsRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(students);
  }),
  create: adminProcedure
  .input(z.object({
    surname: z.string().min(1),
    name: z.string().min(1),
    admissionYear: z.coerce.number().int(),
    profileId: z.coerce.number().int(),
    studyGroupId: z.coerce.number().int().nullable().optional(),
    course: z.coerce.number().int().nullable().optional(),
    phone: z.string().nullable().optional(),
    email: z.string().email().nullable().optional(),
    isActive: z.boolean().default(true),         // ← новое поле
  }))
  .mutation(async ({ ctx, input }) => {
    return ctx.db.insert(students).values(input).returning();
  }),

update: adminProcedure
  .input(z.object({
    id: z.number(),
    surname: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    admissionYear: z.coerce.number().int().optional(),
    profileId: z.coerce.number().int().optional(),
    studyGroupId: z.coerce.number().int().nullable().optional(),
    course: z.coerce.number().int().nullable().optional(),
    phone: z.string().nullable().optional(),
    email: z.string().email().nullable().optional(),
    isActive: z.boolean().optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    return ctx.db.update(students).set(data).where(eq(students.id, id)).returning();
  }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.delete(students).where(eq(students.id, input.id));
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
        const rows = await ctx.db.select().from(students).where(eq(students.id, input.id)).limit(1);
        return rows[0] ?? null;
    }),
});