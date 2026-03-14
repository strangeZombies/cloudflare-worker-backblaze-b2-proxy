/**
 * 代理模块
 * 核心的 AWS S3 代理逻辑
 * 集成认证、缓存、速率限制和防盗链
 */

import { AwsClient } from "aws4fetch";
import { Env, RANGE_RETRY_ATTEMPTS } from "./types";
import { 
  filterHeaders, 
  buildTargetUrl, 
  isListBucketRequest, 
  isListBucketAllowed 
} from "./config";
import { createHeadResponse, addCorsHeaders } from "./cors";
import { getFromCache, setCache } from "./cache";
import { checkRateLimit, createRateLimitHeaders } from "./rate-limit";
import { checkAntiScan, createAntiScanResponse } from "./anti-scan";

// ==================== 调试模式 ====================

const DEBUG_MODE = false;

/**
 * 获取或创建 AWS 客户端
 * 注意：不使用全局缓存以避免多租户/凭据变更问题
 */
export function getAwsClient(env: Env): AwsClient {
  return new AwsClient({
    accessKeyId: env.B2_APPLICATION_KEY_ID,
    secretAccessKey: env.B2_APPLICATION_KEY,
    service: "s3",
  });
}

// ==================== Range 请求处理 ====================

/**
 * 带重试的 Range 请求
 */
async function fetchWithRangeRetry(
  url: string,
  options: RequestInit,
  isHeadRequest: boolean = false
): Promise<Response> {
  let attempts = RANGE_RETRY_ATTEMPTS;
  let response: Response;
  
  do {
    const controller = new AbortController();
    response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    
    if (response.headers.has("content-range")) {
      if (attempts < RANGE_RETRY_ATTEMPTS) {
        console.log(`Retry for ${url} succeeded - response has content-range header`);
      }
      break;
    } else if (response.ok) {
      attempts -= 1;
      console.error(
        `Range header in request for ${url} but no content-range header in response. Will retry ${attempts} more times`
      );
      if (attempts > 0) {
        controller.abort();
      }
    } else {
      break;
    }
  } while (attempts > 0);
  
  if (attempts <= 0) {
    console.error(
      `Tried range request for ${url} ${RANGE_RETRY_ATTEMPTS} times, but no content-range in response.`
    );
  }
  
  return response!;
}

// ==================== 代理请求 ====================

/**
 * 代理请求到 Backblaze B2
 */
export async function proxyRequest(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  const method = request.method;
  
  // 清理路径
  let path = url.pathname.replace(/^\/+/, "").replace(/\/+$/, "");
  
  // 1. 速率限制检查
  const rateLimitResult = checkRateLimit(request, env);
  if (!rateLimitResult.allowed) {
    const response = new Response(JSON.stringify({
      error: "Too Many Requests",
      details: "Rate limit exceeded. Please try again later.",
    }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(rateLimitResult.resetIn),
      },
    });
    // 添加速率限制头
    const rateLimitHeaders = createRateLimitHeaders(rateLimitResult.remaining, rateLimitResult.resetIn);
    rateLimitHeaders.forEach((v, k) => response.headers.set(k, v));
    return response;
  }
  
  // 2. 防盗链检查
  const antiScanResult = checkAntiScan(request, env);
  if (!antiScanResult.allowed) {
    return createAntiScanResponse(antiScanResult.reason || "Referer not allowed");
  }
  
  // 3. 检查缓存 (GET 请求)
  if (request.method === "GET") {
    const cachedResponse = await getFromCache(request, env);
    if (cachedResponse) {
      // 创建新的响应以添加速率限制头 (缓存响应不可变)
      const rateLimitHeaders = createRateLimitHeaders(rateLimitResult.remaining, rateLimitResult.resetIn);
      const headers = new Headers(cachedResponse.headers);
      rateLimitHeaders.forEach((v, k) => headers.set(k, v));
      
      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers: headers,
      });
    }
  }
  
  // 5. 拒绝 List Bucket 请求
  if (isListBucketRequest(env, path) && !isListBucketAllowed(env)) {
    return new Response(null, {
      status: 404,
      statusText: "Not Found",
    });
  }
  
  // 构建目标 URL
  const targetUrl = buildTargetUrl(url, env, path);
  
  // 调试：仅在调试模式下打印敏感信息
  if (DEBUG_MODE) {
    console.log("Signing URL:", targetUrl.toString());
    console.log("Bucket:", env.BUCKET_NAME, "Endpoint:", env.B2_ENDPOINT);
  }
  
  // 获取 AWS 客户端并过滤头部
  const client = getAwsClient(env);
  const filteredHeaders = filterHeaders(request.headers, env);
  
  // 调试：仅在调试模式下打印过滤后的头部
  if (DEBUG_MODE) {
    console.log("Filtered headers:");
    filteredHeaders.forEach((v, k) => console.log(`  ${k}: ${v}`));
  }
  
  // 保存原始请求方法
  const requestMethod = request.method;
  
  // 签名请求
  const signedRequest = await client.sign(targetUrl.toString(), {
    method: "GET",
    headers: filteredHeaders,
  });
  
  let response: Response;
  
  // 处理 Range 请求
  if (signedRequest.headers.has("range")) {
    response = await fetchWithRangeRetry(
      signedRequest.url,
      {
        method: signedRequest.method,
        headers: signedRequest.headers,
      },
      requestMethod === "HEAD"
    );
    
    if (requestMethod === "HEAD") {
      const headResponse = createHeadResponse(response);
      return addCorsHeaders(headResponse, origin, env);
    }
    
    return addCorsHeaders(response, origin, env);
  } else {
    // 使用 url 和 headers 分别传递，与原始代码一致
    response = await fetch(signedRequest.url, {
      method: signedRequest.method,
      headers: signedRequest.headers,
    });
  }
  
  // HEAD 请求特殊处理
  if (requestMethod === "HEAD") {
    const headResponse = createHeadResponse(response);
    return addCorsHeaders(headResponse, origin, env);
  }
  
  // 添加缓存 (GET 请求)
  const finalResponse = addCorsHeaders(response, origin, env);
  if (request.method === "GET") {
    return await setCache(request, finalResponse, env);
  }
  
  return finalResponse;
}

/**
 * 验证请求方法
 */
export function isAllowedMethod(method: string): boolean {
  return method === "GET" || method === "HEAD";
}
