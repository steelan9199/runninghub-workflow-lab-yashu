# H3 七换一留 · 董事会宽景 · 一采（已入库）

**状态**：已入库（2026-11-14 老板在平台跑通、确认可用）
**适用场景**：**2–4 秒的真人宽景 / 群像镜头，画面里 8 个人同框——7 人整人换掉（脸 + 发型 + 服装），右下角只有一只手入画的那一位保持原样不换**。保留原机位、站位、表演、景深虚化、背景与黑边，音轨沿用原声。一采直出，不做任何放大。

## 1. 它做什么

把一条 3.04 秒的董事会宽景里的 7 个人换成 7 张参考图人物（明制袍服），第 8 个人只露一只手、不参与替换。近端左侧前景还站着一个背对镜头、完全虚焦的人（诺曼）——他也要换，但只能换背影，脸全程在画外。

## 2. 拓扑

```
UNET(ref2va int8) → turbo 4步 LoRA → SageAttention → 显存补丁
  ├→ BasicScheduler(beta,4) → H3SigmaRefiner(+2, 0.7, cosine) → SplitSigmas(4)
  │     → 取 high_sigmas → 一采 4 步 @864×736（全部步数给一采）
  └→ BasicGuider ← MiniMaxH3ReferenceToVideo
        ref_images 0..6 = 诺曼 / 高拱 / 张居正 / 严世蕃 / 裕王 / 李妃 / 海瑞
        ref_videos 0 / ref_video_audios 0 = 原片画面与声音
一采 → VAEDecode → VHS_VideoCombine(24fps, audio ← 原片音轨)
```

32 节点 / 35 连线，红块 9 / 橙块 1。

关键点：

1. **没有放大支路**：无 `LTXVSeparateAVLatent` / `MinimaxH3LatentUpscaler3D` / `LTXVConcatAVLatent`，也没有第二个 Sampler。
2. 输出走 `VHS_VideoCombine` 的 `audio ← VHS_LoadVideo`，成片音轨是原声。
3. 模板只声明 `ref_image_0..3`，**第 5–7 个槽位由 `build.mjs` 手动插进节点**（插在 `ref_videos` 之前，顺序即 Picture 序号）。
4. 右下角那只手**不建 Subject**，靠提示词写死「只有一只手在画内，不许补脸、补肩、补上身」。

## 3. 默认参数

| 项 | 值 |
|---|---|
| 生成/出片分辨率 | **864×736**（源片 842×720，四边补黑：左 10 / 右 12 / 上 8 / 下 8） |
| 帧数 | **73**（17×4+5，24fps → 3.042s），源片正好 73 帧 |
| 采样 | beta / 4 步，尾部加密 +2 步（0.7, cosine），切分 4：全部给一采 |
| 种子 | fixed `20261114`（要换一版改 `build.mjs` 顶部 `SEED`） |
| 参考图 | 7 张，顺序 = `Picture 1..7`（顺序即人物，改一张就换一个人） |
| 输出 | h264 mp4 / 24fps / crf19 / yuv420p，音轨 AAC 44.1k 原声 |

### 人物映射（画面位置 → 参考图）

| 席位 | 原片人物 | 参考图 | 备注 |
|---|---|---|---|
| 近端左侧前景 | 站着的黑西装男 | `Picture 1` 诺曼（人物2） | 背对镜头、虚焦，脸全程在画外 |
| 左一 | 灰发东亚老者 | `Picture 2` 高拱 | 红袍 + 黑高帽双翅 |
| 左二 | 银灰领带男子 | `Picture 3` 张居正 | 长黑须 |
| 左三 | 红领带男子 | `Picture 4` 严世蕃 | 瘦脸窄须 |
| 长桌尽头 | 白发老者 | `Picture 5` 裕王 | 金冠 + 黑金袍，端茶杯 |
| 右侧 | 金发女士 | `Picture 6` 李妃 | 唯一女性，凤冠 |
| 右边缘 | 只露肩与拳 | `Picture 7` 海瑞 | 脸在画外 |
| 右下角 | 只露一只手 | **不换** | 不建 Subject |

## 4. 实测记录

