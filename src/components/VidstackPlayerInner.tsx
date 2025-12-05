/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, no-console */
'use client';

import {
  type MediaPlayerInstance,
  type MediaProviderAdapter,
  isHLSProvider,
  MediaPlayer,
  MediaProvider,
  Poster,
} from '@vidstack/react';
import {
  defaultLayoutIcons,
  DefaultVideoLayout,
} from '@vidstack/react/player/layouts/default';
import Hls from 'hls.js';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';

import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';
import '@/styles/vidstack.css';

import type { VidstackPlayerProps, VidstackPlayerRef } from './VidstackPlayer';

// 去广告：过滤 M3U8 内容中的广告分段
function filterAdsFromM3U8(m3u8Content: string): string {
  if (!m3u8Content) return '';
  const lines = m3u8Content.split('\n');
  const filteredLines = lines.filter(
    (line) => !line.includes('#EXT-X-DISCONTINUITY')
  );
  return filteredLines.join('\n');
}

// 创建自定义 HLS Loader 用于过滤广告
function createCustomHlsLoader(HlsClass: typeof Hls) {
  return class CustomHlsLoader extends HlsClass.DefaultConfig.loader {
    constructor(config: any) {
      super(config);
      const load = this.load.bind(this);
      this.load = function (context: any, cfg: any, callbacks: any) {
        if (context.type === 'manifest' || context.type === 'level') {
          const onSuccess = callbacks.onSuccess;
          callbacks.onSuccess = function (response: any, stats: any, ctx: any) {
            if (response.data && typeof response.data === 'string') {
              response.data = filterAdsFromM3U8(response.data);
            }
            return onSuccess(response, stats, ctx, null);
          };
        }
        load(context, cfg, callbacks);
      };
    }
  };
}

// 保存 blockAdEnabled 引用
let blockAdEnabledRef = true;

