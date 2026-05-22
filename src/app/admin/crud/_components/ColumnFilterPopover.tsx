/**
 * Всплывающий фильтр для одного столбца таблицы.
 *
 * ... (документация без изменений)
 */
"use client";
import { useState, useMemo } from "react";
import { trpc } from "@/trpc/client";
import { tablesMeta, type FieldMeta } from "@/lib/table-meta";

interface ColumnFilterPopoverProps {
  field: FieldMeta;
  allValues: unknown[];
  currentFilter: unknown[] | undefined;
  onFilterChange: (excludedValues: unknown[] | undefined) => void;
}

// Тип для роутера, содержащего list
interface ListRouter {
  list: {
    useQuery: (input?: unknown, opts?: unknown) => {
      data?: Record<string, unknown>[];
      isLoading?: boolean;
    };
  };
}

// Безопасное получение роутера с list
function getListRouter(key: string): ListRouter | undefined {
  const trpcObj = trpc as Record<string, unknown>;
  if (key in trpcObj) {
    const router = trpcObj[key];
    if (typeof router === 'object' && router !== null && 'list' in router) {
      return router as unknown as ListRouter;
    }
  }
  return undefined;
}

const EMPTY_LIST_QUERY = {
  data: [] as Record<string, unknown>[],
  isLoading: false,
};

export function ColumnFilterPopover({
  field,
  allValues,
  currentFilter,
  onFilterChange,
}: ColumnFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const relatedMeta = field.isFK && field.references
    ? tablesMeta[field.references.table]
    : null;

  const relatedRouter = relatedMeta?.routerKey ? getListRouter(relatedMeta.routerKey) : undefined;
  const { data: relatedData } = relatedRouter?.list?.useQuery?.() ?? EMPTY_LIST_QUERY;

  const labelMap = useMemo(() => {
    if (!relatedData || !field.references) return null;
    const map = new Map<unknown, string>();
    for (const row of relatedData) {
      const display = row[field.references.displayField];
      map.set(row.id, display !== undefined && display !== null ? String(display) : String(row.id));
    }
    return map;
  }, [relatedData, field.references]);

  const uniqueIds = useMemo(
    () => [...new Set(allValues.filter(v => v != null))].sort((a, b) =>
      typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))
    ),
    [allValues]
  );

  const excludedSet = useMemo(() => new Set(currentFilter || []), [currentFilter]);

  const handleToggle = (id: unknown) => {
    const newExcluded = new Set(excludedSet);
    if (newExcluded.has(id)) {
      newExcluded.delete(id);
    } else {
      newExcluded.add(id);
    }
    onFilterChange(newExcluded.size > 0 ? Array.from(newExcluded) : undefined);
  };

  const handleReset = () => {
    onFilterChange(undefined);
  };

  const filteredItems = useMemo(() => {
    if (!search) return uniqueIds;
    return uniqueIds.filter(id => {
      const label = labelMap ? (labelMap.get(id) ?? String(id)) : String(id);
      return label.toLowerCase().includes(search.toLowerCase());
    });
  }, [uniqueIds, search, labelMap]);

  const getDisplay = (id: unknown) => {
    if (labelMap) return labelMap.get(id) ?? String(id);
    return String(id);
  };

  const handleOpenClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(prev => !prev);
  };

  return (
    <div className="relative ml-1 inline-block">
      <button
        type="button"
        onClick={handleOpenClick}
        aria-label="Открыть фильтр"
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        🔍
      </button>
      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-border bg-background p-2 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Фильтр</span>
            <button onClick={() => setOpen(false)} className="px-1 text-xs text-muted-foreground hover:text-foreground" aria-label="Закрыть фильтр">
              ✕
            </button>
          </div>
          <input
            placeholder="Поиск..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="mb-2 w-full rounded border border-border bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground"
          />
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {filteredItems.map(id => (
              <label key={String(id)} className="hover:bg-muted/50 flex cursor-pointer items-center space-x-2 rounded px-1 py-0.5 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={!excludedSet.has(id)}
                  onChange={() => handleToggle(id)}
                />
                <span className="truncate">{getDisplay(id)}</span>
              </label>
            ))}
            {filteredItems.length === 0 && (
              <div className="text-sm text-muted-foreground">Нет значений</div>
            )}
          </div>
          <div className="mt-2 flex justify-between">
            <button
              onClick={handleReset}
              className="hover:text-primary/90 text-xs text-primary"
            >
              Сбросить все
            </button>
            <span className="text-xs text-muted-foreground">
              {uniqueIds.length - excludedSet.size} / {uniqueIds.length}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}