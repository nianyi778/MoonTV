'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { ReactNode, useCallback, useRef } from 'react';

interface ContentSectionProps {
  title: string;
  moreLink?: string;
  children: ReactNode;
}

export default function ContentSection({
  title,
  moreLink,
  children,
}: ContentSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = useCallback((direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = 600;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  }, []);

  return (
    <section className='py-8 px-[5%]'>
      {/* 区块头部 */}
      <div className='flex items-center justify-between mb-6'>
        <h2 className='text-xl md:text-2xl font-bold text-white'>{title}</h2>

        <div className='flex items-center gap-3'>
          {moreLink && (
            <Link
              href={moreLink}
              className='text-sm text-gray-400 hover:text-white transition-colors'
            >
              查看更多
            </Link>
          )}
          <div className='hidden md:flex gap-2'>
            <button
              onClick={() => scroll('left')}
              className='w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white transition-all'
            >
              <ChevronLeft className='w-5 h-5' />
            </button>
            <button
              onClick={() => scroll('right')}
              className='w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white transition-all'
            >
              <ChevronRight className='w-5 h-5' />
            </button>
          </div>
        </div>
      </div>

      {/* 横向滚动容器 */}
      <div
        ref={scrollRef}
        className='flex gap-4 md:gap-5 overflow-x-auto pb-4 scrollbar-hide scroll-smooth'
      >
        {children}
      </div>
    </section>
  );
}
