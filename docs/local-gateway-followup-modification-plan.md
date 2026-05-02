# Local Gateway 后续对接修改计划

## 文档目的

本文档用于固化当前 `clash-for-ai` 与 `ai-mini-gateway` 的后续对接计划，作为后续整改和验收的唯一执行清单。

后续所有本地 gateway 相关修改都应以本文档为准推进，并在每一项完成后及时更新状态，防止实现过程偏离既定范围。

## 关联文档

- `docs/ai-mini-gateway-integration-contract.md`
- `docs/local-gateway-review-and-optimization.md`

## 当前结论

基于当前代码和文档对照，`ai-mini-gateway` 已完成以下关键 runtime 能力改造：

1. `/health` 已返回 `status/version/commit/runtime_kind`
2. `/capabilities` 已声明：
   - `supports_atomic_source_sync = true`
   - `supports_runtime_version = true`
   - `supports_explicit_source_health = true`
3. 已新增原子化全量同步接口：
   - `PUT /admin/runtime/sync`
4. runtime 内部已具备：
   - sync 并发冲突保护
   - selected models 有效性校验
   - 原子替换失败不破坏旧配置

因此，当前后续工作的重点已经从“继续为旧同步链路打补丁”转为“让 `clash-for-ai` 正式切换到新的 runtime contract”。

## 当前遗留问题

### P0

1. `clash-for-ai` adapter 仍在使用旧的破坏性同步路径
2. `clash-for-ai` 未正确消费新的 runtime capabilities 和 runtime metadata
3. `Manager.Sync` 仍缺少产品层串行化保护
4. 本地 gateway 主数据层缺少严格的 source 校验与 position 归一化
5. `selected models` 仍可能成为孤儿数据，并继续参与 sync
6. local gateway source API 仍可能把明文 `api_key` 返回给前端

### P1

1. `Local Gateway` provider 在 runtime 不可用时仍可能被激活
2. `Models` 页尚未利用 runtime 的 source health/source capabilities/version 能力
3. 测试覆盖尚未围绕新 contract 补齐

## 执行原则

1. 优先切换主同步链路，再补主数据一致性和页面约束
2. 新 runtime contract 作为主路径，旧路径仅保留兼容 fallback 能力
3. 每完成一个子项，必须把对应 checklist 从 `- [ ]` 改为 `- [x]`
4. 如执行中发现新增问题，应补充到本文档“新增事项”中，不直接偏离既定范围

## 修改计划

### 阶段 1：切换到新 runtime contract

- [x] 1.1 修改 `core/internal/localgateway/ai_mini_gateway_adapter.go`
  目标：将 `SyncFromProductState` 主路径切换为 `PUT /admin/runtime/sync`
- [x] 1.2 adapter 增加 capability 完整解析
  目标：正确解析并透出：
  `supports_atomic_source_sync`
  `supports_runtime_version`
  `supports_explicit_source_health`
- [x] 1.3 adapter 增加 runtime metadata 解析
  目标：从 runtime `/health` 或 `/capabilities` 中读取并写回：
  `runtime_kind`
  `version`
  `commit`
- [x] 1.4 保留旧 CRUD 同步逻辑作为 fallback
  目标：仅当 runtime 不支持原子 sync 时才走旧路径
- [x] 1.5 sync payload 增加 source 稳定映射字段
  目标：把产品侧 source id 映射到 runtime `external_id`

### 阶段 2：补产品层 sync 安全性

- [x] 2.1 修改 `core/internal/localgateway/manager.go`
  目标：为 `Manager.Sync` 增加串行化控制
- [x] 2.2 并发 sync 时返回明确冲突错误
  目标：统一返回 `409 conflict`
- [x] 2.3 sync 前增加 preflight 校验入口
  目标：在进入 runtime sync 前先校验产品主数据合法性

### 阶段 3：补主数据一致性约束

- [ ] 3.1 修改 `core/internal/localgateway/service.go`
  目标：新增统一 source 校验逻辑
- [ ] 3.2 source 校验覆盖以下规则
  目标：
  `name` 非空
  `base_url` 必须是合法 URL
  `provider_type` 必须属于允许枚举
  `default_model_id` 非空
  `exposed_model_ids` 去重并裁剪空值
