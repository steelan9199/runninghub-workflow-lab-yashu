---
name: runninghub-workflow-lab-yashu
description: RunningHub 工作流的「学习—仿写—实测—交付」闭环工具。当用户要 AI 自己写/搭/改 RunningHub 工作流（ComfyUI UI 格式 .json）、想把站上现成工作流交给 AI 学习并复用接线、想用本地 JSON 直接提交测试而不用在网页新建保存、或工作流跑失败要查节点缺失/参数类型/没有输出节点时使用。核心契约（已实测）：POST /task/openapi/create 的 workflowId 必填（缺则 code 301 must not be null），但同时传 workflow=完整 API 格式 JSON 时会覆盖站内那张图，因此可固定用空壳 ID 2120926368186851330 当通道；本技能一律 nodeInfoList=[]，参数直接写进图。交付规范（§4）：可改参数标红 #c0392b/#5b1f1f、输出节点标橙 #d35400/#5a3208、LoadImage 的素材先经 RH 上传换 fileName 再回填。含零成本 smoke 自检、按 ID dump 语料库、失败节点回显与视觉验收判据。不替代 runninghub-cloud-yashu 的成品出图通道。只做工作流的学/写/测/交付：用站上成品模型或现成 AI 应用直接出图出片走 runninghub，生产 alias 与正式出图流水线走 runninghub-cloud-yashu。
agent_created: true
version: 0.2.7
---

# RunningHub 工作流实验室

让 AI 能自己写 RunningHub 工作流、自己验证能不能跑。**只做「学 → 写 → 测」**；正式出图/改图业务走 `runninghub-cloud-yashu`，本地抠图/线稿/叠图走 `comfyui-local-yashu`。

## 0.0 开工三问：先问目的，再谈做法（本技能最高门禁）

**老板说「加个节点 / 换个流程 / 拆个包」时，那不是需求，是他猜的解法。先问清目的，再动手。**

三问答不全，不许开始写/改工作流：

1. **What**：最终要交付的画面是什么样？（人、动作、镜头、时长、有无声音）
2. **Why**：现在这条链路里，**哪个具体画面问题**让你想加它？要能指出哪一帧、哪一秒、崩在哪。
3. **How**：除了你说的做法，还有没有更直接的路？我至少给两条，并标出各自代价。

四条硬规定：

- **主动探究，不顺着执行。** 我掌握的模型与节点知识比老板多，就该先判断「他真正缺的是什么」。例：他说「加个景别控制」，先分辨是构图漂、还是动作丢，两者的解法完全不同。
- **判断方案不成立时必须说服后才开工。** 不许「先照做，事后附一句风险」。说服格式：现象证据 → 这条路为什么解决不了 → 替代方案 → 代价对比。老板仍坚持则执行，但在交付说明和包 `record.md` 里写一行「已告知：X 方案代价为 Y」。
- **反例（真实发生过，别再犯）**：老板要求「接深度图 + 骨架图」，我直接照着他的连线跑通，没问目的。真实目的是「跳舞动作要和人一样，只换人」。深度的作用是压住模型推近镜头、骨架是锁关节姿态；不问目的，就分不清该加哪个、为什么加，也判断不出成片「乱」是镜头结构崩了还是控制信号失效。
- **目的确认后写进 `record.md` 的「一句话用途」**，后续每轮改动都回看这一句，不许中途换目标。

## 0. 建流前先给方案与代价（仅次于 §0.0）

**在写/改任何工作流、定任何参数之前，必须先输出《方案对比》，未获老板确认不得动手。** 冲突时以 §0.0 与本节为准。

必做五条：

