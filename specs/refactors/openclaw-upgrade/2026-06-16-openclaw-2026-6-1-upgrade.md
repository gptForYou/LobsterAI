# OpenClaw 2026.6.1 升级适配设计文档

## 1. 概述

### 1.1 问题/动机

LobsterAI 当前正在将依赖的 OpenClaw 从 `v2026.4.14` 升级到 `v2026.6.1`。OpenClaw 迭代较快，LobsterAI 历史上对 `v2026.4.14` 维护了一组版本专属 patch，位于：

```text
scripts/patches/v2026.4.14/
```

升级基础版本后，`package.json` 中的 `openclaw.version` 已切换到 `v2026.6.1`。但如果不迁移对应 patch，LobsterAI 仍会写出依赖业务 patch 的配置字段，例如 `cron.skipMissedJobs`、`agents.defaults.cwd`、`agents.list[].cwd`。在未迁移 patch 时，OpenClaw 6.1 网关会在启动阶段拒绝这些字段，报出配置校验失败：

```text
Invalid config ... agents.defaults: Invalid input
cron: Invalid input
```

因此，本次升级不能只改 OpenClaw tag，还需要逐个判断旧 patch 是否仍然需要迁移到：

```text
scripts/patches/v2026.6.1/
```

### 1.2 目标

1. 保持 LobsterAI 可以依赖 `v2026.6.1` 的 OpenClaw runtime 启动网关。
2. 将仍然需要的业务 patch 迁移到 `scripts/patches/v2026.6.1/`。
3. 对每个旧 patch 给出清晰处理状态：已迁移、待处理或不再需要迁移。
4. 在 LobsterAI 侧补充测试，避免再次出现“配置生成依赖某个 patch，但对应版本 patch 未迁移”的问题。

## 2. 现状分析

### 2.1 已完成的基础改动

| 文件 | 改动 | 原因 |
|------|------|------|
| `package.json` | `openclaw.version` 改为 `v2026.6.1` | 切换目标 OpenClaw 版本 |
| `package.json` | Node 要求调整为 `>=24.15.0 <25` | OpenClaw 6.1 依赖要求更高的 Node 24 小版本 |
| `scripts/run-build-openclaw-runtime.cjs` | 设置 `CI=true` | 避免 pnpm 在非交互环境下因确认提示失败 |
| `scripts/build-openclaw-runtime.sh` | 复用 runtime 前检查 `node_modules`、`gateway.asar`、`dist/control-ui/index.html` | 防止构建中断后仅凭 `runtime-build-info.json` 误判 runtime 已完整 |

### 2.2 当前已迁移的 patch

当前 `scripts/patches/v2026.6.1/` 中已有：

```text
openclaw-cron-skip-missed-jobs.patch
openclaw-chat-send-cwd-decoupling.patch
openclaw-im-bound-agent-run-cwd.patch
openclaw-browser-blocked-hostnames.patch
```

这些 patch 解决了本轮升级中暴露的业务字段兼容问题：

| 字段 | 所属 patch | 作用 |
|------|------------|------|
| `cron.skipMissedJobs` | `openclaw-cron-skip-missed-jobs.patch` | 启动时跳过离线期间错过的定时任务，不进行 catch-up replay |
| `chat.send.cwd` | `openclaw-chat-send-cwd-decoupling.patch` | 允许 LobsterAI 在 `chat.send` 请求中携带业务工作目录，并继续传递给 agent run |
| `agents.defaults.cwd` / `agents.list[].cwd` | `openclaw-im-bound-agent-run-cwd.patch` | 让 agent run 使用 LobsterAI 配置的业务工作目录，而不是只使用 OpenClaw workspace |
| `browser.ssrfPolicy.blockedHostnames` | `openclaw-browser-blocked-hostnames.patch` | 让浏览器访问控制支持 LobsterAI 配置的 hostname blocklist，并在 DNS 查询前阻断命中目标 |

### 2.3 已补充的 LobsterAI 侧测试

| 测试文件 | 覆盖内容 |
|----------|----------|
| `src/main/libs/openclawConfigSync.runtime.test.ts` | 验证配置同步仍会写出 patch 依赖字段：`cron.skipMissedJobs`、`agents.defaults.cwd`、`agents.list[].cwd`、`browser.ssrfPolicy.blockedHostnames`；同时确认不再写出旧的 `tools.web.fetch.useEnvProxy` / `useTrustedEnvProxy` |
| `src/main/libs/openclawPatches/` | 验证当前 `package.json` pinned 的 OpenClaw 版本目录下存在必要 runtime patch；按 patch 拆分测试文件 |

## 3. Patch 迁移状态

状态说明：

| 状态 | 含义 |
|------|------|
| 已迁移 | 已在 `scripts/patches/v2026.6.1/` 中建立对应 patch，并通过当前验证 |
| 待处理 | 仍需判断是否需要迁移；如需要，还需适配 6.1 源码并验证 |
| 不再需要迁移 | 经确认，OpenClaw 6.1 已内置等价能力，或 LobsterAI 不再依赖该 patch |

