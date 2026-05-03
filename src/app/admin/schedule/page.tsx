// "use client";

// import { trpc } from "@/trpc/client";
// import { useState, useCallback } from "react";
// import {
//   DndContext,
//   useDraggable,
//   useDroppable,
//   PointerSensor,
//   useSensor,
//   useSensors,
//   DragStartEvent,
//   DragEndEvent,
//   DragOverlay,
// } from "@dnd-kit/core";

// type Day = { id: number; name: string };
// type Pair = { id: number; number: number };

// type ScheduleRow = {
//   id: number;
//   weekNumber: number;
//   dayOfWeekId: number;
//   pairNumberId: number;
//   unitCode: string;
//   displayText: string;
//   mergeNumber: number;
//   positionFlag: boolean;
//   classroomFlag: boolean;
//   lessonId: number | null;
// };

// function DraggableLesson({ entry, isEditMode }: { entry: ScheduleRow; isEditMode: boolean }) {
//   const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
//     id: `lesson-${entry.id}`,
//     data: { entry },
//     disabled: !isEditMode,
//   });
//   const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
//   return (
//     <div
//       ref={setNodeRef}
//       {...listeners}
//       {...attributes}
//       className={`text-xs p-1 rounded leading-tight cursor-default ${isDragging ? "opacity-50" : ""} ${isEditMode ? "hover:ring-2 hover:ring-blue-300 cursor-grab" : ""}`}
//       style={style}
//     >
//       {entry.displayText}
//     </div>
//   );
// }

// function DroppableArea({
//   week,
//   dayId,
//   pairId,
//   unitCode,
//   entry,
//   isEditMode,
//   status,
//   onCellClick,
// }: {
//   week: number;
//   dayId: number;
//   pairId: number;
//   unitCode: string;
//   entry: ScheduleRow | undefined;
//   isEditMode: boolean;
//   status: "free" | "conflict" | "swap" | null;
//   onCellClick: (e: ScheduleRow) => void;
// }) {
//   const droppableId = `week-${week}-${dayId}-${pairId}-${unitCode}`;
//   const { isOver, setNodeRef } = useDroppable({
//     id: droppableId,
//     data: { week, dayId, pairId, unitCode },
//     disabled: !isEditMode,
//   });

//   let bg = "";
//   if (isEditMode) {
//     if (status === "free") bg = "bg-green-100";
//     else if (status === "conflict") bg = "bg-red-100";
//     else if (status === "swap") bg = "bg-blue-100";
//     if (isOver) bg += " ring-2 ring-blue-500";
//   } else {
//     if (entry) {
//       bg = week % 2 === 1 ? "bg-green-50" : "bg-amber-50";
//     }
//   }

//   const entryBg = entry
//     ? week % 2 === 1
//       ? "bg-green-100 border border-green-200"
//       : "bg-amber-100 border border-amber-200"
//     : "";

//   return (
//     <div
//       ref={setNodeRef}
//       className={`text-xs p-1 rounded leading-tight border ${bg} ${isEditMode ? "min-h-[1.5rem]" : ""}`}
//       onClick={() => entry && isEditMode && onCellClick(entry)}
//     >
//       {entry ? (
//         <div className={`flex items-center gap-1 p-1 rounded ${entryBg}`}>
//           <span className="text-gray-500 font-mono text-[10px]">
//             {week % 2 === 1 ? "н." : "ч."}
//           </span>
//           <DraggableLesson entry={entry} isEditMode={isEditMode} />
//         </div>
//       ) : (
//         <span className="text-gray-300 text-xs">—</span>
//       )}
//     </div>
//   );
// }

// export default function AdminSchedulePage() {
//   const [weekBase, setWeekBase] = useState(1);
//   const [viewMode, setViewMode] = useState<"units" | "groups">("units");
//   const [editMode, setEditMode] = useState(false);
//   const [selectedEntry, setSelectedEntry] = useState<ScheduleRow | null>(null);
//   const [flagForm, setFlagForm] = useState({ mergeNumber: 0, positionFlag: false, classroomFlag: false });
//   const [activeDragEntry, setActiveDragEntry] = useState<ScheduleRow | null>(null);
//   const [slotStatuses, setSlotStatuses] = useState<Record<string, "free" | "conflict" | "swap">>({});
//   const [slotSwapIds, setSlotSwapIds] = useState<Record<string, number>>({});

//   const utils = trpc.useUtils();

//   const { data: unitsData } = trpc.scheduleDisplay.getForWeekPair.useQuery(
//     { weekBase },
//     { enabled: !!weekBase && viewMode === "units" }
//   );
//   const { data: groupsData } = trpc.scheduleDisplay.getByStudyGroups.useQuery(
//     { weekBase },
//     { enabled: !!weekBase && viewMode === "groups" }
//   );

//   const checkSlots = trpc.scheduleDisplay.checkSlots.useMutation();
//   const moveMutation = trpc.scheduleDisplay.move.useMutation();
//   const swapMutation = trpc.scheduleDisplay.swap.useMutation();
//   const updateFlags = trpc.scheduleDisplay.updateFlags.useMutation();

//   const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

