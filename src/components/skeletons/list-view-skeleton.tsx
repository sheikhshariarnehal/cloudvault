"use client";

/**
 * Skeleton loading state for list view — matches FileList's Google Drive-style
 * column layout (filter bar + column header + rows) exactly.
 *
 * Uses the same COL widths: icon w-12, name flex-1, owner w-[120px] xl:w-[140px],
 * date w-[140px] lg:w-[170px], size w-[110px] lg:w-[130px], actions w-14.
 *
 * Responsive breakpoints match the real list:
 *  - sm: date column visible
 *  - md: owner column visible
 *  - lg: size column visible
 */

interface ListViewSkeletonProps {
  rowCount?: number;
}

function FilterBarSkeleton() {
  return (
    <div className="flex items-center px-2 sm:px-3 h-12 border-b border-[#e8eaed] gap-1.5 sm:gap-2 animate-pulse">
      <div className="h-7 sm:h-8 w-14 sm:w-16 rounded-lg bg-[#f1f3f4]" />
      <div className="h-7 sm:h-8 w-16 sm:w-[72px] rounded-lg bg-[#f1f3f4]" />
      <div className="h-7 sm:h-8 w-[72px] sm:w-20 rounded-lg bg-[#f1f3f4] hidden sm:block" />
      <div className="h-7 sm:h-8 w-16 sm:w-[72px] rounded-lg bg-[#f1f3f4] hidden md:block" />
    </div>
  );
}

function ColumnHeaderSkeleton() {
  return (
    <div className="flex items-center h-10 border-b border-[#e8eaed] animate-pulse">
      {/* Checkbox */}
      <div className="w-12 flex-shrink-0 flex items-center justify-center">
        <div className="h-[18px] w-[18px] rounded-sm bg-[#e0e0e0]" />
      </div>
      {/* Name */}
      <div className="flex-1 min-w-0 pr-3">
        <div className="h-3 w-12 rounded bg-[#e0e0e0]" />
      </div>
      {/* Owner */}
      <div className="hidden md:block w-[120px] xl:w-[140px] flex-shrink-0 pr-3">
        <div className="h-3 w-14 rounded bg-[#e0e0e0]" />
      </div>
      {/* Date */}
      <div className="hidden sm:block w-[140px] lg:w-[170px] flex-shrink-0 pr-3">
        <div className="h-3 w-24 rounded bg-[#e0e0e0]" />
      </div>
      {/* Size */}
      <div className="hidden lg:block w-[110px] lg:w-[130px] flex-shrink-0 pr-4">
        <div className="h-3 w-14 rounded bg-[#e0e0e0]" />
      </div>
      {/* Actions */}
      <div className="w-14 flex-shrink-0" />
    </div>
  );
}

function RowSkeleton({ wide }: { wide?: boolean }) {
  return (
    <div className="flex items-center h-12 border-b border-[#e8eaed] animate-pulse">
      {/* Icon */}
      <div className="w-12 flex-shrink-0 flex items-center justify-center">
        <div className="h-5 w-5 rounded bg-[#e8eaed]" />
      </div>
      {/* Name */}
      <div className="flex-1 min-w-0 pr-3">
        <div className={`h-3 rounded bg-[#e0e0e0] ${wide ? "w-2/3 max-w-[280px]" : "w-1/3 max-w-[180px]"}`} />
      </div>
      {/* Owner (avatar + text) */}
      <div className="hidden md:flex items-center w-[120px] xl:w-[140px] flex-shrink-0 pr-3 gap-2">
        <div className="h-6 w-6 rounded-full bg-[#e8eaed] flex-shrink-0" />
        <div className="h-2.5 w-8 rounded bg-[#e8eaed]" />
      </div>
      {/* Date */}
      <div className="hidden sm:block w-[140px] lg:w-[170px] flex-shrink-0 pr-3">
        <div className="h-2.5 w-14 rounded bg-[#e8eaed]" />
      </div>
      {/* Size */}
      <div className="hidden lg:block w-[110px] lg:w-[130px] flex-shrink-0 pr-4">
        <div className="h-2.5 w-16 rounded bg-[#e8eaed]" />
      </div>
      {/* Actions */}
      <div className="w-14 flex-shrink-0" />
    </div>
  );
}

export function ListViewSkeleton({ rowCount = 8 }: ListViewSkeletonProps) {
  return (
    <div className="w-full mt-2">
      <FilterBarSkeleton />
      <ColumnHeaderSkeleton />
      {Array.from({ length: rowCount }).map((_, i) => (
        <RowSkeleton key={i} wide={i % 3 !== 0} />
      ))}
    </div>
  );
}
