// src/app/admin/crud/_components/ColumnFilterPopover.tsx
"use client";
import { useState, useMemo } from "react";
import { type FieldMeta } from "@/lib/table-meta";

interface ColumnFilterPopoverProps {
  field: FieldMeta;
  allValues: any[];
  currentFilter: any[] | undefined;   // массив ИСКЛЮЧАЕМЫХ значений
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

  const unique = useMemo(
    () => [...new Set(allValues.filter((v) => v != null))].sort(),
    [allValues]
  );

  // Текущий набор исключённых значений
  const excludedSet = new Set(currentFilter || []);

  const handleToggle = (val: any) => {
    const newExcluded = new Set(excludedSet);
    if (newExcluded.has(val)) {
      newExcluded.delete(val);
    } else {
      newExcluded.add(val);
    }
    // Если исключены все значения, смысла в фильтре нет – сбрасываем
    onFilterChange(newExcluded.size > 0 ? Array.from(newExcluded) : undefined);
  };

  const filteredUnique = useMemo(() => {
    if (!search) return unique;
    return unique.filter((v) =>
      String(v).toLowerCase().includes(search.toLowerCase())
    );
  }, [unique, search]);

  return (
    <div className="relative inline-block ml-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-gray-400 hover:text-gray-600 text-xs"
      >
        🔍
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-56 bg-white border border-gray-200 rounded-lg shadow-lg p-2">
          <div className="flex justify-end mb-1">
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600 text-xs px-1"
            >
              ✕
            </button>
          </div>
          <input
            placeholder="Поиск..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm mb-2"
          />
          <div className="max-h-48 overflow-y-auto space-y-1">
            {filteredUnique.map((val) => (
              <label
                key={val}
                className="flex items-center space-x-2 text-sm cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded"
              >
                <input
                  type="checkbox"
                  checked={!excludedSet.has(val)}
                  onChange={() => handleToggle(val)}
                />
                <span className="truncate">{String(val)}</span>
              </label>
            ))}
            {filteredUnique.length === 0 && (
              <div className="text-sm text-gray-500">Нет значений</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}