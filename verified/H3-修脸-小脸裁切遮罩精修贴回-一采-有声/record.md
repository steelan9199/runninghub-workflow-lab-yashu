# H3 修脸 · 小脸裁切遮罩精修贴回 · 一采 · 有声

**一句话用途**：一条救不回重拍的成片，人物脸只有 150–180 px、糊成一团——把脸逐帧裁到 512 画布，用 H3 Ref2VA 按参考图重画，再羽化贴回原片；**脸以外的像素、构图、动作和原声轨都不动**。

> 实测状态：**平台跑通两次**（2026-11-27）。输入 544×960 / 209 帧 / 8.708s / 24fps；`check_mask` 每一帧都认到脸；`check_refined` 脸已换成参考图人物；成片无方块、无灰块、无跳变。
> 第二版加了 `MVEx_MaskCleanup(269)` 并收紧裁切与羽化（crop 2.0 / feather 12 / dilation 16），老板验收「视频修脸正常」。
> 第三版（当前）在贴回前加 **VOSR2 终修（270/271）**，老板对比 `check_refined` 后判定「还是有点用」，定为默认。

## 为什么不在整帧上重绘

H3 的 img2img 在整帧尺度上是 denoise 1 级别的重生成：动作、口型、背景都会脱离原片。所以本包保留「裁脸 → 遮罩内重绘 → 羽化贴回」三段结构，把生成预算全花在脸上。

真正的坑不在结构，在遮罩：早期版本用 `SAM3_VideoTrack` 按文本 `"face"` 跟踪移动裁剪片，**中途丢目标** → 遮罩后段为空 → `SetLatentNoiseMask` 没有可重绘区域 → 精修输出 ≈ 输入（表现为「换脸没效果」）。本包改用检测框驱动的 `H3FaceMaskSAM`，遮罩逐帧由 163 的人脸框生成，不依赖文本提示。

## 拓扑（65 节点 / 68 连线，红 5 橙 1，7 组）

```
VHS_LoadVideo(9) ──┬─→ H3FaceTrackCrop(163, 512 画布 / crop 2.0 / largest_face)
                   │        ├─ crops ──→ H3FaceMaskSAM(265, 检测框 + SAM)
                   │        ├─ transform ──→ 265 / 191
                   │        └─ frame_count ──→ ComfyMathExpression(19/260/262) ──→ 164.length
                   ├─ H3FaceTrackCrop 输出 crops ──→ MiniMaxH3ReferenceToVideo(164) 的 ref_images 之外，
                   │     仅取 positive 条件；LATENT 输出不接
                   └─ audio ──→ TrimAudioDuration(261) ──→ 192.audio

265.masks ──→ MVEx_MaskCleanup(269, 收紧去头发/背景) ──┬─→ MVEx_MaskToLatentSpace(241) ──→ SetLatentNoiseMask(242, 视频段)
                                                       ├─→ H3FaceStitch(191).masks（羽化贴回）
                                                       └─→ MaskToImage(266) ──→ VHS_VideoCombine(267, check_mask)

SolidMask(251, 0 / 32×32) ──→ SetLatentNoiseMask(252, 音频段冻结)
242 + 252 ──→ LTXVConcatAVLatent(247) ──→ SamplerCustomAdvanced(174) ──→ VAEDecode(183)
VAEDecode → GetNode(207) ──→ VOSR2Upscale(271, 1× 终修) ──┬─→ 191.refined_crops ──→ 192（画面）+ 261（原声）→ VHS_VideoCombine(192)
                                                          └─→ VHS_VideoCombine(268, check_refined)
VOSR2ModelLoader(270) ──→ 271.model
```

- 结构要点：**164 的 LATENT 输出不接**，只吃它的 `positive`；采样器的 `latent_image` 来自 `LTXVConcatAVLatent`。
- 音频段用 `SolidMask` 全 0 冻结，所以原声不会被重绘，成片音轨取自 `TrimAudioDuration(261)`。
- **VOSR2 的位置在「修脸完成、贴回之前」**：只作用在 512 修脸裁片上，贴回基线仍是原片；`upscale=1` 所以尺寸不变，贴回比例不会错。
- `191.undetected_frames = composite_anyway`（源码该分支把逐帧权重置 None，避免检测缺失帧把贴回清零）。

## 默认参数

| 项 | 值 |
|---|---|
| 输入视频（9） | 544×960 / 209 帧 / 8.708s / 24fps，`4a757e9b…mp4` |
| 人脸参考图（257） | `face_ref_front_1024.png`（三视图裁出的正脸），平台 fileName `openapi/acb32ef…png` |
| 跟踪裁剪（163） | `face_yolov8n.pt`，confidence 0.35，**`crop_factor 2.0`**（脸占画布 1/2），canvas **512×512**，`canvas_mode manual`，smooth 21 / 51 gaussian，`per_frame`，identity_track on / 0.28，`largest_face` |
| 裁切时长（263） | 单次最长 **15 s**（512²×15s×8 步 ≈ 31 MP·秒，仍在 7.5 MP·秒安全线换算内） |
| 精修（164） | 8 步 `pika_h3_flex_turbo_8step_hd_ref2va` + `beta` 调度；提示词走节点 2（六段式，英文） |
| 采样（175 / 254） | `beta` / 8 步 / **denoise 0.35**（本片验收档，见下节）；`DifferentialDiffusion(strength=1)` |
| 遮罩（265 → 269 → 241） | `H3FaceMaskSAM` 0.93 / 0 / 5 → **`MVEx_MaskCleanup` 0.3 / shrink_grow / 12 / 4 / 16**（收紧去头发、按 4 帧窗口稳定边缘）→ `MVEx_MaskToLatentSpace` auto/max/max/36/1/both |
| 终修（270 / 271） | `VOSR2ModelLoader`：`VOSR2` / `default`；`VOSR2Upscale`：**upscale 1×（不改尺寸）**、`wavelet` 对齐、tile 512 / overlap 32、vae tile 1024 / overlap 32；**首次运行下载约 7 GB** |
| 贴回（191） | `face_only`，**mask_dilation 16，feather 12**，colour_match 1，blend 1，`composite_anyway` |
| 输出（192） | 24fps / `video/h264-mp4` / `yuv420p` / crf 19 / 带原声 |

