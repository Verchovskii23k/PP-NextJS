"use client";
import { useState } from "react";
import { type FieldMeta } from "@/lib/table-meta";

interface ColumnFilterPopoverProps {
  field: FieldMeta;
  allValues: any[];
  currentFilter: any[] | undefined;
  onFilterChange: (values: any[] | undefined) => void;
}

export function ColumnFilterPopover({ field, allValues, currentFilter, onFilterChange }: ColumnFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const unique = [...new Set(allValues.filter(v => v != null))].sort();
  const selectedValue = currentFilter?.[0] ?? null;

  const handleSelect = (val: any) => {
    if (val === null) {
      onFilterChange(undefined);
    } else {
      onFilterChange([val]);
    }
    setOpen(false);
  };

  return (
    <div className="relative inline-block ml-1">
      <button type="button" onClick={() => setOpen(!open)} className="text-gray-400 hover:text-gray-600 text-xs">
        🔍
      </button>
      {open && (
        <div className="absolute z-10 bg-white border rounded shadow p-2 w-56 max-h-60 overflow-auto">
          <div className="text-xs mb-1 font-medium">Фильтр</div>
          <label className="flex items-center text-xs gap-1 py-0.5">
            <input
              type="radio"
              name={field.dbName}
              checked={selectedValue === null}
              onChange={() => handleSelect(null)}
            />
            <span>Все</span>
          </label>
          {unique.map(val => (
            <label key={val} className="flex items-center text-xs gap-1 py-0.5">
              <input
                type="radio"
                name={field.dbName}
                checked={selectedValue === val}
                onChange={() => handleSelect(val)}
              />
              <span>{String(val)}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}