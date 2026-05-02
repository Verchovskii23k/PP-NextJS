// src/app/admin/crud/page.tsx
"use client";
import { useState, useEffect } from "react";
import { tableNames } from "@/lib/table-meta";
import { DataTable } from "./_components/DataTable";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Компонент одного пункта списка
function SortableItem({
  id,
  label,
  isActive,
  onClick,
}: {
  id: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-2 px-3 py-2 rounded cursor-grab ${
        isActive ? "bg-blue-500 text-white" : "hover:bg-gray-200"
      }`}
    >
      <span className="text-gray-400 cursor-grab select-none">⠿</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className="flex-1 text-left"
      >
        {label}
      </button>
    </li>
  );
}

export default function AdminCrudPage() {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [order, setOrder] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("crud_table_order");
    let initialOrder: string[];
    if (stored) {
      try {
        initialOrder = JSON.parse(stored) as string[];
        const allKeys = tableNames.map(t => t.key);
        const missing = allKeys.filter(k => !initialOrder.includes(k));
        initialOrder = [...initialOrder.filter(k => allKeys.includes(k)), ...missing];
      } catch {
        initialOrder = tableNames.map(t => t.key).sort((a, b) => {
          const labelA = tableNames.find(t => t.key === a)?.label ?? a;
          const labelB = tableNames.find(t => t.key === b)?.label ?? b;
          return labelA.localeCompare(labelB, "ru");
        });
      }
    } else {
      initialOrder = tableNames
        .map(t => t.key)
        .sort((a, b) => {
          const labelA = tableNames.find(t => t.key === a)?.label ?? a;
          const labelB = tableNames.find(t => t.key === b)?.label ?? b;
          return labelA.localeCompare(labelB, "ru");
        });
    }
    setOrder(initialOrder);
  }, []);

  useEffect(() => {
    if (order.length > 0) {
      localStorage.setItem("crud_table_order", JSON.stringify(order));
    }
  }, [order]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const sortedTableList = order
    .map(key => {
      const meta = tableNames.find(t => t.key === key);
      return meta ? { key, label: meta.label } : null;
    })
    .filter(Boolean) as { key: string; label: string }[];

  const handleSelectTable = (tableKey: string) => {
    setSelectedTable(tableKey);
  };

  return (
    <div className="flex h-screen">
      <aside className="w-64 bg-gray-100 p-4 overflow-y-auto border-r">
        <h2 className="text-lg font-semibold mb-4">Таблицы</h2>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortedTableList.map(t => t.key)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-1">
              {sortedTableList.map(t => (
                <SortableItem
                  key={t.key}
                  id={t.key}
                  label={t.label}
                  isActive={selectedTable === t.key}
                  onClick={() => handleSelectTable(t.key)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </aside>
      <main className="flex-1 p-6 overflow-auto">
        {selectedTable ? (
          <DataTable tableName={selectedTable} />
        ) : (
          <div className="text-gray-500 mt-10 text-center">
            Выберите таблицу для просмотра и редактирования
          </div>
        )}
      </main>
    </div>
  );
}