/**
 * H3 单人换人 · 中近景烟雾镜 · 4 步 turbo · 一采 · 无声
 *
 * 做法：原片当 ref_video_0 给 H3 当运动参考，人物三视图当 ref_image_0，
 * 打开 `minimax_h3_turbo_4step_ckpt500`（strength 1.0）+ beta 4 步、denoise 1，
 * 一采直出 864×736，不做二采、不做放大。
 *
 * 本包对应 2026-11-16 老板验收的那条中近景（夹烟 → 扔烟 → 吐一大团烟）。
 *
 * 用法：node build.mjs
 * 产物：workflow.ui.json（本目录）
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = join(HERE, 'templates/base.ui.json');

// ---------------- 可调常量 ----------------
const FRAMES = 124;        // 17k+5；24fps → 5.1667s
const WIDTH = 864;         // 32 的倍数
const HEIGHT = 736;        // 32 的倍数
const SEED = 20261115;
const OUT_PREFIX = 'joker02_shot2_124f_turbo4';

// ---------------- 4 步 turbo 契约（别随手改）----------------
const STEPS = 4;
const LORA_STRENGTH = 1;
const REFINER_EXTRA = 0;
const SPLIT_STEP = 999;

// 平台 fileName（约 1 天过期，重传只换这里）
const ASSETS = {
  video: 'openapi/5a3341817b3c2a0c20739a481248f7ad2e06fcdbcd7c8d53b4e9259e79f2d9e7.mp4',
  renwu2_sheet: 'openapi/19bb73ad09adfd9035e0581c47ee07f594d8a7c4000f58b0f3da9cf171574aea.png',
};

const NOTE = `## 镜2 · 中近景烟雾镜 · 124 帧 · 单人换人 · 4 步 turbo · 无声

> 2026-11-16 老板验收：「这次基本上是符合原视频的」。夹烟 → 扔烟 → 一大团吐烟都对。

### ① 这个包干什么
把中近景（胸上）里的人整身换成参考图角色：**动作、吐烟、砖墙背景、静态镜头保持原样**，只换人。
默认参数就是出片那一版，导入后不用改，直接运行。

### ② 提示词里的三条硬约束
- 开场右手夹烟在嘴边，烟离开嘴时带出一小缕烟（不是主动吐）；第 1 秒向下甩手把烟扔到地上。
- 约 1.8 秒只有一次主动吐烟：一大团灰白浓烟，2.0–2.3 秒正面糊住嘴、鼻、眼，随后变薄上飘出画。
- 全篇不出现 smile / grin / laugh；脸是素颜，唇线平直，表情平静——小丑的彩绘嘴远看像在笑，词里写「笑」就会把笑做实。

### ③ 默认参数（出片那一版）
- 源片：shot2_124f.mp4，864×736，frame_load_cap=124，skip_first_frames=0
- 生成尺寸：864×736（一采直出，无放大、无二采）
- 采样：euler + beta 4 步 + denoise 1；refiner 关、split 999
- 噪声：fixed 20261115
- 参考图：人物三视图 → ref_image_0，ref_image_size=match
- 输出：24fps、video/h264-mp4、yuv420p、crf 19、**无音轨**

### ④ 已知限制
- 吐烟散尽后嘴仍会小幅张合（看起来像在说话）。老板 2026-11-16 决定不再追：v4 加形容词、v5 把嘴降成 weak_reference 都没压住，本包保留验收那一版。
- 2.0–2.3 秒烟团正面糊脸，这段不判身份一致性；验脸看 0–1.7 秒与 2.5 秒后。
- 平台左上会烧「RunningHub AI生成」水印。
- **无声**：原声要从源片音轨另取再合。

### 跑之前
- 红块 = 要改的（源片 / 参考图 / 提示词 / 宽 / 高）；橙块 = 输出节点
- 平台 fileName 约 1 天过期，过期从本包 assets/ 重传后把新名字填回节点
- 想保嘴型：换 seed 多跑一条比继续加词有效；词层已经到顶`;

const j = JSON.parse(readFileSync(BASE, 'utf8'));
const byId = new Map(j.nodes.map((n) => [n.id, n]));
const N = (id) => {
  const n = byId.get(id);
  if (!n) throw new Error(`模板里没有节点 #${id}`);
  return n;
};

N(8).widgets_values.video = ASSETS.video;
N(8).widgets_values.frame_load_cap = FRAMES;
N(8).widgets_values.skip_first_frames = 0;
N(9).widgets_values[0] = ASSETS.renwu2_sheet;
N(10).widgets_values[0] = readFileSync(join(HERE, 'prompt.txt'), 'utf8').trim();
N(11).widgets_values[0] = WIDTH;
N(13).widgets_values[0] = HEIGHT;
N(15).widgets_values[1] = WIDTH;
N(15).widgets_values[2] = HEIGHT;
N(15).widgets_values[3] = FRAMES;
N(19).widgets_values[0] = SEED;
N(25).widgets_values.filename_prefix = OUT_PREFIX;

N(2).mode = 0;
N(2).widgets_values[1] = LORA_STRENGTH;
N(16).widgets_values[1] = STEPS;
N(16).widgets_values[2] = 1;
N(17).widgets_values[0] = REFINER_EXTRA;
N(18).widgets_values[0] = SPLIT_STEP;

N(26).widgets_values[0] = NOTE;

N(11).color = '#c0392b';
N(11).bgcolor = '#5b1f1f';
N(11).title = '★ 改这里 · 出片宽（32 的倍数）';
N(13).color = '#c0392b';
N(13).bgcolor = '#5b1f1f';
N(13).title = '★ 改这里 · 出片高（32 的倍数）';

for (const n of j.nodes) delete n.widgets_values_named;

if ((FRAMES - 5) % 17 !== 0) throw new Error(`FRAMES=${FRAMES} 不在 17k+5 网格`);

j.nodes.forEach((n, i) => { n.order = i; });

writeFileSync(join(HERE, 'workflow.ui.json'), JSON.stringify(j, null, 1));
console.log(`workflow.ui.json：${j.nodes.length} 节点 / ${j.links.length} 连线`);
