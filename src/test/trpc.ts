// src/test/trpc.ts

import { createContext, type Context } from '@/server/trpc/context';
import { appRouter } from '@/server/trpc/router';
import { createCallerFactory } from '@/server/trpc/trpc';
import { TRPCRequestInfo } from '@trpc/server/unstable-core-do-not-import';

const createCaller = createCallerFactory(appRouter);

// Минимальная структура сессии, требуемая protectedProcedure
interface MockSession {
  user: {
    id: string;
    role: string;
    email?: string;
  };
  expires: Date;
  sessionToken: string;
}

export async function createTestCaller(user?: { id: string | number; role: string } | null) {
  const reqUrl = new URL('http://localhost:3000/api/trpc');
  const resHeaders = new Headers();

  const info: TRPCRequestInfo = {
    calls: [],
    accept: 'application/jsonl',
    type: 'query',
    isBatchCall: false,
    connectionParams: null,
    signal: new AbortController().signal,
    url: reqUrl,
  };

  const ctx = await createContext({
    req: new Request(reqUrl),
    resHeaders,
    info,
  });

  if (user) {
    const userIdStr = typeof user.id === 'number' ? String(user.id) : user.id;
    const mockSession: MockSession = {
      user: {
        id: userIdStr,
        role: user.role || 'student',
        email: 'test@test.local',
      },
      expires: new Date(Date.now() + 3600000), // +1 час
      sessionToken: 'test-session-token',
    };

    // Приводим к типу сессии из контекста (обычно Session | null)
    ctx.session = mockSession as unknown as Context['session'];
  }

  return createCaller(ctx);
}