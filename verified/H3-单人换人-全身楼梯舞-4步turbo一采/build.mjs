/**
 * H3 单人换人 · 全身楼梯舞 · 4 步 turbo · 一采 · 无声
 *
 * 做法：原片当 ref_video_0 给 H3 当运动参考，人物三视图当 ref_image_0，
 * 打开 `minimax_h3_turbo_4step_ckpt500`（strength 1.0）+ beta 4 步、denoise 1，
 * 一采直出 864×736，不做二采、不做放大。
 *
 * 本包是镜3（全身楼梯舞、107 帧）：结构自检通过，**成片尚未跑**。
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
const FRAMES = 107;        // 17k+5（17×6+5）；24fps → 4.4583s
const WIDTH = 864;
const HEIGHT = 736;
const SEED = 20261115;
const OUT_PREFIX = 'joker02_shot3_107f_turbo4';

// ---------------- 4 步 turbo 契约（别随手改）----------------
const STEPS = 4;
const LORA_STRENGTH = 1;
const REFINER_EXTRA = 0;
const SPLIT_STEP = 999;

// 平台 fileName（约 1 天过期，重传只换这里）
const ASSETS = {
  video: 'openapi/23e60aa9083ee38688b793d7e320794676732ad97cf12e96273004779127da78.mp4',
  renwu2_sheet: 'openapi/19bb73ad09adfd9035e0581c47ee07f594d8a7c4000f58b0f3da9cf171574aea.png',
};

const NOTE = `## 镜3 · 全身楼梯舞 · 107 帧 · 单人换人 · 4 步 turbo · 无声

> 结构自检通过；**成片还没跑**（2026-11-16 出图，等平台首跑回填实测）。

### ① 这个包干什么
把全身楼梯舞里的人整身换成参考图角色：**动作、镜头、楼梯间背景保持原样**，只换人。
107 帧 = 17×6+5，不用补帧。

### ② 提示词里的三条硬约束
- 景别钉死：静态中远景、微仰拍、全身入画，头顶近上边、脚近下边，人物尺寸不变（防 E08 把人画大）。
- 动作按原片写：站位 → 提右膝举右拳 → 摆左臂 → 双臂高举 → 落肩外张 → 双臂 V 字收尾。
- 服装写全：浅蓝及踝长袍 + 白交领 + 深蓝绣花门襟/袖口 + 白裤 + 黑布鞋；金冠横簪、长黑发、短须长尖胡；素颜、唇线平直。

### ③ 默认参数
- 源片：shot3_107f.mp4，864×736，frame_load_cap=107，skip_first_frames=0
- 生成尺寸：864×736（一采直出，无放大、无二采）
- 采样：euler + beta 4 步 + denoise 1；refiner 关、split 999
- 噪声：fixed 20261115
- 参考图：人物三视图 → ref_image_0，ref_image_size=match
- 输出：24fps、video/h264-mp4、yuv420p、crf 19、**无音轨**

### ④ 已知限制
- 未出片：帧间差 / 码率 / 嘴部表现都还没测。
- 人物全身占画面高度约 70–80%，比镜1 大，首跑先看有没有被画大。
- 平台左上会烧「RunningHub AI生成」水印。
- **无声**：原声要从源片音轨另取再合。

### 跑之前
- 红块 = 要改的（源片 / 参考图 / 提示词 / 宽 / 高）；橙块 = 输出节点
- 平台 fileName 约 1 天过期，过期从本包 assets/ 重传后把新名字填回节点`;

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
