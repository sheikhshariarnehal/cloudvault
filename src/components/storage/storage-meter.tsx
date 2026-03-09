'use client';

import { useMemo, useState } from 'react';
import { useFilesStore } from '@/store/files-store';
import { formatFileSize, getFileCategory } from '@/types/file.types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ChevronRight, HardDrive, Image as ImageIcon, Video, FileText, Database } from 'lucide-react';


const STORAGE_COLORS = {
  photo: '#22c55e',
  video: '#3b82f6',
  document: '#9ca3af',
  other: '#a855f7',
  free: '#e5e7eb',
};

const DEFAULT_STORAGE_LIMIT =
  Number(process.env.NEXT_PUBLIC_MAX_GUEST_STORAGE_BYTES) || 107374182400;

export function StorageMeter() {
  const { files } = useFilesStore();
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

  const stats = [
    { label: 'Photo', size: breakdown.photo, color: STORAGE_COLORS.photo, icon: ImageIcon },
    { label: 'Video', size: breakdown.video, color: STORAGE_COLORS.video, icon: Video },
    { label: 'Document', size: breakdown.document, color: STORAGE_COLORS.document, icon: FileText },
    { label: 'Other', size: breakdown.other, color: STORAGE_COLORS.other, icon: Database },
    { label: 'Free Storage', size: freeStorage, color: STORAGE_COLORS.free, icon: HardDrive },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <div
          role='button'
          tabIndex={0}
          className='group rounded-2xl bg-white p-4 shadow-sm border border-gray-200/60 hover:shadow-md hover:border-gray-300 transition-all duration-300 flex flex-col space-y-4 text-left cursor-pointer'
        >
          <div className='flex items-center justify-between'>
            <span className='text-sm font-semibold text-gray-900 tracking-tight'>Storage</span>
            <div className='flex items-center gap-0.5'>
              <span className='text-[13px] text-gray-500 font-medium'>
                {formatFileSize(breakdown.total)} of {formatFileSize(storageLimit)}
              </span>
              <ChevronRight className='w-4 h-4 text-gray-400 group-hover:text-gray-900 group-hover:translate-x-0.5 transition-all' />
            </div>
          </div>

          <div className='relative h-2 w-full bg-gray-100 rounded-full overflow-hidden'>
            <div
              className="absolute top-0 left-0 h-full bg-gray-900 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${usedPercent}%` }}
            />
          </div>
        </div>
      </DialogTrigger>

      <DialogContent className='sm:max-w-md p-0 overflow-hidden rounded-2xl'>
        <div className='px-6 pt-6 pb-4 border-b border-gray-100 bg-gray-50/50'>
          <DialogHeader>
            <DialogTitle className='text-xl font-bold text-gray-900 tracking-tight'>
              Storage Details
            </DialogTitle>
            <DialogDescription className='text-sm pt-1'>
              Complete breakdown of your {formatFileSize(storageLimit)} storage quota.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className='p-6'>
          <div className='flex flex-col items-center justify-center mb-8'>
            <div className='relative w-36 h-36 flex items-center justify-center'>
              <svg className='w-full h-full transform -rotate-90' viewBox='0 0 100 100'>
                <circle cx='50' cy='50' r='42' stroke='#f3f4f6' strokeWidth='10' fill='none' />
                <circle
                  cx='50' cy='50' r='42'
                  stroke='#111827' strokeWidth='10' fill='none'
                  strokeDasharray={`${usedPercent * 2.6389} 263.89`}
                  strokeLinecap='round'
                  className='transition-all duration-1000 ease-out'
                />
              </svg>
              <div className='absolute inset-0 flex flex-col items-center justify-center'>
                <span className='text-3xl font-bold text-gray-900 tracking-tighter'>
                  {usedPercent.toFixed(1)}%
                </span>
                <span className='text-xs font-semibold text-gray-500 uppercase tracking-widest mt-1'>
                  Used
                </span>
              </div>
            </div>

            <div className='mt-6 text-center'>
              <div className='inline-flex items-baseline gap-1.5 px-3 py-1 bg-gray-100 rounded-full'>
                <span className='text-sm font-bold text-gray-900'>{formatFileSize(breakdown.total)}</span>
                <span className='text-xs font-medium text-gray-500'>/ {formatFileSize(storageLimit)}</span>
              </div>
            </div>
          </div>

          <div className='space-y-3'>
            {stats.map((item) => (
              <div
                key={item.label}
                className='flex items-center justify-between p-3.5 rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow'
              >
                <div className='flex items-center gap-3.5'>
                  <div
                    className='w-10 h-10 rounded-full flex items-center justify-center bg-gray-50 border border-gray-100'
                    style={{ color: item.color }}
                  >
                    <item.icon className='w-5 h-5' />
                  </div>
                  <div className='flex flex-col'>
                    <p className='text-sm font-semibold text-gray-900 leading-tight'>{item.label}</p>
                    <p className='text-xs font-medium text-gray-500 mt-1'>
                      {item.size > 0 ? `${((item.size / storageLimit) * 100).toFixed(1)}%` : "0%"}
                    </p>
                  </div>
                </div>
                <p className='text-[15px] font-bold text-gray-900'>{formatFileSize(item.size)}</p>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}