import { type FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { db } from "@/db";
import { parse } from "cookie";
import { getUserFromSession } from "@/server/auth/session"; // реализуем позже

export async function createContext(opts: FetchCreateContextFnOptions) {
  const cookieHeader = opts.req.headers.get("cookie") || "";
  const cookies = parse(cookieHeader);
  const sessionToken = cookies["session"];
  const user = sessionToken ? await getUserFromSession(sessionToken) : null;

  return {
    db,
    user,
    req: opts.req,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;