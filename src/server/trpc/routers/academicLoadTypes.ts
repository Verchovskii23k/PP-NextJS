import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { academicLoadTypes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { safeDelete } from "@/lib/safeDelete";

export const academicLoadTypesRouter = router({
  list: adminProcedure.query(async ({ ctx }) => ctx.db.select().from(academicLoadTypes)),
  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(academicLoadTypes).where(eq(academicLoadTypes.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),
  create: adminProcedure
    .input(z.object({ 
      name: z.string().min(1), 
      abbreviation: z.string().optional(),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => 
      ctx.db.insert(academicLoadTypes).values(input).returning()),
  update: adminProcedure
    .input(z.object({ id: z.number(), 
      name: z.string().min(1).optional(), 
      abbreviation: z.string().optional(), 
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(academicLoadTypes).set(data).where(eq(academicLoadTypes.id, id)).returning();
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => safeDelete(academicLoadTypes, input.id)),
});