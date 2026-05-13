import React, { useState, useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { Pagination } from './Pagination';
import { SkeletonTable } from './Skeleton';

export interface Column<T> {
    header: string;
    accessor: keyof T | ((row: T, index: number) => React.ReactNode);
    sortable?: boolean;
    sortKey?: string; // Key to send to backend for sorting
    width?: number;
    sticky?: 'left' | 'right';
}

interface DataTableProps<T> {
    data: T[];
    columns: Column<T>[];
    keyExtractor: (row: T) => string;
    onRowClick?: (row: T) => void;
    isLoading?: boolean;

    // Server-side props
    currentPage: number;
    totalPages: number;
    totalResults: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
    sortConfig?: { key: string; direction: 'asc' | 'desc' } | null;
    onSort?: (key: string, direction: 'asc' | 'desc') => void;
    getRowClassName?: (row: T) => string;
    disableZebra?: boolean;
    maxHeight?: string; // e.g., '500px' or 'calc(100vh - 300px)'
    showSerialNumber?: boolean;
}

export function DataTable<T>({
    data,
    columns,
    keyExtractor,
    onRowClick,
    isLoading,
    currentPage,
    totalPages,
    totalResults,
    pageSize,
    onPageChange,
    onPageSizeChange,
    sortConfig,
    onSort,
    getRowClassName,
    disableZebra = false,
    maxHeight,
    showSerialNumber = true
}: DataTableProps<T>) {
    // Add serial number column if enabled
    const displayColumns = React.useMemo(() => showSerialNumber
        ? [{ header: '#', accessor: (_: T, idx: number) => idx + 1, width: 50, sortable: false, sortKey: '' } as Column<T>, ...columns]
        : columns, [showSerialNumber, columns]);

    const [columnWidths, setColumnWidths] = useState<number[]>(displayColumns.map(c => c.width || 200));
    const [resizingIndex, setResizingIndex] = useState<number | null>(null);

    // Update widths if columns count changes
    useEffect(() => {
        setColumnWidths(displayColumns.map(c => c.width || 200));
    }, [displayColumns.length]);

    // Check if column is serial number column
    const isSerialColumn = (index: number) => showSerialNumber && index === 0;

    const resizingRef = useRef<{ index: number; startX: number; startWidth: number } | null>(null);
    const tableRef = useRef<HTMLTableElement>(null);

    const handleSort = (index: number) => {
        const column = displayColumns[index];
        if (!column.sortable || !onSort || isLoading) return;

        const key = column.sortKey || (typeof column.accessor === 'string' ? column.accessor : '');
        if (!key) return;

        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }

        onSort(key, direction);
    };

    const handleMouseDown = (e: React.MouseEvent, index: number) => {
        e.preventDefault();
        e.stopPropagation();
        resizingRef.current = {
            index,
            startX: e.clientX,
            startWidth: columnWidths[index]
        };
        setResizingIndex(index);
        // eslint-disable-next-line react-hooks/immutability
        document.body.style.cursor = 'col-resize';
    };

    useEffect(() => {
        if (resizingIndex === null) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (resizingRef.current !== null) {
                const { index, startX, startWidth } = resizingRef.current;
                const diff = e.clientX - startX;
                setColumnWidths(prev => {
                    const next = [...prev];
                    next[index] = Math.max(isSerialColumn(index) ? 40 : 80, startWidth + diff);
                    return next;
                });
            }
        };

        const handleMouseUp = () => {
            setResizingIndex(null);
            resizingRef.current = null;
            document.body.style.cursor = 'default';
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizingIndex]);

    return (
        <div
            className="w-full overflow-hidden border border-border/50 bg-card shadow-xl ring-1 ring-foreground/5 relative flex flex-col"
            style={maxHeight ? { height: maxHeight } : {}}
        >
            <div className={`flex-1 min-h-0 overflow-x-auto scrollbar-thin scrollbar-thumb-border`}>
                <table
                    ref={tableRef}
                    className="w-full text-left text-xs sm:text-sm text-foreground table-auto"
                    style={{ minWidth: columnWidths.reduce((a, b) => a + b, 0) }}
                >
                    <thead className="bg-primary/10 text-[10px] sm:text-[11px] tracking-wider font-semibold opacity-95 border-b border-border/50 select-none sticky top-0 z-100 backdrop-blur-xl shadow-md">
                        <tr>
                            {displayColumns.map((col, index) => {
                                const key = col.sortKey || (typeof col.accessor === 'string' ? col.accessor : '');
                                const isSorted = sortConfig?.key === key;

                                return (
                                    <th
                                        key={index}
                                        style={{
                                            width: columnWidths[index]
                                        }}
                                        className={`
                                            py-3 sm:py-5 border-b border-border/50 whitespace-nowrap relative group/th overflow-visible
                                            ${isSerialColumn(index) ? 'text-center' : 'px-3 sm:px-6'}
                                            ${col.sortable ? 'cursor-pointer hover:bg-primary/10' : ''}
                                        `}
                                        onClick={() => handleSort(index)}
                                    >
                                        <div className={`flex items-center gap-1.5 sm:gap-2 overflow-hidden ${isSerialColumn(index) ? 'justify-center' : ''}`}>
                                            <span className="truncate uppercase text-muted-foreground tracking-widest">{col.header}</span>
                                            {col.sortable && (
                                                <span className="opacity-60 group-hover/th:text-primary group-hover/th:opacity-100 transition-colors shrink-0">
                                                    {isSorted ? (
                                                        sortConfig?.direction === 'asc' ? <ChevronUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                                                    ) : (
                                                        <ChevronsUpDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 opacity-0 group-hover/th:opacity-100" />
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                        {/* Resize Handle */}
                                        <div
                                            onMouseDown={showSerialNumber && index === 0 ? undefined : (e) => handleMouseDown(e, index)}
                                            onClick={(e) => e.stopPropagation()}
                                            className={`absolute right-0 top-0 h-full w-1 transition-colors z-10 hidden sm:block ${showSerialNumber && index === 0 ? '' : 'cursor-col-resize group-hover/th:bg-primary/20'}`}
                                        >
                                            <div className="absolute right-0 top-1/4 h-1/2 w-0.5 bg-border group-hover/th:bg-primary/60 transition-colors" />
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/10 relative">
                        {data.length === 0 && !isLoading ? (
                            <tr>
                                <td colSpan={displayColumns.length} className="p-8 sm:p-12 text-center bg-card/30 border border-dashed border-border/50">
                                    <p className="text-muted-foreground font-semibold text-sm sm:text-base">No data available</p>
                                </td>
                            </tr>
                        ) : (
                            data.map((row, rowIndex) => (
                                <tr
                                    key={keyExtractor(row)}
                                    onClick={() => onRowClick && onRowClick(row)}
                                    className={`
                                        transition-colors duration-200 group relative h-16 sm:h-20 border-b border-border/50
                                        ${(!disableZebra && rowIndex % 2 === 0) ? 'bg-card' : (!disableZebra ? 'bg-muted/20' : '')}
                                        ${onRowClick ? 'cursor-pointer hover:bg-primary/5' : ''}
                                        ${getRowClassName ? getRowClassName(row) : ''}
                                    `}
                                >
                                    {displayColumns.map((col, index) => {
                                        const isActions = col.header === 'Actions';
                                        const content = typeof col.accessor === 'function'
                                            ? col.accessor(row, rowIndex)
                                            : (row[col.accessor as keyof T] as React.ReactNode);

                                        return (
                                            <td
                                                key={index}
                                                style={{
                                                    width: columnWidths[index]
                                                }}
                                                className={`py-2 sm:py-3 align-middle border border-border px-2 ${isSerialColumn(index) ? 'pl-1 text-center' : (isActions ? 'overflow-visible' : 'overflow-hidden px-3 sm:px-6')}`}
                                            >
                                                {isActions ? (
                                                    <div className="flex shrink-0 flex-nowrap w-max">
                                                        {content}
                                                    </div>
                                                ) : (
                                                    <div className="max-h-16 overflow-hidden line-clamp-2 wrap-break-word text-xs sm:text-sm font-medium text-foreground/80">
                                                        {content}
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                {/* Loading Overlay */}
                {isLoading && (
                    <div className="absolute inset-0 bg-card/70 backdrop-blur-sm flex z-20 transition-all duration-300">
                        <SkeletonTable rows={5} columns={5} className="w-full" />
                    </div>
                )}
            </div>

            {/* Pagination Controls */}
            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
                totalResults={totalResults}
                pageSize={pageSize}
                isLoading={isLoading}
            />
        </div>
    );
}
