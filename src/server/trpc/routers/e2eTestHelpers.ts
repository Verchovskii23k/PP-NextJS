import { router, publicProcedure } from "../trpc";
import { clearDatabase, seedTestData, seedAuthUser } from "@/test/fixtures/fixtures";
import { z } from "zod";

export const e2eTestHelpersRouter = router({
  resetAndSeed: publicProcedure
    .input(z.object({
      adminEmail: z.string().email().optional(), // если нужен admin с email
    }).optional())
    .mutation(async ({ input }) => {
      await clearDatabase();
      await seedTestData();
      if (input?.adminEmail) {
        const creds = await seedAuthUser(input.adminEmail);
        return creds;
      }
      return null;
    }),

  // Можно добавить отдельно seedAuthUser, если нужно
  seedAdmin: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      return await seedAuthUser(input.email);
    }),
});