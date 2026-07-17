import React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';

interface Props<T> {
  data: T[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<T, any>[];
  isLoading?: boolean;
  emptyMessage?: string;
  expandedRow?: string | null;
  renderExpanded?: (row: T) => React.ReactNode;
}

export function DataTable<T>({
  data,
  columns,
  isLoading,
  emptyMessage = 'No records found.',
  expandedRow,
  renderExpanded,
}: Props<T>) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {columns.map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${60 + (j * 17) % 30}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              : table.getRowModel().rows.length === 0
              ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center text-gray-400 text-sm">
                    {emptyMessage}
                  </td>
                </tr>
              )
              : table.getRowModel().rows.map((row) => {
                const rowId = (row.original as { id?: string }).id;
                const isExpanded = expandedRow != null && rowId === expandedRow;
                return (
                  <React.Fragment key={row.id}>
                    <tr className="hover:bg-gray-50 transition-colors">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                    {isExpanded && renderExpanded && (
                      <tr>
                        <td colSpan={columns.length} className="p-0">
                          {renderExpanded(row.original)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
