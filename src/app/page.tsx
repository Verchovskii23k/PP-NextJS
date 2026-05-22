"use client";
import Link from 'next/link';
import { trpc } from "@/trpc/client";
import { PageSkeleton } from '@/components/ui/page_skeleton';

export default function HomePage() {
  const { data: me, isLoading } = trpc.auth.me.useQuery();

  if(isLoading) return <PageSkeleton/>

  const dashboardLink =
    me?.role === 'teacher' ? '/teacher' :
    me?.role === 'student' ? '/student' :
    '/admin'; // admin или если роль не определена (но такого почти не бывает)

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
        {me ? (
          <Link
            href={dashboardLink}
            className="hover:bg-primary/90 rounded-lg bg-primary px-8 py-3 text-lg font-medium text-white shadow transition-colors"
          >
            Перейти в панель управления
          </Link>
        ) : (
          <Link
            href="/login"
            className="hover:bg-primary/90 rounded-lg bg-primary px-8 py-3 text-lg font-medium text-white shadow transition-colors"
          >
            Войти
          </Link>
        )}
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        {me
          ? `Вы вошли как ${me.fullName || me.email}.`
          : 'Для начала работы войдите или создайте учётную запись администратора.'}
      </p>
    </main>
  );
}