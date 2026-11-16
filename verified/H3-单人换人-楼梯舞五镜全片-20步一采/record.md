# H3 单人换人 · 楼梯舞五镜全片 · 20 步一采 · 无声

> **标记：老板 2026-11-17 跑通并确认可用，入库。本包的重点是「五镜硬切、机位差极大的一条素材，怎么把每一镜的机位和人物大小都钉住」。**

**一句话用途**：一条 **10.083 秒、243 帧、含五次硬切**（平台近景 → 长阶广角 → 高机位俯视 → 低机位近景 → 高机位俯视收尾）的实拍楼梯舞，要把原片里的人整身换成参考图人物，动作 / 机位 / 景别 / 楼梯与墙面全部照旧——用「原片当运动与构图参考 + 人物三视图当身份参考 + LoRA bypass + 20 步」一采直出。

## 适用场景

- 单条素材内含**多镜硬切**，且机位在近景、广角、俯视之间来回跳。
- 人物在画面里的大小从「半身」到「小全身」到「俯视局部肢体」连续变化。
- 只换人、不换场地：长阶、涂鸦墙、铁栏杆、灯柱、台阶上的杂物要保下来。
- 出片尺寸 = 生成尺寸，不需要放大与二采。

## 拓扑（26 节点 / 28 连线，红 5 橙 1）

```
UNETLoader → LoraLoaderModelOnly（4 步 turbo · strength 1.0 · **bypass mode=4**）
           → PathchSageAttentionKJ → MiniMaxH3MemoryEfficientSageAttentionPatch ─┬→ BasicScheduler（beta / 20 步 / denoise 1）
                                                                                 └→ BasicGuider
VHS_LoadVideo(源片 243 帧) ─┬→ ref_videos.ref_video_0 ──→ MiniMax H3
                            ├→ ref_video_audios.ref_video_audio_0
                            └（音轨不接输出）
LoadImage(人物三视图) ──────→ ref_images.ref_image_0 ──→ MiniMax H3
CLIPLoader → clip / VAELoader(视频) → vae / VAELoader(音频) → audio_vae ──→ MiniMax H3
MiniMax H3 ─┬→ positive → BasicGuider
            └→ LATENT   → SamplerCustomAdvanced.latent_image

BasicScheduler → H3SigmaRefiner（extra_steps 0，关）→ SplitSigmas（999，不切）→ SamplerCustomAdvanced.sigmas
RandomNoise(20261115 fixed) → noise ／ KSamplerSelect(euler) → sampler
SamplerCustomAdvanced.denoised_output → VAEDecode → VRAM_Debug（透传）→ VHS_VideoCombine
```

- 结构要点：H3 的 LATENT 直接接采样器，**不是遮罩重绘**；身份靠 `ref_image_0` + 提示词，动作与构图靠 `ref_video_0`。
- 红 5：源片、人物三视图、提示词、出片宽、出片高。橙 1：`VHS_VideoCombine`。

## 默认参数

| 项 | 值 |
|---|---|
| 源片 | `小丑04_243f.mp4`，864×736 / 243 帧 / 24fps / 10.083s / 带 aac 原声 |
| 载入 | `frame_load_cap=243`、`skip_first_frames=0`、`select_every_nth=1`、`force_rate=24` |
| 生成尺寸 | 864×736（32 的倍数；一采直出，无放大、无二采） |
| 时长 | 243 帧 / 24fps = 10.125s（17k+5 网格：243 = 17×14+5） |
| LoRA | `minimax_h3_turbo_4step_ckpt500.safetensors`，strength 1.0，**bypass（mode=4）** |
| UNET | `minimax_h3_ref2va_int8_convrot.safetensors` |
| CLIP / VAE | `qwen3vl_32b_minimax_h3_int8_convrot` / 视频 `minimax_h3_video_vae_fp16` / 音频 `minimax_h3_audio_vae_fp32` |
| 采样 | euler + beta **20 步** + **denoise 1**；`H3SigmaRefiner` extra=0（关）；`SplitSigmas` 999（不切） |
| 参考图 | 人物三视图 → `ref_image_0`，`ref_image_size=match` |
| 噪声 | fixed `20261115` |
| 输出 | 24fps、`video/h264-mp4`、`yuv420p`、crf 19、`joker04_all_243f_20step`、**无音轨** |

## 实测数据

