// src/app/admin/crud/page.tsx
"use client";
import { trpc } from "@/trpc/client";
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
import { toast } from "sonner";

// Иконки для таблиц (можно эмодзи или текст)
const TABLE_ICONS: Record<string, string> = {
  institutes: "🏛️",
  buildings: "🏗️",
  departments: "🏢",
  specialties: "🦾",
  profiles: "👤",
  disciplines: "📚",
  unitTypes: "📊",
  lessonTypes: "🎓",
  classrooms: "🚪",
  employees: "👨‍🏫",
  students: "👩‍🎓",
  studyGroups: "👥",
  units: "📦",
  lessons: "📝",
  curriculum: "📅",
  lessonClassrooms: "🔗",
  unitRoots: "🌱",
  curriculumProfiles: "📋",
  academicLoadTypes: "⚖️",
  controlTypes: "✅",
  hourTypeMapping: "🔄",
  employeesDepartments: "👔",
  disciplineTeachers: "👩‍🏫",
  daysOfWeek: "📆",
  pairs: "🔢",
  weeks: "📅",
  educationLevels: "📈",
  educationForms: "📒",
  education: "📜",
  positions: "💼",
  employmentTypes: "🕒",
};

// Компонент одного пункта списка
function SortableItem({
  id,
  label,
  icon,
  isActive,
  onClick,
}: {
  id: string;
  label: string;
  icon?: string;
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
        isActive
          ? "bg-primary text-white"
          : "hover:bg-muted/70 text-foreground"
      }`}
    >
      <span className="text-muted-foreground cursor-grab select-none">⠿</span>
      {icon && <span className="text-base leading-none">{icon}</span>}
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
function getDefaultOrder(): string[] {
  return tableNames
    .map(t => t.key)
    .sort((a, b) => {
      const labelA = tableNames.find(t => t.key === a)?.label ?? a;
      const labelB = tableNames.find(t => t.key === b)?.label ?? b;
      return labelA.localeCompare(labelB, "ru");
    });
}
export default function AdminCrudPage() {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const resetMutation = trpc.generations.resetGeneratedData.useMutation();
  const [order, setOrder] = useState<string[]>(() => {
    const stored = localStorage.getItem("crud_table_order");
    let initialOrder: string[];
    if (stored) {
      try {
        initialOrder = JSON.parse(stored);
        const allKeys = tableNames.map(t => t.key);
        const missing = allKeys.filter(k => !initialOrder.includes(k));
        initialOrder = [...initialOrder.filter(k => allKeys.includes(k)), ...missing];
      } catch {
        initialOrder = getDefaultOrder();
      }
    } else {
      initialOrder = getDefaultOrder();
    }
    return initialOrder;
  });

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
      if (!meta) return null;
      return {
        key,
        label: meta.label,
        icon: TABLE_ICONS[key] ?? "📄",   // гарантированно string
      };
    })
    .filter(Boolean) as { key: string; label: string; icon: string }[];

  const handleSelectTable = (tableKey: string) => {
    setSelectedTable(tableKey);
  };

  return (
    <div className="flex h-screen">
      <aside className="w-64 bg-muted p-4 overflow-y-auto border-r border-border">
        <h2 className="text-lg font-semibold mb-4 text-foreground">Таблицы</h2>
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
                  icon={t.icon}
                  isActive={selectedTable === t.key}
                  onClick={() => handleSelectTable(t.key)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </aside>
      <main className="flex-1 p-6 overflow-auto bg-background">
        {selectedTable ? (
          <>
            <div className="mb-4">
              <button
                onClick={async () => {
                  if (
                    !window.confirm(
                      "Будут удалены все сгенерированные данные (расписание, занятия, юниты, группы). Справочники останутся без изменений. Продолжить?"
                    )
                  )
                    return;
                  try {
                    await resetMutation.mutateAsync();
                    toast.success("Все сгенерированные данные удалены. Запустите генерацию заново.");
                    } catch (e: unknown) {
                      const message = e instanceof Error ? e.message : "Неизвестная ошибка";
                      toast.error("Ошибка при сбросе: " + message);
                    }
                }}
                className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700"
              >
                Сбросить всё
              </button>
            </div>
            <DataTable tableName={selectedTable} />
          </>
        ) : (
          <div className="text-muted-foreground mt-10 text-center">
            Выберите таблицу для просмотра и редактирования
          </div>
        )}
      </main>
    </div>
  );
}