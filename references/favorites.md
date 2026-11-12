# 收藏工作流台账

**用途**：记我（老板）点名要收藏的 RunningHub 工作流 —— 原始 ID、核实过的官方标题、结构核对结论、关键参数。
**谁维护**：`runninghub-workflow-lab-yashu`。新增收藏时只往表里加行，再补一节明细。
**不写什么**：不写生产 alias、不写调用参数映射 —— 那些归 `runninghub-cloud-yashu` 的注册表。

## 标题 / 使用量怎么核实（2026-11-13 实测，不用开浏览器）

`POST /api/openapi/getJsonApiFormat` 只返回 ComfyUI 图（`data.prompt`），**不含标题**；
但站点自己的公开接口（无需登录、无需 apiKey）能拿到标题与热度：

| 事 | 接口 | body |
|---|---|---|
| 按 ID 查标题 + 使用量 | `POST https://www.runninghub.cn/api/portal/workflow/detail` | `{ "workflowId": "<id>" }` |
| 关键词搜工作流 | `POST https://www.runninghub.cn/api/search/workflow` | `{ "search": "三采", "current": 1, "size": 50 }` |

- 详情返回 `name` / `desc` / `nodeCount` / `owner.name` / `tags` / `statisticsInfo{useCount, likeCount, collectCount, pv}`。
- 搜索的关键词字段是 **`search`**；写成 `keyword` / `searchKey` / `name` 都会被忽略（total 恒等于全库 91799）。分页字段是 **`current` / `size`**；`pageNum` / `pageSize` 无效。
- 排序就用 `useCount`，别信 `pv`（普遍为 0）。

网页兜底路径（前面接口挂了再用）：浏览器开 `https://www.runninghub.cn/workflow/<workflowId>` 读页面名称；
页面会跳到本账号副本 ID（形如 `2120973…`），标题不变，提交任务仍用原 ID。

## 收藏清单

| # | workflowId | 官方标题（接口核实） | 一句话定位 | 使用量 | 节点数 | 核实日期 |
|---|---|---|---|---|---|---|
| 1 | 2114707872927014914 | `Minimax H3_三采最强工作流_首尾帧` | H3 首尾帧 + 三段采样 + 3D 潜空间放大 | 5 | 43 | 2026-11-13 |
| 2 | 2104527536003833858 | `文戏不油—三采极致高分辨率工作流` | 文戏（无大动作）出片，1.5MP 高分辨率 | 618 | 24 | 2026-11-13 |
| 3 | 2103931824199266305 | `(长视频-文武双修均衡版-高清)MiniMax H3多参双采参考生视频` | 20 秒长视频，多图参考 + 双段采样 + 2× 放大 | 15 | 61 | 2026-11-13 |
| 4 | 2089513420025589761 | `小脸不崩！打斗不糊！H3 sigma强化+潜空间放大工作流（不油啦！）` | 二采 + sigma 强化 + 2× 潜空间放大，12 秒通用 | **6528** | 31 | 2026-11-13 |
| 5 | 2106198509325217793 | `MiniMax H3双采全能工作流V3-语义桥-文戏不油，武戏动态强-文生视频-长视频-高清有直出` | 双采 + 语义桥 + 学习式 2×，拉到 30 秒 | **2312** | 70 | 2026-11-13 |
| 6 | 2089754898287124481 | `AITUDOU-MiniMax H3 双采样 潜空间放大` | 双采 + 2× 潜空间放大，8 步 turbo 入门款 | **924** | 31 | 2026-11-13 |

标题核对结果：②③ 与我记的完全一致；① 我漏了「最强」两字，官方标题是 `Minimax H3_三采最强工作流_首尾帧`。

**为什么 ④⑤⑥ 是这样选出来的**（按 `useCount` 排完全库 H3 多采工作流）：

- `2088176083727376386`（2426 次，`MiniMax H3_初版多参极简二采工作流`）**排除**：存储的图里 H3 主体被静音，实际能跑的只有 11 个节点的 Depth Anything 3 深度视频，不是二采出片。
- `2106353568906301442`(850) / `2109641176335863810`(778)：青橙Lab 和 ⑤ 是同一张图，只换了默认参数（参考生视频 / 竖屏），不重复记。
- `2111249057271336962`(974)：单采 `SelfLiftH3Sampler`，作者自己写「无需二采」，不算多采。
- 备选：`2105615690806939649`(748) SelfLift 双采 + 上下文无缝续接，9:16 / 2MP；三采备选 `2089928928285773826`(387) 全参考 + 3× 采样 + sigma 强化。

---

## 1. 2114707872927014914 · Minimax H3_三采最强工作流_首尾帧

