import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { sql } from "drizzle-orm";

export const lookupRouter = router({
  getRow: publicProcedure
    .input(z.object({ tableName: z.string(), id: z.number() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.execute(
        sql`SELECT * FROM ${sql.identifier(input.tableName)} WHERE id = ${input.id}`
      );
      return result.rows[0] ?? null;
    }),
});