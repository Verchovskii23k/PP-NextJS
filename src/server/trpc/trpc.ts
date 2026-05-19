import { initTRPC, TRPCError } from '@trpc/server';
import type { Context } from './context';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Рекурсивно извлекает первое осмысленное TRPCError-сообщение из цепочки ошибок
function extractBusinessError(error: unknown): { message: string; code: string } | null {
  let current = error;
  while (current) {
    if (
      typeof current === 'object' &&
      current !== null &&
      'code' in current &&
      'message' in current &&
      typeof (current as Record<string, unknown>).code === 'string' &&
      typeof (current as Record<string, unknown>).message === 'string'
    ) {
      const code = (current as Record<string, unknown>).code as string;
      const message = (current as Record<string, unknown>).message as string;
      if (
        code !== 'INTERNAL_SERVER_ERROR' &&
        message !== 'Возникла непредвиденная ошибка. Попробуйте позже или обратитесь в службу поддержки'
      ) {
        return { message, code };
      }
    }
    if (current instanceof Error && current.cause) {
      current = current.cause;
    } else {
      break;
    }
  }
  return null;
}

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    const business = extractBusinessError(error);
    if (business) {
      return {
        ...shape,
        message: business.message,
        data: {
          ...shape.data,
          code: business.code, // можно передавать на клиент для доп. проверок
        },
      };
    }
    // Общий fallback
    return {
      ...shape,
      message:
        'Возникла непредвиденная ошибка. Попробуйте позже или обратитесь в службу поддержки',
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