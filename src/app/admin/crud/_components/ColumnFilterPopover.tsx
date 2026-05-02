// src/app/admin/crud/_components/ColumnFilterPopover.tsx
"use client";
import { useState, useMemo } from "react";
import { trpc } from "@/trpc/client";
import { tablesMeta, type FieldMeta } from "@/lib/table-meta";

interface ColumnFilterPopoverProps {
  field: FieldMeta;
  allValues: any[];
  currentFilter: any[] | undefined;   // массив исключаемых ID
  onFilterChange: (excludedValues: any[] | undefined) => void;
}

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

  const { data: relatedData } = (trpc as any)[relatedMeta?.routerKey]?.list?.useQuery?.(
    undefined,
    { enabled: !!relatedMeta }
  );

  const labelMap = useMemo(() => {
    if (!relatedData || !field.references) return null;
    const map = new Map<any, string>();
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

  const handleToggle = (id: any) => {
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

  const getDisplay = (id: any) => {
    if (labelMap) return labelMap.get(id) ?? String(id);
    return String(id);
  };

  const handleOpenClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(prev => !prev);
  };

  return (
    <div className="relative inline-block ml-1">
      <button
        type="button"
        onClick={handleOpenClick}
        className="text-gray-400 hover:text-gray-600 text-xs"
      >
        🔍
      </button>
      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-50 w-56 bg-white border border-gray-200 rounded-lg shadow-lg p-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-medium text-gray-600">Фильтр</span>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xs px-1">
              ✕
            </button>
          </div>
          <input
            placeholder="Поиск..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm mb-2"
          />
          <div className="max-h-48 overflow-y-auto space-y-1">
            {filteredItems.map(id => (
              <label key={id} className="flex items-center space-x-2 text-sm cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded">
                <input
                  type="checkbox"
                  checked={!excludedSet.has(id)}
                  onChange={() => handleToggle(id)}
                />
                <span className="truncate">{getDisplay(id)}</span>
              </label>
            ))}
            {filteredItems.length === 0 && (
              <div className="text-sm text-gray-500">Нет значений</div>
            )}
          </div>
          <div className="flex justify-between mt-2">
            <button
              onClick={handleReset}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Сбросить все
            </button>
            <span className="text-xs text-gray-400">
              {uniqueIds.length - excludedSet.size} / {uniqueIds.length}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}