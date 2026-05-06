import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { profiles, specialties } from "@/db/schema";
import { eq, asc, sql } from "drizzle-orm";

export const profilesRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: profiles.id,
        name: profiles.name,
        specialtyId: profiles.specialtyId,
        letterCode: profiles.letterCode,
        profileDisplay: sql<string>`CONCAT(${profiles.letterCode}, ' (', ${specialties.code}, ' - ', ${specialties.name}, ')')`.as('profile_display'),
      })
      .from(profiles)
      .innerJoin(specialties, eq(profiles.specialtyId, specialties.id))
      .orderBy(asc(profiles.letterCode));
  }),
  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: profiles.id,
          name: profiles.name,
          specialtyId: profiles.specialtyId,
          letterCode: profiles.letterCode,
          profileDisplay: sql<string>`CONCAT(${profiles.letterCode}, ' (', ${specialties.code}, ' - ', ${specialties.name}, ')')`.as('profile_display'),
        })
        .from(profiles)
        .innerJoin(specialties, eq(profiles.specialtyId, specialties.id))
        .where(eq(profiles.id, input.id))
        .limit(1);
      return rows[0] ?? null;
    }),
  create: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      specialtyId: z.coerce.number().int(),
      letterCode: z.string().optional(),
      isActive: z.boolean().default(true)
    }))
    .mutation(async ({ ctx, input }) => ctx.db.insert(profiles).values(input).returning()),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      specialtyId: z.coerce.number().int().optional(),
      letterCode: z.string().optional(),
      isActive: z.boolean().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(profiles).set(data).where(eq(profiles.id, id)).returning();
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.delete(profiles).where(eq(profiles.id, input.id));
        return { success: true };
      } catch (e: any) {
        if (e?.code === '23503' || e?.message?.includes('foreign key') || e?.cause?.code === '23503') {
          throw new Error('Невозможно удалить – запись используется в других таблицах');
        }
        throw e;
      }
    }),
});