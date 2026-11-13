# H3 双人换人 · 近景对话 · 二采（已入库）

**状态**：已入库（2026-11-13 老板确认成片可用）
**适用场景**：**5–15 秒的真人近景/特写对话视频，把片中 2 个人物整人换掉（脸 + 发型 + 服装），保留原机位、剪辑点、表情、口型与背景，音轨沿用原声**。多人分镜交替出镜（同一人可跨镜重复出现）也适用；加人只需补参考图与提示词分段。


## 1. 它做什么

把一条真人视频里的两个人物换成两张参考图（古装人物），保留原片镜头、剪辑点、动作、**表情与口型**、背景，音轨沿用原声。采样改成二采：低清跑表演 → 只放大视频潜空间 2× → 高清补皮肤与官服细节。

## 2. 拓扑

```
UNET(ref2va int8) → turbo 4步 LoRA → SageAttention → 显存补丁
  ├→ BasicScheduler(beta,4) → H3SigmaRefiner(+2, 0.7, cosine) → SplitSigmas(4)
  │     ├→ 一采 4 步 @832×704
  │     └→ 二采 2 步 @1664×1408
  └→ BasicGuider ← MiniMaxH3ReferenceToVideo
        ref_images 0..3 = 红衣老者全身 / 红衣老者脸 / 白衣男子全身 / 白衣男子脸
        ref_videos 0 / ref_video_audios 0 = 原片画面与声音
一采 → 分离 AV → 只放大视频潜空间 2× → 拼回音频 → 二采 → VAEDecode
→ VHS_VideoCombine(24fps, audio ← 原片音轨)
```

关键点：

1. 一采/二采共用同一个 `RandomNoise` 与 `BasicGuider`，是续采不是重跑。
2. 只放大视频潜空间（`LTXVSeparateAVLatent → MinimaxH3LatentUpscaler3D → LTXVConcatAVLatent`），音频潜空间原样带走。
3. 输出走 `VHS_VideoCombine` 的 `audio ← VHS_LoadVideo[2]`，成片音轨是原声；H3 自编声轨只当参考，不交付。

## 3. 默认参数

| 项 | 值 |
|---|---|
| 一采分辨率 | 832×704（源片 842×720 向下取 32 倍数） |
| 二采分辨率 | 1664×1408（2×） |
| 帧数 | 141（17×8+5，24fps → 5.875s） |
| 采样 | beta / 4 步，尾部加密 +2 步（0.7, cosine），切分 4：一采 4 步 / 二采 2 步 |
| 参考图 | 红衣老者 全身 + 脸特写；白衣男子 全身 + 脸特写（顺序 = Picture 1..4） |
| 输出 | h264 mp4 / 24fps / crf19 / yuv420p，音轨 44.1kHz 立体声 |

## 4. 实测记录（v3 定稿）

- 任务：taskId 2121261669257793538（小规格接线）→ 2121261884006162433（v1）→ 2121268609471959042（v2）→ 2121273047779606529（v3 角色对调）
- 成片：1664×1408 / 141 帧 / 5.875s / 约 7.8 Mbps / 原声 44.1kHz
- **角色对应（v3 定稿）**：Shot 1 / Shot 3（诺曼）= **白衣男子**（`Picture 3` 全身 + `Picture 4` 脸）；Shot 2（光头）= **红衣老者**（`Picture 1` 全身 + `Picture 2` 脸）
- 抽帧验收（v3：0.20 / 3.00 / 5.70s）：
  - Shot 1（0–0.46s）白衣男子，浅蓝白袍 + 金冠 + 黑长发 + 八字胡，眼睛看向画面左侧，椅背在颈后可见 ✓
  - Shot 2（0.46–4.00s）红衣老者，黑金高帽 + 白须 + 云纹领口，口型持续 ✓
  - Shot 3（4.00–5.88s）回到白衣男子，震惊表情 → 起身，5.70s 椅背完全出画、肩线明显上移 ✓
  - 无第三人脸、无西装残留，背景办公室与机位保留
- v1 的问题：提示词把「起身」写成「头微前送」，成片只有表情没有身体上移；v2 补写「肩头上升、椅背滑出画面下沿」后复现成功。v2 的角色分配写反（诺曼给了红衣），v3 对调后修正。

### 提示词合规（h3-prompt-writing / ref-en.txt）

- 六段顺序：`subject_definitions` → `summary` → `retention_analysis` → `detailed_description` → `overall_soundscape` → `non_diegetic_music` ✓
- 任务类型：`[video editing + audio reuse]`，summary 以 “The target video is an edited version of &lt;Video 1&gt;.” 开头 ✓
- 镜头标注：首镜无时间戳，后续 `[Shot 2] At 00:00.458, ...` / `[Shot 3] At 00:04.000, ...` ✓
- 音频关系：`<Audio 1>: fully_copy`（音频专用标记，不用 fully_preserved）✓
- 说话人：首个发声源标 `(S1)`，不写 `(Sx)` 到 retention_analysis ✓
- 时长 5.875s 落在 4–15s 允许区间，与帧数换算一致 ✓

## 5. 已知限制

- 源片只有 6.208s（149 帧），按 17k+5 网格交付 141 帧，尾 8 帧（0.33s）舍弃。
- 源片 842 宽不是 32 的倍数，出片按 832 生成，水平有约 1.2% 缩放。
- Shot 1 只有 11 帧（0.46s），H3 对极短镜头的表现有限，已按原剪点保留。
- 「起身」只表现为**近景内的身体上移**（肩头升高、椅背滑出画），不会出现全身站起的构图——源片本身是贴着近景拍的，改了就不是原片了。
- 4 张参考图的 `fileName` 约 24 小时过期；过期报「找不到图」就重传，不用改接线。
- 2.34MP × 141 帧吃显存；OOM 时把「出片宽/高」降到 704×576（→1408×1152）。

## 6. 复现

```bash
node build.mjs                     # → dist/H3_duet_replace_twopass.ui.json
node check.mjs                     # 结构自检；默认读本目录的 workflow.ui.json
node <runninghub-cloud-yashu>/scripts/rh.mjs --upload "assets/xxx.png"   # 换新 fileName
```

改参数只动 `build.mjs` 顶部：`FRAMES` / `WIDTH` / `HEIGHT` / `UPSCALE` / `SEED` / `ASSETS` / 提示词 `P`。

## 7. 目录

```
workflow.ui.json   可直接导入 RunningHub（交付件，ASCII 文件名）
build.mjs          生成器
check.mjs          自检 + API 导出
templates/         底座图 + 二采源图
assets/            源视频、四张参考图原图（不入库，重传用）
record.md          本文件
```
