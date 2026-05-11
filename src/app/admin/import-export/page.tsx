"use client";
import { trpc } from "@/trpc/client";
import { useState } from "react";

export default function ImportExportPage() {
  const [message, setMessage] = useState("");
  const [importResult, setImportResult] = useState<Record<string, { inserted: number; updated: number; skipped: number; errors: string[] }> | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const exportQuery = trpc.globalImportExport.exportAll.useQuery(undefined, {
    enabled: false, // ручной вызов
  });

    const importMutation = trpc.globalImportExport.importAll.useMutation({
    onSuccess: (data) => {
        setImportResult(data);
        setMessage("Импорт завершён");
        setIsImporting(false);
    },
    onError: (error) => {
        setMessage(`Ошибка импорта: ${error.message}`);
        setIsImporting(false);
    },
    });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportQuery.refetch();
      if (result.data) {
        const json = JSON.stringify(result.data, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "backup.json";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setMessage("Экспорт выполнен");
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Неизвестная ошибка";
      setMessage(`Ошибка экспорта: ${message}`);
    }
    setIsExporting(false);
  };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setMessage("Импорт начат...");
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
        const raw = event.target?.result as string;
        const data = JSON.parse(raw);
        // Передаём сам объект, без обёртки
        await importMutation.mutateAsync(data);
        } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Неизвестная ошибка";
        setMessage(`Ошибка экспорта: ${message}`);
        setIsImporting(false);
        }
    };
    reader.readAsText(file);
    };

  return (
    <div className="mx-auto max-w-3xl bg-background p-6 text-foreground">
      <h1 className="mb-6 text-2xl font-bold">Импорт / Экспорт данных</h1>

      <div className="space-y-6">
        <section className="rounded-lg border border-border bg-muted p-4">
          <h2 className="mb-2 text-lg font-semibold">Экспорт справочников</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Скачать все справочные таблицы в формате JSON (исключая расписание, занятия и учётные записи).
          </p>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isExporting ? "Экспорт..." : "Скачать JSON"}
          </button>
        </section>

        <section className="rounded-lg border border-border bg-muted p-4">
          <h2 className="mb-2 text-lg font-semibold">Импорт справочников</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Загрузите JSON-файл, экспортированный из этой системы. <br />
            <strong>Внимание:</strong> дубликаты в таблицах сотрудников и студентов будут созданы заново. Остальные записи обновятся при совпадении уникальных полей.
          </p>
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            disabled={isImporting}
            className="hover:file:bg-primary/90 block w-full text-sm
              text-foreground file:mr-4 file:rounded
              file:border-0 file:bg-primary
              file:px-4 file:py-2
              file:text-sm file:font-medium
              file:text-white
              disabled:opacity-50"
          />
          {isImporting && <p className="mt-2 text-sm text-blue-600">Импорт выполняется...</p>}
        </section>

        {message && (
          <div className="rounded border border-green-400 bg-green-100 p-3 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
            {message}
          </div>
        )}

        {importResult && (
          <div className="bg-card rounded border border-border p-4">
            <h3 className="mb-2 font-semibold">Результаты импорта</h3>
            <div className="space-y-2 text-sm">
              {Object.entries(importResult as Record<string, { inserted: number; updated: number; skipped: number; errors: string[] }>).map(([table, stats]) => (
                <div key={table} className="border-t border-border pt-2">
                  <strong>{table}</strong>: вставлено {stats.inserted}, обновлено {stats.updated}, пропущено {stats.skipped}
                  {stats.errors.length > 0 && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-red-500">
                        Ошибки ({stats.errors.length})
                      </summary>
                      <ul className="list-disc pl-5 text-red-600 dark:text-red-400">
                        {stats.errors.map((err: string, i: number) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}