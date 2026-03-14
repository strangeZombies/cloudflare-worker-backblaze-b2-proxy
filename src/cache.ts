/**
 * 缓存模块
 * 使用 Cloudflare Cache API 实现边缘缓存
 */

import { Env } from "./types";

// Cloudflare Workers 全局 caches API
declare const caches: {
  default: CacheStorage;
};

/** 缓存存储类型 */
interface CacheStorage {
  match(request: RequestInfo | URL, options?: CacheQueryOptions): Promise<Response | undefined>;
  put(request: RequestInfo | URL, response: Response): Promise<void>;
  delete(request: RequestInfo | URL, options?: CacheQueryOptions): Promise<boolean>;
  keys(request?: RequestInfo | URL, options?: CacheQueryOptions): Promise<readonly Request[]>;
}

/** 缓存查询选项 */
interface CacheQueryOptions {
  ignoreSearch?: boolean;
  ignoreMethod?: boolean;
  ignoreVary?: boolean;
}

// ==================== 缓存配置 ====================

/** 热门文件缓存时间 (24小时) */
const HOT_CACHE_TTL = 86400;

/**
 * 检查是否启用缓存
 */
export function isCacheEnabled(env: Env): boolean {
  // 没有配置时默认禁用缓存
  if (!env.CACHE_ENABLED || env.CACHE_ENABLED === "") {
    return false;
  }
  return env.CACHE_ENABLED === "true";
}

/**
 * 获取缓存的 TTL
 * 热门文件使用更长的缓存时间
 */
export function getCacheTTL(env: Env, path: string): number {
  // 如果缓存未启用，返回 0
  if (!isCacheEnabled(env)) {
    return 0;
  }
  
  // 检查是否为热门文件
  const hotFiles = getHotFiles(env);
  if (hotFiles.length > 0) {
    // 检查路径是否匹配热门文件
    for (const hotFile of hotFiles) {
      if (path.includes(hotFile)) {
        return HOT_CACHE_TTL;
      }
    }
  }
  
  // 没有配置缓存时间时，返回 0 (不缓存)
  const customTTL = env.CACHE_TTL;
  if (!customTTL || customTTL === "") {
    return 0;
  }
  
  const parsed = parseInt(customTTL, 10);
  if (isNaN(parsed) || parsed <= 0) {
    return 0;
  }
  
  return parsed;
}

/**
 * 获取热门文件列表
 */
export function getHotFiles(env: Env): string[] {
  if (!env.HOT_FILES) {
    return [];
  }
  return env.HOT_FILES.split(",").map(f => f.trim());
}

/**
 * 从缓存中获取响应
 */
export async function getFromCache(request: Request, env: Env): Promise<Response | null> {
  if (!isCacheEnabled(env)) {
    return null;
  }
  
  const url = new URL(request.url);
  // 只缓存 GET 请求
  if (request.method !== "GET") {
    return null;
  }
  
  // 不缓存带认证的下载请求
  const authHeader = request.headers.get("Authorization");
  if (authHeader) {
    return null;
  }
  
  try {
    const cache = caches.default;
    const cacheKey = new URL(url.href);
    // 移除查询参数作为缓存键 (可选)
    // cacheKey.search = "";
    
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      console.log("Cache hit:", url.pathname);
      return cachedResponse;
    }
    console.log("Cache miss:", url.pathname);
    return null;
  } catch (error) {
    console.error("Cache lookup failed:", error);
    return null;
  }
}

/**
 * 将响应存入缓存
 */
export async function setCache(
  request: Request,
  response: Response,
  env: Env
): Promise<Response> {
  if (!isCacheEnabled(env)) {
    return response;
  }
  
  const url = new URL(request.url);
  
  // 只缓存 GET 请求的成功响应
  if (request.method !== "GET" || !response.ok) {
    return response;
  }
  
  // 不缓存带认证的响应
  const authHeader = request.headers.get("Authorization");
  if (authHeader) {
    return response;
  }
  
  try {
    const cache = caches.default;
    const cacheKey = new URL(url.href);
    const ttl = getCacheTTL(env, url.pathname);
    
    // 创建可克隆的响应
    const responseClone = response.clone();
    
    // 设置 Cache-Control 头
    const headers = new Headers(responseClone.headers);
    headers.set("Cache-Control", `public, max-age=${ttl}`);
    
    const cachedResponse = new Response(await responseClone.arrayBuffer(), {
      status: responseClone.status,
      statusText: responseClone.statusText,
      headers: headers,
    });
    
    // 存入缓存
    await cache.put(cacheKey, cachedResponse);
    console.log("Cached:", url.pathname, "TTL:", ttl);
    
    return response;
  } catch (error) {
    console.error("Cache write failed:", error);
    return response;
  }
}

/**
 * 清除缓存
 * 可以通过管理接口调用
 */
export async function clearCache(urlPattern?: string): Promise<{ success: boolean; message: string }> {
  try {
    const cache = caches.default;
    
    if (!urlPattern) {
      // 清除所有缓存 (Cloudflare 不支持完全清除，需要逐个删除)
      return { success: false, message: "Specify a URL pattern to clear cache" };
    }
    
    // Cloudflare Workers Cache API 不支持模式匹配清除
    // 实际项目中需要通过 Cache API 或 Cloudflare Dashboard 操作
    return { success: true, message: "Cache clear not fully supported in Workers" };
  } catch (error) {
    return { success: false, message: `Cache clear failed: ${error}` };
  }
}
