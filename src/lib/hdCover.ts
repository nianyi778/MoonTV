/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { useEffect, useState } from 'react';

// 内存缓存
const hdCoverCache = new Map<string, string>();

// localStorage 缓存 key 前缀
const STORAGE_PREFIX = 'hdcover:';
const STORAGE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 天

// 从 localStorage 读取缓存
function getFromStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const item = localStorage.getItem(STORAGE_PREFIX + key);
    if (!item) return null;

    const { value, expiry } = JSON.parse(item);
    if (Date.now() > expiry) {
      localStorage.removeItem(STORAGE_PREFIX + key);
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

// 写入 localStorage 缓存
function setToStorage(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    const item = {
      value,
      expiry: Date.now() + STORAGE_TTL,
    };
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(item));
  } catch {
    // 存储失败，可能是配额已满，清理旧缓存
    cleanupStorage();
  }
}

// 清理过期的 localStorage 缓存
function cleanupStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const keys = Object.keys(localStorage).filter((k) =>
      k.startsWith(STORAGE_PREFIX)
    );
    for (const key of keys) {
      try {
        const item = localStorage.getItem(key);
        if (item) {
          const { expiry } = JSON.parse(item);
          if (Date.now() > expiry) {
            localStorage.removeItem(key);
          }
        }
      } catch {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // 忽略
  }
}

/**
 * 将豆瓣图片 URL 转换为高清版本
 * 豆瓣图片 URL 格式:
 * - 小图: https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2915671709.jpg
 * - 大图: https://img1.doubanio.com/view/photo/l/public/p2915671709.jpg
 * - 原图: https://img1.doubanio.com/view/photo/raw/public/p2915671709.jpg
 */
export function getDoubanHDPoster(url: string): string {
  if (!url) return url;

  // 已经是高清版本
  if (url.includes('/photo/l/') || url.includes('/photo/raw/')) {
    return url;
  }

  // 转换为大图版本（raw 可能不存在，l 更稳定）
  if (url.includes('doubanio.com')) {
    return url
      .replace(/\/view\/photo\/[^/]+\//, '/view/photo/l/')
      .replace(/\/s_ratio_poster\//, '/l/')
      .replace(/\/m\/public\//, '/l/public/')
      .replace(/\/s\/public\//, '/l/public/');
  }

  return url;
}

/**
 * 获取高清封面 URL（带缓存）
 * @param type - 'poster' 竖版海报 | 'backdrop' 横版背景图
 */
export async function getHDCover(
  originalUrl: string,
  title?: string,
  year?: string,
  type: 'poster' | 'backdrop' = 'backdrop'
): Promise<string> {
  const cacheKey = `${type}:${title || ''}:${year || ''}:${originalUrl}`;

  // 1. 检查内存缓存
  const memCached = hdCoverCache.get(cacheKey);
  if (memCached) {
    return memCached;
  }

  // 2. 检查 localStorage 缓存
  const storageCached = getFromStorage(cacheKey);
  if (storageCached) {
    hdCoverCache.set(cacheKey, storageCached);
    return storageCached;
  }

  // 3. 如果有标题，调用 API 获取 TMDB 高清图片
  if (title) {
    try {
      const params = new URLSearchParams();
      if (originalUrl) params.set('url', originalUrl);
      if (title) params.set('title', title);
      if (year) params.set('year', year);
      params.set('type', type);

      const response = await fetch(`/api/hd-cover?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        if (data.hdUrl && data.hdUrl !== originalUrl) {
          // 缓存结果
          hdCoverCache.set(cacheKey, data.hdUrl);
          setToStorage(cacheKey, data.hdUrl);
          return data.hdUrl;
        }
      }
    } catch {
      // 忽略错误，返回本地转换
    }
  }

  // 4. 本地转换豆瓣高清 URL
  const localHD = getDoubanHDPoster(originalUrl);
  hdCoverCache.set(cacheKey, localHD);
  setToStorage(cacheKey, localHD);
  return localHD;
}

/**
 * React Hook: 获取高清封面（优先 TMDB）
 * @param type - 'poster' 竖版海报 | 'backdrop' 横版背景图（banner 推荐用 backdrop）
 */
export function useHDCover(
  originalUrl: string,
  title?: string,
  year?: string,
  type: 'poster' | 'backdrop' = 'backdrop'
): {
  hdUrl: string;
  loading: boolean;
} {
  const [hdUrl, setHdUrl] = useState(() => getDoubanHDPoster(originalUrl));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const cacheKey = `${type}:${title || ''}:${year || ''}:${originalUrl}`;

    // 1. 检查内存缓存
    const memCached = hdCoverCache.get(cacheKey);
    if (memCached) {
      setHdUrl(memCached);
      return;
    }

    // 2. 检查 localStorage 缓存
    const storageCached = getFromStorage(cacheKey);
    if (storageCached) {
      hdCoverCache.set(cacheKey, storageCached);
      setHdUrl(storageCached);
      return;
    }

    // 3. 异步获取 TMDB 高清版本
    const fetchHD = async () => {
      if (!title) {
        // 没有标题，只能用豆瓣高清
        const localHD = getDoubanHDPoster(originalUrl);
        setHdUrl(localHD);
        return;
      }

      setLoading(true);
      try {
        const result = await getHDCover(originalUrl, title, year, type);
        if (!cancelled) {
          setHdUrl(result);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchHD();

    return () => {
      cancelled = true;
    };
  }, [originalUrl, title, year, type]);

  return { hdUrl, loading };
}

/**
 * 批量预加载高清封面
 */
export async function preloadHDCovers(
  items: Array<{ url: string; title: string; year?: string }>
): Promise<void> {
  await Promise.all(
    items.map((item) => getHDCover(item.url, item.title, item.year))
  );
}

/**
 * 图片加载错误时的回退处理
 */
export function handleImageError(
  e: React.SyntheticEvent<HTMLImageElement>,
  fallbackUrl: string
): void {
  const img = e.currentTarget;
  if (img.src !== fallbackUrl) {
    img.src = fallbackUrl;
  }
}
