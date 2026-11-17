# H3 音频驱动数字人 · 语音克隆 · TTS 补静音

**一句话用途**：一张人物图 + 一段参考音频 + 一段文本 → 用 Qwen3-TTS 克隆音色念出文本 → 把配音前后补静音、凑成 H3 要的 17k+5 帧 → H3 生成该人物按配音说话的视频（音轨即这份配音）。

> **状态：未实测（2026-11-18 入库，老板指令：先只入库，不跑、不做封面）。**
> 本包只有 `workflow.ui.json` + `record.md`，**缺 `build.mjs` / `check.mjs` / `templates/` / `cover-3x4.jpg`**，不满足 `verified/README.md` 的六条入库标准。等真正要用时再补实测数据与封面。

## 来源

| 项 | 值 |
|---|---|
| workflowId | `2086995655117070338` |
| 页面 | https://www.runninghub.cn/post/2086995655117070338 |
| 官方标题（detail 接口核实） | `MinimaxH3音频驱动+语音克隆` |
| 作者 | `user_phlc4wkm` |
| 标签 | 数字人 |
| 使用量 / 赞 / 收藏 | 26 / 0 / 0（2026-11-18） |
| 站内节点数 | 30（本地 UI 图 31 节点 / 38 连线） |
| 本地源文件 | `D:\download\chrome\MinimaxH3音频驱动+语音克隆.json` |

## 输入（三样）

| 槽 | 节点 | 说明 |
|---|---|---|
| 人物图 | `LoadImage(137)` → `MiniMaxH3ReferenceToVideo.ref_images.ref_image_0` | 只用了 1 张；`ref_image_1` 空 |
| 参考音频 | `LoadAudio(197)` → `AudioCrop(198)` 截 `0:00–0:20` | 只取前 20 秒当克隆样本，同时用于自动转写 |
| 台词 | `CR Text(195)` | 给 Qwen3-TTS 念的文本（默认是英文口播稿） |
| H3 提示词 | `PrimitiveStringMultiline(138)` → `MiniMaxH3ReferenceToVideo.prompt` | 画面/动作/口型要求，默认一段「倒液体 + 对镜头说话」 |

## 拓扑（按信号流）

1. **参考音频分析**：`LoadAudio(197)` → `AudioCrop(198, 0:00–0:20)` → `HeartMuLa_Transcribe(196)` 自动转写 → `easy showAnything(200)` 显示参考文本 → `Qwen3TTSVoiceClone.参考文本`。
2. **配音生成**：`Qwen3TTSModelLoader(199)`（`Qwen/Qwen3-TTS-12Hz-1.7B-Base`, cuda, fp16）+ 参考音频 + `CR Text(195)` → `Qwen3TTSVoiceClone(201)`。
3. **补静音**：配音 → `AudioBeforeAfterSilence(202)`，`before=0.4` 秒、`after=0` 秒。**这是本包最值钱的一颗节点**，技法见 `references/音频补静音与时长凑帧.md`。
4. **时长 → 帧数**：补静音后的音频 → `SoundFlow_GetLength(179)` 出秒数 → `PrimitiveFloat(132)` → `ComfyMathExpression(131)` 算成 17k+5 → 接 `MiniMaxH3ReferenceToVideo.length`（INT 槽，link 槽位 1）。
5. **画面条件**：`ResolutionSelector(115)`（9:16 竖幅 / 0.5 MP / multiple 32）→ width/height；`LoadImage(137)` → `ref_image_0`。
6. **生成**：`MiniMaxH3ReferenceToVideo(136)` + 配音进 `VRGDG_MiniMaxH3AudioDrive(172).source_audio` → `av_latent` → `SamplerCustomAdvanced(125)` → `VAEDecode(122)` → `VHS_VideoCombine(142)`（24fps / h264-mp4 / crf 19 / 音轨来自 AudioDrive）。
7. **旁路**：`PreviewAudio(188)` 直接试听补静音后的配音。

