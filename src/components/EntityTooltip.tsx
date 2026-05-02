// src/components/EntityTooltip.tsx
"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/trpc/client";
import { tablesMeta } from "@/lib/table-meta";

interface EntityTooltipProps {
  tableName: string;   // ключ таблицы в tablesMeta
  id: number;
  children: React.ReactNode;
}

export function EntityTooltip({ tableName, id, children }: EntityTooltipProps) {
  const [show, setShow] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [posStyle, setPosStyle] = useState<React.CSSProperties>({});

  const meta = tablesMeta[tableName];
  if (!meta) return <>{children}</>;

  // Запрос к lookup с реальным именем таблицы в БД
  const { data, isLoading } = trpc.lookup.getRow.useQuery(
    { tableName: meta.dbTableName, id },
    { enabled: show, staleTime: 60_000 }
  );

  // Переключение при клике на триггер
  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // чтобы клик не ушёл на другие элементы
    setShow(prev => !prev);
  }, []);

  // Закрытие при клике вне тултипа и триггера
  useEffect(() => {
    if (!show) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setShow(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [show]);

  // Расчёт позиции при открытии
  useEffect(() => {
    if (!show || !triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipEl = tooltipRef.current;

    // Временно даём браузеру отрисовать тултип, чтобы узнать его размеры
    const updatePosition = () => {
      const tooltipRect = tooltipEl.getBoundingClientRect();
      const gap = 4;

      let left = triggerRect.right + gap;
      let top = triggerRect.top;

      // Проверка горизонтального пространства
      if (left + tooltipRect.width > window.innerWidth - gap) {
        // Пытаемся разместить слева от триггера
        left = triggerRect.left - tooltipRect.width - gap;
        if (left < gap) {
          // Если и слева не помещается, прижимаем к правому краю
          left = window.innerWidth - tooltipRect.width - gap;
        }
      }

      // Проверка вертикального пространства
      if (top + tooltipRect.height > window.innerHeight - gap) {
        // Пытаемся разместить снизу вверх
        top = triggerRect.bottom - tooltipRect.height - gap;
        if (top < gap) {
          // Если не помещается, прижимаем к нижнему краю
          top = window.innerHeight - tooltipRect.height - gap;
        }
      }

      // Минимальные отступы
      if (left < gap) left = gap;
      if (top < gap) top = gap;

      setPosStyle({
        position: "fixed",
        left: left,
        top: top,
        zIndex: 50,
      });
    };

    // Используем requestAnimationFrame для точного измерения после рендера
    requestAnimationFrame(updatePosition);
  }, [show, data]); // data меняет содержимое, нужно пересчитывать позицию

  return (
    <span ref={triggerRef} className="relative inline-block">
      <span
        onClick={handleToggle}
        className="text-blue-600 font-medium hover:bg-blue-100 cursor-pointer select-none"
      >
        {children}
      </span>
      {show && (
        <div
          ref={tooltipRef}
          style={posStyle}
          className="bg-white border border-gray-300 shadow-lg rounded-md p-2 text-sm min-w-[240px] max-w-[90vw] max-h-[80vh] overflow-y-auto"
        >
          <div className="font-semibold mb-1">{meta.nameRu}</div>
          {isLoading && <div className="text-gray-500">Загрузка...</div>}
          {data === null && <div className="text-red-500">Не найдено</div>}
          {data &&
            meta.fields.map((field) => (
              <div key={field.dbName} className="flex justify-between gap-4">
                <span className="text-gray-600">{field.displayName}:</span>
                {field.isFK && data[field.dbName] != null ? (
                  <EntityTooltip
                    tableName={field.references!.table}
                    id={data[field.dbName]}
                  >
                    <span className="text-blue-600 font-medium hover:bg-blue-100 cursor-pointer">
                      {data[field.dbName]}
                    </span>
                  </EntityTooltip>
                ) : (
                  <span>{data[field.dbName] ?? "—"}</span>
                )}
              </div>
            ))}
        </div>
      )}
    </span>
  );
}