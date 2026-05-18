import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verificationToken: schema.verificationTokens,
    },
  }),
  plugins: [nextCookies()],
  emailAndPassword: {
    enabled: true, // ОБЯЗАТЕЛЬНО для работы signIn.email
    password: {
      hash: async (password: string) => {
        return await bcrypt.hash(password, 10);
      },
      verify: async ({ hash, password }: { hash: string; password: string }) => {
        return await bcrypt.compare(password, hash);
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  callbacks: {
    async session({ session, user }: { session: Record<string, unknown>; user: Record<string, unknown> }) {
      const [dbUser] = await db
        .select({ role: schema.users.role })
        .from(schema.users)
        .where(eq(schema.users.id, user.id as string))
        .limit(1);

      return {
        ...session,
        user: {
          ...session.user as Record<string, unknown>,
          role: (dbUser?.role || 'student') as string,
        },
      };
    },
  },
});