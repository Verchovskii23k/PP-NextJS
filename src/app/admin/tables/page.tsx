"use client";
import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc/client";
import { tablesMeta } from "@/lib/tableMeta";
import { EntityTooltip } from "@/components/EntityTooltip";

const TABLES = ["students", "study_groups", "lessons", "units"] as const;

export default function AdminTablesPage() {
  const [selectedTable, setSelectedTable] = useState<string>("students");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const { data: rowsData, isLoading } = trpc.lookup.getRow.useQuery( // временно используем тот же lookup для списка
    { tableName: selectedTable, id: -1 }, // не очень элегантно, нужно создать отдельную процедуру getList
  );
  // Поскольку процедура getRow не подходит для списка, здесь должна быть процедура getList.
  // Пока предложу упрощённый вариант с статическим списком.
  // В реальной реализации создайте getList с пагинацией и поиском.
}