import Providers from "@/components/Providers";
import "./globals.css";
import { ConfirmProvider } from "@/contexts/ConfirmContext";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>
        <ConfirmProvider>
          <Providers>
            {children}
          </Providers>
        </ConfirmProvider>
      </body>
    </html>
  );
}