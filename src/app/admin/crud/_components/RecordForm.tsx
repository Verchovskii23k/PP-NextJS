"use client";
import { useState, useEffect } from "react";
import { trpc } from "@/trpc/client";
import { tablesMeta, type FieldMeta } from "@/lib/table-meta";

interface RecordFormProps {
  tableName: string;
  editId?: number | null;
  onClose: () => void;
}

export function RecordForm({ tableName, editId, onClose }: RecordFormProps) {
  const meta = tablesMeta[tableName];
  if (!meta) return null;

  const { data: existingData, isLoading: isLoadingExisting } = (trpc as any)[meta.routerKey]?.get?.useQuery?.({ id: editId! }, { enabled: !!editId });
  const createMutation = (trpc as any)[meta.routerKey]?.create?.useMutation?.();
  const updateMutation = (trpc as any)[meta.routerKey]?.update?.useMutation?.();

  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (editId && existingData) {
      setFormValues({ ...existingData });
    } else {
      const initial: Record<string, any> = {};
      meta.fields.forEach(f => {
        if (f.dbName !== "id") {
          initial[f.dbName] = f.isFK ? null : "";
        }
      });
      setFormValues(initial);
    }
  }, [editId, existingData, meta.fields]);

  const handleChange = (field: string, value: any) => {
    setFormValues(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    try {
      if (editId) {
        await updateMutation?.mutateAsync({ id: editId, ...formValues });
      } else {
        await createMutation?.mutateAsync(formValues);
      }
      onClose();
    } catch (err: any) {
      setErrors({ _form: err.message });
    }
  };

  const renderField = (field: FieldMeta) => {
    if (field.dbName === "id") return null;
    const value = formValues[field.dbName] ?? (field.isFK ? null : "");

    if (field.isFK && field.references) {
      const refTable = field.references.table;
      const refRouterKey = tablesMeta[refTable]?.routerKey;
      const { data: options, isLoading: optionsLoading } = (trpc as any)[refRouterKey]?.list?.useQuery?.() ?? { data: [], isLoading: false };

      return (
        <div key={field.dbName} className="mb-3">
          <label className="block text-sm font-medium mb-1">{field.displayName}</label>
          <select
            value={value ?? ""}
            onChange={e => handleChange(field.dbName, e.target.value === "" ? null : Number(e.target.value))}
            className="border border-gray-300 rounded px-3 py-1.5 w-full"
            disabled={optionsLoading}
          >
            <option value="">-- Не выбрано --</option>
            {options?.map((opt: any) => (
              <option key={opt.id} value={opt.id}>{opt[field.references!.displayField] ?? opt.id}</option>
            ))}
          </select>
        </div>
      );
    }

    if (field.dbName === "is_inactive" || field.dbName === "positionFlag" || field.dbName === "classroomFlag") {
      return (
        <div key={field.dbName} className="mb-3 flex items-center gap-2">
          <input type="checkbox" checked={!!value} onChange={e => handleChange(field.dbName, e.target.checked)} />
          <label className="text-sm">{field.displayName}</label>
        </div>
      );
    }

    return (
      <div key={field.dbName} className="mb-3">
        <label className="block text-sm font-medium mb-1">{field.displayName}</label>
        <input
          type={field.dbName.includes("year") || field.dbName.includes("count") ? "number" : "text"}
          value={value}
          onChange={e => handleChange(field.dbName, e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 w-full"
        />
        {errors[field.dbName] && <p className="text-red-500 text-xs mt-1">{errors[field.dbName]}</p>}
      </div>
    );
  };

  const isPending = createMutation?.isPending || updateMutation?.isPending;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">
          {editId ? `Редактировать запись (ID: ${editId})` : `Создать запись в таблице «${meta.nameRu}»`}
        </h2>
        <form onSubmit={handleSubmit}>
          {meta.fields.map(renderField)}
          {errors._form && <p className="text-red-500 text-sm mb-3">{errors._form}</p>}
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-1.5 border border-gray-300 rounded text-sm" disabled={isPending}>Отмена</button>
            <button type="submit" className="px-4 py-1.5 bg-blue-500 text-white rounded text-sm hover:bg-blue-600" disabled={isPending}>
              {isPending ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}