'use client';

import { Play, Plus, Star } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface Movie {
  id: string;
  vod_id: string;
  vod_name: string;
  vod_pic: string;
  vod_year?: string;
  vod_remarks?: string;
  type_name?: string;
  api: string;
  site_key?: string;
}

interface MovieCardProps {
  movie: Movie;
}

// 处理图片 URL，豆瓣图片需要代理
function getProxiedImageUrl(url: string): string {
  if (!url) return '/placeholder.jpg';
  // 豆瓣图片需要代理
  if (url.includes('doubanio.com') || url.includes('douban.com')) {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

export function MovieCard({ movie }: MovieCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);

  const imageUrl = getProxiedImageUrl(movie.vod_pic);

  // 根据数据来源生成不同的播放链接
  const playUrl =
    movie.site_key === 'douban'
      ? `/play?title=${encodeURIComponent(movie.vod_name)}&year=${
          movie.vod_year || ''
        }&stype=movie&prefer=true`
      : `/play?id=${movie.vod_id}&api=${encodeURIComponent(movie.api)}`;

  return (
    <Link
      href={playUrl}
      prefetch={false}
      className='relative flex-shrink-0 w-[140px] md:w-[180px] group cursor-pointer'
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Poster */}
      <div className='relative aspect-[2/3] rounded-lg overflow-hidden bg-zinc-800'>
        {!imageError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={movie.vod_name}
            loading='lazy'
            className='w-full h-full object-cover transition-transform duration-300 group-hover:scale-110'
            onError={() => setImageError(true)}
          />
        ) : (
          <div className='w-full h-full flex items-center justify-center bg-zinc-800'>
            <span className='text-zinc-500 text-sm'>
              {movie.vod_name.slice(0, 2)}
            </span>
          </div>
        )}

        {/* Overlay */}
        <div
          className={`absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent transition-opacity duration-300 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Rating/Remarks Badge */}
        {movie.vod_remarks && (
          <div className='absolute top-2 right-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-md'>
            <Star className='h-3 w-3 text-orange-500 fill-orange-500' />
            <span className='text-xs font-medium text-white'>
              {movie.vod_remarks}
            </span>
          </div>
        )}

        {/* Hover Actions */}
        <div
          className={`absolute inset-0 flex items-center justify-center gap-2 transition-opacity duration-300 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <button className='rounded-full bg-orange-500 hover:bg-orange-600 text-white h-12 w-12 flex items-center justify-center transition-transform hover:scale-110'>
            <Play className='h-5 w-5 fill-current ml-0.5' />
          </button>
          <button
            className='rounded-full border border-white/30 bg-black/50 backdrop-blur-sm hover:bg-zinc-700 text-white h-10 w-10 flex items-center justify-center transition-all'
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Add to favorites logic
            }}
          >
            <Plus className='h-4 w-4' />
          </button>
        </div>
      </div>

      {/* Info */}
      <div className='mt-3'>
        <h3 className='font-medium text-white truncate group-hover:text-orange-500 transition-colors'>
          {movie.vod_name}
        </h3>
        <div className='flex items-center gap-2 text-sm text-zinc-400 mt-1'>
          {movie.vod_year && <span>{movie.vod_year}</span>}
          {movie.vod_year && movie.type_name && <span>·</span>}
          {movie.type_name && <span>{movie.type_name}</span>}
        </div>
      </div>
    </Link>
  );
}
