'use client';

import { useMemo, useState } from 'react';
import { useFilesStore } from '@/store/files-store';
import { formatFileSize, getFileCategory } from '@/types/file.types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { HardDrive, Image as ImageIcon, Video, FileText, Database, Layers } from 'lucide-react';

const STORAGE_SEGMENTS = [
  { key: 'photo',    label: 'Photos',    color: '#6366f1', icon: ImageIcon },
  { key: 'video',    label: 'Videos',    color: '#06b6d4', icon: Video     },
  { key: 'document', label: 'Documents', color: '#f59e0b', icon: FileText  },
  { key: 'other',    label: 'Other',     color: '#8b5cf6', icon: Database  },
] as const;

const DEFAULT_STORAGE_LIMIT =
  Number(process.env.NEXT_PUBLIC_MAX_GUEST_STORAGE_BYTES) || 107374182400;

export function StorageMeter() {
  const files = useFilesStore((state) => state.files);
  const [isOpen, setIsOpen] = useState(false);

  const breakdown = useMemo(() => {
    const result = { photo: 0, video: 0, document: 0, other: 0, total: 0 };
    for (const file of files) {
      const category = getFileCategory(file.mime_type);
      const size = file.size_bytes;
      result.total += size;
      if (category === 'image') result.photo += size;
      else if (category === 'video') result.video += size;
      else if (category === 'document' || category === 'pdf') result.document += size;
      else result.other += size;
    }
    return result;
  }, [files]);

  const storageLimit = DEFAULT_STORAGE_LIMIT;
  const freeStorage = Math.max(storageLimit - breakdown.total, 0);
  const usedPercent = Math.min((breakdown.total / storageLimit) * 100, 100);

  // Build segmented bar with cumulative offsets
  const segments = STORAGE_SEGMENTS.map((seg, i, arr) => {
    const pct = Math.min((breakdown[seg.key] / storageLimit) * 100, 100);
    const offset = arr.slice(0, i).reduce((sum, s) => sum + Math.min((breakdown[s.key] / storageLimit) * 100, 100), 0);
    return { ...seg, size: breakdown[seg.key], pct, offset };
  });

  const isNearFull = usedPercent > 85;

  return (
    <>
      {/* ── Sidebar trigger card ── */}
      <button
        type='button'
        onClick={() => setIsOpen(true)}
        className='group w-full text-left rounded-xl px-3 py-3 bg-surface-white hover:bg-accent transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border'
      >
        {/* Header */}
        <div className='flex items-center justify-between mb-2.5'>
          <div className='flex items-center gap-1.5'>
            <HardDrive className='w-3.5 h-3.5 text-gray-500' strokeWidth={2} />
            <span className='text-[11px] font-semibold text-gray-600 uppercase tracking-widest'>
              Storage
            </span>
          </div>
          <span className='text-[11px] font-medium tabular-nums text-gray-600'>
            {formatFileSize(breakdown.total)}
            <span className='text-gray-400 mx-0.5'>/</span>
            {formatFileSize(storageLimit)}
          </span>
        </div>

        {/* Progress bar — gradient fill */}
        <div className='relative h-1 w-full bg-gray-100 rounded-full overflow-hidden'>
          <div
            className='absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out'
            style={{
              width: `${usedPercent}%`,
              background: isNearFull
                ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                : 'linear-gradient(90deg, #6366f1, #06b6d4)',
            }}
          />
        </div>

        {/* Legend dots — only show categories that have data */}
        {segments.some((s) => s.size > 0) && (
          <div className='flex items-center gap-3 mt-2'>
            {segments
              .filter((s) => s.size > 0)
              .slice(0, 3)
              .map((seg) => (
                <div key={seg.key} className='flex items-center gap-1'>
                  <span
                    className='inline-block w-1.5 h-1.5 rounded-full flex-shrink-0'
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className='text-[10px] font-medium text-gray-500'>{seg.label}</span>
                </div>
              ))}
          </div>
        )}
      </button>

      {/* ── Detail dialog ── */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        {/*
          Mobile  : bottom sheet — overrides the centered `top-1/2 translate-y-[-50%]`
                    positioning from the base DialogContent with bottom-0 + no translate.
          Desktop : centered modal (sm: classes restore the default behaviour).
        */}
        <DialogContent
          className={[
            // Reset base padding/gap/rounding
            'p-0 gap-0 border-0',
            // ── Mobile: bottom sheet ──
            'top-auto bottom-0 left-0 right-0',
            'translate-x-0 translate-y-0',
            'w-full max-w-full',
            'rounded-t-[calc(var(--radius)+0.75rem)] rounded-b-none',
            'max-h-[90svh] flex flex-col',
            'border-t border-border shadow-2xl',
            // Mobile slide animation
            'data-[state=open]:slide-in-from-bottom-6',
            'data-[state=closed]:slide-out-to-bottom-6',
            // ── Desktop: centered modal ──
            'sm:top-1/2 sm:left-1/2 sm:bottom-auto sm:right-auto',
            'sm:-translate-x-1/2 sm:-translate-y-1/2',
            'sm:max-w-md sm:w-full',
            'sm:rounded-[calc(var(--radius)+0.75rem)]',
            'sm:max-h-[85svh]',
            'sm:border sm:border-border',
            // Desktop zoom animation (override slide)
            'sm:data-[state=open]:slide-in-from-bottom-0',
            'sm:data-[state=closed]:slide-out-to-bottom-0',
            'bg-surface-white'
          ].join(' ')}
        >
          {/* Drag handle — visible only on mobile */}
          <div className='flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0'>
            <div className='w-9 h-1 rounded-full bg-gray-200' />
          </div>

          {/* Header — donut gauge */}
          <div className='flex flex-col items-center px-6 pt-4 pb-5 bg-surface-white border-b border-border flex-shrink-0 sm:pt-6 rounded-t-[calc(var(--radius)+0.75rem)]'>
            <DialogHeader className='mb-4 text-center'>
              <DialogTitle className='text-[14px] font-semibold text-foreground tracking-tight flex items-center justify-center gap-2'>
                <Layers className='w-3.5 h-3.5 text-muted-foreground' />
                Storage Breakdown
              </DialogTitle>
            </DialogHeader>

            {/* Donut — larger on mobile for easier reading */}
            <div className='relative w-28 h-28 sm:w-24 sm:h-24'>
              <svg className='w-full h-full -rotate-90' viewBox='0 0 100 100'>
                <defs>
                  <linearGradient id='gaugeGrad' x1='0%' y1='0%' x2='100%' y2='0%'>
                    <stop offset='0%' stopColor='#6366f1' />
                    <stop offset='100%' stopColor='#06b6d4' />
                  </linearGradient>
                </defs>
                {/* Track */}
                <circle cx='50' cy='50' r='40' stroke='#f3f4f6' strokeWidth='10' fill='none' />
                {/* Arc */}
                <circle
                  cx='50' cy='50' r='40'
                  fill='none'
                  strokeWidth='10'
                  strokeLinecap='round'
                  strokeDasharray={`${usedPercent * 2.5133} 251.33`}
                  stroke={isNearFull ? '#ef4444' : 'url(#gaugeGrad)'}
                  className='transition-all duration-1000 ease-out'
                />
              </svg>
              <div className='absolute inset-0 flex flex-col items-center justify-center'>
                <span className='text-2xl sm:text-xl font-bold text-foreground tabular-nums leading-none'>
                  {usedPercent.toFixed(0)}
                  <span className='text-base sm:text-sm font-semibold text-muted-foreground'>%</span>
                </span>
                <span className='text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mt-0.5'>
                  used
                </span>
              </div>
            </div>

            {/* Used / Total pill */}
            <div className='mt-3 flex items-baseline gap-1 px-3 py-1.5 rounded-full bg-accent'>
              <span className='text-[13px] sm:text-[12px] font-bold text-foreground tabular-nums'>
                {formatFileSize(breakdown.total)}
              </span>
              <span className='text-[11px] sm:text-[10px] text-muted-foreground font-medium'>
                of {formatFileSize(storageLimit)}
              </span>
            </div>
          </div>

          {/* Breakdown list — scrollable on mobile */}
          <div className='overflow-y-auto flex-1 min-h-0'>
            <div className='px-3 py-2 space-y-0.5'>
              {[
                ...segments,
                {
                  key: 'free',
                  label: 'Free',
                  color: '#d1d5db',
                  icon: HardDrive,
                  size: freeStorage,
                  pct: (freeStorage / storageLimit) * 100,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.key}
                    className='flex items-center gap-3 px-3 py-3 sm:py-2 rounded-lg hover:bg-accent active:bg-accent/80 transition-colors'
                  >
                    {/* Color dot */}
                    <span
                      className='flex-shrink-0 w-2 h-2 rounded-full'
                      style={{ backgroundColor: item.color }}
                    />
                    {/* Icon */}
                    <Icon className='w-4 h-4 sm:w-3.5 sm:h-3.5 text-muted-foreground flex-shrink-0' strokeWidth={1.75} />
                    {/* Label */}
                    <span className='flex-1 text-[13px] sm:text-[12px] font-medium text-foreground'>
                      {item.label}
                    </span>
                    {/* Percent */}
                    <span className='text-[12px] sm:text-[11px] text-muted-foreground tabular-nums w-10 text-right'>
                      {item.pct.toFixed(1)}%
                    </span>
                    {/* Size */}
                    <span className='text-[13px] sm:text-[12px] font-semibold text-foreground tabular-nums w-16 text-right'>
                      {formatFileSize(item.size)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Segmented mini bar */}
            <div className='px-4 pb-4 pt-1 flex-shrink-0'>
              <div className='relative h-1 w-full bg-secondary rounded-full overflow-hidden'>
                {segments.map((seg) => (
                  <div
                    key={seg.key}
                    className='absolute top-0 h-full transition-all duration-700'
                    style={{
                      left: `${seg.offset}%`,
                      width: `${seg.pct}%`,
                      backgroundColor: seg.color,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

        </DialogContent>
      </Dialog>
    </>
  );
}
