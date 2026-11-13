# H3 七人换人 · 董事会宽景 · 二采（已入库）

**状态**：已入库（2026-11-14 老板确认成片可用）
**适用场景**：**2–6 秒的真人全景 / 中远景群像镜头，把画面里最多 7 个人整人换掉（脸 + 发型 + 服装），保留原机位、站位、表情、口型与背景，音轨沿用原声**。含「只有半个身子或一只手入画」的边缘人物也适用。同一条视频里多人同款服装、靠位置区分的场景同样适用（靠提示词逐人点名压串脸）。

## 1. 它做什么

把一条真人视频里的 7 个人一次换成 7 张参考图（古装人物），保留原片的镜头、站位、动作、**表情与口型**、背景与道具，音轨沿用原声。采样走二采：低清跑站位与表演 → 只放大视频潜空间 2× → 高清补皮肤与官服纹样。

## 2. 拓扑

```
UNET(ref2va int8) → turbo 4步 LoRA → SageAttention → 显存补丁
  ├→ BasicScheduler(beta,4) → H3SigmaRefiner(+2, 0.7, cosine) → SplitSigmas(4)
  │     ├→ 一采 4 步 @832×704
  │     └→ 二采 2 步 @1664×1408
  └→ BasicGuider ← MiniMaxH3ReferenceToVideo
        ref_images 0..6 = 高拱 / 张居正 / 严世蕃 / 裕王 / 李妃 / 海瑞 / 陈洪
        ref_videos 0 / ref_video_audios 0 = 原片画面与声音
一采 → 分离 AV → 只放大视频潜空间 2× → 拼回音频 → 二采 → VAEDecode
→ VHS_VideoCombine(24fps, audio ← 原片音轨)
```

关键点：

1. 一采/二采共用同一个 `RandomNoise` 与 `BasicGuider`，是续采不是重跑。
2. 只放大视频潜空间，音频潜空间原样带走（`LTXVSeparateAVLatent → MinimaxH3LatentUpscaler3D → LTXVConcatAVLatent`）。
3. 输出走 `VHS_VideoCombine` 的 `audio ← VHS_LoadVideo[2]`，成片音轨是原声。
4. 底座模板只声明了 `ref_image_0..3` 四个输入，**第 5–7 个槽位由 `build.mjs` 手动插进节点**；手改接线时别把这段删掉。

## 3. 默认参数

| 项 | 值 |
|---|---|
| 一采分辨率 | 832×704（源片 842×720 向下取 32 倍数） |
| 二采分辨率 | 1664×1408（2×） |
| 帧数 | 56（17×3+5，24fps → 2.333s） |
| 采样 | beta / 4 步，尾部加密 +2 步（0.7, cosine），切分 4：一采 4 步 / 二采 2 步 |
| 参考图 | 7 张，顺序 = Picture 1..7（顺序即人物，改一张就换一个人） |
| 输出 | h264 mp4 / 24fps / crf19 / yuv420p，音轨 44.1kHz 立体声 |

## 4. 实测记录（v1 定稿）

- 任务：taskId 2121295527919439873（壳 workflowId 2120926368186851330）
- 成片：1664×1408 / 56 帧 / 2.333s / 3820 kb/s / 1.06MB / 原声 44.1kHz
- 帧间差：平均 0.35、最大 0.62、最小 0.10（静态会议镜头，几乎无抖）
- 音频：mean −34.2 dB、max −12.3 dB
- 角色对应（画面位置 → 参考图）：
  - 左一 = 高拱（`Picture 1`）、左二 = 张居正（`Picture 2`）、左三 = 严世蕃（`Picture 3`）
  - 长桌尽头 = 裕王（`Picture 4`）、右侧 = 李妃（`Picture 5`）
  - 右边缘只露肩与拳 = 海瑞（`Picture 6`）、右下角只露一只手 = 陈洪（`Picture 7`）
- 抽帧验收（0.20 / 1.00 / 1.80 / 2.25s）：
  - 七个人全部换到位，五个红袍脸互不重复：灰白须=高拱、长黑须=张居正、窄须瘦脸=严世蕃
  - 裕王黑金袍 + 金冠，端茶杯→放下的手势保住；李妃金凤冠 + 紫凤袍，右手压文件夹
  - 海瑞只有蓝袍肩与拳、陈洪只有一只手，两人的脸都没有被凭空补出来
  - 背景、玻璃桌倒影、白瓷茶杯全部原样；**无西装残留、无多余的人**

### 提示词合规（h3-prompt-writing / ref-en.txt）

- 六段顺序：`subject_definitions` → `summary` → `retention_analysis` → `detailed_description` → `overall_soundscape` → `non_diegetic_music` ✓
- 任务类型：`[video editing + audio reuse]`，summary 以 “The target video is an edited version of <Video 1>.” 开头 ✓
- 单镜头无剪辑，不写时间戳；七个 `<Subject N>` 都写清了座位与「脸是否在画外」✓
- 音频关系：`<Audio 1>: fully_copy` ✓
- 另加一段**身份隔离约束**（谁有长须、谁有红帽、谁是唯一女性、不许换西装戴眼镜），这是七人不串脸的主要手段

## 5. 已知限制

- 源片 59 帧，按 17k+5 网格只能交 56 帧（2.333s），尾部 3 帧（0.125s）舍弃。
- H3 是**整人重绘**不是换脸：认得出是谁，但不是像素级撞脸；本片人脸只占 60–90px。
- 同款红袍靠提示词逐人点名区分，不是靠服装；再多人或脸更小就要考虑拆两轮。
- `ref_images` 实测最多 9 个槽位；要「每人全身 + 脸特写」共 14 张，必须拆成两轮或改遮罩合成。
- 海瑞的蓝袍袖位于画面右边缘，比原片的深色西装袖亮，右边缘会有一点「亮块」感。
- 7 个红块（+原片+提示词共 9 个）超过「≤6」的指路上限，按人物替换的必要性保留。
- 参考图 `fileName` 约 24 小时过期；过期报「找不到图」就重传，不用改接线。

## 6. 复现

```bash
node build.mjs                     # → dist/H3_board7_replace_twopass.ui.json
node check.mjs                     # 结构自检 + 导出 API 版
node <runninghub-cloud-yashu>/scripts/rh.mjs --upload "assets/xxx.png"   # 换新 fileName
```

改参数只动 `build.mjs` 顶部：`FRAMES` / `WIDTH` / `HEIGHT` / `UPSCALE` / `SEED` / `ASSETS` / 提示词 `P`。

## 7. 目录

```
workflow.ui.json   可直接导入 RunningHub（交付件，ASCII 文件名）
build.mjs          生成器（含补 ref_image_4..6 槽位的逻辑）
check.mjs          自检 + API 导出
templates/         底座图 + 二采源图
assets/            源视频、七张参考图原图（不入库，重传用）
cover-3x4.jpg      平台封面（3:4 / 1680×2240）
record.md          本文件
```

## 8. 封面

- 文件：`cover-3x4.jpg`（3:4 / 1680×2240）
- 主标：**七个人，一次换完**
- 副标：**原片原声 · 站位手势照旧**
- 底图：暗调董事会会议室，黑色长桌 + 白瓷茶杯，一张椅背搭深红明制官服，另一张搭炭灰西装外套与白衬衫；无人物、无面孔（`rh-h3-t2i` 生成，seed 1729266190）
- 文字：霞鹜文楷 Medium 150px / Regular 64px，PIL 叠在上三分之一，暖金 + 米白
