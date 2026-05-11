import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { specialties, profiles } from "@/db/schema";
import { eq, asc, sql } from "drizzle-orm";
import { safeDelete } from "@/lib/safeDelete";
export const specialtiesRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: specialties.id,
        code: specialties.code,
        name: specialties.name,
        departmentId: specialties.departmentId,
        isActive: specialties.isActive,
        display: sql<string>`${specialties.code} || ' - ' || ${specialties.name}`.as('display'),
      })
      .from(specialties)
      .orderBy(asc(specialties.code));
  }),
  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: specialties.id,
          code: specialties.code,
          name: specialties.name,
          departmentId: specialties.departmentId,
          isActive: specialties.isActive,
          display: sql<string>`${specialties.code} || ' - ' || ${specialties.name}`.as('display'),
        })
        .from(specialties)
        .where(eq(specialties.id, input.id))
        .limit(1);
      return rows[0] ?? null;
    }),
  create: adminProcedure
    .input(z.object({
      code: z.string().min(1),
      name: z.string().min(1),
      departmentId: z.coerce.number().int(),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => ctx.db.insert(specialties).values(input).returning()),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      code: z.string().min(1).optional(),
      name: z.string().min(1).optional(),
      departmentId: z.coerce.number().int().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, isActive, ...data } = input;

      if (isActive === false) {
        await ctx.db.update(profiles).set({ isActive: false }).where(eq(profiles.specialtyId, id));
      }

      return ctx.db
        .update(specialties)
        .set({ ...data, isActive })
        .where(eq(specialties.id, id))
        .returning();
    }),
delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => safeDelete(specialties, input.id)),
});