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

function makeLogin(base: string, prefix: string, checkUnique: (login: string) => Promise<boolean>): Promise<string> {
  return (async () => {
    let login = prefix + base;
    // Обрезаем до 16 символов
    if (login.length > 16) login = login.slice(0, 16);
    let counter = 1;
    while (!(await checkUnique(login))) {
      counter++;
      const suffix = String(counter);
      const truncated = login.slice(0, 16 - suffix.length - 1);
      login = truncated + suffix;
      if (counter > 100) {
        // fallback: добавим случайный хвост
        const randomPart = Math.random().toString(36).slice(2, 6);
        login = (prefix + base).slice(0, 12) + '_' + randomPart;
        break;
      }
    }
    return login;
  })();
}

function randomLogin(length: number, charset: string, checkUnique: (login: string) => Promise<boolean>): Promise<string> {
  return (async () => {
    for (let i = 0; i < 100; i++) {
      const login = Array.from({ length }, () => charset[Math.floor(Math.random() * charset.length)]).join('');
      if (await checkUnique(login)) return login;
    }
    // последняя попытка с таймстемпом
    const ts = String(Date.now()).slice(-4);
    return Array.from({ length: length - 4 }, () => charset[Math.floor(Math.random() * charset.length)]).join('') + ts;
  })();
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

      // Получаем роли
      const roleRecords = await ctx.db.select().from(roles);
      const teacherRole = roleRecords.find(r => r.name === "teacher");
      const studentRole = roleRecords.find(r => r.name === "student");
      if (!teacherRole || !studentRole) throw new Error("Роли 'teacher' и 'student' должны существовать");

      // Функция проверки уникальности логина в security_center
      const isLoginUnique = async (login: string) => {
        const [row] = await ctx.db
          .select({ id: securityCenter.id })
          .from(securityCenter)
          .where(eq(securityCenter.login, login))
          .limit(1);
        return !row; // true если нет записи
      };

      // Функция генерации для одной персоны
      const processPerson = async (
        person: { id: number; surname: string; name: string; patronymic?: string | null },
        type: "employee" | "student"
      ) => {
        const fullName = [person.surname, person.name, person.patronymic].filter(Boolean).join(" ");
        const base = transliterate(person.surname);

        // Генерация логина в зависимости от уровня
        let login: string;
        if (securityLevel === "low") {
          const prefix = type === "student" ? "s_" : "t_";
          login = await makeLogin(base || "user", prefix, isLoginUnique);
        } else if (securityLevel === "medium") {
          const len = Math.floor(Math.random() * 5) + 8; // 8-12
          const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
          login = await randomLogin(len, charset, isLoginUnique);
        } else {
          // high
          const len = loginLength || 16;
          const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
          login = await randomLogin(len, charset, isLoginUnique);
        }

        const password = generateRandomPassword();
        const hashed = await hashPassword(password);

        // Вставляем в security_center
        const [newSec] = await ctx.db
          .insert(securityCenter)
          .values({
            login,
            passwordHash: hashed,
            roleId: type === "student" ? studentRole.id : teacherRole.id,
          })
          .returning({ id: securityCenter.id });

        // Обновляем соответствующую таблицу
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
          role: type === "student" ? "Студент" : "Преподаватель",
        });
      };

      // Транзакция
      await ctx.db.transaction(async (tx) => {
        // Обработка сотрудников
        if (generateFor.includes("employees")) {
          const employeeList = await tx
            .select({
              id: employees.id,
              surname: employees.surname,
              name: employees.name,
              patronymic: employees.patronymic,
            })
            .from(employees)
            .where(and(eq(employees.isActive, true), isNull(employees.authenticationId)));

          for (const emp of employeeList) {
            await processPerson(emp, "employee");
          }
        }

        // Обработка студентов
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
            await processPerson({ ...st, patronymic: null }, "student");
          }
        }
      });

      return {
        count: newCredentials.length,
        credentials: newCredentials,
      };
    }),
});