1. **先讲判据，再报参数。** 先说清这件事由哪 2–3 个参数决定成败（分辨率、采样次数、重绘轮次、放大倍率），再给数值。不要一上来就报「832×704、4+2 步」。
2. **至少两个方案 + 各自代价。** 每个方案写清：画质、显存、耗时、以及会不会让已换好的角色漂移。标出推荐项和理由。
3. **主动说出「这个需求不需要什么」。** 多余环节要主动砍并说明理由。例：源尺寸等于交付尺寸时，二采没有存在理由（它唯一的用途是放大后补细节）；换人任务的第一原则是「重画次数最少」，不是「步数越多越好」。
4. **老板给的方案有明显代价时必须先提醒。** 即使老板已拍板，也要先说清代价再执行；老板不知情就执行，等于失职。
5. **事后发现选错路，先认这一步没提醒，再给回退方案。** 不许用「你当时自己选的」推责。

底线：宁可多花一轮对话，也不要让老板在不知道代价的情况下定方向。**走错一条链路，损失的是几十分钟跑片和几轮返工。**

## 0.1 三条契约（2026-11-13 实测，别重新试错）

| # | 事实 | 证据 |
|---|---|---|
| 1 | `/task/openapi/create` 的 `workflowId` **必填**，不能只发图 | 只给 `workflow` → `{"code":301,"msg":"must not be null"}` |
| 2 | 给 `workflow`（完整 API 格式 JSON 字符串）时，**跑的是这份图**，不是站内那张 | 把节点 1 改成不存在的类 → FAILED：`Node 'bad' not found` |
| 3 | 所以可拿一个空壳 ID 当固定通道 | 默认壳 `2120926368186851330`（两个 `easy showAnything`，零成本，不会误跑生产） |

壳可用 `--shell <workflowId>` 或环境变量 `RH_SHELL` 覆盖；壳必须属于本账号。

## 0.2 尺寸约束按节点查（不是所有视频都要 64）

**倍数要求来自节点内部怎么切张量，不来自「视频」这个身份。拿到源片先看它进哪个节点，只对命中项处理，其余原样进图。**

- **DepthCrafter → 输入帧宽高必须 64 的倍数。** 内部按 64 取整、按窗口拼接、再 1/8 下采样；不满足时它自己取整（736 → 768），与未取整的一路拼不齐，报 `Sizes of tensors must match except in dimension 2. Expected size 96 but got size 92`（96=768/8，92=736/8）。适用：任何帧序列进 DepthCrafter。
- **MiniMax H3 → 只有生成尺寸 `width/height` 要 32 的倍数**（VAE 8× 下采样 + patch；二采放大 `align=32`）。**参考视频不受倍数约束**：`ref_video` 任意宽高，节点内部重采样到生成尺寸，842×720 喂 832×704 生成实测可跑（`verified/H3-双视频对齐-动作迁移-二采` 全图无缩放/补边节点）。真正要盯的是**比例**——参考视频与生成尺寸比例不一致会被拉伸变形，需要时用补边做成同比例，目的不是凑倍数。
- **无要求**：DWPose / OpenPose 预处理、`VHS_LoadVideo` / `VHS_VideoCombine`、纯编码与转封装。

**不满足时优先补边，不要缩放。** 缩放会改比例（864×736 → 832×704 = 横压 0.7%、纵丢 4.5%），让空间参考与主参考逐像素错位；补黑边到最近的 64 倍数（864 → 896、736 → 768，四周各 16px）保留全部画面，算完再裁回原尺寸。节点：`ImagePadForOutpaint`（feathering=0）补边、`ImageCrop` 回收。

**本处是唯一真相源。** `references/pitfalls.md` 与各包 `record.md` 只写「尺寸约束见 SKILL.md §0.2」，不复述；工作流图内的 MarkdownNote / 节点标题允许写具体尺寸（图会离库单独进平台，必须自解释），那只是本包操作提示，不是标准。

## 1. 先自检（零成本，30 秒）

在技能目录下：

```bash
node scripts/rhx.mjs smoke
```

它自己生成一张 64×64 PNG → 上传换 `fileName` → 提交 `LoadImage → SaveImage` → 下载产物。打 `✓ smoke 通过` 就说明 KEY、网络、壳 ID、直投、下载全通。**任何异常先跑这一条，别直接上真实工作流。**

## 2. 学：把参考工作流变成可仿写的语料

