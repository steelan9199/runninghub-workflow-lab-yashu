# H3 单人换人 · 远景楼梯舞 · 4 步 turbo · 一采 · 无声

> **标记：这是把人物替换成功的那条工作流。** 老板 2026-11-16 看过成片确认「4 步也没问题」，镜1 人物替换成功，正式入库。

**一句话用途**：一条**远景单人跳舞**的实拍镜头，要把原片里的人整身换成参考图人物，动作 / 镜头 / 楼梯砖墙背景保持原样——用「原片当运动参考 + 人物三视图当身份参考 + 4 步 turbo LoRA」一采直出，成本只有 20 步版的约 1/5。

> 实测状态：**平台跑通**（2026-11-16，镜1 / 124 帧 / 864×736）。成片 `joker02_shot1_124f_turbo4_00001_p82_psmel_1794768542.mp4`，taskId=2122038682545520641。

## 适用场景

- 远景 / 中远景，人在画面里占比小（本包实测人物约占画面 5–12%），背景占大头。
- 单镜、不硬切、镜头固定或轻微运动。
- 只换人，不换场地：砖墙、铁消防梯、蓝灯柱、天空要保下来。
- 明确不需要二采的场景：出片尺寸 = 生成尺寸时，二采没有存在理由。

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

- 结构要点：这条不是「遮罩重绘」路线，**H3 的 LATENT 直接接采样器**，身份靠 `ref_image_0` + 提示词，动作与构图靠 `ref_video_0`。
- 红 5：源片、人物三视图、提示词、出片宽、出片高。橙 1：`VHS_VideoCombine`。
- 4 步 turbo 契约：LoRA `mode=0`（不是 bypass）+ `strength 1.0`；`BasicScheduler` beta / 4 步 / denoise 1；`H3SigmaRefiner.extra_steps=0`；`SplitSigmas.step=999`。四个值一起改才有意义，单独改会拿到「步数不是 4」的伪 4 步。

## 默认参数

| 项 | 值 |
|---|---|
| 源片 | `shot1_124f.mp4`（平台 `openapi/e2770006….mp4`），864×736 / 124 帧 / 24fps |
| 载入 | `frame_load_cap=124`、`skip_first_frames=0`、`select_every_nth=1`、`force_rate=24` |
| 生成尺寸 | 864×736（32 的倍数；一采直出，无放大、无二采） |
| 时长 | 124 帧 / 24fps = 5.1667s（17k+5 网格：124 = 17×7+5） |
| LoRA | `minimax_h3_turbo_4step_ckpt500.safetensors`，strength 1.0，**启用** |
| UNET | `minimax_h3_ref2va_int8_convrot.safetensors` |
| CLIP / VAE | `qwen3vl_32b_minimax_h3_int8_convrot` / 视频 `minimax_h3_video_vae_fp16` / 音频 `minimax_h3_audio_vae_fp32` |
| 采样 | euler + beta **4 步** + **denoise 1**；`H3SigmaRefiner` extra=0（关）；`SplitSigmas` 999（不切） |
| 参考图 | 人物三视图 `openapi/19bb73ad….png` → `ref_image_0`，`ref_image_size=match` |
| 噪声 | fixed `20261115` |
| 输出 | 24fps、`video/h264-mp4`、`yuv420p`、crf 19、`joker02_shot1_124f_turbo4`、**无音轨** |

## 实测数据

| 项 | 值 |
|---|---|
| 成片规格 | 864×736 / 124 帧 / 24fps / 5.1667s / 2.21 Mbps / 无音轨 |
| 帧间差（tblend difference + signalstats YAVG） | 均值 **10.094**，峰值 **14.77** |
| 同提示词 20 步版对照 | 均值 8.80，峰值 12.79 → **4 步动作反而更活** |
| 身份核对 | 长袍、长发、短须 + 长尖下垂胡、素颜全部到位 |
| 背景核对 | 楼梯 / 砖墙 / 铁消防梯基本保留；底部橙色光斑 4 步版更接近原片 |
| 结构自检 | 26 节点 / 28 连线 / 红 5 橙 1，`check.mjs` 通过；`build.mjs` 重建与源文件语义等价（仅 #11/#13 补色与说明卡不同） |

### 4 步 vs 20 步（成本对照）

| 项 | 4 步 turbo（本包） | 20 步 |
|---|---|---|
| LoRA | 启用 strength 1.0 | bypass |
| 调度器 | beta / 4 步 | beta / 20 步 |
| 提示词 / seed / 参考图 / 帧长 / 分辨率 | 完全相同 | 完全相同 |
| 成本 | 1× | 约 5× |
| 身份 / 动作 | 换人成功、动作更活 | 无明显提升 |

**结论：4 步为默认档，20 步只留作细节救援档。**

## 提示词

`prompt.txt` 是图内 positive 提示词原文（H3 Ref2VA 六段式英文，一字未改）。三段关键约束：

1. `subject_definitions` 里把参考片、人物三视图、新角色三样写死（金冠 + 横pin、发髻、长黑发、短须 + 长尖下垂胡、素颜、浅冰蓝长袍）。
2. `summary` 以 `[video editing + reference generation] The target video is an edited version of <Video 1>.` 开头，点明「只换人，场地与镜头不动」。
3. `retention_analysis` 用 `fully_preserved` / `partially_preserved` 分出「结构和舞蹈全保、人物身份 partial」；`detailed_description` 把景别写死为 **静态极宽仰拍、无切无推拉**，这是防模型把镜头推近的关键句。

## 封面

- 主标：**把人物换掉，只用 4 步**
- 副标：**H3 单人换人 · 远景楼梯舞 · 124 帧**
- 文件：`cover-3x4.jpg`，1680×2240（严格 3:4），纯 CSS 几何/渐变渲染（深色石阶竖向构图），文字为霞鹜文楷叠字，无任何可识别影视角色或真实人脸。

## 已知限制

1. **尾 5 帧是克隆补帧**：124 帧按 17k+5 网格补齐，最后几帧没有新画面。
2. **平台水印**：左上角烧「RunningHub AI生成」，成片即带，需裁切或遮盖。
3. **远景细部要靠肉眼**：人物占比小，金冠纹样、pin、须形要放大逐帧看。
4. **背景有漂移**：蓝灯柱、铁消防梯相对原片位置轻微变化，不是像素级还原。
5. **无声**：图内音轨不接输出，原声要从源片轨另取后合成。
6. 平台 `fileName` 约 1 天过期，过期只换 `build.mjs` 顶部 `ASSETS` 再重传。

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
