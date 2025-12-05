/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, no-console */
'use client';

import dynamic from 'next/dynamic';
import React, { forwardRef, useImperativeHandle, useRef } from 'react';

// Types for the player ref
export interface VidstackPlayerRef {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (time: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  setVolume: (volume: number) => void;
  getVolume: () => number;
  setMuted: (muted: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  getPlaybackRate: () => number;
  enterFullscreen: () => void;
  exitFullscreen: () => void;
  toggleFullscreen: () => void;
  enterPictureInPicture: () => void;
  exitPictureInPicture: () => void;
  getPlayer: () => any;
}

export interface VidstackPlayerProps {
  src: string;
  poster?: string;
  title?: string;
  autoplay?: boolean;
  blockAdEnabled?: boolean;
  skipConfig?: {
    enable: boolean;
    intro_time: number;
    outro_time: number;
  };
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onCanPlay?: () => void;
  onError?: (error: any) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onVolumeChange?: (volume: number) => void;
  onRateChange?: (rate: number) => void;
  onNextEpisode?: () => void;
  resumeTime?: number;
}

// Dynamic import the actual player implementation
const VidstackPlayerInner = dynamic<any>(
  () => import('./VidstackPlayerInner'),
  {
    ssr: false,
    loading: () => (
      <div className='flex h-full w-full items-center justify-center bg-black'>
        <div className='h-8 w-8 animate-spin rounded-full border-2 border-green-500 border-t-transparent'></div>
      </div>
    ),
  }
);

// Wrapper component that forwards ref
const VidstackPlayer = forwardRef<VidstackPlayerRef, VidstackPlayerProps>(
  (props, ref) => {
    const innerRef = useRef<VidstackPlayerRef>(null);

    useImperativeHandle(ref, () => ({
      play: () => innerRef.current?.play(),
      pause: () => innerRef.current?.pause(),
      toggle: () => innerRef.current?.toggle(),
      seek: (time: number) => innerRef.current?.seek(time),
      getCurrentTime: () => innerRef.current?.getCurrentTime() || 0,
      getDuration: () => innerRef.current?.getDuration() || 0,
      setVolume: (volume: number) => innerRef.current?.setVolume(volume),
      getVolume: () => innerRef.current?.getVolume() || 0,
      setMuted: (muted: boolean) => innerRef.current?.setMuted(muted),
      setPlaybackRate: (rate: number) =>
        innerRef.current?.setPlaybackRate(rate),
      getPlaybackRate: () => innerRef.current?.getPlaybackRate() || 1,
      enterFullscreen: () => innerRef.current?.enterFullscreen(),
      exitFullscreen: () => innerRef.current?.exitFullscreen(),
      toggleFullscreen: () => innerRef.current?.toggleFullscreen(),
      enterPictureInPicture: () => innerRef.current?.enterPictureInPicture(),
      exitPictureInPicture: () => innerRef.current?.exitPictureInPicture(),
      getPlayer: () => innerRef.current?.getPlayer(),
    }));

    return <VidstackPlayerInner {...props} ref={innerRef} />;
  }
);

VidstackPlayer.displayName = 'VidstackPlayer';

export default VidstackPlayer;
