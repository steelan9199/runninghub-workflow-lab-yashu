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
| 7 | 2036452966554673154 | `MatAnyone2-视频抠图（极速）` | 视频逐帧抠像，首帧给提示词分割，之后靠 MatAnyone2 跟帧 | 104 | 8 | 2026-11-15 |
| 8 | 2072999797982011392 | `UniAnimate（姿态→视频）+WanVideo-720P` | 图 + 驱动视频 → 骨架 → Wan2.1 动作迁移，**换人跳舞参考线** | 382 | 28（API 图 65） | 2026-11-15 |
| 9 | 1953091916986519553 | `MimicMotion 上传图片生成跳舞 图生视频跳舞` | 图 + 驱动视频 → MimicMotion 动作迁移，15fps | 85 | 12 | 2026-11-15 |
| 10 | 2084814218431385601 | `MinimaxH3音频驱动数字人单人版（lightx2v加速）` | 一张图 + 一段音频 → 口型/表情，时长跟着音频走 | **3495** | 26 | 2026-11-15 |
| 11 | 2084818471610839041 | `Minimax H3数字人双人/多人（Lightx2v加速）` | 两张图对话，音频分段拼接驱动多人 | 991 | 28 | 2026-11-15 |
| 12 | 2090037412381683713 | `Minimax H3+sec4B角色替换` | 视频里框定人物 → 遮罩内换人重绘，背景构图原地保留 | 1586 | 42 | 2026-11-15 |
| 13 | 1991610436030308353 | `Sam3语义分割遮罩模型-Sam3 Segmentation` | 用一句话描述选人，输出逐帧遮罩视频 | **2888** | 13 | 2026-11-15 |
| 14 | 2000971709572317185 | `Z-image+Controlnet视频首帧动态控制生图` | 取视频首帧骨架 → 出一张同姿态的图，用来对齐首帧 | 664 | 23 | 2026-11-15 |
| 15 | 1996950295303360513 | `Z-image秒变MOE模型，Controlnet和lora和谐共生` | Z-image + ControlNet + 人像 LoRA，静态图出图 | 1511 | 22 | 2026-11-15 |
| 16 | 1982334863921561601 | `夜魔佬首尾帧+中间帧` | Wan2.2 高低噪双段，首/中/尾三帧同时约束 | 591 | 18 | 2026-11-15 |
| 17 | 1931329103214129154 | `ComfyUI Wan 2.1 VACE 多条件 - 更好的 ControlNet 控图视频生成` | VACE 双条件串联（深度 + 骨架），**跳舞转绘** | 218 | 26（API 图 30） | 2026-11-15 |
| 18 | 1996163380232830977 | `Z-lmage-Turbo-Fun-Controlnet(支持多种条件控制)` | 四路条件开关（Canny/Depth/Pose），Z-Image 出图 | 93 | 20（API 图 26） | 2026-11-15 |

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

## 换人 / 动作迁移类（2026-11-15 入库，为「小丑02 换人」找的参考）

## 7. 2036452966554673154 · MatAnyone2-视频抠图（极速）

- **作者 / 热度**：初级A；使用 104、赞 1。节点 8 个，API 图 9 个。
- **通路**：`VHS_LoadVideo(2)` → `ImageResizeKJv2(4)`（480×832，`keep_proportion=crop`，`divisible_by=2`）→ `GetImageRangeFromBatch(11, 只取第 0 帧)` → `SegmentV2(5)`（RMBG 版：`GroundingDINO_SwinT_OGC` + `sam_vit_h`，`prompt="男人"`，`threshold=0.35`）→ `MaskToImage(10)` → `foreground_mask`。
- **抠像主体**：`MatAnyone2(7)` 收 `src_video=4` + `foreground_mask=10` + `solid_color=6`（纯绿 `0,255,0`，用于输出对比底）；`max_mem_frames=5`、`n_warmup=10`、`max_internal_size=-1`（不缩内部尺寸）、`use_long_term=false`。
- **两个输出**：`8` 合成视频（带绿底）；`13` alpha 视频（`MatAnyone2` 第 2 路输出 = 带透明的结果），想拿干净前景就取 13。
- **关键点**：**只有首帧做提示词分割，后续靠跟踪**。人物中途出画/被遮挡/镜头硬切时要手动选新帧重出 mask（改 `GetImageRangeFromBatch.start_index`），否则跟丢。
- **用途**：换人前把原人物干净抠走，或者做「保留背景只换主体」的素材准备。

## 8. 2072999797982011392 · UniAnimate（姿态→视频）+WanVideo-720P

