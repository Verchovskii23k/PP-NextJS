// src/app/admin/crud/_components/DataTable.tsx
"use client";
import * as React from "react";
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
import { tablesMeta } from "@/lib/tableMeta";
import { RecordForm } from "./RecordForm";
import { ForeignKeyCell } from "./ForeignKeyCell";
import { ColumnFilterPopover } from "./ColumnFilterPopover";

const arrayFilterFn: FilterFn<any> = (row, columnId, filterValue: any[]) => {
  if (!filterValue || filterValue.length === 0) return true;
  const cellValue = row.getValue(columnId);
  return filterValue.includes(cellValue);
};

interface DataTableProps {
  tableName: string;
}

export function DataTable({ tableName }: DataTableProps) {
  const meta = tablesMeta[tableName];
  if (!meta) return <div>Таблица не найдена</div>;

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 20 });
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [showForm, setShowForm] = React.useState(false);
  const [editId, setEditId] = React.useState<number | null>(null);

  const routerKey = meta.routerKey as keyof typeof trpc;
  const { data, isLoading, isError, error } = (trpc as any)[routerKey]?.list?.useQuery?.();
  const utils = trpc.useUtils();
  const deleteMutation = (trpc as any)[routerKey]?.delete?.useMutation?.({
    onSuccess: () => (utils as any)[routerKey]?.list?.invalidate?.(),
  });

  const rows = (data as any[]) ?? [];

  const columns = React.useMemo<ColumnDef<any>[]>(() => {
    const cols: ColumnDef<any>[] = [
      {
        id: "index",
        header: "№",
        cell: ({ row }) => {
          const visibleRows = table.getRowModel().rows;
          const rowIndex = visibleRows.findIndex(r => r.id === row.id);
          return <span className="text-gray-500 text-xs">{pagination.pageIndex * pagination.pageSize + rowIndex + 1}</span>;
        },
        enableSorting: false,
        enableGlobalFilter: false,
      },
    ];

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
              currentFilter={columnFilters.find(f => f.id === field.dbName)?.value as any[]}
              onFilterChange={(values) => {
                setColumnFilters(prev => {
                  const other = prev.filter(f => f.id !== field.dbName);
                  if (values && values.length > 0) return [...other, { id: field.dbName, value: values }];
                  return other;
                });
              }}
            />
          </div>
        ),
        cell: ({ getValue }: any) => {
          const value = getValue();
          if (field.isFK && field.references) {
            return <ForeignKeyCell table={field.references.table} id={value as number} displayField={field.references.displayField} />;
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
      cell: ({ row }: any) => (
        <div className="flex gap-2">
          <button className="text-blue-600 hover:text-blue-800 text-sm" onClick={() => { setEditId(row.original.id); setShowForm(true); }}>Ред.</button>
          <button className="text-red-600 hover:text-red-800 text-sm" onClick={() => {
            if (window.confirm(`Удалить запись с ID ${row.original.id}?`)) deleteMutation?.mutate({ id: row.original.id });
          }}>Удалить</button>
        </div>
      ),
    });

    return cols;
  }, [meta, rows, columnFilters, pagination.pageIndex, pagination.pageSize, deleteMutation]);

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
    filterFns: { arrayFilter: arrayFilterFn },
  });

  if (isLoading) return <div>Загрузка...</div>;
  if (isError) return <div className="text-red-500">Ошибка: {error.message}</div>;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <input placeholder="Поиск по всем полям..." value={globalFilter} onChange={e => setGlobalFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm max-w-sm" />
        <button className="px-3 py-1.5 bg-blue-500 text-white rounded text-sm hover:bg-blue-600" onClick={() => { setEditId(null); setShowForm(true); }}>
          Добавить
        </button>
      </div>
      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th key={header.id} colSpan={header.colSpan}
                    className={`px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${header.column.getCanSort() ? "cursor-pointer select-none hover:bg-gray-100" : ""}`}
                    onClick={header.column.getToggleSortingHandler()}>
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
          <tbody className="bg-white divide-y divide-gray-200">
            {table.getRowModel().rows.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-4 py-4 text-center text-sm text-gray-500">Нет данных</td></tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-gray-600">Страница {pagination.pageIndex + 1} из {table.getPageCount()}</div>
        <div className="flex gap-2">
          <button className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Назад</button>
          <button className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Вперёд</button>
        </div>
      </div>
      {showForm && (
        <RecordForm tableName={tableName} editId={editId} onClose={() => { setShowForm(false); setEditId(null); (utils as any)[routerKey]?.list?.invalidate?.(); }} />
      )}
    </div>
  );
}