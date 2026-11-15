# H3 双人换人 · 极短镜头 · 一采（已入库）

**状态**：已入库（2026-11-14）
**适用场景**：**3–7 秒、只有两个人、分镜交替出镜的真人近景/特写对话**，把两人整人换掉（脸 + 发型 + 服装），保留原机位、剪辑点、表情、口型、起身动作与背景，音轨沿用原声。
**为什么用一采**：出片尺寸 = 生成尺寸（864×736），不需要放大交付；4 步一采的表演与身份已够用，二采只多边缘锐度，算力约 3 倍。**短对话片优先用这包，不要默认上二采。**

## 1. 它做什么

把一条 6.58 秒的反打对切（A→B→A）里的两个人换成两张参考图人物，音轨原声不动。三条镜头全部近景、机位固定、无运镜，只有 Shot 3 末段人物**从椅子上半起身前倾**。

## 2. 拓扑

```
UNET(ref2va int8) → turbo 4步 LoRA → SageAttention → 显存补丁
  ├→ BasicScheduler(beta,4) → H3SigmaRefiner(+2, 0.7, cosine) → SplitSigmas(4)
  │     → 取 high_sigmas → 一采 4 步 @864×736
  └→ BasicGuider ← MiniMaxH3ReferenceToVideo
        ref_images 0..1 = 人物1 / 人物2（每人一张，空槽已拆）
        ref_videos 0 / ref_video_audios 0 = 原片画面与声音
一采 → VAEDecode → VHS_VideoCombine(24fps, audio ← 原片音轨)
```

27 节点 / 30 连线，红块 4 / 橙块 1。

关键点：

1. **没有放大支路**：无 `LTXVSeparateAVLatent` / `MinimaxH3LatentUpscaler3D` / `LTXVConcatAVLatent`，也没有第二个 Sampler。
2. 输出走 `VHS_VideoCombine` 的 `audio ← VHS_LoadVideo`，成片音轨是原声（AAC 44.1k 立体声）。
3. 每人只挂一张参考图；模板原有 4 槽，空槽会拉低相似度，已删掉多余槽位与对应 `LoadImage`。

## 3. 默认参数

| 项 | 值 |
|---|---|
| 生成/出片分辨率 | **864×736**（源片 842×720，四边补黑：左 10 / 右 12 / 上 8 / 下 8） |
| 帧数 | **158**（17×9+5，24fps → 6.583s），源片 149 帧末帧复制补尾 |
| 采样 | beta / 4 步，尾部加密 +2 步（0.7, cosine），切分 4：全部给一采 |
| 参考图 | `Picture 1` = 光头（Shot 2）；`Picture 2` = 诺曼（Shot 1 / Shot 3） |
| 输出 | h264 mp4 / 24fps / crf19 / yuv420p / +faststart |

## 4. 实测记录

| 版本 | 提示词 | 成片 | 结论 |
|---|---|---|---|
| v1 `00002` | 旧词：服饰逐件枚举、台词普通引号、无说话人 ID | 864×736 / 158 帧 / 6.583s / 1391 kbps / 1.09 MB | 衣服干净；**诺曼嘴不动**（只写了静态 `mouth open`） |
| v2 `00001` | 加 `(S1)/(S2)` + `<d>[English]` + 逐字唇形 | 864×736 / 158 帧 / 6.583s / **1732 kbps** / 1.36 MB | **嘴逐字开合，口型对得上**；但 Shot 2 帽子冒出绿荧光竖条、肩胸冒橙火焰 |
| v3 | 服饰不再枚举，整身外观交给参考图 | 864×736 / 158 帧，尺寸与帧数同上 | **老板 2026-11-14 确认可用**：服饰干净无特效、口型逐字正常 |

- 抽帧验收（v2）：Shot 1 抿嘴聆听 ✓；Shot 2 说话逐字开合 ✓；Shot 3 张嘴说话 + 起身（椅背滑出画面下沿）✓
- 帧间差、音频电平未采样（与二采包同源片，可参考其 −34.2 dB 量级）

### 提示词合规（h3-prompt-writing / ref-en.txt）

- 六段顺序 ✓；任务类型 `[video editing + audio reuse]`，summary 以 “The target video is an edited version of &lt;Video 1&gt;.” 开头 ✓
- 首镜无时间戳，后续 `[Shot 2] At 00:00.458` / `[Shot 3] At 00:04.000` ✓
- 说话人 `(S1)` Shot 2、`(S2)` Shot 3，`<Audio 1>` 定义里绑定同一 ID ✓
- 台词只在 `detailed_description` 的 `<d>[English] ...</d>` 里 ✓（v1 违规点已修）
- `<Audio 1>: fully_copy` ✓

## 5. 已知限制

- 一采 4 步、无放大，皮肤与刺绣细节弱于二采；要放大交付时参考 `H3 二采 · Ref2VA` 包自己加放大支路。
- 服饰交给参考图后，个别片可能出现参考图白底渗到人物边缘；出现白边再补一句「参考图的白色背景不属于场景」。
- 源片 149 帧补尾到 158，末 9 帧（0.375s）是末帧克隆。
- 补黑边左右不等（10/12）：yuv420p 要求偏移偶数，差 1px 不可见。
- 参考图 `fileName` 约 24 小时失效，过期重传，接线不动。
- 只适用于**两人不同框**的分镜；同框双人或三人以上换人另走宽景包。

