# H3 单人换人 · 中近景烟雾镜 · 4 步 turbo · 一采 · 无声

> **标记：老板 2026-11-16 验收「这次基本上是符合原视频的」。** 夹烟 → 扔烟 → 一次吐一大团烟的动作、浅蓝长袍、素颜身份都对；嘴部张合问题老板明确决定不再追。入库保留验收那一版提示词（v3），v4 / v5 的嘴部实验未通过，不随包。

**一句话用途**：一条**中近景（胸上）单人、带抽烟动作**的实拍镜头，要把原片里的人整身换成参考图人物，动作 / 吐烟 / 砖墙背景保持原样——用「原片当运动参考 + 人物三视图当身份参考 + 4 步 turbo LoRA」一采直出。

> 实测状态：**平台跑通**（2026-11-16）。验收成片 `joker02_shot2_124f_turbo4_00003_p83_sdnum_1794782477.mp4`。

## 适用场景

- 中近景 / 胸上景别，单人，头部约占画面高度 1/3，脸大、五官清晰。
- 单镜、不硬切、镜头固定。
- 有抽烟 / 吐烟一类的「烟雾道具」动作，需要烟雾与原片同步。
- 人脸大、需要身份一致性落在正脸上；同时不希望模型把表情改成笑。

## 拓扑（26 节点 / 28 连线，红 5 橙 1）

```
UNETLoader → LoraLoaderModelOnly（4 步 turbo · strength 1.0 · 启用）
           → PathchSageAttentionKJ → MiniMaxH3MemoryEfficientSageAttentionPatch ─┬→ BasicScheduler（beta / 4 步 / denoise 1）
                                                                                 └→ BasicGuider
VHS_LoadVideo(原片 124 帧) ─┬→ ref_videos.ref_video_0 ──→ MiniMax H3
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

- 与镜1 远景包同一套结构，只换源片、帧数、提示词、输出前缀。
- 红 5：源片、人物三视图、提示词、出片宽、出片高。橙 1：`VHS_VideoCombine`。
- 4 步 turbo 契约：LoRA `mode=0` + `strength 1.0`；`BasicScheduler` beta / 4 步 / denoise 1；`H3SigmaRefiner.extra_steps=0`；`SplitSigmas.step=999`。四个值一起改才有意义。

## 默认参数

| 项 | 值 |
|---|---|
| 源片 | `shot2_124f.mp4`（平台 `openapi/5a334181….mp4`），864×736 / 124 帧 / 24fps |
| 载入 | `frame_load_cap=124`、`skip_first_frames=0`、`select_every_nth=1`、`force_rate=24` |
| 生成尺寸 | 864×736（32 的倍数；一采直出，无放大、无二采） |
| 时长 | 124 帧 / 24fps = 5.1667s（17k+5 网格：124 = 17×7+5） |
| LoRA | `minimax_h3_turbo_4step_ckpt500.safetensors`，strength 1.0，**启用** |
| UNET | `minimax_h3_ref2va_int8_convrot.safetensors` |
| CLIP / VAE | `qwen3vl_32b_minimax_h3_int8_convrot` / 视频 `minimax_h3_video_vae_fp16` / 音频 `minimax_h3_audio_vae_fp32` |
| 采样 | euler + beta **4 步** + **denoise 1**；`H3SigmaRefiner` extra=0（关）；`SplitSigmas` 999（不切） |
| 参考图 | 人物三视图 `openapi/19bb73ad….png` → `ref_image_0`，`ref_image_size=match` |
| 噪声 | fixed `20261115` |
| 输出 | 24fps、`video/h264-mp4`、`yuv420p`、crf 19、`joker02_shot2_124f_turbo4`、**无音轨** |

## 实测数据

| 项 | 值 |
|---|---|
| 成片规格 | 864×736 / 124 帧 / 24fps / 5.1667s / 1,133,751 B / 1.755 Mbps / 无音轨 |
| 帧间差（tblend difference + signalstats YAVG，123 个采样） | 均值 **10.123**，峰值 **16.26** |
| 动作核对 | 开场右手夹烟在嘴边（烟离嘴带出一小缕）→ 第 1 秒甩手扔烟 → 约 1.8 秒一次吐烟、2.0–2.3 秒烟团糊脸 → 2.5 秒后脸恢复、继续摇摆张臂 |
| 身份核对 | 金冠 + 横簪、发髻、长黑发、短须 + 长尖下垂胡、素颜、浅冰蓝长袍（白交领 / 深蓝绣花门襟与袖口）到位 |
| 背景核对 | 砖墙、右上白天空、右下两盏浅黄灯形保留 |
| 结构自检 | 26 节点 / 28 连线 / 红 5 橙 1，`check.mjs` 通过；帧数网格 124 = 17×7+5，`frame_load_cap` 与 `length` 一致 |

## 提示词

`prompt.txt` 是图内 positive 提示词原文（H3 Ref2VA 六段式英文）。三条关键约束：

1. **吐烟只算一次**：开场嘴边那缕是烟带出来的（`a small wisp ... as he draws it away`），真正的主动吐烟只有约 1.8 秒那一大团，2.0–2.3 秒最浓并正面糊脸。
2. **全篇不写 smile / grin / laugh**：小丑的彩绘嘴远看像在笑，词里一写「笑」就会把笑做实；改成正面的 `lips closed in a straight level line`、`calm, grave`。
3. **服装写死**：浅蓝及踝长袍 + 白交领 + 深蓝绣花门襟/袖口，明确「从喉咙到脚踝整套都是长袍」，挤掉源片西装。

## 封面

- 主标：**把中近景的人整身换掉**
- 副标：**烟雾镜 · 夹烟 / 扔烟 / 一次吐烟 · 124 帧 · 864×736 · 无声**
- 文件：`cover-3x4.jpg`，1680×2240（严格 3:4），纯 CSS 几何/渐变渲染（深青底 + 锈橙台阶斜带 + 烟雾光斑），文字为霞鹜文楷叠字，无任何可识别影视角色或真实人脸。

## 已知限制

1. **吐烟后嘴仍会小幅张合**，看起来像在说话。v4 已在画面描述里写死「2.4 秒后闭唇锁嘴」、v5 把嘴降为 `weak_reference` 并把嘴形改由参考图提供，两版出片仍然张合；老板 2026-11-16 决定不再追（「说话就说话吧」）。本包保留验收那一版（v3），未包含 v4 / v5。
2. **2.0–2.3 秒烟团正面糊脸**，该段不判身份一致性；验脸看 0–1.7 秒与 2.5 秒之后。
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
