# H3 单人换人 · 全身楼梯舞 · 4 步 turbo · 一采 · 无声

> **标记：结构自检通过，成片尚未跑。** 2026-11-16 出图，老板要求先入库备跑；首跑后把实测数字回填本卡。

**一句话用途**：一条**全身入画的楼梯舞**镜头，要把原片里的人整身换成参考图人物，动作 / 镜头 / 楼梯间背景保持原样——用「原片当运动参考 + 人物三视图当身份参考 + 4 步 turbo LoRA」一采直出。

> 实测状态：**未出片（仅结构自检）**。源片 `shot3_107f.mp4`，107 帧 / 4.458s。

## 适用场景

- 中远景 / 全身入画（本包人物占画面高度约 70–80%），比远景难、比近景易，身份主要落在全身比例与服装。
- 单镜、不硬切、镜头固定或轻微运动。
- 需要保留楼梯 / 扶手 / 混凝土墙一类的空间结构，只换人。
- 明确不需要二采：出片尺寸 = 生成尺寸。

## 拓扑（26 节点 / 28 连线，红 5 橙 1）

```
UNETLoader → LoraLoaderModelOnly（4 步 turbo · strength 1.0 · 启用）
           → PathchSageAttentionKJ → MiniMaxH3MemoryEfficientSageAttentionPatch ─┬→ BasicScheduler（beta / 4 步 / denoise 1）
                                                                                 └→ BasicGuider
VHS_LoadVideo(原片 107 帧) ─┬→ ref_videos.ref_video_0 ──→ MiniMax H3
                            ├→ ref_video_audios.ref_video_audio_0
                            └（音轨不接输出）
LoadImage(人物三视图) ──────→ ref_images.ref_image_0 ──→ MiniMax H3
CLIPLoader → clip / VAELoader(视频) → vae / VAELoader(音频) → audio_vae ──→ MiniMax H3
MiniMax H3 ─┬→ positive → BasicGuider
            └→ LATENT   → SamplerCustomAdvanced.latent_image

BasicScheduler → H3SigmaRefiner（extra_steps 0，关）→ SplitSigmas（999，不切）→ SamplerCustomAdvanced.sigmas
RandomNoise(20261115 fixed) → noise ／ KSamplerSelect(euler) → sampler
SamplerCustomAdvanced.denoised_output → VAEDecode → VRAM_Debug（透传）→ VHS_VideoCombine
```

- 与镜2 中近景包同一套结构，只换源片、帧数、提示词、输出前缀。
- 红 5：源片、人物三视图、提示词、出片宽、出片高。橙 1：`VHS_VideoCombine`。

## 默认参数

| 项 | 值 |
|---|---|
| 源片 | `shot3_107f.mp4`（平台 `openapi/23e60aa9….mp4`），864×736 / 107 帧 / 24fps |
| 载入 | `frame_load_cap=107`、`skip_first_frames=0`、`select_every_nth=1`、`force_rate=24` |
| 生成尺寸 | 864×736（32 的倍数；一采直出，无放大、无二采） |
| 时长 | 107 帧 / 24fps = 4.4583s（17k+5 网格：107 = 17×6+5） |
| LoRA | `minimax_h3_turbo_4step_ckpt500.safetensors`，strength 1.0，**启用** |
| UNET | `minimax_h3_ref2va_int8_convrot.safetensors` |
| CLIP / VAE | `qwen3vl_32b_minimax_h3_int8_convrot` / 视频 `minimax_h3_video_vae_fp16` / 音频 `minimax_h3_audio_vae_fp32` |
| 采样 | euler + beta **4 步** + **denoise 1**；`H3SigmaRefiner` extra=0（关）；`SplitSigmas` 999（不切） |
| 参考图 | 人物三视图 `openapi/19bb73ad….png` → `ref_image_0`，`ref_image_size=match` |
| 噪声 | fixed `20261115` |
| 输出 | 24fps、`video/h264-mp4`、`yuv420p`、crf 19、`joker02_shot3_107f_turbo4`、**无音轨** |

## 实测数据

| 项 | 值 |
|---|---|
| 成片规格 | **未出片**；首跑后回填分辨率 / 帧数 / 码率 / 帧间差 |
| 源片规格 | 864×736 / 107 帧 / 24fps / 4.4583s / 1,056,891 B |
| 结构自检 | 26 节点 / 28 连线 / 红 5 橙 1，`check.mjs` 通过；`frame_load_cap=107` 与 `length=107` 一致 |
| 提示词抽样 | 无 smile / grin / laugh；`ice-blue robe`、`crown` 均命中 |

## 提示词

`prompt.txt` 是图内 positive 提示词原文（H3 Ref2VA 六段式英文）。三条关键约束：

1. **景别与尺寸钉死**：静态中远景、微仰拍、全身入画，头顶近上边、脚近下边，人物尺寸与源片一致（防 E08 把人画大）。
2. **动作按原片写**：站位 → 提右膝举右拳 → 摆左臂 → 双臂高举 → 落肩外张 → 双臂 V 字收尾。
3. **服装写全**：浅蓝及踝长袍 + 白交领 + 深蓝绣花门襟与袖口 + 白裤 + 黑布鞋；金冠横簪、长黑发、短须长尖胡；素颜、唇线平直、表情平静。

## 封面

- 主标：**一个人跳完整段楼梯**
- 副标：**全身楼梯舞 · 提膝 / 举拳 / 双臂 V 字 · 107 帧 · 864×736 · 无声**
- 文件：`cover-3x4.jpg`，1680×2240（严格 3:4），纯 CSS 几何/渐变渲染（深青底 + 锈橙台阶斜带 + 青蓝钢柱），文字为霞鹜文楷叠字，无任何可识别影视角色或真实人脸。

## 已知限制

1. **未出片**：帧间差 / 码率 / 嘴部与冠部表现都还没有实测数据。
2. **人物可能被画大**：全身占画面高度约 70–80%，比远景包大得多；首跑先核对人物尺寸与全身是否仍在画内。
3. **平台水印**：左上角烧「RunningHub AI生成」，成片即带，需裁切或遮盖。
4. **无声**：图内音轨不接输出，原声要从源片轨另取后合成。
5. 平台 `fileName` 约 1 天过期，过期只换 `build.mjs` 顶部 `ASSETS` 再重传。

## 复现

```bash
node build.mjs     # → workflow.ui.json（26 节点 / 28 连线）
node check.mjs     # → 结构自检 + 导出 workflow.api.json（用完删）
```

API 图直投（不经网页导入）：

```bash
node <skills>/runninghub-workflow-lab-yashu/scripts/rhx.mjs run \
  --workflow "<本目录>/workflow.api.json" --out "<产物目录>" --name v1 --timeout 900
```
