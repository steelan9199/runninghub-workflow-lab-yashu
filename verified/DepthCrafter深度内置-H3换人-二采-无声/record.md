# DepthCrafter 深度内置 · H3 换人 · 二采 · 无声

**一句话用途**：把真人舞蹈视频里的人换成参考图人物，**图内用 DepthCrafter 提视频级深度当第二路空间参考**（不用姿势骨架），二采出高清无声成片。
深度不再是逐帧猜测，而是整段联合优化——帧间不闪、楼梯纵深稳定。

> **实测状态：未跑通。** 第一次跑挂在张量尺寸不匹配（见下），修正后尚未重跑验证。
> 跑通后把实测数据补进「实测」栏，再把 `verified/README.md` 那行的「未实测」改掉。

## 拓扑（34 节点 / 42 连线）

```
原片 VHS_LoadVideo ─┬─→ ref_video_0（主：表演/构图/镜头/三镜两切）
                    ├─→ ImageScale(832×704，64 对齐) → DepthCrafter → ImageScale(640×544) → ref_video_1（辅）
                    └─→ ref_video_audio_0（只喂模型，不出声）

人物三视图 LoadImage → ref_image_0

MiniMax H3（640×544 / 328 帧）
  → 一采 4 步 → 只放大视频潜空间 2× → 二采 2 步（1280×1088）
  → VAEDecode → VHS_VideoCombine（h264，音轨不接）
```

## 默认参数

| 项 | 值 |
|---|---|
| 原片 | `小丑02_328f.mp4`，864×736 / 328 帧 / 24fps / 13.667s |
| 深度前置 | `ImageScale` → **832×704**（13×64 / 11×64），`crop=disabled` |
| DepthCrafter | `max_res=832`、`num_inference_steps=5`、`guidance_scale=1`、`window_size=110`、`overlap=25` |
| 深度后置 | `ImageScale` → 640×544（与一采同尺寸） |
| 模型加载 | `enable_model_cpu_offload=true`、`enable_sequential_cpu_offload=false` |
| 一采 | 640×544，4 步，beta + `H3SigmaRefiner` |
| 二采 | 1280×1088，2 步，`minimax_h3_latent_upscaler_3d_fp16_V2`（`multiplier=2`、`align=32`） |
| 噪声 | fixed `20261115`，两采共用 |
| 输出 | 24fps、`video/h264-mp4`、`yuv420p`、crf 19、**无音轨** |

## 尺寸约束

尺寸约束见 `SKILL.md` §0.2；本包实际做法见上「默认参数」表（深度前置 `ImageScale`、`max_res`）。

## 提示词要点

- `<Video 2>` 定义为「同帧同帧率的灰度深度图」：近白远黑，只给体积、剪影、距离与构图。
- 三重禁令：灰度图、亮度渐变、无细节剪影**都不得画进成片**。
- 表情：人物2 全程面无表情、不许微笑（原片的红嘴角是妆，不是表情）。
- 抽烟：夹烟吸最后一口 → 甩掉 → 吐烟，烟卷允许入画（后期自己打码）。

## 已知风险

1. **未跑通**：修正 64 对齐后没重跑，是否还有二次报错未知。
2. DepthCrafter 很慢（每窗口 5 步推理，328 帧约 4 个窗口），叠加二采后单任务耗时明显。
3. 328 帧 + 二采显存未验；OOM 退 576×480 → 1152×960，或按镜拆三段。
4. 硬切切点仍只受语义级约束，可能漂。
5. 素材 `fileName` 约 24 小时过期，重传后改 `build.mjs` 的 `ASSETS`。

## 复现

```bash
node build.mjs && node check.mjs
```

换片改顶部：`FRAMES`（17k+5 网格）、`WIDTH` / `HEIGHT`（32 的倍数，二采自动 2×）、`SEED`、`OUT_PREFIX`、`ASSETS`；
换素材时先看尺寸能否被 64 整除，不能就在 `dpre` 节点改。

## 封面

主标「深度内置 · 二采换人」，副标「DepthCrafter 视频深度直接进 H3 · 64 对齐 / 2× 放大 / 328 帧 · 无声」；
深色底 + 深度阶梯示意，无影视/明星面孔，字体全部霞鹜文楷 GB。
