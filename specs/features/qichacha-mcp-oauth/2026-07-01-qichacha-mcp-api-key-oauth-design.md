# 企查查 MCP 内置授权设计文档

## 1. 概述

### 1.1 背景

企查查提供两类 MCP 授权方式：

- OAuth 2.0 Authorization Code + PKCE：返回短期 `access_token` 和轮换式 `refresh_token`，可直接以 Bearer token 调用 MCP resource。
- 官网 API Key 配置：官网登录后在接入指南/个人中心展示长期 API Key，MCP 配置使用 `Authorization: Bearer <API Key>`。

LobsterAI 的目标是内置企查查 MCP，让用户通过一次登录授权自动完成 MCP 配置，而不是手动复制 JSON。

### 1.2 目标

- 在 MCP 市场提供“企查查”内置入口。
- 用户点击后打开企查查授权登录窗口。
- 登录成功后自动获取官网 API Key。
- 自动配置企查查 6 个 HTTP MCP server。
- 不保存 OAuth `access_token` / `refresh_token`，不维护 refresh 状态机。

## 2. 用户场景

### 场景 1: 首次安装企查查 MCP

**Given** 用户尚未配置企查查 MCP  
**When** 用户在 MCP 市场点击企查查“登录授权”  
**Then** LobsterAI 打开企查查登录窗口，并在登录完成后自动创建 6 个 MCP server。

### 场景 2: 更新 API Key

**Given** 用户已安装企查查 MCP，但服务端提示 token 无效  
**When** 用户在 MCP 市场点击企查查“重新授权”  
**Then** LobsterAI 重新获取 API Key，并更新已有 6 个 MCP server 的 Authorization header。

## 3. 功能需求

### FR-1: 内置市场入口

企查查作为 Data & API 分类下的特殊 registry entry 展示。该 entry 不进入通用 MCP 表单，而是走专用授权流程。

### FR-2: 授权窗口

主进程动态注册企查查 OAuth client，打开 `https://agent.qcc.com/oauth/authorize`。该页面会在用户未登录时跳转到官网登录页，登录后回到授权页。

### FR-3: API Key 获取

授权页面登录完成后，页面 localStorage 中会出现官网登录 JWT。LobsterAI 在同一 BrowserWindow 上下文中调用：

- `/api/user/info`
- `/api/user-credit/credit`

从响应 `data.token` 读取官网 API Key。实际探针验证显示该 token 形态为 `MAX...`，与官网接入指南展示的 MCP Bearer Token 一致。

### FR-4: MCP 配置写入

获取 API Key 后，创建或更新以下 HTTP MCP server：

- `qcc-company`: `https://agent.qcc.com/mcp/company/stream`
- `qcc-risk`: `https://agent.qcc.com/mcp/risk/stream`
- `qcc-ipr`: `https://agent.qcc.com/mcp/ipr/stream`
- `qcc-operation`: `https://agent.qcc.com/mcp/operation/stream`
- `qcc-executive`: `https://agent.qcc.com/mcp/executive/stream`
- `qcc-history`: `https://agent.qcc.com/mcp/history/stream`

每个 server 写入：

```json
{
  "headers": {
    "Authorization": "Bearer <API Key>"
  }
}
```

## 4. 实现方案

### 4.1 不维护 refresh token

不选择 OAuth `access_token + refresh_token` 作为最终 MCP 配置凭证，原因：

1. OAuth `access_token` 有效期为 3600 秒，必须维护 refresh。
2. 文档要求 refresh token 轮换，刷新成功后旧 refresh token 立即失效，需要原子更新和并发控制。
3. MCP server header 写入 OpenClaw config 后，短期 token 刷新会牵涉配置更新和连接重建，复杂度高。
4. 企查查官网接入指南明确提供 API Key 模式，CLI 和 MCP 共用同一套 API Key，符合“一次登录，长期配置”的产品预期。
5. 实测 OAuth access token 可直接调 MCP，但不能调用 `/api/user-credit/credit` 换取 API Key；官网 API Key 来自网页登录态接口。

因此采用“OAuth authorize 页面完成登录/授权，读取官网登录态下的 API Key，再写静态 MCP 配置”的路线。

### 4.2 主进程

- `src/main/mcp/qichachaMcpAuth.ts`：负责动态注册 client、打开授权窗口、轮询页面接口并返回 API Key。
- `src/main/ipcHandlers/mcp/handlers.ts`：新增 `mcp:qichachaConnect`，拿到 API Key 后 upsert 6 个 MCP server。

### 4.3 Renderer

- `src/renderer/data/mcpRegistry.ts`：新增企查查特殊 registry entry。
- `src/renderer/components/mcp/McpManager.tsx`：识别 `oauthProvider: 'qichacha'`，点击后调用专用 IPC。

## 5. 边界情况

| 场景 | 处理方式 |
| --- | --- |
| 用户关闭授权窗口 | 返回失败，提示授权未完成 |
| 登录超时 | 5 分钟后失败 |
| 页面接口未返回 `data.token` | 保持轮询直到超时 |
| 已安装后重新授权 | 按 server name 更新现有 `registryId=qichacha` 的 server |
| 历史存档 server 未认证 | 仍写入配置，由企查查服务端在调用时返回权限/认证错误 |
| API Key 后续失效 | 用户通过“重新授权”更新静态配置 |

## 6. 涉及文件

- `src/shared/mcp/constants.ts`
- `src/main/mcp/qichachaMcpAuth.ts`
- `src/main/ipcHandlers/mcp/handlers.ts`
- `src/main/preload.ts`
- `src/renderer/types/electron.d.ts`
- `src/renderer/types/mcp.ts`
- `src/renderer/services/mcp.ts`
- `src/renderer/data/mcpRegistry.ts`
- `src/renderer/components/mcp/McpManager.tsx`
- `src/renderer/services/i18n.ts`

## 7. 验收标准

- MCP 市场展示企查查入口。
- 点击后能打开企查查授权窗口。
- 登录后自动写入 6 个企查查 MCP server。
- OpenClaw config sync 后 `mcp.servers` 包含企查查 HTTP server 和 Authorization header。
- 不保存 OAuth refresh token，不启动 token refresh 任务。