## 关键参数（图内默认）

| 项 | 值 |
|---|---|
| 分辨率 | `ResolutionSelector` 9:16 (Portrait Widescreen)、0.5 MP、32 对齐；`Ref2VA` 里 1344×768 只是控件占位，实际被连入值覆盖 |
| 帧数 | `length` 由音频长度实时算，`Ref2VA` 的 124 是占位；`PrimitiveFloat` 的 8 秒同样被 `GetLength` 覆盖 |
| 采样 | `BasicScheduler` simple / **20 步** / denoise 1；`KSamplerSelect` `res_multistep`；无 LoRA、无二采 |
| 模型 | UNET `minimax_h3_ref2va_int8_convrot`；CLIP `qwen3vl_32b_minimax_h3_int8_convrot`（type `minimax`）；视频 VAE `minimax_h3_video_vae_fp16`；音频 VAE `minimax_h3_audio_vae_fp32` |
| 显存补丁 | `PathchSageAttentionKJ(175, auto)` → `MiniMaxH3MemoryEfficientSageAttentionPatch(176)` |
| TTS | 语言 `自动`；最大 2048 token；seed 固定；**语速 1**；批量模式关；高级采样（top_p 0.8 / top_k 50 / temp 0.8 / rep 1.1）**未启用** |
| 输出 | `VHS_VideoCombine` 24fps、crf 19、`save_output=true`、`trim_to_audio=false`、prefix `AnimateDiff` |

## 可复用的两个技法

1. **音频前后补静音**：`AudioBeforeAfterSilence`（ComfyUI_Lam，显示名「音频前后加静音」），`before` / `after` 单位是**秒**，输出仍是 `AUDIO`。
2. **音频长度 → H3 帧数**：`SoundFlow_GetLength` → `ComfyMathExpression`，一行表达式把任意秒数抬到最近的 `17k+5`。

完整接线、公式推导、踩坑写在 [`references/音频补静音与时长凑帧.md`](../../references/音频补静音与时长凑帧.md)。

## 已知限制 / 风险（都没实测，属读图结论）

- **顺序不能反**：先补静音，再测长度，再算帧。如果先测原音频长度再补静音，成片尾部会缺 0.4 秒画面。
- **前补 0.4 秒会进成片**：这段静音同样要被生成画面（人物闭嘴站 0.4 秒）；不想留就把 `before` 调小。
- **后补静音慎用**：`after>0` 会让 H3 在尾部生成一段「无声定格」，默认给 0 是对的。
- **参考音频只取前 20 秒**：`AudioCrop` 写死 `0:00–0:20`，样本更长也会被截。
- **转写质量决定克隆质量**：参考文本由 `HeartMuLa_Transcribe` 自动生成；背景吵或有口音时转错，音色会漂，需要手改 `easy showAnything` 或直接断开改手填。
- **单图 + 单音频**：`ref_image_1`、`ref_video_*`、`ref_audio_1/2` 全空，只适合单人单声道；双人对话要另找双人包。
- **站内 30 节点 vs 本地 31 节点**：差 1，可能是站内版本隐藏了某个节点；下次实测前先以本地图为准。
- **20 步无 turbo**：成本约为 4 步 turbo 的 5 倍，长时间口播不划算。
- `filename_prefix` 是默认的 `AnimateDiff`，成片文件名可读性差。

## 启用时要做的事

1. 跑 `node scripts/rhx.mjs smoke` 验通道。
2. 用本地图 `--dry-run` 核对提交体，再真跑一次，回填实测数据（分辨率 / 帧数 / 时长 / 帧间差 / 音频电平）。
3. 补 `check.mjs`、`build.mjs`、`templates/`，按 `verified/README.md` 六条标准补齐。
4. 出封面 `cover-3x4.jpg`（3:4、霞鹜文楷叠主副标），文案写回本文件。
5. 把 `verified/README.md` 的状态从「未实测」改成实测结论。
