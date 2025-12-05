/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, no-console, @next/next/no-img-element */

'use client';

import { Heart } from 'lucide-react';
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
import { SearchResult } from '@/lib/types';
import { getVideoResolutionFromM3u8, processImageUrl } from '@/lib/utils';

import PageLayout from '@/components/PageLayout';
import VidstackPlayer, { VidstackPlayerRef } from '@/components/VidstackPlayer';

function PlayPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // -----------------------------------------------------------------------------
  // 状态变量（State）
  // -----------------------------------------------------------------------------
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
  }, [
    skipConfig,
    skipConfig.enable,
    skipConfig.intro_time,
    skipConfig.outro_time,
  ]);

  // 去广告开关（从 localStorage 继承，默认 true）
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
  // 当前源和ID
  const [currentSource, setCurrentSource] = useState(
    searchParams.get('source') || ''
  );
  const [currentId, setCurrentId] = useState(searchParams.get('id') || '');

  // 搜索所需信息
  const [searchTitle] = useState(searchParams.get('stitle') || '');
  const [searchType] = useState(searchParams.get('stype') || '');

  // 是否需要优选
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

  // 同步最新值到 refs
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

  // 总集数
  const totalEpisodes = detail?.episodes?.length || 0;

  // 用于记录是否需要在播放器 ready 后跳转到指定进度
  const resumeTimeRef = useRef<number | null>(null);

  // 换源相关状态
  const [availableSources, setAvailableSources] = useState<SearchResult[]>([]);
  const [sourceSearchLoading, setSourceSearchLoading] = useState(false);
  const [_sourceSearchError, setSourceSearchError] = useState<string | null>(
    null
  );

  // 优选和测速开关
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

  // 保存优选时的测速结果，避免EpisodeSelector重复测速
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

  // 换源加载状态
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [videoLoadingStage, setVideoLoadingStage] = useState<
    'initing' | 'sourceChanging'
  >('initing');

  // 播放进度保存相关
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveTimeRef = useRef<number>(0);

  const playerRef = useRef<VidstackPlayerRef>(null);

  // -----------------------------------------------------------------------------
  // 工具函数（Utils）
  // -----------------------------------------------------------------------------

  // 播放源优选函数
  const preferBestSource = async (
    sources: SearchResult[]
  ): Promise<SearchResult> => {
    if (sources.length === 1) return sources[0];

    // 将播放源均分为两批，并发测速各批，避免一次性过多请求
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
            // 检查是否有第一集的播放地址
            if (!source.episodes || source.episodes.length === 0) {
              console.warn(`播放源 ${source.source_name} 没有可用的播放地址`);
              return null;
            }

            const episodeUrl =
              source.episodes.length > 1
                ? source.episodes[1]
                : source.episodes[0];
            const testResult = await getVideoResolutionFromM3u8(episodeUrl);

            return {
              source,
              testResult,
            };
          } catch (error) {
            return null;
          }
        })
      );
      allResults.push(...batchResults);
    }

    // 等待所有测速完成，包含成功和失败的结果
    // 保存所有测速结果到 precomputedVideoInfo，供 EpisodeSelector 使用（包含错误结果）
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
        // 成功的结果
        newVideoInfoMap.set(sourceKey, result.testResult);
      }
    });

    // 过滤出成功的结果用于优选计算
    const successfulResults = allResults.filter(Boolean) as Array<{
      source: SearchResult;
      testResult: { quality: string; loadSpeed: string; pingTime: number };
    }>;

    setPrecomputedVideoInfo(newVideoInfoMap);

    if (successfulResults.length === 0) {
      console.warn('所有播放源测速都失败，使用第一个播放源');
      return sources[0];
    }

    // 找出所有有效速度的最大值，用于线性映射
    const validSpeeds = successfulResults
      .map((result) => {
        const speedStr = result.testResult.loadSpeed;
        if (speedStr === '未知' || speedStr === '测量中...') return 0;

        const match = speedStr.match(/^([\d.]+)\s*(KB\/s|MB\/s)$/);
        if (!match) return 0;

        const value = parseFloat(match[1]);
        const unit = match[2];
        return unit === 'MB/s' ? value * 1024 : value; // 统一转换为 KB/s
      })
      .filter((speed) => speed > 0);

    const maxSpeed = validSpeeds.length > 0 ? Math.max(...validSpeeds) : 1024; // 默认1MB/s作为基准

    // 找出所有有效延迟的最小值和最大值，用于线性映射
    const validPings = successfulResults
      .map((result) => result.testResult.pingTime)
      .filter((ping) => ping > 0);

    const minPing = validPings.length > 0 ? Math.min(...validPings) : 50;
    const maxPing = validPings.length > 0 ? Math.max(...validPings) : 1000;

    // 计算每个结果的评分
    const resultsWithScore = successfulResults.map((result) => ({
      ...result,
      score: calculateSourceScore(
        result.testResult,
        maxSpeed,
        minPing,
        maxPing
      ),
    }));

    // 按综合评分排序，选择最佳播放源
    resultsWithScore.sort((a, b) => b.score - a.score);

    console.log('播放源评分排序结果:');
    resultsWithScore.forEach((result, index) => {
      console.log(
        `${index + 1}. ${
          result.source.source_name
        } - 评分: ${result.score.toFixed(2)} (${result.testResult.quality}, ${
          result.testResult.loadSpeed
        }, ${result.testResult.pingTime}ms)`
      );
    });

    return resultsWithScore[0].source;
  };

  // 计算播放源综合评分
  const calculateSourceScore = (
    testResult: {
      quality: string;
      loadSpeed: string;
      pingTime: number;
    },
    maxSpeed: number,
    minPing: number,
    maxPing: number
  ): number => {
    let score = 0;

    // 分辨率评分 (40% 权重)
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

    // 下载速度评分 (40% 权重) - 基于最大速度线性映射
    const speedScore = (() => {
      const speedStr = testResult.loadSpeed;
      if (speedStr === '未知' || speedStr === '测量中...') return 30;

      // 解析速度值
      const match = speedStr.match(/^([\d.]+)\s*(KB\/s|MB\/s)$/);
      if (!match) return 30;

      const value = parseFloat(match[1]);
      const unit = match[2];
      const speedKBps = unit === 'MB/s' ? value * 1024 : value;

      // 基于最大速度线性映射，最高100分
      const speedRatio = speedKBps / maxSpeed;
      return Math.min(100, Math.max(0, speedRatio * 100));
    })();
    score += speedScore * 0.4;

    // 网络延迟评分 (20% 权重) - 基于延迟范围线性映射
    const pingScore = (() => {
      const ping = testResult.pingTime;
      if (ping <= 0) return 0; // 无效延迟给默认分

      // 如果所有延迟都相同，给满分
      if (maxPing === minPing) return 100;

      // 线性映射：最低延迟=100分，最高延迟=0分
      const pingRatio = (maxPing - ping) / (maxPing - minPing);
      return Math.min(100, Math.max(0, pingRatio * 100));
    })();
    score += pingScore * 0.2;

    return Math.round(score * 100) / 100; // 保留两位小数
  };

  // 更新视频地址
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

  // 当集数索引变化时自动更新视频地址
  useEffect(() => {
    updateVideoUrl(detail, currentEpisodeIndex);
  }, [detail, currentEpisodeIndex]);

  // 进入页面时直接获取全部源信息
  useEffect(() => {
    const fetchSourceDetail = async (
      source: string,
      id: string
    ): Promise<SearchResult[]> => {
      try {
        const detailResponse = await fetch(
          `/api/detail?source=${source}&id=${id}`
        );
        if (!detailResponse.ok) {
          throw new Error('获取视频详情失败');
        }
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
      // 根据搜索词获取全部源信息
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(query.trim())}`
        );
        if (!response.ok) {
          throw new Error('搜索失败');
        }
        const data = await response.json();

        // 处理搜索结果，根据规则过滤
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
        currentSource && currentId
          ? '🎬 正在获取视频详情...'
          : '🔍 正在搜索播放源...'
      );

      let sourcesInfo = await fetchSourcesData(searchTitle || videoTitle);
      if (
        currentSource &&
        currentId &&
        !sourcesInfo.some(
          (source) => source.source === currentSource && source.id === currentId
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
      // 指定源和id且无需优选
      if (currentSource && currentId && !needPreferRef.current) {
        const target = sourcesInfo.find(
          (source) => source.source === currentSource && source.id === currentId
        );
        if (target) {
          detailData = target;
        } else {
          setError('未找到匹配结果');
          setLoading(false);
          return;
        }
      }

      // 未指定源和 id 或需要优选，且开启优选开关
      if (
        (!currentSource || !currentId || needPreferRef.current) &&
        optimizationEnabled
      ) {
        setLoadingStage('preferring');
        setLoadingMessage('⚡ 正在优选最佳播放源...');

        detailData = await preferBestSource(sourcesInfo);
      }

      console.log(detailData.source, detailData.id);

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

      // 规范URL参数
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('source', detailData.source);
      newUrl.searchParams.set('id', detailData.id);
      newUrl.searchParams.set('year', detailData.year);
      newUrl.searchParams.set('title', detailData.title);
      newUrl.searchParams.delete('prefer');
      window.history.replaceState({}, '', newUrl.toString());

      setLoadingStage('ready');
      setLoadingMessage('✨ 准备就绪，即将开始播放...');

      // 短暂延迟让用户看到完成状态
      setTimeout(() => {
        setLoading(false);
      }, 1000);
    };

    initAll();
  }, []);

  // 播放记录处理
  useEffect(() => {
    // 仅在初次挂载时检查播放记录
    const initFromHistory = async () => {
      if (!currentSource || !currentId) return;

      try {
        const allRecords = await getAllPlayRecords();
        const key = generateStorageKey(currentSource, currentId);
        const record = allRecords[key];

        if (record) {
          const targetIndex = record.index - 1;
          const targetTime = record.play_time;

          // 更新当前选集索引
          if (targetIndex !== currentEpisodeIndex) {
            setCurrentEpisodeIndex(targetIndex);
          }

          // 保存待恢复的播放进度，待播放器就绪后跳转
          resumeTimeRef.current = targetTime;
        }
      } catch (err) {
        console.error('读取播放记录失败:', err);
      }
    };

    initFromHistory();
  }, []);

  // 跳过片头片尾配置处理
  useEffect(() => {
    // 仅在初次挂载时检查跳过片头片尾配置
    const initSkipConfig = async () => {
      if (!currentSource || !currentId) return;

      try {
        const config = await getSkipConfig(currentSource, currentId);
        if (config) {
          setSkipConfig(config);
        }
      } catch (err) {
        console.error('读取跳过片头片尾配置失败:', err);
      }
    };

    initSkipConfig();
  }, []);

  // 处理换源
  const handleSourceChange = async (
    newSource: string,
    newId: string,
    newTitle: string
  ) => {
    try {
      // 显示换源加载状态
      setVideoLoadingStage('sourceChanging');
      setIsVideoLoading(true);

      // 记录当前播放进度（仅在同一集数切换时恢复）
      const currentPlayTime = playerRef.current?.getCurrentTime() || 0;
      console.log('换源前当前播放时间:', currentPlayTime);

      // 清除前一个历史记录
      if (currentSourceRef.current && currentIdRef.current) {
        try {
          await deletePlayRecord(
            currentSourceRef.current,
            currentIdRef.current
          );
          console.log('已清除前一个播放记录');
        } catch (err) {
          console.error('清除播放记录失败:', err);
        }
      }

      const newDetail = availableSources.find(
        (source) => source.source === newSource && source.id === newId
      );
      if (!newDetail) {
        setError('未找到匹配结果');
        return;
      }

      // 尝试跳转到当前正在播放的集数
      let targetIndex = currentEpisodeIndex;

      // 如果当前集数超出新源的范围，则跳转到第一集
      if (!newDetail.episodes || targetIndex >= newDetail.episodes.length) {
        targetIndex = 0;
      }

      // 如果仍然是同一集数且播放进度有效，则在播放器就绪后恢复到原始进度
      if (targetIndex !== currentEpisodeIndex) {
        resumeTimeRef.current = 0;
      } else if (
        (!resumeTimeRef.current || resumeTimeRef.current === 0) &&
        currentPlayTime > 1
      ) {
        resumeTimeRef.current = currentPlayTime;
      }

      // 更新URL参数（不刷新页面）
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
      // 隐藏换源加载状态
      setIsVideoLoading(false);
      setError(err instanceof Error ? err.message : '换源失败');
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyboardShortcuts);
    return () => {
      document.removeEventListener('keydown', handleKeyboardShortcuts);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // 集数切换
  // ---------------------------------------------------------------------------
  // 处理集数切换
  const handleEpisodeChange = (episodeNumber: number) => {
    if (episodeNumber >= 0 && episodeNumber < totalEpisodes) {
      // 在更换集数前保存当前播放进度
      saveCurrentPlayProgress();
      setCurrentEpisodeIndex(episodeNumber);
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

  // ---------------------------------------------------------------------------
  // 键盘快捷键
  // ---------------------------------------------------------------------------
  // 处理全局快捷键
  const handleKeyboardShortcuts = useCallback((e: KeyboardEvent) => {
    // 忽略输入框中的按键事件
    if (
      (e.target as HTMLElement).tagName === 'INPUT' ||
      (e.target as HTMLElement).tagName === 'TEXTAREA'
    )
      return;

    // Alt + 左箭头 = 上一集
    if (e.altKey && e.key === 'ArrowLeft') {
      if (detailRef.current && currentEpisodeIndexRef.current > 0) {
        handlePreviousEpisode();
        e.preventDefault();
      }
    }

    // Alt + 右箭头 = 下一集
    if (e.altKey && e.key === 'ArrowRight') {
      const d = detailRef.current;
      const idx = currentEpisodeIndexRef.current;
      if (d && idx < d.episodes.length - 1) {
        handleNextEpisode();
        e.preventDefault();
      }
    }

    // 左箭头 = 快退 (Vidstack 内部已处理，此处保留以确保一致性)
    if (!e.altKey && e.key === 'ArrowLeft') {
      if (playerRef.current) {
        const currentTime = playerRef.current.getCurrentTime();
        if (currentTime > 10) {
          playerRef.current.seek(currentTime - 10);
          e.preventDefault();
        }
      }
    }

    // 右箭头 = 快进
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

    // 空格 = 播放/暂停
    if (e.key === ' ') {
      if (playerRef.current) {
        playerRef.current.toggle();
        e.preventDefault();
      }
    }

    // f 键 = 切换全屏
    if (e.key === 'f' || e.key === 'F') {
      if (playerRef.current) {
        playerRef.current.toggleFullscreen();
        e.preventDefault();
      }
    }
  }, []);

  // ---------------------------------------------------------------------------
  // 播放记录相关
  // ---------------------------------------------------------------------------
  // 保存播放进度
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

    // 如果播放时间太短（少于5秒）或者视频时长无效，不保存
    if (currentTime < 1 || !duration) {
      return;
    }

    try {
      await savePlayRecord(currentSourceRef.current, currentIdRef.current, {
        title: videoTitleRef.current,
        source_name: detailRef.current?.source_name || '',
        year: detailRef.current?.year,
        cover: detailRef.current?.poster || '',
        index: currentEpisodeIndexRef.current + 1, // 转换为1基索引
        total_episodes: detailRef.current?.episodes.length || 1,
        play_time: Math.floor(currentTime),
        total_time: Math.floor(duration),
        save_time: Date.now(),
        search_title: searchTitle,
      });

      lastSaveTimeRef.current = Date.now();
      console.log('播放进度已保存:', {
        title: videoTitleRef.current,
        episode: currentEpisodeIndexRef.current + 1,
        year: detailRef.current?.year,
        progress: `${Math.floor(currentTime)}/${Math.floor(duration)}`,
      });
    } catch (err) {
      console.error('保存播放进度失败:', err);
    }
  }, [searchTitle]);

  useEffect(() => {
    // 页面即将卸载时保存播放进度
    const handleBeforeUnload = () => {
      saveCurrentPlayProgress();
    };

    // 页面可见性变化时保存播放进度
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveCurrentPlayProgress();
      }
    };

    // 添加事件监听器
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      // 清理事件监听器
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [saveCurrentPlayProgress]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // 收藏相关
  // ---------------------------------------------------------------------------
  // 每当 source 或 id 变化时检查收藏状态
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

  // 监听收藏数据更新事件
  useEffect(() => {
    if (!currentSource || !currentId) return;

    const unsubscribe = subscribeToDataUpdates(
      'favoritesUpdated',
      (favorites: Record<string, any>) => {
        const key = generateStorageKey(currentSource, currentId);
        const isFav = !!favorites[key];
        setFavorited(isFav);
      }
    );

    return unsubscribe;
  }, [currentSource, currentId]);

  // 切换收藏
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
        // 如果已收藏，删除收藏
        await deleteFavorite(currentSourceRef.current, currentIdRef.current);
        setFavorited(false);
      } else {
        // 如果未收藏，添加收藏
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

  // Vidstack 播放器事件处理
  const handlePlayerTimeUpdate = useCallback(
    (_currentTime: number, _duration: number) => {
      const now = Date.now();
      let interval = 5000;
      if (process.env.NEXT_PUBLIC_STORAGE_TYPE === 'd1') {
        interval = 10000;
      }
      if (process.env.NEXT_PUBLIC_STORAGE_TYPE === 'upstash') {
        interval = 20000;
      }
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
      setTimeout(() => {
        setCurrentEpisodeIndex(idx + 1);
      }, 1000);
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

  // 当组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
    };
  }, []);

  if (loading) {
    return (
      <PageLayout activePath='/play'>
        <div className='flex items-center justify-center min-h-screen bg-[#0a0a0a]'>
          <div className='text-center max-w-md mx-auto px-6'>
            {/* 动画影院图标 */}
            <div className='relative mb-8'>
              <div className='relative mx-auto w-20 h-20 bg-gradient-to-r from-brand-500 to-orange-600 rounded-full shadow-2xl flex items-center justify-center'>
                <div className='text-white text-3xl'>
                  {loadingStage === 'searching' && '🔍'}
                  {loadingStage === 'preferring' && '⚡'}
                  {loadingStage === 'fetching' && '🎬'}
                  {loadingStage === 'ready' && '✨'}
                </div>
                {/* 旋转光环 */}
                <div className='absolute -inset-3 border-2 border-brand-500/30 rounded-full animate-spin'></div>
                <div
                  className='absolute -inset-6 border border-brand-500/20 rounded-full animate-spin'
                  style={{
                    animationDuration: '3s',
                    animationDirection: 'reverse',
                  }}
                ></div>
              </div>
            </div>

            {/* 进度指示器 */}
            <div className='mb-6 w-64 mx-auto'>
              <div className='flex justify-center space-x-3 mb-4'>
                <div
                  className={`w-2 h-2 rounded-full transition-all duration-500 ${
                    loadingStage === 'searching' || loadingStage === 'fetching'
                      ? 'bg-brand-500 scale-150'
                      : loadingStage === 'preferring' ||
                        loadingStage === 'ready'
                      ? 'bg-brand-500'
                      : 'bg-gray-600'
                  }`}
                ></div>
                <div
                  className={`w-2 h-2 rounded-full transition-all duration-500 ${
                    loadingStage === 'preferring'
                      ? 'bg-brand-500 scale-150'
                      : loadingStage === 'ready'
                      ? 'bg-brand-500'
                      : 'bg-gray-600'
                  }`}
                ></div>
                <div
                  className={`w-2 h-2 rounded-full transition-all duration-500 ${
                    loadingStage === 'ready'
                      ? 'bg-brand-500 scale-150'
                      : 'bg-gray-600'
                  }`}
                ></div>
              </div>

              {/* 进度条 */}
              <div className='w-full bg-white/10 rounded-full h-1 overflow-hidden'>
                <div
                  className='h-full bg-brand-500 rounded-full transition-all duration-1000 ease-out'
                  style={{
                    width:
                      loadingStage === 'searching' ||
                      loadingStage === 'fetching'
                        ? '33%'
                        : loadingStage === 'preferring'
                        ? '66%'
                        : '100%',
                  }}
                ></div>
              </div>
            </div>

            {/* 加载消息 */}
            <p className='text-lg text-gray-300 animate-pulse'>
              {loadingMessage}
            </p>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout activePath='/play'>
        <div className='flex items-center justify-center min-h-screen bg-[#0a0a0a]'>
          <div className='text-center max-w-sm mx-auto px-6'>
            {/* 错误图标 */}
            <div className='relative mb-6'>
              <div className='relative mx-auto w-16 h-16 bg-gradient-to-r from-red-500 to-orange-500 rounded-full shadow-xl flex items-center justify-center'>
                <div className='text-white text-2xl'>😵</div>
              </div>
            </div>

            {/* 错误信息 */}
            <div className='space-y-3 mb-6'>
              <h2 className='text-xl font-bold text-white'>出现了一些问题</h2>
              <div className='bg-red-500/10 border border-red-500/30 rounded-lg p-3'>
                <p className='text-red-400 text-sm'>{error}</p>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className='space-y-2'>
              <button
                onClick={() =>
                  videoTitle
                    ? router.push(`/search?q=${encodeURIComponent(videoTitle)}`)
                    : router.back()
                }
                className='w-full px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium transition-colors'
              >
                {videoTitle ? '🔍 返回搜索' : '← 返回上页'}
              </button>

              <button
                onClick={() => window.location.reload()}
                className='w-full px-4 py-2.5 bg-white/10 text-white rounded-lg font-medium hover:bg-white/20 transition-colors'
              >
                🔄 重新尝试
              </button>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout activePath='/play'>
      {/* 全屏深色背景 */}
      <div className='min-h-screen bg-[#0a0a0a]'>
        {/* 播放器区域 */}
        <div className='w-full bg-black'>
          <div className='max-w-[1800px] mx-auto'>
            <div className='relative w-full aspect-video'>
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

              {/* 加载状态 */}
              {isVideoLoading && (
                <div className='absolute inset-0 bg-black flex items-center justify-center z-50'>
                  <div className='flex flex-col items-center gap-4'>
                    <div className='w-12 h-12 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin' />
                    <span className='text-gray-400'>
                      {videoLoadingStage === 'sourceChanging'
                        ? '正在切换播放源...'
                        : '视频加载中...'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 内容区域 */}
        <div className='max-w-7xl mx-auto px-4 lg:px-8 py-6'>
          {/* 标题栏 */}
          <div className='flex items-start justify-between gap-4 mb-6'>
            <div>
              <h1 className='text-2xl md:text-3xl font-bold text-white flex items-center gap-3'>
                {videoTitle || '加载中...'}
                {totalEpisodes > 1 && (
                  <span className='text-lg font-normal text-gray-400'>
                    第{currentEpisodeIndex + 1}集
                  </span>
                )}
              </h1>
              <div className='flex items-center gap-3 mt-2 text-sm text-gray-400'>
                {detail?.class && <span>{detail.class}</span>}
                {detail?.year && <span>{detail.year}</span>}
                {detail?.source_name && (
                  <span className='px-2 py-0.5 bg-white/10 rounded text-xs'>
                    {detail.source_name}
                  </span>
                )}
              </div>
            </div>

            {/* 收藏按钮 */}
            <button
              onClick={handleToggleFavorite}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                favorited
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Heart className={`w-5 h-5 ${favorited ? 'fill-current' : ''}`} />
              <span className='hidden sm:inline'>
                {favorited ? '已收藏' : '收藏'}
              </span>
            </button>
          </div>

          {/* 选集 + 换源 两栏布局 */}
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            {/* 选集区域 */}
            {totalEpisodes > 1 && (
              <div className='bg-white/[0.02] rounded-2xl p-5 border border-white/5'>
                <div className='flex items-center justify-between mb-4'>
                  <h2 className='text-lg font-medium text-white'>选集</h2>
                  <span className='text-sm text-gray-500'>
                    {totalEpisodes}集
                  </span>
                </div>
                <div className='grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-2 max-h-[280px] overflow-y-auto pr-1'>
                  {Array.from({ length: totalEpisodes }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => handleEpisodeChange(i)}
                      className={`h-10 rounded-lg text-sm font-medium transition-all ${
                        i === currentEpisodeIndex
                          ? 'bg-brand-500 text-white'
                          : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 播放源区域 */}
            <div
              className={`bg-white/[0.02] rounded-2xl p-5 border border-white/5 ${
                totalEpisodes <= 1 ? 'lg:col-span-2' : ''
              }`}
            >
              <div className='flex items-center justify-between mb-4'>
                <h2 className='text-lg font-medium text-white'>播放源</h2>
                <span className='text-sm text-gray-500'>
                  {availableSources.length}个可用
                </span>
              </div>

              {sourceSearchLoading ? (
                <div className='flex items-center justify-center py-8'>
                  <div className='w-6 h-6 border-2 border-brand-500/20 border-t-brand-500 rounded-full animate-spin' />
                  <span className='ml-3 text-gray-500'>搜索中...</span>
                </div>
              ) : availableSources.length === 0 ? (
                <div className='py-8 text-center text-gray-500'>暂无可用源</div>
              ) : (
                <div className='space-y-2 max-h-[280px] overflow-y-auto pr-1'>
                  {availableSources.map((source) => {
                    const isCurrent =
                      source.source === currentSource &&
                      source.id === currentId;
                    const sourceKey = `${source.source}-${source.id}`;
                    const info = precomputedVideoInfo?.get(sourceKey);

                    return (
                      <div
                        key={sourceKey}
                        onClick={() =>
                          !isCurrent &&
                          handleSourceChange(
                            source.source,
                            source.id,
                            source.title
                          )
                        }
                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                          isCurrent
                            ? 'bg-brand-500/10 ring-1 ring-brand-500/30'
                            : 'bg-white/[0.02] hover:bg-white/5'
                        }`}
                      >
                        {/* 播放状态指示 */}
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isCurrent ? 'bg-brand-500' : 'bg-white/5'
                          }`}
                        >
                          {isCurrent ? (
                            <div className='w-3 h-3 bg-white rounded-sm' />
                          ) : (
                            <svg
                              className='w-4 h-4 text-gray-400 ml-0.5'
                              fill='currentColor'
                              viewBox='0 0 24 24'
                            >
                              <path d='M8 5v14l11-7z' />
                            </svg>
                          )}
                        </div>

                        {/* 源信息 */}
                        <div className='flex-1 min-w-0'>
                          <div className='flex items-center gap-2'>
                            <span
                              className={`font-medium ${
                                isCurrent ? 'text-brand-400' : 'text-white'
                              }`}
                            >
                              {source.source_name}
                            </span>
                            {source.episodes.length > 1 && (
                              <span className='text-xs text-gray-500'>
                                {source.episodes.length}集
                              </span>
                            )}
                          </div>
                          {info && !info.hasError && (
                            <div className='flex items-center gap-2 mt-1 text-xs'>
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
                              <span className='text-gray-500'>•</span>
                              <span className='text-gray-400'>
                                {info.loadSpeed}
                              </span>
                              <span className='text-gray-500'>•</span>
                              <span className='text-gray-400'>
                                {info.pingTime}ms
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 简介区域 */}
          {detail?.desc && (
            <div className='mt-6 bg-white/[0.02] rounded-2xl p-5 border border-white/5'>
              <h2 className='text-lg font-medium text-white mb-3'>简介</h2>
              <p className='text-gray-400 text-sm leading-relaxed'>
                {detail.desc}
              </p>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

export default function PlayPage() {
  return (
    <Suspense
      fallback={
        <div className='flex items-center justify-center min-h-screen bg-[#0a0a0a]'>
          <div className='w-8 h-8 border-2 border-brand-500/20 border-t-brand-500 rounded-full animate-spin' />
        </div>
      }
    >
      <PlayPageClient />
    </Suspense>
  );
}
