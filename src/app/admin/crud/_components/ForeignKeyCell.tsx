// src/app/admin/crud/_components/ForeignKeyCell.tsx
"use client";
import { trpc } from "@/trpc/client";
import { tablesMeta } from "@/lib/table-meta";
import { EntityTooltip } from "@/components/EntityTooltip";

interface ForeignKeyCellProps {
  table: string;
  id: number;
  displayField: string;
}

// Тип для роутера, который содержит только get
interface ReadonlyRouter {
  get: {
    useQuery: (input: { id: number }, opts?: unknown) => {
      data?: Record<string, unknown> | null;
      isLoading: boolean;
    };
  };
}

export function ForeignKeyCell({ table, id, displayField }: ForeignKeyCellProps) {
  if (id === undefined || id === null) return <>—</>;

  const meta = tablesMeta[table];
  const routerKey = meta?.routerKey;

  if (!routerKey) {
    return <span>{id}</span>;
  }

  const router = (trpc as unknown as Record<string, ReadonlyRouter>)[routerKey] as ReadonlyRouter | undefined;
  const { data, isLoading } = router?.get?.useQuery?.({ id }, { enabled: !!id }) ?? { data: null, isLoading: false };

  if (isLoading) return <span className="text-muted-foreground">...</span>;
  if (!data) return <span className="text-red-500 dark:text-red-400">???</span>;

  const displayValue = data[displayField] !== undefined && data[displayField] !== null
    ? String(data[displayField])
    : String(data.id ?? id);

  return (
    <EntityTooltip tableName={table} id={id}>
      {displayValue}
    </EntityTooltip>
  );
}