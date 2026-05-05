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
});