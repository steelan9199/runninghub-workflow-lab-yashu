# H3 修脸 · 小脸裁切遮罩精修贴回 · 一采 · 有声

**一句话用途**：一条救不回重拍的成片，人物脸只有 150–180 px、糊成一团——把脸逐帧裁到 512 画布，用 H3 Ref2VA 按参考图重画，再羽化贴回原片；**脸以外的像素、构图、动作和原声轨都不动**。

> 实测状态：**平台跑通**（2026-11-27 老板逐帧验收）。输入 544×960 / 209 帧 / 8.708s / 24fps；`check_mask` 每一帧都认到脸；`check_refined` 脸已换成参考图人物；成片无方块、无灰块、无跳变。

## 为什么不在整帧上重绘

H3 的 img2img 在整帧尺度上是 denoise 1 级别的重生成：动作、口型、背景都会脱离原片。所以本包保留「裁脸 → 遮罩内重绘 → 羽化贴回」三段结构，把生成预算全花在脸上。

真正的坑不在结构，在遮罩：早期版本用 `SAM3_VideoTrack` 按文本 `"face"` 跟踪移动裁剪片，**中途丢目标** → 遮罩后段为空 → `SetLatentNoiseMask` 没有可重绘区域 → 精修输出 ≈ 输入（表现为「换脸没效果」）。本包改用检测框驱动的 `H3FaceMaskSAM`，遮罩逐帧由 163 的人脸框生成，不依赖文本提示。

## 拓扑（62 节点 / 65 连线，红 5 橙 1，7 组）

```
VHS_LoadVideo(9) ──┬─→ H3FaceTrackCrop(163, 512 画布 / crop 2.5 / largest_face)
                   │        ├─ crops ──→ H3FaceMaskSAM(265, 检测框 + SAM)
                   │        ├─ transform ──→ 265 / 191
                   │        └─ frame_count ──→ ComfyMathExpression(19/260/262) ──→ 164.length
                   ├─ H3FaceTrackCrop 输出 crops ──→ MiniMaxH3ReferenceToVideo(164) 的 ref_images 之外，
                   │     仅取 positive 条件；LATENT 输出不接
                   └─ audio ──→ TrimAudioDuration(261) ──→ 192.audio

265.masks ──┬─→ MVEx_MaskToLatentSpace(241) ──→ SetLatentNoiseMask(242, 视频段)
            ├─→ H3FaceStitch(191).masks（羽化贴回）
            └─→ MaskToImage(266) ──→ VHS_VideoCombine(267, check_mask)

SolidMask(251, 0 / 32×32) ──→ SetLatentNoiseMask(252, 音频段冻结)
242 + 252 ──→ LTXVConcatAVLatent(247) ──→ SamplerCustomAdvanced(174) ──→ VAEDecode(183)
VAEDecode ──→ 191.refined_crops ──→ 192（画面）+ 261（原声）→ VHS_VideoCombine(192)
```

- 结构要点：**164 的 LATENT 输出不接**，只吃它的 `positive`；采样器的 `latent_image` 来自 `LTXVConcatAVLatent`。
- 音频段用 `SolidMask` 全 0 冻结，所以原声不会被重绘，成片音轨取自 `TrimAudioDuration(261)`。
- `191.undetected_frames = composite_anyway`（源码该分支把逐帧权重置 None，避免检测缺失帧把贴回清零）。

## 默认参数