//   const refreshSlotStatuses = useCallback(
//     async (entry: ScheduleRow) => {
//       if (!unitsData) return;
//       const days = unitsData.days;
//       const pairs = unitsData.pairs;
//       const unitCodes = Array.from(new Set(unitsData.rows.map((r) => r.unitCode))).sort();
//       const slots: { week: number; dayId: number; pairId: number; unitCode: string }[] = [];
//       for (const week of [weekBase, weekBase + 1]) {
//         for (const day of days) {
//           for (const pair of pairs) {
//             for (const unitCode of unitCodes) {
//               slots.push({ week, dayId: day.id, pairId: pair.id, unitCode });
//             }
//           }
//         }
//       }
//       const result = await checkSlots.mutateAsync({ movingId: entry.id, slots });
//       const newStatuses: Record<string, "free" | "conflict" | "swap"> = {};
//       const newSwapIds: Record<string, number> = {};
//       for (const [key, val] of Object.entries(result)) {
//         newStatuses[key] = val.status as any;
//         if (val.status === 'swap' && val.swapId) newSwapIds[key] = val.swapId;
//       }
//       setSlotStatuses(newStatuses);
//       setSlotSwapIds(newSwapIds);
//     },
//     [unitsData, weekBase, checkSlots]
//   );

//   const handleDragStart = (event: DragStartEvent) => {
//     const entry = event.active.data.current?.entry as ScheduleRow;
//     if (entry) {
//       setActiveDragEntry(entry);
//       refreshSlotStatuses(entry);
//     }
//   };

//   const handleDragEnd = async (event: DragEndEvent) => {
//     const { active, over } = event;
//     setActiveDragEntry(null);
//     setSlotStatuses({});
//     setSlotSwapIds({});
//     if (!over || !active.data.current?.entry) return;
//     const entry = active.data.current.entry as ScheduleRow;
//     const targetId = over.id as string;
//     const parts = targetId.split("-");
//     if (parts.length < 5 || parts[0] !== "week") return;
//     const targetWeek = parseInt(parts[1], 10);
//     const targetDayId = parseInt(parts[2], 10);
//     const targetPairId = parseInt(parts[3], 10);
//     const targetUnitCode = parts.slice(4).join("-");
//     const status = slotStatuses[targetId];
//     if (!status) return;
//     try {
//       if (status === "free") {
//         await moveMutation.mutateAsync({ id: entry.id, targetWeek, targetDayId, targetPairId, targetUnitCode });
//       } else if (status === "swap") {
//         const swapId = slotSwapIds[targetId];
//         if (!swapId) { alert("Занятие для обмена не найдено"); return; }
//         await swapMutation.mutateAsync({ id1: entry.id, id2: swapId });
//       }
//       utils.scheduleDisplay.getForWeekPair.invalidate({ weekBase });
//     } catch (e: any) { alert(e.message); }
//   };

//   const openFlagEditor = (entry: ScheduleRow) => {
//     setSelectedEntry(entry);
//     setFlagForm({ mergeNumber: entry.mergeNumber, positionFlag: entry.positionFlag, classroomFlag: entry.classroomFlag });
//   };

//   const saveFlags = async () => {
//     if (!selectedEntry) return;
//     await updateFlags.mutateAsync({ id: selectedEntry.id, ...flagForm });
//     setSelectedEntry(null);
//     utils.scheduleDisplay.getForWeekPair.invalidate({ weekBase });
//   };

//   // Печать (открытие в новом окне)
//   const handlePrint = () => {
//     const tableElement = document.getElementById("schedule-table");
//     if (!tableElement) return;
//     const styles = document.querySelectorAll("style, link[rel=stylesheet]");
//     let stylesHtml = "";
//     styles.forEach(s => stylesHtml += s.outerHTML);
//     const printWindow = window.open("", "_blank", "width=1200,height=800");
//     if (!printWindow) return;
//     printWindow.document.write(`
//       <html>
//         <head>
//           <title>Расписание (нед. ${weekBase}–${weekBase + 1})</title>
//           ${stylesHtml}
//         </head>
//         <body class="p-4">
//           <h1 class="text-xl font-bold mb-4">Расписание (нед. ${weekBase}–${weekBase + 1})</h1>
//           ${tableElement.outerHTML}
//         </body>
//       </html>
//     `);
//     printWindow.document.close();
//     printWindow.focus();
//     printWindow.print();
//     printWindow.close();
//   };

//   // CSV
//   const handleCSV = () => {
//     const rows: any[] = [];
//     const header = ["День", "Пара"];

//     if (viewMode === "units" && unitsData) {
//       const unitCodes = Array.from(new Set(unitsData.rows.map(r => r.unitCode))).sort();
//       unitCodes.forEach(code => header.push(`${code} (неч)`, `${code} (чёт)`));
//       rows.push(header);
//       const days = unitsData.days;
//       const pairs = unitsData.pairs;
//       for (const day of days) {
//         for (const pair of pairs) {
//           const row: string[] = [day.name, String(pair.number)];
//           for (const code of unitCodes) {
//             const odd = unitsData.rows.find(r => r.unitCode === code && r.dayOfWeekId === day.id && r.pairNumberId === pair.id && r.weekNumber === weekBase);
//             const even = unitsData.rows.find(r => r.unitCode === code && r.dayOfWeekId === day.id && r.pairNumberId === pair.id && r.weekNumber === weekBase + 1);
//             row.push(odd?.displayText ?? "", even?.displayText ?? "");
//           }
//           rows.push(row);
//         }
//       }
//     } else if (viewMode === "groups" && groupsData) {
//       const groupCodes = Array.from(new Set(groupsData.rows.map(r => r.studyGroupCode))).sort();
//       groupCodes.forEach(code => header.push(`${code} (неч)`, `${code} (чёт)`));
//       rows.push(header);
//       const days = groupsData.days;
//       const pairs = groupsData.pairs;
//       for (const day of days) {
//         for (const pair of pairs) {
//           const row: string[] = [day.name, String(pair.number)];
//           for (const code of groupCodes) {
//             const odd = groupsData.rows.find(r => r.studyGroupCode === code && r.dayOfWeekId === day.id && r.pairNumberId === pair.id && r.weekNumber === weekBase);
//             const even = groupsData.rows.find(r => r.studyGroupCode === code && r.dayOfWeekId === day.id && r.pairNumberId === pair.id && r.weekNumber === weekBase + 1);
//             row.push(odd?.displayText ?? "", even?.displayText ?? "");
//           }
//           rows.push(row);
//         }
//       }
//     }

