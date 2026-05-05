import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { curriculum } from "@/db/schema";
import { eq } from "drizzle-orm";

export const curriculumRouter = router({
  list: adminProcedure.query(async ({ ctx }) => ctx.db.select().from(curriculum)),
  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(curriculum).where(eq(curriculum.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),
  create: adminProcedure
    .input(z.object({
      course: z.coerce.number().int(),
      semester: z.coerce.number().int(),
      disciplineId: z.coerce.number().int(),
      hoursLecture: z.coerce.number().int().optional(),
      hoursGuidedStudy: z.coerce.number().int().optional(),
      hoursWorkshop: z.coerce.number().int().optional(),
      hoursLab: z.coerce.number().int().optional(),
      additionalTaskId: z.coerce.number().int().nullable().optional(),
      controlTypeId: z.coerce.number().int().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => ctx.db.insert(curriculum).values(input).returning()),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      course: z.number().int().optional(),
      semester: z.number().int().optional(),
      disciplineId: z.number().int().optional(),
      hoursLecture: z.number().int().optional(),
      hoursGuidedStudy: z.number().int().optional(),
      hoursWorkshop: z.number().int().optional(),
      hoursLab: z.number().int().optional(),
      additionalTaskId: z.number().int().nullable().optional(),
      controlTypeId: z.number().int().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(curriculum).set(data).where(eq(curriculum.id, id)).returning();
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => ctx.db.delete(curriculum).where(eq(curriculum.id, input.id))),
});