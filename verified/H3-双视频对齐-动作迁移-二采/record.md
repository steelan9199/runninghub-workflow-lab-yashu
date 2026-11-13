# H3 双视频对齐 · 动作迁移 · 二采

**用途**：人物已经换好的成片，动作却和原片对不上（模型自己加了转头、口型不对、表演不同步）。这一包不传任何图片，只喂两条视频：一条给「长相」，一条给「动作」，让成片里的人照着原片演，同时保住已经换好的脸、胡须、帽子和袍子。

**适用场景**：所有「换完人再看动作」的返工。典型症状是全员整齐划一地转头、口型与台词错位、某个人突然做原片里没有的手势。

## 拓扑

```
VHS_LoadVideo(长相来源) ─┐
                         ├─ ref_videos.ref_video_0 / _1 ─→ MiniMaxH3ReferenceToVideo
VHS_LoadVideo(动作来源) ─┘                                    │
                                                              ├─ positive ─→ BasicGuider
UNET → LoRA(4步) → SageAttn → 显存补丁 ─→ BasicScheduler(beta,4) → H3SigmaRefiner(0.7/+2)
                                                              └─ LATENT ─→ 一采 4 步
一采 → LTXVSeparateAVLatent → MinimaxH3LatentUpscaler3D(2×,只放视频) → LTXVConcatAVLatent → 二采 2 步
二采 → VAEDecode → VRAM_Debug → VHS_VideoCombine(原声, 24fps)
```

- 长相视频：`ref_videos.ref_video_0`，同时把它的音轨接 `ref_video_audios.ref_video_audio_0` 与输出音轨。
- 动作视频：`ref_videos.ref_video_1`，**只接画面、不接音频**——两条视频的音轨本来就是同一条，接两路会叠音。
- 全图 30 节点 / 38 连线，零 `LoadImage`，红块 4 个（两条视频、提示词、种子），橙块 1 个（输出）。

## 默认参数

| 项 | 值 | 说明 |
|---|---|---|
| 出片分辨率 | 832×704 → 潜空间 2× → 1664×1408 | 与源片 16:9 一致；832/704 都是 32 的倍数 |
| 帧数 | 73 | 17k+5 网格；源片 72 帧补 1 帧 |
| 帧率 | 24 | 与两条输入一致 |
| 种子 | 20261114 | fixed；与换人工作流同种子，方便逐帧对照 |
| 采样 | 一采 4 步 → 二采 2 步（beta，Sigma 尾部 0.7 以下 +2） | 一采出表演与站位，二采补细节 |
| 放大 | `scale by multiplier` 2×，仅视频潜空间 | 音频潜空间原样拼回，不放大 |
| 音频 | 取长相视频音轨，`copy` 进 mp4 | 不重新生成语音 |

## 实测数据

| 项 | 值 | 来源 |
|---|---|---|
| 长相输入 | 1664×1408 / 73 帧 / 24fps / 976 KB | ffprobe 实测 |
| 动作输入 | 842×720 / 24fps / 72 帧 | ffprobe 实测 |
| 输出规格 | 1664×1408 / 73 帧 / 3.042s | 由节点参数确定 |
| 结构自检 | 30 节点 / 38 连线 / 红 4 橙 1 | `check.mjs` 通过 |
| 生成器一致性 | 重建产物与 `workflow.ui.json` 的节点、标题、参数逐项相同 | 本包内重建比对 |
| 成片动作对齐 | 老板验收确认 | 未采样帧间差与码率 |

> 帧间差、码率、音频电平三项**未采样**。补测时抽首/中/尾三帧与原片同帧对比头角，再跑一次 ffprobe 取 `bit_rate` 与 `astats`。

## 已知限制

1. **不是专用动作迁移模型。** H3 的 ref2va 吃两条参考视频时可能做「融合」而不是严格照抄第二条；若动作仍不对，把动作视频换到 `ref_video_0`（主视频槽）再试。
2. **长相视频必须已经换完人。** 喂半成品会把中间的错脸一起固化成「参考长相」。
3. **两条视频必须同镜头、同时长。** 帧数不同会被 `length` 静默裁齐，动作对齐直接失效。
4. **音轨只接一路。** 两路音频都接会在 mp4 里出现双轨叠音。
5. **平台 `fileName` 约 1 天过期。** 报「找不到文件」不是接线错，重传换名字即可。
6. 逐轮承接会产生画质累积衰减；本包是最后一环，尽量只跑一次。

## 复现命令

```bash
# 1. 重建（改 build.mjs 顶部 VIDEO_LOOK / VIDEO_MOTION / FRAMES / SEED 即可）
node build.mjs && node check.mjs dist/H3_board03_motion.ui.json

# 2. 素材过期后重传，拿回 fileName 填进 VHS_LoadVideo.video
node <runninghub-cloud-yashu>/scripts/rh.mjs --upload "<本地视频>"

# 3. 本地直投测试（不占站内工作流）
node <runninghub-workflow-lab-yashu>/scripts/rhx.mjs run --workflow dist/H3_board03_motion.api.json \
  --out "<绝对目录>" --dry-run
```

## 封面

- 主标：**长相不动，动作照抄**
- 副标：H3 · 两条视频分开喂 · 二采对齐
- 画面：两块来源片 → 一支汇流箭头 → 一支成片，纯色块无人脸；霞鹜文楷本地叠字，尺寸 1680×2240（3:4）。
