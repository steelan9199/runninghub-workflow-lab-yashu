# 踩坑账本

**本文件的唯一用途：把「非显然的坑」沉淀成下次能直接照抄的结论。**
SKILL.md 只留指针，细节全在这里；按 `class_type` 归类，同一节点的问题追加在同节下。

## 记账规则（硬约束，见 SKILL.md §5）

写什么 —— 只有满足任一条才记：

1. 报错信息看不出根因，需要试错才知道改哪里；
2. 同类节点的字段名/类型不一致（如 `image` vs `images`）；
3. 第一次提交失败、改了某处才过（说明直觉判断不可靠）。

不写什么 —— 不记：参数忘填、拼写手误、`--out` 目录不存在这类一看就懂的失误；不重复记已有条目。

什么时候写 —— **修复并复跑成功后、回复结论之前**。没写进本文件，不算这次测试完成。

条目格式（六项，缺一不可）：

```
- **YYYY-MM-DD** 一句话结论
  - 症状：服务端原文（code / exception_message / 缺哪个字段）
  - 根因：为什么会这样
  - 修法：具体改哪一处，改成什么
  - 证据：失败 taskId → 通过 taskId
```

---

## ImageInvert

- **2026-11-13** 输入字段是 `image`（单数），不是 `images`。
  - 症状：`prompt_outputs_failed_validation` / `Required input is missing: image`，崩在节点 2。
  - 根因：ComfyUI 同类节点命名不统一——`ImageInvert` / `ImageScale` 用 `image`，`SaveImage` 用 `images`。
  - 修法：`"inputs": { "image": ["1", 0] }`。
  - 证据：失败 taskId `2120955973115011074` → 通过 taskId `2120956018933587970`（256×256 黑底反色成白）。

## 平台接口（非节点类）

- **2026-11-13** 查标题/使用量走站点公开接口，别用 OpenAPI，也别去开浏览器。
  - 症状：`getJsonApiFormat` 只回 `data.prompt`（纯图，无标题）；`/api/openapi/getWorkflowInfo`、`/api/openapi/workflow/list` 等一律 `{"code":403,"msg":"TOKEN_MISSION"}`（要登录 token，不认 apiKey）。
  - 根因：标题与热度属于站点业务接口，不在 OpenAPI 里；但它们**不登录也能读**，只是路径不在 `/api/openapi` 下。
  - 修法：`POST /api/portal/workflow/detail` body `{workflowId}` → `name` / `desc` / `nodeCount` / `owner` / `statisticsInfo{useCount,likeCount,collectCount}`；`POST /api/search/workflow` body `{search:"三采",current:1,size:50}` 做关键词搜索。
  - 证据：库里 H3 多采工作流按 useCount 从 6528 排到个位数，均由此接口取得；对照浏览器读到的标题一致。

- **2026-11-13** `/api/search/workflow` 的坑：关键词字段叫 `search`，分页叫 `current`/`size`。
  - 症状：传 `keyword` / `searchKey` / `name` / `query` 时 `total` 恒为 91799（全库），像「搜不到」；传 `pageNum`/`pageSize` 翻页不动。
  - 根因：参数名不对就被静默忽略，不报错。
  - 修法：`{ "search": "三采", "current": 2, "size": 50 }`；判断是否真过滤，看 `data.total` 有没有变化。
  - 证据：`search:"三采"` → total 125；`keyword:"三采"` → total 91799。

- **2026-11-13** 工作流页会跳到账号内副本 ID，标题不变。
  - 症状：开 `https://www.runninghub.cn/workflow/2114707872927014914`，地址栏变成 `2120973036517158914`。
  - 根因：站点给分享工作流建了本账号副本用于在线运行。
  - 修法：只核标题时无视 ID 变化；提交任务仍用原始 ID（`getJsonApiFormat` 对原 ID 正常取图）。
  - 证据：三条工作流均复现，标题与 `/api/portal/workflow/detail` 返回的 `name` 一致。

- **2026-11-13** `MiniMaxH3ImageToVideo` 的条件**绑死在创建时的分辨率**上，跨分辨率采样必崩。
  - 症状：`SamplerCustomAdvanced` 报 `shape mismatch: value tensor of shape [810, 96] cannot be broadcast to indexing result of shape [1760, 96]`，栈顶在 `comfy/ldm/minimax/model.py:606 _embed_and_pack` 的 `all_video_rows[~img_update] = cond_video_rows`。
  - 根因：`first_frame` / `last_frame` 的图像行在 ImageToVideo 执行时按 `width/height` 烘死；把这份 conditioning 接到放大 1.5× 后的潜空间上采样，行数对不上。用 `MiniMaxH3ReferenceToVideo` 的二采不受影响（它不往潜空间里塞逐帧行），所以「二采能跑、三采崩」。
  - 修法：每一段采样都用自己的潜空间**重挂一遍** `MiniMaxH3AddGuide`（首帧 `frame_idx=0`、末帧 `-1`），`latent` 接该段的 latent、`image` 缩到该段分辨率；`positive` 从**不带帧**的 `MiniMaxH3ImageToVideo` 起链。一采可直接用带帧的 ImageToVideo。
  - 证据：三采 v1 网页运行报错于节点 #29（第二段采样）；v2 改为分段重挂后结构自检通过（46 节点 / 78 连线）。

- **2026-11-13** `MiniMaxH3AddGuide` 在源工作流里常常是**死接线**。
  - 症状：照抄 `2114707872927014914` 的 AddGuide 支路，以为首尾帧是它锚的。
  - 根因：该支路接到 `MiniMaxH3AddGuide → BasicGuider → SamplerCustomAdvanced`，而那个采样器的噪声是 `DisableNoise`（0 步），整条链永远不执行；首尾帧实际由 `MiniMaxH3ImageToVideo` 的 `first_frame`/`last_frame` 完成。
  - 修法：抄源工作流时先查每个采样器的 `noise` 是不是 `DisableNoise`，是就把上游整条支路当装饰，不要当作证据。
  - 证据：`wf_2114707872927014914.json` L214/L221/L324/L429/L433，采样器 106 的 noise 为 `DisableNoise`。

## 命名对照（遇到新节点先查这里，再决定要不要试）

| 节点 | 输入字段 | 备注 |
|---|---|---|
| `ImageInvert` | `image` | 单数 |
| `ImageScale` | `image` | 单数 |
| `SaveImage` | `images` | 复数，且是 `[来源节点, 0]` |
| `LoadImage` | `image` | 只吃 `fileName`（`openapi/xxx.png`），不吃 URL |
