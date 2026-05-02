// EntityTooltip.tsx (фрагмент внутри map)
{data &&
  meta.fields.map((field) => {
    const valueKey = field.columnName || field.dbName; // используем columnName, если задан
    return (
      <div key={field.dbName} className="flex justify-between gap-4">
        <span className="text-gray-600">{field.displayName}:</span>
        {field.isFK ? (
          <EntityTooltip
            tableName={field.references!.table}
            id={data[valueKey]}
          >
            <span className="text-blue-600 cursor-pointer">
              {data[valueKey] ?? "—"}
            </span>
          </EntityTooltip>
        ) : (
          <span className="text-gray-900">{data[valueKey] ?? "—"}</span>
        )}
      </div>
    );
  })}