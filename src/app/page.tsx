/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';

import { getDoubanCategories } from '@/lib/douban.client';
import { DoubanItem } from '@/lib/types';

import MobileNav from '@/components/MobileNav';
import { CategoryInfo, CategoryNav } from '@/components/ui/CategoryNav';
import { Footer } from '@/components/ui/Footer';
import { Header } from '@/components/ui/Header';
import { HeroSection } from '@/components/ui/HeroSection';
import { MovieSection } from '@/components/ui/MovieSection';

// Transform DoubanItem to the format expected by HeroSection and MovieSection
function transformDoubanToHeroItem(items: DoubanItem[], api = 'douban') {
  return items.map((item) => ({
    id: item.id,
    vod_id: item.id,
    vod_name: item.title,
    vod_pic: item.poster,
    vod_year: item.year,
    vod_remarks: item.rate ? `${item.rate}分` : undefined,
    vod_content: '', // DoubanItem doesn't have description in list
    type_name: '电影',
    api: api,
    site_key: 'douban',
  }));
}

function transformDoubanToMovieItem(items: DoubanItem[], api = 'douban') {
  return items.map((item) => ({
    id: item.id,
    vod_id: item.id,
    vod_name: item.title,
    vod_pic: item.poster,
    vod_year: item.year,
    vod_remarks: item.rate ? `${item.rate}分` : undefined,
    type_name: '',
    api: api,
    site_key: 'douban',
  }));
}

function HomeClient() {
  const [hotMovies, setHotMovies] = useState<DoubanItem[]>([]);
  const [hotTvShows, setHotTvShows] = useState<DoubanItem[]>([]);
  const [newReleases, setNewReleases] = useState<DoubanItem[]>([]);
  const [filteredMovies, setFilteredMovies] = useState<DoubanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<CategoryInfo | null>(
    null
  );

  useEffect(() => {
    const fetchDoubanData = async () => {
      try {
        setLoading(true);

        // 并行获取热门电影、热门剧集和最新上映
        const [moviesData, tvShowsData, newData] = await Promise.all([
          getDoubanCategories({
            kind: 'movie',
            category: '热门',
            type: '全部',
          }),
          getDoubanCategories({ kind: 'tv', category: 'tv', type: 'tv' }),
          getDoubanCategories({
            kind: 'movie',
            category: '最新',
            type: '全部',
          }),
        ]);

        if (moviesData.code === 200) {
          setHotMovies(moviesData.list);
        }

        if (tvShowsData.code === 200) {
          setHotTvShows(tvShowsData.list);
        }

        if (newData.code === 200) {
          setNewReleases(newData.list);
        }
      } catch {
        // 静默失败
      } finally {
        setLoading(false);
      }
    };

    fetchDoubanData();
  }, []);

  // 处理分类切换
  const handleCategoryChange = useCallback(async (category: CategoryInfo) => {
    setCurrentCategory(category);

    // 如果是全部，清空筛选结果
    if (category.id === 'all') {
      setFilteredMovies([]);
      return;
    }

    setCategoryLoading(true);
    try {
      const result = await getDoubanCategories({
        kind: 'movie',
        category: category.doubanCategory,
        type: category.doubanType,
        pageLimit: 20,
      });

      if (result.code === 200) {
        setFilteredMovies(result.list);
      }
    } catch {
      // 静默失败
    } finally {
      setCategoryLoading(false);
    }
  }, []);

  // 骨架屏
  const MovieSkeleton = () => (
    <div className='flex-shrink-0 w-[140px] md:w-[180px]'>
      <div className='aspect-[2/3] rounded-lg bg-zinc-800 animate-pulse' />
      <div className='mt-3 h-4 w-3/4 bg-zinc-800 rounded animate-pulse' />
      <div className='mt-2 h-3 w-1/2 bg-zinc-800 rounded animate-pulse' />
    </div>
  );

  // Hero 骨架屏
  const HeroSkeleton = () => (
    <section className='relative h-[85vh] w-full bg-zinc-900 flex items-center justify-center'>
      <div className='text-zinc-400'>加载中...</div>
    </section>
  );

  return (
    <div className='min-h-screen bg-zinc-950'>
      {/* 顶部导航 */}
      <Header transparent />

      <main className='pb-24 md:pb-0'>
        {/* 英雄轮播 */}
        {loading ? (
          <HeroSkeleton />
        ) : (
          <HeroSection
            items={transformDoubanToHeroItem(hotMovies.slice(0, 5))}
          />
        )}

        {/* 分类标签 */}
        <CategoryNav
          activeId={currentCategory?.id || 'all'}
          onCategoryChange={handleCategoryChange}
        />

        {/* 分类筛选结果 */}
        {currentCategory &&
          currentCategory.id !== 'all' &&
          (categoryLoading ? (
            <section className='container mx-auto px-4 py-6 md:py-8'>
              <h2 className='text-xl md:text-2xl font-bold text-white mb-4'>
                {currentCategory.name}电影
              </h2>
              <div className='flex gap-4 overflow-hidden'>
                {Array.from({ length: 8 }).map((_, i) => (
                  <MovieSkeleton key={i} />
                ))}
              </div>
            </section>
          ) : filteredMovies.length > 0 ? (
            <MovieSection
              title={`${currentCategory.name}电影`}
              movies={transformDoubanToMovieItem(filteredMovies)}
            />
          ) : null)}

        {/* 热门电影 */}
        {loading ? (
          <section className='container mx-auto px-4 py-6 md:py-8'>
            <h2 className='text-xl md:text-2xl font-bold text-white mb-4'>
              热门电影
            </h2>
            <div className='flex gap-4 overflow-hidden'>
              {Array.from({ length: 8 }).map((_, i) => (
                <MovieSkeleton key={i} />
              ))}
            </div>
          </section>
        ) : (
          <MovieSection
            title='热门电影'
            movies={transformDoubanToMovieItem(hotMovies)}
          />
        )}

        {/* 最新上映 */}
        {loading ? (
          <section className='container mx-auto px-4 py-6 md:py-8'>
            <h2 className='text-xl md:text-2xl font-bold text-white mb-4'>
              最新上映
            </h2>
            <div className='flex gap-4 overflow-hidden'>
              {Array.from({ length: 8 }).map((_, i) => (
                <MovieSkeleton key={i} />
              ))}
            </div>
          </section>
        ) : (
          <MovieSection
            title='最新上映'
            movies={transformDoubanToMovieItem(newReleases)}
          />
        )}

        {/* 热门剧集 */}
        {loading ? (
          <section className='container mx-auto px-4 py-6 md:py-8'>
            <h2 className='text-xl md:text-2xl font-bold text-white mb-4'>
              热门剧集
            </h2>
            <div className='flex gap-4 overflow-hidden'>
              {Array.from({ length: 8 }).map((_, i) => (
                <MovieSkeleton key={i} />
              ))}
            </div>
          </section>
        ) : (
          <MovieSection
            title='热门剧集'
            movies={transformDoubanToMovieItem(hotTvShows)}
          />
        )}

        {/* 页脚 */}
        <Footer />
      </main>

      {/* 移动端底部导航 */}
      <MobileNav />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className='min-h-screen bg-zinc-950 flex items-center justify-center'>
          <div className='w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin' />
        </div>
      }
    >
      <HomeClient />
    </Suspense>
  );
}
