// src/db/seed.ts
import "dotenv/config";
import { db } from "@/db";
import {
  institutes, buildings, unitTypes, lessonTypes,
  academicLoadTypes, controlTypes, hourTypeMapping,
  departments, specialties, disciplines,
  employees, students,
  profiles,
  disciplineTeachers,
  curriculum, curriculumProfiles,
  classrooms, studyGroups,
  employeesDepartments,
  weeks, daysOfWeek, pairs, unitRoots, units, settings, scheduleDisplay,
  roles, schedule, lessonClassrooms, lessons,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
async function main() {
  console.log("Заполнение справочников...");
  // Удаление в правильном порядке (потомки → родители)
await db.delete(scheduleDisplay);
await db.delete(schedule);
await db.delete(lessonClassrooms);
await db.delete(lessons);
await db.delete(curriculumProfiles);
await db.delete(curriculum);
await db.delete(disciplineTeachers);
await db.delete(employeesDepartments);
await db.delete(classrooms);
await db.delete(hourTypeMapping);
await db.delete(controlTypes);
await db.delete(academicLoadTypes);
await db.delete(lessonTypes);
await db.delete(unitRoots);
await db.delete(units);
await db.delete(unitTypes);
await db.delete(daysOfWeek);
await db.delete(pairs);
await db.delete(weeks);
await db.delete(students);
await db.delete(studyGroups);
await db.delete(profiles);
await db.delete(specialties);
await db.delete(disciplines);
await db.delete(departments);
await db.delete(institutes);
await db.delete(buildings);
await db.delete(employees);
await db.delete(settings);

  // Сброс всех последовательностей
  await db.execute(sql`
    DO $$
    DECLARE
      seq RECORD;
    BEGIN
      FOR seq IN
        SELECT sequence_name
        FROM information_schema.sequences
        WHERE sequence_schema = 'public'
      LOOP
        EXECUTE 'ALTER SEQUENCE ' || seq.sequence_name || ' RESTART WITH 1';
      END LOOP;
    END $$;
  `);

  // ---------- независимые таблицы ----------
  // Институты
  const instData = await db.insert(institutes).values([
    { name: "ИЭТСЭ", universityCode: 1 },
    { name: "ИАТИТ", universityCode: 2 },
    { name: "ИНТС", universityCode: 4 },
    { name: "ИМЭК", universityCode: 5 },
  ]).returning();
  const instMap = new Map(instData.map(i => [i.universityCode, i.id]));

  // Корпуса
  const bldData = await db.insert(buildings).values(
    [1,2,3,4,5,6].map(n => ({ number: n }))
  ).returning();
  const bldMap = new Map(bldData.map(b => [b.number, b.id]));

  // Типы юнитов (ПОТОК, ГРУППА, ПОДГРУППА)
  await db.insert(unitTypes).values([
    { name: "ПОТОК", maxSize: 128, priorityLecture: 1, priorityWorkshop: 3, priorityGuidedStudy: 3, priorityLab: 3 },
    { name: "ГРУППА", maxSize: 32, priorityLecture: 2, priorityWorkshop: 1, priorityGuidedStudy: 1, priorityLab: 2 },
    { name: "ПОДГРУППА", maxSize: 16, priorityLecture: 3, priorityWorkshop: 3, priorityGuidedStudy: 3, priorityLab: 1 },
  ]);

  // Типы занятий (английские имена!)
  const ltData = await db.insert(lessonTypes).values([
    { name: "lecture", abbreviation: "ЛК" },
    { name: "workshop", abbreviation: "ПР" },
    { name: "guidedStudy", abbreviation: "КСР" },
    { name: "lab", abbreviation: "ЛАБ" },
  ]).returning();
  const ltMap = new Map(ltData.map(t => [t.name, t.id]));

  // Индексы теперь снова английские
  const ltByIdx = [
    null,
    ltMap.get("lecture")!,
    ltMap.get("workshop")!,
    ltMap.get("guidedStudy")!,
    ltMap.get("lab")!
  ];

  // Контроль
  const controlTypesData = await db.insert(controlTypes).values([
    { name: "ЗАЧЕТ", abbreviation: "ЗАЧ" },
    { name: "ДИФФЕРЕНЦИАЛЬНЫЙ ЗАЧЕТ", abbreviation: "ДИФ_ЗАЧ" },
    { name: "ЭКЗАМЕН", abbreviation: "ЭКЗ" },
  ]).returning();

  // Нагрузка
  const loadTypesData = await db.insert(academicLoadTypes).values([
    { name: "КУРСОВАЯ РАБОТА", abbreviation: "КР" },
    { name: "КУРСОВОЙ ПРОЕКТ", abbreviation: "КП" },
    { name: "ПРАКТИКА", abbreviation: "ПР" },
    { name: "ПРЕДДИПЛОМНАЯ ПРАКТИКА", abbreviation: "ПДП" },
    { name: "ДИПЛОМ", abbreviation: "Д" },
    { name: "ОТСУТСТВУЕТ", abbreviation: "-" },
  ]).returning();

  // Соответствие часов и приоритетов
  const lectureIdx = ltByIdx[1]!;   // ненулевой оператор
  const workshopIdx = ltByIdx[2]!;
  const guidedStudyIdx = ltByIdx[3]!;
  const labIdx = ltByIdx[4]!;

  await db.insert(hourTypeMapping).values([
      { planHourColumn: "hours_lecture", priorityColumn: "priorityLecture", lessonTypeId: lectureIdx },
      { planHourColumn: "hours_workshop", priorityColumn: "priorityWorkshop", lessonTypeId: workshopIdx },
      { planHourColumn: "hours_guided_study", priorityColumn: "priorityGuidedStudy", lessonTypeId: guidedStudyIdx },
      { planHourColumn: "hours_lab", priorityColumn: "priorityLab", lessonTypeId: labIdx },
  ]);

  // Кафедры (используем instMap)
  const deptData = await db.insert(departments).values([
    { name: "АВТОМАТИКА И СИСТЕМЫ УПРАВЛЕНИЯ", abbreviation: "АиСУ", instituteId: instMap.get(2)!, departmentCode: 17 },
    { name: "ИНФОРМАЦИОННАЯ БЕЗОПАСНОСТЬ", abbreviation: "ИБ", instituteId: instMap.get(2)!, departmentCode: 24 },
    { name: "ТЕОРЕТИЧЕСКАЯ ЭЛЕКТРОТЕХНИКА", abbreviation: "ТОЭ", instituteId: instMap.get(4)!, departmentCode: 11 },
  ]).returning();
  const deptMap = new Map(deptData.map(d => [d.departmentCode, d.id]));

  // Специальности (связь по коду кафедры)
  const specData = await db.insert(specialties).values([
    { code: "09.03.01", name: "ИНФОРМАТИКА И ВЫЧИСЛИТЕЛЬНАЯ ТЕХНИКА", departmentId: deptMap.get(17)! },
    { code: "09.03.02", name: "ИНФОРМАЦИОННЫЕ СИСТЕМЫ И ТЕХНОЛОГИИ", departmentId: deptMap.get(17)! },
  ]).returning();
  const specMap = new Map(specData.map(s => [s.id, s.id])); // простой маппинг

  // Профили
  const profData = await db.insert(profiles).values([
    { name: "ИВТ", specialtyId: specData[0].id, letterCode: "м" },
    { name: "ПИТ", specialtyId: specData[1].id, letterCode: "з" },
    { name: "ПИТ", specialtyId: specData[1].id, letterCode: "к" },
  ]).returning();
  const profileMap = new Map(profData.map(p => [p.letterCode, p.id]));

  // Дисциплины
  const discData = await db.insert(disciplines).values([
    { name: "ПРИКЛАДНОЕ ПРОГРАММИРОВАНИЕ", abbreviation: "ПП", departmentId: deptMap.get(17)! },
    { name: "КОМПЬЮТЕРНЫЕ КОМПЛЕКСЫ И СЕТИ", abbreviation: "ККС", departmentId: deptMap.get(17)! },
    { name: "ИНФОРМАЦИОННЫЕ СИСТЕМЫ И СЕТИ", abbreviation: "ИСС", departmentId: deptMap.get(17)! },
    { name: "ИНФОРМАЦИОННЫЕ СИСТЕМЫ И БД", abbreviation: "ИСиБД", departmentId: deptMap.get(17)! },
    { name: "ТЕСТИРОВАНИЕ ПРОГРАММНЫХ ПРОДУКТОВ", abbreviation: "ТПП", departmentId: deptMap.get(17)! },
    { name: "ЭЛЕКТРОТЕХНИКА И СХЕМОТЕХНИКА", abbreviation: "ЭиС", departmentId: deptMap.get(17)! },
    { name: "ОСНОВЫ ТЕОРИИ УПРАВЛЕНИЯ", abbreviation: "ОТУ", departmentId: deptMap.get(17)! },
  ]).returning();

  // Преподаватели (сотрудники)
  const empData = await db.insert(employees).values([
    { surname: "АЛЬТМАН", name: "ЕВГЕНИЙ", patronymic: "АНАТОЛЬЕВИЧ", isActive: true },
    { surname: "ТИХОНОВА", name: "НАТАЛЬЯ", patronymic: "АЛЕКСЕЕВНА", isActive: true },
    { surname: "ПАШКОВА", name: "НАТАЛЬЯ", patronymic: "ВИКТОРОВНА", isActive: true },
    { surname: "ЛАВРУХИН", name: "АНДРЕЙ", patronymic: "АЛЕКСАНДРОВИЧ", isActive: true },
    { surname: "ОКИШЕВ", name: "АНДРЕЙ", patronymic: "СЕРГЕЕВИЧ", isActive: true },
    { surname: "МАЛЮТИН", name: "АНДРЕЙ", patronymic: "ГЕННАДЬЕВИЧ", isActive: true },
    { surname: "ЦИРКИН", name: "ВИТАЛИЙ", patronymic: "СТЕПАНОВИЧ", isActive: true },
    { surname: "ЕЛИЗАРОВ", name: "ДМИТРИЙ", patronymic: "АЛЕКСАНДРОВИЧ", isActive: true },
  ]).returning();

  // Преподаватели кафедр (employees_departments)
  const empDeptRelations = [
    { emp: 0, deptCode: 17 }, // Альтман -> АиСУ
    { emp: 1, deptCode: 17 }, // Тихонова
    { emp: 2, deptCode: 17 }, // Пашкова
    { emp: 3, deptCode: 17 }, // Лаврухин
    { emp: 4, deptCode: 17 }, // Окишев
    { emp: 5, deptCode: 17 }, // Малютин
    { emp: 6, deptCode: 17 }, // Циркин
    { emp: 7, deptCode: 17 }, // Елизаров
    { emp: 2, deptCode: 11 }, // Пашкова -> ТОЭ
    { emp: 3, deptCode: 24 }, // Лаврухин -> ИБ
    { emp: 4, deptCode: 24 }, // Окишев -> ИБ
    { emp: 7, deptCode: 24 }, // Елизаров -> ИБ
  ];
  const empDeptData = [];
  for (const r of empDeptRelations) {
    const empId = empData[r.emp].id;
    const deptId = deptMap.get(r.deptCode)!;
    empDeptData.push({ employeeId: empId, departmentId: deptId, employmentType: 1, position: 1 });
  }
  const insertedEmpDepts = await db.insert(employeesDepartments).values(empDeptData).returning();

  // Создаём Map для быстрого поиска employee_department.id по сотруднику и кафедре
  const empDeptMap = new Map<string, number>(); // ключ "empId_deptId"
  for (const ed of insertedEmpDepts) {
    empDeptMap.set(`${ed.employeeId}_${ed.departmentId}`, ed.id);
  }

  // Дисциплины-преподавателей (discipline_teachers)
  const dtValues = [
    { ltIdx: 1, discIdx: 0, empIdx: 0, deptCode: 17 }, // Лекция ПП – Альтман
    { ltIdx: 1, discIdx: 1, empIdx: 5, deptCode: 17 }, // Лекция ККС – Малютин
    { ltIdx: 1, discIdx: 2, empIdx: 4, deptCode: 17 }, // Лекция ИСС – Окишев
    { ltIdx: 1, discIdx: 3, empIdx: 1, deptCode: 17 }, // Лекция ИСиБД – Тихонова
    { ltIdx: 1, discIdx: 4, empIdx: 7, deptCode: 17 }, // Лекция ТПП – Елизаров
    { ltIdx: 1, discIdx: 5, empIdx: 6, deptCode: 17 }, // Лекция ЭиС – Циркин
    { ltIdx: 1, discIdx: 6, empIdx: 3, deptCode: 17 }, // Лекция ОТУ – Лаврухин
    // KCP (3)
    { ltIdx: 3, discIdx: 0, empIdx: 0, deptCode: 17 },
    { ltIdx: 3, discIdx: 1, empIdx: 5, deptCode: 17 },
    { ltIdx: 3, discIdx: 2, empIdx: 4, deptCode: 17 },
    { ltIdx: 3, discIdx: 3, empIdx: 1, deptCode: 17 },
    { ltIdx: 3, discIdx: 4, empIdx: 7, deptCode: 17 },
    { ltIdx: 3, discIdx: 5, empIdx: 6, deptCode: 17 },
    { ltIdx: 3, discIdx: 6, empIdx: 2, deptCode: 17 }, // ОТУ КСР – Пашкова
    // ЛАБ (4)
    { ltIdx: 4, discIdx: 0, empIdx: 0, deptCode: 17 },
    { ltIdx: 4, discIdx: 1, empIdx: 5, deptCode: 17 },
    { ltIdx: 4, discIdx: 2, empIdx: 4, deptCode: 17 },
    { ltIdx: 4, discIdx: 3, empIdx: 1, deptCode: 17 },
    { ltIdx: 4, discIdx: 4, empIdx: 7, deptCode: 17 },
    { ltIdx: 4, discIdx: 5, empIdx: 6, deptCode: 17 },
    { ltIdx: 4, discIdx: 6, empIdx: 2, deptCode: 17 },
  ];
  for (const rec of dtValues) {
    const lessonTypeId = ltByIdx[rec.ltIdx];
    const disciplineId = discData[rec.discIdx].id;
    const teacherDeptId = empDeptMap.get(`${empData[rec.empIdx].id}_${deptMap.get(rec.deptCode)!}`);
    if (teacherDeptId) {
      await db.insert(disciplineTeachers).values({
        lessonTypeId,
        disciplineId,
        teacherDepartmentId: teacherDeptId,
      });
    }
  }

  // Учебный план
  const planData = [
    { course: 3, semester: 1, disc: 0, lk: 32, ksr: 12, pr: 0, lab: 32, loadIdx: 5, ctrlIdx: 2 }, // ОТСУТСТВУЕТ, ЭКЗ
    { course: 3, semester: 1, disc: 1, lk: 16, ksr: 12, pr: 0, lab: 16, loadIdx: 5, ctrlIdx: 0 }, // ОТСУТСТВУЕТ, ЗАЧ
    { course: 3, semester: 1, disc: 2, lk: 32, ksr: 12, pr: 0, lab: 32, loadIdx: 5, ctrlIdx: 2 },
    { course: 3, semester: 1, disc: 3, lk: 32, ksr: 28, pr: 0, lab: 32, loadIdx: 0, ctrlIdx: 2 }, // КУРСОВАЯ РАБОТА
    { course: 3, semester: 1, disc: 4, lk: 32, ksr: 12, pr: 0, lab: 32, loadIdx: 5, ctrlIdx: 0 },
    { course: 3, semester: 1, disc: 5, lk: 32, ksr: 28, pr: 0, lab: 32, loadIdx: 0, ctrlIdx: 2 },
    { course: 3, semester: 1, disc: 6, lk: 32, ksr: 12, pr: 0, lab: 32, loadIdx: 5, ctrlIdx: 2 },
  ];
  const insertedPlans = [];
  for (const p of planData) {
    const [rec] = await db.insert(curriculum).values({
      course: p.course,
      semester: p.semester,
      disciplineId: discData[p.disc].id,
      hoursLecture: p.lk,
      hoursGuidedStudy: p.ksr,
      hoursWorkshop: p.pr,
      hoursLab: p.lab,
      additionalTaskId: loadTypesData[p.loadIdx].id,
      controlTypeId: controlTypesData[p.ctrlIdx].id,
    }).returning();
    insertedPlans.push(rec);
  }

  // Связь учебных планов с профилями (все три профиля для каждого плана)
  for (const prof of profData) {
    for (const plan of insertedPlans) {
      await db.insert(curriculumProfiles).values({
        profileId: prof.id,
        curriculumId: plan.id,
      });
    }
  }

  // Аудитории
  const classroomsData = [
    { building: 1, room: "322", cap: 16, deptCode: 17, pLk: 3, pKsr: 2, pPr: 2, pLab: 1 },
    { building: 1, room: "325", cap: 16, deptCode: 17, pLk: 3, pKsr: 2, pPr: 2, pLab: 1 },
    { building: 1, room: "329", cap: 60, deptCode: 17, pLk: 3, pKsr: 2, pPr: 2, pLab: 1 },
    { building: 1, room: "345", cap: 60, deptCode: 11, pLk: 3, pKsr: 2, pPr: 2, pLab: 1 },
    { building: 1, room: "467", cap: 100, deptCode: 17, pLk: 3, pKsr: 2, pPr: 2, pLab: 1 },
    { building: 1, room: "471", cap: 100, deptCode: 24, pLk: 1, pKsr: 2, pPr: 2, pLab: 3 },
    { building: 1, room: "350", cap: 150, deptCode: null, pLk: 3, pKsr: 3, pPr: 3, pLab: null },
    { building: 1, room: "160", cap: 150, deptCode: null, pLk: 2, pKsr: 2, pPr: 3, pLab: null },
    { building: 1, room: "210", cap: 150, deptCode: null, pLk: 2, pKsr: 2, pPr: 3, pLab: null },
  ];
  for (const c of classroomsData) {
    await db.insert(classrooms).values({
      buildingId: bldMap.get(c.building)!, // теперь берём правильный ID
      roomNumber: c.room,
      capacity: c.cap,
      departmentId: c.deptCode ? deptMap.get(c.deptCode)! : null,
      priorityLecture: c.pLk,
      priorityWorkshop: c.pPr,
      priorityGuidedStudy: c.pKsr,
      priorityLab: c.pLab,
    });
  }

  // Студенты (без группы, профиль указываем существующий: профили 1,2,3 соответствуют ИВТ, ПИТз, ПИТк)
  // const studentsList = [
  //   // профиль 1 (ИВТ, 20 чел)
  //   ["Винаев","Максим", 2023, 2],["Гордеев","Антон", 2023, 2],["Григорьев","Дмитрий", 2023, 2],["Дивина","Александра", 2023, 2],
  //   ["Живина","Елизавета", 2023, 2],["Захаров","Александр", 2023, 2],["Кривощеков","Егор", 2023, 2],["Леванов","Дмитрий", 2023, 2],
  //   ["Нарыжный","Сергей", 2023, 2],["Оботуров","Денис", 2023, 2],["Пастушенко","Ольга", 2023, 2],["Полоротов","Юрий", 2023, 2],
  //   ["Сергиенко","Ярослав", 2023, 2],["Сидорова","Софья", 2023, 2],["Субоч","Иван", 2023, 2],["Титова","Алиса", 2023, 2],
  //   ["Худяков","Максим", 2023, 2],["Шкудун","Ярослав", 2023, 2],["Шруб","Мария", 2023, 2],["Аферов","Екатерина", 2023, 2],
  //   // профиль 2 (ПИТз, 21 чел)
  //   ["Атаманчук","Олеся", 2023, 3],["Верн","Екатерина", 2023, 3],["Верховский","Игорь", 2023, 3],["Гаврлова","Полина", 2023, 3],
  //   ["Дубровский","Никита", 2023, 3],["Еремина","Дарья", 2023, 3],["Журавлев","Даниил", 2023, 3],["Зорина","Ксения", 2023, 3],
  //   ["Космачева","Анна", 2023, 3],["Краснюков","Андрей", 2023, 3],["Кузичев","Владислав", 2023, 3],["Лихтнер","Кристина", 2023, 3],
  //   ["Медведев","Дмитрий", 2023, 3],["Мингалев","Андрей", 2023, 3],["Сидоренко","Максим", 2023, 3],["Синцова","Елизавета", 2023, 3],
  //   ["Снегирев","Сергей", 2023, 3],["Терехов","Александр", 2023, 3],["Труфанов","Глеб", 2023, 3],["Черноморов","Илья", 2023, 3],
  //   ["Ципичев","Александр", 2023, 3],
  //   // профиль 3 (ПИТк, 19 чел)
  //   ["Абитов","Дамир", 2023, 1],["Абуталипов","Тимур", 2023, 1],["Болдырева","Екатерина", 2023, 1],["Васильев","Владимир", 2023, 1],
  //   ["Вижевитов","Андрей", 2023, 1],["Данилова","Ангелина", 2023, 1],["Жуманов","Валерий", 2023, 1],["Ишматова","Екатерина", 2023, 1],
  //   ["Карпов","Никита", 2023, 1],["Макаров","Никита", 2023, 1],["Петриченко","Никита", 2023, 1],["Самойленко","София", 2023, 1],
  //   ["Толмашева","Екатерина", 2023, 1],["Хохлов","Денис", 2023, 1],["Черевиченко","Виктория", 2023, 1],["Шамардина","Елизавета", 2023, 1],
  //   ["Максименко","Евгений", 2023, 1],["Шапран","Дмитрий", 2023, 1],["Яковлев","Николай", 2023, 1],
  //   // ещё 10 студентов профиль 1 (2021 год)
  //   ["Абитов","Дамир", 2021, 1],["Абуталипов","Тимур", 2021, 1],["Болдырева","Екатерина", 2021, 1],["Васильев","Владимир", 2021, 1],
  //   ["Вижевитов","Андрей", 2021, 1],["Данилова","Ангелина", 2021, 1],["Жуманов","Валерий", 2021, 1],["Ишматова","Екатерина", 2021, 1],
  //   ["Карпов","Никита", 2021, 1],["Макаров","Никита", 2021, 1],
  // ];
  // const studentProfileMap = [
  //   ...Array(20).fill(profData[0].id), // первые 20 в ИВТ
  //   ...Array(21).fill(profData[1].id), // след. 21 в ПИТз
  //   ...Array(19).fill(profData[2].id), // след. 19 в ПИТк
  //   ...Array(10).fill(profData[0].id), // последние 10 снова ИВТ, но с 2021 годом
  // ];
  // const studentYears = [
  //   ...Array(20).fill(2023),
  //   ...Array(21).fill(2023),
  //   ...Array(19).fill(2023),
  //   ...Array(10).fill(2021),
  // ];

  // for (let i = 0; i < studentsList.length; i++) {
  //   const [surname, name] = studentsList[i];
  //   await db.insert(students).values({
  //     surname,
  //     name,
  //     admissionYear: studentYears[i],
  //     profileId: studentProfileMap[i],
  //     isActive: true,
  //   });
  // }
    const studentsList: { surname: string; name: string; admissionYear: number; profileLetter: string }[] = [
    // 20 студентов ПИТ «з» (2023)
    ...[ "Винаев","Гордеев","Григорьев","Дивина","Живина","Захаров","Кривощеков","Леванов","Нарыжный","Оботуров",
        "Пастушенко","Полоротов","Сергиенко","Сидорова","Субоч","Титова","Худяков","Шкудун","Шруб","Аферов"
      ].map(surname => ({ surname, name: "", admissionYear: 2023, profileLetter: "з" })),
    // 21 студент ПИТ «к» (2023)
    ...[ "Атаманчук","Верн","Верховский","Гаврлова","Дубровский","Еремина","Журавлев","Зорина","Космачева","Краснюков",
        "Кузичев","Лихтнер","Медведев","Мингалев","Сидоренко","Синцова","Снегирев","Терехов","Труфанов","Черноморов","Ципичев"
      ].map(surname => ({ surname, name: "", admissionYear: 2023, profileLetter: "к" })),
    // 19 студентов ИВТ «м» (2023)
    ...[ "Абитов","Абуталипов","Болдырева","Васильев","Вижевитов","Данилова","Жуманов","Ишматова","Карпов",
        "Макаров","Петриченко","Самойленко","Толмашева","Хохлов","Черевиченко","Шамардина","Максименко","Шапран","Яковлев"
      ].map(surname => ({ surname, name: "", admissionYear: 2023, profileLetter: "м" })),
    // 10 студентов ИВТ «м» (2021)
    ...[ "Абитов","Абуталипов","Болдырева","Васильев","Вижевитов","Данилова","Жуманов","Ишматова","Карпов","Макаров"
      ].map(surname => ({ surname, name: "", admissionYear: 2021, profileLetter: "м" })),
  ];

  // Имена (как в исходном дампе)
  const namesOriginal = [
    "Максим","Антон","Дмитрий","Александра","Елизавета","Александр","Егор","Дмитрий","Сергей","Денис",
    "Ольга","Юрий","Ярослав","Софья","Иван","Алиса","Максим","Ярослав","Мария","Екатерина",
    "Олеся","Екатерина","Игорь","Полина","Никита","Дарья","Даниил","Ксения","Анна","Андрей",
    "Владислав","Кристина","Дмитрий","Андрей","Максим","Елизавета","Сергей","Александр","Глеб","Илья","Александр",
    "Дамир","Тимур","Екатерина","Владимир","Андрей","Ангелина","Валерий","Екатерина","Никита","Никита",
    "Никита","София","Екатерина","Денис","Виктория","Елизавета","Евгений","Дмитрий","Николай",
    "Дамир","Тимур","Екатерина","Владимир","Андрей","Ангелина","Валерий","Екатерина","Никита","Никита"
  ];
  for (let i = 0; i < studentsList.length; i++) {
    studentsList[i].name = namesOriginal[i] || "";
  }

  // Вставка студентов с поиском профиля по буквенному коду
  for (const stud of studentsList) {
    const profileId = profileMap.get(stud.profileLetter);
    if (!profileId) {
      console.warn(`Профиль с буквенным кодом '${stud.profileLetter}' не найден, пропущен студент ${stud.surname}`);
      continue;
    }
    await db.insert(students).values({
      surname: stud.surname,
      name: stud.name,
      admissionYear: stud.admissionYear,
      profileId,
      isActive: true,
    });
  }
  // Дни недели, пары, недели, роли
  await db.insert(daysOfWeek).values(
    ["ПН","ВТ","СР","ЧТ","ПТ","СБ"].map(name => ({ name }))
  );
  await db.insert(pairs).values(
    [1,2,3,4,5].map(number => ({ number }))
  );
  await db.insert(weeks).values([
    { id: 1, type: "odd" },
    { id: 2, type: "even" },
  ]);

  // Роли, если отсутствуют (admin уже есть после setup, добавим teacher, student)
  const existingRoles = await db.select().from(roles);
  if (!existingRoles.find(r => r.name === "teacher")) {
    await db.insert(roles).values({ name: "teacher", description: "Преподаватель" });
  }
  if (!existingRoles.find(r => r.name === "student")) {
    await db.insert(roles).values({ name: "student", description: "Студент" });
  }
// Настройки
  const existingSettings = await db.select().from(settings).where(eq(settings.key, 'total_weeks'));
  if (existingSettings.length === 0) {
    await db.insert(settings).values({ key: 'total_weeks', value: '16' });
  }
  const semesterExists = await db.select().from(settings).where(eq(settings.key, 'current_semester'));
  if (semesterExists.length === 0) {
    await db.insert(settings).values({ key: 'current_semester', value: '1' });
  }
  console.log("Готово! Данные загружены.");
}

main().catch(console.error).finally(() => process.exit());