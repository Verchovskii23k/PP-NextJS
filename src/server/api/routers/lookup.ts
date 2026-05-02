import { z } from "zod";
import { publicProcedure, router } from "../../trpc";
import * as schema from "@/db/schema";

export const lookupRouter = router({
  getRow: publicProcedure
    .input(z.object({
      tableName: z.string(),
      id: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const table = (schema as any)[input.tableName];
      if (!table) throw new Error(`Table ${input.tableName} not found`);
      const rows = await ctx.db.select().from(table).where(eq(table.id, input.id)).limit(1);
      if (rows.length === 0) return null;
      return rows[0]; // объект со всеми полями строки
    }),
});