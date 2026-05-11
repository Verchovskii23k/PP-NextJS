// src/app/admin/crud/_components/DataTable.tsx
"use client";
import * as React from "react";
import { useRef, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type PaginationState,
  type ColumnFiltersState,
  type FilterFn,
} from "@tanstack/react-table";
import { trpc } from "@/trpc/client";
import { tablesMeta } from "@/lib/table-meta";
import { RecordForm } from "./RecordForm";
import { ForeignKeyCell } from "./ForeignKeyCell";
import { ColumnFilterPopover } from "./ColumnFilterPopover";
import { toast } from "sonner";

interface BaseRow extends Record<string, unknown> {
  id: number;
  isActive?: boolean;
}

interface CrudRouter {
  list: {
    useQuery: (input?: unknown, opts?: unknown) => {
      data?: BaseRow[];
      isLoading: boolean;
      isError: boolean;
      error: { message: string } | null;
    };
  };
  delete: {
    useMutation: (opts?: unknown) => {
      mutateAsync?: (input: { id: number }) => Promise<unknown>;
      mutate: (input: { id: number }) => void;
      isPending?: boolean;
    };
  };
}

const arrayFilterFn: FilterFn<BaseRow> = (row, columnId, filterValue: unknown[]) => {
  if (!filterValue || filterValue.length === 0) return true;
  const cellValue = row.getValue(columnId);
  return !filterValue.includes(cellValue);
};

interface DataTableProps {
  tableName: string;
}

