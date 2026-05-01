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
  const selected = currentFilter ?? [];

  const toggleValue = (val: any) => {
    const newSel = selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val];
    onFilterChange(newSel.length ? newSel : undefined);
  };

  return (
    <div className="relative inline-block ml-1">
      <button type="button" onClick={() => setOpen(!open)} className="text-gray-400 hover:text-gray-600 text-xs">⚙</button>
      {open && (
        <div className="absolute z-10 bg-white border rounded shadow p-2 w-48 max-h-60 overflow-auto">
          <div className="text-xs mb-1">Фильтр</div>
          {unique.map(val => (
            <label key={val} className="flex items-center text-xs gap-1 py-0.5">
              <input type="checkbox" checked={selected.includes(val)} onChange={() => toggleValue(val)} />
              <span>{val}</span>
            </label>
          ))}
          <button className="text-xs mt-1 text-blue-500" onClick={() => { onFilterChange(undefined); setOpen(false); }}>Сбросить</button>
        </div>
      )}
    </div>
  );
}