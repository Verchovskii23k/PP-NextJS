"use client";
import { trpc } from "@/trpc/client";
import { useState, useEffect } from "react";

export default function GenerationsPage() {
  const [totalWeeks, setTotalWeeks] = useState(16);
  const [cycleLength, setCycleLength] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const utils = trpc.useUtils();

  // ---------- Настройка "Всего недель" из БД ----------
  const { data: totalWeeksSetting, isLoading: weeksLoading } =
    trpc.settings.get.useQuery({ key: 'total_weeks' });
  const updateSetting = trpc.settings.update.useMutation({
    onSuccess: () => {
      utils.settings.get.invalidate({ key: 'total_weeks' });
    },
    onError: (e) => setError(e.message),
  });

  // Синхронизируем локальное состояние с загруженным из БД
  useEffect(() => {
    if (totalWeeksSetting?.value !== undefined) {
      setTotalWeeks(Number(totalWeeksSetting.value));
    }
  }, [totalWeeksSetting]);

  // ---------- Порог подгруппы из БД ----------
  const { data: subgroupType, isLoading: thresholdLoading } =
    trpc.unitTypes.getByName.useQuery({ name: "ПОДГРУППА" });

  const updateThreshold = trpc.unitTypes.update.useMutation({
    onSuccess: () => {
      utils.unitTypes.getByName.invalidate({ name: "ПОДГРУППА" });
    },
    onError: (e) => setError(e.message),
  });

  const [threshold, setThreshold] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (subgroupType?.maxSize !== undefined) {
      setThreshold(subgroupType.maxSize);
    }
  }, [subgroupType]);

  const handleSaveThreshold = () => {
    if (!subgroupType || threshold === undefined) return;
    updateThreshold.mutate({
      id: subgroupType.id,
      maxSize: threshold,
    });
  };

  const handleSaveTotalWeeks = () => {
    if (!/^\d+$/.test(String(totalWeeks)) || totalWeeks < 1) {
      setError("Введите целое положительное число недель");
      return;
    }
    updateSetting.mutate({ key: 'total_weeks', value: String(totalWeeks) });
  };

  // ---------- Мутации генераций ----------
  const groups = trpc.generations.generateGroups.useMutation({ /* ... твой текущий код */ });
  const units = trpc.generations.generateUnits.useMutation({ /* ... */ });
  const lessons = trpc.generations.generateLessons.useMutation({ /* ... */ });
  const classrooms = trpc.generations.assignClassroomsAuto.useMutation({ /* ... */ });
  const schedule = trpc.generations.generateSchedule.useMutation({
    onSuccess: () => {
      setError(null);
      alert("Расписание сгенерировано");
    },
    onError: (e) => setError(e.message),
  });

  if (thresholdLoading || weeksLoading) return <div>Загрузка данных...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Генерации</h1>
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* 1. Группы */}
      <div className="space-y-2">
        <button
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
          onClick={() => groups.mutate()}
          disabled={groups.isPending}
        >
          {groups.isPending ? "..." : "1. Сгенерировать учебные группы"}
        </button>
      </div>

      {/* 2. Юниты + управление порогом */}
      <div className="space-y-2">
        <label className="mr-2">Макс. размер подгруппы:</label>
        <input
          type="number"
          value={threshold ?? ""}
          onChange={(e) => setThreshold(Number(e.target.value))}
          className="border p-1 w-24"
        />
        <button
          className="bg-green-500 text-white px-3 py-1 rounded text-sm ml-2"
          onClick={handleSaveThreshold}
          disabled={updateThreshold.isPending}
        >
          {updateThreshold.isPending ? "Сохраняю..." : "Сохранить"}
        </button>
        <button
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50 ml-2"
          onClick={() => units.mutate()}
          disabled={units.isPending}
        >
          {units.isPending ? "..." : "2. Сгенерировать юниты"}
        </button>
      </div>

      {/* 3. Занятия */}
      <div className="space-y-2">
        <button
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
          onClick={() => lessons.mutate()}
          disabled={lessons.isPending}
        >
          {lessons.isPending ? "..." : "3. Сгенерировать занятия"}
        </button>
      </div>

      {/* 4. Аудитории */}
      <div className="space-y-2">
        <button
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
          onClick={() => classrooms.mutate()}
          disabled={classrooms.isPending}
        >
          {classrooms.isPending ? "..." : "4. Назначить аудитории автоматически"}
        </button>
      </div>

      {/* 5. Расписание */}
      <div className="space-y-2">
        <label className="mr-2">Всего недель:</label>
        <input
          type="number"
          value={totalWeeks}
          onChange={(e) => setTotalWeeks(Number(e.target.value))}
          className="border p-1 w-20"
          min={1}
        />
        <button
          className="bg-green-500 text-white px-3 py-1 rounded text-sm ml-2"
          onClick={handleSaveTotalWeeks}
          disabled={updateSetting.isPending}
        >
          {updateSetting.isPending ? "Сохраняю..." : "Сохранить"}
        </button>
        <span className="ml-2 text-sm text-gray-600">Длина цикла (чёт/нечет=2): {cycleLength}</span>
        <br />
        <button
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50 mt-2"
          onClick={() => schedule.mutate({ totalWeeks, cycleLength })}
          disabled={schedule.isPending}
        >
          {schedule.isPending ? "..." : "5. Сгенерировать расписание"}
        </button>
      </div>
    </div>
  );
}