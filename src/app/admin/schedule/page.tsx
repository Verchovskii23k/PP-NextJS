// src/app/admin/schedule/page.tsx
"use client";

import { trpc } from "@/trpc/client";
import { useState, useCallback } from "react";
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverlay,
} from "@dnd-kit/core";

type Day = { id: number; name: string };
type Pair = { id: number; number: number };

type ScheduleRow = {
  id: number;
  weekId: number;
  dayOfWeekId: number;
  pairNumberId: number;
  unitCode: string;
  displayText: string;
  mergeNumber: number;
  positionFlag: boolean;
  classroomFlag: boolean;
  lessonId: number | null;
  isBuffered: boolean; // ✅ новое поле
};

type WeekInfo = { id: number; type: string };

// Цвета для разных недель
const WEEK_COLORS = [
  { bg: "bg-indigo-200 dark:bg-indigo-800", border: "border-indigo-400 dark:border-indigo-600" },
  { bg: "bg-teal-200 dark:bg-teal-800", border: "border-teal-400 dark:border-teal-600" },
  { bg: "bg-purple-200 dark:bg-purple-800", border: "border-purple-400 dark:border-purple-600" },
  { bg: "bg-amber-200 dark:bg-amber-800", border: "border-amber-400 dark:border-amber-600" },
  { bg: "bg-pink-200 dark:bg-pink-800", border: "border-pink-400 dark:border-pink-600" },
  { bg: "bg-cyan-200 dark:bg-cyan-800", border: "border-cyan-400 dark:border-cyan-600" },
];

function DraggableLesson({ entry, isEditMode }: { entry: ScheduleRow; isEditMode: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `lesson-${entry.id}`,
    data: { entry },
    disabled: !isEditMode,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`text-xs p-1 rounded leading-tight cursor-default ${isDragging ? "opacity-50" : ""} ${
        isEditMode ? "hover:ring-2 hover:ring-blue-300 cursor-grab" : ""
      } bg-card dark:bg-gray-700 text-foreground`}
      style={style}
    >
      {entry.displayText}
    </div>
  );
}

function DroppableArea({
  weekId,
  weekIndex,
  dayId,
  pairId,
  unitCode,
  entry,
  isEditMode,
  status,
  onCellClick,
}: {
  weekId: number;
  weekIndex: number;
  dayId: number;
  pairId: number;
  unitCode: string;
  entry: ScheduleRow | undefined;
  isEditMode: boolean;
  status: "free" | "conflict" | "swap" | null;
  onCellClick: (e: ScheduleRow) => void;
}) {
  const droppableId = `week-${weekId}-${dayId}-${pairId}-${unitCode}`;
  const { isOver, setNodeRef } = useDroppable({
    id: droppableId,
    data: { weekId, dayId, pairId, unitCode },
    disabled: !isEditMode,
  });

  let bg = "";
  if (isEditMode) {
    if (status === "free") bg = "bg-green-100 dark:bg-green-900/20";
    else if (status === "conflict") bg = "bg-red-100 dark:bg-red-900/20";
    else if (status === "swap") bg = "bg-blue-100 dark:bg-blue-900/20";
    else {
      const color = WEEK_COLORS[weekIndex % WEEK_COLORS.length];
      bg = `${color.bg} ${color.border}`;
    }
    if (isOver) bg += " ring-2 ring-blue-500";
  } else {
    const color = WEEK_COLORS[weekIndex % WEEK_COLORS.length];
    bg = `${color.bg} ${color.border}`;
  }

  return (
    <div
      ref={setNodeRef}
      className={`text-xs p-1 rounded leading-tight border ${bg} ${isEditMode ? "min-h-[1.5rem]" : ""}`}
      onClick={() => entry && isEditMode && onCellClick(entry)}
    >
      {entry ? (
        <div className="flex items-center gap-1 p-1 rounded">
          <DraggableLesson entry={entry} isEditMode={isEditMode} />
        </div>
      ) : (
        <span className="text-muted-foreground text-xs">—</span>
      )}
    </div>
  );
}

