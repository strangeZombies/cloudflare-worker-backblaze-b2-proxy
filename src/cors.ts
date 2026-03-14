/**
 * CORS 模块
 * 处理跨域请求
 */

import { Env } from "./types";

// ==================== CORS 配置 ====================

const DEFAULT_ALLOWED_METHODS = ["GET", "HEAD", "OPTIONS"];

const DEFAULT_ALLOWED_HEADERS = [
  "Range",
  "If-Modified-Since",
  "If-None-Match",
  "If-Range",
  "Accept",
  "Accept-Language",
  "Authorization",
];

/**
 * 获取允许的 CORS 来源列表
 */
export function getAllowedOrigins(env?: Env): string[] {
  if (env?.CORS_ALLOWED_ORIGINS) {
    return env.CORS_ALLOWED_ORIGINS.split(",").map((origin) => origin.trim());
  }
  // 没有配置时返回空数组，拒绝所有跨域请求
  return [];
}

/**
 * 获取允许的请求方法
 */
export function getAllowedMethods(): string[] {
  return [...DEFAULT_ALLOWED_METHODS];
}

/**
 * 获取允许的请求头
 */
export function getAllowedHeaders(): string[] {
  return [...DEFAULT_ALLOWED_HEADERS];
}

/**
 * 检查 origin 是否在允许列表中
 */
export function isOriginAllowed(origin: string | null, env?: Env): boolean {
  if (!origin) return false;
  const allowedOrigins = getAllowedOrigins(env);
  return allowedOrigins.includes(origin);
}

/**
 * 处理 OPTIONS 预检请求
 */
export function handlePreflightRequest(request: Request, env?: Env): Response | null {
  if (request.method !== "OPTIONS") {
    return null;
  }
  
  const origin = request.headers.get("Origin");
  
  // 如果没有 Origin，直接返回 204
  if (!origin) {
    return new Response(null, { status: 204 });
  }
  
  // 检查 Origin 是否允许
  if (isOriginAllowed(origin, env)) {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": getAllowedMethods().join(", "),
        "Access-Control-Max-Age": "86400",
        "Access-Control-Allow-Headers": getAllowedHeaders().join(", "),
        "Vary": "Origin",
      },
    });
  }
  
  // 不允许的 Origin
  return new Response(null, { status: 204 });
}

/**
 * 为响应添加 CORS 头部
 */
export function addCorsHeaders(response: Response, origin: string | null, env?: Env): Response {
  const allowedOrigins = getAllowedOrigins(env);
  
  const newResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers),
  });
  
  if (origin && allowedOrigins.includes(origin)) {
    newResponse.headers.set("Access-Control-Allow-Origin", origin);
    newResponse.headers.set("Vary", "Origin");
  }
  
  return newResponse;
}

/**
 * 创建 HEAD 请求响应（无 body）
 */
export function createHeadResponse(response: Response): Response {
  return new Response(null, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  });
}
