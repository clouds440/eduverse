import React, { useState, useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { Pagination } from './Pagination';
import { Skeleton, SkeletonTable } from './Skeleton';
import { useBackStackEntry } from '@/context/BackNavigationContext';
import { EmptyState } from './EmptyState';

export interface Column<T> {
    header: string;
    accessor: keyof T | ((row: T, index: number) => React.ReactNode);
    sortable?: boolean;
    sortKey?: string; // Key to send to backend for sorting
    width?: number;
    sticky?: 'left' | 'right';
    /**
     * On mobile cards, render this column as a compact chip near the title
     * instead of a full detail field.
     */
    badge?: boolean;
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
    tableLayout?: 'auto' | 'fixed';
    emptyTitle?: string;
    emptyDescription?: string;
    /**
     * Mobile cards show only this many non-badge detail fields by default.
     * Remaining fields are revealed per card.
     */
    mobileDetailLimit?: number;
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
    showSerialNumber = true,
    tableLayout = 'auto',
    emptyTitle = 'No data available',
    emptyDescription,
    mobileDetailLimit = 2
}: DataTableProps<T>) {
    // Add serial number column if enabled
    const displayColumns = React.useMemo(() => showSerialNumber
        ? [{ header: '#', accessor: (_: T, idx: number) => idx + 1, width: 50, sortable: false, sortKey: '' } as Column<T>, ...columns]
        : columns, [showSerialNumber, columns]);

    const [columnWidths, setColumnWidths] = useState<number[]>(displayColumns.map(c => c.width || 200));
    const [resizingIndex, setResizingIndex] = useState<number | null>(null);
    const [expandedMobileRows, setExpandedMobileRows] = useState<Set<string>>(() => new Set());

    useBackStackEntry({
        enabled: expandedMobileRows.size > 0,
        label: 'Expanded table rows',
        priority: 10,
        onBack: () => setExpandedMobileRows(new Set()),
    });

    // Update widths if columns count changes
    useEffect(() => {
        setColumnWidths(displayColumns.map(c => c.width || 200));
    }, [displayColumns]);

    // Check if column is serial number column
    const isSerialColumn = React.useCallback((index: number) => showSerialNumber && index === 0, [showSerialNumber]);

    const resizingRef = useRef<{ index: number; startX: number; startWidth: number } | null>(null);
    const resizeFrameRef = useRef<number | null>(null);
    const tableRef = useRef<HTMLTableElement>(null);

    const getCellContent = React.useCallback((column: Column<T>, row: T, rowIndex: number) => (
        typeof column.accessor === 'function'
            ? column.accessor(row, rowIndex)
            : (row[column.accessor as keyof T] as React.ReactNode)
    ), []);

    const isActionsColumn = React.useCallback((column: Column<T>) => column.header === 'Actions', []);
    const isRenderableBadgeValue = React.useCallback((value: React.ReactNode) => (
        value !== null && value !== undefined && value !== false && value !== ''
    ), []);

    const mobileColumns = React.useMemo(
        () => displayColumns.filter((column, index) => !isSerialColumn(index)),
        [displayColumns, isSerialColumn],
    );

    const mobilePrimaryColumn = React.useMemo(
        () => mobileColumns.find((column) => !isActionsColumn(column) && !column.badge) || mobileColumns.find((column) => !isActionsColumn(column)) || mobileColumns[0],
        [isActionsColumn, mobileColumns],
    );

    const mobileActionsColumn = React.useMemo(
        () => mobileColumns.find((column) => isActionsColumn(column)),
        [isActionsColumn, mobileColumns],
    );

    const mobileBadgeColumns = React.useMemo(
        () => mobileColumns.filter((column) => column.badge && column !== mobilePrimaryColumn && column !== mobileActionsColumn),
        [mobileActionsColumn, mobileColumns, mobilePrimaryColumn],
    );

    const mobileDetailColumns = React.useMemo(
        () => mobileColumns.filter((column) => column !== mobilePrimaryColumn && column !== mobileActionsColumn && !column.badge),
        [mobileActionsColumn, mobileColumns, mobilePrimaryColumn],
    );

    const getMobileVisibleDetails = React.useCallback((rowKey: string) => (
        expandedMobileRows.has(rowKey)
            ? mobileDetailColumns
            : mobileDetailColumns.slice(0, mobileDetailLimit)
    ), [expandedMobileRows, mobileDetailColumns, mobileDetailLimit]);

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

    const handleRowKeyDown = (event: React.KeyboardEvent, row: T) => {
        if (!onRowClick) return;
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onRowClick(row);
        }
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
                const nextWidth = Math.max(isSerialColumn(index) ? 40 : 80, startWidth + e.clientX - startX);

                if (resizeFrameRef.current !== null) {
                    cancelAnimationFrame(resizeFrameRef.current);
                }

                resizeFrameRef.current = requestAnimationFrame(() => {
                    setColumnWidths(prev => {
                        if (prev[index] === nextWidth) return prev;
                        const next = [...prev];
                        next[index] = nextWidth;
                        return next;
                    });
                    resizeFrameRef.current = null;
                });
            }
        };

        const handleMouseUp = () => {
            if (resizeFrameRef.current !== null) {
                cancelAnimationFrame(resizeFrameRef.current);
                resizeFrameRef.current = null;
            }
            setResizingIndex(null);
            resizingRef.current = null;
            document.body.style.cursor = 'default';
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            if (resizeFrameRef.current !== null) {
                cancelAnimationFrame(resizeFrameRef.current);
                resizeFrameRef.current = null;
            }
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isSerialColumn, resizingIndex]);

    return (
        <div
            className="relative flex w-full flex-col overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm"
            style={maxHeight ? { height: maxHeight } : {}}
            aria-busy={isLoading || undefined}
        >
            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 md:hidden custom-scrollbar">
                {isLoading && data.length === 0 ? (
                    Array.from({ length: Math.min(pageSize || 5, 5) }).map((_, index) => (
                        <div key={index} className="rounded-lg border border-border/60 bg-card/70 p-4 shadow-xs space-y-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-2/3" />
                                    <Skeleton className="h-3 w-1/2" />
                                </div>
                                <Skeleton className="h-8 w-16 rounded-lg" />
                            </div>
                            <div className="space-y-3">
                                <Skeleton className="h-3 w-full" />
                                <Skeleton className="h-3 w-4/5" />
                                <Skeleton className="h-3 w-3/5" />
                            </div>
                        </div>
                    ))
                ) : data.length === 0 ? (
                    <EmptyState title={emptyTitle} description={emptyDescription} size="sm" />
                ) : (
                    data.map((row, rowIndex) => {
                        const rowKey = keyExtractor(row);
                        const isExpanded = expandedMobileRows.has(rowKey);
                        const primaryContent = mobilePrimaryColumn
                            ? getCellContent(mobilePrimaryColumn, row, rowIndex)
                            : null;
                        const actionsContent = mobileActionsColumn
                            ? getCellContent(mobileActionsColumn, row, rowIndex)
                            : null;
                        const visibleDetailColumns = getMobileVisibleDetails(rowKey);
                        const hiddenDetailCount = Math.max(0, mobileDetailColumns.length - visibleDetailColumns.length);
                        const badgeItems = mobileBadgeColumns
                            .map((column) => ({
                                column,
                                content: getCellContent(column, row, rowIndex),
                            }))
                            .filter((item) => isRenderableBadgeValue(item.content));

                        return (
                            <article
                                key={rowKey}
                                onClick={() => onRowClick && onRowClick(row)}
                                onKeyDown={(event) => handleRowKeyDown(event, row)}
                                role={onRowClick ? 'button' : undefined}
                                tabIndex={onRowClick ? 0 : undefined}
                                className={`
                                    rounded-lg border border-border/60 bg-card/80 p-3.5 shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30
                                    ${onRowClick ? 'cursor-pointer active:bg-primary/5' : ''}
                                    ${getRowClassName ? getRowClassName(row) : ''}
                                `}
                            >
                                <div className="flex items-start justify-between gap-2.5">
                                    <div className="min-w-0 flex-1 space-y-2">
                                        {showSerialNumber && (
                                            <p className="text-[10px] font-black tracking-[0.2em] text-muted-foreground/60">
                                                #{(currentPage - 1) * pageSize + rowIndex + 1}
                                            </p>
                                        )}
                                        <div className="min-w-0 text-sm font-semibold text-foreground">
                                            {primaryContent}
                                        </div>
                                        {badgeItems.length > 0 && (
                                            <div className="flex max-w-full flex-wrap gap-1.5 overflow-hidden">
                                                {badgeItems.map(({ column, content }) => (
                                                    <div
                                                        key={column.header}
                                                        className="inline-flex max-w-full min-w-0 items-center rounded-full border border-border/50 bg-background/60 px-2 py-1 text-[10px] font-bold leading-none text-foreground/80"
                                                        title={column.header}
                                                        aria-label={`${column.header}: ${typeof content === 'string' || typeof content === 'number' ? content : ''}`}
                                                    >
                                                        <div className="min-w-0 max-w-40 truncate text-foreground">
                                                            {content}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {actionsContent && (
                                        <div
                                            className="shrink-0"
                                            onClick={(event) => event.stopPropagation()}
                                        >
                                            {actionsContent}
                                        </div>
                                    )}
                                </div>

                                {visibleDetailColumns.length > 0 && (
                                    <div className="mt-3 grid grid-cols-1 gap-2">
                                        {visibleDetailColumns.map((column) => (
                                            <div key={column.header} className="rounded-md border border-border/45 bg-background/35 p-2.5">
                                                <p className="mb-1 text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                                                    {column.header}
                                                </p>
                                                <div className="min-w-0 text-xs font-semibold leading-relaxed text-foreground/85 wrap-break-word">
                                                    {getCellContent(column, row, rowIndex)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {hiddenDetailCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setExpandedMobileRows(prev => {
                                                const next = new Set(prev);
                                                if (next.has(rowKey)) next.delete(rowKey);
                                                else next.add(rowKey);
                                                return next;
                                            });
                                        }}
                                        className="mt-2 w-full rounded-xl border border-border/40 bg-background/40 px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                        aria-expanded={isExpanded}
                                    >
                                        {isExpanded ? 'Show less' : `Show ${hiddenDetailCount} more`}
                                    </button>
                                )}
                            </article>
                        );
                    })
                )}
            </div>

            <div className={`relative hidden md:block flex-1 min-h-0 overflow-x-auto scrollbar-thin scrollbar-thumb-border`}>
                <table
                    ref={tableRef}
                    className={`w-full text-left text-xs sm:text-sm text-foreground ${tableLayout === 'fixed' ? 'table-fixed' : 'table-auto'}`}
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
                                        onKeyDown={(event) => {
                                            if (!col.sortable) return;
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault();
                                                handleSort(index);
                                            }
                                        }}
                                        tabIndex={col.sortable ? 0 : undefined}
                                        aria-sort={isSorted ? (sortConfig?.direction === 'asc' ? 'ascending' : 'descending') : undefined}
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
                                    <EmptyState title={emptyTitle} description={emptyDescription} />
                                </td>
                            </tr>
                        ) : (
                            data.map((row, rowIndex) => (
                                <tr
                                    key={keyExtractor(row)}
                                    onClick={() => onRowClick && onRowClick(row)}
                                    onKeyDown={(event) => handleRowKeyDown(event, row)}
                                    tabIndex={onRowClick ? 0 : undefined}
                                    className={`
                                        transition-colors duration-200 group relative h-16 sm:h-20 border-b border-border/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30
                                        ${(!disableZebra && rowIndex % 2 === 0) ? 'bg-card' : (!disableZebra ? 'bg-muted/20' : '')}
                                        ${onRowClick ? 'cursor-pointer hover:bg-primary/5' : ''}
                                        ${getRowClassName ? getRowClassName(row) : ''}
                                    `}
                                >
                                    {displayColumns.map((col, index) => {
                                        const isActions = col.header === 'Actions';
                                        const content = getCellContent(col, row, rowIndex);

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
                    <div className="absolute inset-x-0 bottom-0 top-14 sm:top-16 bg-card/70 backdrop-blur-sm flex z-20 transition-all duration-300" role="status" aria-label="Loading table rows">
                        <SkeletonTable rows={5} columns={displayColumns.length} className="w-full border-x-0 border-b-0 rounded-none" showHeader={false} />
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
