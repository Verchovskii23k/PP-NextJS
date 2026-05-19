// src/app/admin/schedule/page.tsx
"use client";
import { toast } from "sonner";
import { trpc } from "@/trpc/client";
import { useState, useCallback, useEffect } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirmContext } from "@/contexts/ConfirmContext";
import { InputDialog } from "@/components/ui/InputDialog";


type Day = { id: number; name: string };
type Pair = { id: number; number: number };

type ScheduleRow = {
  id: number;
  weekId: number;
  dayOfWeekId: number;
  pairNumberId: number;
  unitCode: string;
  displayText: string;
  mergeNumber: number | null;
  positionFlag: boolean | null;
  classroomFlag: boolean | null;
  lessonId: number | null;
  isBuffered: boolean;
};
type AnyRow = ScheduleRow & { studyGroupCode?: string };
type ScheduleRowWithGroup = ScheduleRow & { studyGroupCode: string };
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
      className={`cursor-default rounded p-1 text-xs leading-tight ${isDragging ? "opacity-50" : ""} ${
        isEditMode ? "cursor-grab hover:ring-2 hover:ring-blue-300" : ""
      } bg-card text-foreground dark:bg-gray-700`}
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
      className={`rounded border p-1 text-xs leading-tight ${bg} ${isEditMode ? "min-h-[1.5rem]" : ""}`}
      onClick={() => entry && isEditMode && onCellClick(entry)}
    >
      {entry ? (
        <div className="flex items-center gap-1 rounded p-1">
          <DraggableLesson entry={entry} isEditMode={isEditMode} />
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
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
      className={`mb-1 flex cursor-grab items-center gap-1 rounded border border-amber-200 bg-amber-50 p-1 text-xs dark:border-amber-800 dark:bg-amber-900/20 ${
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
      className={`h-full w-56 flex-shrink-0 overflow-y-auto rounded border border-dashed border-border bg-muted p-2 ${
        isOver ? "bg-blue-50 ring-2 ring-blue-500 dark:bg-blue-900/30" : ""
      }`}
    >
      <div className="sticky top-0 mb-2 bg-muted py-1 text-xs font-bold text-foreground">Буфер</div>
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
  const [restoredVersionName, setRestoredVersionName] = useState<string | null>(null);
  const [restoredVersionId, setRestoredVersionId] = useState<number | null>(null);
  const [showAnnealingDialog, setShowAnnealingDialog] = useState(false);
  const [tempInput, setTempInput] = useState(1000);
  const [rateInput, setRateInput] = useState(0.95);
  const tempQuery = trpc.settings.get.useQuery(
    { key: "opt_initial_temperature" },
    { enabled: showAnnealingDialog }
  );
  const rateQuery = trpc.settings.get.useQuery(
    { key: "opt_cooling_rate" },
    { enabled: showAnnealingDialog }
  );

  const settingsUpdateMut = trpc.settings.update.useMutation({
    onSuccess: () => {toast.success("Настройки отжига сохранены")},
    onError: (e) => {toast.error(e.message)},
  });

  const handleSaveAnnealingSettings = async () => {
    try {
      await settingsUpdateMut.mutateAsync({ key: "opt_initial_temperature", value: String(tempInput) });
      await settingsUpdateMut.mutateAsync({ key: "opt_cooling_rate", value: String(rateInput) });
      setShowAnnealingDialog(false);
    } catch (e) {}
  };
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showAnnealingDialog) {
        setShowAnnealingDialog(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showAnnealingDialog]);
  // При изменении данных записываем в локальное состояние
  const handleOpenAnnealing = async () => {
    setShowAnnealingDialog(true);
    const tempRes = await tempQuery.refetch();
    const rateRes = await rateQuery.refetch();
    setTempInput(Number(tempRes.data) || 1000);
    setRateInput(Number(rateRes.data) || 0.95);
  };


  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean; message: string; onConfirm: () => void;
  }>({ show: false, message: "", onConfirm: () => {} });
  // Версионирование
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null); // null = активная
  // Диалог восстановления версии
  const [restoreDialog, setRestoreDialog] = useState<{
    show: boolean;
    versionId: number;
    versionName: string;
  }>({ show: false, versionId: 0, versionName: "" });

  const utils = trpc.useUtils();
  const versionsQuery = trpc.scheduleVersions.list.useQuery();
  const [versionsList, setVersionsList] = useState<{ id: number; name: string; createdAt: string }[]>([]);

  useEffect(() => {
    if (versionsQuery.data && versionsList.length === 0) {
      setVersionsList(versionsQuery.data);
    }
  }, [versionsQuery.data, versionsList.length]);
  const saveActiveMut = trpc.scheduleVersions.saveActive.useMutation({
    onSuccess: async () => {
      toast.success("Версия сохранена");
      await utils.scheduleVersions.list.refetch();
      setVersionsList(utils.scheduleVersions.list.getData() ?? []);
      setSelectedVersionId(null);
      setRestoredVersionId(null);
      refreshData();
    },
    onError: (e) => { toast.error(e.message); },
  });
  const deleteVersionMut = trpc.scheduleVersions.delete.useMutation({
    onError: (e) => { toast.error(e.message); },
  });
  const restoreAsActiveMut = trpc.scheduleVersions.restoreAsActive.useMutation({
    onSuccess: async () => {
      toast.success("Версия восстановлена как активная");
      await utils.scheduleVersions.list.refetch();
      setVersionsList(utils.scheduleVersions.list.getData() ?? []);
      setSelectedVersionId(null);
      refreshData();
    },
    onError: (e) => { toast.error(e.message); },
  });

  // Активные запросы с учётом версии
  const versionParam = selectedVersionId !== null ? selectedVersionId : null;
  const { data: unitsData, isLoading: unitsLoading } = trpc.scheduleDisplay.getForWeekPair.useQuery(
    { weekBaseId: 1, versionId: versionParam },
    { enabled: viewMode === "units" }
  );
  const { data: groupsData, isLoading: groupsLoading } = trpc.scheduleDisplay.getByStudyGroups.useQuery(
    { weekBaseId: 1, versionId: versionParam },
    { enabled: viewMode === "groups" }
  );
  // Буфер только для активной версии
  const { data: bufferData } = trpc.scheduleDisplay.getBuffer.useQuery(
    { versionId: null },
    { enabled: editMode && selectedVersionId === null }
  );

  const activeWeeksData: WeekInfo[] = unitsData?.weeks || groupsData?.weeks || [];
  const activeWeekIds = activeWeeksData.map((w) => w.id);

  const moveMutation = trpc.scheduleDisplay.move.useMutation({
    onError: (e) => { toast.error(e.message); },
  });
  const swapMutation = trpc.scheduleDisplay.swap.useMutation({
    onError: (e) => { toast.error(e.message); },
  });
  const updateFlags = trpc.scheduleDisplay.updateFlags.useMutation({
    onError: (e) => { toast.error(e.message); },
  });
  const moveToBufferMut = trpc.scheduleDisplay.moveToBuffer.useMutation({
    onError: (e) => { toast.error(e.message); },
  });
  const moveFromBufferMut = trpc.scheduleDisplay.moveFromBuffer.useMutation({
    onError: (e) => { toast.error(e.message); },
  });
  const checkSlots = trpc.scheduleDisplay.checkSlots.useMutation({
    onError: (e) => { toast.error(e.message); },
  });
  const optimizeScheduleMut = trpc.scheduleDisplay.optimizeSchedule.useMutation({
    onSuccess: (data) => {
      toast(`Оптимизация завершена. Итераций: ${data.iterations}, улучшение: с ${data.initialScore} до ${data.finalScore}`);
      refreshData();
    },
    onError: (e) => { toast.error(e.message); },
  });

  const refreshData = useCallback(() => {
    if (viewMode === "units") {
      utils.scheduleDisplay.getForWeekPair.invalidate({ weekBaseId: 1, versionId: versionParam });
    } else {
      utils.scheduleDisplay.getByStudyGroups.invalidate({ weekBaseId: 1, versionId: versionParam });
    }
    utils.scheduleDisplay.getBuffer.invalidate();
  }, [viewMode, utils, versionParam]);

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
      if (status === "conflict") {
        toast.error("Невозможно разместить: конфликт");
        return;
      }

      try {
        if (status === "free") {
          await moveMutation.mutateAsync({ id: entry.id, targetWeekId, targetDayId, targetPairId, targetUnitCode, versionId: selectedVersionId });
        } else if (status === "swap") {
          const swapId = slotSwapIds[targetId];
          if (!swapId) {
            toast.error("Занятие для обмена не найдено");
            return;
          }
          await swapMutation.mutateAsync({ id1: entry.id, id2: swapId, versionId: selectedVersionId });
        }
        refreshData();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Неизвестная ошибка");
      }
    },
    [slotStatuses, slotSwapIds, moveMutation, swapMutation, refreshData, selectedVersionId]
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
      const result = await checkSlots.mutateAsync({ movingId: entry.id, slots, versionId: selectedVersionId });
      const newStatuses: Record<string, "free" | "conflict" | "swap"> = {};
      const newSwapIds: Record<string, number> = {};
      for (const [key, val] of Object.entries(result)) {
        newStatuses[key] = val.status as "free" | "conflict" | "swap";
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
        await moveToBufferMut.mutateAsync({ id: entry.id, versionId: selectedVersionId });
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
        toast.error("Невозможно разместить: конфликт");
        return;
      }
      await moveFromBufferMut.mutateAsync({ id: entry.id, targetWeekId, targetDayId, targetPairId, targetUnitCode, versionId: selectedVersionId });
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
      mergeNumber: entry.mergeNumber ?? 0,
      positionFlag: entry.positionFlag ?? false,
      classroomFlag: entry.classroomFlag ?? false,
    });
  };

  const saveFlags = async () => {
    if (!selectedEntry) return;
    await updateFlags.mutateAsync({ id: selectedEntry.id, ...flagForm, versionId: selectedVersionId });
    setSelectedEntry(null);
    refreshData();
  };

  const handlePrint = () => {
    // ... без изменений (полный код в вашем исходнике)
    const headerCells: string[] = [];
    const rows: string[][] = [];

    if (viewMode === "units" && unitsData) {
      const unitCodes = Array.from(new Set(unitsData.rows.map(r => r.unitCode))).sort();
      headerCells.push("День", "Пара", "Неделя", ...unitCodes);

      for (const day of unitsData.days) {
        for (const pair of unitsData.pairs) {
          for (const week of activeWeeksData) {
            const row: string[] = [
              day.name,
              String(pair.number),
              week.type,
            ];
            for (const code of unitCodes) {
              const entry = unitsData.rows.find(
                r => r.unitCode === code && r.dayOfWeekId === day.id && r.pairNumberId === pair.id && r.weekId === week.id
              );
              row.push(entry ? entry.displayText : "—");
            }
            rows.push(row);
          }
        }
      }
    } else if (viewMode === "groups" && groupsData) {
      const groupCodes = Array.from(new Set(groupsData.rows.map((r: ScheduleRowWithGroup) => r.studyGroupCode))).sort();
      headerCells.push("День", "Пара", "Неделя", ...groupCodes);

      for (const day of groupsData.days) {
        for (const pair of groupsData.pairs) {
          for (const week of activeWeeksData) {
            const row: string[] = [
              day.name,
              String(pair.number),
              week.type,
            ];
            for (const code of groupCodes) {
              const entry = groupsData.rows.find(
                (r: ScheduleRowWithGroup) => r.studyGroupCode === code && r.dayOfWeekId === day.id && r.pairNumberId === pair.id && r.weekId === week.id
              );
              row.push(entry ? entry.displayText : "—");
            }
            rows.push(row);
          }
        }
      }
    }

    if (rows.length === 0) return;

    let html = `<table border="1" cellpadding="4" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 10px;">`;
    html += `<thead><tr>${headerCells.map(h => `<th style="border:1px solid #666; padding:4px; background:#e5e7eb;">${h}</th>`).join("")}</tr></thead>`;
    html += `<tbody>`;
    rows.forEach(row => {
      const isEven = row[2] === "even";
      const bg = isEven ? 'background-color:#d1d5db;' : '';
      html += `<tr style="${bg}">`;
      row.forEach(cell => {
        html += `<td style="border:1px solid #666; padding:4px; vertical-align:middle;">${cell}</td>`;
      });
      html += `</tr>`;
    });
    html += `</tbody></table>`;

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
              th { background: #e5e7eb !important; }
            }
          </style>
        </head>
        <body class="p-4">
          <h1 class="text-xl font-bold mb-4">Расписание</h1>
          ${html}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const handleCSV = () => {
    // ... без изменений (полный код в вашем исходнике)
    const rows: string[][] = [];
    const header = ["День", "Пара", ...activeWeeksData.map(w => w.type)];

    if (viewMode === "units" && unitsData) {
      const unitCodes = Array.from(new Set(unitsData.rows.map(r => r.unitCode))).sort();
      unitCodes.forEach(code => header.push(code));
      rows.push(header);

      for (const day of unitsData.days) {
        for (const pair of unitsData.pairs) {
          for (const week of activeWeeksData) {
            const row = [day.name, String(pair.number), week.type];
            for (const code of unitCodes) {
              const entry = unitsData.rows.find(
                r => r.unitCode === code && r.dayOfWeekId === day.id && r.pairNumberId === pair.id && r.weekId === week.id
              );
              row.push(entry ? entry.displayText : "—");
            }
            rows.push(row);
          }
        }
      }
    } else if (viewMode === "groups" && groupsData) {
      const groupCodes = Array.from(new Set(groupsData.rows.map((r: ScheduleRowWithGroup) => r.studyGroupCode))).sort();
      groupCodes.forEach(code => header.push(code));
      rows.push(header);

      for (const day of groupsData.days) {
        for (const pair of groupsData.pairs) {
          for (const week of activeWeeksData) {
            const row = [day.name, String(pair.number), week.type];
            for (const code of groupCodes) {
              const entry = groupsData.rows.find(
                (r) => r.studyGroupCode === code && r.dayOfWeekId === day.id && r.pairNumberId === pair.id && r.weekId === week.id
              );
              row.push(entry ? entry.displayText : "—");
            }
            rows.push(row);
          }
        }
      }
    }

    if (rows.length === 0) return;

    const bom = "\uFEFF";
    const csvContent = "data:text/csv;charset=utf-8," + bom + rows.map(r => r.join(";")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `schedule.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const resetGeneratedMut = trpc.generations.resetGeneratedData.useMutation({
    onSuccess: () => {
      toast.success('Активные данные удалены')
      refreshData()
    },
    onError: (e) => {toast.error(e.message)},
  });

  const handleSaveVersion = () => {
    setInputDialog({
      show: true,
      title: "Название версии",
      defaultValue: `Версия от ${new Date().toLocaleDateString()}`,
      onConfirm: async (name) => {
        await saveActiveMut.mutateAsync({ name });
        setInputDialog({ show: false, title: "", onConfirm: () => {} });
        setRestoredVersionName(null);
        setRestoredVersionId(null);
      },
    });
  };

  const { confirm } = useConfirmContext();

  const handleDeleteVersion = async () => {
    const versionId = restoredVersionId ?? selectedVersionId;
    if (versionId === null) return;
    const ok = await confirm({
      title: "Удаление версии",
      message: "Удалить версию и все её данные?",
      confirmLabel: "Удалить",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await deleteVersionMut.mutateAsync({ versionId });
      setVersionsList(prev => prev.filter(v => v.id !== versionId));
      setRestoredVersionId(null);
      setRestoredVersionName(null);
      setSelectedVersionId(null);
      refreshData();
      toast.success("Версия удалена");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка удаления");
    }
  };

  // Обработчик изменения версии в select
  const handleVersionChange = (val: string) => {
    if (val === "active") {
      setSelectedVersionId(null);
      setRestoredVersionName(null);
      setRestoredVersionId(null);
      return;
    }
    const versionId = Number(val);
    const versionName = versionsList.find((v) => v.id === versionId)?.name ?? "";
    setRestoreDialog({ show: true, versionId, versionName });
  };

  const [inputDialog, setInputDialog] = useState<{
    show: boolean;
    title: string;
    defaultValue?: string;
    onConfirm: (value: string) => void;
  }>({ show: false, title: "", onConfirm: () => {} });

  // Обработчики диалога восстановления
  const handleRestoreSaveAndProceed = () => {
    setRestoreDialog({ show: false, versionId: 0, versionName: "" });
    setInputDialog({
      show: true,
      title: "Сохранить текущее расписание как",
      defaultValue: `Автосохранение ${new Date().toLocaleDateString()}`,
      onConfirm: async (name) => {
        try {
          await saveActiveMut.mutateAsync({ name });
        } catch (e) {
          toast.error("Ошибка при сохранении: " + (e instanceof Error ? e.message : ""));
          return;
        }
        try {
          await restoreAsActiveMut.mutateAsync({ versionId: restoreDialog.versionId });
          setRestoredVersionName(restoreDialog.versionName);
          setRestoredVersionId(restoreDialog.versionId);
          setSelectedVersionId(null);
          setInputDialog({ show: false, title: "", onConfirm: () => {} });
          refreshData();
        } catch (e) {
          toast.error("Ошибка восстановления: " + (e instanceof Error ? e.message : ""));
        }
      },
    });
  };

  const handleRestoreProceedWithoutSave = async () => {
    setRestoreDialog({ show: false, versionId: 0, versionName: "" });
    try {
      await restoreAsActiveMut.mutateAsync({ versionId: restoreDialog.versionId });
      setRestoredVersionName(restoreDialog.versionName);
      setRestoredVersionId(restoreDialog.versionId);
      setSelectedVersionId(null);
      refreshData();
    } catch (e) {
      toast.error("Ошибка восстановления: " + (e instanceof Error ? e.message : ""));
    }
  };

  const handleRestoreCancel = () => {
    setRestoreDialog({ show: false, versionId: 0, versionName: "" });
  };

  const isActiveVersion = selectedVersionId === null;

  if (viewMode === "units" && unitsLoading) return <div className="p-6"><Skeleton className="h-4 w-32" /></div>;
  if (viewMode === "groups" && groupsLoading) return <div className="p-6"><Skeleton className="h-4 w-32" /></div>;

  const bufferEntries = bufferData || [];
  const displayRows = viewMode === "units" ? unitsData?.rows : (groupsData?.rows as ScheduleRowWithGroup[] | undefined);
  const days = viewMode === "units" ? unitsData?.days : groupsData?.days;
  const pairs = viewMode === "units" ? unitsData?.pairs : groupsData?.pairs;
  const unitKeys = viewMode === "units"
    ? Array.from(new Set(displayRows?.map((r) => r.unitCode) || [])).sort()
    : Array.from(new Set((displayRows as AnyRow[])?.map((r) => r.studyGroupCode || "") || [])).sort();

  return (
    <div className="flex h-full flex-col bg-background p-4 text-foreground">
      <h1 className="mb-4 text-xl font-bold">Расписание</h1>

      {/* Панель версионирования */}
      <div className="mb-4 flex items-center gap-3">
        <select
          className="rounded border border-border bg-background px-2 py-1 text-sm"
          value={
            restoredVersionName
              ? "restored"
              : selectedVersionId ?? "active"
          }
          onChange={(e) => {
            const val = e.target.value;
            if (val === "active") {
              setSelectedVersionId(null);
              setRestoredVersionName(null);
              setRestoredVersionId(null);
            } else if (val === "restored") {
              // ничего
            } else {
              setRestoredVersionName(null);
              setRestoredVersionId(null);
              handleVersionChange(val);
            }
          }}
        >
          <option value="active">Активное расписание</option>
          {restoredVersionName && (
            <option value="restored">{restoredVersionName} (текущая)</option>
          )}
          {versionsList.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} ({new Date(v.createdAt).toLocaleDateString()})
            </option>
          ))}
        </select>
        {isActiveVersion && restoredVersionId === null && (
          <>
            <button
              onClick={handleSaveVersion}
              disabled={saveActiveMut.isPending}
              className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
            >
              {saveActiveMut.isPending ? "Сохранение..." : "Сохранить как версию"}
            </button>
            <button
              onClick={async () => {
                const ok = await confirm({
                  title: "Удаление активного расписания",
                  message:
                    "Будут полностью удалены все активные данные (расписание, занятия, юниты, группы). Действие нельзя отменить. Продолжить?",
                  confirmLabel: "Удалить",
                  variant: "danger",
                });
                if (!ok) return;
                try {
                  await resetGeneratedMut.mutateAsync();
                  setRestoredVersionName(null);
                  setRestoredVersionId(null);
                  toast.success("Активные данные удалены");
                } catch (e) {
                  // ошибка уже обработана в onError
                }
              }}
              disabled={resetGeneratedMut.isPending}
              className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
            >
              {resetGeneratedMut.isPending ? "Удаление..." : "Удалить активное"}
            </button>
          </>
        )}
        {isActiveVersion && restoredVersionId !== null && (
          <>
            <button
              onClick={handleSaveVersion}
              disabled={saveActiveMut.isPending}
              className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
            >
              {saveActiveMut.isPending ? "Сохранение..." : "Сохранить как версию"}
            </button>
            <button
              onClick={handleDeleteVersion}
              disabled={deleteVersionMut.isPending}
              className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
            >
              {deleteVersionMut.isPending ? "Удаление..." : "Удалить версию"}
            </button>
          </>
        )}
        {!isActiveVersion && (
          <button
            onClick={handleDeleteVersion}
            disabled={deleteVersionMut.isPending}
            className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
          >
            {deleteVersionMut.isPending ? "Удаление..." : "Удалить версию"}
          </button>
        )}
      </div>
      <InputDialog
        open={inputDialog.show}
        title={inputDialog.title}
        defaultValue={inputDialog.defaultValue}
        onConfirm={inputDialog.onConfirm}
        onCancel={() => setInputDialog({ show: false, title: "", onConfirm: () => {} })}
      />
      {/* Диалог восстановления версии */}
      {restoreDialog.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="max-w-md rounded border border-border bg-background p-6 shadow-lg">
            <p className="mb-4 text-foreground">
              Вы собираетесь загрузить версию «{restoreDialog.versionName}» как активную.
              Текущее активное расписание будет безвозвратно удалено. Желаете сохранить текущее расписание перед заменой?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={handleRestoreCancel}
                className="rounded border border-border px-4 py-2 text-foreground hover:bg-muted"
              >
                Отмена
              </button>
              <button
                onClick={handleRestoreProceedWithoutSave}
                className="rounded bg-yellow-600 px-4 py-2 text-white hover:bg-yellow-700"
              >
                Продолжить без сохранения
              </button>
              <button
                onClick={handleRestoreSaveAndProceed}
                className="hover:bg-primary/90 rounded bg-primary px-4 py-2 text-white"
              >
                Сохранить и продолжить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Легенда */}
      <div className="mb-4 flex flex-wrap gap-4 rounded border border-border bg-muted p-3 text-sm">
        {activeWeeksData.map((week, idx) => (
          <div key={week.id} className="flex items-center gap-2">
            <span
              className={`inline-block h-4 w-4 rounded ${WEEK_COLORS[idx % WEEK_COLORS.length].bg} ${WEEK_COLORS[idx % WEEK_COLORS.length].border}`}
            ></span>
            {week.type} (ID:{week.id})
          </div>
        ))}
        {editMode && (
          <>
            <div className="flex items-center gap-2">
              <span className="inline-block h-4 w-4 rounded border border-green-400 bg-green-300 dark:border-green-800 dark:bg-green-900/20"></span> Свободно
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-4 w-4 rounded border border-red-400 bg-red-300 dark:border-red-800 dark:bg-red-900/20"></span> Конфликт
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-4 w-4 rounded border border-blue-400 bg-blue-300 dark:border-blue-800 dark:bg-blue-900/20"></span> Обмен
            </div>
          </>
        )}
      </div>

      {confirmDialog.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="max-w-md rounded border border-border bg-background p-6 shadow-lg">
            <p className="mb-4 text-foreground">{confirmDialog.message}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDialog({ show: false, message: "", onConfirm: () => {} })}
                className="rounded border border-border px-4 py-2 text-foreground hover:bg-muted"
              >
                Отмена
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="hover:bg-primary/90 rounded bg-primary px-4 py-2 text-white"
              >
                Подтвердить
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 flex gap-4">
        <button onClick={() => setViewMode("units")} className={viewMode === "units" ? "border-b-2 border-blue-500 font-bold" : ""}>По юнитам</button>
        <button onClick={() => setViewMode("groups")} className={viewMode === "groups" ? "border-b-2 border-blue-500 font-bold" : ""}>По группам</button>
        <button onClick={handlePrint} className="ml-2 rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700">🖨️ Печать</button>
        <button onClick={handleCSV} className="ml-2 rounded bg-green-600 px-3 py-1 text-white hover:bg-green-700">📥 CSV</button>
        <button
          onClick={() => optimizeScheduleMut.mutate({ versionId: selectedVersionId })}
          disabled={editMode || optimizeScheduleMut.isPending || !isActiveVersion}
          className="rounded bg-purple-600 px-3 py-1 text-white hover:bg-purple-700 disabled:bg-gray-400"
        >
          {optimizeScheduleMut.isPending ? "Оптимизация..." : "Оптимизировать"}
        </button>
        {editMode && isActiveVersion && (
          <button
            onClick={handleOpenAnnealing}
            className="rounded bg-gray-600 px-3 py-1 text-white hover:bg-gray-700"
            title="Настройки отжига"
          >
            ⚙️
          </button>
        )}
        {viewMode === "units" && (
          <button
            onClick={() => setEditMode(!editMode)}
            disabled={!isActiveVersion}
            className="ml-auto rounded bg-blue-500 px-3 py-1 text-white hover:bg-blue-600 disabled:bg-gray-400"
          >
            {editMode ? "Завершить редактирование" : "Редактировать"}
          </button>
        )}
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex min-h-0 flex-1 items-stretch gap-4">
          {editMode && <BufferZone entries={bufferEntries} isEditMode={editMode} />}

          <div className="min-h-0 flex-1 overflow-auto" id="schedule-table">
            {days && pairs && displayRows && (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-muted">
                      <th className="sticky left-0 z-20 w-[70px] min-w-[70px] border border-border bg-muted p-2 text-foreground">
                        День
                      </th>
                      <th className="sticky left-[70px] z-20 w-[50px] min-w-[50px] border border-border bg-muted p-2 text-foreground">
                        Пара
                      </th>
                      {unitKeys.map((code) => (
                        <th key={code} className="min-w-[180px] whitespace-nowrap border border-border bg-blue-50 p-2 text-foreground dark:bg-blue-900/30">
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
                                className="sticky left-0 z-10 border border-border bg-background p-2 text-center align-top font-medium"
                              >
                                {day.name}
                              </td>
                            )}
                            <td className="sticky left-[70px] z-10 border border-border bg-background p-2 text-center align-top">
                              {pair.number}
                            </td>
                            {unitKeys.map((code) => (
                              <td key={`${day.id}-${pair.id}-${code}`} className="min-w-[180px] border border-border p-1 align-top">
                                <div className="flex flex-col gap-1">
                                  {activeWeeksData.map((week, weekIdx) => {
                                    const matchFn = (r: AnyRow) =>
                                      viewMode === "units"
                                        ? r.unitCode === code
                                        : r.studyGroupCode === code;
                                    const entry = displayRows.find(
                                      (r) =>
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
            <div className="rounded border border-border bg-background p-2 text-xs text-foreground shadow">
              {activeDragEntry.displayText}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="w-80 rounded border border-border bg-background p-6 shadow-lg">
            <h2 className="mb-4 font-bold text-foreground">Редактирование занятия</h2>
            <div className="mb-2 text-sm text-foreground">{selectedEntry.displayText}</div>
            <label className="mb-2 block text-foreground">
              Номер слияния:
              <input
                type="number"
                value={flagForm.mergeNumber}
                onChange={(e) => setFlagForm({ ...flagForm, mergeNumber: +e.target.value })}
                className="w-full rounded border border-border bg-background px-2 py-1 text-foreground"
              />
            </label>
            <label className="mb-2 block text-foreground">
              <input
                type="checkbox"
                checked={flagForm.positionFlag}
                onChange={(e) => setFlagForm({ ...flagForm, positionFlag: e.target.checked })}
              />
              <span className="ml-2">Закрепить позицию занятия</span>
            </label>
            <label className="mb-4 block text-foreground">
              <input
                type="checkbox"
                checked={flagForm.classroomFlag}
                onChange={(e) => setFlagForm({ ...flagForm, classroomFlag: e.target.checked })}
              />
              <span className="ml-2">Закрепить аудиторию</span>
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setSelectedEntry(null)} className="hover:bg-muted/70 rounded bg-muted px-3 py-1 text-foreground">
                Отмена
              </button>
              <button onClick={saveFlags} className="hover:bg-primary/90 rounded bg-primary px-3 py-1 text-white">
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
      {showAnnealingDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="w-full max-w-md rounded border border-border bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-bold text-foreground">Параметры отжига</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Эти параметры влияют на работу оптимизатора расписания. 
              <strong>Начальная температура</strong> определяет, насколько активно перемешиваются занятия в начале. 
              Чем выше температура, тем больше случайных перемещений, что помогает избежать застревания в локальных минимумах. 
              <strong>Скорость охлаждения</strong> определяет, как быстро температура снижается. 
              Значение близкое к 1 даёт более тщательный поиск, но увеличивает время оптимизации.
            </p>
            <div className="mb-4">
              <label className="mb-1 block text-sm text-foreground">
                Начальная температура
              </label>
              <input
                type="number"
                min={1}
                step={10}
                value={tempInput}
                onChange={(e) => setTempInput(Number(e.target.value))}
                className="w-full rounded border border-border bg-background px-3 py-2 text-foreground"
                title="Начальная температура (1–10000). Чем выше, тем больше случайных перестановок на старте."
              />
            </div>
            <div className="mb-4">
              <label className="mb-1 block text-sm text-foreground">
                Скорость охлаждения
              </label>
              <input
                type="number"
                min={0.001}
                max={0.999}
                step={0.001}
                value={rateInput}
                onChange={(e) => setRateInput(Number(e.target.value))}
                className="w-full rounded border border-border bg-background px-3 py-2 text-foreground"
                title="Скорость охлаждения (0.001–0.999). Ближе к 1 – медленное охлаждение, дольше оптимизация, потенциально лучший результат."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAnnealingDialog(false)}
                className="rounded border border-border px-4 py-2 text-foreground hover:bg-muted"
              >
                Отмена
              </button>
              <button
                onClick={handleSaveAnnealingSettings}
                disabled={settingsUpdateMut.isPending}
                className="hover:bg-primary/90 rounded bg-primary px-4 py-2 text-white"
              >
                {settingsUpdateMut.isPending ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}