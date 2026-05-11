// src/app/admin/crud/_components/RecordForm.tsx
"use client";
import { useState, useEffect } from "react";
import { trpc } from "@/trpc/client";
import { tablesMeta, type FieldMeta } from "@/lib/table-meta";

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

export function RecordForm({ tableName, editId, onClose }: RecordFormProps) {
  const meta = tablesMeta[tableName];

  // ---------- все хуки до условного возврата ----------
  const router = meta
    ? (trpc as unknown as Record<string, CrudRouter>)[meta.routerKey] as CrudRouter | undefined
    : undefined;

  const { data: existingData } = router?.get?.useQuery?.(
    { id: editId! },
    { enabled: !!editId && !!router }
  ) ?? { data: null };

  const createMutation = router?.create?.useMutation?.();
  const updateMutation = router?.update?.useMutation?.();

  // Инициализируем пустой формой, заполним позже
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Заполнение формы данными при изменении existingData
  useEffect(() => {
    if (!meta) return;
    if (editId && existingData) {
      setFormValues({ ...existingData } as Record<string, unknown>);
    } else if (!editId) {
      const initial: Record<string, unknown> = {};
      meta.fields.forEach((f) => {
        if (f.dbName === "id") return;
        if (f.isFK) {
          initial[f.dbName] = null;
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
        await updateMutation?.mutateAsync({ id: editId, ...cleanedValues } as { id: number } & Record<string, unknown>);
      } else {
        await createMutation?.mutateAsync(cleanedValues);
      }
      onClose();
    } catch (err: unknown) {
      setErrors({ _form: (err instanceof Error ? err.message : "Неизвестная ошибка") });
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
        input = formValues.lessonId ? { lessonId: formValues.lessonId as number } : undefined;
      } else if (field.dbName === "directorId") {
        input = formValues.universityCode ? { instituteId: formValues.universityCode as number } : undefined;
      } else if (field.dbName === "headId") {
        input = editId ? { departmentId: editId as number } : undefined;
      } else if (field.dbName === "curatorId") {
        const profileId = editId
          ? (existingData as Record<string, unknown> | null)?.profileId
          : formValues.profileId;
        input = profileId ? { profileId: profileId as number } : undefined;
      }

      const refRouter = refRouterKey
        ? (trpc as unknown as Record<string, { list: { useQuery: (input?: unknown) => { data?: Record<string, unknown>[]; isLoading?: boolean } } }>)[refRouterKey]
        : undefined;
      const { data: options = [] as Record<string, unknown>[], isLoading: optionsLoading = false } =
        refRouter?.list?.useQuery?.(input) ?? {};

      return (
        <div key={field.dbName} className="mb-3">
          <label className="mb-1 block text-sm font-medium text-foreground">
            {field.displayName}
            {field.required && <span className="ml-1 text-red-500">*</span>}
          </label>
          <select
            value={(value as string | number | undefined) ?? ""}
            onChange={(e) => handleChange(field.dbName, e.target.value === "" ? null : Number(e.target.value))}
            className={`w-full rounded border bg-background px-3 py-1.5 text-foreground ${hasError ? "border-red-500" : "border-border"}`}
            disabled={optionsLoading}
          >
            <option value="">-- Не выбрано --</option>
            {options.map((opt) => (
              <option key={opt.id as number} value={opt.id as number}>
                {opt[field.references!.displayField] as string ?? String(opt.id)}
              </option>
            ))}
          </select>
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
          value={(value as string | number) ?? ""}
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