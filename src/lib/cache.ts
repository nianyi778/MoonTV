/* eslint-disable no-console, @typescript-eslint/no-explicit-any */

/**
 * 通用缓存层 - 支持 KV/Upstash/Redis 存储
 * 用于加速豆瓣数据、搜索结果、视频详情等的读取
 */

import { getStorage } from '@/lib/db';

// 缓存键前缀
const CACHE_PREFIX = {
  DOUBAN_LIST: 'cache:douban:list:',
  DOUBAN_DETAIL: 'cache:douban:detail:',
  SEARCH_RESULT: 'cache:search:',
  VIDEO_DETAIL: 'cache:detail:',
  SOURCE_LIST: 'cache:sources:',
  SOURCE_QUALITY: 'cache:quality:',
};

// 默认缓存时间（秒）
const DEFAULT_TTL = {
  DOUBAN_LIST: 3600, // 1小时
  DOUBAN_DETAIL: 86400, // 24小时
  SEARCH_RESULT: 1800, // 30分钟
  VIDEO_DETAIL: 3600, // 1小时
  SOURCE_LIST: 86400, // 24小时
  SOURCE_QUALITY: 43200, // 12小时
};

// 内存缓存（用于 localstorage 模式或作为二级缓存）
const memoryCache = new Map<string, { data: any; expiry: number }>();
const MAX_MEMORY_CACHE_SIZE = 100;

/**
 * 获取缓存
 */
export async function getCache<T>(key: string): Promise<T | null> {
  // 先检查内存缓存
  const memCached = memoryCache.get(key);
  if (memCached && memCached.expiry > Date.now()) {
    return memCached.data as T;
  }

  // 如果内存缓存过期，删除它
  if (memCached) {
    memoryCache.delete(key);
  }

  // 检查 KV 存储
  const storage = getStorage();
  if (!storage) return null;

  try {
    if (typeof (storage as any).getCache === 'function') {
      const cached = await (storage as any).getCache(key);
      if (cached) {
        // 写入内存缓存
        setMemoryCache(key, cached.data, cached.ttl || 300);
        return cached.data as T;
      }
    }
  } catch (err) {
    console.error('Cache get error:', err);
  }

  return null;
}

/**
 * 设置缓存
 */
export async function setCache<T>(
  key: string,
  data: T,
  ttlSeconds = 3600
): Promise<void> {
  // 设置内存缓存
  setMemoryCache(key, data, ttlSeconds);

  // 设置 KV 存储
  const storage = getStorage();
  if (!storage) return;

  try {
    if (typeof (storage as any).setCache === 'function') {
      await (storage as any).setCache(
        key,
        { data, ttl: ttlSeconds },
        ttlSeconds
      );
    }
  } catch (err) {
    console.error('Cache set error:', err);
  }
}

/**
 * 删除缓存
 */
export async function deleteCache(key: string): Promise<void> {
  memoryCache.delete(key);

  const storage = getStorage();
  if (!storage) return;

  try {
    if (typeof (storage as any).deleteCache === 'function') {
      await (storage as any).deleteCache(key);
    }
  } catch (err) {
    console.error('Cache delete error:', err);
  }
}

/**
 * 批量删除缓存（按前缀）
 */
export async function deleteCacheByPrefix(prefix: string): Promise<void> {
  // 清理内存缓存
  const keysToDelete: string[] = [];
  memoryCache.forEach((_, key) => {
    if (key.startsWith(prefix)) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach((key) => memoryCache.delete(key));

  const storage = getStorage();
  if (!storage) return;

  try {
    if (typeof (storage as any).deleteCacheByPrefix === 'function') {
      await (storage as any).deleteCacheByPrefix(prefix);
    }
  } catch (err) {
    console.error('Cache delete by prefix error:', err);
  }
}

/**
 * 设置内存缓存
 */
function setMemoryCache<T>(key: string, data: T, ttlSeconds: number): void {
  // 如果超过最大大小，删除最旧的条目
  if (memoryCache.size >= MAX_MEMORY_CACHE_SIZE) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) {
      memoryCache.delete(oldestKey);
    }
  }

  memoryCache.set(key, {
    data,
    expiry: Date.now() + ttlSeconds * 1000,
  });
}

// ============================================================================
// 便捷方法
// ============================================================================

/**
 * 获取或设置缓存（如果不存在则执行 fetcher 并缓存结果）
 */
export async function getOrSetCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = 3600
): Promise<T> {
  const cached = await getCache<T>(key);
  if (cached !== null) {
    return cached;
  }

  const data = await fetcher();
  await setCache(key, data, ttlSeconds);
  return data;
}

// ============================================================================
// 特定类型的缓存辅助函数
// ============================================================================

/**
 * 缓存豆瓣列表
 */
export function cacheDoubanList(category: string, type: string, page = 0) {
  const key = `${CACHE_PREFIX.DOUBAN_LIST}${category}:${type}:${page}`;
  const ttl = DEFAULT_TTL.DOUBAN_LIST;
  return { key, ttl };
}

/**
 * 缓存搜索结果
 */
export function cacheSearchResult(query: string) {
  const key = `${CACHE_PREFIX.SEARCH_RESULT}${query.toLowerCase().trim()}`;
  const ttl = DEFAULT_TTL.SEARCH_RESULT;
  return { key, ttl };
}

/**
 * 缓存视频详情
 */
export function cacheVideoDetail(source: string, id: string) {
  const key = `${CACHE_PREFIX.VIDEO_DETAIL}${source}:${id}`;
  const ttl = DEFAULT_TTL.VIDEO_DETAIL;
  return { key, ttl };
}

/**
 * 缓存片源列表
 */
export function cacheSourceList() {
  const key = `${CACHE_PREFIX.SOURCE_LIST}all`;
  const ttl = DEFAULT_TTL.SOURCE_LIST;
  return { key, ttl };
}

/**
 * 缓存片源质量信息
 */
export function cacheSourceQuality(sourceKey: string) {
  const key = `${CACHE_PREFIX.SOURCE_QUALITY}${sourceKey}`;
  const ttl = DEFAULT_TTL.SOURCE_QUALITY;
  return { key, ttl };
}

export { CACHE_PREFIX, DEFAULT_TTL };
