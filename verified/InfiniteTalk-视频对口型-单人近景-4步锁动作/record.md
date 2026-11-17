# InfiniteTalk 视频对口型 · 单人近景 · 4 步锁动作

**一句话用途**：拿一条**已经有表演的现成视频** + 一段新配音，只重画嘴和面部，保留原片的转头、抬眉、运镜与背景 —— 给短剧/推文镜头换中文台词用。

**来源**：RunningHub 帖子 `2000589265400721409`（作者 予梦-Ai，2026-09-15，`超强视频对口型（唱歌数字人）`）的 UI 图，按本片参数改造。

**和库里另一条数字人工作流的区别（别选错）**：
- 帖子 `2118402573337186305`（ZeroAI）是 **一张图 + 音频 → 重生成整段**，原片表演全丢，只适合「干脆重做成口播数字人」。
- 本包是 **一段视频 + 音频 → 只改嘴**，原片表演、运镜、背景保留。要「给现成镜头换台词」就用这一条。

---

## 输入契约

| 槽位 | 节点 | 要求 |
|---|---|---|
| 原片 | `228 VHS_LoadVideo` | 单镜、单张脸、正脸到 3/4 侧脸；片中不能有硬切（硬切必须切段） |
| 配音 | `125 LoadAudio` | mp3/wav，单声道人声；`159 AudioCrop` 控制取用区间（默认 0:00–0:04） |
| 画幅 | `315 / 317 easy int` | 必须 16 的倍数，且**与源片同尺寸**（本片 864×736），否则 `ImageResizeKJv2` 会裁掉头冠/下巴 |
| 帧数 | `270 INTConstant` + `194 num_frames` | 两处必须同值 = `round(音频秒数 × 25)`；`228 frame_load_cap` 也要等于它 |

## 拓扑（28 节点 / 31 连线）

```
VHS_LoadVideo → ImageResizeKJv2(864×736) ─┬─ WanVideoEncode ──────────→ WanVideoSampler.samples
                                          └─ GetImageRangeFromBatch(0,1) ─┬─ WanVideoClipVisionEncode
                                                                          └─ ImageToVideoMultiTalk.start_image
LoadAudio → AudioCrop → AudioSeparation(人声) → MultiTalkWav2VecEmbeds(中文 wav2vec2) ─→ Sampler.multitalk_embeds
WanVideoTextEncodeCached(正向/负向) ───────────────────────────────────→ Sampler.text_embeds
Sampler → WanVideoDecode → VHS_VideoCombine(25fps, 音轨用 AudioCrop 后的原声)
```

模型：`Wan2_1-I2V-14B-480p_fp8_e4m3fn_scaled_KJ` + `InfiniteTalk/Wan2_1-InfiniteTalk-Single_fp8_e4m3fn_scaled_KJ`，LoRA `lightx2v_I2V_14B_480p_cfg_step_distill_rank64_bf16`。

## 默认参数（本片实测这套能跑）

| 参数 | 值 | 理由 |
|---|---|---|
| 画幅 | 864×736 | 与源片一致、16 的倍数，不裁不缩 |
| 帧数 | 84 | 音频 3.336s × 25fps = 83.4；`frame_load_cap` 同步 84 |
| 步数 / cfg / shift | 4 / 1 / 11 | 蒸馏 LoRA 配 cfg 1 |
| `start_step` / `add_noise_to_samples` | 2 / true | 跳过前 2 步，只轻改嘴，锁死原片动作 |
| `block_swap` | 20 | fp8 14B + 864×736 的起步值，OOM 调到 30–40 |
| `audio_scale` | 1.5 | 口型幅度；侧脸不够明显就往 1.8 试 |
| 采样器 | dpm++_sde / seed randomize | |
| 输出 | `shot02_lipsync`，25fps，`trim_to_audio=false` | |

## 实测

- 源片：`01_shot02_红衣大臣_3.542s.mp4`（864×736 / 85 帧 / 24fps / 3.542s，从 6.583s 原片按场景切出）
- 配音：`胡宗宪_退位.mp3`（3.336s / 24kHz / 单声道）
- **老板在 RH 平台跑通，成片层面确认「效果还行」**（2026-11-17）
- 3/4 侧脸可用，这是本包相对纯图像驱动数字人的核心优势

## 已知限制

1. **画幅必须等于源片**：改比例就会被 `crop` 裁头。换片先量源片宽高，两边同时改 `315/317`、`230`、`192`。
2. **帧数三处必须一致**：`270`、`194.num_frames`、`228.frame_load_cap`。只改一处会报长度不匹配或尾部补黑。
3. **画面会比原镜头短**：对齐音频要裁掉尾巴（本片少 0.18s）。要保留全长就先把音频补静音到画面长度。
4. **单张脸**：两人同框或镜头内有硬切会串脸/断跟踪，必须按镜切段分别跑。
5. **平台水印**：RH 出片右上角烧「RunningHub AI生成」。
6. 中文 wav2vec2 只认中文；配英文台词口型会不准。

## 复用步骤

1. 拿本目录 `workflow.ui.json`，拖进 RunningHub「导入工作流」。
2. 拍三处红色节点：`228` 换视频、`125` 换音频、`241` 改提示词（人物/服饰/景别，别写否定句）。
3. 量源片宽高与音频时长，改 `315/317`、`270`、`194`、`228.frame_load_cap`。
4. 跑完抽 0.5s / 2s / 末尾三帧验收：嘴逐字开合、官帽/胡须不变形、人物身份没漂。

## 封面

`cover-3x4.jpg`（1680×2240，严格 3:4，2026-11-17 补）。系列 05/05：主标「只改嘴 / 别的不动」，副标「InfiniteTalk 视频对口型 · 84 帧」，角标 `05`，底部标 `InfiniteTalk · Wan2.1`。深墨底 + 金色细线 + 朱红角标，霞鹜文楷本地叠字，画面无人物面孔。
