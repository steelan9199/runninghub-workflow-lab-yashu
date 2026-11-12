# H3 二采 · Ref2VA（参考图生视频）

**状态**：已验证通过，可交付
**验证日期**：2026-11-13
**验证人**：老板（成片确认「没毛病」）
**结构**：一采 6 步 → sigma 尾部加密 → 只放大视频潜空间 2× → 二采 2~3 步 → 解码合成

---

## 1. 它解决什么

用一张参考图生成 8 秒带音频的竖屏改横屏视频，并做到「低分辨率跑动态、高分辨率补细节」的二次采样。是 H3 全库使用量第一（6528 次）那套 `2089513420025589761` 的清版复刻。

## 2. 拓扑（按信号流）

```
ckpt → 提示词 / 分辨率 / 时长 / 噪声种子
     → 一采(H3 采样器, 6 步, euler/simple, shift 12/3)
     → H3SigmaRefiner(start_at_sigma 0.7, +1 步, cosine)
     → SplitSigmas(6) ─┬→ 一采采样 → VAEDecode ─────────────┐
                       └→ AV 分离 → 视频 2× → 拼回音频      │
                                       → 二采采样 → VAEDecodeAudio
                                                  ↓
                                          CreateVideo(24fps) → SaveVideo
```

关键点（搞错就会坏）：

1. **两采共用同一个 `RandomNoise`**，二采从一采的 sigma 高度续采，不是重跑。
2. **只放大视频潜空间**，音频潜空间原样带过去（`SeparateAV → Upscaler → ConcatAV`），否则音画错位或音频糊。
3. `SplitSigmas.step = 6`：前 6 步在 0.5MP 上跑，后 2~3 步在 2MP 上跑。切点越晚越省钱，但高清段步数不够会「油」。

## 3. 默认参数

| 项 | 值 | 说明 |
|---|---|---|
| 分辨率 | 960×544（0.5MP） | 2× 后成片 1920×1088 |
| 时长 | 8 秒（192 帧） | 8×24；H3 有效帧格 17k+5 |
| 采样 | euler / simple，shift 12 / 3 | 低清 6 步 + 高清 2~3 步 |
| 细化 | start 0.7，额外 1 步，cosine | 尾部加密，防糊 |
| 放大 | 2×（LatentUpscaler3D） | 只作用于视频 |
| 种子 | 999（固定） | 复现用 |
| 输出 | SaveVideo 24fps + 音轨 | 实测 3.0 Mbps |

红色方块 = 需要老板改的 5 个参数；橙色 = 输出节点。

## 4. 提示词

节点里已填 **Ref2VA 官方六段式**（`subject_definitions` / `summary` / `retention_analysis` / `detailed_description` / `overall_soundscape` / `non_diegetic_music`），英文正文，画面文字保留原文。改写规则见 `h3-prompt-writing` 技能的 `references/ref-en.txt`。

## 5. 实测记录（三版迭代）

| 版本 | 帧间差均值 | 问题 | 处理 |
|---|---|---|---|
| v1 | 3.72 | 动作几乎为零：提示词自相矛盾（「一镜到底」又写「横移半圈」） | 改成单镜头 + 一个清楚的动作，改官方六段式 |
| v2 | 3.10 | 动作出来了，但霓虹红蓝跳变、推近过猛 | 提示词里我写了 "flickers once" 与「推到 head-and-shoulders」，都是自己埋的坑 |
| v3 | 2.76 | 通过：手放下、微转头、笑意、结尾静止都对；霓虹配色 8 秒稳定；头肩全程在画 | 定稿 |

**教训**：固定机位近景的帧间差本来就低（2~4），不能拿它当质量指标；判据是「提示词要求的动作有没有发生」。

## 6. 已知限制

- `LoadImage` 里是平台 `fileName`，**约 24 小时失效**；失效后导入会显示缺图，重新上传即可（原图在 `assets/`）。
- 背景虚焦霓虹的汉字字形 8 秒内会轻微漂移（不可读，可接受）。
- 码率 3.0 Mbps，1080p 雨夜噪点场景 1:1 看有轻微涂抹。
- 近景参考图不适合大幅度动作（会出画）；要「走起来、转起来」需换中景全程参考图。

## 7. 复现与改参数

```bash
node build.mjs                            # 输出到 dist/，生成二采与三采两份
node check.mjs dist/H3_twopass_v1.ui.json # 结构 + 配色自检
```

`workflow.ui.json` 是已验证快照；重新生成得到的文件与它**节点 id、顶层 uuid 每次随机**（文本不同），结构与参数一致，导入无差别。

改参数只动 `build.mjs` 顶部：`P_REF`（提示词）、`MP`（起手分辨率）、`SECONDS`（时长）、`SPLIT`（一采步数）。

## 8. 目录

```
H3-two-pass-ref2va/
├─ workflow.ui.json   可直接导入 RunningHub
├─ build.mjs          生成器（相对路径，可整体搬走）
├─ check.mjs          结构/配色自检
├─ templates/         两份官方 UI 模板（保真实控件顺序）
├─ assets/            参考图原图
└─ record.md          本文件
```
