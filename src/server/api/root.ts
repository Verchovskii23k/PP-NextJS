import { router } from "./trpc";
import { authRouter } from "./routers/auth";
import { institutesRouter } from "./routers/institutes";
import { buildingsRouter } from "./routers/buildings";
import { departmentsRouter } from "./routers/departments";
import { specialtiesRouter } from "./routers/specialties";
import { profilesRouter } from "./routers/profiles";
import { disciplinesRouter } from "./routers/disciplines";
import { unitTypesRouter } from "./routers/unitTypes";
import { lessonTypesRouter } from "./routers/lessonTypes";
import { classroomsRouter } from "./routers/classRooms";
import { employeesRouter } from "./routers/employees";
import { studentsRouter } from "./routers/students";
import { daysOfWeekRouter } from "./routers/daysOfWeek";
import { pairsRouter } from "./routers/pairs";
import { weeksRouter } from "./routers/weeks";
import { generationsRouter } from "./routers/generators";
import { scheduleRouter } from "./routers/schedule";
import { lookupRouter } from "./routers/lookup";   // ✅ добавлено

export const appRouter = router({
  auth: authRouter,
  institutes: institutesRouter,
  buildings: buildingsRouter,
  departments: departmentsRouter,
  specialties: specialtiesRouter,
  profiles: profilesRouter,
  disciplines: disciplinesRouter,
  unitTypes: unitTypesRouter,
  lessonTypes: lessonTypesRouter,
  classrooms: classroomsRouter,
  employees: employeesRouter,
  students: studentsRouter,
  daysOfWeek: daysOfWeekRouter,
  pairs: pairsRouter,
  weeks: weeksRouter,
  generations: generationsRouter,
  schedule: scheduleRouter,
  lookup: lookupRouter,   // ✅ добавлено
});

export type AppRouter = typeof appRouter;