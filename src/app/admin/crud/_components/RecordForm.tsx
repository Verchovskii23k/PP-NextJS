// src/app/admin/crud/_components/RecordForm.tsx
"use client";
import { useState, useEffect } from "react";
import { trpc } from "@/trpc/client";
import { tablesMeta, type FieldMeta } from "@/lib/table-meta";

// Поля, которые рендерятся как toggle
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

interface RecordFormProps {
  tableName: string;
  editId: number | null;
  onClose: () => void;
}

export function RecordForm({ tableName, editId, onClose }: RecordFormProps) {
  const meta = tablesMeta[tableName];
  if (!meta) return null;

  const { data: existingData, isLoading: isLoadingExisting } = (trpc as any)[meta.routerKey]?.get?.useQuery?.(
    { id: editId! },
    { enabled: !!editId }
  );
  const createMutation = (trpc as any)[meta.routerKey]?.create?.useMutation?.();
  const updateMutation = (trpc as any)[meta.routerKey]?.update?.useMutation?.();

  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (editId && existingData) {
      setFormValues({ ...existingData });
    } else {
      const initial: Record<string, any> = {};
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
  }, [editId, existingData, meta.fields]);

  const handleChange = (field: string, value: any) => {
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
        await updateMutation?.mutateAsync({ id: editId, ...cleanedValues });
      } else {
        await createMutation?.mutateAsync(cleanedValues);
      }
      onClose();
    } catch (err: any) {
      setErrors({ _form: err.message });
    }
  };

const renderField = (field: FieldMeta) => {
  if (!editId && field.showInCreate === false) return null;
  if (field.dbName === "id") return null;
  const value = formValues[field.dbName] ?? (field.isFK ? null : ""); // ← обязательно эта строка
  const hasError = !!errors[field.dbName];
  const errorMsg = errors[field.dbName];

  // Внешний ключ (select)
  if (field.isFK && field.references) {
    const refTable = field.references.table;
    const refRouterKey = tablesMeta[refTable]?.routerKey;
    let input: any;

    // ✅ Динамическая фильтрация аудиторий по уроку
    if (field.dbName === "classroomId" && tableName === "lessonClassrooms") {
      const lessonId = formValues.lessonId;
      input = lessonId ? { lessonId } : undefined;
    } else if (field.dbName === "directorId") {
      input = formValues.universityCode ? { instituteId: formValues.universityCode } : undefined;
    } else if (field.dbName === "headId") {
      input = editId ? { departmentId: editId } : undefined;
    } else if (field.dbName === "curatorId") {
      const profileId = editId ? existingData?.profileId : formValues.profileId;
      input = profileId ? { profileId } : undefined;
    }

    const { data: options, isLoading: optionsLoading } =
      (trpc as any)[refRouterKey]?.list?.useQuery?.(input) ?? { data: [], isLoading: false };

      return (
        <div key={field.dbName} className="mb-3">
          <label className="block text-sm font-medium mb-1 text-foreground">
            {field.displayName}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <select
            value={value ?? ""}
            onChange={(e) => handleChange(field.dbName, e.target.value === "" ? null : Number(e.target.value))}
            className={`border rounded px-3 py-1.5 w-full bg-background text-foreground ${
              hasError ? "border-red-500" : "border-border"
            }`}
            disabled={optionsLoading}
          >
            <option value="">-- Не выбрано --</option>
            {options?.map((opt: any) => (
              <option key={opt.id} value={opt.id}>
                {opt[field.references!.displayField] ?? opt.id}
              </option>
            ))}
          </select>
          {hasError && <p className="text-red-500 text-xs mt-1">{errorMsg}</p>}
        </div>
      );
    }

    // Toggle для булевых полей
    if (TOGGLE_FIELDS.has(field.dbName) || field.inputType === "toggle") {
      const isActive = !!value;
      return (
        <div key={field.dbName} className="mb-3">
          <label className="block text-sm font-medium mb-1 text-foreground">
            {field.displayName}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <button
            type="button"
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              isActive ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
            }`}
            onClick={() => handleChange(field.dbName, !isActive)}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isActive ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className="ml-2 text-xs text-muted-foreground">
            {isActive ? (field.displayName === "Активен" ? "Да" : "Вкл") : (field.displayName === "Активен" ? "Нет" : "Выкл")}
          </span>
          {hasError && <p className="text-red-500 text-xs mt-1">{errorMsg}</p>}
        </div>
      );
    }

    // Обычные текст/числа
    return (
      <div key={field.dbName} className="mb-3">
        <label className="block text-sm font-medium mb-1 text-foreground">
          {field.displayName}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <input
          type={isNumericField(field) ? "number" : "text"}
          value={value}
          onChange={(e) => {
            if (isNumericField(field)) {
              const raw = e.target.value;
              handleChange(field.dbName, raw.trim() === "" ? null : Number(raw));
            } else {
              handleChange(field.dbName, e.target.value);
            }
          }}
          className={`border rounded px-3 py-1.5 w-full bg-background text-foreground ${
            hasError ? "border-red-500" : "border-border"
          }`}
        />
        {hasError && <p className="text-red-500 text-xs mt-1">{errorMsg}</p>}
      </div>
    );
  };

  const isPending = createMutation?.isPending || updateMutation?.isPending;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4 text-foreground">
          {editId ? `Редактировать запись (ID: ${editId})` : `Создать запись в таблице «${meta.nameRu}»`}
        </h2>
        <form onSubmit={handleSubmit}>
          {meta.fields.map(renderField)}
          {errors._form && <p className="text-red-500 text-sm mb-3">{errors._form}</p>}
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 border border-border bg-background text-foreground rounded text-sm hover:bg-muted/50"
              disabled={isPending}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-primary text-white rounded text-sm hover:bg-primary/90"
              disabled={isPending}
            >
              {isPending ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}