import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { tablesMeta } from "@/lib/table-meta";

// Таблицы, которые разрешено массово удалять (все, кроме системных)
const ALLOWED_DELETE_TABLES = Object.keys(tablesMeta).filter(
  (key) => !["security_center", "sessions", "settings"].includes(key)
);

export const batchDeleteRouter = router({
  deleteMany: adminProcedure
    .input(
      z.object({
        tableName: z.string(),
        ids: z.array(z.number()),
      })
    )
    .mutation(async ({ input }) => {
      const { tableName, ids } = input;

      if (!ALLOWED_DELETE_TABLES.includes(tableName)) {
        throw new Error(`Таблица "${tableName}" не поддерживает удаление`);
      }

      const dbTableName = tablesMeta[tableName]?.dbTableName || tableName;
      const result = {
        deleted: 0,
        errors: [] as { id: number; message: string }[],
      };

      for (const id of ids) {
        try {
          await db.execute(
            sql`DELETE FROM ${sql.identifier(dbTableName)} WHERE id = ${id}`
          );
          result.deleted++;
        } catch (err: any) {
          // Игнорируем ошибки внешнего ключа (код 23503), остальные логируем
          if (
            err?.code === "23503" ||
            err?.message?.includes("foreign key") ||
            err?.cause?.code === "23503"
          ) {
            result.errors.push({ id, message: "Запись используется в других таблицах" });
          } else {
            result.errors.push({ id, message: err.message });
          }
        }
      }

      return result;
    }),
});