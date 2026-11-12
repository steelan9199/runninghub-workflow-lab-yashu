# H3 三采 · FL2VA（首尾帧）

**状态**：已验证通过，可交付
**验证日期**：2026-11-13
**验证人**：老板（成片确认可用）
**结构**：一采 3 步 @0.39MP → 1.5× → 二采 3 步 @0.88MP → 1.5× → 三采 3 步 @2.03MP → 解码合成

---

## 1. 它解决什么

给两张图（首帧 + 末帧），生成 8 秒带音频的连续视频，中途两次放大视频潜空间，让低分辨率段负责动作、高分辨率段负责细节。是 H3 首尾帧工作流 `2114707872927014914` 的修正版。

与源工作流的三处不同：

1. **源工作流的第二段采样是空转**（`DisableNoise` = 0 步），实际只有两段在跑；这里 3/3/3 三段真跑。
2. **首尾帧锚点每段重挂**。源工作流把 `AddGuide` 挂在条件链上，但那条链下游接的是空转采样器，等于装饰品；这里每段用自己的潜空间重挂一遍，见 §2 的坑。
3. 提示词按 `h3-prompt-writing` 的 FL2VA 规则写（首行对齐指令 + 三段字段）。

## 2. 拓扑（按信号流）

```
ckpt → LoRA×2 → 注意力 → SigmaShift
提示词 / 分辨率 / 时长 / 噪声种子 / 首末帧
     → BasicScheduler(9) → SplitSigmas(3) → SplitSigmas(3)
     → 一采(i2v 自带首尾帧条件, 3 步)
     → 分离 AV → 视频 1.5× → 拼回音频
     → 二采(AddGuide 重挂锚点 @0.9MP, 3 步)
     → 分离 AV → 视频 1.5× → 拼回音频
     → 三采(AddGuide 重挂锚点 @2MP, 3 步)
     → VAEDecode / VAEDecodeAudio → CreateVideo(24fps) → SaveVideo
```

三条必须记住的接线事实：

1. **`MiniMaxH3ImageToVideo` 的条件绑死创建时的分辨率**。把它的 `first_frame`/`last_frame` 条件接到放大后的潜空间上采样，必然报 `shape mismatch: [810,96] → [1760,96]`。所以二采/三采改用 `MiniMaxH3AddGuide` 重挂。
2. **三段共享同一条 sigma 序列与同一个 `RandomNoise`**：是一条连续去噪路径沿途放大两次，不是跑三遍挑一条。
3. **放大只动视频潜空间**（Separate → Upscaler3D → Concat），音频 latent 原样带过去，否则音画错位。

## 3. 默认参数

| 项 | 值 | 说明 |
|---|---|---|
| 起手分辨率 | 0.4MP（16:9） | 832×468 |
| 时长 | 8 秒（192 帧） | 17k+5 对齐 |
| 采样 | euler / simple，9 步，shift 12/3 | 3 / 3 / 3 三段 |
| 放大 | 1.5× ×2（LatentUpscaler3D） | 只作用于视频 |
| 成片 | 1920×1056 | 见 §6 宽高比 |
| 种子 | 999（固定） | 三段共用 |

红色方块 = 需要改的 6 个参数（分辨率 / 时长 / 提示词 / 首帧 / 末帧 / 种子）；橙色 = 输出节点。

## 4. 提示词

FL2VA 官方结构：首行 `How the reference pictures align with the target video — Picture 1 (from Shot 1) aligns with the 0.00-second mark...; Picture 2 (from Shot 1) aligns with the 8.00-second mark...`，空行后接 `integrated_multimodal_description` / `overall_soundscape` / `non_diegetic_music`，全英文、单镜头、运镜写成自然句。

## 5. 实测记录

- 规格：1920×1056 / 192 帧 / 8.000s / 2.4 Mbps；音频 mean −24.7 dB、峰值 −3.2 dB
- 帧间差均值 1.45，尾部（176–191 帧）0.88
- 首帧 vs 参考首帧 SSIM 0.79；末帧 vs 参考末帧 0.82（含宽高比拉伸造成的分数损失，姿态吻合）
- 三段算力占比：一采 12% / 二采 26% / 三采 62%
- 首尾帧契约达成：起手手搭额前、收尾手放下视线回正；人物、服装、雨丝、霓虹 8 秒稳定

**教训**：首末帧差异小（只差一只手）时，FL2VA 会走最短路径 —— 动作 1.5 秒就演完，剩下 6 秒定格。要让中段有事发生，末帧必须比首帧差得更多。

## 6. 已知限制

- **成片是 1920×1056（1.818），不是严格 16:9**。起手 0.4MP 取整 + 两次 1.5× 放大按 32 对齐，累积出 2.3% 的偏差。要严格 1920×1080 需在解码后加 `ImageScale`，当前 UI 模板里没有该节点。
- 中段动作偏少（原因见 §5）。
- 末段 2.03MP × 192 帧吃显存；OOM 时把起手 megapixels 降到 0.3。
- `LoadImage` 里是平台 `fileName`，约 24 小时失效，原图在 `assets/`。
- 生成耗时实测约 5 分钟（48G 档）；二采约 7 分 50 秒，差异来自权重冷启动与机器档位，不是算力（两者 9.4 vs 9.9 MP·步）。

## 7. 复现与改参数

```bash
node build.mjs                            # 同时产出二采与三采到 dist/
node check.mjs dist/H3_threepass_v1.ui.json
```

`workflow.ui.json` 是已验证快照，与重新生成的文件只差节点 id 与顶层 uuid。

改参数只动 `build.mjs` 顶部：`P_FLF`（提示词）、`MP` / 分辨率（起手像素）、`SECONDS`（时长）、`SPLIT`（切点）。

## 8. 目录

```
H3-three-pass-fl2va/
├─ workflow.ui.json   可直接导入 RunningHub
├─ build.mjs          生成器（同时产出二采，忽略即可）
├─ check.mjs          结构/配色自检
├─ templates/         两份官方 UI 模板（保真控件顺序）
├─ assets/            首帧 / 末帧原图
└─ record.md          本文件
```
