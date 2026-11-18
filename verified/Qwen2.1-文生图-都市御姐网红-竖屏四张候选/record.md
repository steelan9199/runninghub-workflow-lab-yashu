# Qwen2.1 文生图 · 都市美女网红 · 竖屏四张候选

**一句话用途**：以后要出「都市美女 / 甜酷 / 御姐 / 纯欲」人像，就用这张图——竖屏 9:16，一次出 4 张同提示词不同种子，挑一张。

> 目录名沿用建包时的「都市御姐」，现在默认人设已换成**甜酷纯欲**；同一张图换「主体 / 身材 / 妆造 / 服装 / 场景」五行即可切回御姐或知性。

## 拓扑

```
UNETLoader qwen_image_2.1_bf16_Raw → KSampler.model
CLIPLoader qwen3vl_8b_int8_convrot (type=qwen_image) → TextEncodeQwenImage21.clip
TextEncodeQwenImage21 ─ positive → KSampler.positive
                     ─ negative → KSampler.negative
EmptyLatentImage 832×1472 batch=4 → KSampler.latent_image
VAELoader qwen_image_2.1_vae_bf16 → VAEDecode.vae
KSampler → VAEDecode → SaveImage
```

**9 节点 / 8 连线**。两处与生产图 `rh1`（workflowId `2112845992205840385`）不同，都是有意为之：

| 改动 | 为什么 |
|---|---|
| **去掉 `QwenImage21Cache`** | 平台上每次任务可能落到不同机器，节点装没装随实例而变。少一个可选节点，就多一分「任何机器都能跑」的稳妥；它只包在 model 外层做加速，不是出图必需。实证：去掉后平台跑通。 |
| **负向提示词清空** | cfg=1 时负向分支不参与计算，写什么都是死参数，留着只会误导人以为能靠负向修图。 |
| 底座 `int8_convrot` → `bf16_Raw` | 整精度，皮肤与发丝细节更足；代价是更慢、更吃显存。 |

另外去掉了 `String → StringToInt` 与 `CR Prompt Text`，宽高/批次/提示词直接写在控件上。

## 默认参数

| 项 | 值 | 为什么 |
|---|---|---|
| 画幅 | 832×1472（≈9:16，两边都是 16 的倍数） | 手机竖屏；比例不对会被 latent 向下取整 |
| 批次 | 4 | 一次出 4 张候选，耗时几乎不涨 |
| 步数 / cfg | 25 / 1 | 官方 Qwen-Image 2.1 模板值；**cfg=1 负向不生效** |
| 采样器 / 调度 | euler / simple | 官方模板与 Hub 工作流一致，flow-matching 模型的主流配法 |
| 种子 | 20261120（节点上可切 randomize） | 固定才能复现 |
| 提示词 | 368 字中文，十行结构 | 甜酷纯欲 · 街角便利店 |

## 实测数据

- **int8 版**：taskId `2123085685190778882`，4 张全落盘，832×1472 精确命中，单张 1.82–1.94 MB。
- **bf16 版**（当前版本）：使用者在 RunningHub 平台跑通并确认可用；耗时与显存占用未回填（bf16 比 int8 更重，属预期）。
- 封面图取自 int8 版 v2 第 1 张，仅作示意，不代表当前提示词的出图结果。

## 已知限制

1. **cfg=1，负向提示词是死参数**（已清空）。要修「脸崩 / 手指」只能改正向描述，或把 cfg 提到 2（画质会降）。
2. **bf16 更吃显存**：大图或高批次在小卡实例上可能 OOM；真遇到就把 batch 降到 1–2。
3. 身体比例推太狠会开始不自然，「丰满挺立」已经接近上限。
4. 宽高必须是 16 的倍数且成对改，比例偏了构图会漂。
5. 平台对露点与暗示性姿势直接拦截；丝袜类只写「黑色薄丝袜，光泽细腻」，不写吊带袜 / 渔网 / 蕾丝边。
6. **UI 版控件顺序按 `/object_info` 逐个核过，但没有在浏览器里真导入过**（文件选择器无法自动化）；导入若报参数串位，以 `build.mjs` 重新生成为准。

## 复现命令

```bash
# 生成（改提示词/底座/画幅/种子后重跑）
node build.mjs

# 自检
node check.mjs

# 直投实测（走 runninghub-workflow-lab-yashu 的 rhx）
node <runninghub-workflow-lab-yashu>/scripts/rhx.mjs run --workflow workflow.api.json \
  --out "<绝对目录>" --name v1
```

## 封面

- 图：`cover-3x4.jpg`（1680×2240），主体取自本包 int8 版 v2 第 1 张，裁 3:4 后叠字。
- 主标：`都市美女人像`
- 副标：`甜酷 · 御姐 · 知性 ｜ 竖屏 9:16 ｜ 一次四张候选`
- 文字用霞鹜文楷 GB Medium（`LXGWWenKaiGB-Medium.ttf`）本地渲染，不让模型直出中文。