- **作者 / 热度**：AI-KSK；使用 382。平台节点数 28，API 图 65（**同一条管线放了两套**，第二套只是换 seed / 换驱动视频，做对比用）。
- **通路**：
  - 人物图 `LoadImage` → `ImageResizeKJ` 768×768（`keep_proportion=false`）。
  - 驱动视频 `VHS_LoadVideo`（`force_rate=16`、`frame_load_cap=49`、`skip_first_frames=49`）→ `ImageResizeKJ` 720×1280（等比）。
  - 骨架：`WanVideoUniAnimateDWPoseDetector`（**节点内置 DWPose**，`score_threshold=0.3`、`draw_body/hands/feet` 全开、`handle_not_detected=empty`）→ `WanVideoUniAnimatePoseInput`（`strength=1`、`start/end_percent=0/1`）→ 灌进 `WanVideoSampler.unianimate_poses`。
  - 另有备用骨架线：`DWPreprocessor`(512, hand enable) + `OpenposePreprocessor`(512, hand disable) 两路同时算，再进 `MyOpenPoseNode` 合并 —— 作者在对比 DWPose 与 OpenPose 的驱动效果。
- **模型**：`Wan2_1-I2V-14B-720P_fp8_e4m3fn`、LoRA `UniAnimate-Wan2.1-14B-Lora-（12000-fp16`、CLIP `umt5-xxl-enc-bf16`、CLIP Vision `open-clip-xlm-roberta-large-vit-huge-14_fp16`、VAE `Wan2_1_VAE_bf16`。
- **采样**：25 步 `unipc`、`cfg=6`、`shift=5`、`blocks_to_swap=20`、TeaCache（`rel_l1_thresh=0.3`）、SLG（blocks `9,10`，0.5–0.9）、`WanVideoEnhanceAVideo`。
- **默认参数**：16fps / 49 帧（≈3 秒）、竖幅 720×1280；提示词只是一句「一个女孩在跳舞」——**这条线的意思是：动作由骨架喂，文字只描述身份和场景**。
- **对本项目的参考价值**：这正是「文字不用写动作细节」的实证路线；但它换成 Wan 系模型，不是 H3，出片质感与 H3 不同。
- **注意**：`select_every_nth` 未开（1），49 帧 @16fps 只吃驱动视频前 3 秒；要跑完整 13.7 秒必须拆段或改 `frame_load_cap`。

## 9. 1953091916986519553 · MimicMotion 上传图片生成跳舞 图生视频跳舞

- **作者 / 热度**：旺梨；使用 85、赞 1。节点 12，API 图 15。
- **通路**：`LoadImage` → 576×1024（`divisible_by=64`）；驱动视频 `VHS_LoadVideo`（`select_every_nth=2`，即 24fps 驱动视频抽成 12fps 喂）→ 576×1024（`keep_proportion=false`）→ `MimicMotionGetPoses`（`include_body/hand/face` 全开）→ `MimicMotionSampler` + `MimicMotionDecode` → `RIFE VFI` → 输出。
- **模型**：`MimicMotionMergedUnet_1-0-fp16.safetensors`（下载即用，无需额外 LoRA）。
- **采样**：25 步、`cfg_min/cfg_max=2`、`fps=15`、`context_size=16`、`context_overlap=6`、`pose_strength=1`、`image_embed_strength=1`、`noise_aug_strength=0`。
- **三个输出**：`59` 成片（15fps）、`74` 只出骨架序列、`78` 四联对比（图 / 驱动 / 骨架 / 成片）。
- **注意**：分辨率被 64 整除约束卡死在 576×1024 竖幅；换成横屏或非 9:16 素材要重新算尺寸。

---

## 数字人 / 角色替换 / 首帧对齐（2026-11-15 第二批，全部来自 Aiwood爱屋研究室）

## 10. 2084814218431385601 · MinimaxH3音频驱动数字人单人版（lightx2v加速）

