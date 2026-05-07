// src/server/trpc/routers/generations/generateCredentials.ts
import { z } from "zod";
import { router, adminProcedure } from "../../trpc";
import { securityCenter, employees, students, roles } from "@/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { hashPassword } from "@/server/auth/password";

// ---------- Вспомогательные функции (портированы из Python) ----------

function transliterate(name: string): string {
  const map: Record<string, string> = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh',
    'з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o',
    'п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c',
    'ч':'ch','ш':'sh','щ':'sch','ы':'y','э':'e','ю':'yu','я':'ya'
  };
  const lower = name.toLowerCase();
  let result = '';
  for (const ch of lower) {
    if (map[ch]) result += map[ch];
    else if (/[a-zA-Z0-9]/.test(ch)) result += ch;
    else if (' -_'.includes(ch)) result += '_';
  }
  // Удаляем двойные подчёркивания
  result = result.replace(/__+/g, '_');
  // Обрезаем до 10 символов
  if (result.length > 10) result = result.slice(0, 10);
  // Удаляем подчёркивание в конце
  return result.replace(/_$/, '');
}

function generateRandomPassword(): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const all = upper + lower + digits;

  const getRandom = (source: string, count: number) =>
    Array.from({ length: count }, () => source[Math.floor(Math.random() * source.length)]).join('');

  // 2 заглавные, 2 строчные, 2 цифры, 2 любые буквы/цифры
  let password = getRandom(upper, 2) + getRandom(lower, 2) + getRandom(digits, 2) + getRandom(all, 2);
  // Перемешиваем
  password = password.split('').sort(() => Math.random() - 0.5).join('');

  // Проверка на тривиальные последовательности (при необходимости перегенерируем)
  const forbidden = ['123','234','345','456','567','678','789','890',
                     'abc','bcd','cde','def','efg','fgh','ghi','hij',
                     'ijk','jkl','klm','lmn','mno','nop','opq','pqr',
                     'qrs','rst','stu','tuv','uvw','vwx','wxy','xyz'];
  if (forbidden.some(seq => password.toLowerCase().includes(seq))) {
    return generateRandomPassword(); // рекурсивно
  }
  return password;
}

// ---------- Вспомогательные функции (без проверок уникальности) ----------

function makeLogin(base: string, prefix: string): string {
  let login = prefix + base;
  if (login.length > 16) login = login.slice(0, 16);
  return login;
}

function randomLogin(length: number, charset: string): string {
  return Array.from({ length }, () => charset[Math.floor(Math.random() * charset.length)]).join('');
}

// ---------- Роутер ----------

export const generateCredentialsRouter = router({
  generateCredentials: adminProcedure
    .input(
      z.object({
        securityLevel: z.enum(["low", "medium", "high"]),
        loginLength: z.number().int().min(6).max(32).optional(),
        generateFor: z.array(z.enum(["employees", "students"])).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { securityLevel, loginLength, generateFor } = input;
      const newCredentials: {
        fullName: string;
        login: string;
        password: string;
        role: string;
      }[] = [];

      // Получаем все роли
      const roleRecords = await ctx.db.select().from(roles);
      const teacherRole = roleRecords.find(r => r.name === "teacher");
      const studentRole = roleRecords.find(r => r.name === "student");
      const adminRole = roleRecords.find(r => r.name === "admin");
      if (!teacherRole || !studentRole || !adminRole) throw new Error("Роли 'teacher', 'student' и 'admin' должны существовать");

      const isLoginUnique = async () => true;

      const processPerson = async (
        person: { id: number; surname: string; name: string; patronymic?: string | null; isAdmin?: boolean },
        type: "employee" | "student"
      ) => {
        const fullName = [person.surname, person.name, person.patronymic].filter(Boolean).join(" ");
        const base = transliterate(person.surname);

        let login: string;
        if (securityLevel === "low") {
          const prefix = type === "student" ? "s_" : "t_";
          login = makeLogin(base || "user", prefix);
        } else if (securityLevel === "medium") {
          const len = Math.floor(Math.random() * 5) + 8;
          const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
          login = randomLogin(len, charset);
        } else {
          const len = loginLength || 16;
          const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
          login = randomLogin(len, charset);
        }

        const password = generateRandomPassword();
        const hashed = await hashPassword(password);

        const roleId = type === "student"
          ? studentRole.id
          : (person.isAdmin ? adminRole.id : teacherRole.id);

        const [newSec] = await ctx.db
          .insert(securityCenter)
          .values({
            login,
            passwordHash: hashed,
            roleId,
          })
          .returning({ id: securityCenter.id });

        if (type === "student") {
          await ctx.db
            .update(students)
            .set({ authenticationId: newSec.id })
            .where(eq(students.id, person.id));
        } else {
          await ctx.db
            .update(employees)
            .set({ authenticationId: newSec.id })
            .where(eq(employees.id, person.id));
        }

        newCredentials.push({
          fullName,
          login,
          password,
          role: type === "student" ? "Студент" : (person.isAdmin ? "Администратор" : "Преподаватель"),
        });
      };

      await ctx.db.transaction(async (tx) => {
        if (generateFor.includes("employees")) {
          const employeeList = await tx
            .select({
              id: employees.id,
              surname: employees.surname,
              name: employees.name,
              patronymic: employees.patronymic,
              isAdmin: employees.isAdmin, // важно
            })
            .from(employees)
            .where(and(eq(employees.isActive, true), isNull(employees.authenticationId)));

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
              patronymic: sql<string | null>`NULL`.mapWith(String),
            })
            .from(students)
            .where(and(eq(students.isActive, true), isNull(students.authenticationId)));

          for (const st of studentList) {
            await processPerson({ ...st, patronymic: null, isAdmin: false }, "student");
          }
        }
      });

      return {
        count: newCredentials.length,
        credentials: newCredentials,
      };
    }),
});