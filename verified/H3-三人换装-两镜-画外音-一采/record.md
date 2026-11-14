# H3 三人换装 · 两镜（三人同框 → 两人对座）· 画外音 · 一采（已入库）

**状态**：已入库（2026-11-15 老板平台跑通、确认可用）
**适用场景**：**一条 4–5 秒、内部含一次硬切的短片段，且台词是画外音**——前镜三人同框（一个虚焦半头、一个背对镜头、一个正面大脸），后镜两人并排坐着对镜头说话。三个人各用一张参考图整身换掉，保留原机位、裁切、表演、音轨与两镜结构；864×736 一采直出，不做放大。

## 1. 它做什么

把一段 4.458 秒、共 107 帧的董事会戏换成 3 个明制袍服人物：

- **第 1 镜（0.000–1.083s）**：三人同框。左边缘**虚焦光头男**只露半个头，换成 `胡宗宪` 的黑金乌纱帽；中左**背对镜头的戴眼镜灰发男**，换成 `吕芳` 的红帽长垂带；右侧**站立男**大脸对着镜头，换成 `人物2` 的金冠黑长发 + 冰蓝袍。这一镜的台词 `Please, Norman.` 是**画外音**，画面里三个人都不说。
- **第 2 镜（1.083–4.458s）**：硬切两人对座中景，固定机位。左侧光头男换 `胡宗宪`，说 `The board is unanimous.`；右侧近景灰发男换 `吕芳`（去眼镜、无胡须），全程闭嘴。
- **尾部 3.917–4.458s（13 帧）**：源片是静帧 hold，成片基本停住（实测仍有 0.2–1.4 的帧间差残余动作）。

与前作 `H3-五人换人-两镜硬切-一采` 的区别：
1. **这是库里第一个「台词是画外音」的包**，也是第一个需要压住「最显眼那张脸不许动嘴」的包（经验见 `references/画外音与闭嘴控制.md`）。
2. 参考图从 5 张缩到 **3 张**，三个人物跨两镜复用（同一张图管两个镜头里的同一人）。
3. 源片先做过**剪裁**：原 107 帧的前 13 帧（第一个镜头）被剪掉，再把末帧克隆 13 帧补回 17k+5 网格。

## 2. 拓扑

```
UNET(ref2va int8) → turbo 4步 LoRA → SageAttention → 显存补丁
  ├→ BasicScheduler(beta,4) → H3SigmaRefiner(+2, 0.7, cosine) → SplitSigmas(4)
  │     → 一采 4 步 @864×736（全部步数给一采）
  └→ BasicGuider ← MiniMaxH3ReferenceToVideo
        ref_images 0..2 = 胡宗宪 / 吕芳 / 人物2
        ref_videos 0 / ref_video_audios 0 = 剪裁后原片画面与声音
一采 → VAEDecode → VHS_VideoCombine(24fps, audio ← 原片音轨)
```

28 节点 / 31 连线，红块 5 / 橙块 1。

关键点：

1. **没有放大支路**：无 `MinimaxH3LatentUpscaler3D`、无第二 Sampler、无二采。
2. 输出走 `VHS_VideoCombine` 的 `audio ← VHS_LoadVideo`，成片音轨是原声（尾部 13 帧静音）。
3. 模板只声明 `ref_image_0..3`，本包只用 3 个槽，第 4 槽空着不接。
4. 硬切不靠接线，只靠提示词里的 `[Shot 2] At 00:01.083`；本包实测**切点没漂**（帧间差峰值 45.87 正落在第 27 帧）。

## 3. 默认参数

| 项 | 值 |
|---|---|
| 生成/出片分辨率 | **864×736**（源片同尺寸，四边自带黑边） |
| 帧数 | **107**（17×6+5，24fps → 4.458s）= 94 帧有效内容 + 尾部 13 帧静帧 |
| 采样 | beta / 4 步，尾部加密 +2 步（0.7, cosine），切分 4：全部给一采 |
| 种子 | fixed `20261114`（换一版改 `build.mjs` 顶部 `SEED`） |
| 参考图 | 3 张，顺序 = `Picture 1..3`（顺序即人物，改一张就换一个人） |
| 输出 | h264 mp4 / 24fps / crf19 / yuv420p，音轨 AAC 44.1k 原声 |