- **热度**：使用 **3495**，是这批里最高的一条，说明音频驱动路线已被大量验证。
- **通路**：`LoadImage(137)` 单图 → `MiniMaxH3ReferenceToVideo(136)` 的 `ref_image_0`；`LoadAudio(171)` → `TrimAudioDuration(199)`（`start_index=40`、`duration=10`）→ `VRGDG_MiniMaxH3AudioDrive(172)`；后者把 `source_audio` 直接写进 `av_latent`，**音频不靠提示词描述，直接进潜空间**。
- **帧数自动凑 17k+5**（这条最有价值）：`SoundFlow_GetLength(179)` 量出音频秒数 → `ComfyMathExpression(131)` 算 `max(5, round(a * 24)) + (5 - (max(5, round(a * 24)) % 17)) % 17`，结果直接给 `length`。改音频就自动改长度，不用手算。
- **模型 / 采样**：UNET `minimax_h3_ref2va_int8_convrot` + LoRA `minimax_h3_fl2v_lightx2v_turbo_4step_v0.1_comfy`(0.75)；`res_multistep` + `simple`、**6 步**、`RandomNoise(129)=999`；16:9 / **1MP** / `multiple=32`。
- **输出**：`VHS_VideoCombine(142)`，24fps，**带音轨**（`audio<-172`）。
- **注意**：`TrimAudioDuration.start_index` 是秒，用来从长音频里截一段；`ref_image_size=max` 会让人物尽量大，切竖屏时要留意别切到人。

## 11. 2084818471610839041 · Minimax H3数字人双人/多人（Lightx2v加速）

- **与第 10 条的差别**：`LoadImage(137)` + `LoadImage(182)` → `ref_image_0` / `ref_image_1`，`ref_image_size=match`（两张图统一尺度，避免一大一小）。
- **音频拼接驱动对话**：`AudioCrop(177, 0–4s, A)` → `AudioConcat(193, 后面接 EmptyAudio(192) 0.5s 静音)` → `AudioConcat(191, 再拼 AudioCrop(186, 0–5s, B))` → `VRGDG_MiniMaxH3AudioDrive(172)`。**0.5s 静音是说话人切换的呼吸缝**，去掉会听起来像同一人连读。
- **提示词写法**（`PrimitiveStringMultiline(138)`）：按秒写镜头与说话人 —— 「image1 的女人面部特写，她正在说话 0–4 秒…越肩镜头硬切…」。多人片必须写清「谁在说话、镜头给谁」。
- **模型 / 采样**：UNET `minimax_h3_fl2va_bf16` + 同一个 turbo LoRA(0.75)；6 步、0.9MP、16:9。
- **输出**：24fps 带音轨。

## 12. 2090037412381683713 · Minimax H3+sec4B角色替换

**这是这批里跟「视频换人」最接近的一条：不动背景，只把指定人物在遮罩内重绘掉。**

- **输入**：`VHS_LoadVideo(1129)` 161 帧 @24fps → `ImageResizeKJv2(1130)`（16:9 / 1MP / 32 倍数）→ `ImageFromBatch(1068)` 取第 0 帧给选点用。
- **选人**：`PointsEditor(1131)` 在首帧打正/负点 → `SeCVideoSegmentation(1134)`（`SeCModelLoader(1133)`，bfloat16 + flash attn，`max_frames_to_track=1`）→ 逐帧 mask → `GrowMask(1136, expand=150)` 外扩，避免边缘残留。
- **只重绘遮罩内**：mask → `SetLatentNoiseMask(1095)` 盖住视频潜空间；`SolidMask(1091)` 全 0 盖住音频潜空间（音频冻结不动）→ `LTXVConcatAVLatent(1104)` → `KSampler(1113)`。
- **新角色的参考图怎么来**：`LoadImage(1056)` → `RemoveBackground(1142, birefnet)` → `InvertMask(1143)` → `ImageCompositeMasked(1141)` 贴到 512 白底 → 当 `ref_image_0`。**先把参考图去背换白底，模型才不会把原背景带进来。**
- **帧数公式**（与第 10 条略不同）：`max(5, round(a)) - ((max(5, round(a)) - 5) % 17)`。
- **模型 / 采样**：UNET `minimax_h3_hybrid_fl2va_ref2va_b25-49-int8` + turbo LoRA(0.75)；`KSampler` **euler / 6 步 / cfg=1**（distill 模型 cfg 必须 1）。
- **输出**：`1121` 成片、`1122` 三格对比（参考图 / 原片 / 结果）。
- **局限**：`max_frames_to_track=1` 表示只按首帧跟踪，遇到硬切、人物出画、被遮挡会断；断点之后要另起一次任务。**本片三镜两切，正好要按镜拆三次。**

## 13. 1991610436030308353 · Sam3语义分割遮罩模型-Sam3 Segmentation

