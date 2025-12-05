/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
'use client';

import { Heart } from 'lucide-react';
import { Suspense, useCallback, useEffect, useState } from 'react';

import {
  clearAllFavorites,
  getAllFavorites,
  getAllPlayRecords,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { getDoubanCategories } from '@/lib/douban.client';
import { DoubanItem } from '@/lib/types';

import MobileNav from '@/components/MobileNav';
import MovieCard from '@/components/MovieCard';
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

  // 收藏夹数据
  type FavoriteItem = {
    id: string;
    source: string;
    title: string;
    poster: string;
    episodes: number;
    source_name: string;
    currentEpisode?: number;
    search_title?: string;
    year?: string;
  };

  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);

  // 检查 URL 参数
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('tab') === 'favorites') {
        setShowFavorites(true);
      }
    }
  }, []);

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

  // 处理收藏数据更新的函数
  const updateFavoriteItems = useCallback(
    async (allFavorites: Record<string, any>) => {
      const allPlayRecords = await getAllPlayRecords();

      const sorted = Object.entries(allFavorites)
        .sort(([, a], [, b]) => b.save_time - a.save_time)
        .map(([key, fav]) => {
          const plusIndex = key.indexOf('+');
          const source = key.slice(0, plusIndex);
          const id = key.slice(plusIndex + 1);

          const playRecord = allPlayRecords[key];
          const currentEpisode = playRecord?.index;

          return {
            id,
            source,
            title: fav.title,
            year: fav.year,
            poster: fav.cover,
            episodes: fav.total_episodes,
            source_name: fav.source_name,
            currentEpisode,
            search_title: fav?.search_title,
          } as FavoriteItem;
        });
      setFavoriteItems(sorted);
    },
    []
  );

  // 加载收藏数据
  useEffect(() => {
    if (!showFavorites) return;

    const loadFavorites = async () => {
      const allFavorites = await getAllFavorites();
      await updateFavoriteItems(allFavorites);
    };

    loadFavorites();

    const unsubscribe = subscribeToDataUpdates(
      'favoritesUpdated',
      (newFavorites: Record<string, any>) => {
        updateFavoriteItems(newFavorites);
      }
    );

    return unsubscribe;
  }, [showFavorites, updateFavoriteItems]);

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
      <Header transparent={!showFavorites} />

      {showFavorites ? (
        // 收藏夹视图
        <main className='pt-24 pb-24 md:pb-12'>
          <div className='container mx-auto px-4'>
            <div className='flex items-center justify-between mb-8'>
              <div className='flex items-center gap-3'>
                <Heart className='w-8 h-8 text-orange-500' />
                <h1 className='text-3xl font-bold text-white'>我的收藏</h1>
              </div>
              {favoriteItems.length > 0 && (
                <button
                  onClick={async () => {
                    await clearAllFavorites();
                    setFavoriteItems([]);
                  }}
                  className='px-4 py-2 text-sm font-medium text-zinc-400 hover:text-red-500 bg-zinc-800 hover:bg-red-500/10 rounded-lg transition-all'
                >
                  清空全部
                </button>
              )}
            </div>

            {favoriteItems.length > 0 ? (
              <div className='grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4 md:gap-5'>
                {favoriteItems.map((item, index) => (
                  <div
                    key={item.id + item.source}
                    className='animate-fade-in-up'
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <MovieCard
                      query={item.search_title}
                      {...item}
                      from='favorite'
                      type={item.episodes > 1 ? 'tv' : 'movie'}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className='flex flex-col items-center justify-center py-20 text-zinc-500'>
                <Heart className='w-16 h-16 mb-4 opacity-30' />
                <p className='text-lg font-medium'>暂无收藏内容</p>
                <p className='text-sm mt-1 text-zinc-600'>
                  浏览影片时点击心形图标添加收藏
                </p>
              </div>
            )}
          </div>
        </main>
      ) : (
        // 首页视图
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
          <CategoryNav onCategoryChange={handleCategoryChange} />

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
      )}

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
