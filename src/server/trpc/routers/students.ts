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
      admissionYear: z.number().int(),
      profileId: z.number().int(),
      studyGroupId: z.number().int().optional(),
      course: z.number().int().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      isInactive: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.insert(students).values(input).returning();
    }),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      surname: z.string().min(1).optional(),
      name: z.string().min(1).optional(),
      admissionYear: z.number().int().optional(),
      profileId: z.number().int().optional(),
      studyGroupId: z.number().int().optional(),
      course: z.number().int().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      isInactive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(students).set(data).where(eq(students.id, id)).returning();
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.delete(students).where(eq(students.id, input.id));
    }),
});