| 项 | 值 |
|---|---|
| 输入视频（9） | 544×960 / 209 帧 / 8.708s / 24fps，`4a757e9b…mp4` |
| 人脸参考图（257） | `face_ref_front_1024.png`（三视图裁出的正脸），平台 fileName `openapi/acb32ef…png` |
| 跟踪裁剪（163） | `face_yolov8n.pt`，confidence 0.35，`crop_factor 2.5`，canvas **512×512**，`canvas_mode manual`，smooth 21 / 51 gaussian，`per_frame`，identity_track on / 0.28，`largest_face` |
| 裁切时长（263） | 单次最长 **15 s**（512²×15s×8 步 ≈ 31 MP·秒，仍在 7.5 MP·秒安全线换算内） |
| 精修（164） | 8 步 `pika_h3_flex_turbo_8step_hd_ref2va` + `beta` 调度；提示词走节点 2（六段式，英文） |
| 采样（175 / 254） | `beta` / 8 步 / **denoise 0.25**；`DifferentialDiffusion(strength=1)` |
| 遮罩（265 / 241） | `H3FaceMaskSAM` 0.93 / 0 / 5；`MVEx_MaskToLatentSpace` auto/max/max/36/1/both |
| 贴回（191） | `face_only`，mask_dilation 24，feather 24，colour_match 1，blend 1，`composite_anyway` |
| 输出（192） | 24fps / `video/h264-mp4` / `yuv420p` / crf 19 / 带原声 |

## denoise 是唯一要调的钮

| denoise | 结果 | 结论 |
|---|---|---|
| 1.0 | 遮罩区整块重画：脸彻底换成参考图，**原片表情（微笑/口型）被一起擦掉** | 换人最狠，只适合表情不重要的镜头 |
| 0.65 | 身份与表情各让一步 | 折中档，未在本片验收 |
| **0.25（本包默认）** | 保留原片的表情与几何，参考图只负责把脸画清楚、画成那个人 | 老板本片采用的档位 |

原则：**先定「表情要不要跟着原片走」再选 denoise**。要表情 → 0.25–0.4；要彻底换人 → 0.8–1.0。

## 实测数据

| 项 | 值 |
|---|---|
| 成片规格 | 544×960 / 209 帧 / 8.708s / 24fps（与源片逐项一致） |
| `check_mask`（267） | 512×512 / 209 帧；老板逐帧确认**每一帧都盖住脸** |
| `check_refined`（268） | 512×512 / 209 帧；脸已换成参考图人物 |
| 成片（192） | 无方块、无灰块、无跳变；音轨保留 |
| 帧间差 / 音频电平 | 未采样（本包只做画面验收，未跑逐帧 diff） |
| 结构自检 | 62 节点 / 65 连线 / 红 5 橙 1；`check.mjs` 通过；`layout-check` 0 错误 0 警告 |

## 已知限制

1. **denoise 越低，身份越弱**。0.25 是「清晰度 + 表情」优先的档；要更像参考图必须往上加，代价是表情丢。
2. **SAM 模型名绑平台**：`264 SAMLoader` 用的是 `sam_vit_h_4b8939.pth`（本片实测平台可加载）。平台下拉里没有该值时，改选任一 `sam_vit_*`，其余不动。
3. **单次最长 15 s**（节点 263）。更长的片子按 15 s 分段跑，段与段之间用成片续接，不要直接改大。
4. **脸太小（<100 px）时收益递减**：裁到 512 也只是放大糊脸，H3 拿不到可重建的细节。
5. **平台 fileName 约 1 天过期**：过期后只需重传视频与参考图，改 `build.mjs` 顶部 `VIDEO_FILE` / `FACE_REF_FILE` 两个常量再 `node build.mjs`。
6. `VHS_LoadVideo.video` 只认平台 fileName（不带本地路径）。

## 封面

- 主标：**视频小脸修脸**
- 副标：裁切 512 · 遮罩重绘 · 羽化贴回
- 画面：竖屏视频框 + 红框裁切标记（无可识别真实面孔）

## 复现

```bash
node build.mjs     # templates/base.json → workflow.ui.json（清痕迹 + 落常量）
node check.mjs     # 结构自检：节点/连线/素材/参数/痕迹/配色
```

交付给老板：直接把 `workflow.ui.json` 拖进 RunningHub → 运行 → 按顺序看
**267 `check_mask`（每帧白区盖脸）→ 268 `check_refined`（脸是否换了）→ 192 成片**。
