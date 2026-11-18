# Qwen2.1 文生图 · 都市御姐网红 · 竖屏四张候选

**一句话用途**：以后要出「都市美女 / 御姐 / 纯欲」人像，就用这张图——竖屏 9:16，一次出 4 张同提示词不同种子，挑一张。

## 拓扑

```
UNETLoader qwen_image_2.1_int8_convrot
  └─ QwenImage21Cache(device=auto, dtype=default) → KSampler.model
CLIPLoader qwen3vl_8b_int8_convrot (type=qwen_image) → TextEncodeQwenImage21.clip
TextEncodeQwenImage21 ─ positive → KSampler.positive
                     ─ negative → KSampler.negative
EmptyLatentImage 832×1472 batch=4 → KSampler.latent_image
VAELoader qwen_image_2.1_vae_bf16 → VAEDecode.vae
KSampler → VAEDecode → SaveImage
```

10 节点 / 9 连线。接线取自跑在生产环境的 `rh1`（workflowId `2112845992205840385`），只做了两处**行为不变**的简化：

1. 去掉 `String → StringToInt` 链，宽高/批次直接写成控件；
2. 去掉 `CR Prompt Text` / `PreviewAny`，提示词直接写在文本编码节点上。

## 默认参数

| 项 | 值 | 为什么 |
|---|---|---|
| 画幅 | 832×1472（≈9:16，两边都是 16 的倍数） | 手机竖屏；比例不对会被 latent 向下取整 |
| 批次 | 4 | 一次出 4 张候选，耗时几乎不涨 |
| 步数 / cfg | 25 / 1 | 这是这套 int8 底座的出厂跑法；**cfg=1 时负面提示词完全不生效** |
| 采样器 / 调度 | euler / simple | 同上 |
| 种子 | 20261119（节点上可切 randomize） | 固定才能复现 |
| 提示词 | 430 字中文，按「主体/身材/姿态/妆造/服装/场景/镜头/神情/光线/质感」分行 | 改一行换一块 |

## 实测数据

- taskId `2123085685190778882`（v2，挺立版），4 张全部落盘，单张 1.82–1.94 MB，832×1472 精确命中。
- 首版 taskId `2123084776364789762`：胸型偏小偏垂 → 加「身材」「姿态」两段 + 服装改「内置挺括胸衣结构」后重跑，v2 达标。
- 耗时平台未回传；同参数历史记录（rh1，1440×608 四张）为 42–55s 量级，本包尺寸更小。

## 已知限制

1. **cfg=1，负面提示词是死参数**。写「不要下垂」不会生效，只能靠正文正向描述（挺立 / 位置高 / 姿态前挺 / 胸衣结构）。
2. 身体比例推太狠会开始出现不自然，到「丰满挺立」就已经接近上限。
3. 尺寸只能微调：宽高都必须是 16 的倍数，且比例别偏离 9:16 太多，否则构图会漂。
4. 平台审核对露点与暗示性姿势直接拦截——本包提示词不含任何越线词，靠神态与侧逆光造氛围。
5. UI 版控件顺序按 `/object_info` 逐个核过，但没有在浏览器里真导入过（文件选择器没法自动化）；API 版是实测跑通的，导入若有问题就用 API 版。

## 复现命令

```bash
# 生成（改提示词/画幅/种子后重跑）
node build.mjs

# 自检
node check.mjs

# 直投实测（走 runninghub-workflow-lab-yashu 的 rhx）
node <runninghub-workflow-lab-yashu>/scripts/rhx.mjs run --workflow workflow.api.json \
  --out "<绝对目录>" --name v1

# 云端别名（同一模型同一参数，提示词已预填）
node <runninghub-cloud-yashu>/scripts/rh.mjs --alias rh-beauty --in batch=4 --out "<绝对目录>"
```

## 封面

- 图：`cover-3x4.jpg`（1680×2240），主体取自本包 v2 第 1 张，裁 3:4 后叠字。
- 主标：`都市御姐人像`
- 副标：`Qwen Image 2.1 ｜ 竖屏 9:16 ｜ 一次四张候选`
- 文字用霞鹜文楷 GB Medium（`LXGWWenKaiGB-Medium.ttf`）本地渲染，不让模型直出中文。
