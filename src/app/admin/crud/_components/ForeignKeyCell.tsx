// ForeignKeyCell.tsx
"use client";
import { trpc } from "@/trpc/client";
import { tablesMeta } from "@/lib/table-meta";
import { EntityTooltip } from "@/components/EntityTooltip";

interface ForeignKeyCellProps {
  table: string;              // ключ таблицы (как раньше)
  id: number;
  displayField: string;
  dbTableName?: string;       // реальное имя таблицы в БД (snake_case)
}

export function ForeignKeyCell({ table, id, displayField, dbTableName }: ForeignKeyCellProps) {
  if (id === undefined || id === null) return <>—</>;

  const meta = tablesMeta[table];
  const routerKey = meta?.routerKey;

  // Если метаданных нет — просто показываем ID без тултипа
  if (!routerKey) {
    return <span>{id}</span>;
  }

  const { data, isLoading } = (trpc as any)[routerKey]?.get?.useQuery?.({ id }, { enabled: !!id });

  if (isLoading) return <span className="text-gray-400">...</span>;
  if (!data) return <span className="text-red-500">???</span>;

  const displayValue = data[displayField] ?? data.id;

  // Передаём в EntityTooltip символьный ключ таблицы, по которому есть метаданные
  return (
    <EntityTooltip tableName={table} id={id}>
      {displayValue}
    </EntityTooltip>
  );
}