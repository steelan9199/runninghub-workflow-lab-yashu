# DWPose 视频转骨架 · 无声

**一句话用途**：把一段真人视频逐帧转成黑底彩色骨架视频，输出与原片**同宽高、同帧率、同帧数、无音轨**，当 H3（或其他模型）的姿势参考素材用。

老板实测确认保留本包（同日做过 OpenPose 版，对比后判 OpenPose 不如 DWPose）。

## 拓扑（5 节点 / 3 连线）

```
VHS_LoadVideo（全帧）→ DWPreprocessor（DWPose）→ ImageScale（拉回源片宽高）→ VHS_VideoCombine（h264 mp4，音轨不接）
```

- 红 2：源片、DWPose 参数；橙 1：输出。

## 默认参数

| 节点 | 参数 |
|---|---|
| `VHS_LoadVideo` | `force_rate=0`、`frame_load_cap=0`、`skip_first_frames=0`、`select_every_nth=1`、`format=AnimateDiff` |
| `DWPreprocessor` | `detect_hand=enable`、`detect_body=enable`、`detect_face=disable`、`resolution=1024`、`bbox_detector=yolox_l.onnx`、`pose_estimator=dw-ll_ucoco_384.onnx`、`scale_stick_for_xinsr_cn=disable` |
| `ImageScale` | `lanczos` / 864×736 / `crop=disabled` |
| `VHS_VideoCombine` | 24fps、`video/h264-mp4`、`yuv420p`、`crf=18`、`save_metadata=true`、`trim_to_audio=false`、**audio 不接** |

**控件顺序（手改必读）**：`DWPreprocessor` 的真实顺序是
`image → detect_hand → detect_body → detect_face → resolution → bbox_detector → pose_estimator → scale_stick_for_xinsr_cn`。
按 API 字段顺序（body 在前）排会串位，`resolution` 会拿到模型名并报错。

## 实测（2026-11-15，源片 `小丑02_328f.mp4`）

| 项 | 骨架产物 | 源片 |
|---|---|---|
| 尺寸 | 864×736 | 864×736 |
| 帧数 | 328 | 328 |
| 帧率 | 24fps | 24fps |
| 时长 | 13.6667s | 13.6667s |
| 音轨 | **无** | AAC |
| 编码 | h264 / yuv420p | h264 / yuv420p |

- 平台产物：`skeleton_joker02_00001_p81_bisvt_1794685922.mp4`
- 328 帧无全黑帧；但 **f0–f25 未检出人**（画面只剩平台水印，骨架 bbox 高仅 6px）
- 骨架 bbox 高度：f50 = 181/184（≈724px）、f300 = 177/184 → 全程接近铺满画面

## 已知限制

1. **尺度会归一化**：DWPose 按人物检测框把骨架放大到铺满画面，源片的大远景/近景比例与站位丢失（f50 源片人物约 120px，骨架 724px）。当"同框姿势参考"会使 H3 把构图顶成中景。
2. 平台在每帧左上角烧「RunningHub AI生成」水印，节点侧关不掉。
3. 检测不到人的帧输出纯黑（远景小人、大幅失焦、开头静止镜）。
4. 逐帧检测较慢，328 帧整条跑耗时明显。
5. 素材 `fileName` 约 24 小时过期，重传后只改 `VIDEO`。

## 与 OpenPose 版的关系

同日做过 OpenPose 版（`OpenposePreprocessor`，在原图像素坐标上绘制、不做 bbox 归一化，尺度/站位与原片一致，但手部更糙）。老板对比后判 **OpenPose 不如 DWPose**，故本包保留 DWPose。

要"同框骨架"时把 2 号节点换回 `OpenposePreprocessor`，控件顺序为
`image → detect_hand → detect_body → detect_face → resolution → scale_stick_for_xinsr_cn`。

## 复现

```bash
node build.mjs && node check.mjs
```

换片只改 `build.mjs` 顶部：`WIDTH` / `HEIGHT`（=新源片宽高）、`FPS`、`DETECT_RES`、`VIDEO`（重传后的 `fileName`）、`OUT_PREFIX`。

## 封面

主标「视频转骨架」，副标「DWPose · 逐帧提骨骼 / 输出与原片同宽高、同帧率」；
黑底 + 彩色骨架线 + 画幅框，含「864 × 736 · 328 帧 · 24fps · 无音轨」实测行；无影视/明星面孔，字体全部霞鹜文楷 GB。
