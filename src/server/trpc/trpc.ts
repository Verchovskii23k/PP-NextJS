import { initTRPC, TRPCError } from "@trpc/server";
// import superjson from "superjson"; // опционально, установим позже
import { Context } from "./context";

const t = initTRPC.context<Context>().create({
//   transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;

// Middleware для проверки роли
export const adminProcedure = publicProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user || ctx.user.role !== "admin") {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next();
});