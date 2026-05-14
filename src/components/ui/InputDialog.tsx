"use client";
import { useState, useEffect, useRef } from "react";

interface InputDialogProps {
  open: boolean;
  title?: string | undefined;
  placeholder?: string | undefined;
  defaultValue?: string | undefined;
  confirmLabel?: string | undefined;
  cancelLabel?: string | undefined;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function InputDialog({
  open,
  title = "Введите значение",
  placeholder = "",
  defaultValue = "",
  confirmLabel = "OK",
  cancelLabel = "Отмена",
  onConfirm,
  onCancel,
}: InputDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open, defaultValue]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onCancel();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onCancel]);

  const handleConfirm = () => {
    onConfirm(value.trim() || defaultValue);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h2>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="mb-6 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
          onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
        />
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}