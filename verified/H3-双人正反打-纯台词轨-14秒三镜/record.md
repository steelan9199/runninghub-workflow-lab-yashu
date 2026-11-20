# H3 双人正反打 · 纯台词轨 · 14 秒三镜

> 一句话用途：一条 T2VA 提示词里完成「双人全景 → 过肩正 → 过肩反」三镜正反打，中文对白；音轨只在有台词的位置出声。

## 状态

- 老板 2026-11-20 看过成片，确认可用并要求入库。
- 明确保留的特性：**模型只在有台词处出声，不生成环境音 / 背景音**。这是需求，不是缺陷——方便后期自己铺声。

## 拓扑（23 节点 / 27 连线）

| 段 | 节点 |
|---|---|
| 文本编码 | `2 CLIPLoader`（qwen3vl_32b_minimax_h3_nvfp4_awq，type=minimax） |
| 主模型 | `1 UNETLoader`（minimax_h3_fl2va_pruned_int8_convrot） |
| 加速 | `17 LoraLoaderModelOnly`（fl2v_turbo_8step，默认旁路）+ `18/19 ComfySwitchNode` + `22 PrimitiveBoolean` |
| VAE | `3 VAELoader`（video int8） / `4 VAELoader`（audio fp32） |
| 条件 | `5 MiniMaxH3ImageToVideo`，first_frame / last_frame 留空 = 纯文生视频 |
| 时长 | `15 PrimitiveFloat`（秒）→ `16 ComfyMathExpression`（17k+5 吸附）→ `length` |
| 采样 | `6 BasicScheduler`(simple) + `7 KSamplerSelect`(res_multistep) + `8 RandomNoise` + `9 BasicGuider` + `10 SamplerCustomAdvanced` |
| 解码 | `11 VAEDecode` / `12 VAEDecodeAudio`（同一个 AV latent 分两路） |
| 输出 | `13 CreateVideo`(24fps) → `14 SaveVideo` |

## 默认参数

- 尺寸 1344×768，24fps，`duration=14` → **345 帧 = 14.375s**
- 采样 `res_multistep` / `simple` / 20 步 / denoise 1，seed 20261120
- Turbo 开关 `false`（改 `true` 走 8 步 LoRA）
- 三个镜头切点写在提示词里：`At 00:04.000` / `At 00:09.000`

## 实测（2026-11-20，老板实跑）

| 项 | 数值 |
|---|---|
| 文件 | 1344×768 / 24fps / 345 帧 / 14.375s / 3,160,576 B |
| 音轨 | AAC 32kHz 立体声，451 帧 |
| 音量 | mean −30.8 dB，max −11.6 dB |
| 0–5.427s | 静音（RMS −54 dB），无人声、无环境声 |
| 5.427–8.102s | 对白段，RMS −27.4 dB（苏的第一句） |
| 9.032–11.216s | 对白段，RMS −27.4 dB（林的回应） |
| 12.275–13.225s | 孤立尾音 0.95s |
| 镜头 | 0–3.6s 双人全景 / 3.6–7.2s 过肩拍苏 / 7.2–14.4s 反打拍林 |
| 轴线 | 过肩方向正确镜像，未越轴 |
| 结构自检 | 23 节点 / 27 连线，`check.mjs` PASS，红 3 / 橙 1 |

## 已知限制

1. **只在台词处出声**：0–5.4s 为 −54 dB 底噪。要环境声必须另补 `overall_soundscape` 与 `non_diegetic_music` 两段，或后期铺轨。
2. **切点提前**：设定 4.000 / 9.000，实测约 3.6 / 7.2；H3 切点不可精确控制（老坑，见 `H3-五人换人-两镜硬切-一采`）。
3. 苏的台词尾音到 8.1s，画面 7.2s 已切走，成为画外音；12.3s 还有 0.95s 孤立尾音。
4. 画面偏绿调港风，雨夜霓虹冷暖对冲、浅景深、胶片颗粒未明显出来。
5. 平台会在左上角烧「RunningHub AI生成」水印。

## 复现

```bash
node build.mjs     # 读 assets/prompt.txt + base.ui.json，生成 workflow.ui.json
node check.mjs     # 接线 / 重叠 / 控件格式 / 提示词结构自检
```

改提示词：编辑 `assets/prompt.txt` 后重跑 `build.mjs`。
改时长：改 `build.mjs` 的 `DURATION`（自动吸附 17k+5，14 → 345 帧）。

## 封面

- 主标：正反打，一条出
- 副标：H3 三镜文生视频 · 纯台词轨
- 画面：无人物霓虹茶餐厅空镜，文字压在上三分之一，霞鹜文楷叠字。