```bash
node scripts/rhx.mjs learn <workflowId> --tag 文生图   # → corpus/wf_<id>.json + 更新 corpus/index.json
node scripts/rhx.mjs index                            # 看全库
node scripts/rhx.mjs index --grep SaveVideo           # 按类名筛
```

`learn` 只读站上已存的图，不提交任务、不耗额度。读 `corpus/wf_<id>.json` 时按这四样抄：

1. `class_type` 组合 —— 这类任务需要哪些节点，以及**节点是否已在 RH 机器装好**（写错 = `missing_node_type`）；
2. `inputs` 里的上游引用 —— 形如 `["6", 0]`，表示接节点 6 的第 0 个输出；
3. 字段名与取值范围 —— 尤其是模型文件名、枚举值，照抄不要凭记忆写；
4. `_meta.title` —— 只是给人看的标题，不影响执行，可留可删。

**学习顺序**：先找同族最简的那张（节点最少、有输出节点）当骨架 → 只改必要节点 → 再逐步加。别一上来照抄 30 节点的大图。

### 2.1 按任务种类找入口（开写前先查这张表）

| 任务种类 | 起手抄哪份 | 关键节点 / 判据 |
|---|---|---|
| **H3 换人**（同一镜头只换人，动作镜头节奏照旧） | `verified/` 里同族包，别从零搭 | `ref_video` 喂原片、`ref_image` 喂人物图；构图/景别/是否站定必须写进 `summary` 与 `detailed_description` 开头 |
| **只换人不换背景**（遮罩内重绘） | `corpus/wf_2090037412381683713.json`（H3+SeC4B 角色替换） | 首帧 `PointsEditor` 打点 → `SeCVideoSegmentation` 跟帧 → `GrowMask`(150) → `SetLatentNoiseMask` 只重绘遮罩内、音频潜空间全 0 冻结；参考图先 `RemoveBackground` 贴白底。`max_frames_to_track=1`，**硬切必须断段**。懒人版选人换 `corpus/wf_1991610436030308353.json`（SAM3，一句话描述即可，不用手点） |
| **音频驱动数字人** | `corpus/wf_2084814218431385601.json`（单人）/ `wf_2084818471610839041`（双人） | `VRGDG_MiniMaxH3AudioDrive` 把音频直接写进 `av_latent`；长度用 `SoundFlow_GetLength` + `ComfyMathExpression` 自动凑 17k+5；双人靠 `AudioCrop`+`EmptyAudio(0.5s)`+`AudioConcat` 拼说话顺序 |
| **首帧对齐 / 定妆图** | `corpus/wf_2000971709572317185.json`（Z-image + ControlNet） | 视频首帧 → `AIO_Preprocessor(DWPreprocessor)` → ControlNet Union → Z-image turbo 10 步；出「和原片同姿态」的新角色图再当 `<Picture 1>` |
| **骨架驱动换人跳舞** | `corpus/wf_2072999797982011392.json`（UniAnimate）+ `verified/DWPose-视频转骨架-无声` | 骨架走单独工作流出 mp4，再当第二个视频输入；**别把 DWPose 塞进 H3 图里**（老板 2026-11-15 明确要求两条工作流分开）。驱动侧先 resize 到目标画幅再提骨架，否则 bbox 归一化会把构图顶成中景 |
| **动作迁移 / 图生跳舞**（不用 H3） | `corpus/wf_1953091916986519553.json`（MimicMotion） | `MimicMotionGetPoses`(body+hand+face) → `MimicMotionSampler`；分辨率被 **64 整除**卡死，默认死在 576×1024 竖幅 |
| **人物抠像 / 去背景** | `corpus/wf_2036452966554673154.json`（MatAnyone2） | 首帧 `SegmentV2`（GroundingDINO+SAM，`prompt` 写主体名）出 mask → `MatAnyone2.foreground_mask`；只首帧分割，硬切/出画要手动换帧重出 mask；取第 2 路输出拿带 alpha 的干净前景 |
| **H3 多采 / 高清** | `corpus/` 里 6 张收藏（见 `references/favorites.md` 1–6） | 先 `H3SigmaRefiner` → `SplitSigmas` → 一采 → `MinimaxH3LatentUpscaler3D` 2× → 二采 |