//     const BOM = "\uFEFF";
//     const csvContent = "data:text/csv;charset=utf-8," + BOM + rows.map(r => r.join(";")).join("\n");
//     const link = document.createElement("a");
//     link.setAttribute("href", encodeURI(csvContent));
//     link.setAttribute("download", `schedule_week${weekBase}.csv`);
//     document.body.appendChild(link);
//     link.click();
//     link.remove();
//   };

//   if (viewMode === "units" && !unitsData) return <div className="p-6">Загрузка...</div>;
//   if (viewMode === "groups" && !groupsData) return <div className="p-6">Загрузка...</div>;

//   return (
//     <div className="p-4">
//       <h1 className="text-xl font-bold mb-4">Расписание</h1>

//       <div className="flex flex-wrap gap-4 mb-4 p-3 bg-gray-50 rounded border text-sm">
//         <div className="flex items-center gap-2"><span className="inline-block w-4 h-4 rounded bg-green-100 border border-green-200"></span> Нечётная неделя</div>
//         <div className="flex items-center gap-2"><span className="inline-block w-4 h-4 rounded bg-amber-100 border border-amber-200"></span> Чётная неделя</div>
//         {editMode && (
//           <>
//             <div className="flex items-center gap-2"><span className="inline-block w-4 h-4 rounded bg-green-300 border border-green-400"></span> Свободно</div>
//             <div className="flex items-center gap-2"><span className="inline-block w-4 h-4 rounded bg-red-300 border border-red-400"></span> Конфликт</div>
//             <div className="flex items-center gap-2"><span className="inline-block w-4 h-4 rounded bg-blue-300 border border-blue-400"></span> Обмен</div>
//           </>
//         )}
//       </div>

//       <div className="flex gap-4 mb-4">
//         <button onClick={() => setViewMode("units")} className={viewMode === "units" ? "font-bold border-b-2 border-blue-500" : ""}>По юнитам</button>
//         <button onClick={() => setViewMode("groups")} className={viewMode === "groups" ? "font-bold border-b-2 border-blue-500" : ""}>По группам</button>
//         <button onClick={handlePrint} className="bg-blue-600 text-white px-3 py-1 rounded ml-2">🖨️ Печать</button>
//         <button onClick={handleCSV} className="bg-green-600 text-white px-3 py-1 rounded ml-2">📥 CSV</button>
//         {viewMode === "units" && (
//           <button onClick={() => setEditMode(!editMode)} className="ml-auto bg-blue-500 text-white px-3 py-1 rounded">
//             {editMode ? "Завершить редактирование" : "Редактировать"}
//           </button>
//         )}
//       </div>

//       <div className="flex items-center gap-2 mb-4">
//         <label className="font-medium">Нечётная неделя:</label>
//         <input type="number" value={weekBase} onChange={(e) => setWeekBase(Number(e.target.value))} className="border rounded px-2 py-1 w-20" min={1} step={2} />
//         <span className="text-sm text-gray-500">(показаны нечётная {weekBase} и чётная {weekBase + 1})</span>
//       </div>

