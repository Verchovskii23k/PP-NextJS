/**
 * Универсальная модальная форма для создания и редактирования записей в любой таблице,
 * описанной в {@link tablesMeta}.
 *
 * Полностью управляется метаданными: набор полей, их типы, валидация, способ ввода
 * (текст, число, выпадающий список, переключатель, группа radio) определяются
 * объектом `FieldMeta` из `tablesMeta[tableName].fields`.
 *
 * ## Режимы работы
 * - **Создание** (`editId === null`): форма открывается с начальными значениями по
 *   умолчанию (radioGroup = 3, toggles = false / true для isActive, числовые = null,
 *   текстовые = ""). При отправке вызывается `create.mutateAsync`.
 * - **Редактирование** (`editId` передан): данные загружаются через `get.useQuery`
 *   и заполняют поля. При отправке вызывается `update.mutateAsync`.
 * - Закрытие по Escape или кнопке «Отмена». После успешной мутации форма закрывается
 *   автоматически.
 *
 * ## Типы полей и их рендеринг
 * 1. **Внешний ключ** (`isFK === true`, `references` заданы) – выпадающий список,
 *    загружаемый через `list.useQuery` связанной таблицы. Для некоторых полей
 *    (например, `classroomId` в `lessonClassrooms`, `directorId`, `headId`,
 *    `curatorId`) передаются дополнительные параметры фильтрации.
 *    Особая логика для таблицы `disciplineTeachers`: при выборе дисциплины
 *    фильтруются преподаватели по кафедре, и наоборот.
 * 2. **Приоритет** (`inputType === "radioGroup"`) – три radio-кнопки: «Низкий» (3),
 *    «Средний» (2), «Высокий» (1). По умолчанию 3.
 * 3. **Переключатель / булево поле** (`inputType === "toggle"` или имя поля входит
 *    в `TOGGLE_FIELDS`) – визуальный toggle (цветная кнопка-ползунок) с подписью
 *    «Да»/«Нет» или «Вкл»/«Выкл».
 * 4. **Числовое поле** – определяется эвристикой `isNumericField()`: если имя поля
 *    содержит `year`, `count`, `Id`, `course`, `semester`, `capacity`, `code`, но
 *    не является кодом/unitCode/letterCode. Пустое значение преобразуется в `null`.
 * 5. **Текстовое поле** – всё остальное. Пустая строка при необязательном поле
 *    отправляется как `""`.
 *
 * ## Валидация
 * - При отправке проверяются все поля, помеченные как `required: true` (кроме `id`).
 *   Пустые значения (null, undefined, пустая строка) вызывают ошибку «Обязательное поле».
 * - Ошибки отображаются под конкретным полем. Глобальные ошибки (неиспользуются)
 *   могут быть показаны в `errors._form`.
 * - При изменении поля ошибка для него сбрасывается.
 *
 * ## Отправка данных
 * - Перед отправкой числовые и FK-поля с пустой строкой преобразуются в `null`.
 * - Для toggles/radioGroup значение остаётся как есть.
 * - В случае ошибки мутации выводится тост с сообщением от сервера.
 * - После успеха вызывается `onClose()`, который инвалидирует список (внешний код).
 *
 * ## Состояния
 * - Если метаданные не найдены (`meta === undefined`), компонент возвращает `null`.
 * - Во время загрузки существующих данных (edit) форма не блокируется, но поля
 *   могут быть пустыми до получения данных.
 * - Кнопка «Сохранить» блокируется на время выполнения мутации (`isPending`).
 * - Для связанных выпадающих списков отображается индикатор загрузки (`disabled`).
 *
 * ## Примечания
 * - Поле `id` всегда скрыто.
 * - Поля, у которых `showInCreate === false`, скрываются только в режиме создания.
 * - Кэширование tRPC не инвалидируется внутри формы – это задача родительского
 *   компонента (`DataTable`), который передаёт `onClose`.
 * - Для работы необходим глобально доступный `trpc`-клиент и контекст подтверждения
 *   не требуется.
 *
 * @param tableName - ключ из `tablesMeta`, определяющий таблицу.
 * @param editId - ID редактируемой записи или `null` для создания новой.
 * @param onClose - колбэк, вызываемый после успешного сохранения или при отмене.
 */
