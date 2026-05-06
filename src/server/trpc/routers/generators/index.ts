import { router, adminProcedure } from "../../trpc";
import { generateGroupsRouter } from "./generateGroups";
import { generateUnitsRouter } from "./generateUnits";
import { generateLessonsRouter } from "./generateLessons";
import {assignClassroomsRouter} from "./assignClassrooms"
import { generateScheduleRouter } from "./generateSchedule";
import { clearGeneratedData } from "./clearGeneratedData";

export const generationsRouter = router({
  ...generateGroupsRouter._def.procedures,
  ...generateUnitsRouter._def.procedures,
  ...generateLessonsRouter._def.procedures,
  ...assignClassroomsRouter._def.procedures,
  ...generateScheduleRouter._def.procedures,
  resetGeneratedData: adminProcedure.mutation(async () => {
    await clearGeneratedData();
    return { success: true };
  }),
});