- **输入**：首帧 `LoadImage(170)`、末帧 `LoadImage(172)`（均按 1.5MP 缩放）；提示词 `PrimitiveStringMultiline(84)`。
- **三采怎么实现的**（图内核对）：
  - `SamplerCustomAdvanced` ×3：`108` 一采（`MiniMaxH3ImageToVideo` 潜空间）→ `128` 二采（接 `MinimaxH3LatentUpscaler3D(724)` 放大后的潜空间）→ `106` 三采（`DisableNoise` + 音频潜空间 `LTXVConcatAVLatent`）。
  - `SplitSigmas` ×2（`99`/`100`）分段给三次采样；`ExtendIntermediateSigmas(94)` 衔接。
- **首尾帧锚点**：`716` 首帧 @0、`717` 末帧 @-1（`MiniMaxH3AddGuide`）；`715` 是三采专用条件（不挂关键帧）。
- **模型**：UNET `Minimax-h3_Singularity_ref2va-v2_int8`；LoRA `minimax_h3_ref2v_turbo_4step_v0.1`（1.0）+ `minimax_h3_lms_v1.0_r64`（0.3）；CLIP `qwen3vl_32b_minimax_h3_int8_convrot`；VAE ×2。
- **默认参数**：3:4 竖幅 0.6MP、12 秒、6 步、`euler` / `simple`。
- **输出**：`VHS_VideoCombine(141)`，prefix `H3_FLF_3PASS`，24fps，crf 19，带音频（`VAEDecodeAudio 243`）。
- **结构复核（2026-11-13，读 UI 导出后确认）**：这张的「三采」只有两段在真采样 —— `SplitSigmas(100)` 的 `step=0` 让中间那个 `SamplerCustomAdvanced(128)` 拿到单值 sigmas，总步数为 0，是空转接线；实际是「一采 2 步 → 1.5× 放大 → 三采 6 步」。另外 sigma shift 只挂给了三采的 guider（调度器用的是未 shift 的模型），首尾帧锚点则正确地挂在最终分辨率的 `latent(105)` 上。仿写时不要照抄 step=0 和「shift 只给最后一段」这两处。

## 2. 2104527536003833858 · 文戏不油—三采极致高分辨率工作流

- **输入**：`CR Text(51)` 一段长提示词（示例是「非科技感纯 MG 信息视觉」）；`UNETLoader(45)` 标「文生/图生」。
- **结构核对**：**只有一个采样器** `SelfLiftH3Sampler(54)` —— 渐进式：`lowres_scale 0.5` 起手 → `transition_step 6` → 学习式 3D 放大 `minimax_h3_latent_upscaler_3d_fp16_V2` 上到全分辨率再收尾（8 步 / `beta`）。所以标题里的「三采」指渐进多段采样，**不是**三个独立 Sampler 节点。
- **模型**：UNET `minimax_h3_hybrid_fl2va_ref2va_b25-49-int8`；LoRA `minimax_h3_turbo_v4_step600_ema_pruned`（1.0）+ `MysticXXX_MMH3-V4-GGG`（0.5）；`H3SigmaRefiner(47)`、`MiniMaxLowVRAMAttention(39)`、`MiniMaxChunkFeedForward(40)` 降显存。
- **默认参数**：16:9、**1.5MP**（这张的卖点就是高分辨率）。
- **输出**：`VHS_VideoCombine(145)`，prefix `视频修复`，24fps，带音频。

## 3. 2103931824199266305 · (长视频-文武双修均衡版-高清)MiniMax H3多参双采参考生视频

- **多参**：`LoadImage` ×9（`6` + `35`–`42`，全部标「I2VA first frame」，不同参考图槽位）；`MiniMaxH3SemanticBridgeConfigT8/ApplyT8(56/55/58)` 做语义桥接。
- **双采怎么实现的**：`PASS 1`（LOW，`MiniMaxH3DualClockSamplerT8`，shift 12 视频 / 3 音频，8 步）→ `MiniMaxH3LearnedLatentUpscaleT8Advanced(13)` 2× → `PASS 2`（HIGH，可开 Tail/Bias/STG/Restart，默认关）。
- **长视频 / 高清**：`PrimitiveFloat(27)` 时长 **20 秒**；16:9 起手 0.5MP，靠 2× 学习式放大到约 1MP。
- **文武双修 = LoRA 组合**：战斗向 `H3_Combat_V2`（0.7/0.49）、质感向 `Minimax H3真实电影质感V0.1`（0.5/0.2）、`Motion_Repair`（0.75/0.25）、`LightX2V FL2V Turbo`（bypass 可切，0.9）、`ErosMax`(0.7/0.5)、`H3_speed_slider_1.1`(1.5)、`minimax_h3_lms_v1.0_r64_r`(0.2)。
- **模型**：UNET `minimax_h3_hybrid_fl2va_ref2va_b25-49-int8_r`；CLIP `qwen3vl_32b_minimax_h3_nvfp4_awq`。
- **输出**：`CreateVideo(75)` → `SaveVideo(74)`，prefix `video/ComfyUI`。

