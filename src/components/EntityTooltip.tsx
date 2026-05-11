// EntityTooltip.tsx
"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/trpc/client";
import { tablesMeta } from "@/lib/table-meta";

interface EntityTooltipProps {
  tableName: string;
  id: number;
  children: React.ReactNode;
}

export function EntityTooltip({ tableName, id, children }: EntityTooltipProps) {
  const [show, setShow] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [posStyle, setPosStyle] = useState<React.CSSProperties>({});
  const meta = tablesMeta[tableName];
  const { data, isLoading } = trpc.lookup.getRow.useQuery(
    { tableName: meta?.dbTableName ?? "", id },
    { enabled: show, staleTime: 60_000 }
  );

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShow(prev => !prev);
  }, []);

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

  useEffect(() => {
    if (!show || !triggerRef.current || !tooltipRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipEl = tooltipRef.current;

    const updatePosition = () => {
      const tooltipRect = tooltipEl.getBoundingClientRect();
      const gap = 4;

      let left = triggerRect.right + gap;
      let top = triggerRect.top;

      if (left + tooltipRect.width > window.innerWidth - gap) {
        left = triggerRect.left - tooltipRect.width - gap;
        if (left < gap) left = window.innerWidth - tooltipRect.width - gap;
      }

      if (top + tooltipRect.height > window.innerHeight - gap) {
        top = triggerRect.bottom - tooltipRect.height - gap;
        if (top < gap) top = window.innerHeight - tooltipRect.height - gap;
      }

      if (left < gap) left = gap;
      if (top < gap) top = gap;

      setPosStyle({
        position: "fixed",
        left,
        top,
        zIndex: 50,
      });
    };

    requestAnimationFrame(updatePosition);
  }, [show, data]);

  if (!meta) return <>{children}</>;

  const renderFieldValue = (field: typeof meta.fields[number], row: Record<string, unknown>) => {
    if (field.isFK && row[field.dbName] != null) {
      return (
        <EntityTooltip
          tableName={field.references!.table}
          id={row[field.dbName] as number}
        >
          <span className="cursor-pointer font-medium text-blue-600 hover:bg-blue-100">
            {String(row[field.dbName])}
          </span>
        </EntityTooltip>
      );
    }
    return <span>{row[field.dbName] !== undefined ? String(row[field.dbName]) : "—"}</span>;
  };

  return (
    <span ref={triggerRef} className="relative inline-block">
      <span
        onClick={handleToggle}
        className="cursor-pointer select-none font-medium text-blue-600 hover:bg-blue-100"
      >
        {children}
      </span>
      {show && (
        <div
          ref={tooltipRef}
          style={posStyle}
          className="max-h-[80vh] min-w-[240px] max-w-[90vw] overflow-y-auto rounded-md border border-gray-300 bg-white p-2 text-sm shadow-lg"
        >
          <div className="mb-1 font-semibold">{meta.nameRu}</div>
          {isLoading && <div className="text-gray-500">Загрузка...</div>}
          {data === null && <div className="text-red-500">Не найдено</div>}
          {data && typeof data === 'object' ? (
            meta.fields.map((field) => (
              <div key={field.dbName} className="flex justify-between gap-4">
                <span className="text-gray-600">{field.displayName}:</span>
                {renderFieldValue(field, data as Record<string, unknown>)}
              </div>
            ))
          ) : null}
        </div>
      )}
    </span>
  );
}