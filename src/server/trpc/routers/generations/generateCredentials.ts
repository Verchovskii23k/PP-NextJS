// src/server/trpc/routers/generations/generateCredentials.ts
import { z } from "zod";
import { router, adminProcedure } from "../../trpc";
import { users, employees, students } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { accounts } from "@/db/schema";  // таблица accounts
import { makeEmail, generateRandomPassword, hashPassword } from '@/lib/password';
// ---------- Роутер ----------

export const generateCredentialsRouter = router({
  generateCredentials: adminProcedure
    .input(z.object({
      securityLevel: z.enum(["low", "medium", "high"]),
      loginLength: z.number().int().min(6).max(32).optional(),
      generateFor: z.array(z.enum(["employees", "students"])).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const { securityLevel: _securityLevel, loginLength: _loginLength, generateFor } = input;
      const newCredentials: {
        fullName: string;
        email: string;
        password: string;
        role: string;
      }[] = [];

      const processPerson = async (
        person: { id: number;
          surname: string;
          name: string;
          patronymic?: string | null;
          isAdmin?: boolean,
          email?: string | null;
         },
        type: "employee" | "student"
      ) => {
        const fullName = [person.surname, person.name, person.patronymic].filter(Boolean).join(" ");
        const email = person.email || makeEmail(person.surname, person.name);
        const password = generateRandomPassword();

        const role = type === "student" ? "student" : (person.isAdmin ? "admin" : "teacher");
        const hashed = await hashPassword(password)
        const [newUser] = await ctx.db.insert(users).values({
          email,
          role,
          hashedPassword: hashed,
        }).returning({ id: users.id });
        // Сохраняем пароль в таблице accounts
        
        await ctx.db.insert(accounts).values({
          userId: newUser.id,
          providerId: "credential",
          accountId: email,
          password: hashed,
        });

        if (type === "student") {
          await ctx.db.update(students).set({ userId: newUser.id }).where(eq(students.id, person.id));
        } else {
          await ctx.db.update(employees).set({ userId: newUser.id }).where(eq(employees.id, person.id));
        }

        newCredentials.push({ fullName, email, password, role });
      };

      await ctx.db.transaction(async (tx) => {
        if (generateFor.includes("employees")) {
        const employeeList = await tx
          .select({
            id: employees.id,
            surname: employees.surname,
            name: employees.name,
            patronymic: employees.patronymic,
            isAdmin: employees.isAdmin,
          })
          .from(employees)
          .where(and(eq(employees.isActive, true), isNull(employees.userId)));

          for (const emp of employeeList) {
            await processPerson(emp, "employee");
          }
        }

        if (generateFor.includes("students")) {
        const studentList = await tx
          .select({
            id: students.id,
            surname: students.surname,
            name: students.name,
          })
          .from(students)
          .where(and(eq(students.isActive, true), isNull(students.userId)));

          for (const st of studentList) {
            await processPerson({ ...st, isAdmin: false }, "student");
          }
        }
      });

      return { count: newCredentials.length, credentials: newCredentials };
    }),
});