**换人线铁律（2026-11-15 定）**：

1. **文字管身份与构图，骨架管动作**。参考视频本身就是最详细的动作提示词；提示词的任务是堵住模型自作主张的口子（景别、人占画面多大、手里有没有东西、会不会站定），不是复述动作。
2. **否定句会反噬**。写「不要站定 / 不许停」，模型读到的是「站定 / 停」。一律改成正向动作句（「每半秒换一次支撑腿」）。
3. **文本违背视频 = 视频被覆盖**。镜1 实测：主句写「停下夹烟」，整段就成了站姿。写提示词前先把参考视频逐段看完，再动笔。
4. 要「动作一模一样」只能上骨架；只靠提示词最多做到「别跳错、别乱推镜头」。

## 3. 写：API 格式硬规则

```json
{
  "1": { "class_type": "LoadImage", "inputs": { "image": "openapi/xxx.png" } },
  "2": { "class_type": "SaveImage", "inputs": { "images": ["1", 0], "filename_prefix": "lab" } }
}
```

- 顶层是对象，**节点 ID 用字符串**；每个节点必须有 `class_type`；
- 引用上游 = `["<节点ID>", <输出槽序号>]`；
- **必须有输出节点**（`SaveImage` / `SaveVideo` / `SaveAudio` / `VHS_VideoCombine` 等），否则任务 `SUCCESS` 但 `results` 为空，等于白跑；
- 整数控件给数字（`"seed": 123`），给字符串会报 `manual_seed … got str`；
- **字段名不统一，按节点逐个核**：`ImageInvert` / `ImageScale` 吃 `image`，`SaveImage` 吃 `images`。已知对照与踩坑记录见 `references/pitfalls.md`，**写之前先查，别按同类节点的直觉推**；
- `LoadImage` 只吃 `fileName`（`openapi/xxx.png` 这种），不吃 URL；上传得到的 fileName **1 天过期**；
- JSON 里不能有注释、BOM、尾逗号；
- 参数**直接写进图**，不要塞 `nodeInfoList`——服务端会拿已存工作流校验它，本地新增节点对不上就报 803。

### 3.1 手写 UI 节点前，先查 `/object_info`（2026-11-15 实测）

自己拼 UI 格式 `.json` 时，`widgets_values` 的顺序必须和节点的真实定义一致，错一位就整排参数串位（见 `references/pitfalls.md`「命名对照」）。**不要凭 API 图的 key 顺序猜**——API 图里的顺序是执行字典序，不是控件序。真实定义直接问平台：

```bash
curl -s "https://www.runninghub.cn/object_info/MatAnyone2"
# 也可直接取：.../object_info/LayerMask%3A%20SegmentAnythingUltra%20V3
```

**不用鉴权、不要 KEY**，返回该节点的 `input.required` / `input.optional` / `output` / `output_name`。

四条用法：

1. **控件顺序 = `required` 顺序 + `optional` 顺序**，逐个筛：「带枚举/默认值、且没有 `forceInput: true`」的才是控件（进 `widgets_values`）；`forceInput: true` 的是纯连线槽（如 `MatAnyone2.mask_frame_index` 接 `PrimitiveInt`）。
2. **`widgets_values` 的长度 = 筛出来的控件数**，多一个少一个都会串位。
3. **输出槽顺序看 `output` 数组**，名字看 `output_name`，别按直觉写（`MatAnyone2` 是 `rgba_image` / `alpha_mask`）。
4. **接口只证明「有定义」，不证明「已安装」**。实测 `ImageThreshold` 查得到完整定义，但提交后报 `missing_node_type`——装没装只能真跑一次才知道；查不到定义（404/空）才是这台机器根本没有该节点包。

## 4. 交付：红 / 橙 / 素材预填（写完工作流必做，别等老板催）

