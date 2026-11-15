# 踩坑账本

**本文件的唯一用途：把「非显然的坑」沉淀成下次能直接照抄的结论。**
SKILL.md 只留指针，细节全在这里；按 `class_type` 归类，同一节点的问题追加在同节下。

## 记账规则（硬约束，见 SKILL.md §5）

写什么 —— 只有满足任一条才记：

1. 报错信息看不出根因，需要试错才知道改哪里；
2. 同类节点的字段名/类型不一致（如 `image` vs `images`）；
3. 第一次提交失败、改了某处才过（说明直觉判断不可靠）。

不写什么 —— 不记：参数忘填、拼写手误、`--out` 目录不存在这类一看就懂的失误；不重复记已有条目。

什么时候写 —— **修复并复跑成功后、回复结论之前**。没写进本文件，不算这次测试完成。

条目格式（六项，缺一不可）：

```
- **YYYY-MM-DD** 一句话结论
  - 症状：服务端原文（code / exception_message / 缺哪个字段）
  - 根因：为什么会这样
  - 修法：具体改哪一处，改成什么
  - 证据：失败 taskId → 通过 taskId
```

---

## ImageInvert

- **2026-11-13** 输入字段是 `image`（单数），不是 `images`。
  - 症状：`prompt_outputs_failed_validation` / `Required input is missing: image`，崩在节点 2。
  - 根因：ComfyUI 同类节点命名不统一——`ImageInvert` / `ImageScale` 用 `image`，`SaveImage` 用 `images`。
  - 修法：`"inputs": { "image": ["1", 0] }`。
  - 证据：失败 taskId `2120955973115011074` → 通过 taskId `2120956018933587970`（256×256 黑底反色成白）。

## 提示词（非节点类）

- **2026-11-14** H3 不给说话人 ID / 台词不进 `<d>`，人物嘴就不动。
  - 症状：成片里人物嘴一直半张、形状不变，像卡住；对面镜头口型正常。
  - 根因：提示词只写了 `mouth open`（静态姿势），没写谁说、说什么、怎么动；H3 不会自己从音轨反推表演。
  - 修法：发声源挂 `(S1)/(S2)` + 台词进 `<d>[English] ...</d>` + 逐字唇形动作（`articulates` / `jaw drops` / `lips part and close`）+ 持续区间 `from the first frame to the last`。细则与错法/对法对照见 `verified/H3-双人换人-极短镜头-一采/record.md` §9.1。
  - 证据：同一条片 `norman01_onepass_00002`（无 ID、无 `<d>`）诺曼嘴不动 → 补写后 `00001` 嘴部逐字开合。

- **2026-11-14** 服饰细节词叠太多，H3 会渲染成发光特效。
  - 症状：帽子上出现绿色荧光竖条、肩胸出现橙色火焰，整条镜头持续存在；同一张参考图的上一版成片是干净的。
  - 根因：一句话里叠了 `gold ×5` + `ribs` + `ornaments` + `dragon` + `embroidery`，触发仙侠特效先验；与参考图、种子无关。
  - 修法：服装不做逐件枚举，只写「整身外观取自 `<Picture N>`」，最多补一句 `matte textile under the room light`。细则见 `verified/H3-双人换人-极短镜头-一采/record.md` §9.2。
  - 证据：旧词版 `norman01_onepass_00002` Shot 2 全哑光 → 新词版 `00001` 同帧发光。

- **2026-11-14** 极小局部改色（袖口、纽扣、领带）H3 基本不响应，别指望一句「cuff becomes red」。
  - 症状：两轮提示词都写死「白袖口改成红袖口」，成片左下角那只手仍是西服袖 + 白袖口，前后帧一致不漂；其余八人换装全部正常。
  - 根因：H3 视频编辑模式优先保留源片像素，色块面积小于约 30×40 px 时几乎不动；且提示词里同时写「保留这条西服袖」会进一步把它锁死。
  - 修法：要么把**整件服装**当参考图进去重画（`ref_images` 有空位就补一张服装模板图，提示词改「这条前臂穿 <Picture N> 的大袖」），要么接受后期逐帧上色。只改颜色不改形制 = 必然失败。
  - 证据：03 `norman03_onepass_9p` v1、v2 两版白袖口原样保留；后期 masks 上色才变红。

