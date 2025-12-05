/* eslint-disable no-console, @typescript-eslint/no-explicit-any */

/**
 * 片源发现与质量检测服务
 * 定时从互联网获取免费片源，并检测其可用性和质量
 */

import { CACHE_PREFIX, DEFAULT_TTL, getCache, setCache } from './cache';
import { getConfig } from './config';
import { db } from './db';

// 知名免费片源列表（可通过管理后台配置扩展）
const DEFAULT_FREE_SOURCES = [
  {
    name: '360影视',
    api: 'https://360yingshi.com/api.php/provide/vod/',
    key: '360yingshi',
  },
  {
    name: '樱花动漫',
    api: 'https://api.yhdm.so/api.php/provide/vod/',
    key: 'yhdm',
  },
];

// 测试视频URL的质量和响应速度（供外部使用）
export async function testVideoUrl(url: string): Promise<{
  available: boolean;
  latency: number;
  quality: string;
}> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;

    if (!response.ok) {
      return { available: false, latency, quality: 'unknown' };
    }

    // 简单的质量判断
    let quality = 'SD';

    if (url.includes('1080') || url.includes('fhd')) {
      quality = '1080p';
    } else if (url.includes('720') || url.includes('hd')) {
      quality = '720p';
    } else if (url.includes('4k') || url.includes('2160')) {
      quality = '4K';
    }

    return {
      available: true,
      latency,
      quality,
    };
  } catch {
    return {
      available: false,
      latency: Date.now() - startTime,
      quality: 'unknown',
    };
  }
}

