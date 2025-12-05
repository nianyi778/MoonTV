/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { Heart, Play, Plus } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  deleteFavorite,
  generateStorageKey,
  isFavorited,
  saveFavorite,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { SearchResult } from '@/lib/types';
import { processImageUrl } from '@/lib/utils';

interface MovieCardProps {
  id?: string;
  source?: string;
  title?: string;
  query?: string;
  poster?: string;
  episodes?: number;
  source_name?: string;
  progress?: number;
  year?: string;
  from: 'playrecord' | 'favorite' | 'search' | 'douban';
  currentEpisode?: number;
  douban_id?: string;
  onDelete?: () => void;
  rate?: string;
  items?: SearchResult[];
  type?: string;
}

export default function MovieCard({
  id,
  title = '',
  query = '',
  poster = '',
  episodes,
  source,
  source_name,
  year,
  from,
  currentEpisode,
  douban_id: _douban_id,
  onDelete: _onDelete,
  rate,
  items,
  type = '',
}: MovieCardProps) {
  const router = useRouter();
  const [favorited, setFavorited] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const isAggregate = from === 'search' && !!items?.length;

  const aggregateData = useMemo(() => {
    if (!isAggregate || !items) return null;
    const countMap = new Map<string | number, number>();
    const episodeCountMap = new Map<number, number>();
    items.forEach((item) => {
      if (item.douban_id && item.douban_id !== 0) {
        countMap.set(item.douban_id, (countMap.get(item.douban_id) || 0) + 1);
      }
      const len = item.episodes?.length || 0;
      if (len > 0) {
        episodeCountMap.set(len, (episodeCountMap.get(len) || 0) + 1);
      }
    });

    const getMostFrequent = <T extends string | number>(
      map: Map<T, number>
    ) => {
      let maxCount = 0;
      let result: T | undefined;
      map.forEach((cnt, key) => {
        if (cnt > maxCount) {
          maxCount = cnt;
          result = key;
        }
      });
      return result;
    };

    return {
      first: items[0],
      mostFrequentDoubanId: getMostFrequent(countMap),
      mostFrequentEpisodes: getMostFrequent(episodeCountMap) || 0,
    };
  }, [isAggregate, items]);

  const actualTitle = aggregateData?.first.title ?? title;
  const actualPoster = aggregateData?.first.poster ?? poster;
  const actualSource = aggregateData?.first.source ?? source;
  const actualId = aggregateData?.first.id ?? id;
  const actualEpisodes = aggregateData?.mostFrequentEpisodes ?? episodes;
  const actualYear = aggregateData?.first.year ?? year;
  const actualQuery = query || '';
  const actualSearchType = isAggregate
    ? aggregateData?.first.episodes?.length === 1
      ? 'movie'
      : 'tv'
    : type;

  // 获取收藏状态
  useEffect(() => {
    if (from === 'douban' || !actualSource || !actualId) return;

    const fetchFavoriteStatus = async () => {
      try {
        const fav = await isFavorited(actualSource, actualId);
        setFavorited(fav);
      } catch {
        // 忽略错误
      }
    };

    fetchFavoriteStatus();

    const storageKey = generateStorageKey(actualSource, actualId);
    const unsubscribe = subscribeToDataUpdates(
      'favoritesUpdated',
      (newFavorites: Record<string, any>) => {
        const isNowFavorited = !!newFavorites[storageKey];
        setFavorited(isNowFavorited);
      }
    );

    return unsubscribe;
  }, [from, actualSource, actualId]);

  const handleToggleFavorite = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (from === 'douban' || !actualSource || !actualId) return;
      try {
        if (favorited) {
          await deleteFavorite(actualSource, actualId);
          setFavorited(false);
        } else {
          await saveFavorite(actualSource, actualId, {
            title: actualTitle,
            source_name: source_name || '',
            year: actualYear || '',
            cover: actualPoster,
            total_episodes: actualEpisodes ?? 1,
            save_time: Date.now(),
          });
          setFavorited(true);
        }
      } catch {
        // 忽略错误
      }
    },
    [
      from,
      actualSource,
      actualId,
      actualTitle,
      source_name,
      actualYear,
      actualPoster,
      actualEpisodes,
      favorited,
    ]
  );

  const handleClick = useCallback(() => {
    if (from === 'douban') {
      router.push(
        `/play?title=${encodeURIComponent(actualTitle.trim())}${
          actualYear ? `&year=${actualYear}` : ''
        }${actualSearchType ? `&stype=${actualSearchType}` : ''}`
      );
    } else if (actualSource && actualId) {
      router.push(
        `/play?source=${actualSource}&id=${actualId}&title=${encodeURIComponent(
          actualTitle
        )}${actualYear ? `&year=${actualYear}` : ''}${
          isAggregate ? '&prefer=true' : ''
        }${
          actualQuery ? `&stitle=${encodeURIComponent(actualQuery.trim())}` : ''
        }${actualSearchType ? `&stype=${actualSearchType}` : ''}`
      );
    }
  }, [
    from,
    actualSource,
    actualId,
    router,
    actualTitle,
    actualYear,
    isAggregate,
    actualQuery,
    actualSearchType,
  ]);

  const showRating = from === 'douban' && rate;
  const showFavorite = from !== 'douban';

  return (
    <div className='group relative w-full cursor-pointer' onClick={handleClick}>
      {/* 海报容器 */}
      <div className='relative aspect-[2/3] rounded-xl overflow-hidden bg-dark-100'>
        {/* 骨架屏 */}
        {!imageLoaded && <div className='absolute inset-0 skeleton' />}

        {/* 图片 */}
        <Image
          src={processImageUrl(actualPoster)}
          alt={actualTitle}
          fill
          className={`object-cover transition-all duration-500 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          } group-hover:scale-110`}
          referrerPolicy='no-referrer'
          onLoadingComplete={() => setImageLoaded(true)}
        />

        {/* 悬停遮罩 */}
        <div className='absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300' />

        {/* 评分徽章 */}
        {showRating && rate && (
          <div className='absolute top-3 right-3 flex items-center gap-1 px-2 py-1 bg-black/70 backdrop-blur-sm rounded-md'>
            <svg
              className='w-3 h-3 text-yellow-400 fill-yellow-400'
              viewBox='0 0 20 20'
            >
              <path d='M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z' />
            </svg>
            <span className='text-xs font-bold text-yellow-400'>{rate}</span>
          </div>
        )}

        {/* 集数徽章 */}
        {actualEpisodes && actualEpisodes > 1 && !showRating && (
          <div className='absolute top-3 right-3 px-2 py-1 bg-brand-500/90 backdrop-blur-sm rounded-md'>
            <span className='text-xs font-bold text-white'>
              {currentEpisode
                ? `${currentEpisode}/${actualEpisodes}`
                : `${actualEpisodes}集`}
            </span>
          </div>
        )}

        {/* 播放按钮 */}
        <div className='absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300'>
          <div className='w-14 h-14 flex items-center justify-center bg-brand-500 rounded-full shadow-glow transform scale-75 group-hover:scale-100 transition-transform duration-300'>
            <Play className='w-6 h-6 text-white fill-white ml-1' />
          </div>
        </div>

        {/* 底部操作按钮 */}
        {showFavorite && (
          <div className='absolute bottom-3 left-0 right-0 flex justify-center gap-2 opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300'>
            <button
              onClick={(e) => {
                e.stopPropagation();
              }}
              className='w-9 h-9 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-full text-white hover:bg-white/20 transition-colors'
            >
              <Plus className='w-4 h-4' />
            </button>
            <button
              onClick={handleToggleFavorite}
              className={`w-9 h-9 flex items-center justify-center backdrop-blur-sm rounded-full transition-colors ${
                favorited
                  ? 'bg-red-500 text-white'
                  : 'bg-black/60 text-white hover:bg-red-500'
              }`}
            >
              <Heart className={`w-4 h-4 ${favorited ? 'fill-white' : ''}`} />
            </button>
          </div>
        )}
      </div>

      {/* 标题信息 */}
      <div className='mt-3 px-0.5'>
        <h3 className='text-sm font-medium text-white truncate group-hover:text-brand-400 transition-colors'>
          {actualTitle}
        </h3>
        <div className='flex items-center gap-2 mt-1 text-xs text-gray-500'>
          {actualYear && <span>{actualYear}</span>}
          {actualYear && type && <span>·</span>}
          {type && (
            <span>
              {type === 'movie' ? '电影' : type === 'tv' ? '剧集' : type}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