| 版本 | 提示词 | 结果 |
|---|---|---|
| v1 | 每人只写「whole appearance is taken from `<Picture N>`」+ 一条总否定 | 高拱 / 裕王 / 李妃换对；**张居正 / 严世蕃 / 诺曼 / 海瑞仍穿原片西装**，人脸也没换 |
| v2 | 逐人写出「袍子颜色 + 帽子形状 + 胡须」，并把原片西装标成 `not_retained` | 老板平台跑通确认（当前入库版本） |

- 源片音频（本地实测）：mean −34.2 dB / max −12.3 dB，两处短静音（0.25–0.76s、1.22–1.49s）。
- 成片由老板在平台侧跑，本地未留存文件；帧间差、码率未采样。
- **v1 的失败根因**：宽景里每张脸只占 60–90px，一句抽象的「外观取自参考图」模型抓不住，会直接沿用原片服装。必须把服装写成具体的颜色与形制，并显式声明原片西装作废。

### 提示词合规（h3-prompt-writing / ref-en.txt）

- 六段顺序：`subject_definitions` → `summary` → `retention_analysis` → `detailed_description` → `overall_soundscape` → `non_diegetic_music` ✓
- 任务类型 `[video editing + audio reuse]`，summary 以 “The target video is an edited version of `<Video 1>`.” 开头 ✓
- 单镜头无剪辑，不写时间戳；七个 `<Subject N>` 都写清了座位与「脸是否在画外」✓
- `<Audio 1>: fully_copy` ✓
- 另加两句硬约束：原片现代服装 `not_retained`；「所有布料哑光、不发光、无霓虹边」——防 01 那次出现过的绿荧光 / 橙火焰。

## 5. 已知限制

- **一采 4 步 + 7 张参考图已接近容量上限**。v1 有 4 人完全没换；再多人、脸更小、或提示词退回抽象写法，会再次掉服装。
- 同款红袍三人（高拱 / 张居正 / 严世蕃）靠胡须与脸型区分，不靠服装；提示词里必须逐人点名，且要求三张脸不重复。
- 诺曼是虚焦背影，**无法验证脸部相似度**；`Picture 1` 只贡献袍色、金冠与长发轮廓。
- `人物2.png` 与 `海瑞.png` 是 2304×1024 三视图，模型会把三个姿态平均；要更稳就换单人正面白底立绘。
- 7 个红块（+原片+提示词共 9 个）超过「≤6」的指路上限，按人物替换的必要性保留。
- 参考图 `fileName` 约 24 小时过期；报「找不到图」就重传换 `ASSETS`，接线不动。
- 本包**没有二采支路**，要放大交付请走 `H3-七人换人-董事会宽景-二采` 或 `H3 二采 · Ref2VA`。

## 6. 复现

```bash
node build.mjs                 # 读 prompt.txt + templates/base_onepass.ui.json → workflow.ui.json
node check.mjs                 # 结构自检 + 导出 workflow.api.json
node <runninghub-cloud-yashu>/scripts/rh.mjs --upload "<本地图>"   # 换新 fileName 后改 build.mjs 的 ASSETS
```

改参数只动 `build.mjs` 顶部：`FRAMES` / `WIDTH` / `HEIGHT` / `SEED` / `OUT_PREFIX` / `ASSETS`；提示词只改 `prompt.txt`，**不要手改 workflow.ui.json**（下次 build 会覆盖）。

## 7. 目录

```
workflow.ui.json   可直接导入 RunningHub（交付件，含 v2 提示词）
workflow.api.json  API 格式（提交用）
build.mjs          生成器（含补 ref_image_4..6 槽位的逻辑）
check.mjs          自检 + API 导出
prompt.txt         提示词唯一真相源
templates/         底座 UI 模板（一采链路，保真控件顺序）
record.md          本文件
```

`assets/`（源片 + 7 张参考图）按库规不入库，本地在 `诺曼被踢出董事会/02/assets/`。

## 8. 封面

**待补**。按库规需要 `cover-3x4.jpg`（3:4 / 1680×2240，霞鹜文楷叠字，无影视明星面孔）。