- **2026-11-14** 一条片里写死切点时间，H3 不遵守；短于 0.5s 的镜头会被自行拉长。
  - 症状：提示词写 `[Shot 2] At 00:03.417`（对应源片第 82 / 90 帧），成片实际在第 46 帧（≈1.875s）就切了，第二镜从 8 帧（0.33s）被拉到约 1.8s；老板验收仍通过，但时间轴对不上原片。
  - 根因：H3 对多镜头拼接的**切点时间只有语义级弱约束**，时间戳不是帧级控制；镜头过短时模型直接把它吸收成正常时长。
  - 修法：要卡死切点只能拆成两条独立任务分别生成再后期拼（或用 17k+5 网格重新分段）；接受切点漂移就别让下游依赖原片时间轴，并在 `record.md` 已知限制里写明实测切点。
  - 证据：`norman04_onepass_5p_00001` 帧间差最大 45.58 落在第 46 帧；源片切点在第 82 帧（`04_up864x736_90f.mp4`）。

- **2026-11-15** 微小表情「单调放大」H3 基本不响应；反面禁令会把动作直接掐死。
  - 症状：第 2 镜要求「眼睛慢慢睁大」，连写两版（第二版已写 `medium, clearly more open than the source`）成片眼皮全程不动，和原片一样平。
  - 根因：① 编辑模式优先保留源片像素，源片本来就是睁着的，从一个静止状态单调再睁没有「变化量」可参照；② 提示词里同时写了 `never a popped or staring eye` / `the lids never flicker, twitch, close or reopen` / `nothing is amplified`，净指令变成「别动眼」。
  - 修法：改成「先收缩再放开」——先在 0.6s 内把眼皮垂到原片开口一半，再 1.2s 睁到明显大于原片（上下露眼白）；**删掉针对该动作的反面禁令**，只保留「不眨眼 / 不复读」。
  - 证据：`norman06` v1 / v2（单调睁大）眼皮零变化；v3（先垂 0.6s）实测被做成 n≈41/49/53/57/61/65/69 反复半闭，读起来是**眨眼**，且眼神向下、观感「困 / 沮丧」。
  - 追加（同日，v4）：情绪类表情不要写「先收缩再放开」——收缩段会被模型演成半闭+抖动；要写**一次单向到位（0.9s 内）再保持到静帧**，并把「抬眉 / 抬眼神 / 下颌微降 / 头微退」一起给，单靠眼皮一个通道推不动情绪。

## UI 工作流手写节点（非 API 类）

- **2026-11-15** 手写 UI 节点时，`inputs` 与 `widgets_values` 的顺序必须照节点**真实定义**，不能按 API 格式的字段顺序推。
  - 症状：姿势提取工作流在平台一跑就报错，参数全串位（`resolution` 拿到了模型名 `dw-ll_ucoco_384.onnx`，`bbox_detector` 拿到了 `disable`）。
  - 根因：UI 格式里 `widgets_values` 是**按位置**映射到前端节点的 widget 定义顺序；API 格式的 `inputs` 是字典，键顺序不可靠。DWPreprocessor 的真实顺序是 `image → detect_hand → detect_body → detect_face → resolution → bbox_detector → pose_estimator → scale_stick_for_xinsr_cn`，而 API 里回显的是 body 在前。
  - 修法：以平台**重新序列化后**的 UI JSON 为准改顺序；自检方式 = 逐项比对两个文件的 `inputs` 名称顺序与 `widgets_values` 值串。
  - 证据：本地 `pose_extract_skeleton.ui.json`（错序）→ 平台导出 `ForAITesting (2).json`（已跑通 `skeleton_joker02_00001_p81.mp4`，864×736 / 328 帧 / 24fps）→ 按它重建后「顺序一致: True / 值一致: True」。

## 平台接口（非节点类）