> 截至 2026-06-16，本轮已确认 `openclaw-browser-duplicate-launch.patch` 与 `openclaw-web-fetch-env-proxy.patch` 不再需要迁移：前者已由 OpenClaw 6.1 上游实现覆盖，后者已由 OpenClaw 6.1 的新配置 `tools.web.fetch.useTrustedEnvProxy` 覆盖，且 LobsterAI 当前不再写出旧字段。

| v2026.4.14 patch | 当前状态 | 处理方式 / 说明 |
|------------------|----------|-----------------|
| `openclaw-aborted-tool-loop-breaker.patch` | 待处理 | 尚未评估；需确认 6.1 是否仍存在 aborted tool loop 问题 |
| `openclaw-browser-blocked-hostnames.patch` | 已迁移 | 已迁移到 `v2026.6.1`；6.1 原生 schema 仅支持 `allowedHostnames` / `hostnameAllowlist`，本补丁补回 `blockedHostnames` 类型、schema、浏览器配置归一化、SSRF policy 比较/合并与 DNS 前阻断测试 |
| `openclaw-browser-duplicate-launch.patch` | 不再需要迁移 | OpenClaw 6.1 已在 `server-context.availability.ts` 中通过 `profileState.ensureBrowserAvailable` 串行化同 profile 的并发 ensure，并已有 `server-context.ensure-browser-available.waits-for-cdp-ready.test.ts` 覆盖并发复用场景 |
| `openclaw-chat-send-cwd-decoupling.patch` | 已迁移 | 已迁移到 `v2026.6.1`；6.1 将协议 schema 移至 `packages/gateway-protocol`，本次适配让 `ChatSendParamsSchema` 接受 `cwd`，并由 `chat.send` handler 传入 `replyOptions.cwd` |
| `openclaw-chat-send-image-attachment-30mb.patch` | 待处理 | 尚未评估；需确认 6.1 对 chat.send 图片附件大小限制是否仍需放宽 |
| `openclaw-codex-use-native-transport.patch` | 待处理 | 尚未评估；需确认 6.1 Codex transport 实现是否仍需 LobsterAI 定制 |
| `openclaw-cron-skip-missed-jobs.patch` | 已迁移 | 已迁移到 `v2026.6.1`；让 schema 和 cron runtime 支持 `cron.skipMissedJobs` |
| `openclaw-deepseek-mimo-reasoning-replay.patch` | 待处理 | 尚未评估；需确认 6.1 reasoning replay 行为是否仍需修补 |
| `openclaw-deepseek-v4-thinking-mode.patch` | 待处理 | 尚未评估；需确认 DeepSeek V4 thinking mode 支持是否已由上游覆盖 |
| `openclaw-disable-model-pricing-bootstrap.patch` | 待处理 | 尚未评估；需确认 6.1 是否仍有启动阶段 pricing bootstrap 延迟问题 |
| `openclaw-empty-sse-data.patch` | 待处理 | 尚未评估；需确认 6.1 SSE 空 data 处理是否已修复 |
| `openclaw-extra-body-passthrough.patch` | 待处理 | 尚未评估；需确认 OpenAI-compatible extra_body 透传是否仍需 patch |
| `openclaw-facade-runtime-static-import.patch` | 待处理 | 尚未评估；需确认 6.1 bundle/运行时是否仍需 static import 规避问题 |
| `openclaw-gateway-startup-profiler.patch` | 待处理 | 尚未评估；偏诊断能力，需判断是否仍要保留 |
| `openclaw-im-bound-agent-run-cwd.patch` | 已迁移 | 已迁移到 `v2026.6.1`；让 schema 和 reply runtime 支持 agent run cwd |
| `openclaw-jiti-alias-prenormalize.patch` | 待处理 | 尚未评估；需确认 6.1 jiti alias 解析是否仍需预归一化 |
| `openclaw-mcp-shared-runtime.patch` | 待处理 | 尚未评估；需确认 MCP runtime 复用需求是否仍存在 |
| `openclaw-mcp-stdio-process-tree-kill.patch` | 待处理 | 尚未评估；需确认 stdio MCP 进程树清理是否仍需补丁 |
| `openclaw-memory-atomic-reindex-ebusy-retry.patch` | 待处理 | 尚未评估；需确认 Windows EBUSY retry 是否已由上游覆盖 |
| `openclaw-qwen-coding-plan-qwen36-plus.patch` | 待处理 | 尚未评估；需确认 Qwen 3.6 Plus coding plan 支持是否仍需定制 |
| `openclaw-qwen-vision-catalog-fallback.patch` | 待处理 | 尚未评估；需确认 Qwen vision catalog fallback 是否仍需 patch |
| `openclaw-skip-derive-prompt-segments-deadloop.patch` | 待处理 | 尚未评估；需确认 derivePromptSegments 死循环问题是否仍存在 |
| `openclaw-subagent-cleanup-finalize-best-effort.patch` | 待处理 | 尚未评估；需确认 subagent cleanup/finalize 失败是否仍会影响主流程 |
| `openclaw-web-fetch-env-proxy.patch` | 不再需要迁移 | 旧补丁字段为 `tools.web.fetch.useEnvProxy`；OpenClaw 6.1 已提供 `tools.web.fetch.useTrustedEnvProxy`、cache key 隔离和 env proxy dispatcher 测试。LobsterAI 当前配置同步不再写出旧字段，也不自动写出新字段 |
| `openclaw-widen-incomplete-turn-retry-guard.patch` | 待处理 | 尚未评估；需确认 incomplete turn retry guard 是否仍需放宽 |
| `zz-openclaw-first-response-timing-logs.patch` | 待处理 | 尚未评估；偏诊断日志，需判断是否仍要保留 |

