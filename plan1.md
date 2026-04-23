项目不再使用Vercel AI Gateway，而是都使用openai兼容接口

# 统一移除 Vercel AI Gateway，全部改走 OpenAI-Compatible 接口

## Summary

把当前 AI provider 选择逻辑收敛成单一路径：无论用户在 UI 里选择 `openai/gpt-5.4`、`moonshotai/...`、`anthropic/...` 还是 `google/...`，后端都统一通过 `@ai-sdk/openai` 客户端，使用同一套 `OPENAI_BASE_URL` / `OPENAI_API_KEY` 发请求；彻底移除 `AI_GATEWAY_API_KEY` 对运行时行为的影响，并修正生成接口的错误透传，避免再次出现“后端鉴权失败但前端只显示 Failed to generate recreation”的假成功。

## Key Changes

- 重构 provider 解析逻辑
  - 修改 [provider-manager.ts](/Volumes/T9/open-lovable/lib/ai/provider-manager.ts)，删除 `AI_GATEWAY_API_KEY`、`aiGatewayBaseURL`、`isUsingAIGateway` 分支。
  - 删除 `@ai-sdk/anthropic`、`@ai-sdk/google`、`@ai-sdk/groq` 的运行时路由使用，统一返回 `createOpenAI({ apiKey: OPENAI_API_KEY, baseURL: OPENAI_BASE_URL || defaultOpenAICompatibleBaseURL })`。
  - 保留现有模型 ID 和 UI 展示名，不改动 `availableModels` 的用户可见选择；`getProviderForModel()` 仍解析出 `actualModel`，但所有模型都映射到同一个 OpenAI-compatible client。
  - `ProviderResolution.provider` 统一收敛为 `openai`，日志文案也同步改成“OpenAI-compatible”。

- 清理配置与环境变量语义
  - 更新 [config/app.config.ts](/Volumes/T9/open-lovable/config/app.config.ts) 注释与 `modelDisplayNames` 文案，使其不再暗示 Groq / Anthropic / Google 直连。
  - 更新 `.env.example`、README、脚手架模板中的环境变量说明，明确运行时只依赖 `OPENAI_API_KEY` 与 `OPENAI_BASE_URL`。
  - `ANTHROPIC_API_KEY`、`GEMINI_API_KEY`、`GROQ_API_KEY`、`AI_GATEWAY_API_KEY` 从主文档和模板默认配置中移除，或改为“已废弃/不再使用”的迁移说明，不再作为必填项出现。

- 修复生成失败时的错误传播
  - 修改 [app/api/generate-ai-code-stream/route.ts](/Volumes/T9/open-lovable/app/api/generate-ai-code-stream/route.ts)，当 `streamText()` 初始化失败或流式生成没有任何 `generatedCode` 时，不再发送空的 `type: complete`。
  - 在 SSE 中优先发送明确的 `type: error`，错误信息直接包含上游返回的鉴权/模型/网络原因。
  - 前端生成页保持现有 `generatedCode` 判空保护，但优先消费并展示后端真实错误，避免把所有失败都折叠成 `Failed to generate recreation`。

- 兼容当前模型选择器行为
  - 保留现有模型下拉与 URL 参数行为，不要求用户切换历史链接或现有默认模型。
  - 仅改变“这些模型如何发出去”，不改变前端页面结构、交互和当前默认模型 `openai/gpt-5.4`。

## Public Interfaces / Config Changes

- 运行时保留并继续使用：
  - `OPENAI_API_KEY`
  - `OPENAI_BASE_URL`
- 弃用并从主路径移除：
  - `AI_GATEWAY_API_KEY`
  - `ANTHROPIC_API_KEY`
  - `GEMINI_API_KEY`
  - `GROQ_API_KEY`
- 行为约定：
  - 所有模型 ID 继续可选，但它们必须能被目标 OpenAI-compatible 网关识别；如果网关不支持某个模型，直接把上游错误返回到前端。

## Test Plan

- Provider 解析
  - 选择 `openai/gpt-5.4`、`moonshotai/kimi-k2-instruct-0905`、`anthropic/claude-sonnet-4-20250514`、`google/gemini-3-pro-preview` 时，均确认实际使用的是 OpenAI-compatible client。
  - 验证 `actualModel` 传参仍分别是对应模型名，而不是被错误改写。

- 生成成功链路
  - 在只配置 `OPENAI_API_KEY` + `OPENAI_BASE_URL` 的环境下，重新执行 clone 流程，确认抓取成功后能进入代码生成并返回非空 `generatedCode`。
  - 验证前端可以继续正常解析 `<file path="...">` 流并应用代码。

- 生成失败链路
  - 用无效 `OPENAI_API_KEY` 或错误 `OPENAI_BASE_URL` 触发上游失败，确认前端展示真实错误文本，而不是空完成后再报通用克隆失败。
  - 验证 SSE 不会在 `generatedCode === ''` 时发送误导性的 `complete` 成功事件。

- 文档与模板
  - 检查根目录 `.env.example`、README、脚手架模板 `.env.example` 是否全部移除 Gateway/多 provider 的默认引导。
  - 确认新部署用户只按 OpenAI-compatible 配置即可启动。

## Assumptions

- 已确认的默认方案：保留现有模型名称和模型选择器，不收缩模型列表。
- 默认 OpenAI-compatible 网关支持当前模型 ID；若不支持，系统直接返回上游错误，不做本地别名映射或二次回退。
- 本次只规划“统一 provider 路由与错误透传”，不改抓取、沙盒、截图或前端 UI 布局。