function BufferEntry({ entry }: { entry: ScheduleRow }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `buffer-${entry.id}`,
    data: { entry },
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-1 text-xs p-1 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded mb-1 cursor-grab ${
        isDragging ? "opacity-50" : ""
      }`}
      style={style}
    >
      <span className="truncate text-foreground">{entry.displayText}</span>
    </div>
  );
}

function BufferZone({ entries, isEditMode }: { entries: ScheduleRow[]; isEditMode: boolean }) {
  const droppableId = "buffer-zone";
  const { isOver, setNodeRef } = useDroppable({ id: droppableId, disabled: !isEditMode });

  return (
    <div
      ref={setNodeRef}
      className={`border border-dashed border-border bg-muted p-2 w-56 flex-shrink-0 overflow-y-auto rounded h-full ${
        isOver ? "bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500" : ""
      }`}
    >
      <div className="text-xs font-bold mb-2 sticky top-0 bg-muted py-1 text-foreground">Буфер</div>
      {entries.map((entry) => (
        <BufferEntry key={entry.id} entry={entry} />
      ))}
      {entries.length === 0 && <div className="text-xs text-muted-foreground">Пусто</div>}
    </div>
  );
}

export default function AdminSchedulePage() {
  const [viewMode, setViewMode] = useState<"units" | "groups">("units");
  const [editMode, setEditMode] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<ScheduleRow | null>(null);
  const [flagForm, setFlagForm] = useState({ mergeNumber: 0, positionFlag: false, classroomFlag: false });
  const [activeDragEntry, setActiveDragEntry] = useState<ScheduleRow | null>(null);
  const [slotStatuses, setSlotStatuses] = useState<Record<string, "free" | "conflict" | "swap">>({});
  const [slotSwapIds, setSlotSwapIds] = useState<Record<string, number>>({});
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    message: string;
    onConfirm: () => void;
  }>({ show: false, message: "", onConfirm: () => {} });

  const utils = trpc.useUtils();

  const { data: unitsData, isLoading: unitsLoading } = trpc.scheduleDisplay.getForWeekPair.useQuery(
    { weekBaseId: 1 },
    { enabled: viewMode === "units" }
  );
  const { data: groupsData, isLoading: groupsLoading } = trpc.scheduleDisplay.getByStudyGroups.useQuery(
    { weekBaseId: 1 },
    { enabled: viewMode === "groups" }
  );
  const { data: bufferData } = trpc.scheduleDisplay.getBuffer.useQuery(undefined, { enabled: editMode });

  const activeWeeksData: WeekInfo[] = unitsData?.weeks || groupsData?.weeks || [];
  const activeWeekIds = activeWeeksData.map((w) => w.id);

  const checkSlots = trpc.scheduleDisplay.checkSlots.useMutation();
  const moveMutation = trpc.scheduleDisplay.move.useMutation();
  const swapMutation = trpc.scheduleDisplay.swap.useMutation();
  const updateFlags = trpc.scheduleDisplay.updateFlags.useMutation();
  const moveToBufferMut = trpc.scheduleDisplay.moveToBuffer.useMutation();
  const moveFromBufferMut = trpc.scheduleDisplay.moveFromBuffer.useMutation();
  const optimizeScheduleMut = trpc.scheduleDisplay.optimizeSchedule.useMutation({
    onSuccess: (data) => {
      alert(`Оптимизация завершена. Итераций: ${data.iterations}, улучшение: с ${data.initialScore} до ${data.finalScore}`);
      refreshData();
    },
    onError: (e) => alert(e.message),
  });

  const refreshData = useCallback(() => {
    if (viewMode === "units") {
      utils.scheduleDisplay.getForWeekPair.invalidate({ weekBaseId: 1 });
      utils.scheduleDisplay.getForWeekPair.refetch({ weekBaseId: 1 });
    } else {
      utils.scheduleDisplay.getByStudyGroups.invalidate({ weekBaseId: 1 });
      utils.scheduleDisplay.getByStudyGroups.refetch({ weekBaseId: 1 });
    }
    utils.scheduleDisplay.getBuffer.invalidate();
  }, [viewMode, utils]);

  const performMove = useCallback(
    async (entry: ScheduleRow, targetId: string) => {
      const parts = targetId.split("-");
      const targetWeekId = parseInt(parts[1], 10);
      const targetDayId = parseInt(parts[2], 10);
      const targetPairId = parseInt(parts[3], 10);
      const targetUnitCode = parts.slice(4).join("-");

      if (targetUnitCode !== entry.unitCode) {
        console.warn("Нельзя перенести занятие в другой юнит");
        return;
      }

      const status = slotStatuses[targetId];
      if (!status) return;

      try {
        if (status === "free") {
          await moveMutation.mutateAsync({ id: entry.id, targetWeekId, targetDayId, targetPairId, targetUnitCode });
        } else if (status === "swap") {
          const swapId = slotSwapIds[targetId];
          if (!swapId) {
            alert("Занятие для обмена не найдено");
            return;
          }
          await swapMutation.mutateAsync({ id1: entry.id, id2: swapId });
        }
        refreshData();
      } catch (e: any) {
        alert(e.message);
      }
    },
    [slotStatuses, slotSwapIds, moveMutation, swapMutation, refreshData]
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const refreshSlotStatuses = useCallback(
    async (entry: ScheduleRow) => {
      const sourceData = unitsData || groupsData;
      if (!sourceData) return;
      const days = sourceData.days;
      const pairs = sourceData.pairs;
      const slots: { weekId: number; dayId: number; pairId: number; unitCode: string }[] = [];
      for (const weekId of activeWeekIds) {
        for (const day of days) {
          for (const pair of pairs) {
            slots.push({ weekId, dayId: day.id, pairId: pair.id, unitCode: entry.unitCode });
          }
        }
      }
      const result = await checkSlots.mutateAsync({ movingId: entry.id, slots });
      const newStatuses: Record<string, "free" | "conflict" | "swap"> = {};
      const newSwapIds: Record<string, number> = {};
      for (const [key, val] of Object.entries(result)) {
        newStatuses[key] = val.status as any;
        if (val.status === "swap" && val.swapId) newSwapIds[key] = val.swapId;
      }
      setSlotStatuses(newStatuses);
      setSlotSwapIds(newSwapIds);
    },
    [unitsData, groupsData, activeWeekIds, checkSlots]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const entry = event.active.data.current?.entry as ScheduleRow;
    if (entry) {
      setActiveDragEntry(entry);
      refreshSlotStatuses(entry);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragEntry(null);
    setSlotStatuses({});
    setSlotSwapIds({});
    if (!over || !active.data.current?.entry) return;
    const entry = active.data.current.entry as ScheduleRow;
    const targetId = over.id as string;

    // --- Буфер ---
    if (targetId === "buffer-zone") {
      if (!entry.isBuffered) {
        await moveToBufferMut.mutateAsync({ id: entry.id });
        refreshData();
      }
      return;
    }

    if (entry.isBuffered) {
      // возврат из буфера
      const parts = targetId.split("-");
      if (parts.length < 5 || parts[0] !== "week") return;
      const targetWeekId = parseInt(parts[1], 10);
      const targetDayId = parseInt(parts[2], 10);
      const targetPairId = parseInt(parts[3], 10);
      const targetUnitCode = parts.slice(4).join("-");
      const slots = [{ weekId: targetWeekId, dayId: targetDayId, pairId: targetPairId, unitCode: targetUnitCode }];
      const result = await checkSlots.mutateAsync({ movingId: entry.id, slots });
      const status = result[`week-${targetWeekId}-${targetDayId}-${targetPairId}-${targetUnitCode}`]?.status;
      if (status !== "free") {
        alert("Невозможно разместить: конфликт");
        return;
      }
      await moveFromBufferMut.mutateAsync({ id: entry.id, targetWeekId, targetDayId, targetPairId, targetUnitCode });
      refreshData();
      return;
    }

    // --- Проверка флагов ---
    const hasFlags = entry.positionFlag || entry.mergeNumber !== 0;
    if (hasFlags) {
      setConfirmDialog({
        show: true,
        message:
          "Есть зафиксированные занятия или подвергнутые слиянию. При переносе/обмене флаги фиксации и слияния будут сброшены. Продолжить?",
        onConfirm: () => {
          setConfirmDialog({ show: false, message: "", onConfirm: () => {} });
          performMove(entry, targetId);
        },
      });
      return;
    }

    await performMove(entry, targetId);
  };

  const openFlagEditor = (entry: ScheduleRow) => {
    setSelectedEntry(entry);
    setFlagForm({
      mergeNumber: entry.mergeNumber,
      positionFlag: entry.positionFlag,
      classroomFlag: entry.classroomFlag,
    });
  };

  const saveFlags = async () => {
    if (!selectedEntry) return;
    await updateFlags.mutateAsync({ id: selectedEntry.id, ...flagForm });
    setSelectedEntry(null);
    refreshData();
  };

  const handlePrint = () => {
    const tableElement = document.getElementById("schedule-table");
    if (!tableElement) return;

    const clone = tableElement.cloneNode(true) as HTMLElement;

    // Убираем drag-and-drop классы, оставляем только цвета
    clone.querySelectorAll("[data-week]").forEach((el) => {
      const htmlEl = el as HTMLElement;
      const weekType = htmlEl.getAttribute("data-week");
      if (weekType === "even") {
        htmlEl.style.backgroundColor = "#d1d5db"; // серый для чётных недель
      } else {
        htmlEl.style.backgroundColor = "transparent";
      }
      htmlEl.style.padding = "2px";
      htmlEl.style.borderBottom = "1px solid #666";
      htmlEl.style.minHeight = "2.5em";
    });

    const printWindow = window.open("", "_blank", "width=1200,height=800");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Расписание</title>
          <style>
            @media print {
              * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              table { border-collapse: collapse; width: 100%; font-size: 9px; }
              [data-week="even"] { background-color: #d1d5db !important; }
              td { vertical-align: middle; }
            }
          </style>
        </head>
        <body class="p-4">
          <h1 class="text-xl font-bold mb-4">Расписание</h1>
          ${clone.outerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const handleCSV = () => {
    const rows: string[][] = [];
    const header = ["День", "Пара", ...activeWeeksData.map((w) => w.type)];
    if (viewMode === "units" && unitsData) {
      const unitCodes = Array.from(new Set(unitsData.rows.map((r) => r.unitCode))).sort();
      unitCodes.forEach((code) => header.push(code));
      rows.push(header);
      const days = unitsData.days;
      const pairs = unitsData.pairs;
      for (const day of days) {
        for (const pair of pairs) {
          const row = [day.name, String(pair.number)];
          for (const week of activeWeeksData) {
            const entry = unitsData.rows.find(
              (r) =>
                r.unitCode === row[2] && r.dayOfWeekId === day.id && r.pairNumberId === pair.id && r.weekId === week.id
            );
            row.push(entry ? entry.displayText : "—");
          }
          rows.push(row);
        }
      }
    } else if (viewMode === "groups" && groupsData) {
      const groupCodes = Array.from(new Set(groupsData.rows.map((r: any) => r.studyGroupCode))).sort();
      groupCodes.forEach((code) => header.push(code));
      rows.push(header);
      const days = groupsData.days;
      const pairs = groupsData.pairs;
      for (const day of days) {
        for (const pair of pairs) {
          const row = [day.name, String(pair.number)];
          for (const week of activeWeeksData) {
            const entry = groupsData.rows.find(
              (r: any) =>
                r.studyGroupCode === row[2] &&
                r.dayOfWeekId === day.id &&
                r.pairNumberId === pair.id &&
                r.weekId === week.id
            );
            row.push(entry ? entry.displayText : "—");
          }
          rows.push(row);
        }
      }
    }
    const bom = "\uFEFF";
    const csvContent = "data:text/csv;charset=utf-8," + bom + rows.map((r) => r.join(";")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `schedule.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  if (viewMode === "units" && unitsLoading) return <div className="p-6">Загрузка...</div>;
  if (viewMode === "groups" && groupsLoading) return <div className="p-6">Загрузка...</div>;

  const bufferEntries = bufferData || [];
  const displayRows = viewMode === "units" ? unitsData?.rows : groupsData?.rows;
  const days = viewMode === "units" ? unitsData?.days : groupsData?.days;
  const pairs = viewMode === "units" ? unitsData?.pairs : groupsData?.pairs;
  const unitKeys = viewMode === "units"
    ? Array.from(new Set(displayRows?.map((r) => r.unitCode) || [])).sort()
    : Array.from(new Set(displayRows?.map((r: any) => r.studyGroupCode) || [])).sort();

  return (
    <div className="p-4 bg-background text-foreground">
      <h1 className="text-xl font-bold mb-4">Расписание</h1>

      {/* Легенда */}
      <div className="flex flex-wrap gap-4 mb-4 p-3 bg-muted rounded border border-border text-sm">
        {activeWeeksData.map((week, idx) => (
          <div key={week.id} className="flex items-center gap-2">
            <span
              className={`inline-block w-4 h-4 rounded ${WEEK_COLORS[idx % WEEK_COLORS.length].bg} ${WEEK_COLORS[idx % WEEK_COLORS.length].border}`}
            ></span>
            {week.type} (ID:{week.id})
          </div>
        ))}
        {editMode && (
          <>
            <div className="flex items-center gap-2">
              <span className="inline-block w-4 h-4 rounded bg-green-300 dark:bg-green-900/20 border border-green-400 dark:border-green-800"></span> Свободно
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-4 h-4 rounded bg-red-300 dark:bg-red-900/20 border border-red-400 dark:border-red-800"></span> Конфликт
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-4 h-4 rounded bg-blue-300 dark:bg-blue-900/20 border border-blue-400 dark:border-blue-800"></span> Обмен
            </div>
          </>
        )}
      </div>

      {confirmDialog.show && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded shadow-lg border border-border max-w-md">
            <p className="text-foreground mb-4">{confirmDialog.message}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDialog({ show: false, message: "", onConfirm: () => {} })}
                className="px-4 py-2 border border-border rounded text-foreground hover:bg-muted"
              >
                Отмена
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
              >
                Подтвердить
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-4 mb-4">
        <button onClick={() => setViewMode("units")} className={viewMode === "units" ? "font-bold border-b-2 border-blue-500" : ""}>
          По юнитам
        </button>
        <button onClick={() => setViewMode("groups")} className={viewMode === "groups" ? "font-bold border-b-2 border-blue-500" : ""}>
          По группам
        </button>
        <button onClick={handlePrint} className="bg-blue-600 text-white px-3 py-1 rounded ml-2 hover:bg-blue-700">
          🖨️ Печать
        </button>
        <button onClick={handleCSV} className="bg-green-600 text-white px-3 py-1 rounded ml-2 hover:bg-green-700">
          📥 CSV
        </button>
        <button
          onClick={() => optimizeScheduleMut.mutate()}
          disabled={editMode || optimizeScheduleMut.isPending}
          className="px-3 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white disabled:bg-gray-400"
        >
          {optimizeScheduleMut.isPending ? "Оптимизация..." : "Оптимизировать"}
        </button>
        {viewMode === "units" && (
          <button onClick={() => setEditMode(!editMode)} className="ml-auto bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600">
            {editMode ? "Завершить редактирование" : "Редактировать"}
          </button>
        )}
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 items-stretch" style={{ minHeight: "400px" }}>
          {editMode && <BufferZone entries={bufferEntries} isEditMode={editMode} />}

          <div className="flex-1 overflow-auto" id="schedule-table">
            {days && pairs && displayRows && (
              <div className="overflow-x-auto border border-border rounded-md">
                <table className="border-collapse text-sm w-full">
                  <thead>
                    <tr className="bg-muted">
                      <th className="sticky left-0 z-20 bg-muted border border-border p-2 w-[70px] min-w-[70px] text-foreground">
                        День
                      </th>
                      <th className="sticky left-[70px] z-20 bg-muted border border-border p-2 w-[50px] min-w-[50px] text-foreground">
                        Пара
                      </th>
                      {unitKeys.map((code) => (
                        <th key={code} className="border border-border p-2 bg-blue-50 dark:bg-blue-900/30 text-foreground whitespace-nowrap min-w-[180px]">
                          {code}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((day: Day) =>
                      pairs.map((pair: Pair, pairIdx: number) => {
                        const isFirstPairOfDay = pairIdx === 0;
                        return (
                          <tr key={`${day.id}-${pair.id}`}>
                            {isFirstPairOfDay && (
                              <td
                                rowSpan={pairs.length}
                                className="sticky left-0 z-10 bg-background border border-border p-2 font-medium text-center align-top"
                              >
                                {day.name}
                              </td>
                            )}
                            <td className="sticky left-[70px] z-10 bg-background border border-border p-2 text-center align-top">
                              {pair.number}
                            </td>
                            {unitKeys.map((code) => (
                              <td key={`${day.id}-${pair.id}-${code}`} className="border border-border p-1 min-w-[180px] align-top">
                                <div className="flex flex-col gap-1">
                                  {activeWeeksData.map((week, weekIdx) => {
                                    const matchFn = (r: any) =>
                                      viewMode === "units"
                                        ? r.unitCode === code
                                        : r.studyGroupCode === code;
                                    const entry = displayRows.find(
                                      (r: any) =>
                                        matchFn(r) &&
                                        r.dayOfWeekId === day.id &&
                                        r.pairNumberId === pair.id &&
                                        r.weekId === week.id
                                    );
                                    return (
                                      <DroppableArea
                                        key={`${week.id}-${day.id}-${pair.id}-${code}`}
                                        weekId={week.id}
                                        weekIndex={weekIdx}
                                        dayId={day.id}
                                        pairId={pair.id}
                                        unitCode={code}
                                        entry={entry}
                                        isEditMode={editMode}
                                        status={slotStatuses[`week-${week.id}-${day.id}-${pair.id}-${code}`] ?? null}
                                        onCellClick={openFlagEditor}
                                      />
                                    );
                                  })}
                                </div>
                              </td>
                            ))}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <DragOverlay>
          {activeDragEntry ? (
            <div className="bg-background border border-border shadow p-2 rounded text-xs text-foreground">
              {activeDragEntry.displayText}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {selectedEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded shadow-lg w-80 border border-border">
            <h2 className="font-bold mb-4 text-foreground">Редактирование занятия</h2>
            <div className="text-sm mb-2 text-foreground">{selectedEntry.displayText}</div>
            <label className="block mb-2 text-foreground">
              Номер слияния:
              <input
                type="number"
                value={flagForm.mergeNumber}
                onChange={(e) => setFlagForm({ ...flagForm, mergeNumber: +e.target.value })}
                className="border border-border rounded px-2 py-1 w-full bg-background text-foreground"
              />
            </label>
            <label className="block mb-2 text-foreground">
              <input
                type="checkbox"
                checked={flagForm.positionFlag}
                onChange={(e) => setFlagForm({ ...flagForm, positionFlag: e.target.checked })}
              />
              <span className="ml-2">Закрепить позицию занятия</span>
            </label>
            <label className="block mb-4 text-foreground">
              <input
                type="checkbox"
                checked={flagForm.classroomFlag}
                onChange={(e) => setFlagForm({ ...flagForm, classroomFlag: e.target.checked })}
              />
              <span className="ml-2">Закрепить аудиторию</span>
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setSelectedEntry(null)} className="bg-muted text-foreground px-3 py-1 rounded hover:bg-muted/70">
                Отмена
              </button>
              <button onClick={saveFlags} className="bg-primary text-white px-3 py-1 rounded hover:bg-primary/90">
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}