/**
 * 防盗链模块
 * 检查 Referer 头部防止资源盗链
 * 支持通配符域名匹配
 */

import { Env } from "./types";

// ==================== 防盗链配置 ====================

/**
 * 检查是否启用防盗链
 */
export function isAntiScanEnabled(env: Env): boolean {
  return env.ANTI_SCAN_ENABLED === "true";
}

/**
 * 获取允许的域名列表
 */
export function getAllowedDomains(env: Env): string[] {
  if (!env.ALLOWED_DOMAINS) {
    return [];
  }
  return env.ALLOWED_DOMAINS.split(",").map(d => d.trim().toLowerCase());
}

/**
 * 获取阻止的 referrer 列表
 */
export function getBlockedReferrers(env: Env): string[] {
  if (!env.BLOCKED_REFERRERS) {
    return [];
  }
  return env.BLOCKED_REFERRERS.split(",").map(r => r.trim().toLowerCase());
}

/**
 * 获取允许的 referrer 列表
 */
export function getAllowedReferrers(env: Env): string[] {
  if (!env.ALLOWED_REFERRERS) {
    return [];
  }
  return env.ALLOWED_REFERRERS.split(",").map(r => r.trim().toLowerCase());
}

/**
 * 获取配置的域名 (用于 Referer 检查)
 */
export function getOwnDomains(env: Env): string[] {
  if (!env.OWN_DOMAINS) {
    return [];
  }
  return env.OWN_DOMAINS.split(",").map(d => d.trim().toLowerCase());
}

/**
 * 检查域名是否匹配模式 (支持通配符 *)
 * 例如: *.example.com 匹配 sub.example.com 和 example.com
 */
function matchesWildcard(domain: string, pattern: string): boolean {
  // 转换 * 为正则表达式
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*');
  const regex = new RegExp(`^${regexPattern}$`, 'i');
  
  // 首先检查正则匹配
  if (regex.test(domain)) {
    return true;
  }
  
  // 对于 *.example.com 模式，也检查是否只是去掉 * 后的根域名
  // 例如: *.kioihyma.com 也应该匹配 kioihyma.com
  const rootPattern = pattern.replace(/^\*\./, '');
  if (domain === rootPattern) {
    return true;
  }
  
  return false;
}

/**
 * 检查域名是否在列表中 (支持通配符)
 */
function isDomainInList(domain: string, list: string[]): boolean {
  for (const pattern of list) {
    // 精确匹配
    if (domain === pattern) {
      return true;
    }
    // 通配符匹配
    if (pattern.includes('*')) {
      if (matchesWildcard(domain, pattern)) {
        return true;
      }
    }
    // 域名后缀匹配 (例如: example.com 匹配 sub.example.com)
    if (domain.endsWith('.' + pattern)) {
      return true;
    }
  }
  return false;
}

/**
 * 检查请求是否为盗链请求
 */
export function checkAntiScan(request: Request, env: Env): {
  allowed: boolean;
  reason?: string;
} {
  // 如果未启用防盗链，允许所有请求
  if (!isAntiScanEnabled(env)) {
    return { allowed: true };
  }
  
  const referer = request.headers.get("Referer");
  
  // 没有 Referer 头的请求处理
  if (!referer) {
    const allowEmptyReferer = env.ALLOW_EMPTY_REFERER === "true";
    if (!allowEmptyReferer) {
      return { allowed: false, reason: "Missing Referer header" };
    }
    return { allowed: true };
  }
  
  // 解析 Referer URL
  let refererUrl: URL;
  try {
    refererUrl = new URL(referer);
  } catch {
    return { allowed: false, reason: "Invalid Referer header" };
  }
  
  const refererHost = refererUrl.hostname.toLowerCase();
  
  // 检查是否在阻止列表中
  const blockedReferrers = getBlockedReferrers(env);
  for (const blocked of blockedReferrers) {
    if (refererHost.includes(blocked) || blocked === "*") {
      return { allowed: false, reason: "Referer " + refererHost + " is blocked" };
    }
  }
  
  // 检查是否在允许列表中 (支持通配符)
  const allowedReferrers = getAllowedReferrers(env);
  if (allowedReferrers.length > 0) {
    if (!isDomainInList(refererHost, allowedReferrers)) {
      return { allowed: false, reason: "Referer " + refererHost + " is not in allowed list" };
    }
  }
  
  // 检查是否与允许的域名匹配 (支持通配符)
  const allowedDomains = getAllowedDomains(env);
  if (allowedDomains.length > 0) {
    if (!isDomainInList(refererHost, allowedDomains)) {
      return { allowed: false, reason: "Referer " + refererHost + " is not allowed" };
    }
  }
  
  // 检查是否与自己的域名匹配 (支持通配符)
  const ownDomains = getOwnDomains(env);
  if (ownDomains.length > 0) {
    if (isDomainInList(refererHost, ownDomains)) {
      return { allowed: true };
    }
    
    if (allowedReferrers.length === 0 && allowedDomains.length === 0) {
      return { allowed: false, reason: "Invalid referer: " + refererHost };
    }
  }
  
  return { allowed: true };
}

/**
 * 创建防盗链错误响应
 */
export function createAntiScanResponse(reason: string): Response {
  return new Response(JSON.stringify({
    error: "Forbidden",
    details: reason,
  }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}