//       <div id="schedule-table">
//         {viewMode === "units" && unitsData && (
//           <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
//             <div className="overflow-x-auto border border-gray-300 rounded-md">
//               <table className="border-collapse text-sm w-full">
//                 <thead>
//                   <tr className="bg-gray-100">
//                     <th className="sticky left-0 z-20 bg-gray-100 border border-gray-400 p-2 w-[70px] min-w-[70px]">День</th>
//                     <th className="sticky left-[70px] z-20 bg-gray-100 border border-gray-400 p-2 w-[50px] min-w-[50px]">Пара</th>
//                     {Array.from(new Set(unitsData.rows.map((r) => r.unitCode))).sort().map((code) => (
//                       <th key={code} className="border border-gray-400 p-2 bg-blue-50 whitespace-nowrap min-w-[180px]">{code}</th>
//                     ))}
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {unitsData.days.map((day) =>
//                     unitsData.pairs.map((pair, pairIdx) => {
//                       const isFirstPairOfDay = pairIdx === 0;
//                       return (
//                         <tr key={`${day.id}-${pair.id}`}>
//                           {isFirstPairOfDay && (
//                             <td rowSpan={unitsData.pairs.length} className="sticky left-0 z-10 bg-white border border-gray-400 p-2 font-medium text-center align-top" style={{ backgroundColor: "#fff" }}>
//                               {day.name}
//                             </td>
//                           )}
//                           <td className="sticky left-[70px] z-10 bg-white border border-gray-400 p-2 text-center align-top">{pair.number}</td>
//                           {Array.from(new Set(unitsData.rows.map((r) => r.unitCode))).sort().map((code) => {
//                             const oddEntry = unitsData.rows.find(
//                               (r) => r.unitCode === code && r.dayOfWeekId === day.id && r.pairNumberId === pair.id && r.weekNumber === weekBase
//                             );
//                             const evenEntry = unitsData.rows.find(
//                               (r) => r.unitCode === code && r.dayOfWeekId === day.id && r.pairNumberId === pair.id && r.weekNumber === weekBase + 1
//                             );
//                             return (
//                               <td key={`${day.id}-${pair.id}-${code}`} className="border border-gray-300 p-1 min-w-[180px] align-top">
//                                 <div className="flex flex-col gap-1">
//                                   <DroppableArea
//                                     week={weekBase}
//                                     dayId={day.id}
//                                     pairId={pair.id}
//                                     unitCode={code}
//                                     entry={oddEntry}
//                                     isEditMode={editMode}
//                                     status={slotStatuses[`week-${weekBase}-${day.id}-${pair.id}-${code}`] ?? null}
//                                     onCellClick={openFlagEditor}
//                                   />
//                                   <DroppableArea
//                                     week={weekBase + 1}
//                                     dayId={day.id}
//                                     pairId={pair.id}
//                                     unitCode={code}
//                                     entry={evenEntry}
//                                     isEditMode={editMode}
//                                     status={slotStatuses[`week-${weekBase + 1}-${day.id}-${pair.id}-${code}`] ?? null}
//                                     onCellClick={openFlagEditor}
//                                   />
//                                 </div>
//                               </td>
//                             );
//                           })}
//                         </tr>
//                       );
//                     })
//                   )}
//                 </tbody>
//               </table>
//             </div>
//             <DragOverlay>
//               {activeDragEntry ? (
//                 <div className="bg-white border shadow p-2 rounded text-xs">{activeDragEntry.displayText}</div>
//               ) : null}
//             </DragOverlay>
//           </DndContext>
//         )}

//         {viewMode === "groups" && groupsData && (
//       <div className="overflow-x-auto border border-gray-300 rounded-md">
//         <table className="border-collapse text-sm w-full">
//           <thead>
//             <tr className="bg-gray-100">
//               <th className="sticky left-0 z-20 bg-gray-100 border border-gray-400 p-2 w-[70px] min-w-[70px]">День</th>
//               <th className="sticky left-[70px] z-20 bg-gray-100 border border-gray-400 p-2 w-[50px] min-w-[50px]">Пара</th>
//               {Array.from(new Set(groupsData.rows.map((r: any) => r.studyGroupCode))).sort().map((code) => (
//                 <th key={code} className="border border-gray-400 p-2 bg-blue-50 whitespace-nowrap min-w-[180px]">
//                   {code}
//                 </th>
//               ))}
//             </tr>
//           </thead>
//           <tbody>
//             {groupsData.days.map((day: Day) =>
//               groupsData.pairs.map((pair: Pair, pairIdx: number) => {
//                 const isFirstPairOfDay = pairIdx === 0;
//                 return (
//                   <tr key={`${day.id}-${pair.id}`}>
//                     {isFirstPairOfDay && (
//                       <td
//                         rowSpan={groupsData.pairs.length}
//                         className="sticky left-0 z-10 bg-white border border-gray-400 p-2 font-medium text-center align-top"
//                         style={{ backgroundColor: "#fff" }}
//                       >
//                         {day.name}
//                       </td>
//                     )}
//                     <td className="sticky left-[70px] z-10 bg-white border border-gray-400 p-2 text-center align-top">
//                       {pair.number}
//                     </td>
//                     {Array.from(new Set(groupsData.rows.map((r: any) => r.studyGroupCode))).sort().map((code) => {
//                       // Для каждой группы берём занятия на обе недели
//                       const oddEntry = groupsData.rows.find(
//                         (r: any) =>
//                           r.studyGroupCode === code &&
//                           r.dayOfWeekId === day.id &&
//                           r.pairNumberId === pair.id &&
//                           r.weekNumber === weekBase
//                       );
//                       const evenEntry = groupsData.rows.find(
//                         (r: any) =>
//                           r.studyGroupCode === code &&
//                           r.dayOfWeekId === day.id &&
//                           r.pairNumberId === pair.id &&
//                           r.weekNumber === weekBase + 1
//                       );

//                       return (
//                         <td key={code} className="border border-gray-300 p-1 min-w-[180px] align-top">
//                           <div className="flex flex-col gap-1">
//                             {/* Нечётная неделя */}
//                             <div
//                               className={`text-xs p-1 rounded leading-tight border ${
//                                 oddEntry
//                                   ? "bg-green-50 border-green-200"
//                                   : "border-dashed border-gray-200"
//                               }`}
//                             >
//                               {oddEntry ? (
//                                 <div className="flex items-center gap-1">
//                                   <span className="text-gray-500 font-mono text-[10px]">н.</span>
//                                   <span className="truncate">{oddEntry.displayText}</span>
//                                 </div>
//                               ) : (
//                                 <span className="text-gray-300">—</span>
//                               )}
//                             </div>
//                             {/* Чётная неделя */}
//                             <div
//                               className={`text-xs p-1 rounded leading-tight border ${
//                                 evenEntry
//                                   ? "bg-amber-50 border-amber-200"
//                                   : "border-dashed border-gray-200"
//                               }`}
//                             >
//                               {evenEntry ? (
//                                 <div className="flex items-center gap-1">
//                                   <span className="text-gray-500 font-mono text-[10px]">ч.</span>
//                                   <span className="truncate">{evenEntry.displayText}</span>
//                                 </div>
//                               ) : (
//                                 <span className="text-gray-300">—</span>
//                               )}
//                             </div>
//                           </div>
//                         </td>
//                       );
//                     })}
//                   </tr>
//                 );
//               })
//             )}
//           </tbody>
//         </table>
//       </div>
//     )}
//       </div>

//       {selectedEntry && (
//         <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
//           <div className="bg-white p-6 rounded shadow-lg w-80">
//             <h2 className="font-bold mb-4">Редактирование занятия</h2>
//             <div className="text-sm mb-2">{selectedEntry.displayText}</div>
//             <label className="block mb-2">
//               Номер слияния:
//               <input type="number" value={flagForm.mergeNumber} onChange={(e) => setFlagForm({ ...flagForm, mergeNumber: +e.target.value })} className="border rounded px-2 py-1 w-full" />
//             </label>
//             <label className="block mb-2">
//               <input type="checkbox" checked={flagForm.positionFlag} onChange={(e) => setFlagForm({ ...flagForm, positionFlag: e.target.checked })} />
//               <span className="ml-2">Position flag</span>
//             </label>
//             <label className="block mb-4">
//               <input type="checkbox" checked={flagForm.classroomFlag} onChange={(e) => setFlagForm({ ...flagForm, classroomFlag: e.target.checked })} />
//               <span className="ml-2">Classroom flag</span>
//             </label>
//             <div className="flex justify-end gap-2">
//               <button onClick={() => setSelectedEntry(null)} className="bg-gray-300 px-3 py-1 rounded">Отмена</button>
//               <button onClick={saveFlags} className="bg-blue-500 text-white px-3 py-1 rounded">Сохранить</button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }















// <div id="schedule-table">
//         {viewMode === "units" && unitsData && (
//           <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
//             <div className="overflow-x-auto border border-gray-300 rounded-md">
//               <table className="border-collapse text-sm w-full">
//                 <thead>
//                   <tr className="bg-gray-100">
//                     <th className="sticky left-0 z-20 bg-gray-100 border border-gray-400 p-2 w-[70px] min-w-[70px]">День</th>
//                     <th className="sticky left-[70px] z-20 bg-gray-100 border border-gray-400 p-2 w-[50px] min-w-[50px]">Пара</th>
//                     {Array.from(new Set(unitsData.rows.map((r) => r.unitCode))).sort().map((code) => (
//                       <th key={code} className="border border-gray-400 p-2 bg-blue-50 whitespace-nowrap min-w-[180px]">{code}</th>
//                     ))}
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {unitsData.days.map((day) =>
//                     unitsData.pairs.map((pair, pairIdx) => {
//                       const isFirstPairOfDay = pairIdx === 0;
//                       return (
//                         <tr key={`${day.id}-${pair.id}`}>
//                           {isFirstPairOfDay && (
//                             <td rowSpan={unitsData.pairs.length} className="sticky left-0 z-10 bg-white border border-gray-400 p-2 font-medium text-center align-top" style={{ backgroundColor: "#fff" }}>
//                               {day.name}
//                             </td>
//                           )}
//                           <td className="sticky left-[70px] z-10 bg-white border border-gray-400 p-2 text-center align-top">{pair.number}</td>
//                           {Array.from(new Set(unitsData.rows.map((r) => r.unitCode))).sort().map((code) => {
//                             const oddEntry = unitsData.rows.find(
//                               (r) => r.unitCode === code && r.dayOfWeekId === day.id && r.pairNumberId === pair.id && r.weekNumber === weekBase
//                             );
//                             const evenEntry = unitsData.rows.find(
//                               (r) => r.unitCode === code && r.dayOfWeekId === day.id && r.pairNumberId === pair.id && r.weekNumber === weekBase + 1
//                             );
//                             return (
//                               <td key={`${day.id}-${pair.id}-${code}`} className="border border-gray-300 p-1 min-w-[180px] align-top">
//                                 <div className="flex flex-col gap-1">
//                                   <DroppableArea
//                                     week={weekBase}
//                                     dayId={day.id}
//                                     pairId={pair.id}
//                                     unitCode={code}
//                                     entry={oddEntry}
//                                     isEditMode={editMode}
//                                     status={slotStatuses[`week-${weekBase}-${day.id}-${pair.id}-${code}`] ?? null}
//                                     onCellClick={openFlagEditor}
//                                   />
//                                   <DroppableArea
//                                     week={weekBase + 1}
//                                     dayId={day.id}
//                                     pairId={pair.id}
//                                     unitCode={code}
//                                     entry={evenEntry}
//                                     isEditMode={editMode}
//                                     status={slotStatuses[`week-${weekBase + 1}-${day.id}-${pair.id}-${code}`] ?? null}
//                                     onCellClick={openFlagEditor}
//                                   />
//                                 </div>
//                               </td>
//                             );
//                           })}
//                         </tr>
//                       );
//                     })
//                   )}
//                 </tbody>
//               </table>
//             </div>
//             <DragOverlay>
//               {activeDragEntry ? (
//                 <div className="bg-white border shadow p-2 rounded text-xs">{activeDragEntry.displayText}</div>
//               ) : null}
//             </DragOverlay>
//           </DndContext>
//         )}

//         {viewMode === "groups" && groupsData && (
//       <div className="overflow-x-auto border border-gray-300 rounded-md">
//         <table className="border-collapse text-sm w-full">
//           <thead>
//             <tr className="bg-gray-100">
//               <th className="sticky left-0 z-20 bg-gray-100 border border-gray-400 p-2 w-[70px] min-w-[70px]">День</th>
//               <th className="sticky left-[70px] z-20 bg-gray-100 border border-gray-400 p-2 w-[50px] min-w-[50px]">Пара</th>
//               {Array.from(new Set(groupsData.rows.map((r: any) => r.studyGroupCode))).sort().map((code) => (
//                 <th key={code} className="border border-gray-400 p-2 bg-blue-50 whitespace-nowrap min-w-[180px]">
//                   {code}
//                 </th>
//               ))}
//             </tr>
//           </thead>
//           <tbody>
//             {groupsData.days.map((day: Day) =>
//               groupsData.pairs.map((pair: Pair, pairIdx: number) => {
//                 const isFirstPairOfDay = pairIdx === 0;
//                 return (
//                   <tr key={`${day.id}-${pair.id}`}>
//                     {isFirstPairOfDay && (
//                       <td
//                         rowSpan={groupsData.pairs.length}
//                         className="sticky left-0 z-10 bg-white border border-gray-400 p-2 font-medium text-center align-top"
//                         style={{ backgroundColor: "#fff" }}
//                       >
//                         {day.name}
//                       </td>
//                     )}
//                     <td className="sticky left-[70px] z-10 bg-white border border-gray-400 p-2 text-center align-top">
//                       {pair.number}
//                     </td>
//                     {Array.from(new Set(groupsData.rows.map((r: any) => r.studyGroupCode))).sort().map((code) => {
//                       // Для каждой группы берём занятия на обе недели
//                       const oddEntry = groupsData.rows.find(
//                         (r: any) =>
//                           r.studyGroupCode === code &&
//                           r.dayOfWeekId === day.id &&
//                           r.pairNumberId === pair.id &&
//                           r.weekNumber === weekBase
//                       );
//                       const evenEntry = groupsData.rows.find(
//                         (r: any) =>
//                           r.studyGroupCode === code &&
//                           r.dayOfWeekId === day.id &&
//                           r.pairNumberId === pair.id &&
//                           r.weekNumber === weekBase + 1
//                       );

//                       return (
//                         <td key={code} className="border border-gray-300 p-1 min-w-[180px] align-top">
//                           <div className="flex flex-col gap-1">
//                             {/* Нечётная неделя */}
//                             <div
//                               className={`text-xs p-1 rounded leading-tight border ${
//                                 oddEntry
//                                   ? "bg-green-50 border-green-200"
//                                   : "border-dashed border-gray-200"
//                               }`}
//                             >
//                               {oddEntry ? (
//                                 <div className="flex items-center gap-1">
//                                   <span className="text-gray-500 font-mono text-[10px]">н.</span>
//                                   <span className="truncate">{oddEntry.displayText}</span>
//                                 </div>
//                               ) : (
//                                 <span className="text-gray-300">—</span>
//                               )}
//                             </div>
//                             {/* Чётная неделя */}
//                             <div
//                               className={`text-xs p-1 rounded leading-tight border ${
//                                 evenEntry
//                                   ? "bg-amber-50 border-amber-200"
//                                   : "border-dashed border-gray-200"
//                               }`}
//                             >
//                               {evenEntry ? (
//                                 <div className="flex items-center gap-1">
//                                   <span className="text-gray-500 font-mono text-[10px]">ч.</span>
//                                   <span className="truncate">{evenEntry.displayText}</span>
//                                 </div>
//                               ) : (
//                                 <span className="text-gray-300">—</span>
//                               )}
//                             </div>
//                           </div>
//                         </td>
//                       );
//                     })}
//                   </tr>
//                 );
//               })
//             )}
//           </tbody>
//         </table>
//       </div>
//     )}
//       </div>



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

// Draggable элемент
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
      }`}
      style={style}
    >
      {entry.displayText}
    </div>
  );
}

// Droppable зона внутри ячейки (одна неделя)
function DroppableArea({
  week,
  dayId,
  pairId,
  unitCode,
  entry,
  isEditMode,
  status,
  onCellClick,
}: {
  week: number;
  dayId: number;
  pairId: number;
  unitCode: string;
  entry: ScheduleRow | undefined;
  isEditMode: boolean;
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
    if (status === "free") bg = "bg-green-100";
    else if (status === "conflict") bg = "bg-red-100";
    else if (status === "swap") bg = "bg-blue-100";
    if (isOver) bg += " ring-2 ring-blue-500";
  } else {
    if (entry) {
      bg = week % 2 === 1 ? "bg-green-50" : "bg-amber-50";
    }
  }

  const entryBg = entry
    ? week % 2 === 1
      ? "bg-green-100 border border-green-200"
      : "bg-amber-100 border border-amber-200"
    : "";

  return (
    <div
      ref={setNodeRef}
      className={`text-xs p-1 rounded leading-tight border ${bg} ${isEditMode ? "min-h-[1.5rem]" : ""}`}
      onClick={() => entry && isEditMode && onCellClick(entry)}
    >
      {entry ? (
        <div className={`flex items-center gap-1 p-1 rounded ${entryBg}`}>
          <span className="text-gray-500 font-mono text-[10px]">
            {week % 2 === 1 ? "н." : "ч."}
          </span>
          <DraggableLesson entry={entry} isEditMode={isEditMode} />
        </div>
      ) : (
        <span className="text-gray-300 text-xs">—</span>
      )}
    </div>
  );
}

// Основной компонент
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

  const checkSlots = trpc.scheduleDisplay.checkSlots.useMutation();
  const moveMutation = trpc.scheduleDisplay.move.useMutation();
  const swapMutation = trpc.scheduleDisplay.swap.useMutation();
  const updateFlags = trpc.scheduleDisplay.updateFlags.useMutation();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const refreshSlotStatuses = useCallback(
    async (entry: ScheduleRow) => {
      if (!unitsData) return;
      const days = unitsData.days;
      const pairs = unitsData.pairs;

      // Только тот же unitCode, что у перемещаемого занятия
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
      setSlotSwapIds(newSwapIds);
    },
    [unitsData, checkSlots]
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
    const parts = targetId.split("-");
    if (parts.length < 5 || parts[0] !== "week") return;
    const targetWeek = parseInt(parts[1], 10);
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
        await moveMutation.mutateAsync({ id: entry.id, targetWeek, targetDayId, targetPairId, targetUnitCode });
      } else if (status === "swap") {
        const swapId = slotSwapIds[targetId];
        if (!swapId) { alert("Занятие для обмена не найдено"); return; }
        await swapMutation.mutateAsync({ id1: entry.id, id2: swapId });
      }
      utils.scheduleDisplay.getForWeekPair.invalidate({ weekBase });
      if (viewMode === "groups") utils.scheduleDisplay.getByStudyGroups.invalidate({ weekBase });
    } catch (e: any) { alert(e.message); }
  };

  const openFlagEditor = (entry: ScheduleRow) => {
    setSelectedEntry(entry);
    setFlagForm({ mergeNumber: entry.mergeNumber, positionFlag: entry.positionFlag, classroomFlag: entry.classroomFlag });
  };

  const saveFlags = async () => {
    if (!selectedEntry) return;
    await updateFlags.mutateAsync({ id: selectedEntry.id, ...flagForm });
    setSelectedEntry(null);
    utils.scheduleDisplay.getForWeekPair.invalidate({ weekBase });
  };

  // Экспорт и печать
  const handlePrint = () => {
    const tableElement = document.getElementById("schedule-table");
    if (!tableElement) return;
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
        </head>
        <body class="p-4">
          <h1 class="text-xl font-bold mb-4">Расписание (нед. ${weekBase}–${weekBase + 1})</h1>
          ${tableElement.outerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const handleCSV = () => {
    const rows: any[] = [];
    const header = ["День", "Пара"];

    if (viewMode === "units" && unitsData) {
      const unitCodes = Array.from(new Set(unitsData.rows.map(r => r.unitCode))).sort();
      unitCodes.forEach(code => header.push(`${code} (неч)`, `${code} (чёт)`));
      rows.push(header);
      const days = unitsData.days;
      const pairs = unitsData.pairs;
      for (const day of days) {
        for (const pair of pairs) {
          const row: string[] = [day.name, String(pair.number)];
          for (const code of unitCodes) {
            const odd = unitsData.rows.find(r => r.unitCode === code && r.dayOfWeekId === day.id && r.pairNumberId === pair.id && r.weekNumber === weekBase);
            const even = unitsData.rows.find(r => r.unitCode === code && r.dayOfWeekId === day.id && r.pairNumberId === pair.id && r.weekNumber === weekBase + 1);
            row.push(odd?.displayText ?? "", even?.displayText ?? "");
          }
          rows.push(row);
        }
      }
    } else if (viewMode === "groups" && groupsData) {
      const groupCodes = Array.from(new Set(groupsData.rows.map(r => r.studyGroupCode))).sort();
      groupCodes.forEach(code => header.push(`${code} (неч)`, `${code} (чёт)`));
      rows.push(header);
      const days = groupsData.days;
      const pairs = groupsData.pairs;
      for (const day of days) {
        for (const pair of pairs) {
          const row: string[] = [day.name, String(pair.number)];
          for (const code of groupCodes) {
            const odd = groupsData.rows.find(r => r.studyGroupCode === code && r.dayOfWeekId === day.id && r.pairNumberId === pair.id && r.weekNumber === weekBase);
            const even = groupsData.rows.find(r => r.studyGroupCode === code && r.dayOfWeekId === day.id && r.pairNumberId === pair.id && r.weekNumber === weekBase + 1);
            row.push(odd?.displayText ?? "", even?.displayText ?? "");
          }
          rows.push(row);
        }
      }
    }

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(r => r.join(";")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `schedule_week${weekBase}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  if (viewMode === "units" && unitsLoading) return <div className="p-6">Загрузка...</div>;
  if (viewMode === "groups" && groupsLoading) return <div className="p-6">Загрузка...</div>;

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Расписание</h1>

      <div className="flex flex-wrap gap-4 mb-4 p-3 bg-gray-50 rounded border text-sm">
        <div className="flex items-center gap-2"><span className="inline-block w-4 h-4 rounded bg-green-100 border border-green-200"></span> Нечётная неделя</div>
        <div className="flex items-center gap-2"><span className="inline-block w-4 h-4 rounded bg-amber-100 border border-amber-200"></span> Чётная неделя</div>
        {editMode && (
          <>
            <div className="flex items-center gap-2"><span className="inline-block w-4 h-4 rounded bg-green-300 border border-green-400"></span> Свободно</div>
            <div className="flex items-center gap-2"><span className="inline-block w-4 h-4 rounded bg-red-300 border border-red-400"></span> Конфликт</div>
            <div className="flex items-center gap-2"><span className="inline-block w-4 h-4 rounded bg-blue-300 border border-blue-400"></span> Обмен</div>
          </>
        )}
      </div>

      <div className="flex gap-4 mb-4">
        <button onClick={() => setViewMode("units")} className={viewMode === "units" ? "font-bold border-b-2 border-blue-500" : ""}>По юнитам</button>
        <button onClick={() => setViewMode("groups")} className={viewMode === "groups" ? "font-bold border-b-2 border-blue-500" : ""}>По группам</button>
        <button onClick={handlePrint} className="bg-blue-600 text-white px-3 py-1 rounded ml-2">🖨️ Печать</button>
        <button onClick={handleCSV} className="bg-green-600 text-white px-3 py-1 rounded ml-2">📥 CSV</button>
        {viewMode === "units" && (
          <button onClick={() => setEditMode(!editMode)} className="ml-auto bg-blue-500 text-white px-3 py-1 rounded">
            {editMode ? "Завершить редактирование" : "Редактировать"}
          </button>
        )}
      </div>

      <div id="schedule-table">
        {viewMode === "units" && unitsData && (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="overflow-x-auto border border-gray-300 rounded-md">
              <table className="border-collapse text-sm w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="sticky left-0 z-20 bg-gray-100 border border-gray-400 p-2 w-[70px] min-w-[70px]">День</th>
                    <th className="sticky left-[70px] z-20 bg-gray-100 border border-gray-400 p-2 w-[50px] min-w-[50px]">Пара</th>
                    {Array.from(new Set(unitsData.rows.map((r) => r.unitCode))).sort().map((code) => (
                      <th key={code} className="border border-gray-400 p-2 bg-blue-50 whitespace-nowrap min-w-[180px]">{code}</th>
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
                            <td rowSpan={unitsData.pairs.length} className="sticky left-0 z-10 bg-white border border-gray-400 p-2 font-medium text-center align-top" style={{ backgroundColor: "#fff" }}>
                              {day.name}
                            </td>
                          )}
                          <td className="sticky left-[70px] z-10 bg-white border border-gray-400 p-2 text-center align-top">{pair.number}</td>
                          {Array.from(new Set(unitsData.rows.map((r) => r.unitCode))).sort().map((code) => {
                            const oddEntry = unitsData.rows.find(
                              (r) => r.unitCode === code && r.dayOfWeekId === day.id && r.pairNumberId === pair.id && r.weekNumber === weekBase
                            );
                            const evenEntry = unitsData.rows.find(
                              (r) => r.unitCode === code && r.dayOfWeekId === day.id && r.pairNumberId === pair.id && r.weekNumber === weekBase + 1
                            );
                            return (
                              <td key={`${day.id}-${pair.id}-${code}`} className="border border-gray-300 p-1 min-w-[180px] align-top">
                                <div className="flex flex-col gap-1">
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
            <DragOverlay>
              {activeDragEntry ? (
                <div className="bg-white border shadow p-2 rounded text-xs">{activeDragEntry.displayText}</div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

        {viewMode === "groups" && groupsData && (
          <div className="overflow-x-auto border border-gray-300 rounded-md">
            <table className="border-collapse text-sm w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="sticky left-0 z-20 bg-gray-100 border border-gray-400 p-2 w-[70px] min-w-[70px]">День</th>
                  <th className="sticky left-[70px] z-20 bg-gray-100 border border-gray-400 p-2 w-[50px] min-w-[50px]">Пара</th>
                  {Array.from(new Set(groupsData.rows.map((r: any) => r.studyGroupCode))).sort().map((code) => (
                    <th key={code} className="border border-gray-400 p-2 bg-blue-50 whitespace-nowrap min-w-[180px]">
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
                            className="sticky left-0 z-10 bg-white border border-gray-400 p-2 font-medium text-center align-top"
                            style={{ backgroundColor: "#fff" }}
                          >
                            {day.name}
                          </td>
                        )}
                        <td className="sticky left-[70px] z-10 bg-white border border-gray-400 p-2 text-center align-top">
                          {pair.number}
                        </td>
                        {Array.from(new Set(groupsData.rows.map((r: any) => r.studyGroupCode))).sort().map((code) => {
                          const oddEntry = groupsData.rows.find(
                            (r: any) =>
                              r.studyGroupCode === code &&
                              r.dayOfWeekId === day.id &&
                              r.pairNumberId === pair.id &&
                              r.weekNumber === weekBase
                          );
                          const evenEntry = groupsData.rows.find(
                            (r: any) =>
                              r.studyGroupCode === code &&
                              r.dayOfWeekId === day.id &&
                              r.pairNumberId === pair.id &&
                              r.weekNumber === weekBase + 1
                          );

                          return (
                            <td key={code} className="border border-gray-300 p-1 min-w-[180px] align-top">
                              <div className="flex flex-col gap-1">
                                <div
                                  className={`text-xs p-1 rounded leading-tight border ${
                                    oddEntry
                                      ? "bg-green-50 border-green-200"
                                      : "border-dashed border-gray-200"
                                  }`}
                                >
                                  {oddEntry ? (
                                    <div className="flex items-center gap-1">
                                      <span className="text-gray-500 font-mono text-[10px]">н.</span>
                                      <span className="truncate">{oddEntry.displayText}</span>
                                    </div>
                                  ) : (
                                    <span className="text-gray-300">—</span>
                                  )}
                                </div>
                                <div
                                  className={`text-xs p-1 rounded leading-tight border ${
                                    evenEntry
                                      ? "bg-amber-50 border-amber-200"
                                      : "border-dashed border-gray-200"
                                  }`}
                                >
                                  {evenEntry ? (
                                    <div className="flex items-center gap-1">
                                      <span className="text-gray-500 font-mono text-[10px]">ч.</span>
                                      <span className="truncate">{evenEntry.displayText}</span>
                                    </div>
                                  ) : (
                                    <span className="text-gray-300">—</span>
                                  )}
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

      {selectedEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-80">
            <h2 className="font-bold mb-4">Редактирование занятия</h2>
            <div className="text-sm mb-2">{selectedEntry.displayText}</div>
            <label className="block mb-2">
              Номер слияния:
              <input type="number" value={flagForm.mergeNumber} onChange={(e) => setFlagForm({ ...flagForm, mergeNumber: +e.target.value })} className="border rounded px-2 py-1 w-full" />
            </label>
            <label className="block mb-2">
              <input type="checkbox" checked={flagForm.positionFlag} onChange={(e) => setFlagForm({ ...flagForm, positionFlag: e.target.checked })} />
              <span className="ml-2">Position flag</span>
            </label>
            <label className="block mb-4">
              <input type="checkbox" checked={flagForm.classroomFlag} onChange={(e) => setFlagForm({ ...flagForm, classroomFlag: e.target.checked })} />
              <span className="ml-2">Classroom flag</span>
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setSelectedEntry(null)} className="bg-gray-300 px-3 py-1 rounded">Отмена</button>
              <button onClick={saveFlags} className="bg-blue-500 text-white px-3 py-1 rounded">Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}