**适用面**：本技能交付给老板在 RunningHub 网页导入运行的 **UI 格式** `.json`。API 格式的测试图不套用本节。

### 4.0 反广告硬规则（2026-11-15 老板定）

**我写 / 改 / 交付的每一份工作流，里面不许出现任何作者标识。** `corpus/` 里别人的图只能当接线参考，落进自己的图时必须清干净。历史文件不管，从这条规则起生效。

判定为广告的四处，逐处必查：

1. **节点 `title` 尾部** —— `ManualSigmas aijuxi`、`RTX Video Frame Generation aijuxi`、`Math Expression aijuxi`。作者名 / 频道名 / 工作室名贴在类型名后面，一律删掉；保留功能性中文名（`图片1`、`提示词`、`分辨率`）和纯类型名。
2. **`filename_prefix`** —— `r-pika-i2v-aijuxi` 这种带作者名、个人缩写、频道名的，改成中性名（`h3_i2v`、`joker02_shot1`）。
3. **`extra` 元数据** —— `cos_url` / `fullpath` / `objectKey` / `workflow` png 名里常残留作者个人目录 hash 和旧文件名。**这层最容易漏**，导出前整块清空；不然「存成 png 再拖回平台」时痕迹又回来了。
4. **工作流标题** —— 顶部名称里不许出现 `B站XXX`、`抖音XXX`、`小红书XXX`、`公众号XXX`、邀请码、QQ / 微信、`rh-xxxx`。

**一句话判据：凡是能让人顺藤摸到原作者的信息，一律删。**

反面样本（只作参考，不入库）：`Pika版 MinimaxH3 图生视频！1080P+高帧率+15秒=约10分钟！B站艾橘溪！261112` —— 标题带频道 + 作者名，里面三处 `title` 尾巴、两处 `filename_prefix`、整片 `extra` 产物地址全是 `aijuxi`。

### 4.1 上色：三种状态一眼可辨

| 类别 | 判定 | color / bgcolor | 标题 |
|---|---|---|---|
| 用户要改的参数 | 提示词、宽高/比例、时长/帧数、种子、载入图片/视频/音频 | `#c0392b` / `#5b1f1f` | 前缀 `★ 改这里 · <说明>` |
| 输出节点 | `SaveImage` / `SaveVideo` / `SaveAudio` / `VHS_VideoCombine` 等真正落盘的节点（`CreateVideo` 是中间件，不上色） | `#d35400` / `#5a3208` | 不加前缀 |
| 其余 | 模型加载、采样、解码、数学节点 | 不设 `color` / `bgcolor` | — |

配色与 `comfyui-workflow-beautify-yashu` 同一套常量，别自创色值。判「可改」的口径也照该技能：**用户不改就出不了他自己想要的那条片子，才算可改**——别把采样步数、放大倍率这种调优项也标红，红块超过 6 个就失去指路作用。

### 4.2 素材预填：不让老板自己准备图

交付前把 `LoadImage` / `LoadVideo` 需要的素材准备好并**填进节点**，老板导入后只管点运行。

| 步 | 做法 |
|---|---|
| 1 判定 | 列出图里所有素材槽位，分「必需」（不填就跑不起来：首帧、参考图、控制图）与「可选」 |
| 2 生成 | 必需素材 **≤ 2 张直接生成，不再请示**；> 2 张或非必需才先问一句。通道走 `runninghub-cloud-yashu`：`rh1 --in batch=4` 出图（一次 4 张候选），多帧要同一角色用 `rh2 --in batch=4` |
| 3 上传 | `POST https://www.runninghub.cn/openapi/v2/media/upload/binary`，multipart 字段名固定 `file`，`Authorization: Bearer <KEY>` → 取 `data.fileName`（形如 `openapi/<hash>.png`）。等价捷径：`node <runninghub-cloud-yashu>/scripts/rh.mjs --upload <本地图>` |
| 4 回填 | `fileName` 原样写进 `LoadImage.image`。**只认 fileName，不认 URL、不认本地路径** |
| 5 留底 | 原图另存到交付目录 `assets/`，说明卡片写明有效期与重传方式 |

