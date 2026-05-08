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
  weekNumber: number;
  dayOfWeekId: number;
  pairNumberId: number;
  unitCode: string;
  displayText: string;
  mergeNumber: number;
  positionFlag: boolean;
  classroomFlag: boolean;
  lessonId: number | null;
};

function DraggableLesson({ entry, isEditMode }: { entry: ScheduleRow; isEditMode: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `lesson-${entry.id}`,
    data: { entry },
    disabled: !isEditMode,
  });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
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

function DroppableArea({ week, dayId, pairId, unitCode, entry, isEditMode, status, onCellClick }: {
  week: number; dayId: number; pairId: number; unitCode: string;
  entry: ScheduleRow | undefined; isEditMode: boolean;
  status: "free" | "conflict" | "swap" | null;
  onCellClick: (e: ScheduleRow) => void;
}) {
  const droppableId = `week-${week}-${dayId}-${pairId}-${unitCode}`;
  const { isOver, setNodeRef } = useDroppable({
    id: droppableId,
    data: { week, dayId, pairId, unitCode },
    disabled: !isEditMode,
  });

  let bg = "";
  if (isEditMode) {
    if (status === "free") bg = "bg-green-100 dark:bg-green-900/20";
    else if (status === "conflict") bg = "bg-red-100 dark:bg-red-900/20";
    else if (status === "swap") bg = "bg-blue-100 dark:bg-blue-900/20";
    if (isOver) bg += " ring-2 ring-blue-500";
  } else {
    if (entry) {
      bg = week % 2 === 1
        ? "bg-green-100 dark:bg-green-900/20"
        : "bg-amber-100 dark:bg-amber-900/20";
    }
  }

  const entryBg = entry
    ? week % 2 === 1
      ? "bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
      : "bg-amber-100 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
    : "";

  return (
    <div
      ref={setNodeRef}
      data-week={week % 2 === 1 ? "odd" : "even"}
      className={`text-xs p-1 rounded leading-tight border ${bg} ${isEditMode ? "min-h-[1.5rem]" : ""}`}
      onClick={() => entry && isEditMode && onCellClick(entry)}
    >
      {entry ? (
        <div className={`flex items-center gap-1 p-1 rounded ${entryBg}`}>
          <span className="text-muted-foreground font-mono text-[10px]">
            {week % 2 === 1 ? "н." : "ч."}
          </span>
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
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
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
  const { isOver, setNodeRef } = useDroppable({
    id: droppableId,
    disabled: !isEditMode,
  });

  return (
    <div
      ref={setNodeRef}
      className={`border border-dashed border-border bg-muted p-2 w-56 flex-shrink-0 overflow-y-auto rounded h-full ${
        isOver ? "bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500" : ""
      }`}
    >
      <div className="text-xs font-bold mb-2 sticky top-0 bg-muted py-1 text-foreground">Буфер</div>
      {entries.map(entry => (
        <BufferEntry key={entry.id} entry={entry} />
      ))}
      {entries.length === 0 && <div className="text-xs text-muted-foreground">Пусто</div>}
    </div>
  );
}

export default function AdminSchedulePage() {
  const weekBase = 1;
  const [viewMode, setViewMode] = useState<"units" | "groups">("units");
  const [editMode, setEditMode] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<ScheduleRow | null>(null);
  const [flagForm, setFlagForm] = useState({ mergeNumber: 0, positionFlag: false, classroomFlag: false });
  const [activeDragEntry, setActiveDragEntry] = useState<ScheduleRow | null>(null);
  const [slotStatuses, setSlotStatuses] = useState<Record<string, "free" | "conflict" | "swap">>({});
  const [slotSwapIds, setSlotSwapIds] = useState<Record<string, number>>({});

  const utils = trpc.useUtils();

  const { data: unitsData, isLoading: unitsLoading } =
    trpc.scheduleDisplay.getForWeekPair.useQuery({ weekBase }, { enabled: viewMode === "units" });
  const { data: groupsData, isLoading: groupsLoading } =
    trpc.scheduleDisplay.getByStudyGroups.useQuery({ weekBase }, { enabled: viewMode === "groups" });
  const { data: bufferData } = trpc.scheduleDisplay.getBuffer.useQuery(undefined, { enabled: editMode });

  const checkSlots = trpc.scheduleDisplay.checkSlots.useMutation();
  const moveMutation = trpc.scheduleDisplay.move.useMutation();
  const swapMutation = trpc.scheduleDisplay.swap.useMutation();
  const updateFlags = trpc.scheduleDisplay.updateFlags.useMutation();
  const moveToBufferMut = trpc.scheduleDisplay.moveToBuffer.useMutation();
  const moveFromBufferMut = trpc.scheduleDisplay.moveFromBuffer.useMutation();
  
  const optimizeScheduleMut = trpc.scheduleDisplay.optimizeSchedule.useMutation({
    onSuccess: (data) => {
      alert(`Оптимизация завершена. Итераций: ${data.iterations}, улучшение: с ${data.initialScore} до ${data.finalScore}`);
      if (viewMode === "units") {
        utils.scheduleDisplay.getForWeekPair.invalidate({ weekBase });
        utils.scheduleDisplay.getForWeekPair.refetch({ weekBase });
      } else {
        utils.scheduleDisplay.getByStudyGroups.invalidate({ weekBase });
        utils.scheduleDisplay.getByStudyGroups.refetch({ weekBase });
      }
      utils.scheduleDisplay.getBuffer.invalidate();
    },
    onError: (e) => alert(e.message),
  });
  
  const optimizeScheduleMut = trpc.scheduleDisplay.optimizeSchedule.useMutation({
  onSuccess: (data) => {
    const res = (data as any)?.result?.data || data;   // ← добавить эту строку
    alert(`Оптимизация завершена. Итераций: ${res.iterations}, улучшение: с ${res.initialScore} до ${res.finalScore}`);
      if (viewMode === "units") {
        utils.scheduleDisplay.getForWeekPair.invalidate({ weekBase });
        utils.scheduleDisplay.getForWeekPair.refetch({ weekBase });
      } else {
        utils.scheduleDisplay.getByStudyGroups.invalidate({ weekBase });
        utils.scheduleDisplay.getByStudyGroups.refetch({ weekBase });
      }
      utils.scheduleDisplay.getBuffer.invalidate();
    },
    onError: (e) => alert(e.message),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const refreshSlotStatuses = useCallback(
    async (entry: ScheduleRow) => {
      if (!unitsData) return;
      const days = unitsData.days;
      const pairs = unitsData.pairs;
      const slots: { week: number; dayId: number; pairId: number; unitCode: string }[] = [];
      for (const week of [weekBase, weekBase + 1]) {
        for (const day of days) {
          for (const pair of pairs) {
            slots.push({ week, dayId: day.id, pairId: pair.id, unitCode: entry.unitCode });
          }
        }
      }
      const result = await checkSlots.mutateAsync({ movingId: entry.id, slots });
      const newStatuses: Record<string, "free" | "conflict" | "swap"> = {};
      const newSwapIds: Record<string, number> = {};
      for (const [key, val] of Object.entries(result)) {
        newStatuses[key] = val.status as any;
        if (val.status === 'swap' && val.swapId) newSwapIds[key] = val.swapId;
      }
      setSlotStatuses(newStatuses);
      console.log('🔥 slotStatuses updated:', newStatuses);

      setSlotSwapIds(newSwapIds);
      console.log('🔥 slotSwapIds:', newSwapIds);
    },
    [unitsData, checkSlots]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const entry = event.active.data.current?.entry as ScheduleRow;
    if (entry) {
      setActiveDragEntry(entry);
      if (unitsData) {
        refreshSlotStatuses(entry);
      }
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

    if (targetId === "buffer-zone") {
      if (entry.weekNumber !== 0) {
        await moveToBufferMut.mutateAsync({ id: entry.id });
        utils.scheduleDisplay.getBuffer.invalidate();
        utils.scheduleDisplay.getForWeekPair.invalidate({ weekBase });
        utils.scheduleDisplay.getByStudyGroups.invalidate({ weekBase });
      }
      return;
    }

    if (entry.weekNumber === 0) {
      const parts = targetId.split("-");
      if (parts.length < 5 || parts[0] !== "week") return;
      const targetWeek = parseInt(parts[1], 10);
      const targetDayId = parseInt(parts[2], 10);
      const targetPairId = parseInt(parts[3], 10);
      const targetUnitCode = parts.slice(4).join("-");
      const slots = [{ week: targetWeek, dayId: targetDayId, pairId: targetPairId, unitCode: targetUnitCode }];
      const result = await checkSlots.mutateAsync({ movingId: entry.id, slots });
      const status = result[`week-${targetWeek}-${targetDayId}-${targetPairId}-${targetUnitCode}`]?.status;
      if (status !== 'free') {
        alert('Невозможно разместить: конфликт');
        return;
      }
      await moveFromBufferMut.mutateAsync({ id: entry.id, targetWeek, targetDayId, targetPairId, targetUnitCode });
      utils.scheduleDisplay.getBuffer.invalidate();
      utils.scheduleDisplay.getForWeekPair.invalidate({ weekBase });
      utils.scheduleDisplay.getByStudyGroups.invalidate({ weekBase });
      return;
    }

    const targetWeek = parseInt(targetId.split("-")[1], 10);
    const targetDayId = parseInt(targetId.split("-")[2], 10);
    const targetPairId = parseInt(targetId.split("-")[3], 10);
    const targetUnitCode = targetId.split("-").slice(4).join("-");

    if (targetUnitCode !== entry.unitCode) {
      console.warn("Нельзя перенести занятие в другой юнит");
      return;
    }

    const status = slotStatuses[targetId];
    if (!status) return;
    try {
      if (status === "free") {
        await moveMutation.mutateAsync({ id: entry.id, targetWeek, targetDayId, targetPairId, targetUnitCode });
      } else if (status === "swap") {
        const swapId = slotSwapIds[targetId];
        if (!swapId) { alert("Занятие для обмена не найдено"); return; }
        await swapMutation.mutateAsync({ id1: entry.id, id2: swapId });
      }
      utils.scheduleDisplay.getForWeekPair.invalidate({ weekBase });
      utils.scheduleDisplay.getByStudyGroups.invalidate({ weekBase });
    } catch (e: any) { alert(e.message); }
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
    utils.scheduleDisplay.getForWeekPair.invalidate({ weekBase });
    utils.scheduleDisplay.getByStudyGroups.invalidate({ weekBase });
    utils.scheduleDisplay.getBuffer.invalidate();
  };

  const handlePrint = () => {
    const tableElement = document.getElementById("schedule-table");
    if (!tableElement) return;

    const clone = tableElement.cloneNode(true) as HTMLElement;

    clone.querySelectorAll("td, th").forEach((el) => {
      (el as HTMLElement).style.border = "1px solid #666";
      (el as HTMLElement).style.padding = "2px";
    });

    const rowHeight = "2.5em";

    clone.querySelectorAll("[data-week]").forEach((el) => {
      const htmlEl = el as HTMLElement;
      const weekType = htmlEl.getAttribute("data-week");
      htmlEl.style.backgroundColor = weekType === "even" ? "#d1d5db" : "transparent";
      htmlEl.style.minHeight = rowHeight;
      htmlEl.style.height = rowHeight;
      htmlEl.style.display = "flex";
      htmlEl.style.alignItems = "center";
      htmlEl.style.padding = "2px";
      htmlEl.style.borderBottom = "1px solid #666";

      const text = htmlEl.textContent?.trim() ?? "";
      if (text === "—" || text === "") {
        htmlEl.innerHTML = `<span style="display:inline-block; min-height:${rowHeight}; height:${rowHeight}; line-height:${rowHeight};">—</span>`;
      }
    });

    clone.querySelectorAll("td").forEach((td) => {
      if (td.hasAttribute("rowspan")) return;
      (td as HTMLElement).style.minHeight = rowHeight;
    });

    const printStyles = `
      <style>
        @media print {
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          table { border-collapse: collapse; width: 100%; font-size: 9px; }
          [data-week="even"] { background-color: #d1d5db !important; }
          [data-week="odd"] { background-color: transparent !important; }
          td { vertical-align: middle; }
        }
      </style>
    `;

    const styles = document.querySelectorAll("style, link[rel=stylesheet]");
    let stylesHtml = "";
    styles.forEach(s => stylesHtml += s.outerHTML);

    const printWindow = window.open("", "_blank", "width=1200,height=800");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Расписание (нед. ${weekBase}–${weekBase + 1})</title>
          ${stylesHtml}
          ${printStyles}
        </head>
        <body class="p-4">
          <h1 class="text-xl font-bold mb-4">Расписание (нед. ${weekBase}–${weekBase + 1})</h1>
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
    const header = ["День", "Пара", "Неделя"];

    if (viewMode === "units" && unitsData) {
      const unitCodes = Array.from(new Set(unitsData.rows.map(r => r.unitCode))).sort();
      unitCodes.forEach(code => header.push(code));
      rows.push(header);

      const days = unitsData.days;
      const pairs = unitsData.pairs;
      for (const day of days) {
        for (const pair of pairs) {
          const oddRow = [day.name, String(pair.number), "неч."];
          const evenRow = [day.name, String(pair.number), "чёт."];
          for (const code of unitCodes) {
            const odd = unitsData.rows.find(
              r => r.unitCode === code && r.dayOfWeekId === day.id && r.pairNumberId === pair.id && r.weekNumber === weekBase
            );
            const even = unitsData.rows.find(
              r => r.unitCode === code && r.dayOfWeekId === day.id && r.pairNumberId === pair.id && r.weekNumber === weekBase + 1
            );
            oddRow.push(odd ? odd.displayText : "—");
            evenRow.push(even ? even.displayText : "—");
          }
          rows.push(oddRow);
          rows.push(evenRow);
        }
      }
    } else if (viewMode === "groups" && groupsData) {
      const groupCodes = Array.from(new Set(groupsData.rows.map((r: any) => r.studyGroupCode))).sort();
      groupCodes.forEach(code => header.push(code));
      rows.push(header);

      const days = groupsData.days;
      const pairs = groupsData.pairs;
      for (const day of days) {
        for (const pair of pairs) {
          const oddRow = [day.name, String(pair.number), "неч."];
          const evenRow = [day.name, String(pair.number), "чёт."];
          for (const code of groupCodes) {
            const odd = groupsData.rows.find(
              (r: any) => r.studyGroupCode === code && r.dayOfWeekId === day.id && r.pairNumberId === pair.id && r.weekNumber === weekBase
            );
            const even = groupsData.rows.find(
              (r: any) => r.studyGroupCode === code && r.dayOfWeekId === day.id && r.pairNumberId === pair.id && r.weekNumber === weekBase + 1
            );
            oddRow.push(odd ? odd.displayText : "—");
            evenRow.push(even ? even.displayText : "—");
          }
          rows.push(oddRow);
          rows.push(evenRow);
        }
      }
    }

    const bom = "\uFEFF";
    const csvContent = "data:text/csv;charset=utf-8," + bom + rows.map(r => r.join(";")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `schedule_week${weekBase}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  if (viewMode === "units" && unitsLoading) return <div className="p-6">Загрузка...</div>;
  if (viewMode === "groups" && groupsLoading) return <div className="p-6">Загрузка...</div>;

  const bufferEntries = bufferData || [];

  return (
    <div className="p-4 bg-background text-foreground">
      <h1 className="text-xl font-bold mb-4">Расписание</h1>

      <div className="flex flex-wrap gap-4 mb-4 p-3 bg-muted rounded border border-border text-sm">
        <div className="flex items-center gap-2">
          <span className="inline-block w-4 h-4 rounded bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800"></span> Нечётная неделя
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-4 h-4 rounded bg-amber-100 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"></span> Чётная неделя
        </div>
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
          className="px-3 py-1 rounded ml-2 bg-purple-600 hover:bg-purple-700 text-white disabled:bg-gray-400"
        >
          {optimizeScheduleMut.isPending ? "Оптимизация..." : "Оптимизировать"}
        </button>

        {viewMode === "units" && (
          <button onClick={() => setEditMode(!editMode)} className="ml-auto bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600">
            {editMode ? "Завершить редактирование" : "Редактировать"}
          </button>
        )}
      </div>
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
          {editMode && (
            <BufferZone entries={bufferEntries} isEditMode={editMode} />
          )}

          <div className="flex-1 overflow-auto" id="schedule-table">
            {viewMode === "units" && unitsData && (
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
                      {Array.from(new Set(unitsData.rows.map((r) => r.unitCode))).sort().map((code) => (
                        <th
                          key={code}
                          className="border border-border p-2 bg-blue-50 dark:bg-blue-900/30 text-foreground whitespace-nowrap min-w-[180px]"
                        >
                          {code}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {unitsData.days.map((day) =>
                      unitsData.pairs.map((pair, pairIdx) => {
                        const isFirstPairOfDay = pairIdx === 0;
                        return (
                          <tr key={`${day.id}-${pair.id}`}>
                            {isFirstPairOfDay && (
                              <td
                                rowSpan={unitsData.pairs.length}
                                className="sticky left-0 z-10 bg-background border border-border p-2 font-medium text-center align-top"
                              >
                                {day.name}
                              </td>
                            )}
                            <td className="sticky left-[70px] z-10 bg-background border border-border p-2 text-center align-top">
                              {pair.number}
                            </td>
                            {Array.from(new Set(unitsData.rows.map((r) => r.unitCode))).sort().map((code) => {
                              const oddEntry = unitsData.rows.find(
                                (r) => r.unitCode === code && r.dayOfWeekId === day.id && r.pairNumberId === pair.id && r.weekNumber === weekBase
                              );
                              const evenEntry = unitsData.rows.find(
                                (r) => r.unitCode === code && r.dayOfWeekId === day.id && r.pairNumberId === pair.id && r.weekNumber === weekBase + 1
                              );
                              return (
                                <td key={`${day.id}-${pair.id}-${code}`} className="border border-border p-1 min-w-[180px] align-top">
                                  <div className="flex flex-col">
                                    <div className="border-b border-dashed border-border pb-1 mb-1">
                                      <DroppableArea
                                        week={weekBase}
                                        dayId={day.id}
                                        pairId={pair.id}
                                        unitCode={code}
                                        entry={oddEntry}
                                        isEditMode={editMode}
                                        status={slotStatuses[`week-${weekBase}-${day.id}-${pair.id}-${code}`] ?? null}
                                        onCellClick={openFlagEditor}
                                      />
                                    </div>
                                    <div className="pt-1">
                                      <DroppableArea
                                        week={weekBase + 1}
                                        dayId={day.id}
                                        pairId={pair.id}
                                        unitCode={code}
                                        entry={evenEntry}
                                        isEditMode={editMode}
                                        status={slotStatuses[`week-${weekBase + 1}-${day.id}-${pair.id}-${code}`] ?? null}
                                        onCellClick={openFlagEditor}
                                      />
                                    </div>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {viewMode === "groups" && groupsData && (
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
                      {Array.from(new Set(groupsData.rows.map((r: any) => r.studyGroupCode))).sort().map((code) => (
                        <th
                          key={code}
                          className="border border-border p-2 bg-blue-50 dark:bg-blue-900/30 text-foreground whitespace-nowrap min-w-[180px]"
                        >
                          {code}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groupsData.days.map((day: Day) =>
                      groupsData.pairs.map((pair: Pair, pairIdx: number) => {
                        const isFirstPairOfDay = pairIdx === 0;
                        return (
                          <tr key={`${day.id}-${pair.id}`}>
                            {isFirstPairOfDay && (
                              <td
                                rowSpan={groupsData.pairs.length}
                                className="sticky left-0 z-10 bg-background border border-border p-2 font-medium text-center align-top"
                              >
                                {day.name}
                              </td>
                            )}
                            <td className="sticky left-[70px] z-10 bg-background border border-border p-2 text-center align-top">
                              {pair.number}
                            </td>
                            {Array.from(new Set(groupsData.rows.map((r: any) => r.studyGroupCode))).sort().map((code) => {
                              const oddEntry = groupsData.rows.find(
                                (r: any) => r.studyGroupCode === code && r.dayOfWeekId === day.id && r.pairNumberId === pair.id && r.weekNumber === weekBase
                              );
                              const evenEntry = groupsData.rows.find(
                                (r: any) => r.studyGroupCode === code && r.dayOfWeekId === day.id && r.pairNumberId === pair.id && r.weekNumber === weekBase + 1
                              );
                              return (
                                <td key={code} className="border border-border p-1 min-w-[180px] align-top">
                                  <div className="flex flex-col">
                                    <div data-week="odd" className="border-b border-dashed border-border pb-1 mb-1">
                                      <div
                                        className={`text-xs p-1 rounded leading-tight border ${
                                          oddEntry
                                            ? "bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                                            : "border-dashed border-border"
                                        }`}
                                      >
                                        {oddEntry ? (
                                          <div className="flex items-center gap-1">
                                            <span className="text-muted-foreground font-mono text-[10px]">н.</span>
                                            <span className="truncate text-foreground">{oddEntry.displayText}</span>
                                          </div>
                                        ) : (
                                          <span className="text-muted-foreground">—</span>
                                        )}
                                      </div>
                                    </div>
                                    <div data-week="even" className="pt-1">
                                      <div
                                        className={`text-xs p-1 rounded leading-tight border ${
                                          evenEntry
                                            ? "bg-amber-100 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                                            : "border-dashed border-border"
                                        }`}
                                      >
                                        {evenEntry ? (
                                          <div className="flex items-center gap-1">
                                            <span className="text-muted-foreground font-mono text-[10px]">ч.</span>
                                            <span className="truncate text-foreground">{evenEntry.displayText}</span>
                                          </div>
                                        ) : (
                                          <span className="text-muted-foreground">—</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              );
                            })}
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
              <input type="checkbox" checked={flagForm.positionFlag} onChange={(e) => setFlagForm({ ...flagForm, positionFlag: e.target.checked })} />
              <span className="ml-2">Закрепить позицию занятия</span>
            </label>
            <label className="block mb-4 text-foreground">
              <input type="checkbox" checked={flagForm.classroomFlag} onChange={(e) => setFlagForm({ ...flagForm, classroomFlag: e.target.checked })} />
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