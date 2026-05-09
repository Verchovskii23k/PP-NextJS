// src/app/admin/crud/_components/ForeignKeyCell.tsx
"use client";
import { trpc } from "@/trpc/client";
import { tablesMeta } from "@/lib/table-meta";
import { EntityTooltip } from "@/components/EntityTooltip";

interface ForeignKeyCellProps {
  table: string;
  id: number;
  displayField: string;
  dbTableName?: string;
}

export function ForeignKeyCell({ table, id, displayField, dbTableName }: ForeignKeyCellProps) {
  if (id === undefined || id === null) return <>—</>;

  const meta = tablesMeta[table];
  const routerKey = meta?.routerKey;

  // ⚡ защита: если нет роутера, показываем просто ID
  if (!routerKey) {
    return <span>{id}</span>;
  }

  const { data, isLoading } = (trpc as any)[routerKey]?.get?.useQuery?.({ id }, { enabled: !!id });

  if (isLoading) return <span className="text-muted-foreground">...</span>;
  if (!data) return <span className="text-red-500 dark:text-red-400">???</span>;

  const displayValue = data[displayField] ?? data.id;

  return (
    <EntityTooltip tableName={table} id={id}>
      {displayValue}
    </EntityTooltip>
  );
}