重传（写进说明卡片的模板，别写死本机路径）：

```bash
node <runninghub-cloud-yashu>/scripts/rh.mjs --upload "<本地图>"   # 拿回新 fileName，再填进 LoadImage.image
```

> `fileName` **1 天过期**。过期后节点报找不到图，不是接线错——重传换名字即可，别改连线。

### 4.3 提示词预填

提示词节点写**能直接跑的完整内容**，不留「在这里写提示词」占位，也不留 `example.png` 这类假文件名。老板要做的是替换，不是填空。

**只要提示词是给 MiniMax H3 用的，一律按 `h3-prompt-writing` 技能写，不许自创结构**（那是 H3 官方规则）：

| 模式 | 结构 |
|---|---|
| T2VA / I2VA / FL2VA / L2VA | 首行是关键帧对齐指令（FL2VA/L2VA 必写，`S.SS` 两位小数）→ 空行 → `integrated_multimodal_description` / `overall_soundscape` / `non_diegetic_music` |
| Ref2VA（参考图生视频） | 六段，顺序固定：`subject_definitions` / `summary`（带 `[reference generation]` 这类方括号前缀）/ `retention_analysis`（`fully_preserved` 等标记）/ `detailed_description` / `overall_soundscape` / `non_diegetic_music` |

三条最容易写错的：① 正文用英文，只有台词、歌词、画面可见文字保留原文；② 时长必须等于实际帧数换算出来的秒数（8 秒就写 8.00）；③ 镜头用 `[Shot 1]`、后续镜头带 `At MM:SS.mmm`，运镜写成「类型 + 幅度 + 速度」的自然句，不要堆标签。

**强制门（硬规则，交付前逐条核，缺一条不许发）**：

1. **必须**先读 `h3-prompt-writing` 的 `references/ref-en.txt`（Ref2VA）或 `references/base-en.txt`（T2VA/I2VA/FL2VA/L2VA），照原文结构写；**不许凭记忆、不许只看本表**。
2. 任务类型前缀按参考资产真实角色写：改原片且保留原声 = `[video editing + audio reuse]`，不是 `[reference generation]`；改原片的 summary 必须以 `The target video is an edited version of <Video 1>.` 开头。
3. 镜头标注：首镜不写时间戳；后续写 `[Shot N] At MM:SS.mmm, ...`，**不许**写成 `At ... the edit cuts to [Shot N]`。
4. 音频关系只用音频标记 `fully_copy` / `partially_copy` / `reference` / `weak_reference`，**不许**写 `fully_preserved`。
5. 说话人按首次发声顺序标 `(S1)`、`(S2)`；`retention_analysis` 里不得出现 `(Sx)`。
6. 声场段要写明 `<Audio N>` 的复用关系；时长与帧数换算一致（141 帧 = 5.875s 就写 5.88），落在 4–15 秒内。

### 4.4 说明卡片（MarkdownNote）

一张图最多放一张，至少四件事：① 红色方块 = 你要改的；② 橙色方块 = 输出；③ 素材已预填、过期怎么重传；④ 想改清晰度 / 速度 / 时长时动哪个节点。

### 4.5 交付自检（发出去之前逐条过）

1. 每个 `LoadImage.image` 都不是空、不是 `example.png`；
2. 红节点 ≥ 1、橙节点 ≥ 1，且没有节点同时是两种色；
3. `links` 双向自洽：每个 input 的 link 能在 `links` 里找到，且回指同一对 slot；
4. 文件名用 ASCII，避免网页导入时中文名出问题；
5. 版面能读：按信号流从左到右，模型加载在左上，输出在最右；
6. 反广告（§4.0）：`title` 与 `filename_prefix` 里没有作者名 / 频道名 / 邀请码，`extra` 里没有 `cos_url` / `fullpath` / `objectKey` 等运行记录。

前五条脚本可判，后两条自己看图 / 搜全文。

