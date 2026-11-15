# H3 剪影换人 · MatAnyone2 逐帧遮罩 · 一采 · 无声

**一句话用途**：把一条单镜舞蹈视频里的人整身换成参考图人物，**动作、镜头、节奏、背景全部保持原样**——靠「原片帧当潜空间起点 + 逐帧人物剪影当重绘范围 + denoise 1」三件套，而不是靠提示词描述。

> 实测状态：**平台跑通**（2026-11-15，镜1 / 107 帧 / 864×736）。成片 `joker02_shot1_ma3_00001_*.mp4`，taskId=2121949331895582722。

## 为什么不用「参考视频 + 提示词」那一套

同一镜头试过两条老路，都失败：

| 路线 | 结果 | 根因 |
|---|---|---|
| 只改提示词（一采直出，吃 H3 自带潜空间） | 镜头被推成近景，人占画面 ~95% | H3 会重排镜头，构图不受文字约束 |
| 矩形遮罩 + denoise 0.6 | 构图锁住了，但中景帧还是原角色 | 0.6 保结构保太狠，身份换不过去 |
| 矩形遮罩 + denoise 1 | 换装成功，但人被画大 1.3 倍 | 静态盒子给多大，模型就画多大 |

正解：**轮廓锁形状，denoise 1 锁换装**。

## 拓扑（39 节点 / 46 连线，红 5 橙 1）

```
VHS_LoadVideo(原片) ─┬─→ ref_videos.ref_video_0 ──→ MiniMax H3（只取 positive 条件）
                     ├─→ VAEEncode ──→ SetLatentNoiseMask ─┐（视频段）
                     ├─→ VAEEncodeAudio → SetLatentNoiseMask（音频段，SolidMask 全 0 冻结）
                     └─→ MatAnyone2（第 100 帧 SAM 剪影，反向追踪全片）
                                                        └─→ GrowMask(+8) → SetLatentNoiseMask
两个 SetLatentNoiseMask → LTXVConcatAVLatent → SamplerCustomAdvanced（4+2 步，denoise 1）
```

- 结构要点：H3 节点的 **LATENT 输出不接**，只用它的 `positive`；采样器的 `latent_image` 改吃 `LTXVConcatAVLatent`。
- 红 5：原片、人物图、提示词、出片宽、出片高。橙 1：`VHS_VideoCombine`。

## 默认参数

| 项 | 值 |
|---|---|
| 原片 | `小丑02_328f.mp4`，864×736 / 328 帧 / 24fps（本包只跑镜1：skip 0 / 107 帧 / 4.458s） |
| 生成尺寸 | 864×736（一采直出，无放大） |
| 采样 | beta 4 步 + `H3SigmaRefiner`（0.7 以下 +2 步），`SplitSigmas(4)`，**denoise 1** |
| 噪声 | fixed `20261115` |
| 分割 | `sam_vit_h` + `GroundingDINO_SwinT_OGC`，提示词 `person`，阈值 0.3，VITMatte |
| 分割参考帧 | **第 100 帧**（`ImageFromBatch+.start` 与 `PrimitiveInt.value` 必须同值） |
| 剪影外扩 | `GrowMask.expand = 8` |
| 输出 | 24fps、`video/h264-mp4`、`yuv420p`、crf 19、**无音轨** |

## 实测数据

| 项 | 值 |
|---|---|
| 成片规格 | 864×736 / 107 帧 / 24fps / 4.458s / 1.82 MB |
| 单任务耗时 | 约 3.5 分钟（SAM 单帧分割 + MatAnyone2 追踪 107 帧 + 4+2 步采样） |
| 整帧 PSNR（vs 原片） | 帧0 34.18 dB（无人，仅 VAE 往返）／帧30 32.77／帧60 26.25／帧106 23.25 |
| 遮罩强度对比 | 参考帧取第 40 帧（人小）→ 第 30 帧 mask 最大亮度仅 **90/255**；改取第 100 帧 → **243/255** |
| 半重绘证据 | 参考帧 40 时第 30 帧「只换脸没换衣服」；参考帧 100 时同一帧已是新角色 |
| 结构自检 | 39 节点 / 46 连线 / 红 5 橙 1，`check.mjs` 通过 |

## 提示词

`prompt.txt` 是 H3 Ref2VA 六段式（英文）。本包的关键一句与老路一致：

> Keep the dance moves, camera work and rhythm of the original video, and only replace the person with the new character in the photo.

差别：这条链里提示词**只负责身份描述与「别站定」**，构图和动作由潜空间起点 + 剪影负责。所以不要再写「镜头推近/拉远」这类句子——否定句会反噬。

## 已知限制

1. **参考帧必须是人物最大、最清晰的一帧**。人物太小时 MatAnyone2 给的是弱 alpha（实测 90/255），`SetLatentNoiseMask` 把它当 denoise 系数用，等于只重绘 35% → 原角色留在画面里。
2. **远段人物会被画大约 30%**（帧30：原片 5% → 成片 12%）。剪影给多大，模型就画多大；要压小只能把剪影调紧，但会裁袖子。
3. **前 26 帧人物只有几十像素**，换不换看不出；这一段本来也没有有效脸部信息。
4. **近景镜（人占满画面）不适用本包参数**：剪影接近全幅时，遮罩外没有像素可保护，背景保护失效，需另调。
5. `SamplerCustomAdvanced` 吃带 `noise_mask` 的 AV 潜空间没问题，但**单帧 mask 会广播到全部帧**——想要逐帧差异就得逐帧喂（本包正是靠 MatAnyone2 输出多帧 mask）。
6. 平台 fileName 约 1 天过期，过期重传只换 `build.mjs` 顶部 `ASSETS`。

## 复现

```bash
node build.mjs     # → workflow.ui.json（39 节点 / 46 连线）
node check.mjs     # → 结构自检 + 导出 workflow.api.json（用完删）
```

API 图直投（不经网页导入）：

```bash
node <skills>/runninghub-workflow-lab-yashu/scripts/rhx.mjs run \
  --workflow "<本目录>/workflow.api.json" --out "<产物目录>" --name v1 --timeout 900
```