## denoise 是唯一要调的钮

| denoise | 结果 | 结论 |
|---|---|---|
| 1.0 | 遮罩区整块重画：脸彻底换成参考图，**原片表情（微笑/口型）被一起擦掉** | 换人最狠，只适合表情不重要的镜头 |
| **0.35（本包默认）** | 收紧遮罩后本条片验收「修脸正常」；但老板在另一条片上报过 **0.35 保不住原人物表情** | 身份优先档；换镜头先看表情是否还跟原片 |
| 0.25 | **原人物表情保持住**，参考图负责把脸画清楚；老板验收「效果不错」 | 表情优先档，稳妥起点 |

原则：**先看表情再定档**。表情要紧（微笑、口型、情绪）→ 从 0.25 起；**能接受表情被重画**或这条镜头本来就没表情 → 0.35 换更强的身份。不要一次跨两档。

## 实测数据

| 项 | 值 |
|---|---|
| 成片规格 | 544×960 / 209 帧 / 8.708s / 24fps（与源片逐项一致） |
| `check_mask`（267） | 512×512 / 209 帧；老板逐帧确认**每一帧都盖住脸** |
| `check_refined`（268） | 512×512 / 209 帧；脸已换成参考图人物 |
| 成片（192） | 无方块、无灰块、无跳变；音轨保留 |
| 终修收益（VOSR2） | 老板 2026-11-27 对比 `check_refined` 后判定「还是有点用」，已定为默认；成片端仍受约 170 px 输出脸限制，收益集中在 512 裁片 |
| 帧间差 / 音频电平 | 未采样（本包只做画面验收，未跑逐帧 diff） |
| 结构自检 | 65 节点 / 68 连线 / 红 5 橙 1；`check.mjs` 通过；`layout-check` 0 错误 0 警告 |

## 已知限制

1. **denoise 与表情是跷跷板**：0.25 保表情、0.35 身份更强但可能丢表情（老板在不同片上两种结论都出现过）。**换一条片先按 0.25 试，表情确认没了再加到 0.35**，别反过来。
2. **269 的遮罩参数会直接改脸型**：`shrink` 太大切下颌、`edge_grow` 太小边缘闪。症状对照——切下巴 → `edge_grow` 16→20/24；带头发背景 → `shrink` 12→16/20 或 `threshold` 0.3→0.4；逐帧闪 → `min_frames` 4→6。
3. **SAM 模型名绑平台**：`264 SAMLoader` 用的是 `sam_vit_h_4b8939.pth`（本片实测平台可加载）。平台下拉里没有该值时，改选任一 `sam_vit_*`，其余不动。
4. **单次最长 15 s**（节点 263）。更长的片子按 15 s 分段跑，段与段之间用成片续接，不要直接改大。
5. **脸太小（<100 px）时收益递减**：裁到 512 也只是放大糊脸，H3 拿不到可重建的细节。
6. **VOSR2 有前置成本**：首次运行要下约 7 GB 模型（几分钟无响应是正常）；209 帧 512² 全过一遍，显存与耗时都明显高于纯修脸版。OOM 时把 `tile_size` 512→384、`vae_tile_size` 1024→768。
7. **VOSR2 的收益在上采样后被稀释**：它提升的是 512 裁片，贴回 544×960 成片时脸只有约 170 px，成片端看到的提升小于 `check_refined` 上看到的。
8. **平台 fileName 约 1 天过期**：过期后只需重传视频与参考图，改 `build.mjs` 顶部 `VIDEO_FILE` / `FACE_REF_FILE` 两个常量再 `node build.mjs`。
9. `VHS_LoadVideo.video` 只认平台 fileName（不带本地路径）。

## 封面

- 主标：**视频小脸修脸**
- 副标：裁切 512 · 遮罩重绘 · 羽化贴回 · VOSR2 终修
- 画面：竖屏视频框 + 红框裁切标记（无可识别真实面孔）

## 复现

```bash
node build.mjs     # templates/base.json → workflow.ui.json（清痕迹 + 落常量）
node check.mjs     # 结构自检：节点/连线/素材/参数/痕迹/配色
```

交付给老板：直接把 `workflow.ui.json` 拖进 RunningHub → 运行 → 按顺序看
**267 `check_mask`（每帧白区盖脸）→ 268 `check_refined`（脸是否换了）→ 192 成片**。
