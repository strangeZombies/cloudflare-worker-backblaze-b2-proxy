/**
 * 签名 URL 模块
 * 用于生成带有过期时间的下载链接
 * 
 * 使用 HMAC-SHA256 签名
 */

import { Env } from "./types";

// ==================== 签名配置 ====================

/** 默认签名有效期 (1小时) */
const DEFAULT_EXPIRATION = 3600;

/** 最长有效期 (7天) */
const MAX_EXPIRATION = 604800;

/**
 * 检查是否启用了签名功能
 */
export function isSigningEnabled(env: Env): boolean {
  return !!env.CDN_SIGNING_SECRET;
}

/**
 * 生成签名
 */
async function generateSignature(secret: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);
  
  // 使用简单的 HMAC-SHA256 实现
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  
  // 转换为 base64url
  const bytes = new Uint8Array(signature);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * 验证签名
 */
async function verifySignature(secret: string, data: string, signature: string): Promise<boolean> {
  const expectedSignature = await generateSignature(secret, data);
  return expectedSignature === signature;
}

/**
 * 生成签名 URL
 * 
 * @param env 环境变量
 * @param path 文件路径
 * @param expires 过期时间戳 (秒)
 * @returns 签名的 URL
 */
export async function createSignedUrl(
  env: Env,
  path: string,
  expires: number
): Promise<string> {
  const secret = env.CDN_SIGNING_SECRET;
  if (!secret) {
    throw new Error("CDN_SIGNING_SECRET not configured");
  }
  
  // 生成签名字符串: path + expires
  const dataToSign = `${path}:${expires}`;
  const signature = await generateSignature(secret, dataToSign);
  
  // 构建 URL
  const url = new URL(path, `https://${env.BUCKET_NAME}.${env.B2_ENDPOINT}`);
  url.searchParams.set("X-Amz-Expires", String(expires));
  url.searchParams.set("X-Amz-Signature", signature);
  
  // 添加一些必要的头部参数
  url.searchParams.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
  
  return url.toString();
}

/**
 * 验证签名 URL
 * 
 * @returns { valid: boolean, path?: string, error?: string }
 */
export async function verifySignedUrl(
  env: Env,
  url: URL
): Promise<{ valid: boolean; path?: string; error?: string }> {
  const secret = env.CDN_SIGNING_SECRET;
  if (!secret) {
    return { valid: false, error: "Signing not enabled" };
  }
  
  // 提取参数
  const signature = url.searchParams.get("X-Amz-Signature");
  const expires = url.searchParams.get("X-Amz-Expires");
  
  if (!signature || !expires) {
    return { valid: false, error: "Missing signature parameters" };
  }
  
  // 检查是否过期
  const expiresNum = parseInt(expires, 10);
  const now = Math.floor(Date.now() / 1000);
  if (expiresNum < now) {
    return { valid: false, error: "URL expired" };
  }
  
  // 验证签名
  const path = url.pathname;
  const dataToSign = `${path}:${expires}`;
  const isValid = await verifySignature(secret, dataToSign, signature);
  
  if (!isValid) {
    return { valid: false, error: "Invalid signature" };
  }
  
  return { valid: true, path };
}

/**
 * 处理签名请求
 * 生成带有签名的下载 URL
 */
export async function handleSignedUrlRequest(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.searchParams.get("path");
  const expiresParam = url.searchParams.get("expires");
  
  if (!path) {
    return new Response(JSON.stringify({
      error: "Missing required parameter: path"
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  
  // 解析过期时间
  let expires: number;
  if (expiresParam) {
    expires = parseInt(expiresParam, 10);
    if (isNaN(expires) || expires < 1 || expires > MAX_EXPIRATION) {
      return new Response(JSON.stringify({
        error: `Invalid expires parameter. Must be between 1 and ${MAX_EXPIRATION} seconds`
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
  } else {
    expires = DEFAULT_EXPIRATION;
  }
  
  // 计算过期时间戳
  const expiresAt = Math.floor(Date.now() / 1000) + expires;
  
  try {
    const signedUrl = await createSignedUrl(env, path, expiresAt);
    
    return new Response(JSON.stringify({
      url: signedUrl,
      expires: expiresAt,
      expiresIn: expires
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({
      error: "Failed to generate signed URL",
      details: message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

/**
 * 检查请求是否为签名 URL 请求
 */
export function isSignedUrlRequest(request: Request): boolean {
  const url = new URL(request.url);
  return url.pathname === "/signed" || url.pathname === "/sign";
}
