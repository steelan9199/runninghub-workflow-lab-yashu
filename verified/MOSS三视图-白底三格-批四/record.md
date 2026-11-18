# MOSS 三视图 · 白底三格 · 批四

**场景一句话**：白底角色三视图——左格肩线以上头像特写、中格无头躯干与腿、右格背面全身，1728×768 三格等宽，一次出 4 张候选。

**定位**：本类任务的**首选入口**（老板 2026-11-19 定）。原 `角色三视图`（Qwen Image 2.1）降为**备选方案**，仅在 MOSS 出图失败或缺模型时使用。

## 拓扑（11 节点 / 10 连线）

```
UNETLoader  moss_image_sft_int8_convrot
  └→ LoraLoaderModelOnly  MOSS-Image-Base-8-steps-dmd (strength 1)
       └→ KSampler
CLIPLoader  qwen3.5_9b_w4a8_gptq (type=moss_image)
  ├→ CLIPTextEncode 正向（整段三格提示词）
  └→ CLIPTextEncode 负向
EmptyFlux2LatentImage 1728×768 ×4 → KSampler
KSampler → VAEDecode（flux2-vae）→ SaveImage
```

**无布局节点**：不含 `CreateBoundingBoxes` / `MOSSImageLayoutPrompt`。三格版式与左格裁切全靠正向提示词。

## 默认参数

| 项 | 值 |
|---|---|
| 画幅 | 1728×768（每格 576×768，16 的倍数） |
| batch | **4** |
| 底座 | moss_image_sft_int8_convrot |
| CLIP | qwen3.5_9b_w4a8_gptq，type=moss_image |
| LoRA | MOSS-Image-Base-8-steps-dmd，strength 1 |
| 采样 | 8 步 / cfg 1.1 / euler / simple / denoise 1 |
| 种子 | 20261124（randomize） |
| VAE | flux2-vae |

底座与参数取自站上工作流 `2119655744810344450`（已 learn 入库 `corpus/wf_2119655744810344450.json`）。

## 提示词契约

- 正向是一整段（372 字），四段结构：版式段 → 人物段 → 左/中/右三格取景 → 质感段。
- 三段取景必须各自点名：左格「肩线以下即出画」、中格「没有头部/没有头发/没有脖颈」、右格「完整带头、看不到面部」。
- 负向固定含 `grey face, grey mask, faceless, mannequin head`（中格曾出灰面的对策）。
- 换角色只改「人物：」一行与三段服装描述，三段不可分头改衣。

## 实测

- 2026-11-19：使用者在 RH 平台跑通无框版（batch 1），成图三格成立，中格曾出现「保留长发 + 脸部灰块」的失败形态。
- 2026-11-19：batch 4 版 `check.mjs` 通过（11 节点 / 10 连线 / batch 4 / 1728×768 / 红 3 橙 1）；**batch 4 未在平台实测**，taskId 待回填。

## 已知限制

1. **裁切不稳**：无布局节点时，左格只到肩、中格无头靠文字约束；同底座的 Qwen 三视图曾连续 3 次把左格画到胸口/腰，本版跑偏概率高于布局版。
2. **中格灰脸**：中格若给了头部空间，模型会补「有头发 + 无特征灰面」，灰面会被下游换人当作「面部遮挡」先验。对策：框几何或本版负向；若仍出现，改用下游按格裁切喂参考。
3. **batch 4 显存**：4 张 1728×768 同时解码，小卡会 OOM，降回 1。
4. **cfg 1.1**：DMD 蒸馏模型下负向作用很弱，别指望负向兜底。
5. 封面沿用 `角色三视图` 同名 3:4 封面（主标「角色三视图」，副标「白底 · 左脸特写 / 中无头人台 / 右背面全身」），交付形态一致。

## 封面

- 主标：角色三视图
- 副标：白底 · 左脸特写 / 中无头人台 / 右背面全身
- 文件：`cover-3x4.jpg`（1680×2240，严格 3:4）

## 复现

```bash
cd verified/MOSS三视图-白底三格-批四
node build.mjs   # 生成 workflow.ui.json + workflow.api.json
node check.mjs   # 契约自检
```

平台：导入 `workflow.ui.json` → 直接运行；画幅只改 `Empty Flux 2 Latent` 一处。
