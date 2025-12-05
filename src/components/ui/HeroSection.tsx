'use client';

import {
  ChevronLeft,
  ChevronRight,
  Info,
  Play,
  Plus,
  Volume2,
  VolumeX,
} from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { getHDCover } from '@/lib/hdCover';

interface HeroItem {
  id: string;
  vod_id: string;
  vod_name: string;
  vod_pic: string;
  vod_year?: string;
  vod_remarks?: string;
  vod_content?: string;
  type_name?: string;
  api: string;
  site_key?: string;
}

interface HeroSectionProps {
  items: HeroItem[];
}

// 处理图片 URL，豆瓣图片需要代理
function getProxiedImageUrl(url: string): string {
  if (!url) return '/placeholder.jpg';
  if (url.includes('doubanio.com') || url.includes('douban.com')) {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

// 存储已加载的高清封面
const hdCoversCache = new Map<string, string>();

export function HeroSection({ items }: HeroSectionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [hdCovers, setHdCovers] = useState<Record<string, string>>({});
  const router = useRouter();

  const heroItems = items.slice(0, 5);

  // 只加载当前和下一个 item 的 TMDB 高清封面（懒加载）
  useEffect(() => {
    const loadCurrentHDCover = async () => {
      const indicesToLoad = [
        currentIndex,
        (currentIndex + 1) % heroItems.length,
      ];

      for (const idx of indicesToLoad) {
        const item = heroItems[idx];
        if (!item) continue;

        const key = item.id || item.vod_id;

        // 已有缓存则跳过
        if (hdCoversCache.has(key) || hdCovers[key]) continue;

        try {
          const hdUrl = await getHDCover(
            item.vod_pic,
            item.vod_name,
            item.vod_year,
            'backdrop'
          );

          // 只有 TMDB 图片才更新
          if (hdUrl.includes('tmdb.org')) {
            hdCoversCache.set(key, hdUrl);
            setHdCovers((prev) => ({ ...prev, [key]: hdUrl }));
          }
        } catch {
          // 忽略错误
        }
      }
    };

    if (heroItems.length > 0) {
      loadCurrentHDCover();
    }
  }, [currentIndex, heroItems, hdCovers]);

  const goToSlide = useCallback(
    (index: number) => {
      if (isTransitioning) return;
      setIsTransitioning(true);
      setCurrentIndex(index);
      setTimeout(() => setIsTransitioning(false), 500);
    },
    [isTransitioning]
  );

  const goToPrevious = useCallback(() => {
    const newIndex =
      currentIndex === 0 ? heroItems.length - 1 : currentIndex - 1;
    goToSlide(newIndex);
  }, [currentIndex, heroItems.length, goToSlide]);

  const goToNext = useCallback(() => {
    const newIndex =
      currentIndex === heroItems.length - 1 ? 0 : currentIndex + 1;
    goToSlide(newIndex);
  }, [currentIndex, heroItems.length, goToSlide]);

  // Auto advance every 8 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      goToNext();
    }, 8000);

    return () => clearInterval(timer);
  }, [goToNext]);

  const handlePlay = (item: HeroItem) => {
    // 豆瓣数据需要通过搜索跳转
    if (item.site_key === 'douban') {
      router.push(
        `/play?title=${encodeURIComponent(item.vod_name)}&year=${
          item.vod_year || ''
        }&stype=movie&prefer=true`
      );
    } else {
      router.push(
        `/play?id=${item.vod_id}&api=${encodeURIComponent(item.api)}`
      );
    }
  };

  if (heroItems.length === 0) {
    return (
      <section className='relative h-[85vh] w-full bg-zinc-900 flex items-center justify-center'>
        <div className='text-zinc-400'>加载中...</div>
      </section>
    );
  }

  const currentItem = heroItems[currentIndex];

  return (
    <section className='relative h-[85vh] w-full overflow-hidden'>
      {/* Background Images */}
      {heroItems.map((item, index) => {
        const key = item.id || item.vod_id;
        // 优先使用 TMDB 高清封面，否则用代理后的豆瓣图
        const hdPoster = hdCovers[key] || getProxiedImageUrl(item.vod_pic);

        return (
          <div
            key={item.id || index}
            className={`absolute inset-0 transition-opacity duration-700 ${
              index === currentIndex ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <Image
              src={hdPoster}
              alt={item.vod_name}
              fill
              className='object-cover'
              priority={index === 0}
              unoptimized
            />
          </div>
        );
      })}

      {/* Gradient Overlays */}
      <div className='absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent' />
      <div className='absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/40 to-transparent' />

      {/* Content */}
      <div className='absolute inset-0 flex items-end pb-20 md:pb-30'>
        <div className='container mx-auto px-4 md:px-8'>
          <div className='max-w-2xl space-y-4 md:space-y-6'>
            {/* Category Tag */}
            {currentItem.type_name && (
              <span
                className={`inline-block px-3 py-1 rounded-md text-xs font-semibold bg-orange-500 text-white transform transition-all duration-500 ${
                  isTransitioning
                    ? 'opacity-0 translate-y-4'
                    : 'opacity-100 translate-y-0'
                }`}
              >
                {currentItem.type_name}
              </span>
            )}

            {/* Title */}
            <h1
              className={`text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight transform transition-all duration-500 delay-100 ${
                isTransitioning
                  ? 'opacity-0 translate-y-4'
                  : 'opacity-100 translate-y-0'
              }`}
            >
              {currentItem.vod_name}
            </h1>

            {/* Meta Info */}
            <div
              className={`flex items-center gap-3 text-zinc-300 transform transition-all duration-500 delay-150 ${
                isTransitioning
                  ? 'opacity-0 translate-y-4'
                  : 'opacity-100 translate-y-0'
              }`}
            >
              {currentItem.vod_year && (
                <>
                  <span className='text-sm'>{currentItem.vod_year}</span>
                  <span className='w-1 h-1 rounded-full bg-zinc-500' />
                </>
              )}
              {currentItem.vod_remarks && (
                <span className='text-sm'>{currentItem.vod_remarks}</span>
              )}
            </div>

            {/* Description */}
            {currentItem.vod_content && (
              <p
                className={`text-sm md:text-base text-zinc-400 line-clamp-2 md:line-clamp-3 max-w-xl transform transition-all duration-500 delay-200 ${
                  isTransitioning
                    ? 'opacity-0 translate-y-4'
                    : 'opacity-100 translate-y-0'
                }`}
              >
                {currentItem.vod_content.replace(/<[^>]+>/g, '')}
              </p>
            )}

            {/* Action Buttons */}
            <div
              className={`flex items-center gap-3 pt-2 transform transition-all duration-500 delay-250 ${
                isTransitioning
                  ? 'opacity-0 translate-y-4'
                  : 'opacity-100 translate-y-0'
              }`}
            >
              <button
                onClick={() => handlePlay(currentItem)}
                className='flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-all duration-200 hover:scale-105'
              >
                <Play className='h-5 w-5 fill-current' />
                <span>立即播放</span>
              </button>

              <button className='flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white font-semibold rounded-lg transition-all duration-200 border border-white/20'>
                <Plus className='h-5 w-5' />
                <span className='hidden md:inline'>添加片单</span>
              </button>

              <button
                onClick={() => handlePlay(currentItem)}
                className='flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white font-semibold rounded-lg transition-all duration-200 border border-white/20'
              >
                <Info className='h-5 w-5' />
                <span className='hidden md:inline'>详细信息</span>
              </button>
            </div>
          </div>
        </div>
        {/* Bottom Controls - moved to bottom left */}
        <div className='absolute bottom-8 right-8 flex items-center gap-4'>
          {/* Mute Toggle */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className='p-2 rounded-full bg-black/30 hover:bg-black/50 border border-white/20 text-white transition-all'
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <VolumeX className='h-4 w-4' />
            ) : (
              <Volume2 className='h-4 w-4' />
            )}
          </button>

          {/* Slide Indicators */}
          <div className='flex items-center gap-2'>
            {heroItems.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`h-1 rounded-full transition-all duration-300 ${
                  index === currentIndex
                    ? 'w-8 bg-orange-500'
                    : 'w-2 bg-white/30 hover:bg-white/50'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Navigation Arrows */}
      <button
        onClick={goToPrevious}
        className='absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white transition-all opacity-0 hover:opacity-100 group-hover:opacity-100 focus:opacity-100'
        aria-label='Previous slide'
      >
        <ChevronLeft className='h-6 w-6' />
      </button>

      <button
        onClick={goToNext}
        className='absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white transition-all opacity-0 hover:opacity-100 group-hover:opacity-100 focus:opacity-100'
        aria-label='Next slide'
      >
        <ChevronRight className='h-6 w-6' />
      </button>
    </section>
  );
}