---

## 4. 2089513420025589761 · 小脸不崩！打斗不糊！H3 sigma强化+潜空间放大工作流（不油啦！）

- **作者 / 热度**：Aiwood爱屋研究室；使用 6528、赞 72、收藏 199（全库 H3 多采第一）。
- **输入**：`LoadImage(139)` 单图 + `PrimitiveStringMultiline(265)` 提示词（默认是「一男一女两个日本警察讨论案情」）。
- **二采结构**：`H3SigmaRefiner(254)` → `SplitSigmas(208, step 6)` → `SamplerCustomAdvanced(125)` 一采 → `MinimaxH3LatentUpscaler3D(263, 2×)` → `SamplerCustomAdvanced(209)` 二采。
- **模型**：UNET `minimax_h3_fl2va_bf16`；LoRA `minimax_h3_fl2v_lightx2v_turbo_4step_v0.1_comfy`(0.65)；CLIP `qwen3vl_32b_minimax_h3_int8_convrot`；`MiniMaxH3SigmaShift(149, shift 12/3)`。
- **默认参数**：16:9、0.5MP、12 秒、K 采样器 `euler`。
- **输出**：`CreateVideo` → `SaveVideo`。
- **定位**：节点最少、参数最干净的一张，适合当「二采 + 放大」的骨架抄。

## 5. 2106198509325217793 · MiniMax H3双采全能工作流V3-语义桥-文生视频-长视频-高清有直出

- **作者 / 热度**：青橙Lab；使用 2312、赞 5、收藏 9。同作者 V4（`2113982579975221250`，724 次）是这条线的升级版。
- **输入**：`CR Prompt Text(28)` 长提示词；`LoadImage` ×9（`35`–`42` + `70`），默认全空 = 文生视频，填图即参考生视频。
- **双采结构**：`MiniMaxH3DualClockSamplerT8(8, shift 12/3, 8 步)` → `SamplerCustomAdvanced(12)` LOW 段 → `MiniMaxH3LearnedLatentUpscaleT8Advanced(13, 2× 学习式放大，模型 h3_upscaler_sharpness_2000steps_v0.1_fp32)` → `SamplerCustomAdvanced(19)` HIGH 段。
- **模型**：UNET `minimax_h3_hybrid_fl2va_ref2va_b25-49-int8_r`；CLIP `qwen3vl_32b_minimax_h3_nvfp4_awq`；LoRA 一套：`turbo_v4_step600_ema_DasiwaREF2VAHybridV1`、`H3_Combat_V2`、`Motion_Repair`、`Minimax H3真实电影质感V0.1`、`GunFu`、`H3 速度滑块`、`minimax_h3_lms_v1.0_r64_r`、`ErosMax`。
- **默认参数**：16:9、0.4MP 起手放大到约 1MP、**30 秒**。
- **输出**：`VHS_VideoCombine(21)` / `CreateVideo(128)` → `SaveVideo(134)`。

## 6. 2089754898287124481 · AITUDOU-MiniMax H3 双采样 潜空间放大

- **作者 / 热度**：AI代码侠土豆；使用 924、赞 10、收藏 29。
- **输入**：`LoadImage(55)` 单图（图生视频）。
- **双采结构**：`H3SigmaRefiner(221)` → `SplitSigmas(222, step 4)` → `SamplerCustomAdvanced(23)` 一采 → `MinimaxH3LatentUpscaler3D(226, 2×, fp16)` → `SamplerCustomAdvanced(88)` 二采。
- **模型**：UNET `minimax_h3_hybrid_fl2va_ref2va_b20-49-int8`；LoRA `minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16`(1.0)；CLIP `qwen3vl_32b_minimax_h3_int8_convrot`。
- **默认参数**：16:9（megapixels 由节点 138 驱动）、时长由节点 141 驱动、`euler`。
- **输出**：`VHS_VideoCombine(104)`，prefix `第二次采样视频`，24fps，crf 19。
- **定位**：8 步 turbo 版，跑得省，适合当对照组。

---

## 备注：收藏 ID 都可 API 直取图

```bash
node scripts/rhx.mjs learn 2114707872927014914 --tag 收藏
node scripts/rhx.mjs learn 2104527536003833858 --tag 收藏
node scripts/rhx.mjs learn 2103931824199266305 --tag 收藏
node scripts/rhx.mjs learn 2089513420025589761 --tag 收藏
node scripts/rhx.mjs learn 2106198509325217793 --tag 收藏
node scripts/rhx.mjs learn 2089754898287124481 --tag 收藏
```

`learn` 会把 API 格式图落到 `corpus/wf_<id>.json`，可作仿写语料。要真跑（花钱/占机器）走 `run`，别在 `learn` 之后盲目直投 —— 这几张都是 48G 级机器的工作流。
