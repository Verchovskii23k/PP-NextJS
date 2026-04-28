"use client";
import { trpc } from "@/trpc/client";
import { useState } from "react";

export default function SchedulePage() {
  const [week, setWeek] = useState<number | undefined>();
  const [day, setDay] = useState<number | undefined>();
  const [group, setGroup] = useState<number | undefined>();
  const [teacher, setTeacher] = useState<number | undefined>();
  const [classroom, setClassroom] = useState<number | undefined>();

  const { data: filters } = trpc.schedule.filters.useQuery();
  const { data: scheduleData, isLoading } = trpc.schedule.getSchedule.useQuery({
    weekNumber: week,
    dayOfWeekId: day,
    groupId: group,
    teacherId: teacher,
    classroomId: classroom,
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Расписание</h1>

      {/* Фильтры */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select className="border p-2 rounded" value={week || ""} onChange={e => setWeek(e.target.value ? +e.target.value : undefined)}>
          <option value="">Все недели</option>
          {filters?.weeks.map(w => (
            <option key={w.weekNumber} value={w.weekNumber}>{w.weekNumber}</option>
          ))}
        </select>

        <select className="border p-2 rounded" value={day || ""} onChange={e => setDay(e.target.value ? +e.target.value : undefined)}>
          <option value="">Все дни</option>
          {filters?.days.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        <select className="border p-2 rounded" value={group || ""} onChange={e => setGroup(e.target.value ? +e.target.value : undefined)}>
          <option value="">Все группы</option>
          {filters?.groups.map(g => (
            <option key={g.id} value={g.id}>{g.code}</option>
          ))}
        </select>

        <select className="border p-2 rounded" value={teacher || ""} onChange={e => setTeacher(e.target.value ? +e.target.value : undefined)}>
          <option value="">Все преподаватели</option>
          {filters?.teachers.map(t => (
            <option key={t.id} value={t.id}>{t.surname} {t.name}</option>
          ))}
        </select>

        <select className="border p-2 rounded" value={classroom || ""} onChange={e => setClassroom(e.target.value ? +e.target.value : undefined)}>
          <option value="">Все аудитории</option>
          {filters?.classrooms.map(c => (
            <option key={c.id} value={c.id}>{c.roomNumber}</option>
          ))}
        </select>
      </div>

      {/* Таблица расписания */}
      {isLoading ? (
        <p>Загрузка...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">Неделя</th>
                <th className="border p-2">День</th>
                <th className="border p-2">Пара</th>
                <th className="border p-2">Дисциплина</th>
                <th className="border p-2">Тип</th>
                <th className="border p-2">Преподаватель</th>
                <th className="border p-2">Аудитория</th>
                <th className="border p-2">Группа/Юнит</th>
              </tr>
            </thead>
            <tbody>
              {scheduleData?.map(row => (
                <tr key={row.scheduleId} className="hover:bg-gray-50">
                  <td className="border p-2">{row.weekNumber}</td>
                  <td className="border p-2">{row.dayOfWeek}</td>
                  <td className="border p-2">{row.pairNumber}</td>
                  <td className="border p-2">{row.disciplineName}</td>
                  <td className="border p-2">{row.lessonTypeName}</td>
                  <td className="border p-2">{row.teacherSurname} {row.teacherName}</td>
                  <td className="border p-2">{row.buildingNumber ? `${row.buildingNumber}-${row.classroomNumber}` : "—"}</td>
                  <td className="border p-2">{row.unitCode}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {scheduleData?.length === 0 && <p className="mt-4">Нет данных по выбранным фильтрам</p>}
        </div>
      )}
    </div>
  );
}