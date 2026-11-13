---
name: runninghub-workflow-lab-yashu
description: RunningHub 工作流的「学习—仿写—实测—交付」闭环工具。当用户要 AI 自己写/搭/改 RunningHub 工作流（ComfyUI UI 格式 .json）、想把站上现成工作流交给 AI 学习并复用接线、想用本地 JSON 直接提交测试而不用在网页新建保存、或工作流跑失败要查节点缺失/参数类型/没有输出节点时使用。核心契约（已实测）：POST /task/openapi/create 的 workflowId 必填（缺则 code 301 must not be null），但同时传 workflow=完整 API 格式 JSON 时会覆盖站内那张图，因此可固定用空壳 ID 2120926368186851330 当通道；本技能一律 nodeInfoList=[]，参数直接写进图。交付规范（§4）：可改参数标红 #c0392b/#5b1f1f、输出节点标橙 #d35400/#5a3208、LoadImage 的素材先经 RH 上传换 fileName 再回填。含零成本 smoke 自检、按 ID dump 语料库、失败节点回显与视觉验收判据。不替代 runninghub-cloud-yashu 的成品出图通道。只做工作流的学/写/测/交付：用站上成品模型或现成 AI 应用直接出图出片走 runninghub，生产 alias 与正式出图流水线走 runninghub-cloud-yashu。
agent_created: true
version: 0.2.2
---

# RunningHub 工作流实验室

让 AI 能自己写 RunningHub 工作流、自己验证能不能跑。**只做「学 → 写 → 测」**；正式出图/改图业务走 `runninghub-cloud-yashu`，本地抠图/线稿/叠图走 `comfyui-local-yashu`。

## 0. 三条契约（2026-11-13 实测，别重新试错）

| # | 事实 | 证据 |
|---|---|---|
| 1 | `/task/openapi/create` 的 `workflowId` **必填**，不能只发图 | 只给 `workflow` → `{"code":301,"msg":"must not be null"}` |
| 2 | 给 `workflow`（完整 API 格式 JSON 字符串）时，**跑的是这份图**，不是站内那张 | 把节点 1 改成不存在的类 → FAILED：`Node 'bad' not found` |
| 3 | 所以可拿一个空壳 ID 当固定通道 | 默认壳 `2120926368186851330`（两个 `easy showAnything`，零成本，不会误跑生产） |

壳可用 `--shell <workflowId>` 或环境变量 `RH_SHELL` 覆盖；壳必须属于本账号。

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

## 4. 交付：红 / 橙 / 素材预填（写完工作流必做，别等老板催）

**适用面**：本技能交付给老板在 RunningHub 网页导入运行的 **UI 格式** `.json`。API 格式的测试图不套用本节。

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
| 2 生成 | 必需素材 **≤ 2 张直接生成，不再请示**；> 2 张或非必需才先问一句。通道走 `runninghub-cloud-yashu`：`rh-h3-t2i` 出图，多帧要同一角色用 `rh-h3-edit` |
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
5. 版面能读：按信号流从左到右，模型加载在左上，输出在最右。

前三条脚本可判，后两条自己看图。

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

**包名规则（硬规则，2026-11-13 老板定）**：目录名必须用**中文语义名**，格式「模型 + 适用场景 + 关键技法」，让人不看 `record.md` 也知道这包能干什么，例如 `H3-双人换人-近景对话-二采`。禁止 `v1`、`test`、`new`、`final`、日期、拼音缩写、纯英文代号这类看不出用途的名字。包内文件仍用固定的 ASCII 名（`workflow.ui.json` / `build.mjs` / `check.mjs`），中文只出现在目录名；适用场景同时写进 `record.md` 第一段与 `verified/README.md` 的清单行。

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