- **2026-11-13** 查标题/使用量走站点公开接口，别用 OpenAPI，也别去开浏览器。
  - 症状：`getJsonApiFormat` 只回 `data.prompt`（纯图，无标题）；`/api/openapi/getWorkflowInfo`、`/api/openapi/workflow/list` 等一律 `{"code":403,"msg":"TOKEN_MISSION"}`（要登录 token，不认 apiKey）。
  - 根因：标题与热度属于站点业务接口，不在 OpenAPI 里；但它们**不登录也能读**，只是路径不在 `/api/openapi` 下。
  - 修法：`POST /api/portal/workflow/detail` body `{workflowId}` → `name` / `desc` / `nodeCount` / `owner` / `statisticsInfo{useCount,likeCount,collectCount}`；`POST /api/search/workflow` body `{search:"三采",current:1,size:50}` 做关键词搜索。
  - 证据：库里 H3 多采工作流按 useCount 从 6528 排到个位数，均由此接口取得；对照浏览器读到的标题一致。

- **2026-11-13** `/api/search/workflow` 的坑：关键词字段叫 `search`，分页叫 `current`/`size`。
  - 症状：传 `keyword` / `searchKey` / `name` / `query` 时 `total` 恒为 91799（全库），像「搜不到」；传 `pageNum`/`pageSize` 翻页不动。
  - 根因：参数名不对就被静默忽略，不报错。
  - 修法：`{ "search": "三采", "current": 2, "size": 50 }`；判断是否真过滤，看 `data.total` 有没有变化。
  - 证据：`search:"三采"` → total 125；`keyword:"三采"` → total 91799。

- **2026-11-13** 工作流页会跳到账号内副本 ID，标题不变。
  - 症状：开 `https://www.runninghub.cn/workflow/2114707872927014914`，地址栏变成 `2120973036517158914`。
  - 根因：站点给分享工作流建了本账号副本用于在线运行。
  - 修法：只核标题时无视 ID 变化；提交任务仍用原始 ID（`getJsonApiFormat` 对原 ID 正常取图）。
  - 证据：三条工作流均复现，标题与 `/api/portal/workflow/detail` 返回的 `name` 一致。

- **2026-11-13** `MiniMaxH3ImageToVideo` 的条件**绑死在创建时的分辨率**上，跨分辨率采样必崩。
  - 症状：`SamplerCustomAdvanced` 报 `shape mismatch: value tensor of shape [810, 96] cannot be broadcast to indexing result of shape [1760, 96]`，栈顶在 `comfy/ldm/minimax/model.py:606 _embed_and_pack` 的 `all_video_rows[~img_update] = cond_video_rows`。
  - 根因：`first_frame` / `last_frame` 的图像行在 ImageToVideo 执行时按 `width/height` 烘死；把这份 conditioning 接到放大 1.5× 后的潜空间上采样，行数对不上。用 `MiniMaxH3ReferenceToVideo` 的二采不受影响（它不往潜空间里塞逐帧行），所以「二采能跑、三采崩」。
  - 修法：每一段采样都用自己的潜空间**重挂一遍** `MiniMaxH3AddGuide`（首帧 `frame_idx=0`、末帧 `-1`），`latent` 接该段的 latent、`image` 缩到该段分辨率；`positive` 从**不带帧**的 `MiniMaxH3ImageToVideo` 起链。一采可直接用带帧的 ImageToVideo。
  - 证据：三采 v1 网页运行报错于节点 #29（第二段采样）；v2 改为分段重挂后结构自检通过（46 节点 / 78 连线）。

- **2026-11-13** `MiniMaxH3AddGuide` 在源工作流里常常是**死接线**。
  - 症状：照抄 `2114707872927014914` 的 AddGuide 支路，以为首尾帧是它锚的。
  - 根因：该支路接到 `MiniMaxH3AddGuide → BasicGuider → SamplerCustomAdvanced`，而那个采样器的噪声是 `DisableNoise`（0 步），整条链永远不执行；首尾帧实际由 `MiniMaxH3ImageToVideo` 的 `first_frame`/`last_frame` 完成。
  - 修法：抄源工作流时先查每个采样器的 `noise` 是不是 `DisableNoise`，是就把上游整条支路当装饰，不要当作证据。
  - 证据：`wf_2114707872927014914.json` L214/L221/L324/L429/L433，采样器 106 的 noise 为 `DisableNoise`。

