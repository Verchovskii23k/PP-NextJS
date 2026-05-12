// src/test/trpc.ts
import { createContext } from '@/server/trpc/context';
import { appRouter } from '@/server/trpc/router';
import { createCallerFactory } from '@/server/trpc/trpc';
import { TRPCRequestInfo } from '@trpc/server/unstable-core-do-not-import';


const createCaller = createCallerFactory(appRouter);

export async function createTestCaller(user?: { id: number; role: string } | null) {
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

  // Если контекст должен содержать пользователя, подставим
  if (user) {
    (ctx as Record<string, unknown>).user = user;
  }

  return createCaller(ctx);
}