## 5. 测：`run` 与验收

```bash
node scripts/rhx.mjs run --workflow my.json --out "<绝对目录>" \
  --set 6.text="扁平矢量插画，蓝色鲸鱼" \
  --image 1.image="D:/素材/in.png" \
  --name v1
```

- `--set <节点ID>.<字段>=<值>`：值能按 JSON 解析就按数字/布尔发，否则发字符串；
- `--image <节点ID>.<字段>=<本地路径>`：自动上传换 `fileName`（已是 `openapi/...` 则原样透传）；
- `--dry-run` 只打印提交体，不花钱；`--no-download` 只跑不落盘；`--timeout` 秒，默认 600。

退出码：`0` 成功 / `2` 参数错 / `3` 无 KEY / `4` 提交失败 / `5` 任务 FAILED / `6` 超时 / `7` 无产物。

**失败先读回显**，脚本会把 `failedReason` 的节点名、`exception_type`、`exception_message`、`traceback` 一起打出来：

| 报错 | 改哪里 |
|---|---|
| `missing_node_type` / `Node 'x' not found` | 节点在这台机器上没装，回 `learn` 找同族替代节点 |
| `manual_seed … got str` / `str // int` | 该控件要数字，`--set` 别加引号 |
| `803 JsonObject` | 提交体结构或值类型不对（多见于把对象当字符串发） |
| `prompt_outputs_failed_validation` + `Required input is missing: xxx` | 连线字段名写错（如 `ImageInvert` 写成 `images`），按该节点真实输入名改，改一处即可重跑 |
| `SUCCESS 但 results 为空` | 图里没有输出节点，补 `SaveImage` |
| `421` | 并发已满，等 10s 再发，同时只留一个任务 |

**FAILED 是确定性的**：同一份图重试必然同样崩，改图再发，别原地重试。

### 视觉验收（脚本判不出，必须自己看图）

出图后用 Read 打开产物逐条过四问：

1. 要改的那一处改对了吗？
2. 不该变的部件/数量，一个没少、也没多吗？
3. 轮廓还能描出想要的形吗（位置 ±2%、尺度 ±3%）？
4. 有没有新长出来的东西（描边、渐变、投影、多余零件）？

视频任务抽首/中/尾三帧看，别只看封面。

## 6. 踩坑记账（硬约束，不许等提醒）

**测试中踩到坑，必须主动写进 `references/pitfalls.md`，不等老板提醒。** 写完才算这次测试完成。

- **什么时候写**：修复并复跑成功之后、回复结论之前。不是"回头再补"。
- **只记非显然的坑**，满足任一条即记：① 报错看不出根因、要试错才知道改哪；② 同类节点字段名/类型不一致；③ 第一次失败、改了某处才过。
- **不记**：参数忘填、拼写手误、`--out` 目录不存在这类一看就懂的失误；已有条目也不重复记。
- **格式固定六项**：日期 / 一句话结论 / 症状原文 / 根因 / 修法 / 证据（失败 taskId → 通过 taskId）。
- **归类**：按 `class_type` 分节，同节点的追加在同一节下；字段命名类的顺带补进文末「命名对照」表。

回复里要报一句「已记入 pitfalls.md：<节点> <结论>」，让记账可被核对。

## 7. 与其它技能的分工

| 事 | 谁做 |
|---|---|
| 学工作流、写工作流、本地 JSON 直投测试 | **本技能** |
| 出成品图/改图、登记成品 alias、按提示词跑生产任务 | `runninghub-cloud-yashu` |
| 本地抠图、线稿、定框、叠图 | `comfyui-local-yashu` |

本技能**不写** `references/workflows.json`，也不接管生产 alias；测通的工作流要转生产，再按 `runninghub-cloud-yashu` 的接入流程登记。

## 8. 已验证工作流库（`verified/`）

老板看过成片并确认「可以用」的工作流，按目录包入库，**只进这里，不进 `dist/`**。索引在 `verified/README.md`，每包自带记录卡 `record.md`。

