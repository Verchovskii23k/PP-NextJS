import { initTRPC, TRPCError } from '@trpc/server';
import type { Context } from './context';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    const cause = error.cause;
    // Проверяем, что это объект с полями code и message (наш TRPCError или его обёртка)
    if (cause && typeof cause === 'object' && 'code' in cause && 'message' in cause) {
      return {
        ...shape,
        message: cause.message as string,
        data: {
          ...shape.data,
          code: cause.code,
        },
      };
    }
    return {
      ...shape,
      message: 'Возникла непредвиденная ошибка. Попробуйте позже или обратитесь в службу поддержки',
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  // Загружаем актуальную роль из базы, чтобы избежать кэширования
  let role = (ctx.session.user as unknown as { role?: string }).role;
  if (!role) {
    const [dbUser] = await ctx.db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, ctx.session.user.id))
      .limit(1);
    role = dbUser?.role;
  }

  return next({
    ctx: {
      ...ctx,
      user: { id: ctx.session.user.id, role: role || 'student' },
    },
  });
});

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user?.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next({ ctx });
});