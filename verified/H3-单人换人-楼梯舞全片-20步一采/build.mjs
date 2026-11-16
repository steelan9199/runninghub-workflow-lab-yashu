/**
 * H3 单人换人 · 楼梯舞全片（345 帧 / 14.375s）· LoRA bypass + 20 步 · 一采 · 无声
 *
 * 做法：源片当 ref_video_0 当运动/构图参考，人物三视图当 ref_image_0，
 * 采样走 `beta / 20 步 / denoise 1`，LoRA 4 步 turbo **bypass**（mode=4）不参与，
 * 一采直出 864×736，无放大、无二采。
 *
 * 为什么不开 turbo：4 步 turbo（strength 1.0）在长序列（300+ 帧）上会把冷色放大成
 * 浅蓝自发光，长袍、楼梯、扶手全裹青焰；同片关 LoRA 改 20 步即干净。
 * 详见 runninghub-workflow-lab-yashu/references/pitfalls.md「LoRA / 采样」。
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
const FRAMES = 345;        // 17×20+5；24fps → 14.375s
const WIDTH = 864;         // 32 的倍数
const HEIGHT = 736;        // 32 的倍数
const SEED = 20261115;
const OUT_PREFIX = 'joker03_all_345f_20step';

// ---------------- 采样档（本包唯一变量）----------------
const STEPS = 20;          // BasicScheduler.steps
const LORA_MODE = 4;       // 4 = bypass；恢复 4 步 turbo 时改 0 并把 STEPS 写 4
const LORA_STRENGTH = 1;   // LoraLoaderModelOnly.strength_model
const REFINER_EXTRA = 0;   // H3SigmaRefiner.extra_steps：关
const SPLIT_STEP = 999;    // SplitSigmas.step：不切，全部给一采

// 平台 fileName（约 1 天过期，重传 assets/ 后只换这里）
const ASSETS = {
  video: 'openapi/cf3b26927bd75b93e8a05bce9c9834f3a68ddeb6f45f12ab74114b0fcca93f20.mp4',
  renwu2_sheet: 'openapi/19bb73ad09adfd9035e0581c47ee07f594d8a7c4000f58b0f3da9cf171574aea.png',
};

const NOTE = `## 小丑03 · 楼梯舞全片 345 帧 · 单人换人 · 20 步（LoRA 已 bypass）· 无声

**唯一目的：把这条 14.375s 楼梯舞素材里的人换成同一个参考角色。**
345 帧 = 17×20+5；24fps / 864×736 / 源片带原声（本工作流输出无声，原声另合）。

### 素材事实
| 项 | 值 |
|---|---|
| 源片 | \`小丑03_345f.mp4\`，345 帧 / 14.375s / 864×736 / 24fps |
| 镜头 | 0–4.9s 高机位俯视：沿长台阶看向下方街道（停车、垃圾袋、铁栏杆、灯柱）；4.9s 起低机位仰视：沿台阶望向两墙之间的天空，人物放大到画面 1/3–1/2 高 |
| 动作 | 前段沿台阶向下跳、挥臂、踢腿；后段朝镜头大幅踢腿、张臂、转身、后仰；最后一帧仍在舞、右臂高举 |
| 收尾 | 不是站定，最后仍在动作中 |

### 本版参数
- 节点 2：LoRA **bypass（mode=4）**，strength 留 1.0；恢复 4 步时改回 mode=0 并把节点 16 改 4 步
- 节点 16：beta / **20 步** / denoise 1
- 节点 15：length=345，864×736，ref_image_size=match；节点 8：frame_load_cap=345、skip_first_frames=0
- 节点 19：seed 20261115（fixed）
- 节点 17：refiner extra=0（关）；节点 18：split 999（不切）
- 节点 20：euler；无音轨

### 提示词要点
- 六段式，单条素材不写 [Shot] 时间码分割，只按「前段俯视 / 后段仰视」两段描述
- 身份锚点每段重复：金冠横簪 / 黑发髻 + 长直黑发 / 粗平黑眉 / 短黑须 / 长尖黑山羊胡 / 素颜 / 浅蓝棉袍 / 白交领 / 深蓝绣花门襟袖口 / 白裤黑鞋
- 材质句固定：\`plain woven cotton\`、\`flat matte\`、\`dull surface, natural creases\`
- 全程不写 ice / cool teal / rim / flare / bright / catching the light / silver

### 判读标准
- **通过**：无浅蓝自发光；身份不崩；人物大小/景别/镜头高度跟随源片；最后仍在舞
- **半通过**：后段身份漂 → 同 seed 重跑一次；仍漂 → 换去光词或步数 20 → 24
- **不通过**：退回小丑红西装 → 检查 ref_image_0 是否只剩一张图

### 跑之前
- 平台左上会烧「RunningHub AI生成」水印
- 源片 / 参考图的 openapi/ fileName 约 1 天过期，过期重传后填回节点 8 / 9
- 输出无声，原声回贴：
  \`ffmpeg -i 出片.mp4 -i 小丑03_345f.mp4 -map 0:v -map 1:a -c:v copy -c:a copy out.mp4\`
- 345 帧若 OOM：先降分辨率到 832×704，**不要再开 turbo LoRA**（会回到蓝光）`;

const j = JSON.parse(readFileSync(BASE, 'utf8'));
const byId = new Map(j.nodes.map((n) => [n.id, n]));
const N = (id) => {
  const n = byId.get(id);
  if (!n) throw new Error(`模板里没有节点 #${id}`);
  return n;
};

// ---- 素材 ----
N(8).widgets_values.video = ASSETS.video;
N(8).widgets_values.frame_load_cap = FRAMES;
N(8).widgets_values.skip_first_frames = 0;
N(8).title = '★ 源片 · 楼梯舞全片 345f（14.375s）';
N(9).widgets_values[0] = ASSETS.renwu2_sheet;
N(10).widgets_values[0] = readFileSync(join(HERE, 'prompt.txt'), 'utf8').trim();
N(11).widgets_values[0] = WIDTH;
N(13).widgets_values[0] = HEIGHT;
N(15).widgets_values[1] = WIDTH;
N(15).widgets_values[2] = HEIGHT;
N(15).widgets_values[3] = FRAMES;
N(15).title = 'MiniMax H3 参考生视频（345 帧 / 864×736）';
N(19).widgets_values[0] = SEED;
N(25).widgets_values.filename_prefix = OUT_PREFIX;

// ---- 采样档 ----
N(2).mode = LORA_MODE;
N(2).widgets_values[1] = LORA_STRENGTH;
N(16).widgets_values[1] = STEPS;
N(16).widgets_values[2] = 1;
N(17).widgets_values[0] = REFINER_EXTRA;
N(18).widgets_values[0] = SPLIT_STEP;

// ---- 说明卡 ----
N(26).widgets_values[0] = NOTE;

// ---- 配色：红 = 要改的，橙 = 输出 ----
N(11).color = '#c0392b';
N(11).bgcolor = '#5b1f1f';
N(11).title = '★ 改这里 · 出片宽（32 的倍数）';
N(13).color = '#c0392b';
N(13).bgcolor = '#5b1f1f';
N(13).title = '★ 改这里 · 出片高（32 的倍数）';

// ---- 导出工具留下的冗余缓存：丢弃 ----
for (const n of j.nodes) delete n.widgets_values_named;

// ---- 帧数必须落在 17k+5 网格 ----
if ((FRAMES - 5) % 17 !== 0) throw new Error(`FRAMES=${FRAMES} 不在 17k+5 网格`);

j.nodes.forEach((n, i) => { n.order = i; });

writeFileSync(join(HERE, 'workflow.ui.json'), JSON.stringify(j, null, 1));
console.log(`workflow.ui.json：${j.nodes.length} 节点 / ${j.links.length} 连线`);
