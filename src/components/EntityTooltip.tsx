"use client";
import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { tablesMeta, type FieldMeta } from "@/lib/table-meta";

export function EntityTooltip({
  tableName,
  id,
  children,
}: {
  tableName: string;
  id: number;
  children: React.ReactNode;
}) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLSpanElement>(null);

  const { data, isLoading } = trpc.lookup.getRow.useQuery(
    { tableName, id },
    { enabled: show, staleTime: 60_000 }
  );

  const meta = tablesMeta[tableName];
  if (!meta) return <>{children}</>;

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setCoords({ x: rect.right + 4, y: rect.top });
    setShow(true);
  };

  return (
    <span
      ref={ref}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShow(false)}
      className="relative underline decoration-dotted cursor-pointer"
    >
      {children}
      {show && (
        <div
          className="absolute z-50 bg-white border border-gray-300 shadow-lg rounded-md p-2 text-sm min-w-[240px]"
          style={{ left: coords.x, top: coords.y }}
        >
          <div className="font-semibold mb-1">{meta.nameRu}</div>
          {isLoading && <div className="text-gray-500">Загрузка...</div>}
          {data === null && <div className="text-red-500">Не найдено</div>}
          {data &&
            meta.fields.map((field) => (
              <div key={field.dbName} className="flex justify-between gap-4">
                <span className="text-gray-600">{field.displayName}:</span>
                {field.isFK ? (
                  <EntityTooltip
                    tableName={field.dbName.replace(/_id$/, "") + "s"} // приблизительное определение имени таблицы
                    id={data[field.dbName]}
                  >
                    <span className="underline decoration-dotted">
                      {data[field.dbName] ?? "—"}
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