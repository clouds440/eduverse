import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalResults?: number;
    pageSize?: number;
    onPageSizeChange?: (size: number) => void;
    isLoading?: boolean;
}

export function Pagination({ currentPage, totalPages, onPageChange, totalResults, pageSize, onPageSizeChange, isLoading }: PaginationProps) {
    const isDisabled = isLoading;

    return (
        <nav className="flex shrink-0 flex-col items-center justify-between gap-3 border-t border-border/60 bg-card/70 px-4 py-3 sm:flex-row sm:px-5" aria-label="Pagination">
            {totalResults !== undefined && pageSize !== undefined && (
                <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 order-2 sm:order-1 shrink-0">
                    <div className="text-xs sm:text-sm font-semibold text-muted-foreground">
                        {totalResults > 0 ? (
                            <>Showing <span className="text-primary">{(currentPage - 1) * pageSize + 1}</span> to <span className="text-primary">{Math.min(currentPage * pageSize, totalResults)}</span> of <span className="text-primary">{totalResults}</span> results</>
                        ) : (
                            <>No results found</>
                        )}
                    </div>
                    
                    {onPageSizeChange && (
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground/70 tracking-wider">Rows:</span>
                            <select 
                                value={pageSize}
                                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                                disabled={isLoading}
                                className="rounded-md border border-border bg-input px-2 py-1 text-xs font-semibold text-primary transition-colors hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                                aria-label="Rows per page"
                            >
                                {[10, 20, 50, 100].map(size => (
                                    <option key={size} value={size}>{size}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            )}
            
            {totalPages > 1 && (
                <div className={`flex items-center gap-1 sm:gap-1.5 order-1 sm:order-2 ${totalResults === undefined ? 'w-full justify-center' : ''}`}>
                    <button
                        type="button"
                        onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
                        disabled={currentPage === 1 || isDisabled}
                        className="group flex items-center gap-1.5 rounded-md border border-border/60 bg-card px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary/25 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-card"
                        aria-label="Previous page"
                    >
                        <ChevronLeft className="w-4 h-4 text-primary" aria-hidden="true" />
                        <span className="text-[10px] sm:text-xs font-semibold tracking-wider hidden sm:inline">Previous</span>
                    </button>

                    <div className="flex items-center gap-1 px-1 sm:px-2">
                        {[...Array(totalPages)].map((_, i) => {
                            const page = i + 1;
                            if (totalPages > 7 && Math.abs(page - currentPage) > 2 && page !== 1 && page !== totalPages) {
                                if (Math.abs(page - currentPage) === 3) return <span key={page} className="px-1 text-muted-foreground font-semibold">...</span>;
                                return null;
                            }
                            return (
                                <button
                                    type="button"
                                    key={page}
                                    onClick={() => onPageChange(page)}
                                    disabled={isDisabled}
                                    className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-semibold transition-colors sm:h-9 sm:w-9 sm:text-sm ${
                                        currentPage === page 
                                            ? 'bg-primary text-primary-foreground shadow-xs' 
                                            : 'hover:bg-primary/10 text-foreground/80 border border-border/50 hover:border-primary/20 bg-card/50'
                                    }`}
                                    aria-label={`Page ${page}`}
                                    aria-current={currentPage === page ? 'page' : undefined}
                                >
                                    {page}
                                </button>
                            );
                        })}
                    </div>

                    <button
                        type="button"
                        onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
                        disabled={currentPage === totalPages || isDisabled}
                        className="group flex items-center gap-1.5 rounded-md border border-border/60 bg-card px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary/25 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-card"
                        aria-label="Next page"
                    >
                        <span className="text-[10px] sm:text-xs font-semibold tracking-wider hidden sm:inline">Next</span>
                        <ChevronRight className="w-4 h-4 text-primary" aria-hidden="true" />
                    </button>
                </div>
            )}
        </nav>
    );
}
