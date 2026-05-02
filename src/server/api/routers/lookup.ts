import { z } from "zod";
import { router, adminProcedure } from "@/server/trpc";   // ✅ абсолютный путь
import * as schema from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const lookupRouter = router({
  getRow: adminProcedure
    .input(z.object({
      tableName: z.string(),
      id: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const table = (schema as any)[input.tableName];
      if (!table) throw new Error(`Table ${input.tableName} not found`);
      const rows = await ctx.db
        .select()
        .from(table)
        .where(eq(table.id, input.id))
        .limit(1);
      return rows[0] ?? null;
    }),

  getList: adminProcedure
    .input(z.object({
      tableName: z.string(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(50).default(15),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const table = (schema as any)[input.tableName];
      if (!table) throw new Error("Table not found");

      const [countRow] = await ctx.db
        .select({ cnt: sql<number>`count(*)` })
        .from(table);
      const total = countRow?.cnt ?? 0;

      const rows = await ctx.db
        .select()
        .from(table)
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);

      return { rows, total };
    }),
});