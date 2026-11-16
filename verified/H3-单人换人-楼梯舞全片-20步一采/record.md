# H3 单人换人 · 楼梯舞全片 · 20 步一采 · 无声

> **标记：老板 2026-11-17 看过成片确认可用，入库。本包的重点是「提示词」——一条 345 帧长序列、两段视角的单条素材，怎么把身份锚点写死又不触发发光。**

**一句话用途**：一条 **14.375 秒、345 帧、单文件、视角中途从俯视翻成仰视**的实拍楼梯舞，要把原片里的人整身换成参考图人物，动作 / 镜头高度 / 街道与墙面背景全部照旧——用「原片当运动与构图参考 + 人物三视图当身份参考 + LoRA bypass + 20 步」一采直出。

## 适用场景

- 长序列（300–400 帧）换人，且**同一条素材内含视角翻转**（高机位俯视 → 低机位仰视）。
- 人物占比从「小远景」一路放大到「画面 1/3–1/2 高」的连续推近。
- 只换人、不换场地：街道停放的车、垃圾袋、铁栏杆、涂鸦墙、灯柱要保下来。
- 出片尺寸 = 生成尺寸，不需要放大与二采。

## 拓扑（26 节点 / 28 连线，红 5 橙 1）

```
UNETLoader → LoraLoaderModelOnly（4 步 turbo · strength 1.0 · **bypass mode=4**）
           → PathchSageAttentionKJ → MiniMaxH3MemoryEfficientSageAttentionPatch ─┬→ BasicScheduler（beta / 20 步 / denoise 1）
                                                                                 └→ BasicGuider
VHS_LoadVideo(源片 345 帧) ─┬→ ref_videos.ref_video_0 ──→ MiniMax H3
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

- 结构要点：H3 的 LATENT 直接接采样器，**不是遮罩重绘**；身份靠 `ref_image_0` + 提示词，动作与构图靠 `ref_video_0`。
- 红 5：源片、人物三视图、提示词、出片宽、出片高。橙 1：`VHS_VideoCombine`。

## 默认参数

| 项 | 值 |
|---|---|
| 源片 | `小丑03_345f.mp4`，864×736 / 345 帧 / 24fps / 14.375s / 带 aac 原声 |
| 载入 | `frame_load_cap=345`、`skip_first_frames=0`、`select_every_nth=1`、`force_rate=24` |
| 生成尺寸 | 864×736（32 的倍数；一采直出，无放大、无二采） |
| 时长 | 345 帧 / 24fps = 14.375s（17k+5 网格：345 = 17×20+5） |
| LoRA | `minimax_h3_turbo_4step_ckpt500.safetensors`，strength 1.0，**bypass（mode=4）** |
| UNET | `minimax_h3_ref2va_int8_convrot.safetensors` |
| CLIP / VAE | `qwen3vl_32b_minimax_h3_int8_convrot` / 视频 `minimax_h3_video_vae_fp16` / 音频 `minimax_h3_audio_vae_fp32` |
| 采样 | euler + beta **20 步** + **denoise 1**；`H3SigmaRefiner` extra=0（关）；`SplitSigmas` 999（不切） |
| 参考图 | 人物三视图 → `ref_image_0`，`ref_image_size=match` |
| 噪声 | fixed `20261115` |
| 输出 | 24fps、`video/h264-mp4`、`yuv420p`、crf 19、`joker03_all_345f_20step`、**无音轨** |

## 实测数据

| 项 | 值 |
|---|---|
| 成片 | `joker03_all_345f_20step_00001_p82_bcenc_1794847502.mp4` |
| 规格 | 864×736 / 345 帧 / 24fps / 14.375s / 1324 kbps / 2.38 MB / 无音轨 |
| 帧间差（tblend difference + signalstats YAVG） | 均值 **3.900**，峰值 **57.553**（落在约 4.9s 的视角翻转处），最低 0.570 |
| 身份核对（抽 1s / 6s / 9s / 13s） | 金冠 + 横簪、黑发髻 + 长直黑发、粗平眉、短须 + 长尖黑山羊胡、素颜、浅蓝棉袍 + 白交领 + 深蓝绣花门襟袖口、白裤黑鞋全部到位；两段视角下同一人 |
| 背景核对 | 街道停车、垃圾袋、铁栏杆、灯柱、涂鸦墙、两墙间的天空全部保留 |
| 发光核对 | 无浅蓝自发光（这是本包与 4 步版的核心差异） |
| 镜头核对 | 0–4.9s 俯视、4.9s 起仰视，人物由小放大到画面 1/3–1/2 高，与源片一致 |
| 结构自检 | 26 节点 / 28 连线 / 红 5 橙 1，`check.mjs` 通过 |

## 提示词（本包的重点）

`prompt.txt` 是图内 positive 原文（H3 Ref2VA 六段式英文）。与 4 步版最大的不同，是把「**镜头被读错**」当成头号风险来处理：

1. **按真实素材写视角，不按想当然写。** 交接文档曾写「单镜到底、无切点」，抽帧核对后发现 0–4.9s 是高机位俯视沿台阶看向下方街道、4.9s 起是低机位仰视望向两墙之间的天空。`subject_definitions` 与 `retention_analysis` 全部按真实两段写，并写明「相机保持自己的高度、俯仰与距离」。
2. **收尾按真实动作写，不写「站定」。** 源片最后一帧仍在舞、右臂高举；若照交接文档写「停下、双臂展开」，H3 会把整段收成站姿（同族实测：文本违背视频 = 视频被覆盖）。
3. **身份锚点逐段重复，不做逐件堆叠。** 每段都用同一串锚点：金冠横簪 / 黑发髻 + 长直黑发 / 粗平黑眉 / 短黑须 / 长尖黑山羊胡 / 素颜 / 浅蓝棉袍 / 白交领 / 深蓝绣花门襟袖口 / 白裤黑鞋；服饰只写整身取自 `<Picture 1>` + 一句哑光材质。
4. **材质句固定三词**：`plain woven cotton` / `flat matte` / `dull surface, natural creases`。
5. **去光词表**：全程不出现 `ice`、`cool teal`、`rim`、`flare`、`bright`、`catching the light`、`silver`，也不写「no dissolve / no flash」这类含触发词的否定句。

## 已知限制

1. **平台水印**：左上角烧「RunningHub AI生成」，成片即带。
2. **尾部无补帧空间**：345 已是 17k+5，末帧仍为真实动作帧，不是克隆帧。
3. **视角翻转不靠提示词控制**：翻转来自源片本身；提示词只负责让模型别把机位改掉，切点位置由参考视频决定，可能前后漂一两帧。
4. **无声**：图内音轨不接输出，原声从源片轨另取后合成。
5. **20 步成本约为 4 步的 5 倍**；长序列上这是买「不发蓝」的代价，不是画质偏好。
6. 平台 `fileName` 约 1 天过期，过期从 `assets/` 重传后换 `build.mjs` 顶部 `ASSETS`。

## 封面

- 主标：**345 帧一条，换个活人**
- 副标：**H3 楼梯舞全片换人 · 20 步 · 视角翻转不断**
- 文件：`cover-3x4.jpg`，1680×2240（严格 3:4），纯 CSS 几何/渐变渲染（竖向石阶 + 两墙夹道构图），文字为霞鹜文楷叠字，无可识别影视角色或真实人脸。

## 复现

```bash
node build.mjs     # → workflow.ui.json（26 节点 / 28 连线）
node check.mjs     # → 结构自检 + 导出 workflow.api.json（用完删）
```

API 图直投（不经网页导入）：

```bash
node <skills>/runninghub-workflow-lab-yashu/scripts/rhx.mjs run \
  --workflow "<本目录>/workflow.api.json" --out "<产物目录>" --name v1 --timeout 1800
```