const VidstackPlayerInner = forwardRef<VidstackPlayerRef, VidstackPlayerProps>(
  (
    {
      src,
      poster,
      title,
      autoplay = true,
      blockAdEnabled = true,
      skipConfig,
      onTimeUpdate,
      onEnded,
      onCanPlay,
      onError,
      onPlay,
      onPause,
      onVolumeChange,
      onRateChange,
      onNextEpisode,
      resumeTime,
    },
    ref
  ) => {
    const playerRef = useRef<MediaPlayerInstance>(null);
    const hasResumedRef = useRef(false);
    const lastSkipCheckRef = useRef(0);

    // 更新 blockAdEnabled 引用
    useEffect(() => {
      blockAdEnabledRef = blockAdEnabled;
    }, [blockAdEnabled]);

    // 暴露方法给父组件
    useImperativeHandle(ref, () => ({
      play: () => playerRef.current?.play(),
      pause: () => playerRef.current?.pause(),
      toggle: () => {
        if (playerRef.current?.paused) {
          playerRef.current?.play();
        } else {
          playerRef.current?.pause();
        }
      },
      seek: (time: number) => {
        if (playerRef.current) {
          playerRef.current.currentTime = time;
        }
      },
      getCurrentTime: () => playerRef.current?.currentTime || 0,
      getDuration: () => playerRef.current?.duration || 0,
      setVolume: (volume: number) => {
        if (playerRef.current) {
          playerRef.current.volume = volume;
        }
      },
      getVolume: () => playerRef.current?.volume || 0,
      setMuted: (muted: boolean) => {
        if (playerRef.current) {
          playerRef.current.muted = muted;
        }
      },
      setPlaybackRate: (rate: number) => {
        if (playerRef.current) {
          playerRef.current.playbackRate = rate;
        }
      },
      getPlaybackRate: () => playerRef.current?.playbackRate || 1,
      enterFullscreen: () => playerRef.current?.enterFullscreen(),
      exitFullscreen: () => playerRef.current?.exitFullscreen(),
      toggleFullscreen: () => {
        const player = playerRef.current;
        if (!player) return;
        const isFullscreen = player.state.fullscreen;
        if (isFullscreen) {
          player.exitFullscreen();
        } else {
          player.enterFullscreen();
        }
      },
      enterPictureInPicture: () => playerRef.current?.enterPictureInPicture(),
      exitPictureInPicture: () => playerRef.current?.exitPictureInPicture(),
      getPlayer: () => playerRef.current,
    }));

    // 处理 HLS provider 设置
    const handleProviderChange = useCallback(
      (provider: MediaProviderAdapter | null) => {
        if (isHLSProvider(provider)) {
          provider.library = Hls;
          provider.config = {
            debug: false,
            enableWorker: true,
            lowLatencyMode: false,
            loader: blockAdEnabledRef ? createCustomHlsLoader(Hls) : undefined,
          };
        }
      },
      []
    );

    // 恢复播放进度
    const handleCanPlay = useCallback(() => {
      if (
        resumeTime &&
        resumeTime > 0 &&
        !hasResumedRef.current &&
        playerRef.current
      ) {
        playerRef.current.currentTime = resumeTime;
        hasResumedRef.current = true;
      }
      onCanPlay?.();
    }, [resumeTime, onCanPlay]);

    // 跳过片头片尾逻辑
    const handleTimeUpdate = useCallback(() => {
      const player = playerRef.current;
      if (!player) return;

      const currentTime = player.currentTime;
      const duration = player.duration;

      onTimeUpdate?.(currentTime, duration);

      // 跳过片头片尾
      if (skipConfig?.enable && duration > 0) {
        const now = Date.now();
        // 限制检查频率
        if (now - lastSkipCheckRef.current < 500) return;
        lastSkipCheckRef.current = now;

        const introTime = skipConfig.intro_time || 0;
        const outroTime = skipConfig.outro_time || 0;

        // 跳过片头
        if (introTime > 0 && currentTime < introTime) {
          console.log(`[VidstackPlayer] 跳过片头，跳转到 ${introTime}s`);
          player.currentTime = introTime;
        }

        // 跳过片尾
        if (outroTime > 0 && duration - currentTime <= outroTime) {
          console.log('[VidstackPlayer] 检测到片尾，触发下一集');
          onNextEpisode?.();
        }
      }
    }, [skipConfig, onTimeUpdate, onNextEpisode]);

    // 重置恢复标记
    useEffect(() => {
      hasResumedRef.current = false;
    }, [src]);

    return (
      <MediaPlayer
        ref={playerRef}
        src={src}
        title={title || ''}
        autoPlay={autoplay}
        playsInline
        crossOrigin='anonymous'
        className='h-full w-full'
        onProviderChange={handleProviderChange}
        onCanPlay={handleCanPlay}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => onEnded?.()}
        onError={(e) => onError?.(e)}
        onPlay={() => onPlay?.()}
        onPause={() => onPause?.()}
        onVolumeChange={() => {
          if (playerRef.current) {
            onVolumeChange?.(playerRef.current.volume);
          }
        }}
        onRateChange={() => {
          if (playerRef.current) {
            onRateChange?.(playerRef.current.playbackRate);
          }
        }}
        keyTarget='document'
        keyDisabled={false}
      >
        <MediaProvider>
          {poster && (
            <Poster
              className='absolute inset-0 block h-full w-full object-cover opacity-0 transition-opacity data-[visible]:opacity-100'
              src={poster}
              alt={title || ''}
            />
          )}
        </MediaProvider>

        <DefaultVideoLayout
          icons={defaultLayoutIcons}
          slots={{
            // 添加下一集按钮
            afterPlayButton: onNextEpisode ? (
              <button
                className='vds-button flex items-center justify-center rounded-md p-2 text-white hover:bg-white/20'
                onClick={onNextEpisode}
                title='下一集'
              >
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 24 24'
                  fill='currentColor'
                  className='h-6 w-6'
                >
                  <path d='M5.055 7.06C3.805 6.347 2.25 7.25 2.25 8.69v6.62c0 1.44 1.555 2.343 2.805 1.628l7.108-4.061c1.26-.72 1.26-2.536 0-3.256L5.055 7.061zM19.5 7.5a.75.75 0 00-1.5 0v9a.75.75 0 001.5 0v-9z' />
                </svg>
              </button>
            ) : null,
          }}
        />
      </MediaPlayer>
    );
  }
);

VidstackPlayerInner.displayName = 'VidstackPlayerInner';

export default VidstackPlayerInner;
