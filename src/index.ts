/**
 * Cloudflare Worker 主入口
 * Backblaze B2 S3 代理服务
 * 
 * 模块化重构 - 基于原 index.js 的功能
 */

import { Env } from "./types";
import { handlePreflightRequest } from "./cors";
import { proxyRequest, isAllowedMethod } from "./proxy";
import { handleSignedUrlRequest, isSignedUrlRequest } from "./signed-url";

// ==================== 主入口 ====================

export default {
  /**
   * Cloudflare Worker fetch 事件处理
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // 1. 处理 CORS 预检请求
    const preflightResponse = handlePreflightRequest(request, env);
    if (preflightResponse) {
      return preflightResponse;
    }
    
    // 2. 签名 URL 请求处理
    if (isSignedUrlRequest(request)) {
      try {
        return await handleSignedUrlRequest(request, env);
      } catch (error) {
        console.error("Signed URL request failed:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        return new Response(JSON.stringify({ error: "Internal Server Error", details: message }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        });
      }
    }
    
    // 3. 验证请求方法
    if (!isAllowedMethod(request.method)) {
      return new Response(null, {
        status: 405,
        statusText: "Method Not Allowed",
      });
    }
    
    // 4. 代理请求到 B2
    try {
      return await proxyRequest(request, env);
    } catch (error) {
      console.error("Proxy request failed:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return new Response(JSON.stringify({ error: "Internal Server Error", details: message }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
  },
};
