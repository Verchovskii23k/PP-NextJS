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

const arrayFilterFn: FilterFn<any> = (row, columnId, filterValue: any[]) => {
  if (!filterValue || filterValue.length === 0) return true;
  const cellValue = row.getValue(columnId);
  return !filterValue.includes(cellValue);
};

interface DataTableProps {
  tableName: string;
}

export function DataTable({ tableName }: DataTableProps) {
  const meta = tablesMeta[tableName];
  if (!meta) return <div>Таблица не найдена</div>;

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10000,
  });
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [showForm, setShowForm] = React.useState(false);
  const [editId, setEditId] = React.useState<number | null>(null);

  const routerKey = meta.routerKey as keyof typeof trpc;
  const { data, isLoading, isError, error } = (trpc as any)[routerKey]?.list?.useQuery?.();

  const utils = trpc.useUtils();
  const deleteMutation = (trpc as any)[routerKey]?.delete?.useMutation?.({
    onSuccess: () => {
      (utils as any)[routerKey]?.list?.invalidate?.();
    },
  });

  // ========== Массовое удаление ==========
  const deleteManyMutation = trpc.batchDelete.deleteMany.useMutation();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const rows = (data as any[]) ?? [];

  const toggleSelectAll = () => {
    if (selectedIds.size === rows.length && rows.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map((r) => r.id)));
    }
  };

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
      alert(message);
      setSelectedIds(new Set());
      (utils as any)[routerKey]?.list?.invalidate?.();
    } catch (err: any) {
      alert("Ошибка: " + err.message);
    }
  };
  // =====================================

  // ---------- JSON импорт/экспорт ----------
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportQuery = trpc.crudImportExport.exportAll.useQuery(
    { tableName },
    { enabled: false }
  );
  const importMutation = trpc.crudImportExport.importData.useMutation();

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
        alert("Нет данных для экспорта");
      }
    } catch (err: any) {
      alert("Ошибка экспорта: " + err.message);
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
        alert(
          `Импорт завершён:\nВсего: ${result.total}\nВставлено: ${result.inserted}\nОбновлено: ${result.updated}\nПропущено (совпадают): ${result.skipped}\nОшибок: ${result.errors.length}\n${result.errors.slice(0, 5).join("\n")}`
        );
        (utils as any)[routerKey]?.list?.invalidate?.();
      } catch (err: any) {
        alert("Ошибка импорта: " + err.message);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };
  // -----------------------------------------

  // Сброс состояний при переключении таблицы
  React.useEffect(() => {
    setSorting([]);
    setPagination({ pageIndex: 0, pageSize: 10000 });
    setGlobalFilter("");
    setColumnFilters([]);
    setSelectedIds(new Set());
  }, [tableName]);

  const columns = React.useMemo<ColumnDef<any>[]>(() => {
    const cols: ColumnDef<any>[] = [
      // Колонка выбора (чекбоксы)
      {
        id: "select",
        header: () => (
          <input
            type="checkbox"
            checked={rows.length > 0 && selectedIds.size === rows.length}
            onChange={toggleSelectAll}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={selectedIds.has(row.original.id)}
            onChange={() => toggleSelectOne(row.original.id)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
          />
        ),
        enableSorting: false,
        enableGlobalFilter: false,
      },
      // Нумерация
      {
        id: "index",
        header: "№",
        cell: ({ row }) => {
          const visibleRows = table.getRowModel().rows;
          const rowIndex = visibleRows.findIndex(r => r.id === row.id);
          return (
            <span className="text-muted-foreground text-xs">
              {pagination.pageIndex * pagination.pageSize + rowIndex + 1}
            </span>
          );
        },
        enableSorting: false,
        enableGlobalFilter: false,
      },
    ];

    // Остальные колонки из метаданных
    meta.fields.forEach(field => {
      const columnDef: ColumnDef<any> = {
        id: field.dbName,
        accessorFn: (row: any) => row[field.dbName],
        header: () => (
          <div className="flex items-center">
            <span>{field.displayName}</span>
            <ColumnFilterPopover
              field={field}
              allValues={rows.map(row => row[field.dbName])}
              currentFilter={
                columnFilters.find(f => f.id === field.dbName)?.value as any[]
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
        cell: ({ getValue }: any) => {
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

    // Действия
    cols.push({
      id: "actions",
      header: "Действия",
      cell: ({ row }: any) => (
        <div className="flex gap-2">
          <button
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm"
            onClick={() => {
              setEditId(row.original.id);
              setShowForm(true);
            }}
          >
            Ред.
          </button>
          <button
            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm"
            onClick={async () => {
              if (!deleteMutation || !deleteMutation.mutateAsync) {
                alert('Удаление недоступно');
                return;
              }
              if (!window.confirm(`Удалить запись с ID ${row.original.id}?`)) return;
              try {
                await deleteMutation.mutateAsync({ id: row.original.id });
                (utils as any)[routerKey]?.list?.invalidate?.();
              } catch (e: any) {
                alert(e.message);
                (utils as any)[routerKey]?.list?.invalidate?.();
              }
            }}
          >
            Удалить
          </button>
        </div>
      ),
    });

    return cols;
  }, [meta, rows, columnFilters, pagination.pageIndex, pagination.pageSize, deleteMutation, selectedIds]);

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

  if (isLoading) return <div>Загрузка...</div>;
  if (isError) return <div className="text-red-500">Ошибка: {error.message}</div>;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <input
          placeholder="Поиск по всем полям..."
          value={globalFilter}
          onChange={e => setGlobalFilter(e.target.value)}
          className="border border-border rounded px-3 py-1.5 text-sm max-w-sm bg-background text-foreground placeholder:text-muted-foreground"
        />
        <button
          className="px-3 py-1.5 bg-primary text-white rounded text-sm hover:bg-primary/90"
          onClick={() => {
            setEditId(null);
            setShowForm(true);
          }}
        >
          Добавить
        </button>
        <button
          className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700"
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
          className="px-3 py-1.5 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
          onClick={() => fileInputRef.current?.click()}
          disabled={importMutation.isPending}
        >
          {importMutation.isPending ? "..." : "JSON-импорт"}
        </button>
        {/* Кнопка массового удаления */}
        {selectedIds.size > 0 && (
          <button
            className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700"
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
                        ? "cursor-pointer select-none hover:bg-muted/70"
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
          <tbody className="bg-background divide-y divide-border min-h-[300px]">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-4 text-center text-sm text-muted-foreground align-middle"
                >
                  <div className="flex items-center justify-center h-full min-h-[250px]">
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
                        className="px-4 py-2 whitespace-nowrap text-sm text-foreground"
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
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            Страница {pagination.pageIndex + 1} из {table.getPageCount()}
          </div>
          <div className="flex gap-2">
            <button
              className="px-3 py-1 border border-border bg-background text-foreground rounded text-sm disabled:opacity-50"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Назад
            </button>
            <button
              className="px-3 py-1 border border-border bg-background text-foreground rounded text-sm disabled:opacity-50"
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
            (utils as any)[routerKey]?.list?.invalidate?.();
          }}
        />
      )}
    </div>
  );
}