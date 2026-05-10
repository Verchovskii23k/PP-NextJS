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
    { tableName: meta.dbTableName, id },
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
          {data && typeof data === 'object' &&
            meta.fields.map((field) => (
              <div key={field.dbName} className="flex justify-between gap-4">
                <span className="text-gray-600">{field.displayName}:</span>
                {field.isFK && (data as Record<string, unknown>)[field.dbName] != null ? (
                  <EntityTooltip
                    tableName={field.references!.table}
                    id={(data as Record<string, unknown>)[field.dbName] as number}
                  >
                    <span className="text-blue-600 font-medium hover:bg-blue-100 cursor-pointer">
                      {(data as Record<string, unknown>)[field.dbName] as string}
                    </span>
                  </EntityTooltip>
                ) : (
                  <span>{(data as Record<string, unknown>)[field.dbName] !== undefined ? String((data as Record<string, unknown>)[field.dbName]) : "—"}</span>
                )}
              </div>
            ))}
        </div>
      )}
    </span>
  );
}