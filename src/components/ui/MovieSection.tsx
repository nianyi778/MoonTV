'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef } from 'react';

import { MovieCard } from './MovieCard';

interface Movie {
  id: string;
  vod_id: string;
  vod_name: string;
  vod_pic: string;
  vod_year?: string;
  vod_remarks?: string;
  type_name?: string;
  api: string;
}

interface MovieSectionProps {
  title: string;
  movies: Movie[];
  subtitle?: string;
}

export function MovieSection({ title, movies, subtitle }: MovieSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -400 : 400;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (!movies || movies.length === 0) {
    return null;
  }

  return (
    <section className='container mx-auto px-4 py-6 md:py-8'>
      {/* Header */}
      <div className='flex items-center justify-between mb-4 md:mb-6'>
        <div>
          <h2 className='text-xl md:text-2xl font-bold text-white'>{title}</h2>
          {subtitle && <p className='text-zinc-400 text-sm mt-1'>{subtitle}</p>}
        </div>
        <div className='flex items-center gap-2'>
          <button
            className='p-2 rounded-full border border-zinc-700 bg-zinc-800/50 hover:bg-zinc-700 text-white transition-colors'
            onClick={() => scroll('left')}
            aria-label='Scroll left'
          >
            <ChevronLeft className='h-4 w-4' />
          </button>
          <button
            className='p-2 rounded-full border border-zinc-700 bg-zinc-800/50 hover:bg-zinc-700 text-white transition-colors'
            onClick={() => scroll('right')}
            aria-label='Scroll right'
          >
            <ChevronRight className='h-4 w-4' />
          </button>
        </div>
      </div>

      {/* Movie Cards */}
      <div
        ref={scrollRef}
        className='flex gap-4 overflow-x-auto scrollbar-hide pb-4 -mx-4 px-4'
      >
        {movies.map((movie, index) => (
          <MovieCard key={movie.vod_id || index} movie={movie} />
        ))}
      </div>
    </section>
  );
}