| 项 | 值 |
|---|---|
| 成片 | `joker04_all_243f_20step_00001_p85_bkqas_1794849854.mp4` |
| 规格 | 864×736 / 243 帧 / 24fps / 10.125s / 2144 kbps / 2.80 MB / 无音轨（只有一条视频流） |
| 帧间差（tblend difference + signalstats YAVG，242 个差值） | 均值 **10.946**，峰值 **59.795**（落在硬切），最低 0.097 |
| 身份核对（抽 0.5 / 3 / 5 / 7 / 9.8s） | 金冠 + 横簪、黑发髻 + 长直黑发、粗平眉、短须 + 长尖黑山羊胡、素颜、浅蓝棉袍 + 白交领 + 深蓝绣花门襟袖口、白裤黑鞋全部到位；五镜同一人 |
| 动作核对 | 平台扭身 → 长阶踢腿举臂 → 俯视仰面下滑再跪爬 → 低机位双臂高举大笑 → 俯视滑出画面，逐镜与源片同节奏 |
| 发光核对 | 无浅蓝自发光（长袍、台阶、栏杆都没有裹青焰） |
| 收尾核对 | 末段仍是俯视近景、身体滑向画面左下，没有收成站姿；成片末帧比源片多留了一点身体，属可接受差异 |
| 结构自检 | 26 节点 / 28 连线 / 红 5 橙 1，`check.mjs` 通过 |

## 提示词（本包的重点）

`prompt.txt` 是图内 positive 原文（H3 Ref2VA 六段式英文）。与同族单镜包最大的不同，是**一条素材里有五镜硬切**，提示词必须逐镜写机位：

1. **先抽帧再动笔。** 源片是五镜硬切：0–2.42s 平台近景（扶手斜穿右半幅）、2.42–4.46s 台阶底部广角仰视、4.46–6.33s 高机位俯视（仰面下滑 → 跪爬）、6.33–8.50s 低机位近景（双臂高举大笑）、8.50–10.08s 高机位俯视（滑出画面）。只看文字描述会把五镜写成两镜，H3 会自己推镜头。
2. **每一镜都写「同机位、同大小」。** 每镜开头先锚定机位与人物占比，再写动作；`summary` 与 `detailed_description` 首句都写明「摄影机不推、不拉、不自己升降」。
3. **收尾按真实动作写，不写「站定」。** 末镜是俯视近景，身体滑出画面左下，最后只剩一只袖与一只手；写「站定」会把整段收成站姿。
4. **身份锚点逐镜重复。** 金冠横簪 / 黑发髻 + 长直黑发 / 粗平黑眉 / 短黑须 / 长尖黑山羊胡 / 素颜 / 浅蓝棉袍 / 白交领 / 深蓝绣花门襟袖口 / 白裤黑鞋；服饰只写整身取自 `<Picture 1>` + 一句哑光材质。
5. **材质句固定三词**：`plain woven cotton` / `flat matte` / `dull surface, natural creases`。
6. **去光词表**：全程不出现 `ice`、`cool teal`、`rim`、`flare`、`bright`、`catching the light`、`silver`，也不写「no dissolve / no flash」这类含触发词的否定句。

## 已知限制

1. **平台水印**：左上角烧「RunningHub AI生成」，成片即带。
2. **硬切位置由源片决定**：约 2.42 / 4.46 / 6.33 / 8.50s，提示词只负责让模型别改机位，切点可能前后漂一两帧。
3. **俯视镜是身份风险点**：第 3、5 镜只有局部肢体与头顶，脸几乎不可见；若身份漂，同 seed 重跑一次，仍漂把步数 20 → 24。
4. **末帧与源片有小差异**：源片末帧只剩袖与手，成片多留了一点头部与肩，不影响交付。
5. **无声**：图内音轨不接输出，原声从源片轨另取后合成。
6. **20 步成本约为 4 步的 5 倍**；长序列上这是买「不发蓝」的代价，不是画质偏好。
7. 平台 `fileName` 约 1 天过期，过期从 `assets/` 重传后换 `build.mjs` 顶部 `ASSETS`。

## 封面

- 主标：**五镜一条，换个人继续跳**
- 副标：**H3 楼梯舞 243 帧全片换人 · LoRA bypass + 20 步；俯视镜不崩身份，末帧滑出画面不收成站姿**
- 文件：`cover-3x4.jpg`，1680×2240（严格 3:4），纯 CSS 几何/渐变渲染（竖向长阶 + 两墙夹道 + 苍白天空 + 浅蓝宽袖剪影与金冠），文字为霞鹜文楷叠字，无可识别影视角色或真实人脸。

## 复现

```bash
node build.mjs     # → workflow.ui.json（26 节点 / 28 连线）
node check.mjs     # → 结构自检 + 导出 workflow.api.json（用完删）
```

API 图直投（不经网页导入）：

```bash
node <skills>/runninghub-workflow-lab-yashu/scripts/rhx.mjs run \
  --workflow "<本目录>/workflow.api.json" --out "<产物目录>" --name v1 --timeout 1800
```
