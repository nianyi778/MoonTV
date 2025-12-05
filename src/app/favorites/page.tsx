'use client';

import { Heart } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import {
  clearAllFavorites,
  getAllFavorites,
  getAllPlayRecords,
  subscribeToDataUpdates,
} from '@/lib/db.client';

import MobileNav from '@/components/MobileNav';
import MovieCard from '@/components/MovieCard';
import { Footer } from '@/components/ui/Footer';
import { Header } from '@/components/ui/Header';

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

export default function FavoritesPage() {
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 处理收藏数据更新的函数
  const updateFavoriteItems = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    const loadFavorites = async () => {
      setLoading(true);
      const allFavorites = await getAllFavorites();
      await updateFavoriteItems(allFavorites);
      setLoading(false);
    };

    loadFavorites();

    const unsubscribe = subscribeToDataUpdates(
      'favoritesUpdated',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (newFavorites: Record<string, any>) => {
        updateFavoriteItems(newFavorites);
      }
    );

    return unsubscribe;
  }, [updateFavoriteItems]);

  return (
    <div className='min-h-screen bg-zinc-950'>
      {/* 顶部导航 */}
      <Header />

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

          {loading ? (
            // 加载骨架屏
            <div className='grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4 md:gap-5'>
              {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} className='flex-shrink-0'>
                  <div className='aspect-[2/3] rounded-lg bg-zinc-800 animate-pulse' />
                  <div className='mt-3 h-4 w-3/4 bg-zinc-800 rounded animate-pulse' />
                  <div className='mt-2 h-3 w-1/2 bg-zinc-800 rounded animate-pulse' />
                </div>
              ))}
            </div>
          ) : favoriteItems.length > 0 ? (
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

      {/* 底部导航 */}
      <Footer />
      <MobileNav />
    </div>
  );
}
