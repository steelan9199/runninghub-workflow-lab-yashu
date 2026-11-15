# H3 外接深度换人 · 楼梯跳舞三镜 · 二采 · 无声

**一句话用途**：把真人舞蹈视频里的人整身换成参考图人物，**深度视频由外部现成文件提供**（先跑「深度提取-视频转深度-无声」），图内不再放 DepthCrafter——换人重跑时不再重算深度；二采出 1280×1088 无声成片。

> 实测状态：**平台跑通**（2026-11-15，老板确认）。成片 1280×1088 / 328 帧 / 24fps / 13.667s，取自输出节点 metadata。

## 拓扑（31 节点 / 38 连线）

```
VHS_LoadVideo(原片) ─────┬─→ ref_video_0（主：表演/构图/镜头/三镜两切）
                         └─→ ref_video_audio_0（只喂模型，不出声）
VHS_LoadVideo(深度视频) ─→ ref_video_1（辅：只给空间结构）
LoadImage(人物三视图) ──→ ref_image_0

MiniMax H3（640×544 / 328 帧）
  → 一采 4 步 → 只放大视频潜空间 2× → 二采 2 步（1280×1088）
  → VAEDecode → VHS_VideoCombine（h264，音轨不接）
```

- 红 4：原片、深度视频、人物图、提示词。橙 1：输出。
- 与「深度内置」版的唯一结构差别：`dcmodel / dpre / depth / depthscale` 四节点整体移除，深度改由第 9 号 `VHS_LoadVideo` 供。

## 默认参数

| 项 | 值 |
|---|---|
| 原片 | `小丑02_328f.mp4`，864×736 / 328 帧 / 24fps / 13.667s（三镜两切） |
| 深度视频 | 深度提取包产物，864×736 / 328 帧 / 24fps / 无音轨；平台 fileName `1d5757087ac88009155df27663668339fb6f1b63e093693c450783b141a4d411.mp4`（**无 `openapi/` 前缀**，本地上传形态） |
| 一采 | 640×544，4 步，beta + `H3SigmaRefiner`（0.7 以下 +2 步） |
| 二采 | 1280×1088，2 步，`minimax_h3_latent_upscaler_3d_fp16_V2`（`multiplier=2`、`align=32`） |
| 噪声 | fixed `20261115`，两采共用 |
| 输出 | 24fps、`video/h264-mp4`、`yuv420p`、crf 19、**无音轨** |

## 提示词（极简版，刻意不写细节）

```
<Video 1> is the source clip. <Video 2> is its grayscale depth map, only for spatial reference. Replace the clown in <Video 1> with the man in <Picture 1>: tall gold crown, long black hair, thin black moustache, long pointed goatee, pale ice-blue robe. Keep everything else as in <Video 1>.
```

老板拍板：**写越细，对模型的干扰越大**，所以砍掉五段式骨架里的 `retention_analysis` 与动作复述，只留「两视频各一句 + 外观一句 + 其余照原片」。
代价：不再显式锁「不微笑」「深度不得入画」「构图/比例/速度不变」，这三条要靠模型自觉；真出问题再加回半句。

## 实测数据

| 项 | 值 |
|---|---|
| 平台运行 | 跑通，产物 `joker02_ext_depth_twopass_00001_p86.mp4` |
| 成片规格 | 1280×1088 / 328 帧 / 24fps / 13.6667s（输出节点 metadata） |
| 结构自检 | 31 节点 / 38 连线 / 红 4 橙 1，`check.mjs` 通过 |
| 生成器一致性 | 重建产物与平台序列化文件逐项一致（节点、标题、输入名、控件值；已忽略 `videopreview`） |
| 音轨 | 无（`VHS_VideoCombine.audio` 不接） |

> 帧间差、码率、音频电平未采样。

## 已知限制

1. **深度视频必须同段同帧**（本条 328）。帧数不一致会被 `length` 静默裁齐，空间参考直接失效。
2. **深度视频带平台水印**（左上角「RunningHub AI生成」），深度包节点侧关不掉；本包按老板要求未做 delogo，靠提示词里「only for spatial reference」压。
3. 深度视频必须先跑「深度提取-视频转深度-无声」；换了源片就要重跑深度，换人重跑才省时间。
4. 极简提示词放开了三条锁：可能跟着小丑的妆笑、可能出现灰度底、构图可能漂。
5. 两处硬切只受语义级约束，切点可能漂（历史上 3.417s 被跑到 1.875s）。切点对不上就拆段单独生成。
6. 宽景里人物只有几十像素，脸不可辨；近景那镜才考验身份。
7. 素材 `fileName` 约 24 小时过期，重传后改 `build.mjs` 的 `ASSETS`（深度槽允许无 `openapi/` 前缀）。

## 复现

```bash
node build.mjs && node check.mjs
```

换片改顶部：`FRAMES`（17k+5 网格）、`WIDTH` / `HEIGHT`（32 的倍数，二采自动 2×）、`SEED`、`OUT_PREFIX`、`ASSETS`；
提示词只改 `prompt.txt`。尺寸约束的总规则见 `SKILL.md` §0.2。

## 封面

主标「深度分开跑」，副标「深度只算一次 · 换人随便重跑 · 1280×1088 / 328 帧 / 无声」；
深色底 + 两条来源片汇入一支成片，纯色块无人脸，字体霞鹜文楷 GB。
