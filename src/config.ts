/**
 * 配置模块
 * 处理路由模式、头部过滤等配置
 */

import { Env, RouteMode, UNSIGNABLE_HEADERS, HTTPS_PROTOCOL, HTTPS_PORT } from "./types";

/**
 * 获取路由模式
 */
export function getRouteMode(bucketName: string | undefined): RouteMode {
  if (bucketName === "$path" || bucketName === "$host") {
    return bucketName;
  }
  return "default";
}

/**
 * 检查是否为 List Bucket 请求
 */
export function isListBucketRequest(env: Env, path: string): boolean {
  const bucketName = env.BUCKET_NAME;
  
  return (
    (bucketName === "$path" && path.split("/").length < 2) ||
    (bucketName !== "$path" && bucketName !== "$host" && path.length === 0)
  );
}

/**
 * 检查是否启用 Rclone 模式
 */
export function isRcloneMode(env: Env): boolean {
  return String(env.RCLONE_DOWNLOAD) === "true";
}

/**
 * 检查是否允许 List Bucket
 */
export function isListBucketAllowed(env: Env): boolean {
  return String(env.ALLOW_LIST_BUCKET) === "true";
}

/**
 * 获取允许的头部列表
 */
export function getAllowedHeaders(env: Env): string[] {
  if (!env.ALLOWED_HEADERS) {
    return [];
  }
  return env.ALLOWED_HEADERS.split(",").map((h) => h.trim().toLowerCase());
}

/**
 * 过滤不可签名的头部
 */
export function filterHeaders(headers: Headers, env: Env): Headers {
  const allowedHeaders = getAllowedHeaders(env);
  const result: [string, string][] = [];
  
  headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    
    // 跳过不可签名的头部
    if (UNSIGNABLE_HEADERS.includes(lowerKey)) {
      return;
    }
    
    // 跳过 Cloudflare 内部头部
    if (lowerKey.startsWith("cf-")) {
      return;
    }
    
    // 如果有允许列表，检查是否在列表中
    if (allowedHeaders.length > 0 && !allowedHeaders.includes(lowerKey)) {
      return;
    }
    
    result.push([key, value]);
  });
  
  return new Headers(result);
}

/**
 * 构建目标 URL
 */
export function buildTargetUrl(
  originalUrl: URL,
  env: Env,
  path: string
): URL {
  const targetUrl = new URL(originalUrl.href);
  const bucketName = env.BUCKET_NAME;
  const endpoint = env.B2_ENDPOINT;
  const routeMode = getRouteMode(bucketName);
  
  // 根据路由模式设置 hostname
  switch (routeMode) {
    case "$path":
      targetUrl.hostname = endpoint;
      break;
    case "$host": {
      const parts = targetUrl.hostname.split(".");
      if (parts.length > 0) {
        const subdomain = parts[0];
        targetUrl.hostname = subdomain + "." + endpoint;
      }
      break;
    }
    default:
      targetUrl.hostname = bucketName + "." + endpoint;
      break;
  }
  
  // 设置协议和端口
  targetUrl.protocol = HTTPS_PROTOCOL;
  targetUrl.port = HTTPS_PORT;
  
  // Rclone 模式处理
  if (isRcloneMode(env)) {
    // 使用原始的 BUCKET_NAME 检查，与原 index.js 一致
    if (bucketName === "$path") {
      targetUrl.pathname = path.replace(/^file\//, "");
    } else {
      targetUrl.pathname = path.replace(/^file\/[^/]+\//, "");
    }
  }
  
  return targetUrl;
}

export {
  UNSIGNABLE_HEADERS,
  HTTPS_PROTOCOL,
  HTTPS_PORT,
};
