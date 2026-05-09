"use client";
import { ThemeProvider } from "next-themes";
import { TRPCProvider } from "@/trpc/provider";
import ThemeToggle from "./ThemeToggle";
import Link from "next/link";
import { Home, LogOut } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { trpc } from "@/trpc/client";

function HeaderContent() {
  const pathname = usePathname();
  const isLoginPage = pathname.startsWith("/login");
  const isSetupPage = pathname.startsWith("/setup");
  const isPublicPage = isLoginPage || isSetupPage;

  const { data: user } = trpc.auth.me.useQuery();
  const logoutMut = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.href = "/login";
    },
  });

  const homePath =
    user?.role === "admin"
      ? "/admin"
      : user?.role === "teacher"
      ? "/teacher"
      : user?.role === "student"
      ? "/student"
      : "/login";

  const roleLabel = (role: string) => {
    switch (role) {
      case "admin": return "Администратор";
      case "teacher": return "Преподаватель";
      case "student": return "Студент";
      default: return role;
    }
  };

  return (
    <header className="border-b border-border bg-muted">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 h-12">
        {/* Левая группа: домик + ФИО/роль */}
        <div className="flex items-center gap-4">
          {!isPublicPage && (
            <Link
              href={homePath}
              className="flex items-center gap-1.5 text-foreground hover:text-primary transition-colors"
              aria-label="На главную"
            >
              <Home size={20} />
              <span className="text-sm font-medium hidden sm:inline">Главная</span>
            </Link>
          )}
          {isPublicPage && <div />}
          
          {!isPublicPage && user && (
            <div>
              <div className="text-sm font-medium leading-tight text-foreground">
                {user.fullName}
              </div>
              <div className="text-xs text-muted-foreground leading-tight">
                {roleLabel(user.role)}
              </div>
            </div>
          )}
        </div>

        {/* Правая группа: тема + выход */}
        <div className="flex items-center gap-4">
          <ThemeToggle />
          {!isPublicPage && user && (
            <button
              onClick={() => logoutMut.mutate()}
              disabled={logoutMut.isPending}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Выйти"
            >
              <LogOut size={20} />
              <span className="text-sm font-medium hidden sm:inline">Выйти</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TRPCProvider>
        <HeaderContent />
        <main className="min-h-screen bg-background text-foreground">
          {children}
        </main>
      </TRPCProvider>
    </ThemeProvider>
  );
}