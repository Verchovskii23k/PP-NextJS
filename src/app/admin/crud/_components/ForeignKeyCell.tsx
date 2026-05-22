/**
 * Отображает значение внешнего ключа в таблицах CRUD, заменяя числовой ID
 * на читаемое имя из связанной таблицы.
 *
 * ## Как работает
 * 1. По `table` (ключу из `tablesMeta`) определяется `routerKey` связанной таблицы.
 * 2. Через `router.get.useQuery({ id })` загружается одна запись.
 * 3. Если данные загружены, из них извлекается значение поля `displayField`
 *    (например, `"name"` или `"display"`). Если поля нет, используется `id`.
 * 4. Результат оборачивается в компонент `EntityTooltip`, который при наведении
 *    показывает дополнительную информацию о связанной сущности.
 *
 * ## Состояния
 * - `id === null / undefined` → прочерк «—».
 * - `isLoading` → троеточие «...».
 * - Ошибка загрузки или нет данных → красный знак «???».
 * - Если `routerKey` не найден в метаданных → просто отображается числовой `id`.
 *
 * ## Использование
 * Компонент используется в `DataTable` для каждой ячейки с внешним ключом.
 * Он избавляет от необходимости загружать все связанные данные заранее —
 * подгрузка происходит лениво, только для видимых строк.
 *
 * @param table - ключ из `tablesMeta` для связанной таблицы (например, `"employees"`).
 * @param id - числовой идентификатор связанной записи.
 * @param displayField - имя поля, значение которого показывается пользователю
 *   (например, `"display"`, `"name"`, `"number"`).
 */
"use client";
import { trpc } from "@/trpc/client";
import { tablesMeta } from "@/lib/table-meta";
import { EntityTooltip } from "@/components/EntityTooltip";

interface ForeignKeyCellProps {
  table: string;
  id: number;
  displayField: string;
  dbTableName?: string
}

// Тип для роутера, который содержит только get
interface GetRouter {
  get: {
    useQuery: (input: { id: number }, opts?: unknown) => {
      data?: Record<string, unknown> | null;
      isLoading: boolean;
    };
  };
}

// Безопасное получение роутера с методом get
function getGetRouter(key: string): GetRouter | undefined {
  const trpcObj = trpc as Record<string, unknown>;
  if (key in trpcObj) {
    const router = trpcObj[key];
    if (typeof router === 'object' && router !== null && 'get' in router) {
      return router as unknown as GetRouter;
    }
  }
  return undefined;
}

const EMPTY_GET_QUERY = {
  data: null as Record<string, unknown> | null,
  isLoading: false,
};

export function ForeignKeyCell({ table, id, displayField }: ForeignKeyCellProps) {
  if (id === undefined || id === null) return <>—</>;

  const meta = tablesMeta[table];
  const routerKey = meta?.routerKey;

  if (!routerKey) {
    return <span>{id}</span>;
  }

  const router = getGetRouter(routerKey);
  const { data, isLoading } = router?.get?.useQuery?.({ id }, { enabled: !!id }) ?? EMPTY_GET_QUERY;

  if (isLoading) return <span className="text-muted-foreground">...</span>;

  // Проверяем, что data – это объект, и получаем читаемое значение
  let displayValue: string;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const val = data[displayField];
    displayValue = val !== undefined && val !== null ? String(val) : String(data.id ?? id);
  } else {
    // Если данные не загружены или имеют неверный формат, показываем ошибку
    return <span className="text-red-500 dark:text-red-400">???</span>;
  }

  return (
    <EntityTooltip tableName={table} id={id}>
      {displayValue}
    </EntityTooltip>
  );
}