// 测试 API 源的可用性
async function testApiSource(apiUrl: string): Promise<{
  available: boolean;
  latency: number;
  videoCount: number;
}> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${apiUrl}?ac=list`, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;

    if (!response.ok) {
      return { available: false, latency, videoCount: 0 };
    }

    const data = await response.json();
    const videoCount = data.total || data.list?.length || 0;

    return {
      available: true,
      latency,
      videoCount,
    };
  } catch {
    return {
      available: false,
      latency: Date.now() - startTime,
      videoCount: 0,
    };
  }
}

// 发现新的免费片源
export async function discoverFreeSources(): Promise<{
  discovered: number;
  available: number;
  sources: Array<{
    name: string;
    api: string;
    key: string;
    available: boolean;
    latency: number;
    videoCount: number;
  }>;
}> {
  console.log('[SourceDiscovery] Starting source discovery...');

  const config = await getConfig();
  const existingSources = config.SourceConfig.map((s) => s.api);

  const results: Array<{
    name: string;
    api: string;
    key: string;
    available: boolean;
    latency: number;
    videoCount: number;
  }> = [];

  // 测试默认源
  for (const source of DEFAULT_FREE_SOURCES) {
    // 跳过已存在的源
    if (existingSources.includes(source.api)) {
      console.log(`[SourceDiscovery] Skipping existing source: ${source.name}`);
      continue;
    }

    console.log(`[SourceDiscovery] Testing source: ${source.name}`);
    const testResult = await testApiSource(source.api);

    results.push({
      ...source,
      ...testResult,
    });

    // 避免请求过快
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const availableSources = results.filter((r) => r.available);

  console.log(
    `[SourceDiscovery] Discovered ${results.length} sources, ${availableSources.length} available`
  );

  // 缓存发现结果
  await setCache(
    `${CACHE_PREFIX.SOURCE_LIST}discovered`,
    {
      lastUpdate: Date.now(),
      sources: availableSources,
    },
    DEFAULT_TTL.SOURCE_LIST
  );

  return {
    discovered: results.length,
    available: availableSources.length,
    sources: results,
  };
}

// 检查现有片源的质量
export async function checkSourcesQuality(): Promise<{
  checked: number;
  healthy: number;
  results: Array<{
    key: string;
    name: string;
    available: boolean;
    latency: number;
    videoCount: number;
  }>;
}> {
  console.log('[QualityCheck] Starting quality check...');

  const config = await getConfig();
  const sources = config.SourceConfig.filter((s) => !s.disabled);

  const results: Array<{
    key: string;
    name: string;
    available: boolean;
    latency: number;
    videoCount: number;
  }> = [];

  for (const source of sources) {
    console.log(`[QualityCheck] Checking source: ${source.name}`);

    // 先检查缓存
    const cacheKey = `${CACHE_PREFIX.SOURCE_QUALITY}${source.key}`;
    const cached = await getCache<{
      available: boolean;
      latency: number;
      videoCount: number;
      lastCheck: number;
    }>(cacheKey);

    // 如果缓存有效且不超过1小时，使用缓存
    if (cached && Date.now() - cached.lastCheck < 3600000) {
      results.push({
        key: source.key,
        name: source.name,
        available: cached.available,
        latency: cached.latency,
        videoCount: cached.videoCount,
      });
      continue;
    }

    const testResult = await testApiSource(source.api);

    results.push({
      key: source.key,
      name: source.name,
      ...testResult,
    });

    // 缓存结果
    await setCache(
      cacheKey,
      {
        ...testResult,
        lastCheck: Date.now(),
      },
      DEFAULT_TTL.SOURCE_QUALITY
    );

    // 避免请求过快
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  const healthySources = results.filter((r) => r.available);

  console.log(
    `[QualityCheck] Checked ${results.length} sources, ${healthySources.length} healthy`
  );

  return {
    checked: results.length,
    healthy: healthySources.length,
    results,
  };
}

// 自动更新配置（禁用不可用的源）
export async function autoUpdateSourceConfig(): Promise<{
  updated: boolean;
  disabledSources: string[];
  enabledSources: string[];
}> {
  console.log('[AutoUpdate] Starting auto update...');

  const qualityCheck = await checkSourcesQuality();
  const disabledSources: string[] = [];
  const enabledSources: string[] = [];

  // 标记不可用的源（连续3次检查失败才禁用）
  for (const result of qualityCheck.results) {
    const failCountKey = `source_fail_count:${result.key}`;
    let failCount = 0;

    if (!result.available) {
      // 增加失败计数
      const cached = await getCache<number>(failCountKey);
      failCount = (cached || 0) + 1;
      await setCache(failCountKey, failCount, 86400); // 24小时过期

      if (failCount >= 3) {
        disabledSources.push(result.name);
        console.log(
          `[AutoUpdate] Disabling source: ${result.name} (${failCount} failures)`
        );
      }
    } else {
      // 重置失败计数
      await setCache(failCountKey, 0, 86400);

      // 如果之前被禁用，现在可用，则重新启用
      const config = await getConfig();
      const source = config.SourceConfig.find((s) => s.key === result.key);
      if (source?.disabled) {
        enabledSources.push(result.name);
        console.log(`[AutoUpdate] Re-enabling source: ${result.name}`);
      }
    }
  }

  // 如果有变更，保存配置
  if (disabledSources.length > 0 || enabledSources.length > 0) {
    try {
      const config = await getConfig();

      for (const source of config.SourceConfig) {
        if (disabledSources.includes(source.name)) {
          source.disabled = true;
        }
        if (enabledSources.includes(source.name)) {
          source.disabled = false;
        }
      }

      await db.saveAdminConfig(config);
      console.log('[AutoUpdate] Configuration updated');

      return {
        updated: true,
        disabledSources,
        enabledSources,
      };
    } catch (err) {
      console.error('[AutoUpdate] Failed to save config:', err);
    }
  }

  return {
    updated: false,
    disabledSources: [],
    enabledSources: [],
  };
}

// 定时任务入口
export async function runSourceMaintenance(): Promise<{
  discovery: Awaited<ReturnType<typeof discoverFreeSources>>;
  quality: Awaited<ReturnType<typeof checkSourcesQuality>>;
  update: Awaited<ReturnType<typeof autoUpdateSourceConfig>>;
}> {
  console.log('[SourceMaintenance] Starting maintenance tasks...');

  const discovery = await discoverFreeSources();
  const quality = await checkSourcesQuality();
  const update = await autoUpdateSourceConfig();

  console.log('[SourceMaintenance] All tasks completed');

  return {
    discovery,
    quality,
    update,
  };
}