- **一句话选人**：`RH_Translator(10)` 把中文描述翻成英文（示例「穿着白色西装，白色裤子，戴着白色帽子正在跳舞的男人」）→ `SAM3Segmentation(1)` 的 `text_prompt`；`LoadSAM3Model(2)`、`confidence_threshold=0.2`、**`max_detections=1`**。
- **通路**：`VHS_LoadVideo(3)`（16fps、`skip_first_frames=150`、`frame_load_cap=150`）→ `ImageResizeKJv2(4)`（832×480，`keep_proportion=crop`）→ 拆批 → SAM3 逐帧出 mask → `easy imageListToImageBatch` 合回 → `VHS_VideoCombine`。
- **三个产物**：`9` 原片+遮罩叠色、`14` 纯 alpha 遮罩视频、`MaskPreview+`/`MaskToImage` 预览。
- **比 MatAnyone2 强的地方**：**不用首帧手点、不用打提示词框**，纯语义全片跟踪；比它弱的地方：同一个词描述多人时会只取一个（`max_detections=1`）。
- **注意**：`VHS_VideoCombine` 的 `format` 这里写的是 `video/h264-mp4.json`，是本图自带的一个小瑕疵，照抄时改回 `video/h264-mp4`。

## 14. 2000971709572317185 · Z-image+Controlnet视频首帧动态控制生图

**用途：拿一段视频的首帧姿态，生成一张同姿态的图 —— 也就是「对齐首帧」的定妆图。**

- **通路**：`VHS_LoadVideo(41)`（`frame_load_cap=81`）→ `GetImageRangeFromBatch(42, 取第 0 帧)` → `AIO_Preprocessor(13, DWPreprocessor, 512)` 出骨架 → `ImageScaleToTotalPixels(15, 2MP)` → `QwenImageDiffsynthControlnet(12, strength=1)`，patch 用 `Z-Image-Turbo-Fun-Controlnet-Union-2.0`。
- **模型**：`z_image_turbo_bf16` + CLIP `qwen_3_4b`（type `qwen_image`）+ VAE `ae`。
- **两段采样**：`KSamplerAdvanced(26)` 0→4 步（总 10 步，`INTConstant(28)=10`，切点 `29=4`）→ `KSamplerAdvanced(27)` 4→10000 步；`euler`、`cfg=1`、`Seed(rgthree)=-1` 随机。
- **出图后**：`2xNomosUni_span_multijpg_ldl` 2× 放大 → `ImageConcanate(24)` 出「骨架 / 成图」左右对比。
- **对本项目的用法**：H3 换人时若首帧姿态对不上（人手已抬起、成片却垂手），先用这条生成一张同姿态的新角色图，再拿它当 `<Picture 1>`，比只写提示词稳。

## 15. 1996950295303360513 · Z-image秒变MOE模型，Controlnet和lora和谐共生

- **与第 14 条的差别**：输入是静态 `LoadImage(14)`（不是视频抽帧）；`ModelPatchLoader(11)` 用 `..._Controlnet-Union`（不带 `-2.0`）；多一个 `LoraLoaderModelOnly(18)` 人像 LoRA `zhenzhen-z_image_zimage.safetensors`(1.0)，挂在高噪段。
- **其余一致**：DWPreprocessor 512 → 2MP → ControlNet(1.0) → 10 步切 4 → 2× 放大 → 左右对比。
- **用途**：给新角色出「正面定妆图 / 三视图」时，用骨架控制姿势比纯文字准。

## 16. 1982334863921561601 · 夜魔佬首尾帧+中间帧

- **三帧约束**：`WanFirstMiddleLastFrameToVideo(83)` 吃 `start_image(39)` / `middle_image(45)` / `end_image(41)`，`length=81`、`middle_frame_ratio=0.6`（中点落在 60% 位置）、720×1280、16fps；`high_noise_strength=0.5`、`low_noise_strength=0.2`。
- **高低噪双模型**：`wan2.2_i2v_high_noise_14B_fp16` → `KSamplerAdvanced(33)` 跑 0–4 步；`wan2.2_i2v_low_noise_14B_fp16` → `KSamplerAdvanced(34)` 跑 4–8 步（`INTConstant(48)=8`、切点 `49=4`）；各自挂 4step lightx2v LoRA、`ModelSamplingSD3(shift=5)`、`cfg=1`。
- **`length` 必须是 4n+1**（81 = 4×20+1），Wan 系硬约束，和 H3 的 17k+5 不是一套。
- **注意**：`ImageScaleBy(0.2)` 那三个节点只用于拼对比图（`ImageConcatMulti(58)` + `ImageConcanate(59)`），不影响出片。

## 17. 1931329103214129154 · ComfyUI Wan 2.1 VACE 多条件 - 更好的 ControlNet 控图视频生成

