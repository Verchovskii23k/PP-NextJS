"use client";
import { trpc } from "@/trpc/client";
import { tablesMeta } from "@/lib/table-meta";
import { EntityTooltip } from "@/components/EntityTooltip";

interface ForeignKeyCellProps {
  table: string;
  id: number;
  displayField: string;
}

export function ForeignKeyCell({ table, id, displayField }: ForeignKeyCellProps) {
  if (id === undefined || id === null) return <>—</>;

  const routerKey = tablesMeta[table]?.routerKey;
  const { data, isLoading } = (trpc as any)[routerKey]?.get?.useQuery?.({ id }, { enabled: !!id });

  if (isLoading) return <span className="text-gray-400">...</span>;
  if (!data) return <span className="text-red-500">???</span>;

  const displayValue = data[displayField] ?? data.id;

  return (
    <EntityTooltip tableName={table} id={id}>
      {displayValue}
    </EntityTooltip>
  );
}