**封面规则（硬规则，2026-11-14 老板定）**：每个新入库包必须在包根放一张 `cover-3x4.jpg`，严格 **3:4**（推荐 1680×2240）；**画面里必须带「一句主标 + 一行副标」**——平台上标题在图下方，多数人只看图不看标题。文字用霞鹜文楷（`LXGWWenKaiGB-Medium/Regular.ttf`）本地叠字渲染，**不许让生图模型直出中文**（会糊、会错字）；文字压在上三分之一，不遮主体。画面风格每包自定义，但**不得出现可识别的影视角色、明星或任何真实面孔**。主标 / 副标文案同步写进 `record.md` 的「封面」小节。只对 2026-11-14 起新入库的包生效，历史包不补。

**入库触发**：老板说「入库 / 这个验证完了 / 这个可以」。不要自己判断「应该没问题」就入库。

**包名规则（硬规则，2026-11-13 老板定）**：目录名必须用**中文语义名**，格式「模型 + 适用场景 + 关键技法」，让人不看 `record.md` 也知道这包能干什么，例如 `H3-双人换人-极短镜头-一采`。禁止 `v1`、`test`、`new`、`final`、日期、拼音缩写、纯英文代号这类看不出用途的名字。包内文件仍用固定的 ASCII 名（`workflow.ui.json` / `build.mjs` / `check.mjs`），中文只出现在目录名；适用场景同时写进 `record.md` 第一段与 `verified/README.md` 的清单行。

**包结构（固定）**：

```
verified/<名称>/
├─ workflow.ui.json   可直接导入，优先给老板用这个
├─ build.mjs          生成器，相对路径，读同目录 templates/
├─ check.mjs          自检
├─ templates/         官方 UI 模板（保真控件顺序）
├─ assets/            素材原图（平台 fileName 过期后重传用）
└─ record.md          记录卡：用途 / 拓扑 / 默认参数 / 实测数据 / 已知限制 / 复现命令
```

**硬要求**：① `check.mjs` 通过；② 提示词已按 `h3-prompt-writing` 写死；③ `record.md` 写实测数字（分辨率、帧数、帧间差、音频电平），不写「效果不错」；④ 同步在 `verified/README.md` 清单加一行。缺一条不算入库。

**复用**：整目录复制 → 改 `build.mjs` 顶部四个常量 → 重新生成自检。禁止从零手写接线。

## 9. 版本管理（GitHub）

仓库：`git@github.com:steelan9199/runninghub-workflow-lab-yashu.git`（公开）。本目录即仓库根，`.gitignore` 已排除密钥、`dist/`、`out/`、`node_modules/`、图片与视频。

**什么时候推**（满足任一条就推，不用等老板提醒）：

1. **入库一个工作流**（`verified/` 下新增目录 + README 加行）。
2. **文档发生重大变化**：`SKILL.md` 的章节/流程/契约改了、`references/pitfalls.md` 新增一条坑、`verified/README.md` 标准变化。
3. 新增或修改 `scripts/` 下的可执行逻辑。

普通措辞修订、错字、单条记录的小补充，攒着跟下一次一起推。

**怎么推**：

```bash
git add -A && git commit -m "<动词>: <一句话说清为什么>" && git push
```

**红线**：`.env`、任何 `*.key` / `*.pem`、API Key、token 一律不入库；`git status` 里出现疑似凭据文件，先停下问老板，不要 commit。图片与视频同样不入库（见 `verified/README.md`）。

## 10. 文件

```
scripts/rhx.mjs         执行器：smoke / learn / index / run（Node 22 内置 fetch，无依赖）
references/pitfalls.md  踩坑账本：按节点归类，测试踩坑后必须追加（§6）
references/favorites.md 收藏工作流台账：ID + 页面核实的官方标题 + 结构核对 + 关键参数
corpus/                 语料库：wf_<id>.json + index.json（learn 写入，可入库可检索）
verified/               已验证工作流库（§8），索引见 verified/README.md
out/                    默认产物目录（可用 --out 覆盖）
```
