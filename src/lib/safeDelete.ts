import { TRPCError } from "@trpc/server";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";

export async function safeDelete(table: PgTable, id: number) {
  const tableConfig = getTableConfig(table);
  const idColumn = tableConfig.columns.find(c => c.name === "id");
  if (!idColumn) throw new Error("Table must have an 'id' column");

  try {
    await db.delete(table).where(eq(idColumn, id));
    return { success: true };
  } catch (e: unknown) {
    const err = e as { code?: string; cause?: { code?: string }; message?: string };
    const code = err.code || err.cause?.code;
    if (code === "23503" || err.message?.includes("foreign key constraint")) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Невозможно удалить – запись используется в других таблицах",
      });
    }
    throw e;
  }
}