- **2026-11-13** `ComfyMathExpression` 的 `values.a` / `values.b` 是**必填**，纯常量表达式过不了校验。
  - 症状：`prompt_outputs_failed_validation` / `Required input is missing` / 回溯 `["a"]`，崩在 `ComfyMathExpression`。
  - 根因：节点校验要求 a 槽有值，与 expression 有没有引用 a 无关；`"832"` 这种纯常量也会被判缺参。
  - 修法：常数别写死在表达式里 —— 前面挂 `PrimitiveFloat`（值＝目标数）接到 `values.a`，expression 写 `"a"`，取第 2 个输出槽（INT）。`PrimitiveInt` 在本机图里没出现过，别赌它已装。
  - 证据：失败 taskId=2121261448310247425 → 通过 taskId=2121261669257793538。

## 遮罩 / 潜空间（SetLatentNoiseMask · LTXVConcatAVLatent · VAEEncodeAudio）

- **2026-11-15** H3 的 `LATENT` 输出是 **AV 合成潜空间**，`SetLatentNoiseMask` 不能直接盖；要自建：`VAEEncode(源片帧)` → `SetLatentNoiseMask` → `LTXVConcatAVLatent(video_latent, audio_latent)` → 采样器 `latent_image`。
  - 症状：把这套当「可选优化」会一直以为 H3 只能吃自己的潜空间；实际 `corpus/wf_2090037412381683713.json` 就是自建 AV 潜空间的写法，H3 节点的潜空间那一槽根本没接。
  - 根因：AV 潜空间是视频/音频两段沿通道拼接，`SetLatentNoiseMask` 只认单段视频潜空间；音频段要用 32×32 全 0 `SolidMask` 冻结（`VAEEncodeAudio` → `SetLatentNoiseMask`）。
  - 修法：视频段 mask = 目标区域（864×736 整幅），音频段 mask = `SolidMask(value=0, 32, 32)`；`SamplerCustomAdvanced` 与 `KSampler` 都能吃带 `noise_mask` 的 AV 潜空间，不必降级成 `KSampler`。

- **2026-11-15** `SetLatentNoiseMask` 的**单帧 mask 会广播到全部帧**，且 mask 经过 `LTXVConcatAVLatent` **不会丢**。
  - 验证：39 帧 @864×736，矩形遮罩（240×196）+ `denoise 1`，遮罩外区域与源片 PSNR **32.9 dB**（只剩 VAE 往返损耗），矩形内 16.2 dB；同图去掉遮罩只换潜空间起点跑 `denoise 0.6`，遮罩外只有 20.9 dB。→ 前者整片被保护，后者整片被重绘。
  - 用法：`denoise 1` 时遮罩内是**从噪声重画**（动作无结构，靠提示词）；`denoise 0.6` 时遮罩内保留源片结构（动作、人物大小跟着原片走）。要「构图锁死 + 动作保真」用「遮罩 + 0.6」。
  - 已知副作用：静态矩形给多大，模型就把人画多大（框 240×196 时，源片 5% 的小人会被画成 12%）。人物尺寸不受 `denoise` 控制，只受遮罩轮廓控制 —— 要精确控尺寸必须逐帧剪影。
  - 证据：taskId=2121936755493130242（遮罩 + dn1）／2121937005268127746（无遮罩 + dn0.6）／2121937754895114241（遮罩 + dn0.6）。

## 命名对照（遇到新节点先查这里，再决定要不要试）

| 节点 | 输入字段 | 备注 |
|---|---|---|
| `ImageInvert` | `image` | 单数 |
| `ImageScale` | `image` | 单数 |
| `SaveImage` | `images` | 复数，且是 `[来源节点, 0]` |
| `LoadImage` | `image` | 只吃 `fileName`（`openapi/xxx.png`），不吃 URL |
