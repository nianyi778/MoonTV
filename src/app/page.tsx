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

import CategoryTabs from '@/components/CategoryTabs';
import ContentSection from '@/components/ContentSection';
import Footer from '@/components/Footer';
import HeroCarousel from '@/components/HeroCarousel';
import MobileNav from '@/components/MobileNav';
import MovieCard from '@/components/MovieCard';
import TopNav from '@/components/TopNav';

// 分类配置
const CATEGORIES = [
  '全部',
  '动作',
  '科幻',
  '喜剧',
  '剧情',
  '爱情',
  '恐怖',
  '动画',
  '纪录片',
];

function HomeClient() {
  const [activeCategory, setActiveCategory] = useState('全部');
  const [hotMovies, setHotMovies] = useState<DoubanItem[]>([]);
  const [hotTvShows, setHotTvShows] = useState<DoubanItem[]>([]);
  const [newReleases, setNewReleases] = useState<DoubanItem[]>([]);
  const [loading, setLoading] = useState(true);

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

  // 电影骨架屏
  const MovieSkeleton = () => (
    <div className='flex-shrink-0 w-[140px] md:w-[180px]'>
      <div className='aspect-[2/3] rounded-xl skeleton' />
      <div className='mt-3 h-4 w-3/4 skeleton rounded' />
      <div className='mt-2 h-3 w-1/2 skeleton rounded' />
    </div>
  );

  return (
    <div className='min-h-screen bg-[#0a0a0a]'>
      {/* 顶部导航 */}
      <TopNav transparent={!showFavorites} />

      {showFavorites ? (
        // 收藏夹视图
        <main className='pt-24 pb-24 md:pb-12'>
          <div className='px-[5%]'>
            <div className='flex items-center justify-between mb-8'>
              <div className='flex items-center gap-3'>
                <Heart className='w-8 h-8 text-brand-500' />
                <h1 className='text-3xl font-bold text-white'>我的收藏</h1>
              </div>
              {favoriteItems.length > 0 && (
                <button
                  onClick={async () => {
                    await clearAllFavorites();
                    setFavoriteItems([]);
                  }}
                  className='px-4 py-2 text-sm font-medium text-gray-400 hover:text-red-500 bg-white/5 hover:bg-red-500/10 rounded-lg transition-all'
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
              <div className='flex flex-col items-center justify-center py-20 text-gray-500'>
                <Heart className='w-16 h-16 mb-4 opacity-30' />
                <p className='text-lg font-medium'>暂无收藏内容</p>
                <p className='text-sm mt-1 text-gray-600'>
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
          <HeroCarousel items={hotMovies.slice(0, 5)} />

          {/* 分类标签 */}
          <div className='px-[5%] -mt-8 relative z-10'>
            <CategoryTabs
              categories={CATEGORIES}
              activeCategory={activeCategory}
              onChange={setActiveCategory}
            />
          </div>

          {/* 热门电影 */}
          <ContentSection title='热门电影' moreLink='/douban?type=movie'>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <MovieSkeleton key={i} />
                ))
              : hotMovies.map((movie) => (
                  <div
                    key={movie.id}
                    className='flex-shrink-0 w-[140px] md:w-[180px]'
                  >
                    <MovieCard
                      from='douban'
                      title={movie.title}
                      poster={movie.poster}
                      douban_id={movie.id}
                      rate={movie.rate}
                      year={movie.year}
                      type='movie'
                    />
                  </div>
                ))}
          </ContentSection>

          {/* 最新上映 */}
          <ContentSection title='最新上映' moreLink='/douban?type=movie'>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <MovieSkeleton key={i} />
                ))
              : newReleases.map((movie) => (
                  <div
                    key={movie.id}
                    className='flex-shrink-0 w-[140px] md:w-[180px]'
                  >
                    <MovieCard
                      from='douban'
                      title={movie.title}
                      poster={movie.poster}
                      douban_id={movie.id}
                      rate={movie.rate}
                      year={movie.year}
                      type='movie'
                    />
                  </div>
                ))}
          </ContentSection>

          {/* 热门剧集 */}
          <ContentSection title='热门剧集' moreLink='/douban?type=tv'>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <MovieSkeleton key={i} />
                ))
              : hotTvShows.map((show) => (
                  <div
                    key={show.id}
                    className='flex-shrink-0 w-[140px] md:w-[180px]'
                  >
                    <MovieCard
                      from='douban'
                      title={show.title}
                      poster={show.poster}
                      douban_id={show.id}
                      rate={show.rate}
                      year={show.year}
                      type='tv'
                    />
                  </div>
                ))}
          </ContentSection>

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
        <div className='min-h-screen bg-[#0a0a0a] flex items-center justify-center'>
          <div className='w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin' />
        </div>
      }
    >
      <HomeClient />
    </Suspense>
  );
}
