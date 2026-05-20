import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { tablesMeta } from "@/lib/table-meta";
import { TRPCError } from "@trpc/server";

const ALLOWED_DELETE_TABLES = Object.keys(tablesMeta).filter(
  (key) => !["user", "account", "session", "verification_token", "settings"].includes(key)
);

export const batchDeleteRouter = router({
  deleteMany: adminProcedure
    .input(
      z.object({
        tableName: z.string(),
        ids: z.array(z.number()),
      })
    )
    .mutation(async ({ ctx,input }) => {
      const { tableName, ids } = input;

      if (!ALLOWED_DELETE_TABLES.includes(tableName)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Таблица "${tableName}" не поддерживает удаление` });
      }

      const dbTableName = tablesMeta[tableName]?.dbTableName || tableName;
      const result = {
        deleted: 0,
        errors: [] as { id: number; message: string }[],
      };

        for (const id of ids) {
          try {
            // Проверка на самозапрет для сотрудников и студентов
            if (tableName === "employees" || tableName === "students") {
              const [row] = await db.execute(
                sql`SELECT user_id FROM ${sql.identifier(dbTableName)} WHERE id = ${id}`
              ) as unknown as { user_id: string | null }[];
              if (row?.user_id && ctx.user?.id === row.user_id) {
                result.errors.push({ id, message: "Нельзя удалить самого себя" });
                continue;
              }
            }

            await db.execute(
              sql`DELETE FROM ${sql.identifier(dbTableName)} WHERE id = ${id}`
            );
            result.deleted++;
        } catch (e: unknown) {
            const err = e as { code?: string; cause?: { code?: string }; message?: string };
            const code = err.code || err.cause?.code;
            if (code === '23503' || err.message?.includes('foreign key')) {
                throw new TRPCError({ code: "BAD_REQUEST", message: "Невозможно удалить – запись используется" });
            }
            throw e;
        }
      }
      return result;
    }),
});