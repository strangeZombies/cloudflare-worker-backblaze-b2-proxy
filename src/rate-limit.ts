/**
 * 速率限制模块
 * 使用 Cloudflare Rate Limiting 或内存缓存实现
 */

import { Env } from "./types";

// ==================== 速率限制配置 ====================

/** 内存缓存用于速率限制 (注意: Workers 无持久化存储) */
const rateLimitCache = new Map<string, { count: number; resetTime: number }>();

/**
 * 获取速率限制配置
 */
export function getRateLimitConfig(env: Env): {
  limit: number;
  window: number;
  enabled: boolean;
} {
  // 没有配置 RATE_LIMIT_ENABLED 时默认禁用
  const enabled = env.RATE_LIMIT_ENABLED === "true";
  
  // 没有配置时返回 0
  const limit = env.RATE_LIMIT_REQUESTS ? parseInt(env.RATE_LIMIT_REQUESTS, 10) : 0;
  const window = env.RATE_LIMIT_WINDOW ? parseInt(env.RATE_LIMIT_WINDOW, 10) : 0;
  
  // 如果没有有效配置，禁用速率限制
  if (isNaN(limit) || limit <= 0 || isNaN(window) || window <= 0) {
    return { limit: 0, window: 0, enabled: false };
  }
  
  return { limit, window, enabled };
}

/**
 * 获取客户端标识符
 * 使用 IP 地址作为标识
 */
export function getClientIdentifier(request: Request): string {
  // 获取真实 IP (Cloudflare 会通过 CF-Connecting-IP 传递)
  const ip = request.headers.get("CF-Connecting-IP") || 
             request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
             "unknown";
  
  // 也可以包含用户代理以区分不同客户端
  const userAgent = request.headers.get("User-Agent") || "";
  
  return `${ip}:${userAgent.slice(0, 50)}`;
}

/**
 * 检查速率限制
 * 返回 { allowed: true } 如果允许请求
 * 返回 { allowed: false, remaining: 0, resetIn: seconds } 如果被限制
 */
export function checkRateLimit(request: Request, env: Env): {
  allowed: boolean;
  remaining: number;
  resetIn: number;
} {
  const config = getRateLimitConfig(env);
  
  if (!config.enabled) {
    return { allowed: true, remaining: config.limit, resetIn: 0 };
  }
  
  const identifier = getClientIdentifier(request);
  const now = Date.now();
  const windowMs = config.window * 1000;
  
  // 获取或创建速率限制记录
  let record = rateLimitCache.get(identifier);
  
  if (!record || now > record.resetTime) {
    // 新窗口
    record = {
      count: 0,
      resetTime: now + windowMs,
    };
    rateLimitCache.set(identifier, record);
  }
  
  // 检查限制
  record.count++;
  const remaining = Math.max(0, config.limit - record.count);
  const resetIn = Math.max(0, Math.ceil((record.resetTime - now) / 1000));
  
  if (record.count > config.limit) {
    console.log(`Rate limit exceeded for ${identifier}`);
    return { allowed: false, remaining: 0, resetIn };
  }
  
  return { allowed: true, remaining, resetIn };
}

/**
 * 创建速率限制响应头
 */
export function createRateLimitHeaders(remaining: number, resetIn: number): Headers {
  const headers = new Headers();
  headers.set("X-RateLimit-Limit", String(remaining > 0 ? remaining + 1 : 1));
  headers.set("X-RateLimit-Remaining", String(remaining));
  headers.set("X-RateLimit-Reset", String(resetIn));
  return headers;
}

/**
 * 清理过期的速率限制记录
 * 应该在定时任务中调用
 */
export function cleanupRateLimitCache(): void {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, record] of rateLimitCache.entries()) {
    if (now > record.resetTime) {
      rateLimitCache.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`Cleaned ${cleaned} expired rate limit records`);
  }
}

/**
 * 获取当前缓存大小
 */
export function getRateLimitCacheSize(): number {
  return rateLimitCache.size;
}
