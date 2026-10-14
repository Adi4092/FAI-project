import React from 'react';
import Pagination from './Pagination';
import EmptyState from './EmptyState';
import Skeleton from './Skeleton';
import { ChevronUp, ChevronDown } from 'lucide-react';

export default function DataTable({
  columns = [],
  data = [],
  loading = false,
  emptyMessage = 'No data available',
  pagination,
  onRowClick,
  className = '',
}) {
  if (loading) {
    return (
      <div className="card-base p-4">
        <Skeleton variant="table-row" count={5} className="mb-2" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <EmptyState description={emptyMessage} />;
  }

  return (
    <div className={`card-base overflow-hidden flex flex-col ${className}`}>
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-border bg-slate-50/70 text-slate-500 font-medium">
              {columns.map((col, idx) => (
                <th
                  key={col.key || idx}
                  className={`py-3 px-4 font-semibold text-slate-600 tracking-wider whitespace-nowrap ${col.className || ''}`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{col.header}</span>
                    {col.sortable && (
                      <span className="flex flex-col text-slate-400">
                        <ChevronUp className="w-2.5 h-2.5 -mb-1" />
                        <ChevronDown className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-slate-700">
            {data.map((row, rowIdx) => (
              <tr
                key={row.id || rowIdx}
                onClick={() => onRowClick && onRowClick(row)}
                className={`hover:bg-slate-50/80 transition-colors ${
                  onRowClick ? 'cursor-pointer' : ''
                }`}
              >
                {columns.map((col, colIdx) => {
                  const val = col.accessor ? row[col.accessor] : null;
                  return (
                    <td
                      key={col.key || colIdx}
                      className={`py-3.5 px-4 whitespace-nowrap ${col.cellClassName || ''}`}
                    >
                      {col.render ? col.render(row, rowIdx) : val}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-slate-50/40">
          <span className="text-xs text-slate-500">
            Showing page {pagination.currentPage} of {pagination.totalPages}
          </span>
          <Pagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            onPageChange={pagination.onPageChange}
          />
        </div>
      )}
    </div>
  );
}
