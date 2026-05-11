"use client";
import { trpc } from "@/trpc/client";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function GenerationsPage() {
  const [error, setError] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const { data: subgroupType, isLoading: thresholdLoading } =
    trpc.unitTypes.getByName.useQuery({ name: "ПОДГРУППА" });

  const updateThreshold = trpc.unitTypes.update.useMutation({
    onSuccess: () => utils.unitTypes.getByName.invalidate({ name: "ПОДГРУППА" }),
    onError: (e) => setError(e.message),
  });

  const [threshold, setThreshold] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (subgroupType?.maxSize !== undefined) setThreshold(subgroupType.maxSize);
  }, [subgroupType]);

  const handleSaveThreshold = () => {
    if (!subgroupType || threshold === undefined) return;
    updateThreshold.mutate({ id: subgroupType.id, maxSize: threshold });
  };

  const { data: totalWeeksSetting, isLoading: weeksLoading } =
    trpc.settings.get.useQuery({ key: "total_weeks" });

  const updateTotalWeeks = trpc.settings.update.useMutation({
    onSuccess: () => utils.settings.get.invalidate({ key: "total_weeks" }),
    onError: (e) => setError(e.message),
  });

  const [totalWeeksInput, setTotalWeeksInput] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (totalWeeksSetting) {
      const num = Number(totalWeeksSetting);
      if (!isNaN(num)) setTotalWeeksInput(num);
    }
  }, [totalWeeksSetting]);

  const handleSaveTotalWeeks = () => {
    if (totalWeeksInput === undefined || isNaN(totalWeeksInput)) return;
    updateTotalWeeks.mutate({ key: "total_weeks", value: String(totalWeeksInput) });
  };

  const { data: semesterSetting } = trpc.settings.get.useQuery({ key: "current_semester" });
  const updateSemester = trpc.settings.update.useMutation({
    onSuccess: () => utils.settings.get.invalidate({ key: "current_semester" }),
    onError: (e) => setError(e.message),
  });
  const [semesterInput, setSemesterInput] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (semesterSetting) {
      const num = Number(semesterSetting);
      if (!isNaN(num)) setSemesterInput(num);
    }
  }, [semesterSetting]);

  const handleSaveSemester = () => {
    if (semesterInput === undefined || isNaN(semesterInput)) return;
    updateSemester.mutate({ key: "current_semester", value: String(semesterInput) });
  };

  const groups = trpc.generations.generateGroups.useMutation({
    onSuccess: (data) => {
      setError(null);
      utils.students.list.invalidate();
      utils.studyGroups.list.invalidate();
      toast.success(`Групп: ${data.createdGroups}, студентов: ${data.assignedStudents}`);
    },
    onError: (e) => setError(e.message),
  });

  const units = trpc.generations.generateUnits.useMutation({
    onSuccess: (data) => {
      setError(null);
      toast.success(`Создано юнитов: ${data.createdUnits}`);
    },
    onError: (e) => setError(e.message),
  });

  const lessons = trpc.generations.generateLessons.useMutation({
    onSuccess: (data) => {
      setError(null);
      toast.success(`Создано занятий: ${data.lessonsCreated}`);
    },
    onError: (e) => setError(e.message),
  });

  const classrooms = trpc.generations.assignClassroomsAuto.useMutation({
    onSuccess: (data) => {
      setError(null);
      toast.success(`Назначено аудиторий: ${data.assignedClassrooms}`);
    },
    onError: (e) => setError(e.message),
  });

  const schedule = trpc.generations.generateSchedule.useMutation({
    onSuccess: () => {
      setError(null);
      toast.success("Расписание сгенерировано");
    },
    onError: (e) => setError(e.message),
  });

  if (thresholdLoading || weeksLoading) return <div className="p-6 text-foreground">Загрузка настроек...</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto bg-background text-foreground">
      <h1 className="text-2xl font-bold mb-6">Системные генераторы</h1>
      {error && (
        <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Карточка: Группы */}
      <div className="bg-background border border-border rounded-lg shadow-sm p-4 mb-4">
        <h2 className="text-lg font-semibold mb-2">1. Учебные группы</h2>
        <button
          className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded disabled:opacity-50"
          onClick={() => groups.mutate()}
          disabled={groups.isPending}
        >
          {groups.isPending ? "Генерация..." : "Сгенерировать группы"}
        </button>
      </div>

      {/* Карточка: Юниты + порог подгруппы + семестр */}
      <div className="bg-background border border-border rounded-lg shadow-sm p-4 mb-4">
        <h2 className="text-lg font-semibold mb-2">2. Юниты</h2>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-muted-foreground">Макс. размер подгруппы:</label>
          <input
            type="number"
            value={threshold ?? ""}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="border border-border rounded px-2 py-1 w-24 bg-background text-foreground placeholder:text-muted-foreground"
            placeholder="..."
          />
          <button
            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
            onClick={handleSaveThreshold}
            disabled={updateThreshold.isPending}
          >
            {updateThreshold.isPending ? "..." : "ОК"}
          </button>
          <button
            className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded disabled:opacity-50"
            onClick={() => units.mutate()}
            disabled={units.isPending}
          >
            {units.isPending ? "Генерация..." : "Сгенерировать юниты"}
          </button>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Текущий семестр:</label>
            <input
              type="number"
              min={1}
              max={12}
              value={semesterInput ?? ""}
              onChange={(e) => setSemesterInput(Number(e.target.value))}
              className="border border-border rounded px-2 py-1 w-20 bg-background text-foreground placeholder:text-muted-foreground"
              placeholder="1"
            />
            <button
              className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-sm"
              onClick={handleSaveSemester}
              disabled={updateSemester.isPending}
            >
              {updateSemester.isPending ? "..." : "OK"}
            </button>
          </div>
        </div>
      </div>

      {/* Карточка: Занятия */}
      <div className="bg-background border border-border rounded-lg shadow-sm p-4 mb-4">
        <h2 className="text-lg font-semibold mb-2">3. Занятия</h2>
        <button
          className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded disabled:opacity-50"
          onClick={() => lessons.mutate({ currentSemester: semesterInput })}
          disabled={lessons.isPending}
        >
          {lessons.isPending ? "Генерация..." : "Сгенерировать занятия"}
        </button>
      </div>

      {/* Карточка: Аудитории */}
      <div className="bg-background border border-border rounded-lg shadow-sm p-4 mb-4">
        <h2 className="text-lg font-semibold mb-2">4. Аудиторные назначения</h2>
        <button
          className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded disabled:opacity-50"
          onClick={() => classrooms.mutate()}
          disabled={classrooms.isPending}
        >
          {classrooms.isPending ? "Назначение..." : "Назначить аудитории"}
        </button>
      </div>

      {/* Карточка: Расписание + настройки */}
      <div className="bg-background border border-border rounded-lg shadow-sm p-4 mb-4">
        <h2 className="text-lg font-semibold mb-2">5. Расписание</h2>
        <div className="flex flex-wrap items-center gap-4 mb-3" >
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Всего недель:</label>
            <input
              type="number"
              value={totalWeeksInput ?? ""}
              onChange={(e) => setTotalWeeksInput(Number(e.target.value))}
              className="border border-border rounded px-2 py-1 w-20 bg-background text-foreground placeholder:text-muted-foreground"
              placeholder="16"
            />
            <button
              className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-sm"
              onClick={handleSaveTotalWeeks}
              disabled={updateTotalWeeks.isPending}
            >
              {updateTotalWeeks.isPending ? "..." : "OK"}
            </button>
          </div>
        </div>
        <button
          className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded disabled:opacity-50"
          onClick={() =>
            schedule.mutate({
              totalWeeks: totalWeeksInput ?? 16,
            })
          }
          disabled={schedule.isPending}
        >
          {schedule.isPending ? "Генерация..." : "Сгенерировать расписание"}
        </button>
      </div>
    </div>
  );
}