## 4. 实施步骤

### 4.1 已完成

1. 将 OpenClaw pinned version 切换到 `v2026.6.1`。
2. 调整 Node 版本要求为 `>=24.15.0 <25`。
3. 迁移 `openclaw-cron-skip-missed-jobs.patch`。
4. 迁移 `openclaw-im-bound-agent-run-cwd.patch`。
5. 迁移 `openclaw-chat-send-cwd-decoupling.patch`，修复 `chat.send` 携带 `cwd` 时被协议校验拒绝的问题。
6. 在 LobsterAI 侧补充 patch 存在性和配置输出测试。
7. 修复 runtime 构建复用时对残缺产物的误判。
8. 重新构建 host runtime，确认 `node_modules`、`gateway.asar`、`dist/control-ui/index.html` 都存在。
9. 迁移 `openclaw-browser-blocked-hostnames.patch`，补齐浏览器 SSRF blocklist 配置链路。
10. 确认 `openclaw-browser-duplicate-launch.patch`、`openclaw-web-fetch-env-proxy.patch` 不再需要迁移，并补充 LobsterAI 侧决策测试。

### 4.2 待处理

1. 按表格顺序逐个评估其余 `v2026.4.14` patch。
2. 对每个 patch 给出明确结论：
   - 需要迁移：适配 6.1 源码，生成 `v2026.6.1` patch，补必要测试。
   - 不再需要迁移：记录上游已覆盖或业务不再依赖的证据。
   - 暂缓：记录原因和风险。
3. 每迁移一批 patch 后执行：

```bash
npm run openclaw:patch
npm run openclaw:runtime:host
npx vitest run src/main/libs/openclawPatches src/main/libs/openclawConfigSync.runtime.test.ts
npm run build
```

## 5. 涉及文件

| 文件 / 目录 | 说明 |
|-------------|------|
| `package.json` | OpenClaw 版本与 Node 版本要求 |
| `scripts/patches/v2026.4.14/` | 旧版本 patch 来源 |
| `scripts/patches/v2026.6.1/` | 新版本 patch 目标目录 |
| `scripts/run-build-openclaw-runtime.cjs` | OpenClaw runtime 构建入口适配 |
| `scripts/build-openclaw-runtime.sh` | runtime 构建与完整性检查 |
| `src/main/libs/openclawConfigSync.ts` | LobsterAI 生成 OpenClaw 配置的核心逻辑 |
| `src/main/libs/openclawConfigSync.runtime.test.ts` | 配置输出测试 |
| `src/main/libs/openclawPatches/` | pinned OpenClaw 版本 patch 覆盖测试 |

## 6. 验证计划

当前已完成验证：

```bash
npm run openclaw:patch
npx vitest run src/main/libs/openclawPatches src/main/libs/openclawConfigSync.runtime.test.ts
npm run openclaw:runtime:host
npm run build
```

本轮 browser/web access 补丁迁移额外验证：

```bash
npm run openclaw:patch
npx vitest run src/main/libs/openclawPatches src/main/libs/openclawConfigSync.runtime.test.ts
```

结果：

| 命令 | 结果 | 说明 |
|------|------|------|
| `npm run openclaw:patch` | 通过 | 从干净 OpenClaw 6.1 源码重置后，4 个 `v2026.6.1` patch 均成功应用 |
| `npx vitest run src/main/libs/openclawPatches src/main/libs/openclawConfigSync.runtime.test.ts` | 通过 | 6 个测试文件、30 个用例通过 |
| `node_modules/.bin/vitest.cmd run src/infra/net/ssrf.pinning.test.ts --reporter verbose --testTimeout=10000 --pool forks`（OpenClaw 侧） | 未完成 | 在当前 Windows 会话中 90 秒无输出超时；本次先以 `openclaw:patch` 与 LobsterAI 侧测试作为有效验证，后续如需可在 OpenClaw 独立环境继续跑目标测试 |

后续每迁移一个 patch，应至少完成：

1. `npm run openclaw:patch`：确认 patch 可从干净 OpenClaw 6.1 源码应用。
2. `npm run openclaw:runtime:host`：确认 runtime 可完整生成。
3. 针对 patch 行为补 LobsterAI 侧测试或 OpenClaw 侧临时验证。
4. `npm run build`：确认 LobsterAI TypeScript/Vite 构建仍通过。
