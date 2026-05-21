import Link from 'next/link';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/config';      // объект betterAuth, НЕ функция
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export default async function HomePage() {
  // 1. Получаем сессию правильно – через auth.api.getSession
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // 2. Проверяем, есть ли администратор (только если неавторизован)
  let hasAdmin = false;
  if (!session?.user) {
    const [admin] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'admin'))
      .limit(1);
    hasAdmin = !!admin;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Расписание университета
      </h1>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">
        Храните все нужные данные в одном месте. Используйте генераторы для рутинных задач.
      </p>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">
        Автоматизируйте планирование занятий, управляйте аудиториями и группами.
        Быстро, удобно и без ошибок.
      </p>

      <div className="mt-10">
        {session?.user ? (
          <Link
            href="/admin"
            className="hover:bg-primary/90 rounded-lg bg-primary px-8 py-3 text-lg font-medium text-white shadow transition-colors"
          >
            Перейти в панель управления
          </Link>
        ) : hasAdmin ? (
          <Link
            href="/login"
            className="hover:bg-primary/90 rounded-lg bg-primary px-8 py-3 text-lg font-medium text-white shadow transition-colors"
          >
            Войти
          </Link>
        ) : (
          <Link
            href="/setup"
            className="hover:bg-primary/90 rounded-lg bg-primary px-8 py-3 text-lg font-medium text-white shadow transition-colors"
          >
            Зарегистрировать администратора
          </Link>
        )}
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        {session?.user
          ? `Последний раз вы вошли как ${session.user.email || 'пользователь'}.`
          : 'Для начала работы войдите или создайте учётную запись администратора.'}
      </p>
    </main>
  );
}