"use client";
import { useState, useEffect } from "react";
import { trpc } from "@/trpc/client";
import { tablesMeta, type FieldMeta } from "@/lib/table-meta";
import { TRPCClientError } from "@trpc/client";
import { toast } from "sonner";

const TOGGLE_FIELDS = new Set(["isActive", "positionFlag", "classroomFlag", "isBuffered"]);

function isNumericField(field: FieldMeta): boolean {
  if (field.dbName === "unitCode" || field.dbName === "code" || field.dbName === "letterCode") return false;
  return (
    field.dbName.includes("year") ||
    field.dbName.includes("count") ||
    field.dbName.includes("Id") ||
    field.dbName.includes("course") ||
    field.dbName.includes("semester") ||
    field.dbName.includes("capacity") ||
    field.dbName.includes("code")
  );
}

interface CrudRouter {
  get: {
    useQuery: (input: { id: number }, opts?: unknown) => {
      data?: Record<string, unknown> | null;
    };
  };
  create: {
    useMutation: (opts?: unknown) => {
      mutateAsync: (input: Record<string, unknown>) => Promise<unknown>;
      isPending: boolean;
    };
  };
  update: {
    useMutation: (opts?: unknown) => {
      mutateAsync: (input: { id: number } & Record<string, unknown>) => Promise<unknown>;
      isPending: boolean;
    };
  };
}

interface RecordFormProps {
  tableName: string;
  editId: number | null;
  onClose: () => void;
}

// Безопасное получение CRUD-роутера из trpc
function getFormCrudRouter(key: string): CrudRouter | undefined {
  const trpcObj = trpc as Record<string, unknown>;
  if (key in trpcObj) {
    const router = trpcObj[key];
    if (typeof router === 'object' && router !== null && 'list' in router) {
      // здесь мы не проверяем 'get', 'create', 'update', но для формы это не критично
      return router as unknown as CrudRouter;
    }
  }
  return undefined;
}

// Безопасное получение числового значения из formValues
function getNumberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

