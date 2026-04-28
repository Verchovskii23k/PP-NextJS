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

    getList: publicProcedure
    .input(z.object({
      tableName: z.string(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(50).default(15),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const table = (schema as any)[input.tableName];
      if (!table) throw new Error("Table not found");
      let query = ctx.db.select().from(table);
      const [countRow] = await ctx.db.select({ cnt: sql<number>`count(*)` }).from(table);
      const total = countRow?.cnt ?? 0;
      query = query.limit(input.pageSize).offset((input.page - 1) * input.pageSize);
      const rows = await query;
      return { rows, total };
    }),
});
