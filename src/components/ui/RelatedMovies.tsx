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

interface RelatedMoviesProps {
  movies: Movie[];
  currentGenre?: string;
}

export function RelatedMovies({ movies, currentGenre }: RelatedMoviesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 400;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  if (!movies || movies.length === 0) return null;

  return (
    <section className='max-w-7xl mx-auto px-4 py-8 md:py-12 border-t border-zinc-800'>
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h2 className='text-xl md:text-2xl font-bold text-white'>相关推荐</h2>
          {currentGenre && (
            <p className='text-zinc-400 text-sm mt-1'>
              更多{currentGenre}类影片
            </p>
          )}
        </div>
        <div className='flex items-center gap-2'>
          <button
            onClick={() => scroll('left')}
            className='p-2 rounded-full border border-zinc-700 bg-transparent hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors'
            aria-label='Scroll left'
          >
            <ChevronLeft className='h-4 w-4' />
          </button>
          <button
            onClick={() => scroll('right')}
            className='p-2 rounded-full border border-zinc-700 bg-transparent hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors'
            aria-label='Scroll right'
          >
            <ChevronRight className='h-4 w-4' />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className='flex gap-4 overflow-x-auto pb-4 scrollbar-hide'
      >
        {movies.map((movie, index) => (
          <MovieCard key={movie.vod_id || index} movie={movie} />
        ))}
      </div>
    </section>
  );
}