// Безопасное приведение к Record<string, unknown>
function ensureRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function RecordForm({ tableName, editId, onClose }: RecordFormProps) {
  const meta = tablesMeta[tableName];

  // ---------- все хуки до условного возврата ----------
  const router = meta ? getFormCrudRouter(meta.routerKey) : undefined;

  const { data: existingData } = router?.get?.useQuery?.(
    { id: editId! },
    { enabled: !!editId && !!router }
  ) ?? { data: null };

  const createMutation = router?.create?.useMutation?.();
  const updateMutation = router?.update?.useMutation?.();

  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Хуки для фильтрации в disciplineTeachers
  const selectedDisciplineId = tableName === "disciplineTeachers" ? getNumberOrUndefined(formValues.disciplineId) : undefined;
  const { data: selectedDiscipline } = trpc.disciplines.get.useQuery(
    { id: selectedDisciplineId! },
    { enabled: tableName === "disciplineTeachers" && !!selectedDisciplineId }
  );

  const selectedTeacherDeptId = tableName === "disciplineTeachers" ? getNumberOrUndefined(formValues.teacherDepartmentId) : undefined;
  const { data: selectedEmpDept } = trpc.employeesDepartments.get.useQuery(
    { id: selectedTeacherDeptId! },
    { enabled: tableName === "disciplineTeachers" && !!selectedTeacherDeptId }
  );

  // Заполнение формы данными при изменении existingData
  useEffect(() => {
    if (!meta) return;
    if (editId && existingData) {
      const data = ensureRecord(existingData);
      if (data) setFormValues(data);
      else setFormValues({});
    } else if (!editId) {
      const initial: Record<string, unknown> = {};
      meta.fields.forEach((f) => {
        if (f.dbName === "id") return;
        if (f.inputType === "radioGroup") {
          initial[f.dbName] = 3;
        } else if (TOGGLE_FIELDS.has(f.dbName)) {
          initial[f.dbName] = f.dbName === "isActive" ? true : false;
        } else if (isNumericField(f)) {
          initial[f.dbName] = null;
        } else {
          initial[f.dbName] = "";
        }
      });
      setFormValues(initial);
    }
  }, [editId, existingData, meta]);

  if (!meta) return null;
  // -----------------------------------------

  const handleChange = (field: string, value: unknown) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedValues = { ...formValues };

    meta.fields.forEach((f) => {
      const key = f.dbName;
      if (key === "id") return;
      const val = cleanedValues[key];
      if (!TOGGLE_FIELDS.has(key) && typeof val === "string" && val.trim() === "") {
        if (f.isFK || isNumericField(f) || key === "email" || key === "phone") {
          cleanedValues[key] = null;
        }
      }
    });

    const newErrors: Record<string, string> = {};
    meta.fields.forEach((f) => {
      if (f.required && f.dbName !== "id") {
        const val = cleanedValues[f.dbName];
        if (val === null || val === undefined || (typeof val === "string" && val.trim() === "")) {
          newErrors[f.dbName] = "Обязательное поле";
        }
      }
    });
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    try {
      if (editId) {
        if (!updateMutation) throw new Error("Мутация обновления недоступна");
        await updateMutation.mutateAsync({ id: editId, ...cleanedValues });
      } else {
        if (!createMutation) throw new Error("Мутация создания недоступна");
        await createMutation.mutateAsync(cleanedValues);
      }
      onClose();
    } catch (err: unknown) {
      console.log('tRPC error:', err);
      const message = err instanceof TRPCClientError ? err.message : (err instanceof Error ? err.message : "Неизвестная ошибка");
      toast.error(message);
    }
  };

  const renderField = (field: FieldMeta) => {
    if (!editId && field.showInCreate === false) return null;
    if (field.dbName === "id") return null;
    const value = formValues[field.dbName] ?? (field.isFK ? null : "");
    const hasError = !!errors[field.dbName];
    const errorMsg = errors[field.dbName];

    // внешний ключ
    if (field.isFK && field.references) {
      const refTable = field.references.table;
      const refRouterKey = tablesMeta[refTable]?.routerKey;
      let input: Record<string, unknown> | undefined;

      if (field.dbName === "classroomId" && tableName === "lessonClassrooms") {
        const lessonId = getNumberOrUndefined(formValues.lessonId);
        input = lessonId ? { lessonId } : undefined;
      } else if (field.dbName === "directorId") {
        const universityCode = getNumberOrUndefined(formValues.universityCode);
        input = universityCode ? { instituteId: universityCode } : undefined;
      } else if (field.dbName === "headId") {
        input = editId ? { departmentId: editId } : undefined;
      } else if (field.dbName === "curatorId") {
        const profileId = editId
          ? (ensureRecord(existingData)?.profileId as number | undefined)
          : getNumberOrUndefined(formValues.profileId);
        input = profileId ? { profileId } : undefined;
      }

      // ========== БЛОК: фильтрация для disciplineTeachers ==========
      if (tableName === "disciplineTeachers") {
        if (field.dbName === "teacherDepartmentId") {
          const deptId = selectedDiscipline?.departmentId;
          if (typeof deptId === 'number') {
            input = { departmentId: deptId };
          }
        } else if (field.dbName === "disciplineId") {
          const deptId = selectedEmpDept?.departmentId;
          if (typeof deptId === 'number') {
            input = { departmentId: deptId };
          }
        }
      }
      // ========== КОНЕЦ БЛОКА ==========

      const refRouter = refRouterKey ? getFormCrudRouter(refRouterKey) : undefined;
      const { data: options = [], isLoading: optionsLoading = false } =
        (refRouter as unknown as { list: { useQuery: (input?: unknown) => { data?: Record<string, unknown>[]; isLoading?: boolean } } } | undefined)?.list?.useQuery?.(input) ?? {};

      return (
        <div key={field.dbName} className="mb-3">
          <label className="mb-1 block text-sm font-medium text-foreground">
            {field.displayName}
            {field.required && <span className="ml-1 text-red-500">*</span>}
          </label>
          <select
            value={typeof value === 'number' ? value : ''}
            onChange={(e) => {
              const raw = e.target.value;
              handleChange(field.dbName, raw === "" ? null : Number(raw));
            }}
            className={`w-full rounded border bg-background px-3 py-1.5 text-foreground ${hasError ? "border-red-500" : "border-border"}`}
            disabled={optionsLoading}
          >
            <option value="">-- Не выбрано --</option>
            {Array.isArray(options) && options.map((opt) => (
              <option key={String(opt.id)} value={Number(opt.id)}>
                {opt[field.references!.displayField] != null ? String(opt[field.references!.displayField]) : String(opt.id)}
              </option>
            ))}
          </select>
          {hasError && <p className="mt-1 text-xs text-red-500">{errorMsg}</p>}
        </div>
      );
    }
    if (field.inputType === "radioGroup") {
      const selectedValue = typeof value === 'number' ? value : 3;
      const options = [
        { value: 3, label: "Низкий" },
        { value: 2, label: "Средний" },
        { value: 1, label: "Высокий" },
      ];
      return (
        <div key={field.dbName} className="mb-3">
          <label className="mb-1 block text-sm font-medium text-foreground">
            {field.displayName}
            {field.required && <span className="ml-1 text-red-500">*</span>}
          </label>
          <div className="flex gap-4">
            {options.map((opt) => (
              <label key={opt.value} className="flex items-center gap-1 text-sm">
                <input
                  type="radio"
                  name={field.dbName}
                  value={opt.value}
                  checked={selectedValue === opt.value}
                  onChange={() => handleChange(field.dbName, opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
          {hasError && <p className="mt-1 text-xs text-red-500">{errorMsg}</p>}
        </div>
      );
    }
    // toggle
    if (TOGGLE_FIELDS.has(field.dbName) || field.inputType === "toggle") {
      const isActive = !!value;
      return (
        <div key={field.dbName} className="mb-3">
          <label className="mb-1 block text-sm font-medium text-foreground">
            {field.displayName}
            {field.required && <span className="ml-1 text-red-500">*</span>}
          </label>
          <button
            type="button"
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isActive ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"}`}
            onClick={() => handleChange(field.dbName, !isActive)}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? "translate-x-6" : "translate-x-1"}`} />
          </button>
          <span className="ml-2 text-xs text-muted-foreground">
            {isActive ? (field.displayName === "Активен" ? "Да" : "Вкл") : (field.displayName === "Активен" ? "Нет" : "Выкл")}
          </span>
          {hasError && <p className="mt-1 text-xs text-red-500">{errorMsg}</p>}
        </div>
      );
    }

    // текстовое / числовое
    return (
      <div key={field.dbName} className="mb-3">
        <label className="mb-1 block text-sm font-medium text-foreground">
          {field.displayName}
          {field.required && <span className="ml-1 text-red-500">*</span>}
        </label>
        <input
          type={isNumericField(field) ? "number" : "text"}
          value={value != null ? String(value) : ''}
          onChange={(e) => {
            if (isNumericField(field)) {
              const raw = e.target.value;
              handleChange(field.dbName, raw.trim() === "" ? null : Number(raw));
            } else {
              handleChange(field.dbName, e.target.value);
            }
          }}
          className={`w-full rounded border bg-background px-3 py-1.5 text-foreground ${hasError ? "border-red-500" : "border-border"}`}
        />
        {hasError && <p className="mt-1 text-xs text-red-500">{errorMsg}</p>}
      </div>
    );
  };

  const isPending = createMutation?.isPending || updateMutation?.isPending;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-background p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          {editId ? `Редактировать запись (ID: ${editId})` : `Создать запись в таблице «${meta.nameRu}»`}
        </h2>
        <form onSubmit={handleSubmit}>
          {meta.fields.map(renderField)}
          {errors._form && <p className="mb-3 text-sm text-red-500">{errors._form}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="hover:bg-muted/50 rounded border border-border bg-background px-4 py-1.5 text-sm text-foreground" disabled={isPending}>
              Отмена
            </button>
            <button type="submit" className="hover:bg-primary/90 rounded bg-primary px-4 py-1.5 text-sm text-white" disabled={isPending}>
              {isPending ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}