- **作者 / 热度**：大凯AI；使用 218、节点 26（API 图 30）。作者简介里明写「**跳舞转绘也 OK**」，与换人跳舞同族。
- **核心手法：VACE 双条件串联**。两段 `WanVideoVACEEncode` 不是并联而是**串起来**：`52` 吃深度（`input_frames<-143` DepthAnythingV2，`ref_images<-29` 外观参考）→ 其输出当 `144` 的 `prev_vace_embeds` → `144` 再吃骨架（`input_frames<-145` DWPreprocessor）→ 最终 `image_embeds` 进采样器。先说「画面结构长这样」，再说「关节长这样」，模型不容易二选一。
- **参数**：两段 `strength=0.5`、`vace_start/end_percent=0/1`。
- **模型**：`Wan2_1-T2V-14B_fp8_e4m3fn` + `Wan2_1-VACE_module_14B_bf16` + LoRA `Wan21_CausVid_14B_T2V_lora_rank32_v2`(0.5)；`blocks_to_swap=20`、sageattn、TorchCompile。
- **采样**：**8 步**、`flowmatch_causvid`、`shift=8`、`cfg=1`、81 帧 / 832×480 / 24fps。
- **输入**：`LoadImage(148)` 外观参考、`LoadImage(149)` + `VHS_LoadVideo(150)` 驱动素材。
- **对本项目的参考价值**：这是「骨架不够、还想锁住画面结构」的解法——你镜1 的构图被拉近，除了骨架，再串一路深度（或直接串原片深度）能把楼梯峡谷的结构钉住。
- **注意**：`frame_rate` 三个 combine 分别写 24 / 25 / 25，属作者笔误，照抄时统一。

## 18. 1996163380232830977 · Z-lmage-Turbo-Fun-Controlnet(支持多种条件控制)

- **作者 / 热度**：玩点AI；使用 93、节点 20（API 图 26）。**作者简介里带邀请码广告**（`邀请码：58de9f1a`），按 §4.0 判据属于广告，照抄接线时不要带走。
- **四路条件开关**（这张图唯一值得抄的点）：`CR Image Input Switch (4 way)(73)` 的 `Input=2`，可选 `50` DepthAnythingV2 / `64` CannyEdge / `65` OpenposePreprocessor，全部 `resolution=512` → 统一汇入 `QwenImageDiffsynthControlnet(49, strength=1)`。改一个数字就换控制方式，不用重接线。
- **模型**：`z_image_turbo_bf16` + `ModelPatchLoader(Z-Image-Turbo-Fun-Controlnet-Union)` + VAE `ae`；CLIP 是 `qwen_3_4b`，但 **`type=lumina2`** —— 与第 14/15 条的 `type=qwen_image` 不一致，复制前先确认平台认哪个，别混用。
- **采样**：`KSampler` **9 步**、`res_multistep`、`cfg=1`、`ModelSamplingAuraFlow(shift=3)`；2MP、`EmptySD3LatentImage` 出图。
- **其余**：`ImageStitch(54)` 拼「条件图 / 成图」对比，四个 `PreviewImage` 分别看条件与结果。

---

## 备注：收藏 ID 都可 API 直取图

```bash
node scripts/rhx.mjs learn 2114707872927014914 --tag 收藏
node scripts/rhx.mjs learn 2104527536003833858 --tag 收藏
node scripts/rhx.mjs learn 2103931824199266305 --tag 收藏
node scripts/rhx.mjs learn 2089513420025589761 --tag 收藏
node scripts/rhx.mjs learn 2106198509325217793 --tag 收藏
node scripts/rhx.mjs learn 2089754898287124481 --tag 收藏
node scripts/rhx.mjs learn 2036452966554673154 --tag 抠像
node scripts/rhx.mjs learn 2072999797982011392 --tag unianimate
node scripts/rhx.mjs learn 1953091916986519553 --tag mimicmotion
node scripts/rhx.mjs learn 2084814218431385601 --tag 数字人
node scripts/rhx.mjs learn 2084818471610839041 --tag 数字人
node scripts/rhx.mjs learn 2090037412381683713 --tag 换人
node scripts/rhx.mjs learn 1991610436030308353 --tag 分割
node scripts/rhx.mjs learn 2000971709572317185 --tag zimage
node scripts/rhx.mjs learn 1996950295303360513 --tag zimage
node scripts/rhx.mjs learn 1982334863921561601 --tag wan
node scripts/rhx.mjs learn 1931329103214129154 --tag vace
node scripts/rhx.mjs learn 1996163380232830977 --tag zimage
```

`learn` 会把 API 格式图落到 `corpus/wf_<id>.json`，可作仿写语料。要真跑（花钱/占机器）走 `run`，别在 `learn` 之后盲目直投 —— 这几张都是 48G 级机器的工作流。