- [ ] 3.3 后端统一接管 source `position`
  目标：
  创建时忽略前端 position
  更新时普通编辑不允许随意改顺序
  删除后 position 保持 `0..n-1` 连续
- [ ] 3.4 建立“有效模型集合”计算逻辑
  目标：只从 `enabled = true` 的 source 中汇总可用模型
- [ ] 3.5 修改 `ReplaceSelectedModels`
  目标：拒绝保存不存在于当前有效模型集合中的模型
- [ ] 3.6 source 变更时自动清理失效 selected models
  触发场景：
  删除 source
  禁用 source
  修改 `default_model_id`
  修改 `exposed_model_ids`
- [ ] 3.7 `BuildSyncInput` 增加最终一致性校验
  目标：禁止把无效 selected models 下发到 runtime

### 阶段 4：收紧敏感信息返回

- [ ] 4.1 修改 local gateway source 输入/输出模型
  目标：输入模型保留 `api_key`，输出模型不再返回明文 `api_key`
- [ ] 4.2 修改以下接口响应
  目标：统一只返回 `api_key_masked`
  `GET /api/local-gateway/sources`
  `POST /api/local-gateway/sources`
  `PUT /api/local-gateway/sources/:id`
- [ ] 4.3 前端编辑流程保持“更新 key 时才重新输入”
  目标：不因后端去除明文返回而破坏当前编辑体验

### 阶段 5：补 Local Gateway provider 激活保护

- [ ] 5.1 修改 provider 激活链路
  目标：系统托管 `Local Gateway` 在 runtime 不健康时拒绝激活
- [ ] 5.2 API 层返回明确错误信息
  目标：让前端可直接展示“runtime 未就绪 / 未启动 / 不健康”
- [ ] 5.3 修改 Providers 页面激活按钮状态
  目标：runtime 不可用时按钮置灰
- [ ] 5.4 Providers 页面展示本地 runtime 状态摘要
  目标：避免用户切换前无法判断 Local Gateway 是否可用

### 阶段 6：补 Models 页 runtime 能力展示

- [ ] 6.1 使用 `supports_runtime_version`
  目标：在 Models 页展示 runtime `version/commit/runtime_kind`
- [ ] 6.2 使用 `supports_explicit_source_health`
  目标：展示 source healthcheck 状态
- [ ] 6.3 使用 source capabilities
  目标：展示每个 source 的协议能力和状态
- [ ] 6.4 优化 sync 反馈文案
  目标：让用户清楚区分“主数据已保存”和“已同步到 runtime”

### 阶段 7：补测试与验收

- [x] 7.1 adapter 测试覆盖原子 sync 主路径
- [x] 7.2 adapter 测试覆盖 fallback 旧路径
- [x] 7.3 manager 测试覆盖并发 sync 冲突
- [x] 7.4 service 测试覆盖 source 校验
- [ ] 7.5 service 测试覆盖 selected models 有效性校验
- [ ] 7.6 service/repository 测试覆盖 source 变更后的自动清理
- [ ] 7.7 API 测试覆盖 local gateway source 响应不回传明文 key
- [ ] 7.8 API/provider 测试覆盖 Local Gateway 激活保护
- [ ] 7.9 前端手工验收以下场景
  场景：
  错误 source 不会破坏 runtime 旧配置
  无效 selected model 无法保存
  runtime 不可用时 Local Gateway 无法激活
  source 删除/禁用后不残留孤儿 selected model
  页面能看见明确的 runtime 状态和 sync 结果

## 新增事项

如后续执行过程中发现本计划未覆盖、但又必须纳入当前整改范围的问题，请按以下格式追加：

- [ ] 问题标题
  背景：
  影响：
  处理方案：
  归属阶段：

## 维护要求

1. 每次提交本地 gateway 相关修改前，先检查本文档是否需要更新状态
2. 每次完成一项 checklist，必须同步改成已完成
3. 若实际实现方案需要偏离本文档，必须先修改本文档，再继续编码
