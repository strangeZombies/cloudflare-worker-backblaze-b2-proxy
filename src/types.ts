/**
 * 类型定义 - Backblaze B2 S3 代理
 */

/// <reference types="@cloudflare/workers-types" />

// ==================== 环境变量类型 ====================

/** Worker 环境变量接口 */
export interface Env {
  // B2 配置
  BUCKET_NAME: string;
  B2_ENDPOINT: string;
  B2_APPLICATION_KEY_ID: string;
  B2_APPLICATION_KEY: string;
  RCLONE_DOWNLOAD: string;
  ALLOW_LIST_BUCKET: string;
  ALLOWED_HEADERS: string;
  
  // CORS 配置
  CORS_ALLOWED_ORIGINS?: string;
  
  // 认证配置
  CDN_SIGNING_SECRET?: string;
  
  // 速率限制
  RATE_LIMIT_ENABLED?: string;
  RATE_LIMIT_REQUESTS?: string;
  RATE_LIMIT_WINDOW?: string;
  
  // 防盗链
  ANTI_SCAN_ENABLED?: string;
  ALLOWED_DOMAINS?: string;
  BLOCKED_REFERRERS?: string;
  ALLOWED_REFERRERS?: string;
  OWN_DOMAINS?: string;
  ALLOW_EMPTY_REFERER?: string;
  
  // 缓存
  CACHE_ENABLED?: string;
  CACHE_TTL?: string;
  HOT_FILES?: string;
}

// ==================== 常量 ====================

/** 不可签名的头部列表 */
export const UNSIGNABLE_HEADERS: string[] = [
  'x-forwarded-proto',
  'x-real-ip',
  'accept-encoding',
  'if-match',
  'if-modified-since',
  'if-none-match',
  'if-range',
  'if-unmodified-since',
];

/** HTTPS 协议和端口 */
export const HTTPS_PROTOCOL = "https:";
export const HTTPS_PORT = "443";

/** Range 请求重试次数 */
export const RANGE_RETRY_ATTEMPTS = 3;

// ==================== 类型定义 ====================

/** 路由模式 */
export type RouteMode = 'default' | '$path' | '$host';
