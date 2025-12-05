'use client';

import {
  Calendar,
  Clock,
  Download,
  Film,
  Heart,
  Plus,
  Share2,
  Star,
  User,
} from 'lucide-react';
import { useState } from 'react';

interface MovieInfoProps {
  title: string;
  poster?: string;
  year?: string;
  duration?: string;
  rating?: string | number;
  genres?: string[];
  description?: string;
  director?: string;
  actors?: string[];
  quality?: string;
  episodes?: { name: string; url: string }[];
  currentEpisode?: number;
  onEpisodeSelect?: (index: number) => void;
  onFavorite?: () => void;
  isFavorite?: boolean;
}

export function MovieInfo({
  title,
  poster,
  year,
  duration,
  rating,
  genres = [],
  description,
  director,
  actors = [],
  quality = 'HD',
  episodes = [],
  currentEpisode = 0,
  onEpisodeSelect,
  onFavorite,
  isFavorite = false,
}: MovieInfoProps) {
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  return (
    <section className='max-w-7xl mx-auto px-4 py-8 md:py-12'>
      <div className='flex flex-col md:flex-row gap-6 md:gap-8'>
        {/* Poster */}
        <div className='flex-shrink-0 mx-auto md:mx-0'>
          <div className='w-48 md:w-64 aspect-[2/3] rounded-xl overflow-hidden bg-zinc-800 shadow-2xl'>
            {poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={poster}
                alt={title}
                className='w-full h-full object-cover'
              />
            ) : (
              <div className='w-full h-full flex items-center justify-center bg-zinc-800'>
                <Film className='w-16 h-16 text-zinc-600' />
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className='flex-1 space-y-4'>
          {/* Badges */}
          <div className='flex flex-wrap items-center gap-2'>
            {genres.slice(0, 2).map((genre) => (
              <span
                key={genre}
                className='px-3 py-1 text-xs font-medium bg-orange-500/20 text-orange-400 rounded-full'
              >
                {genre}
              </span>
            ))}
            <span className='px-3 py-1 text-xs font-medium bg-zinc-700 text-zinc-300 rounded-full'>
              {quality}
            </span>
            <span className='px-3 py-1 text-xs font-medium bg-zinc-700 text-zinc-300 rounded-full'>
              5.1声道
            </span>
          </div>

          {/* Title */}
          <h1 className='text-2xl md:text-4xl font-bold text-white'>{title}</h1>

          {/* Rating & Meta */}
          <div className='flex flex-wrap items-center gap-4 text-zinc-400'>
            {rating && (
              <div className='flex items-center gap-1'>
                <Star className='w-5 h-5 text-yellow-500 fill-yellow-500' />
                <span className='text-lg font-semibold text-white'>
                  {rating}
                </span>
              </div>
            )}
            {year && (
              <div className='flex items-center gap-1'>
                <Calendar className='w-4 h-4' />
                <span>{year}</span>
              </div>
            )}
            {duration && (
              <div className='flex items-center gap-1'>
                <Clock className='w-4 h-4' />
                <span>{duration}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className='flex flex-wrap items-center gap-3 pt-2'>
            <button
              onClick={onFavorite}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                isFavorite
                  ? 'bg-orange-500 text-white'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              <Plus className='w-4 h-4' />
              <span>{isFavorite ? '已收藏' : '添加片单'}</span>
            </button>
            <button className='flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg font-medium transition-colors'>
              <Heart className='w-4 h-4' />
              <span>喜欢</span>
            </button>
            <button className='flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg font-medium transition-colors'>
              <Share2 className='w-4 h-4' />
              <span>分享</span>
            </button>
            <button className='flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg font-medium transition-colors'>
              <Download className='w-4 h-4' />
              <span>下载</span>
            </button>
          </div>

          {/* Description */}
          {description && (
            <div className='pt-4 border-t border-zinc-800'>
              <h3 className='text-lg font-semibold text-white mb-2'>
                剧情简介
              </h3>
              <p
                className={`text-zinc-400 leading-relaxed ${
                  !isDescriptionExpanded ? 'line-clamp-3' : ''
                }`}
              >
                {description.replace(/<[^>]+>/g, '')}
              </p>
              {description.length > 150 && (
                <button
                  onClick={() =>
                    setIsDescriptionExpanded(!isDescriptionExpanded)
                  }
                  className='mt-2 text-orange-500 hover:text-orange-400 text-sm font-medium'
                >
                  {isDescriptionExpanded ? '收起' : '展开全部'}
                </button>
              )}
            </div>
          )}

          {/* Details Grid */}
          <div className='pt-4 border-t border-zinc-800 grid grid-cols-1 md:grid-cols-2 gap-4'>
            {director && (
              <div className='flex items-start gap-2'>
                <User className='w-4 h-4 text-zinc-500 mt-1 flex-shrink-0' />
                <div>
                  <span className='text-zinc-500 text-sm'>导演: </span>
                  <span className='text-zinc-300 text-sm'>{director}</span>
                </div>
              </div>
            )}
            {actors.length > 0 && (
              <div className='flex items-start gap-2 md:col-span-2'>
                <User className='w-4 h-4 text-zinc-500 mt-1 flex-shrink-0' />
                <div>
                  <span className='text-zinc-500 text-sm'>主演: </span>
                  <span className='text-zinc-300 text-sm'>
                    {actors.slice(0, 5).join('、')}
                  </span>
                </div>
              </div>
            )}
            {genres.length > 0 && (
              <div className='flex items-start gap-2'>
                <Film className='w-4 h-4 text-zinc-500 mt-1 flex-shrink-0' />
                <div>
                  <span className='text-zinc-500 text-sm'>类型: </span>
                  <span className='text-zinc-300 text-sm'>
                    {genres.join('、')}
                  </span>
                </div>
              </div>
            )}
            {year && (
              <div className='flex items-start gap-2'>
                <Calendar className='w-4 h-4 text-zinc-500 mt-1 flex-shrink-0' />
                <div>
                  <span className='text-zinc-500 text-sm'>上映年份: </span>
                  <span className='text-zinc-300 text-sm'>{year}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Episodes Section */}
      {episodes.length > 1 && (
        <div className='mt-8 pt-8 border-t border-zinc-800'>
          <h3 className='text-lg font-semibold text-white mb-4'>
            选集{' '}
            <span className='text-zinc-500 font-normal'>
              ({episodes.length}集)
            </span>
          </h3>
          <div className='grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2'>
            {episodes.map((episode, index) => (
              <button
                key={index}
                onClick={() => onEpisodeSelect?.(index)}
                className={`px-3 py-2 text-sm rounded-lg font-medium transition-all ${
                  index === currentEpisode
                    ? 'bg-orange-500 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                }`}
              >
                {episode.name || `第${index + 1}集`}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
