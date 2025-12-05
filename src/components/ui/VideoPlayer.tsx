'use client';

import {
  Maximize,
  Pause,
  Play,
  Settings,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface VideoPlayerProps {
  src?: string;
  poster?: string;
  title?: string;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  autoPlay?: boolean;
  startTime?: number;
}

export function VideoPlayer({
  src,
  poster,
  title,
  onTimeUpdate,
  onEnded,
  autoPlay = false,
  startTime = 0,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const hideControlsTimer = useRef<NodeJS.Timeout>();

  // 格式化时间
  const formatTime = (time: number) => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
        .toString()
        .padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // 自动隐藏控制栏
  const resetHideTimer = useCallback(() => {
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
    setShowControls(true);
    if (isPlaying) {
      hideControlsTimer.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

  // 播放/暂停
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  }, [isPlaying]);

  // 静音
  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  // 音量
  const handleVolumeChange = useCallback((value: number) => {
    if (!videoRef.current) return;
    videoRef.current.volume = value;
    setVolume(value);
    setIsMuted(value === 0);
  }, []);

  // 进度
  const handleProgressChange = useCallback((value: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = value;
    setCurrentTime(value);
  }, []);

  // 快进快退
  const skip = useCallback((seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime += seconds;
  }, []);

  // 全屏
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  }, []);

  // 事件监听
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      onTimeUpdate?.(video.currentTime, video.duration);
    };
    const handleDurationChange = () => setDuration(video.duration);
    const handleLoadedData = () => {
      setIsLoading(false);
      if (startTime > 0) {
        video.currentTime = startTime;
      }
    };
    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    const handleEnded = () => {
      setIsPlaying(false);
      onEnded?.();
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('ended', handleEnded);
    };
  }, [onTimeUpdate, onEnded, startTime]);

  // 鼠标移动显示控制栏
  useEffect(() => {
    resetHideTimer();
  }, [isPlaying, resetHideTimer]);

  // 进度条百分比
  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className='relative w-full aspect-video bg-black group'
      onMouseMove={resetHideTimer}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Video Element */}
      {src ? (
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          autoPlay={autoPlay}
          className='w-full h-full object-contain'
          onClick={togglePlay}
        />
      ) : (
        // Poster Placeholder when no src
        <div
          className='absolute inset-0 bg-cover bg-center'
          style={{ backgroundImage: poster ? `url(${poster})` : undefined }}
        >
          <div className='absolute inset-0 bg-black/60' />
        </div>
      )}

      {/* Loading Spinner */}
      {isLoading && src && (
        <div className='absolute inset-0 flex items-center justify-center bg-black/30'>
          <div className='w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin' />
        </div>
      )}

      {/* Center Play Button (when paused or no src) */}
      {(!isPlaying || !src) && (
        <div className='absolute inset-0 flex items-center justify-center'>
          <button
            onClick={src ? togglePlay : undefined}
            className={`h-20 w-20 rounded-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center transition-transform hover:scale-110 ${
              !src ? 'opacity-80 cursor-default' : ''
            }`}
          >
            <Play className='h-8 w-8 fill-current ml-1' />
          </button>
        </div>
      )}

      {/* Gradient Overlay for Controls */}
      <div
        className={`absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/90 to-transparent transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Bottom Controls */}
      <div
        className={`absolute bottom-0 left-0 right-0 px-4 pb-4 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Progress Bar */}
        <div className='mb-3 group/progress'>
          <div
            className='h-1 bg-zinc-600 rounded-full cursor-pointer group-hover/progress:h-2 transition-all'
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const percent = (e.clientX - rect.left) / rect.width;
              handleProgressChange(percent * duration);
            }}
          >
            <div
              className='h-full bg-orange-500 rounded-full relative'
              style={{ width: `${progress}%` }}
            >
              <div className='absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-orange-500 rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity' />
            </div>
          </div>
        </div>

        {/* Controls Row */}
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className='w-10 h-10 flex items-center justify-center text-white hover:text-orange-500 transition-colors'
            >
              {isPlaying ? (
                <Pause className='h-6 w-6' />
              ) : (
                <Play className='h-6 w-6 fill-current' />
              )}
            </button>

            {/* Skip Buttons */}
            <button
              onClick={() => skip(-10)}
              className='w-8 h-8 flex items-center justify-center text-white hover:text-orange-500 transition-colors'
            >
              <SkipBack className='h-5 w-5' />
            </button>
            <button
              onClick={() => skip(10)}
              className='w-8 h-8 flex items-center justify-center text-white hover:text-orange-500 transition-colors'
            >
              <SkipForward className='h-5 w-5' />
            </button>

            {/* Volume */}
            <div className='flex items-center gap-2 group/volume'>
              <button
                onClick={toggleMute}
                className='w-8 h-8 flex items-center justify-center text-white hover:text-orange-500 transition-colors'
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className='h-5 w-5' />
                ) : (
                  <Volume2 className='h-5 w-5' />
                )}
              </button>
              <div className='w-0 overflow-hidden group-hover/volume:w-20 transition-all'>
                <input
                  type='range'
                  min='0'
                  max='1'
                  step='0.1'
                  value={isMuted ? 0 : volume}
                  onChange={(e) =>
                    handleVolumeChange(parseFloat(e.target.value))
                  }
                  className='w-full accent-orange-500'
                />
              </div>
            </div>

            {/* Time */}
            <span className='text-white text-sm font-mono'>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className='flex items-center gap-3'>
            {/* Title */}
            {title && (
              <span className='text-white text-sm truncate max-w-[200px] hidden md:block'>
                {title}
              </span>
            )}

            {/* Settings */}
            <button className='w-8 h-8 flex items-center justify-center text-white hover:text-orange-500 transition-colors'>
              <Settings className='h-5 w-5' />
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className='w-8 h-8 flex items-center justify-center text-white hover:text-orange-500 transition-colors'
            >
              <Maximize className='h-5 w-5' />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
