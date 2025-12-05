/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// 缓存 key 前缀
const CACHE_PREFIX = 'cache:hdcover:';
const CACHE_TTL = 60 * 60 * 24 * 7; // 7 天

/**
 * 获取 KV 缓存值（支持 Upstash/Redis）
 * 优先使用 Upstash（Edge 兼容），其次 Redis
 */
async function getCacheValue(key: string): Promise<string | null> {
  // 1. 尝试 Upstash（Edge Runtime 兼容）
  const upstashUrl = process.env.UPSTASH_URL;
  const upstashToken = process.env.UPSTASH_TOKEN;

  if (upstashUrl && upstashToken) {
    try {
      const response = await fetch(
        `${upstashUrl}/get/${encodeURIComponent(key)}`,
        {
          headers: { Authorization: `Bearer ${upstashToken}` },
        }
      );
      if (response.ok) {
        const data = await response.json();
        return data.result;
      }
    } catch {
      // 忽略错误，继续尝试其他方式
    }
  }

  // 2. 尝试 KV（Cloudflare Workers 环境）
  if (typeof (globalThis as any).HD_COVER_CACHE !== 'undefined') {
    try {
      return await (globalThis as any).HD_COVER_CACHE.get(key);
    } catch {
      // 忽略
    }
  }

  return null;
}

/**
 * 设置 KV 缓存值（支持 Upstash/Redis）
 */
async function setCacheValue(
  key: string,
  value: string,
  ttl: number
): Promise<void> {
  // 1. 尝试 Upstash
  const upstashUrl = process.env.UPSTASH_URL;
  const upstashToken = process.env.UPSTASH_TOKEN;

  if (upstashUrl && upstashToken) {
    try {
      await fetch(
        `${upstashUrl}/setex/${encodeURIComponent(
          key
        )}/${ttl}/${encodeURIComponent(value)}`,
        {
          headers: { Authorization: `Bearer ${upstashToken}` },
        }
      );
      return;
    } catch {
      // 忽略错误
    }
  }

  // 2. 尝试 KV（Cloudflare Workers 环境）
  if (typeof (globalThis as any).HD_COVER_CACHE !== 'undefined') {
    try {
      await (globalThis as any).HD_COVER_CACHE.put(key, value, {
        expirationTtl: ttl,
      });
    } catch {
      // 忽略
    }
  }
}

// 豆瓣图片 URL 转换为高清版本
function getDoubanHDUrl(url: string): string[] {
  if (!url) return [];

  const urls: string[] = [];

  // 豆瓣图片 URL 格式转换
  // 原始: https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2915671709.jpg
  // 高清: https://img1.doubanio.com/view/photo/l/public/p2915671709.jpg
  // 超大: https://img1.doubanio.com/view/photo/raw/public/p2915671709.jpg

  if (url.includes('doubanio.com')) {
    // 尝试原始尺寸
    const rawUrl = url
      .replace(/\/view\/photo\/[^/]+\//, '/view/photo/raw/')
      .replace(/\/s_ratio_poster\//, '/raw/');
    urls.push(rawUrl);

    // 尝试大图尺寸
    const largeUrl = url
      .replace(/\/view\/photo\/[^/]+\//, '/view/photo/l/')
      .replace(/\/s_ratio_poster\//, '/l/');
    urls.push(largeUrl);

    // 尝试中等尺寸
    const mediumUrl = url
      .replace(/\/view\/photo\/[^/]+\//, '/view/photo/m/')
      .replace(/\/s_ratio_poster\//, '/m/');
    urls.push(mediumUrl);
  }

  return urls;
}

interface TMDBResult {
  poster: string | null;
  backdrop: string | null;
}

// TMDB API 搜索高清封面（同时返回海报和横图）
async function searchTMDB(title: string, year?: string): Promise<TMDBResult> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return { poster: null, backdrop: null };

  try {
    const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(
      title
    )}&language=zh-CN${year ? `&year=${year}` : ''}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) return { poster: null, backdrop: null };

    const data = await response.json();
    const result = data.results?.[0];

    return {
      // 使用 original 尺寸获取最高清的图片
      poster: result?.poster_path
        ? `https://image.tmdb.org/t/p/original${result.poster_path}`
        : null,
      backdrop: result?.backdrop_path
        ? `https://image.tmdb.org/t/p/original${result.backdrop_path}`
        : null,
    };
  } catch {
    return { poster: null, backdrop: null };
  }
}

// 测试图片 URL 是否可用
async function testImageUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Referer: 'https://movie.douban.com/',
      },
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const originalUrl = searchParams.get('url');
  const title = searchParams.get('title');
  const year = searchParams.get('year');
  const type = searchParams.get('type') || 'backdrop'; // poster | backdrop，banner 默认用横图

  if (!originalUrl && !title) {
    return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
  }

  // 生成缓存 key
  const cacheKey = `${CACHE_PREFIX}${type}:${title || ''}:${year || ''}:${
    originalUrl || ''
  }`;

  // 1. 检查 KV 缓存
  const cached = await getCacheValue(cacheKey);
  if (cached) {
    try {
      return NextResponse.json(JSON.parse(cached), {
        headers: {
          'Cache-Control': 'public, max-age=86400, s-maxage=604800',
          'X-Cache': 'HIT',
        },
      });
    } catch {
      // 解析失败，继续处理
    }
  }

  const candidates: string[] = [];
  let tmdbResult: TMDBResult = { poster: null, backdrop: null };

  // 1. 优先尝试 TMDB 搜索（高清质量最佳）
  if (title) {
    tmdbResult = await searchTMDB(title, year || undefined);
    const tmdbUrl =
      type === 'backdrop' ? tmdbResult.backdrop : tmdbResult.poster;
    if (tmdbUrl) {
      candidates.unshift(tmdbUrl);
    }
    // 如果请求的是 backdrop 但没有，尝试用 poster
    if (type === 'backdrop' && !tmdbResult.backdrop && tmdbResult.poster) {
      candidates.push(tmdbResult.poster);
    }
  }

  // 2. 备选：豆瓣高清版本
  if (originalUrl) {
    const doubanHDUrls = getDoubanHDUrl(originalUrl);
    candidates.push(...doubanHDUrls);
  }

  // 3. 测试并返回第一个可用的高清图片
  for (const url of candidates) {
    const isAvailable = await testImageUrl(url);
    if (isAvailable) {
      const result = {
        success: true,
        hdUrl: url,
        backdrop: tmdbResult.backdrop,
        poster: tmdbResult.poster,
        source: url.includes('tmdb') ? 'tmdb' : 'douban',
      };

      // 保存到 KV 缓存
      await setCacheValue(cacheKey, JSON.stringify(result), CACHE_TTL);

      return NextResponse.json(result, {
        headers: {
          'Cache-Control': 'public, max-age=86400, s-maxage=604800',
          'X-Cache': 'MISS',
        },
      });
    }
  }

  // 4. 如果都失败，返回原始 URL
  const fallbackResult = {
    success: true,
    hdUrl: originalUrl || '',
    backdrop: null,
    poster: null,
    source: 'original',
    fallback: true,
  };

  // 即使是 fallback 也缓存，避免重复请求
  await setCacheValue(cacheKey, JSON.stringify(fallbackResult), 60 * 60); // 1小时

  return NextResponse.json(fallbackResult, {
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      'X-Cache': 'MISS',
    },
  });
}
