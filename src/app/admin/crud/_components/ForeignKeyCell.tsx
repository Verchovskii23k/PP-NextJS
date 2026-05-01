"use client";
import { trpc } from "@/trpc/client";
import { tablesMeta } from "@/lib/tableMeta";

export function ForeignKeyCell({ table, id, displayField }: { table: string; id: number; displayField: string }) {
  if (id === undefined || id === null) return <>—</>;

  // получаем данные строки (можно кешировать)
  const routerKey = tablesMeta[table]?.routerKey;
  const { data } = (trpc as any)[routerKey]?.get?.useQuery?.({ id }, { enabled: !!id });
  if (!data) return <span className="text-gray-400">Загрузка...</span>;

  const displayValue = data[displayField] ?? data.id;
  return <span>{displayValue}</span>;
}