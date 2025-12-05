/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { ChevronLeft, ChevronRight, Info, Play, Plus } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { DoubanItem } from '@/lib/types';
import { processImageUrl } from '@/lib/utils';

interface HeroCarouselProps {
  items: DoubanItem[];
}

export default function HeroCarousel({ items }: HeroCarouselProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const currentItem = items[currentIndex];

  // 自动轮播
  useEffect(() => {
    if (!isAutoPlaying || items.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [isAutoPlaying, items.length]);

  const goToPrev = useCallback(() => {
    setIsAutoPlaying(false);
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  }, [items.length]);

  const goToNext = useCallback(() => {
    setIsAutoPlaying(false);
    setCurrentIndex((prev) => (prev + 1) % items.length);
  }, [items.length]);

  const goToSlide = useCallback((index: number) => {
    setIsAutoPlaying(false);
    setCurrentIndex(index);
  }, []);

  const handlePlay = useCallback(() => {
    if (!currentItem) return;
    router.push(
      `/play?title=${encodeURIComponent(currentItem.title.trim())}${
        currentItem.year ? `&year=${currentItem.year}` : ''
      }&stype=movie`
    );
  }, [router, currentItem]);

  const handleDetail = useCallback(() => {
    if (!currentItem?.id) return;
    window.open(`https://movie.douban.com/subject/${currentItem.id}`, '_blank');
  }, [currentItem]);

  if (!items.length) {
    // 没有数据时显示占位区域
    return (
      <section className='relative w-full h-[50vh] min-h-[400px] bg-gradient-to-b from-gray-900 to-[#0a0a0a] flex items-center justify-center'>
        <div className='text-center text-gray-500'>
          <div className='w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center'>
            <Play className='w-8 h-8 opacity-30' />
          </div>
          <p>暂无推荐内容</p>
        </div>
      </section>
    );
  }

  return (
    <section className='relative w-full h-[70vh] min-h-[500px] max-h-[800px] overflow-hidden'>
      {/* 背景图片 */}
      <div className='absolute inset-0'>
        {items.map((item, index) => (
          <div
            key={item.id}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              index === currentIndex ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <Image
              src={processImageUrl(item.poster)}
              alt={item.title}
              fill
              className='object-cover'
              priority={index === 0}
              referrerPolicy='no-referrer'
            />
          </div>
        ))}
      </div>

      {/* 渐变遮罩 */}
      <div className='absolute inset-0 bg-gradient-to-r from-black/95 via-black/60 to-transparent' />
      <div className='absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent' />

      {/* 内容 */}
      <div className='absolute left-[5%] bottom-[15%] max-w-[600px] z-10'>
        {/* 导演/类型标签 */}
        <div className='text-brand-500 text-sm font-semibold tracking-wider mb-3 animate-fade-in'>
          热门推荐 · {currentItem?.year}
        </div>

        {/* 标题 */}
        <h1 className='text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-4 leading-tight animate-fade-in-up'>
          {currentItem?.title}
        </h1>

        {/* 元信息 */}
        <div className='flex items-center gap-4 mb-4 text-gray-300 text-sm animate-fade-in'>
          {currentItem?.rate && (
            <div className='flex items-center gap-1.5'>
              <svg
                className='w-4 h-4 text-yellow-400 fill-yellow-400'
                viewBox='0 0 20 20'
              >
                <path d='M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z' />
              </svg>
              <span className='text-yellow-400 font-bold'>
                {currentItem.rate} 分
              </span>
            </div>
          )}
          <span>{currentItem?.year}</span>
        </div>

        {/* 操作按钮 */}
        <div
          className='flex items-center gap-4 mt-6 animate-fade-in-up'
          style={{ animationDelay: '200ms' }}
        >
          <button
            onClick={handlePlay}
            className='flex items-center gap-2 px-8 py-3.5 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-lg transition-all duration-300 hover:shadow-glow'
          >
            <Play className='w-5 h-5 fill-white' />
            立即播放
          </button>
          <button
            onClick={handleDetail}
            className='flex items-center gap-2 px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg backdrop-blur-sm border border-white/20 transition-all duration-300'
          >
            <Plus className='w-5 h-5' />
            添加片单
          </button>
          <button
            onClick={handleDetail}
            className='flex items-center gap-2 px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg backdrop-blur-sm border border-white/20 transition-all duration-300'
          >
            <Info className='w-5 h-5' />
            详细信息
          </button>
        </div>
      </div>

      {/* 轮播指示器 */}
      <div className='absolute right-[5%] bottom-[15%] flex items-center gap-2'>
        {items.slice(0, 5).map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`h-1 rounded-full transition-all duration-300 ${
              index === currentIndex
                ? 'w-12 bg-brand-500'
                : 'w-8 bg-white/30 hover:bg-white/50'
            }`}
          />
        ))}
      </div>

      {/* 左右箭头 */}
      <button
        onClick={goToPrev}
        className='absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center bg-black/30 hover:bg-black/50 rounded-full text-white transition-all duration-300 opacity-0 hover:opacity-100 group-hover:opacity-100'
      >
        <ChevronLeft className='w-6 h-6' />
      </button>
      <button
        onClick={goToNext}
        className='absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center bg-black/30 hover:bg-black/50 rounded-full text-white transition-all duration-300 opacity-0 hover:opacity-100 group-hover:opacity-100'
      >
        <ChevronRight className='w-6 h-6' />
      </button>

      {/* 音量控制 (装饰性) */}
      <div className='absolute right-[5%] bottom-[40%] flex items-center gap-3'>
        <button className='w-10 h-10 flex items-center justify-center bg-black/30 hover:bg-black/50 rounded-full text-white/70 hover:text-white transition-all duration-300 backdrop-blur-sm border border-white/10'>
          <svg
            className='w-5 h-5'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z'
            />
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2'
            />
          </svg>
        </button>
      </div>
    </section>
  );
}