### 人物映射（画面位置 → 参考图）

| 镜头 / 位置 | 原片人物 | 参考图 | 要点 |
|---|---|---|---|
| 第 1 镜 左边缘 | 虚焦光头男（只露半头） | `Picture 1` 胡宗宪 | 只露帽右半 + 耳 + 肩；虚焦 |
| 第 1 镜 中左 | 背对镜头的眼镜灰发男 | `Picture 2` 吕芳 | 只露红帽背、垂带、后颈；无眼镜 |
| 第 1 镜 右侧 | 站立男（大脸） | `Picture 3` 人物2 | 金冠 + 黑长发 + 冰蓝袍；不说话，嘴微张不动 |
| 第 2 镜 左中 | 光头男（说话） | `Picture 1` 胡宗宪 | 黑衣金纹补子 + 黑金帽 + 短须；嘴型跟台词 |
| 第 2 镜 右侧近景 | 灰发眼镜男（不说话） | `Picture 2` 吕芳 | 红帽 + 圆团纹 + 无眼镜 + 无胡须 |

### 台词（`rh-voice3-yashu` 的 `stt` 实测）

| 镜 | 台词 | 归属 |
|---|---|---|
| 第 1 镜 | `Please, Norman.` | **画外音**，不属于画面里任何一个人 |
| 第 2 镜 | `The board is unanimous.` | 左侧胡宗宪，逐字口型 |

## 4. 实测记录

成片：`D:\download\chrome\norman05_onepass_3p_00001_p81-audio_umxud_1794672472.mp4`

| 项 | 实测值 |
|---|---|
| 分辨率 / 帧数 / 时长 | 864×736 / 107 帧 / 4.458s / 24fps |
| 文件 / 码率 | 854,889 B（835 KB）；视频 1.237 Mbps，音频 111 kbps，容器 1.534 Mbps |
| 帧间差（432×368 灰度） | 平均 **2.162**，最大 **45.874**（第 27 帧，即切点），最小 0.188 |
| 音频 | mean **−27.8 dB** / max **−7.5 dB**（源片 −26.1 / −7.8，原声 1:1） |
| 结构自检 | 28 节点 / 31 连线 / 红 5 橙 1，`✓ 自检通过` |
| 抽帧核对 | 第 1 / 20 / 40 / 60 / 80 / 107 帧：三人全部换装、无西装残留；站立男嘴形定格、只点头；第 2 镜胡宗宪说话、吕芳闭嘴；机位无晃 |

- 切点实测落在 **第 27 帧（1.083s）**，与提示词写的 `00:01.083` 一致，**本包没出现前作那种漂移**。
- 成片左上角有平台水印 `RunningHub AI生成`。

## 5. 提示词合规（h3-prompt-writing / ref-en.txt）

- 六段顺序：`subject_definitions` → `summary` → `retention_analysis` → `detailed_description` → `overall_soundscape` → `non_diegetic_music` ✓
- 任务类型 `[video editing + audio reuse]`，summary 以 “The target video is an edited version of `<Video 1>`.” 开头 ✓
- 两镜：`[Shot 1]` 无时间戳，`[Shot 2] At 00:01.083` 标切点 ✓
- 画外音按 §5.4 写成「稳定音色描述 + (S1)」（`A voiceover from outside the room (S1), a quiet adult male voice heard as narration`），**不绑定任何 `<Subject N>`**；`retention_analysis` 里不出现 `(Sx)` ✓
- 第 2 镜写 `<Subject 1> (S2)` + `<d>[English] The board is unanimous.</d>`，并写明「说完闭唇」；吕芳写「全程不说话、嘴闭着」 ✓
- 逐人写死袍色 + 帽形 + 胡须 + 可见范围，并把原片西装整体标 `not_retained`；补「布料哑光、不发光、无霓虹边」 ✓
- **关键技法**：`<d>` 台词不贴着可见大脸写，先写「嘴形是静止形状」再引入画外声，并把否定句压到一句（详见 `references/画外音与闭嘴控制.md`）。

