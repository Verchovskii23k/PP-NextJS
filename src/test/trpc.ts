import { createContext } from '@/server/trpc/context';
import { appRouter } from '@/server/trpc/router';
import { createCallerFactory } from '@/server/trpc/trpc';

const createCaller = createCallerFactory(appRouter);

export async function createTestCaller(user?: { id: number; role: string } | null) {
  const reqUrl = new URL('http://localhost:3000/api/trpc');
  const resHeaders = new Headers();

  const ctx = await createContext({
    req: new Request(reqUrl),
    resHeaders,
    info: {
      calls: [],
      accept: 'application/jsonl',
      type: 'query',
      isBatchCall: false,
      connectionParams: null,
      signal: new AbortController().signal,
      url: reqUrl,
    } as any,  // обходим строгую проверку типа
  });

  if (user) {
    (ctx as any).user = user;
  }

  return createCaller(ctx);
}