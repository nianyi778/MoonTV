/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, no-console */

'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';

// 客户端收藏 API
import {
  clearAllFavorites,
  getAllFavorites,
  getAllPlayRecords,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { getDoubanCategories } from '@/lib/douban.client';
import { DoubanItem } from '@/lib/types';

import CapsuleSwitch from '@/components/CapsuleSwitch';
import ContinueWatching from '@/components/ContinueWatching';
import PageLayout from '@/components/PageLayout';
import ScrollableRow from '@/components/ScrollableRow';
import { useSite } from '@/components/SiteProvider';
import VideoCard from '@/components/VideoCard';

function HomeClient() {
  const [activeTab, setActiveTab] = useState<'home' | 'favorites'>('home');
  const [hotMovies, setHotMovies] = useState<DoubanItem[]>([]);
  const [hotTvShows, setHotTvShows] = useState<DoubanItem[]>([]);
  const [hotVarietyShows, setHotVarietyShows] = useState<DoubanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { announcement } = useSite();

  const [showAnnouncement, setShowAnnouncement] = useState(false);

  // 检查公告弹窗状态
  useEffect(() => {
    if (typeof window !== 'undefined' && announcement) {
      const hasSeenAnnouncement = localStorage.getItem('hasSeenAnnouncement');
      if (hasSeenAnnouncement !== announcement) {
        setShowAnnouncement(true);
      } else {
        setShowAnnouncement(Boolean(!hasSeenAnnouncement && announcement));
      }
    }
  }, [announcement]);

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
  };

  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);

  useEffect(() => {
    const fetchDoubanData = async () => {
      try {
        setLoading(true);

        // 并行获取热门电影、热门剧集和热门综艺
        const [moviesData, tvShowsData, varietyShowsData] = await Promise.all([
          getDoubanCategories({
            kind: 'movie',
            category: '热门',
            type: '全部',
          }),
          getDoubanCategories({ kind: 'tv', category: 'tv', type: 'tv' }),
          getDoubanCategories({ kind: 'tv', category: 'show', type: 'show' }),
        ]);

        if (moviesData.code === 200) {
          setHotMovies(moviesData.list);
        }

        if (tvShowsData.code === 200) {
          setHotTvShows(tvShowsData.list);
        }

        if (varietyShowsData.code === 200) {
          setHotVarietyShows(varietyShowsData.list);
        }
      } catch (error) {
        console.error('获取豆瓣数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDoubanData();
  }, []);

  // 处理收藏数据更新的函数
  const updateFavoriteItems = async (allFavorites: Record<string, any>) => {
    const allPlayRecords = await getAllPlayRecords();

    // 根据保存时间排序（从近到远）
    const sorted = Object.entries(allFavorites)
      .sort(([, a], [, b]) => b.save_time - a.save_time)
      .map(([key, fav]) => {
        const plusIndex = key.indexOf('+');
        const source = key.slice(0, plusIndex);
        const id = key.slice(plusIndex + 1);

        // 查找对应的播放记录，获取当前集数
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
  };

  // 当切换到收藏夹时加载收藏数据
  useEffect(() => {
    if (activeTab !== 'favorites') return;

    const loadFavorites = async () => {
      const allFavorites = await getAllFavorites();
      await updateFavoriteItems(allFavorites);
    };

    loadFavorites();

    // 监听收藏更新事件
    const unsubscribe = subscribeToDataUpdates(
      'favoritesUpdated',
      (newFavorites: Record<string, any>) => {
        updateFavoriteItems(newFavorites);
      }
    );

    return unsubscribe;
  }, [activeTab]);

  const handleCloseAnnouncement = (announcement: string) => {
    setShowAnnouncement(false);
    localStorage.setItem('hasSeenAnnouncement', announcement); // 记录已查看弹窗
  };

  return (
    <PageLayout>
      <div className='px-4 sm:px-8 lg:px-12 py-6 sm:py-10 overflow-visible'>
        {/* 顶部 Tab 切换 - 更现代的设计 */}
        <div className='mb-10 flex justify-center'>
          <CapsuleSwitch
            options={[
              { label: '首页', value: 'home' },
              { label: '收藏夹', value: 'favorites' },
            ]}
            active={activeTab}
            onChange={(value) => setActiveTab(value as 'home' | 'favorites')}
          />
        </div>

        <div className='max-w-[1600px] mx-auto'>
          {activeTab === 'favorites' ? (
            // 收藏夹视图
            <section className='mb-8 animate-fade-in'>
              <div className='mb-6 flex items-center justify-between'>
                <h2 className='text-2xl font-bold text-gray-900 dark:text-white'>
                  我的收藏
                </h2>
                {favoriteItems.length > 0 && (
                  <button
                    className='px-4 py-2 text-sm font-medium text-gray-500 hover:text-red-500 bg-gray-100 dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200'
                    onClick={async () => {
                      await clearAllFavorites();
                      setFavoriteItems([]);
                    }}
                  >
                    清空全部
                  </button>
                )}
              </div>
              <div className='grid grid-cols-3 gap-3 sm:gap-6 sm:grid-cols-[repeat(auto-fill,_minmax(160px,_1fr))] lg:grid-cols-[repeat(auto-fill,_minmax(180px,_1fr))]'>
                {favoriteItems.map((item, index) => (
                  <div
                    key={item.id + item.source}
                    className='w-full animate-fade-in-up'
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <VideoCard
                      query={item.search_title}
                      {...item}
                      from='favorite'
                      type={item.episodes > 1 ? 'tv' : ''}
                    />
                  </div>
                ))}
                {favoriteItems.length === 0 && (
                  <div className='col-span-full flex flex-col items-center justify-center py-20 text-gray-400'>
                    <svg
                      className='w-16 h-16 mb-4'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={1.5}
                        d='M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z'
                      />
                    </svg>
                    <p className='text-lg font-medium'>暂无收藏内容</p>
                    <p className='text-sm mt-1'>
                      浏览影片时点击心形图标添加收藏
                    </p>
                  </div>
                )}
              </div>
            </section>
          ) : (
            // 首页视图
            <>
              {/* 继续观看 */}
              <ContinueWatching />

              {/* 热门电影 */}
              <section
                className='mb-10 animate-fade-in-up'
                style={{ animationDelay: '100ms' }}
              >
                <div className='mb-5 flex items-center justify-between'>
                  <h2 className='text-xl sm:text-2xl font-bold text-gray-900 dark:text-white'>
                    热门电影
                  </h2>
                  <Link
                    href='/douban?type=movie'
                    className='group flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400 transition-colors duration-200'
                  >
                    查看更多
                    <ChevronRight className='w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5' />
                  </Link>
                </div>
                <ScrollableRow>
                  {loading
                    ? Array.from({ length: 8 }).map((_, index) => (
                        <div
                          key={index}
                          className='min-w-[100px] w-[100px] sm:min-w-[160px] sm:w-[160px]'
                        >
                          <div className='relative aspect-[2/3] w-full overflow-hidden rounded-xl skeleton' />
                          <div className='mt-3 h-4 w-3/4 skeleton rounded' />
                        </div>
                      ))
                    : hotMovies.map((movie, index) => (
                        <div
                          key={index}
                          className='min-w-[100px] w-[100px] sm:min-w-[160px] sm:w-[160px]'
                        >
                          <VideoCard
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
                </ScrollableRow>
              </section>

              {/* 热门剧集 */}
              <section
                className='mb-10 animate-fade-in-up'
                style={{ animationDelay: '200ms' }}
              >
                <div className='mb-5 flex items-center justify-between'>
                  <h2 className='text-xl sm:text-2xl font-bold text-gray-900 dark:text-white'>
                    热门剧集
                  </h2>
                  <Link
                    href='/douban?type=tv'
                    className='group flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400 transition-colors duration-200'
                  >
                    查看更多
                    <ChevronRight className='w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5' />
                  </Link>
                </div>
                <ScrollableRow>
                  {loading
                    ? Array.from({ length: 8 }).map((_, index) => (
                        <div
                          key={index}
                          className='min-w-[100px] w-[100px] sm:min-w-[160px] sm:w-[160px]'
                        >
                          <div className='relative aspect-[2/3] w-full overflow-hidden rounded-xl skeleton' />
                          <div className='mt-3 h-4 w-3/4 skeleton rounded' />
                        </div>
                      ))
                    : hotTvShows.map((show, index) => (
                        <div
                          key={index}
                          className='min-w-[100px] w-[100px] sm:min-w-[160px] sm:w-[160px]'
                        >
                          <VideoCard
                            from='douban'
                            title={show.title}
                            poster={show.poster}
                            douban_id={show.id}
                            rate={show.rate}
                            year={show.year}
                          />
                        </div>
                      ))}
                </ScrollableRow>
              </section>

              {/* 热门综艺 */}
              <section
                className='mb-10 animate-fade-in-up'
                style={{ animationDelay: '300ms' }}
              >
                <div className='mb-5 flex items-center justify-between'>
                  <h2 className='text-xl sm:text-2xl font-bold text-gray-900 dark:text-white'>
                    热门综艺
                  </h2>
                  <Link
                    href='/douban?type=show'
                    className='group flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400 transition-colors duration-200'
                  >
                    查看更多
                    <ChevronRight className='w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5' />
                  </Link>
                </div>
                <ScrollableRow>
                  {loading
                    ? Array.from({ length: 8 }).map((_, index) => (
                        <div
                          key={index}
                          className='min-w-[100px] w-[100px] sm:min-w-[160px] sm:w-[160px]'
                        >
                          <div className='relative aspect-[2/3] w-full overflow-hidden rounded-xl skeleton' />
                          <div className='mt-3 h-4 w-3/4 skeleton rounded' />
                        </div>
                      ))
                    : hotVarietyShows.map((show, index) => (
                        <div
                          key={index}
                          className='min-w-[100px] w-[100px] sm:min-w-[160px] sm:w-[160px]'
                        >
                          <VideoCard
                            from='douban'
                            title={show.title}
                            poster={show.poster}
                            douban_id={show.id}
                            rate={show.rate}
                            year={show.year}
                          />
                        </div>
                      ))}
                </ScrollableRow>
              </section>
            </>
          )}
        </div>
      </div>
      {announcement && showAnnouncement && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
            showAnnouncement
              ? 'bg-black/40 backdrop-blur-sm'
              : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className='w-full max-w-md glass rounded-2xl p-6 shadow-2xl animate-scale-in'>
            <div className='flex justify-between items-center mb-4'>
              <h3 className='text-xl font-bold text-gray-900 dark:text-white'>
                📢 公告
              </h3>
              <button
                onClick={() => handleCloseAnnouncement(announcement)}
                className='p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors'
                aria-label='关闭'
              >
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
                    d='M6 18L18 6M6 6l12 12'
                  />
                </svg>
              </button>
            </div>
            <div className='mb-6'>
              <div className='relative p-4 rounded-xl bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800'>
                <p className='text-gray-700 dark:text-gray-300 leading-relaxed'>
                  {announcement}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleCloseAnnouncement(announcement)}
              className='btn btn-primary w-full'
            >
              我知道了
            </button>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeClient />
    </Suspense>
  );
}
