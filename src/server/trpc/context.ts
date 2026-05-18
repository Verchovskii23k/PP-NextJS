import { type FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { db } from "@/db";
import { auth } from "@/lib/auth/config";

export async function createContext(opts: FetchCreateContextFnOptions) {
  const session = await auth.api.getSession({
    headers: opts.req.headers,
  });

  return {
    db,
    session,
    req: opts.req,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;