## 6. 已知限制

1. **画外音时仍有残余风险**：第 1 镜站立男的嘴是「定格微张」，不是完全闭合（老板要求保留原片微张的唇形）。换别的片时如果模型又把嘴带起来，按 `references/画外音与闭嘴控制.md` 的兜底拆镜。
2. **尾部 13 帧不是完全静止**：实测帧间差 0.19–1.41，模型仍有极轻微呼吸/漂移；要求严丝合缝静止的场合，后期直接覆盖末帧。
3. 源片是**剪过的**：前 13 帧被剪掉、末帧克隆 13 帧补网格。要复现必须先按 §3 重建这条 107 帧素材（见 §7）。
4. 第 1 镜左边缘的胡宗宪是**虚焦**，只能验帽形与肩线，验不了脸。
5. 吕芳在原片位置是戴眼镜的人，本包按参考图**去掉了眼镜**；要求保留眼镜的场合要在提示词里加回一句。
6. 参考图 `fileName` 约 24 小时过期；报「找不到图」就重传换 `ASSETS`，接线不动。
7. 本包**没有二采支路**，要放大交付请先按 `H3 二采 · Ref2VA` 改接线。

## 7. 复现

```bash
# 1) 先把源片剪成 107 帧素材（剪掉前 13 帧，末帧克隆补到 17k+5）
ffmpeg -y -i 05_up864x736_107f.mp4 -filter_complex \
  "[0:v]select='gte(n,13)',setpts=N/24/TB,tpad=stop_mode=clone:stop_duration=0.541667[v];\
   [0:a]atrim=start=0.541667,asetpts=N/SR/TB,apad=whole_dur=4.458333[a]" \
  -map "[v]" -map "[a]" -r 24 -c:v libx264 -crf 14 -pix_fmt yuv420p -c:a aac -b:a 192k \
  -t 4.458333 -movflags +faststart 05_up864x736_107f_trimhold.mp4

node build.mjs                 # 读 prompt.txt + templates/base_onepass.ui.json → workflow.ui.json
node check.mjs                 # 结构自检 + 导出 workflow.api.json
node <runninghub-cloud-yashu>/scripts/rh.mjs --upload "<本地图>"   # 换新 fileName 后改 build.mjs 的 ASSETS
```

改参数只动 `build.mjs` 顶部：`FRAMES` / `WIDTH` / `HEIGHT` / `SEED` / `OUT_PREFIX` / `ASSETS`；提示词只改 `prompt.txt`，**不要手改 workflow.ui.json**（下次 build 会覆盖）。

## 8. 目录

```
workflow.ui.json   可直接导入 RunningHub（交付件）
build.mjs          生成器
check.mjs          自检 + API 导出
prompt.txt         提示词唯一真相源
templates/         底座 UI 模板（一采链路，保真控件顺序）
record.md          本文件
```

`assets/`（107 帧素材 + 3 张参考图）按库规不入库，本地在 `诺曼被踢出董事会/05/assets/`。

## 9. 封面

`cover-3x4.jpg`，1680×2240（严格 3:4），深蓝底 + 白字，霞鹜文楷（`LXGWWenKaiGB-Medium/Regular`）本地叠字，无人脸、无影视角色。

- 主标：**三人换装，一句画外音**
- 副标：三人同框 → 两人对座 · 864×736 · 一采直出
- 版式：上半三分之一放主副标；中部左卡「第 1 镜 三人同框」→ 箭头 → 右卡「第 2 镜 两人对座」，左卡下列三个可见人物；页脚写「3 张参考图 · 107 帧 · 4.458s · 原声复用」。
