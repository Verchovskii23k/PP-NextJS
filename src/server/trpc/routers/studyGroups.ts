import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { studyGroups } from "@/db/schema";
import { eq } from "drizzle-orm";

export const studyGroupsRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(studyGroups);
  }),
  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(studyGroups).where(eq(studyGroups.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),
});