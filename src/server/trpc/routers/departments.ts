import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { departments } from "@/db/schema";
import { eq, asc, sql } from "drizzle-orm";
import { de } from "zod/v4/locales";

export const departmentsRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: departments.id,
        name: departments.name,
        abbreviation: departments.abbreviation,
        instituteId: departments.instituteId,
        departmentCode: departments.departmentCode,
        headId: departments.headId,
        isActive: departments.isActive,
        display: sql<string>`${departments.abbreviation} || ' - ' || ${departments.name}`.as('display'),
      })
      .from(departments)
      .orderBy(asc(departments.name));
  }),
  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: departments.id,
          name: departments.name,
          abbreviation: departments.abbreviation,
          instituteId: departments.instituteId,
          departmentCode: departments.departmentCode,
          headId: departments.headId,
          display: sql<string>`${departments.abbreviation} || ' - ' || ${departments.name}`.as('display'),
        })
        .from(departments)
        .where(eq(departments.id, input.id))
        .limit(1);
      return rows[0] ?? null;
    }),
  create: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      abbreviation: z.string().optional(),
      instituteId: z.coerce.number().int(),
      departmentCode: z.coerce.number().int().positive(),
      headId: z.coerce.number().int().nullable().optional(),
      isActive: z.boolean().default(true)
    }))
    .mutation(async ({ ctx, input }) => ctx.db.insert(departments).values(input).returning()),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      abbreviation: z.string().optional(),
      instituteId: z.number().int().optional(),
      departmentCode: z.number().int().positive().optional(),
      headId: z.number().int().nullable().optional(),
      isActive: z.boolean().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(departments).set(data).where(eq(departments.id, id)).returning();
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.delete(departments).where(eq(departments.id, input.id));
        return { success: true };
      } catch (e: any) {
        if (e?.code === '23503' || e?.message?.includes('foreign key') || e?.cause?.code === '23503') {
          throw new Error('Невозможно удалить – запись используется в других таблицах');
        }
        throw e;
      }
    }),
});