#  Cloudflare Worker for Backblaze B2

[English](#english) | [中文](#中文)

---

## 中文

一个高性能的 Cloudflare Worker，用于通过 Cloudflare 安全访问私有 Backblaze B2 存储桶。支持文件代理、CORS、缓存、速率限制和防盗链功能。

### 功能特性

- **CORS 跨域访问**: 完整的跨域资源共享支持
- **速率限制**: 基于 IP 的请求频率控制
- **防盗链**: 基于 Referer 的反扫描保护
- **Range 流媒体**: 支持视频音频流式传输
- **缓存集成**: Cloudflare Cache API 集成
- **热门文件缓存**: 热门文件可配置更长的缓存时间
- **签名下载**: 支持生成签名 URL 进行下载

### 项目结构

```
src/
├── index.ts       # 主入口，请求处理流程
├── types.ts       # TypeScript 类型定义
├── config.ts      # 配置管理模块
├── cors.ts        # CORS 跨域处理
├── rate-limit.ts  # 速率限制
├── anti-scan.ts   # 防盗链
├── cache.ts       # 缓存
├── proxy.ts       # 核心代理逻辑
└── signed-url.ts  # 签名 URL 处理
```

### 快速开始

#### 安装依赖

```bash
yarn install
```

#### 开发模式

```bash
yarn dev
```

#### 部署

```bash
yarn deploy
```

### 配置

所有配置通过 `wrangler.toml` 的 `[vars]` 区域配置：

#### 必填配置

| 变量 | 描述 |
|------|------|
| `BUCKET_NAME` | B2 存储桶名称（支持 `$path`, `$host`, 或具体桶名） |
| `B2_ENDPOINT` | S3 端点地址 |
| `B2_APPLICATION_KEY_ID` | 应用 Key ID |
| `B2_APPLICATION_KEY` | 应用 Key（secret） |

#### 可选配置

| 变量 | 描述 | 默认值 |
|------|------|--------|
| `CORS_ALLOWED_ORIGINS` | 允许的 CORS 来源（逗号分隔） | 无（拒绝所有） |
| `ALLOW_LIST_BUCKET` | 是否允许列出存储桶内容 | false |
| `RCLONE_DOWNLOAD` | 是否使用 Rclone 下载模式 | false |
| `CACHE_ENABLED` | 是否启用缓存 | false（无默认值） |
| `CACHE_TTL` | 缓存时间（秒） | - |
| `HOT_FILES` | 热门文件列表（逗号分隔，这些文件会缓存 24 小时） | - |
| `RATE_LIMIT_ENABLED` | 是否启用速率限制 | false（无默认值） |
| `RATE_LIMIT_REQUESTS` | 速率限制次数 | - |
| `RATE_LIMIT_WINDOW` | 速率限制窗口（秒） | - |
| `ANTI_SCAN_ENABLED` | 是否启用防盗链 | false（无默认值） |
| `ALLOWED_DOMAINS` | 允许访问的域名列表（逗号分隔，支持通配符 *） | - |
| `BLOCKED_REFERRERS` | 阻止的 Referer 列表（逗号分隔） | - |
| `ALLOWED_REFERRERS` | 允许的 Referer 列表（逗号分隔） | - |
| `OWN_DOMAINS` | 自己的域名列表（逗号分隔，支持通配符 *） | - |
| `ALLOW_EMPTY_REFERER` | 是否允许空的 Referer 头 | - |
| `CDN_SIGNING_SECRET` | 签名 URL 密钥（用于生成签名下载链接） | - |

> **注意**: 本项目不包含默认配置，所有配置项必须通过 `wrangler.toml` 的 `[vars]` 显式设置。

#### 路由模式

支持三种路由模式：

1. **默认模式**: `BUCKET_NAME = "my-bucket"`
   - 所有请求指向指定存储桶

2. **$path 模式**: `BUCKET_NAME = "$path"`
   - 使用 URL 路径第一段作为存储桶名
   - 例: `https://domain.com/bucket-name/file.mp4`

3. **$host 模式**: `BUCKET_NAME = "$host"`
   - 使用子域名作为存储桶名
   - 例: `https://bucket-name.domain.com/file.mp4`

### 签名下载

使用 `CDN_SIGNING_SECRET` 配置签名密钥后，可以生成签名 URL：

```
https://your-domain.com/file.mp4?exp=1735689600&sig=xxx
```

参数说明：
- `exp`: 过期时间戳（Unix 秒）
- `sig`: 使用 `CDN_SIGNING_SECRET` 生成签名

### API

#### 请求

```
GET /<path-to-file>
HEAD /<path-to-file>
OPTIONS /<path-to-file>
```

#### 响应

- `200 OK`: 成功返回文件
- `204 No Content`: CORS 预检请求
- `403 Forbidden`: 禁止访问（防盗链/跨域拒绝）
- `404 Not Found`: 文件不存在
- `429 Too Many Requests`: 超过速率限制

### 许可证

MIT License

---

## English

A high-performance Cloudflare Worker for securely accessing private Backblaze B2 storage buckets through Cloudflare. Supports file proxying, CORS, caching, rate limiting, and anti-hotlinking.

### Features

- **CORS Support**: Full Cross-Origin Resource Sharing support
- **Rate Limiting**: IP-based request frequency control
- **Anti-Hotlinking**: Referer-based anti-scan protection
- **Range Streaming**: Video/audio streaming support
- **Caching**: Cloudflare Cache API integration
- **Hot File Caching**: Configurable longer cache time for popular files
- **Signed Downloads**: Generate signed URLs for downloads

### Project Structure

```
src/
├── index.ts       # Main entry, request handling
├── types.ts       # TypeScript type definitions
├── config.ts      # Configuration management
├── cors.ts        # CORS handling
├── rate-limit.ts  # Rate limiting
├── anti-scan.ts   # Anti-hotlinking
├── cache.ts       # Caching
├── proxy.ts       # Core proxy logic
└── signed-url.ts  # Signed URL handling
```

### Quick Start

#### Install Dependencies

```bash
yarn install
```

#### Development Mode

```bash
yarn dev
```

#### Deploy

```bash
yarn deploy
```

### Configuration

All configuration is done through the `[vars]` section in `wrangler.toml`:

#### Required Configuration

| Variable | Description |
|----------|-------------|
| `BUCKET_NAME` | B2 bucket name (supports `$path`, `$host`, or specific bucket name) |
| `B2_ENDPOINT` | S3 endpoint address |
| `B2_APPLICATION_KEY_ID` | Application Key ID |
| `B2_APPLICATION_KEY` | Application Key (secret) |

#### Optional Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `CORS_ALLOWED_ORIGINS` | Allowed CORS origins (comma-separated) | None (deny all) |
| `ALLOW_LIST_BUCKET` | Allow listing bucket contents | false |
| `RCLONE_DOWNLOAD` | Use Rclone download mode | false |
| `CACHE_ENABLED` | Enable caching | false (no default) |
| `CACHE_TTL` | Cache time in seconds | - |
| `HOT_FILES` | Hot file list (comma-separated, cached for 24 hours) | - |
| `RATE_LIMIT_ENABLED` | Enable rate limiting | false (no default) |
| `RATE_LIMIT_REQUESTS` | Rate limit requests | - |
| `RATE_LIMIT_WINDOW` | Rate limit window (seconds) | - |
| `ANTI_SCAN_ENABLED` | Enable anti-hotlinking | false (no default) |
| `ALLOWED_DOMAINS` | Allowed domains (comma-separated, supports wildcard *) | - |
| `BLOCKED_REFERRERS` | Blocked referrers (comma-separated) | - |
| `ALLOWED_REFERRERS` | Allowed referrers (comma-separated) | - |
| `OWN_DOMAINS` | Own domains (comma-separated, supports wildcard *) | - |
| `ALLOW_EMPTY_REFERER` | Allow empty Referer header | - |
| `CDN_SIGNING_SECRET` | Signed URL secret (for generating signed download links) | - |

> **Note**: This project does not include default values. All configuration must be explicitly set in the `[vars]` section of `wrangler.toml`.

#### Routing Modes

Three routing modes are supported:

1. **Default Mode**: `BUCKET_NAME = "my-bucket"`
   - All requests point to the specified bucket

2. **$path Mode**: `BUCKET_NAME = "$path"`
   - Use the first segment of URL path as bucket name
   - Example: `https://domain.com/bucket-name/file.mp4`

3. **$host Mode**: `BUCKET_NAME = "$host"`
   - Use subdomain as bucket name
   - Example: `https://bucket-name.domain.com/file.mp4`

### Signed Downloads

After configuring `CDN_SIGNING_SECRET`, you can generate signed URLs:

```
https://your-domain.com/file.mp4?exp=1735689600&sig=xxx
```

Parameters:
- `exp`: Expiration timestamp (Unix seconds)
- `sig`: Signature generated using `CDN_SIGNING_SECRET`

### API

#### Requests

```
GET /<path-to-file>
HEAD /<path-to-file>
OPTIONS /<path-to-file>
```

#### Responses

- `200 OK`: File returned successfully
- `204 No Content`: CORS preflight request
- `403 Forbidden`: Access denied (anti-hotlinking/CORS rejection)
- `404 Not Found`: File not found
- `429 Too Many Requests`: Rate limit exceeded

### License

MIT License