## 6. 复现

```bash
node build.mjs --video openapi/<新上传的视频文件名>.mp4
node check.mjs
```

改参数只动 `build.mjs` 顶部：`WIDTH` / `HEIGHT` / `FRAMES` / `SEED` / `PREFIX` / `VIDEO`；提示词改 `prompt.txt`。

## 7. 目录

```
workflow.ui.json   可直接导入 RunningHub（交付件）
build.mjs          生成器（base.ui.json + prompt.txt → workflow.ui.json）
check.mjs          自检 + 导出 API 版
prompt.txt         提示词唯一真相源（六段式，4804 字）
templates/base.ui.json  底座图（保真控件顺序）
assets/            源视频与两张参考图（不入库，重传用）
cover-3x4.jpg      平台封面（3:4 / 1680×2240）
record.md          本文件
```

## 8. 封面

- 文件：`cover-3x4.jpg`（3:4 / 1680×2240，沿用双人换人系列封面）
- 主标：**换人，不换戏**
- 副标：**原片原声 · 表情口型照旧**

## 9. 提示词避坑（2026-11-14 实测，换片必看）

两条都不是格式问题——格式全对，H3 照样出错。**下次换片先照这两条自查。**

### 9.1 说话的人嘴不动：只写静态口型 ≠ 在说话

**结论**：H3 把 `mouth open` 当成**一个姿势**，不是动作。必须同时给「谁在说 + 台词 + 逐字唇形动作」，嘴才会动。

**错法**（成片：嘴一直半张、形状不变，像卡住）

```text
[Shot 3] At 00:04.000, the shot cuts back to <Subject 2>, eyes wide, brows raised, mouth open,
holding a stunned expression ... he keeps rising with his mouth open.
```

**对法**（成片：逐字开合，跟原声对得上）

```text
[Shot 3] At 00:04.000, the shot cuts back to <Subject 2> (S2), eyes wide and brows raised,
and he says, <d>[English] But you can't do this to me.</d> His mouth keeps articulating
continuously from the first frame to the last: the jaw drops on the open vowels, the lips
round and close on the consonants, and his moustache and goatee move with his jaw.
```

四个硬要点：

1. **发声源必须挂 ID**：首个发声 `(S1)`、第二个 `(S2)`，全篇复用，并在 `<Audio 1>` 定义里绑定同一 ID。
2. **台词进 `<d>[Language] ...</d>`**，不写普通引号；台词只出现在 `detailed_description`，不要在 `subject_definitions` 里复述。
3. **动词换成动作**：`articulates` / `the jaw drops and rises` / `lips part and close`；把 `mouth open` 降级为状态描述，不作为唯一描述。
4. **写清持续区间**：`from the first frame to the last`；不说话的镜头正向写 `he is listening rather than speaking`，别用 `does not move` 这类否定句（H3 对否定不敏感，容易反向加强）。

**台词从哪来**：先抽音轨跑 STT（`rh-voice3-yashu` 的 `stt` 模式），再按切点把句子分给镜头。本次实测台词 `The board expects your resignation in 30 days.`（Shot 2）/ `But you can't do this to me.`（Shot 3），与切点 0.458 / 4.00 完全对应。

### 9.2 服饰写太满 → 冒出发光特效

**结论**：`gold` / `dragon` / `embroidery` / `ribs` / `ornaments` 这类词在同一句里叠 3 个以上，H3 会切到仙侠特效先验，把服饰渲染成**发光能量**，且整条镜头持续存在。

**错法**（成片：帽子上叠绿色荧光竖条、肩胸叠橙色火焰，四帧持续不消）

```text
a tall black official hat with gold vertical ribs, gold cloud-shaped ornaments and two upturned
wing flaps ... a deep red robe with a large gold dragon-and-cloud square badge, gold cloud
embroidery on the shoulders and cuffs, and a wide gold-studded belt
```

**对法**（成片：乌纱帽与红袍干净、全哑光）

```text
<Subject 1> is the official shown in <Picture 1>. His whole appearance is taken from <Picture 1>
and reproduced unchanged: face, hair, beard, headwear, robe and every accessory exactly as that
picture shows them.
```

三个硬要点：

1. **服装不做逐件枚举**，整身外观交给参考图；参考图本身是什么材质，模型就还什么材质。
2. 最多留一句轻约束：`with the garments reading as ordinary matte textile under the room light`。
3. **先对照再归因**：出现发光时，拿同一镜头、同一参考图的上一版成片比一帧——旧版干净就说明是提示词引起，不是参考图脏、也不是模型坏。本次证据：旧词版 Shot 2 全哑光，新词版同一帧整片发光。

**副作用**：不写服装后模型完全依赖参考图，要盯首帧人物边缘有没有把参考图的**白底**带进来；出现白边再补一句「参考图的白色背景不属于场景」。