export function DataTable({ tableName }: DataTableProps) {
  // ---------- все хуки на верхнем уровне ----------
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10000,
  });
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [showForm, setShowForm] = React.useState(false);
  const [editId, setEditId] = React.useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const meta = tablesMeta[tableName];
  const metaExists = meta !== undefined;

  const routerKey = meta?.routerKey as keyof typeof trpc;
  const router = metaExists
    ? (trpc as unknown as Record<string, CrudRouter>)[meta!.routerKey] as CrudRouter | undefined
    : undefined;

  const { data: rawData, isLoading, isError, error } = router?.list?.useQuery?.() ?? {
    data: [] as BaseRow[],
    isLoading: false,
    isError: false,
    error: { message: "" } as { message: string },
  };

  const rows: BaseRow[] = React.useMemo(() => rawData ?? [], [rawData]);
  const utils = trpc.useUtils();

  const deleteMutation = router?.delete?.useMutation?.({
    onSuccess: () => {
      (utils as unknown as Record<string, { list?: { invalidate?: () => void } }>)[routerKey]?.list?.invalidate?.()
    },
  });

  const deleteManyMutation = trpc.batchDelete.deleteMany.useMutation();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportQuery = trpc.crudImportExport.exportAll.useQuery(
    { tableName },
    { enabled: false }
  );
  const importMutation = trpc.crudImportExport.importData.useMutation();

  // ---------- эффект сброса ----------
  React.useEffect(() => {
    setSorting([]);
    setPagination({ pageIndex: 0, pageSize: 10000 });
    setGlobalFilter("");
    setColumnFilters([]);
    setSelectedIds(new Set());
  }, [tableName]);

  // ---------- вспомогательные функции ----------
  const toggleSelectAll = React.useCallback(() => {
    if (selectedIds.size === rows.length && rows.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map((r) => r.id)));
    }
  }, [selectedIds, rows]);

  const toggleSelectOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Удалить ${selectedIds.size} записей?`)) return;
    try {
      const result = await deleteManyMutation.mutateAsync({
        tableName,
        ids: Array.from(selectedIds),
      });
      let message = `Удалено: ${result.deleted}`;
      if (result.errors.length > 0) {
        message += `\nНе удалось удалить: ${result.errors.length}\n${result.errors
          .map((e) => `ID ${e.id}: ${e.message}`)
          .join("\n")}`;
      }
      toast(message);
      setSelectedIds(new Set());
      (utils as unknown as Record<string, { list?: { invalidate?: () => void } }>)[routerKey]?.list?.invalidate?.()
    } catch (e: unknown) {
      toast.error("Ошибка: " + (e instanceof Error ? e.message : "Неизвестная ошибка"));
    }
  };

  const handleExport = async () => {
    try {
      const result = await exportQuery.refetch();
      if (result.data) {
        const jsonStr = JSON.stringify(result.data, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${tableName}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        toast.error("Нет данных для экспорта");
      }
    } catch (e: unknown) {
      toast.error("Ошибка экспорта: " + (e instanceof Error ? e.message : "Неизвестная ошибка"));
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const json = JSON.parse(content);
        if (!Array.isArray(json)) throw new Error("Файл должен содержать массив объектов");
        const result = await importMutation.mutateAsync({ tableName, data: json });
        toast.success(
          `Импорт завершён:\nВсего: ${result.total}\nВставлено: ${result.inserted}\nОбновлено: ${result.updated}\nПропущено (совпадают): ${result.skipped}\nОшибок: ${result.errors.length}\n${result.errors.slice(0, 5).join("\n")}`
        );
        (utils as unknown as Record<string, { list?: { invalidate?: () => void } }>)[routerKey]?.list?.invalidate?.()
      } catch (e: unknown) {
        toast.error("Ошибка импорта: " + (e instanceof Error ? e.message : "Неизвестная ошибка"));
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  // ---------- колонки ----------
  const columns = React.useMemo<ColumnDef<BaseRow>[]>(() => {
    if (!metaExists) return [];

    const cols: ColumnDef<BaseRow>[] = [
      {
        id: "select",
        header: () => (
          <input
            type="checkbox"
            checked={rows.length > 0 && selectedIds.size === rows.length}
            onChange={toggleSelectAll}
            className="h-4 w-4 cursor-pointer rounded border-gray-300 text-primary focus:ring-primary"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={selectedIds.has(row.original.id)}
            onChange={() => toggleSelectOne(row.original.id)}
            className="h-4 w-4 cursor-pointer rounded border-gray-300 text-primary focus:ring-primary"
          />
        ),
        enableSorting: false,
        enableGlobalFilter: false,
      },
      {
        id: "index",
        header: "№",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {pagination.pageIndex * pagination.pageSize + row.index + 1}
          </span>
        ),
        enableSorting: false,
        enableGlobalFilter: false,
      },
    ];

    meta!.fields.forEach(field => {
      const columnDef: ColumnDef<BaseRow> = {
        id: field.dbName,
        accessorFn: (row) => row[field.dbName],
        header: () => (
          <div className="flex items-center">
            <span>{field.displayName}</span>
            <ColumnFilterPopover
              field={field}
              allValues={rows.map(row => row[field.dbName])}
              currentFilter={
                columnFilters.find(f => f.id === field.dbName)?.value as unknown[]
              }
              onFilterChange={(values) => {
                setColumnFilters(prev => {
                  const other = prev.filter(f => f.id !== field.dbName);
                  if (values && values.length > 0)
                    return [...other, { id: field.dbName, value: values }];
                  return other;
                });
              }}
            />
          </div>
        ),
        cell: ({ getValue }) => {
          const value = getValue();
          if (field.isFK && field.references) {
            return (
              <ForeignKeyCell
                table={field.references.table}
                id={value as number}
                displayField={field.references.displayField}
                dbTableName={field.references.dbTableName || tablesMeta[field.references.table]?.dbTableName}
              />
            );
          }
          if (value === null || value === undefined) return "—";
          return String(value);
        },
        enableSorting: true,
        filterFn: arrayFilterFn,
      };
      cols.push(columnDef);
    });

    cols.push({
      id: "actions",
      header: "Действия",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <button
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            onClick={() => {
              setEditId(row.original.id);
              setShowForm(true);
            }}
          >
            Ред.
          </button>
          <button
            className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
            onClick={async () => {
              if (!deleteMutation || !deleteMutation.mutateAsync) {
                toast.error('Удаление недоступно');
                return;
              }
              if (!window.confirm(`Удалить запись с ID ${row.original.id}?`)) return;
              try {
                await deleteMutation.mutateAsync({ id: row.original.id });
                (utils as unknown as Record<string, { list?: { invalidate?: () => void } }>)[routerKey]?.list?.invalidate?.()
              } catch (e: unknown) {
                toast.error(e instanceof Error ? e.message : "Ошибка");
                (utils as unknown as Record<string, { list?: { invalidate?: () => void } }>)[routerKey]?.list?.invalidate?.()
              }
            }}
          >
            Удалить
          </button>
        </div>
      ),
    });

    return cols;  
  }, [metaExists, meta, rows, selectedIds, toggleSelectAll, pagination.pageIndex, pagination.pageSize, columnFilters, deleteMutation, utils, routerKey]);

  React.useEffect(() => {
    const validIds = new Set(columns.map(col => col.id));
    const filtered = columnFilters.filter(f => validIds.has(f.id));
    if (filtered.length !== columnFilters.length) {
      setColumnFilters(filtered);
    }
  }, [columns, columnFilters]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, pagination, globalFilter, columnFilters },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: "auto",
    filterFns: {
      arrayFilter: arrayFilterFn,
    },
  });

  if (!metaExists) {
    return <div>Таблица не найдена</div>;
  }

  if (isLoading) return <div>Загрузка...</div>;
  if (isError && error) return <div className="text-red-500">Ошибка: {error.message}</div>;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <input
          placeholder="Поиск по всем полям..."
          value={globalFilter}
          onChange={e => setGlobalFilter(e.target.value)}
          className="max-w-sm rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground"
        />
        <button
          className="hover:bg-primary/90 rounded bg-primary px-3 py-1.5 text-sm text-white"
          onClick={() => {
            setEditId(null);
            setShowForm(true);
          }}
        >
          Добавить
        </button>
        <button
          className="rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
          onClick={handleExport}
          disabled={exportQuery.isFetching}
        >
          {exportQuery.isFetching ? "..." : "JSON-экспорт"}
        </button>
        <input
          type="file"
          accept=".json"
          ref={fileInputRef}
          className="hidden"
          onChange={handleImport}
        />
        <button
          className="rounded bg-yellow-600 px-3 py-1.5 text-sm text-white hover:bg-yellow-700"
          onClick={() => fileInputRef.current?.click()}
          disabled={importMutation.isPending}
        >
          {importMutation.isPending ? "..." : "JSON-импорт"}
        </button>
        {selectedIds.size > 0 && (
          <button
            className="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
            onClick={handleDeleteSelected}
            disabled={deleteManyMutation.isPending}
          >
            {deleteManyMutation.isPending
              ? "Удаление..."
              : `Удалить выбранные (${selectedIds.size})`}
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded border border-border">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    colSpan={header.colSpan}
                    className={`px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground ${
                      header.column.getCanSort()
                        ? "hover:bg-muted/70 cursor-pointer select-none"
                        : ""
                    }`}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {header.isPlaceholder ? null : (
                      <div className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{ asc: " 🔼", desc: " 🔽" }[header.column.getIsSorted() as string] ?? null}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="min-h-[300px] divide-y divide-border bg-background">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-4 text-center align-middle text-sm text-muted-foreground"
                >
                  <div className="flex h-full min-h-[250px] items-center justify-center">
                    Нет данных
                  </div>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => {
                const isSelected = selectedIds.has(row.original.id);
                return (
                  <tr
                    key={row.id}
                    className={`hover:bg-muted/50 ${
                      row.original.isActive === false ? "bg-red-50 dark:bg-red-900/20" : ""
                    } ${isSelected ? "bg-gray-100 dark:bg-gray-800" : ""}`}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td
                        key={cell.id}
                        className="whitespace-nowrap px-4 py-2 text-sm text-foreground"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {table.getPageCount() > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Страница {pagination.pageIndex + 1} из {table.getPageCount()}
          </div>
          <div className="flex gap-2">
            <button
              className="rounded border border-border bg-background px-3 py-1 text-sm text-foreground disabled:opacity-50"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Назад
            </button>
            <button
              className="rounded border border-border bg-background px-3 py-1 text-sm text-foreground disabled:opacity-50"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Вперёд
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <RecordForm
          tableName={tableName}
          editId={editId}
          onClose={() => {
            setShowForm(false);
            setEditId(null);
            (utils as unknown as Record<string, { list?: { invalidate?: () => void } }>)[routerKey]?.list?.invalidate?.()
          }}
        />
      )}
    </div>
  );
}