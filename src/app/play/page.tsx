/* eslint-disable no-console, react-hooks/exhaustive-deps, @typescript-eslint/no-explicit-any, @next/next/no-img-element */
'use client';

import {
  ChevronLeft,
  ChevronRight,
  Heart,
  Layers,
  List,
  Play,
  Share2,
  X,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import {
  deleteFavorite,
  deletePlayRecord,
  generateStorageKey,
  getAllPlayRecords,
  getSkipConfig,
  isFavorited,
  saveFavorite,
  savePlayRecord,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { getDoubanCategories } from '@/lib/douban.client';
import { DoubanItem, SearchResult } from '@/lib/types';
import { getVideoResolutionFromM3u8, processImageUrl } from '@/lib/utils';

import TopNav from '@/components/TopNav';
import { Footer } from '@/components/ui/Footer';
import { MovieCard } from '@/components/ui/MovieCard';
import VidstackPlayer, { VidstackPlayerRef } from '@/components/VidstackPlayer';

function PlayPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // UI 状态
  const [showSourcePanel, setShowSourcePanel] = useState(false);
  const [showEpisodePanel, setShowEpisodePanel] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // 加载状态
  const [loading, setLoading] = useState(true);
  const [loadingStage, setLoadingStage] = useState<
    'searching' | 'preferring' | 'fetching' | 'ready'
  >('searching');
  const [loadingMessage, setLoadingMessage] = useState('正在搜索播放源...');
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SearchResult | null>(null);

  // 收藏状态
  const [favorited, setFavorited] = useState(false);

  // 跳过片头片尾配置
  const [skipConfig, setSkipConfig] = useState<{
    enable: boolean;
    intro_time: number;
    outro_time: number;
  }>({
    enable: false,
    intro_time: 0,
    outro_time: 0,
  });
  const skipConfigRef = useRef(skipConfig);
  useEffect(() => {
    skipConfigRef.current = skipConfig;
  }, [skipConfig]);

  // 去广告开关
  const [blockAdEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const v = localStorage.getItem('enable_blockad');
      if (v !== null) return v === 'true';
    }
    return true;
  });

  // 视频基本信息
  const [videoTitle, setVideoTitle] = useState(searchParams.get('title') || '');
  const [videoYear, setVideoYear] = useState(searchParams.get('year') || '');
  const [videoCover, setVideoCover] = useState('');
  const [currentSource, setCurrentSource] = useState(
    searchParams.get('source') || ''
  );
  const [currentId, setCurrentId] = useState(searchParams.get('id') || '');
  const [searchTitle] = useState(searchParams.get('stitle') || '');
  const [searchType] = useState(searchParams.get('stype') || '');
  const [needPrefer, setNeedPrefer] = useState(
    searchParams.get('prefer') === 'true'
  );
  const needPreferRef = useRef(needPrefer);
  useEffect(() => {
    needPreferRef.current = needPrefer;
  }, [needPrefer]);

  // 集数相关
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);
  const currentSourceRef = useRef(currentSource);
  const currentIdRef = useRef(currentId);
  const videoTitleRef = useRef(videoTitle);
  const videoYearRef = useRef(videoYear);
  const detailRef = useRef<SearchResult | null>(detail);
  const currentEpisodeIndexRef = useRef(currentEpisodeIndex);

  useEffect(() => {
    currentSourceRef.current = currentSource;
    currentIdRef.current = currentId;
    detailRef.current = detail;
    currentEpisodeIndexRef.current = currentEpisodeIndex;
    videoTitleRef.current = videoTitle;
    videoYearRef.current = videoYear;
  }, [
    currentSource,
    currentId,
    detail,
    currentEpisodeIndex,
    videoTitle,
    videoYear,
  ]);

  // 视频播放地址
  const [videoUrl, setVideoUrl] = useState('');
  const totalEpisodes = detail?.episodes?.length || 0;
  const resumeTimeRef = useRef<number | null>(null);

  // 换源相关
  const [availableSources, setAvailableSources] = useState<SearchResult[]>([]);
  const [sourceSearchLoading, setSourceSearchLoading] = useState(false);
  const [_sourceSearchError, setSourceSearchError] = useState<string | null>(
    null
  );

  // 优选开关
  const [optimizationEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('enableOptimization');
      if (saved !== null) {
        try {
          return JSON.parse(saved);
        } catch {
          /* ignore */
        }
      }
    }
    return true;
  });

  // 预计算的视频信息
  const [precomputedVideoInfo, setPrecomputedVideoInfo] = useState<
    Map<
      string,
      {
        quality: string;
        loadSpeed: string;
        pingTime: number;
        hasError?: boolean;
      }
    >
  >(new Map());

  // 视频加载状态
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [videoLoadingStage, setVideoLoadingStage] = useState<
    'initing' | 'sourceChanging'
  >('initing');

  // 播放进度保存
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveTimeRef = useRef<number>(0);
  const playerRef = useRef<VidstackPlayerRef>(null);

  // 相关推荐（同类型豆瓣内容）
  const [relatedMovies, setRelatedMovies] = useState<DoubanItem[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);

  // ============================================================================
  // 工具函数
  // ============================================================================

  const preferBestSource = async (
    sources: SearchResult[]
  ): Promise<SearchResult> => {
    if (sources.length === 1) return sources[0];

    const batchSize = Math.ceil(sources.length / 2);
    const allResults: Array<{
      source: SearchResult;
      testResult: { quality: string; loadSpeed: string; pingTime: number };
    } | null> = [];

    for (let start = 0; start < sources.length; start += batchSize) {
      const batchSources = sources.slice(start, start + batchSize);
      const batchResults = await Promise.all(
        batchSources.map(async (source) => {
          try {
            if (!source.episodes || source.episodes.length === 0) {
              return null;
            }
            const episodeUrl =
              source.episodes.length > 1
                ? source.episodes[1]
                : source.episodes[0];
            const testResult = await getVideoResolutionFromM3u8(episodeUrl);
            return { source, testResult };
          } catch {
            return null;
          }
        })
      );
      allResults.push(...batchResults);
    }

    const newVideoInfoMap = new Map<
      string,
      {
        quality: string;
        loadSpeed: string;
        pingTime: number;
        hasError?: boolean;
      }
    >();
    allResults.forEach((result, index) => {
      const source = sources[index];
      const sourceKey = `${source.source}-${source.id}`;
      if (result) {
        newVideoInfoMap.set(sourceKey, result.testResult);
      }
    });

    const successfulResults = allResults.filter(Boolean) as Array<{
      source: SearchResult;
      testResult: { quality: string; loadSpeed: string; pingTime: number };
    }>;

    setPrecomputedVideoInfo(newVideoInfoMap);

    if (successfulResults.length === 0) {
      return sources[0];
    }

    const validSpeeds = successfulResults
      .map((r) => {
        const speedStr = r.testResult.loadSpeed;
        if (speedStr === '未知' || speedStr === '测量中...') return 0;
        const match = speedStr.match(/^([\d.]+)\s*(KB\/s|MB\/s)$/);
        if (!match) return 0;
        const value = parseFloat(match[1]);
        const unit = match[2];
        return unit === 'MB/s' ? value * 1024 : value;
      })
      .filter((s) => s > 0);

    const maxSpeed = validSpeeds.length > 0 ? Math.max(...validSpeeds) : 1024;
    const validPings = successfulResults
      .map((r) => r.testResult.pingTime)
      .filter((p) => p > 0);
    const minPing = validPings.length > 0 ? Math.min(...validPings) : 50;
    const maxPing = validPings.length > 0 ? Math.max(...validPings) : 1000;

    const resultsWithScore = successfulResults.map((result) => ({
      ...result,
      score: calculateSourceScore(
        result.testResult,
        maxSpeed,
        minPing,
        maxPing
      ),
    }));

    resultsWithScore.sort((a, b) => b.score - a.score);
    return resultsWithScore[0].source;
  };

  const calculateSourceScore = (
    testResult: { quality: string; loadSpeed: string; pingTime: number },
    maxSpeed: number,
    minPing: number,
    maxPing: number
  ): number => {
    let score = 0;

    const qualityScore = (() => {
      switch (testResult.quality) {
        case '4K':
          return 100;
        case '2K':
          return 85;
        case '1080p':
          return 75;
        case '720p':
          return 60;
        case '480p':
          return 40;
        case 'SD':
          return 20;
        default:
          return 0;
      }
    })();
    score += qualityScore * 0.4;

    const speedScore = (() => {
      const speedStr = testResult.loadSpeed;
      if (speedStr === '未知' || speedStr === '测量中...') return 30;
      const match = speedStr.match(/^([\d.]+)\s*(KB\/s|MB\/s)$/);
      if (!match) return 30;
      const value = parseFloat(match[1]);
      const unit = match[2];
      const speedKBps = unit === 'MB/s' ? value * 1024 : value;
      const speedRatio = speedKBps / maxSpeed;
      return Math.min(100, Math.max(0, speedRatio * 100));
    })();
    score += speedScore * 0.4;

    const pingScore = (() => {
      const ping = testResult.pingTime;
      if (ping <= 0) return 0;
      if (maxPing === minPing) return 100;
      const pingRatio = (maxPing - ping) / (maxPing - minPing);
      return Math.min(100, Math.max(0, pingRatio * 100));
    })();
    score += pingScore * 0.2;

    return Math.round(score * 100) / 100;
  };

  const updateVideoUrl = (
    detailData: SearchResult | null,
    episodeIndex: number
  ) => {
    if (
      !detailData ||
      !detailData.episodes ||
      episodeIndex >= detailData.episodes.length
    ) {
      setVideoUrl('');
      return;
    }
    const newUrl = detailData?.episodes[episodeIndex] || '';
    if (newUrl !== videoUrl) {
      setVideoUrl(newUrl);
    }
  };

  useEffect(() => {
    updateVideoUrl(detail, currentEpisodeIndex);
  }, [detail, currentEpisodeIndex]);

  // ============================================================================
  // 数据初始化
  // ============================================================================

  useEffect(() => {
    const fetchSourceDetail = async (
      source: string,
      id: string
    ): Promise<SearchResult[]> => {
      try {
        const detailResponse = await fetch(
          `/api/detail?source=${source}&id=${id}`
        );
        if (!detailResponse.ok) throw new Error('获取视频详情失败');
        const detailData = (await detailResponse.json()) as SearchResult;
        setAvailableSources([detailData]);
        return [detailData];
      } catch (err) {
        console.error('获取视频详情失败:', err);
        return [];
      } finally {
        setSourceSearchLoading(false);
      }
    };

    const fetchSourcesData = async (query: string): Promise<SearchResult[]> => {
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(query.trim())}`
        );
        if (!response.ok) throw new Error('搜索失败');
        const data = await response.json();

        const results = data.results.filter(
          (result: SearchResult) =>
            result.title.replaceAll(' ', '').toLowerCase() ===
              videoTitleRef.current.replaceAll(' ', '').toLowerCase() &&
            (videoYearRef.current
              ? result.year.toLowerCase() === videoYearRef.current.toLowerCase()
              : true) &&
            (searchType
              ? (searchType === 'tv' && result.episodes.length > 1) ||
                (searchType === 'movie' && result.episodes.length === 1)
              : true)
        );
        setAvailableSources(results);
        return results;
      } catch (err) {
        setSourceSearchError(err instanceof Error ? err.message : '搜索失败');
        setAvailableSources([]);
        return [];
      } finally {
        setSourceSearchLoading(false);
      }
    };

    const initAll = async () => {
      if (!currentSource && !currentId && !videoTitle && !searchTitle) {
        setError('缺少必要参数');
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadingStage(currentSource && currentId ? 'fetching' : 'searching');
      setLoadingMessage(
        currentSource && currentId ? '正在获取视频详情...' : '正在搜索播放源...'
      );

      let sourcesInfo = await fetchSourcesData(searchTitle || videoTitle);
      if (
        currentSource &&
        currentId &&
        !sourcesInfo.some(
          (s) => s.source === currentSource && s.id === currentId
        )
      ) {
        sourcesInfo = await fetchSourceDetail(currentSource, currentId);
      }
      if (sourcesInfo.length === 0) {
        setError('未找到匹配结果');
        setLoading(false);
        return;
      }

      let detailData: SearchResult = sourcesInfo[0];
      if (currentSource && currentId && !needPreferRef.current) {
        const target = sourcesInfo.find(
          (s) => s.source === currentSource && s.id === currentId
        );
        if (target) {
          detailData = target;
        } else {
          setError('未找到匹配结果');
          setLoading(false);
          return;
        }
      }

      if (
        (!currentSource || !currentId || needPreferRef.current) &&
        optimizationEnabled
      ) {
        setLoadingStage('preferring');
        setLoadingMessage('正在优选最佳播放源...');
        detailData = await preferBestSource(sourcesInfo);
      }

      setNeedPrefer(false);
      setCurrentSource(detailData.source);
      setCurrentId(detailData.id);
      setVideoYear(detailData.year);
      setVideoTitle(detailData.title || videoTitleRef.current);
      setVideoCover(detailData.poster);
      setDetail(detailData);
      if (currentEpisodeIndex >= detailData.episodes.length) {
        setCurrentEpisodeIndex(0);
      }

      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('source', detailData.source);
      newUrl.searchParams.set('id', detailData.id);
      newUrl.searchParams.set('year', detailData.year);
      newUrl.searchParams.set('title', detailData.title);
      newUrl.searchParams.delete('prefer');
      window.history.replaceState({}, '', newUrl.toString());

      setLoadingStage('ready');
      setLoadingMessage('准备就绪');
      setTimeout(() => setLoading(false), 500);
    };

    initAll();
  }, []);

  // 播放记录初始化
  useEffect(() => {
    const initFromHistory = async () => {
      if (!currentSource || !currentId) return;
      try {
        const allRecords = await getAllPlayRecords();
        const key = generateStorageKey(currentSource, currentId);
        const record = allRecords[key];
        if (record) {
          const targetIndex = record.index - 1;
          const targetTime = record.play_time;
          if (targetIndex !== currentEpisodeIndex) {
            setCurrentEpisodeIndex(targetIndex);
          }
          resumeTimeRef.current = targetTime;
        }
      } catch (err) {
        console.error('读取播放记录失败:', err);
      }
    };
    initFromHistory();
  }, []);

  // 跳过配置初始化
  useEffect(() => {
    const initSkipConfig = async () => {
      if (!currentSource || !currentId) return;
      try {
        const config = await getSkipConfig(currentSource, currentId);
        if (config) setSkipConfig(config);
      } catch (err) {
        console.error('读取跳过片头片尾配置失败:', err);
      }
    };
    initSkipConfig();
  }, []);

  // ============================================================================
  // 换源处理
  // ============================================================================

  const handleSourceChange = async (
    newSource: string,
    newId: string,
    newTitle: string
  ) => {
    try {
      setVideoLoadingStage('sourceChanging');
      setIsVideoLoading(true);
      setShowSourcePanel(false);

      const currentPlayTime = playerRef.current?.getCurrentTime() || 0;

      if (currentSourceRef.current && currentIdRef.current) {
        try {
          await deletePlayRecord(
            currentSourceRef.current,
            currentIdRef.current
          );
        } catch (err) {
          console.error('清除播放记录失败:', err);
        }
      }

      const newDetail = availableSources.find(
        (s) => s.source === newSource && s.id === newId
      );
      if (!newDetail) {
        setError('未找到匹配结果');
        return;
      }

      let targetIndex = currentEpisodeIndex;
      if (!newDetail.episodes || targetIndex >= newDetail.episodes.length) {
        targetIndex = 0;
      }

      if (targetIndex !== currentEpisodeIndex) {
        resumeTimeRef.current = 0;
      } else if (
        (!resumeTimeRef.current || resumeTimeRef.current === 0) &&
        currentPlayTime > 1
      ) {
        resumeTimeRef.current = currentPlayTime;
      }

      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('source', newSource);
      newUrl.searchParams.set('id', newId);
      newUrl.searchParams.set('year', newDetail.year);
      window.history.replaceState({}, '', newUrl.toString());

      setVideoTitle(newDetail.title || newTitle);
      setVideoYear(newDetail.year);
      setVideoCover(newDetail.poster);
      setCurrentSource(newSource);
      setCurrentId(newId);
      setDetail(newDetail);
      setCurrentEpisodeIndex(targetIndex);
    } catch (err) {
      setIsVideoLoading(false);
      setError(err instanceof Error ? err.message : '换源失败');
    }
  };

  // ============================================================================
  // 集数切换
  // ============================================================================

  const handleEpisodeChange = (episodeNumber: number) => {
    if (episodeNumber >= 0 && episodeNumber < totalEpisodes) {
      saveCurrentPlayProgress();
      setCurrentEpisodeIndex(episodeNumber);
      setShowEpisodePanel(false);
      setIsPlaying(true);
    }
  };

  const handlePreviousEpisode = () => {
    const d = detailRef.current;
    const idx = currentEpisodeIndexRef.current;
    if (d && d.episodes && idx > 0) {
      saveCurrentPlayProgress();
      setCurrentEpisodeIndex(idx - 1);
    }
  };

  const handleNextEpisode = () => {
    const d = detailRef.current;
    const idx = currentEpisodeIndexRef.current;
    if (d && d.episodes && idx < d.episodes.length - 1) {
      saveCurrentPlayProgress();
      setCurrentEpisodeIndex(idx + 1);
    }
  };

  // ============================================================================
  // 键盘快捷键
  // ============================================================================

  const handleKeyboardShortcuts = useCallback((e: KeyboardEvent) => {
    if (
      (e.target as HTMLElement).tagName === 'INPUT' ||
      (e.target as HTMLElement).tagName === 'TEXTAREA'
    )
      return;

    if (e.altKey && e.key === 'ArrowLeft') {
      if (detailRef.current && currentEpisodeIndexRef.current > 0) {
        handlePreviousEpisode();
        e.preventDefault();
      }
    }

    if (e.altKey && e.key === 'ArrowRight') {
      const d = detailRef.current;
      const idx = currentEpisodeIndexRef.current;
      if (d && idx < d.episodes.length - 1) {
        handleNextEpisode();
        e.preventDefault();
      }
    }

    if (!e.altKey && e.key === 'ArrowLeft') {
      if (playerRef.current) {
        const currentTime = playerRef.current.getCurrentTime();
        if (currentTime > 10) {
          playerRef.current.seek(currentTime - 10);
          e.preventDefault();
        }
      }
    }

    if (!e.altKey && e.key === 'ArrowRight') {
      if (playerRef.current) {
        const currentTime = playerRef.current.getCurrentTime();
        const duration = playerRef.current.getDuration();
        if (currentTime < duration - 10) {
          playerRef.current.seek(currentTime + 10);
          e.preventDefault();
        }
      }
    }

    if (e.key === ' ') {
      if (playerRef.current) {
        playerRef.current.toggle();
        e.preventDefault();
      }
    }

    if (e.key === 'f' || e.key === 'F') {
      if (playerRef.current) {
        playerRef.current.toggleFullscreen();
        e.preventDefault();
      }
    }

    if (e.key === 'Escape') {
      setShowSourcePanel(false);
      setShowEpisodePanel(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyboardShortcuts);
    return () =>
      document.removeEventListener('keydown', handleKeyboardShortcuts);
  }, [handleKeyboardShortcuts]);

  // ============================================================================
  // 播放记录保存
  // ============================================================================

  const saveCurrentPlayProgress = useCallback(async () => {
    if (
      !playerRef.current ||
      !currentSourceRef.current ||
      !currentIdRef.current ||
      !videoTitleRef.current ||
      !detailRef.current?.source_name
    ) {
      return;
    }

    const currentTime = playerRef.current.getCurrentTime() || 0;
    const duration = playerRef.current.getDuration() || 0;

    if (currentTime < 1 || !duration) return;

    try {
      await savePlayRecord(currentSourceRef.current, currentIdRef.current, {
        title: videoTitleRef.current,
        source_name: detailRef.current?.source_name || '',
        year: detailRef.current?.year,
        cover: detailRef.current?.poster || '',
        index: currentEpisodeIndexRef.current + 1,
        total_episodes: detailRef.current?.episodes.length || 1,
        play_time: Math.floor(currentTime),
        total_time: Math.floor(duration),
        save_time: Date.now(),
        search_title: searchTitle,
      });
      lastSaveTimeRef.current = Date.now();
    } catch (err) {
      console.error('保存播放进度失败:', err);
    }
  }, [searchTitle]);

  useEffect(() => {
    const handleBeforeUnload = () => saveCurrentPlayProgress();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') saveCurrentPlayProgress();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [saveCurrentPlayProgress]);

  useEffect(() => {
    return () => {
      if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);
    };
  }, []);

  // ============================================================================
  // 收藏功能
  // ============================================================================

  useEffect(() => {
    if (!currentSource || !currentId) return;
    (async () => {
      try {
        const fav = await isFavorited(currentSource, currentId);
        setFavorited(fav);
      } catch (err) {
        console.error('检查收藏状态失败:', err);
      }
    })();
  }, [currentSource, currentId]);

  useEffect(() => {
    if (!currentSource || !currentId) return;
    const unsubscribe = subscribeToDataUpdates(
      'favoritesUpdated',
      (favorites: Record<string, any>) => {
        const key = generateStorageKey(currentSource, currentId);
        setFavorited(!!favorites[key]);
      }
    );
    return unsubscribe;
  }, [currentSource, currentId]);

  const handleToggleFavorite = async () => {
    if (
      !videoTitleRef.current ||
      !detailRef.current ||
      !currentSourceRef.current ||
      !currentIdRef.current
    )
      return;

    try {
      if (favorited) {
        await deleteFavorite(currentSourceRef.current, currentIdRef.current);
        setFavorited(false);
      } else {
        await saveFavorite(currentSourceRef.current, currentIdRef.current, {
          title: videoTitleRef.current,
          source_name: detailRef.current?.source_name || '',
          year: detailRef.current?.year,
          cover: detailRef.current?.poster || '',
          total_episodes: detailRef.current?.episodes.length || 1,
          save_time: Date.now(),
          search_title: searchTitle,
        });
        setFavorited(true);
      }
    } catch (err) {
      console.error('切换收藏失败:', err);
    }
  };

  // ============================================================================
  // 相关推荐（获取同类型豆瓣内容）
  // ============================================================================

  useEffect(() => {
    const fetchRelatedMovies = async () => {
      if (!detail?.class) return;

      setRelatedLoading(true);
      try {
        // 根据当前影片类型判断是电影还是电视剧
        const typeClass = detail.class?.toLowerCase() || '';
        const isTv =
          typeClass.includes('剧') ||
          typeClass.includes('综艺') ||
          typeClass.includes('纪录') ||
          typeClass.includes('动漫');

        // 映射类型到豆瓣分类
        let category = '热门';
        if (typeClass.includes('动作')) category = '动作';
        else if (typeClass.includes('喜剧')) category = '喜剧';
        else if (typeClass.includes('爱情')) category = '爱情';
        else if (typeClass.includes('科幻')) category = '科幻';
        else if (typeClass.includes('悬疑') || typeClass.includes('犯罪'))
          category = '悬疑';
        else if (typeClass.includes('恐怖')) category = '恐怖';
        else if (typeClass.includes('动画') || typeClass.includes('动漫'))
          category = '动画';
        else if (typeClass.includes('战争')) category = '战争';
        else if (typeClass.includes('历史')) category = '历史';

        const result = await getDoubanCategories({
          kind: isTv ? 'tv' : 'movie',
          category: isTv ? 'tv' : category,
          type: isTv ? 'tv' : '全部',
          pageLimit: 12,
        });

        if (result.code === 200 && result.list) {
          // 过滤掉当前正在播放的影片
          const filtered = result.list.filter(
            (item) => item.title !== videoTitle
          );
          setRelatedMovies(filtered.slice(0, 10));
        }
      } catch (err) {
        console.error('获取相关推荐失败:', err);
      } finally {
        setRelatedLoading(false);
      }
    };

    fetchRelatedMovies();
  }, [detail?.class, videoTitle]);

  // ============================================================================
  // 播放器事件
  // ============================================================================

  const handlePlayerTimeUpdate = useCallback(
    (_currentTime: number, _duration: number) => {
      const now = Date.now();
      let interval = 5000;
      if (process.env.NEXT_PUBLIC_STORAGE_TYPE === 'd1') interval = 10000;
      if (process.env.NEXT_PUBLIC_STORAGE_TYPE === 'upstash') interval = 20000;
      if (now - lastSaveTimeRef.current > interval) {
        saveCurrentPlayProgress();
        lastSaveTimeRef.current = now;
      }
    },
    [saveCurrentPlayProgress]
  );

  const handlePlayerEnded = useCallback(() => {
    const d = detailRef.current;
    const idx = currentEpisodeIndexRef.current;
    if (d && d.episodes && idx < d.episodes.length - 1) {
      setTimeout(() => setCurrentEpisodeIndex(idx + 1), 1000);
    }
  }, []);

  const handlePlayerCanPlay = useCallback(() => {
    setError(null);
    setIsVideoLoading(false);
  }, []);

  const handlePlayerError = useCallback((err: any) => {
    console.error('播放器错误:', err);
  }, []);

  const handlePlayerPause = useCallback(() => {
    saveCurrentPlayProgress();
  }, [saveCurrentPlayProgress]);

  // 开始播放
  const handleStartPlay = () => {
    setIsPlaying(true);
  };

  // ============================================================================
  // 渲染
  // ============================================================================

  // 加载中
  if (loading) {
    return (
      <div className='min-h-screen bg-zinc-950 flex items-center justify-center'>
        <div className='text-center'>
          <div className='relative w-24 h-24 mx-auto mb-8'>
            <div className='absolute inset-0 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 animate-pulse' />
            <div className='absolute inset-2 rounded-full bg-zinc-950 flex items-center justify-center'>
              <div className='text-3xl'>
                {loadingStage === 'searching' && '🔍'}
                {loadingStage === 'preferring' && '⚡'}
                {loadingStage === 'fetching' && '🎬'}
                {loadingStage === 'ready' && '✨'}
              </div>
            </div>
            <div
              className='absolute -inset-2 border-2 border-orange-500/30 rounded-full animate-spin'
              style={{ animationDuration: '2s' }}
            />
          </div>

          <div className='flex justify-center gap-2 mb-4'>
            {['searching', 'preferring', 'ready'].map((stage, i) => (
              <div
                key={stage}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  loadingStage === stage
                    ? 'bg-orange-500 scale-150'
                    : i <
                      ['searching', 'preferring', 'ready'].indexOf(loadingStage)
                    ? 'bg-orange-500'
                    : 'bg-zinc-700'
                }`}
              />
            ))}
          </div>

          <p className='text-zinc-400 text-lg'>{loadingMessage}</p>
        </div>
      </div>
    );
  }

  // 错误
  if (error) {
    return (
      <div className='min-h-screen bg-zinc-950 flex items-center justify-center'>
        <div className='text-center max-w-md px-6'>
          <div className='w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center'>
            <span className='text-4xl'>😵</span>
          </div>
          <h2 className='text-xl font-bold text-white mb-3'>播放出错了</h2>
          <p className='text-zinc-400 mb-6'>{error}</p>
          <div className='flex gap-3 justify-center'>
            <button
              onClick={() => router.back()}
              className='px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors'
            >
              返回
            </button>
            <button
              onClick={() => window.location.reload()}
              className='px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors'
            >
              重试
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 正在播放 - 全屏播放器
  if (isPlaying) {
    return (
      <div className='fixed inset-0 bg-black z-50'>
        {/* 播放器 */}
        <div className='absolute inset-0'>
          {videoUrl && (
            <VidstackPlayer
              ref={playerRef}
              src={videoUrl}
              poster={processImageUrl(videoCover)}
              title={`${videoTitle}${
                totalEpisodes > 1 ? ` - 第${currentEpisodeIndex + 1}集` : ''
              }`}
              autoplay={true}
              blockAdEnabled={blockAdEnabled}
              skipConfig={skipConfig}
              resumeTime={resumeTimeRef.current || undefined}
              onTimeUpdate={handlePlayerTimeUpdate}
              onEnded={handlePlayerEnded}
              onCanPlay={handlePlayerCanPlay}
              onError={handlePlayerError}
              onPause={handlePlayerPause}
              onNextEpisode={
                currentEpisodeIndex < totalEpisodes - 1
                  ? handleNextEpisode
                  : undefined
              }
            />
          )}

          {isVideoLoading && (
            <div className='absolute inset-0 bg-black/80 flex items-center justify-center z-40'>
              <div className='text-center'>
                <div className='w-12 h-12 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mx-auto mb-4' />
                <p className='text-zinc-400'>
                  {videoLoadingStage === 'sourceChanging'
                    ? '正在切换播放源...'
                    : '加载中...'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 顶部控制栏 */}
        <div className='absolute top-0 left-0 right-0 z-30 bg-gradient-to-b from-black/80 via-black/40 to-transparent'>
          <div className='flex items-center justify-between px-4 py-3'>
            <div className='flex items-center gap-3'>
              <button
                onClick={() => setIsPlaying(false)}
                className='w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors'
              >
                <ChevronLeft className='w-5 h-5 text-white' />
              </button>
              <div>
                <h1 className='text-white font-medium text-lg line-clamp-1'>
                  {videoTitle}
                  {totalEpisodes > 1 && (
                    <span className='text-zinc-400 font-normal ml-2'>
                      第{currentEpisodeIndex + 1}/{totalEpisodes}集
                    </span>
                  )}
                </h1>
                <div className='flex items-center gap-2 text-sm text-zinc-400'>
                  {detail?.source_name && <span>{detail.source_name}</span>}
                  {detail?.year && <span>· {detail.year}</span>}
                </div>
              </div>
            </div>

            <div className='flex items-center gap-2'>
              <button
                onClick={handleToggleFavorite}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  favorited
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                <Heart
                  className={`w-5 h-5 ${favorited ? 'fill-current' : ''}`}
                />
              </button>

              {totalEpisodes > 1 && (
                <button
                  onClick={() => {
                    setShowEpisodePanel(true);
                    setShowSourcePanel(false);
                  }}
                  className='h-10 px-4 rounded-full bg-white/10 hover:bg-white/20 flex items-center gap-2 transition-colors'
                >
                  <List className='w-4 h-4 text-white' />
                  <span className='text-white text-sm'>选集</span>
                </button>
              )}

              <button
                onClick={() => {
                  setShowSourcePanel(true);
                  setShowEpisodePanel(false);
                }}
                className='h-10 px-4 rounded-full bg-white/10 hover:bg-white/20 flex items-center gap-2 transition-colors'
              >
                <Layers className='w-4 h-4 text-white' />
                <span className='text-white text-sm'>切换源</span>
                {availableSources.length > 1 && (
                  <span className='bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full'>
                    {availableSources.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 底部集数快捷切换 */}
        {totalEpisodes > 1 && (
          <div className='absolute bottom-20 left-0 right-0 z-30 flex items-center justify-center gap-4 pointer-events-none'>
            <button
              onClick={handlePreviousEpisode}
              disabled={currentEpisodeIndex === 0}
              className={`pointer-events-auto w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                currentEpisodeIndex === 0
                  ? 'bg-white/5 text-zinc-600 cursor-not-allowed'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              <ChevronLeft className='w-6 h-6' />
            </button>

            <div className='bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full pointer-events-auto'>
              <span className='text-white font-medium'>
                第 {currentEpisodeIndex + 1} 集
              </span>
              <span className='text-zinc-500 ml-1'>/ {totalEpisodes}</span>
            </div>

            <button
              onClick={handleNextEpisode}
              disabled={currentEpisodeIndex >= totalEpisodes - 1}
              className={`pointer-events-auto w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                currentEpisodeIndex >= totalEpisodes - 1
                  ? 'bg-white/5 text-zinc-600 cursor-not-allowed'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              <ChevronRight className='w-6 h-6' />
            </button>
          </div>
        )}

        {/* 右侧滑出面板 - 播放源 */}
        <SlidingPanel
          show={showSourcePanel}
          title='播放源'
          onClose={() => setShowSourcePanel(false)}
        >
          {sourceSearchLoading ? (
            <div className='flex items-center justify-center py-12'>
              <div className='w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin' />
            </div>
          ) : availableSources.length === 0 ? (
            <div className='text-center py-12 text-zinc-500'>
              暂无可用播放源
            </div>
          ) : (
            <div className='space-y-2'>
              {availableSources.map((source) => {
                const isCurrent =
                  source.source === currentSource && source.id === currentId;
                const sourceKey = `${source.source}-${source.id}`;
                const info = precomputedVideoInfo?.get(sourceKey);

                return (
                  <button
                    key={sourceKey}
                    onClick={() =>
                      !isCurrent &&
                      handleSourceChange(source.source, source.id, source.title)
                    }
                    className={`w-full p-4 rounded-xl text-left transition-all ${
                      isCurrent
                        ? 'bg-orange-500/20 ring-1 ring-orange-500'
                        : 'bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className='flex items-center justify-between'>
                      <span
                        className={`font-medium ${
                          isCurrent ? 'text-orange-400' : 'text-white'
                        }`}
                      >
                        {source.source_name}
                      </span>
                      {isCurrent && (
                        <span className='text-xs bg-orange-500 text-white px-2 py-0.5 rounded'>
                          当前
                        </span>
                      )}
                    </div>
                    <div className='flex items-center gap-3 mt-2 text-sm text-zinc-400'>
                      <span>{source.episodes.length}集</span>
                      {info && !info.hasError && (
                        <>
                          <span className='text-zinc-600'>•</span>
                          <span
                            className={
                              ['4K', '2K'].includes(info.quality)
                                ? 'text-purple-400'
                                : ['1080p', '720p'].includes(info.quality)
                                ? 'text-green-400'
                                : 'text-yellow-400'
                            }
                          >
                            {info.quality}
                          </span>
                          <span className='text-zinc-600'>•</span>
                          <span>{info.loadSpeed}</span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </SlidingPanel>

        {/* 右侧滑出面板 - 选集 */}
        <SlidingPanel
          show={showEpisodePanel}
          title='选集'
          onClose={() => setShowEpisodePanel(false)}
        >
          <div className='grid grid-cols-5 gap-2'>
            {Array.from({ length: totalEpisodes }, (_, i) => (
              <button
                key={i}
                onClick={() => handleEpisodeChange(i)}
                className={`aspect-square rounded-lg font-medium transition-all flex items-center justify-center ${
                  i === currentEpisodeIndex
                    ? 'bg-orange-500 text-white'
                    : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </SlidingPanel>

        {/* 遮罩层 */}
        {(showSourcePanel || showEpisodePanel) && (
          <div
            className='fixed inset-0 bg-black/60 z-40'
            onClick={() => {
              setShowSourcePanel(false);
              setShowEpisodePanel(false);
            }}
          />
        )}
      </div>
    );
  }

  // 详情页面 - CineStream 风格
  return (
    <div className='min-h-screen bg-zinc-950'>
      <TopNav transparent={true} />

      {/* 视频播放器区域 */}
      <div className='relative w-full aspect-video bg-black'>
        {/* 背景海报 */}
        <div
          className='absolute inset-0 bg-cover bg-center opacity-60'
          style={{ backgroundImage: `url(${processImageUrl(videoCover)})` }}
        >
          <div className='absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent' />
        </div>

        {/* 中央播放按钮 */}
        <button
          onClick={handleStartPlay}
          className='absolute inset-0 flex items-center justify-center group'
        >
          <div className='h-20 w-20 rounded-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center transition-transform hover:scale-110 shadow-2xl'>
            <Play className='h-8 w-8 fill-current ml-1' />
          </div>
        </button>
      </div>

      {/* 影片信息区域 */}
      <section className='max-w-7xl mx-auto px-4 py-8 md:py-12'>
        <div className='flex flex-col md:flex-row gap-6 md:gap-8'>
          {/* 海报 */}
          <div className='flex-shrink-0 mx-auto md:mx-0'>
            <div className='w-48 md:w-64 aspect-[2/3] rounded-xl overflow-hidden bg-zinc-800 shadow-2xl'>
              <img
                src={processImageUrl(videoCover)}
                alt={videoTitle}
                className='w-full h-full object-cover'
              />
            </div>
          </div>

          {/* 详情 */}
          <div className='flex-1 space-y-4'>
            {/* 标签 */}
            <div className='flex flex-wrap items-center gap-2'>
              {detail?.class && (
                <span className='px-3 py-1 text-xs font-medium bg-orange-500/20 text-orange-400 rounded-full'>
                  {detail.class}
                </span>
              )}
              <span className='px-3 py-1 text-xs font-medium bg-zinc-700 text-zinc-300 rounded-full'>
                HD
              </span>
              <span className='px-3 py-1 text-xs font-medium bg-zinc-700 text-zinc-300 rounded-full'>
                5.1声道
              </span>
              {detail?.source_name && (
                <span className='px-3 py-1 text-xs font-medium bg-zinc-700 text-zinc-300 rounded-full'>
                  {detail.source_name}
                </span>
              )}
            </div>

            {/* 标题 */}
            <h1 className='text-2xl md:text-4xl font-bold text-white'>
              {videoTitle}
            </h1>

            {/* 评分和元信息 */}
            <div className='flex flex-wrap items-center gap-4 text-zinc-400'>
              {videoYear && (
                <div className='flex items-center gap-1'>
                  <span>{videoYear}</span>
                </div>
              )}
              {totalEpisodes > 1 && (
                <>
                  <span className='text-zinc-600'>•</span>
                  <span>共 {totalEpisodes} 集</span>
                </>
              )}
            </div>

            {/* 操作按钮 */}
            <div className='flex flex-wrap items-center gap-3 pt-2'>
              <button
                onClick={handleStartPlay}
                className='flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-all hover:scale-105'
              >
                <Play className='h-5 w-5 fill-current' />
                <span>立即播放</span>
              </button>

              <button
                onClick={handleToggleFavorite}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                  favorited
                    ? 'bg-orange-500 text-white'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                <Heart
                  className={`w-4 h-4 ${favorited ? 'fill-current' : ''}`}
                />
                <span>{favorited ? '已收藏' : '添加片单'}</span>
              </button>

              <button
                onClick={() => setShowSourcePanel(true)}
                className='flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg font-medium transition-colors'
              >
                <Layers className='w-4 h-4' />
                <span>切换源</span>
                {availableSources.length > 1 && (
                  <span className='bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full'>
                    {availableSources.length}
                  </span>
                )}
              </button>

              <button className='flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg font-medium transition-colors'>
                <Share2 className='w-4 h-4' />
                <span>分享</span>
              </button>
            </div>

            {/* 剧情简介 */}
            {detail?.desc && (
              <div className='pt-4 border-t border-zinc-800'>
                <h3 className='text-lg font-semibold text-white mb-2'>
                  剧情简介
                </h3>
                <p className='text-zinc-400 leading-relaxed line-clamp-4'>
                  {detail.desc}
                </p>
              </div>
            )}

            {/* 详情网格 */}
            <div className='pt-4 border-t border-zinc-800 grid grid-cols-1 md:grid-cols-2 gap-4'>
              {detail?.source_name && (
                <div>
                  <span className='text-zinc-500 text-sm'>来源: </span>
                  <span className='text-zinc-300 text-sm'>
                    {detail.source_name}
                  </span>
                </div>
              )}
              {videoYear && (
                <div>
                  <span className='text-zinc-500 text-sm'>上映年份: </span>
                  <span className='text-zinc-300 text-sm'>{videoYear}</span>
                </div>
              )}
              {detail?.class && (
                <div>
                  <span className='text-zinc-500 text-sm'>类型: </span>
                  <span className='text-zinc-300 text-sm'>{detail.class}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 选集区域 */}
        {totalEpisodes > 1 && (
          <div className='mt-8 pt-8 border-t border-zinc-800'>
            <h3 className='text-lg font-semibold text-white mb-4'>
              选集{' '}
              <span className='text-zinc-500 font-normal'>
                ({totalEpisodes}集)
              </span>
            </h3>
            <div className='grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2'>
              {Array.from({ length: totalEpisodes }, (_, i) => (
                <button
                  key={i}
                  onClick={() => handleEpisodeChange(i)}
                  className={`px-3 py-2 text-sm rounded-lg font-medium transition-all ${
                    i === currentEpisodeIndex
                      ? 'bg-orange-500 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 相关推荐 */}
      {(relatedMovies.length > 0 || relatedLoading) && (
        <section className='max-w-7xl mx-auto px-4 py-8 md:py-12 border-t border-zinc-800'>
          <div className='mb-6'>
            <h2 className='text-xl md:text-2xl font-bold text-white'>
              相关推荐
            </h2>
            <p className='text-zinc-400 text-sm mt-1'>
              更多{detail?.class || '精彩'}内容
            </p>
          </div>
          {relatedLoading ? (
            <div className='flex items-center justify-center py-8'>
              <div className='w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin' />
            </div>
          ) : (
            <div className='flex gap-4 overflow-x-auto pb-4 scrollbar-hide'>
              {relatedMovies.map((movie) => (
                <MovieCard
                  key={movie.id}
                  movie={{
                    id: movie.id,
                    vod_id: movie.id,
                    vod_name: movie.title,
                    vod_pic: movie.poster,
                    vod_year: movie.year,
                    vod_remarks: movie.rate ? `${movie.rate}分` : undefined,
                    type_name: detail?.class || '',
                    api: 'douban',
                    site_key: 'douban',
                  }}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Footer */}
      <Footer />

      {/* 右侧滑出面板 */}
      <SlidingPanel
        show={showSourcePanel}
        title='播放源'
        onClose={() => setShowSourcePanel(false)}
      >
        {sourceSearchLoading ? (
          <div className='flex items-center justify-center py-12'>
            <div className='w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin' />
          </div>
        ) : availableSources.length === 0 ? (
          <div className='text-center py-12 text-zinc-500'>暂无可用播放源</div>
        ) : (
          <div className='space-y-2'>
            {availableSources.map((source) => {
              const isCurrent =
                source.source === currentSource && source.id === currentId;
              const sourceKey = `${source.source}-${source.id}`;
              const info = precomputedVideoInfo?.get(sourceKey);

              return (
                <button
                  key={sourceKey}
                  onClick={() =>
                    !isCurrent &&
                    handleSourceChange(source.source, source.id, source.title)
                  }
                  className={`w-full p-4 rounded-xl text-left transition-all ${
                    isCurrent
                      ? 'bg-orange-500/20 ring-1 ring-orange-500'
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className='flex items-center justify-between'>
                    <span
                      className={`font-medium ${
                        isCurrent ? 'text-orange-400' : 'text-white'
                      }`}
                    >
                      {source.source_name}
                    </span>
                    {isCurrent && (
                      <span className='text-xs bg-orange-500 text-white px-2 py-0.5 rounded'>
                        当前
                      </span>
                    )}
                  </div>
                  <div className='flex items-center gap-3 mt-2 text-sm text-zinc-400'>
                    <span>{source.episodes.length}集</span>
                    {info && !info.hasError && (
                      <>
                        <span className='text-zinc-600'>•</span>
                        <span
                          className={
                            ['4K', '2K'].includes(info.quality)
                              ? 'text-purple-400'
                              : ['1080p', '720p'].includes(info.quality)
                              ? 'text-green-400'
                              : 'text-yellow-400'
                          }
                        >
                          {info.quality}
                        </span>
                        <span className='text-zinc-600'>•</span>
                        <span>{info.loadSpeed}</span>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </SlidingPanel>

      {/* 遮罩层 */}
      {showSourcePanel && (
        <div
          className='fixed inset-0 bg-black/60 z-40'
          onClick={() => setShowSourcePanel(false)}
        />
      )}
    </div>
  );
}

// 滑出面板组件
function SlidingPanel({
  show,
  title,
  onClose,
  children,
}: {
  show: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`fixed top-0 right-0 bottom-0 w-80 md:w-96 bg-zinc-900 z-50 transform transition-transform duration-300 ease-out ${
        show ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className='flex items-center justify-between px-5 py-4 border-b border-zinc-800'>
        <h2 className='text-lg font-bold text-white'>{title}</h2>
        <button
          onClick={onClose}
          className='w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors'
        >
          <X className='w-4 h-4 text-white' />
        </button>
      </div>
      <div
        className='p-4 overflow-y-auto'
        style={{ height: 'calc(100% - 65px)' }}
      >
        {children}
      </div>
    </div>
  );
}

export default function PlayPage() {
  return (
    <Suspense
      fallback={
        <div className='min-h-screen bg-[#0a0a0a] flex items-center justify-center'>
          <div className='w-10 h-10 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin' />
        </div>
      }
    >
      <PlayPageClient />
    </Suspense>
  );
}
