/**
 * H3 两人换人 · 两镜（老者近特写 + 中年男极特写）（06 机位）· 一采 UI 工作流生成器
 *
 * 底座：05 同款一采链路（864×736 单采，无放大支路）
 * 改动：参考图 3 → 2；源片已删掉开头的杂帧、剪到 76 帧内容 + 尾部 14 帧静帧 = 90 帧；
 *       两镜结构（00:01.375 硬切）；提示词按 2 人 / 2 镜重写，第 1 镜老者说一句（STT 实测）
 *
 * 用法：node build.mjs
 * 产物：workflow.ui.json（本目录）
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = join(HERE, 'templates/base_onepass.ui.json');

// ---------------- 可调常量 ----------------
const FRAMES = 90;                  // 17*5+5，24fps → 3.750s（76 帧有效内容 + 尾部 14 帧静帧）
const WIDTH = 864;                  // 出片宽 = 生成宽（一采，不放大）
const HEIGHT = 736;                 // 出片高 = 生成高
const SEED = 20261114;
const OUT_PREFIX = 'norman06_onepass_2p';

// 平台 fileName（约 24 小时过期，重传只换这里）
const ASSETS = {
  video: 'openapi/59a27ccb7da0fef58a759b7084aa1d0ec5c0864656e4e2c7c357aec12feb072e.mp4',
  yuwang: 'openapi/c8a5fb11528e7afa62f0aa9538908d51c3a6263221f8f22ee1cca70a1c82e7a9.png',
  renwu2_face: 'openapi/3daceebc09d0e10e8fbab86de5106cdca8f275dfab04d1aaaf8fdbf78ce2acf3.png',
};

const TPL = new Map();
for (const n of JSON.parse(readFileSync(BASE, 'utf8')).nodes) {
  if (!TPL.has(n.type)) TPL.set(n.type, n);
}

// 提示词唯一真相源：改 prompt.txt，再跑本脚本
const PROMPT = readFileSync(join(HERE, 'prompt.txt'), 'utf8').trim();

// ---------------- 节点表 ----------------
const refs = [
  ['img1', '★ 改这里 · 裕王（第1镜·唯一大脸，白发老者位）', ASSETS.yuwang],
  ['img2', '★ 改这里 · 人物2 左脸特写（第2镜·唯一大脸，红棕发男位）', ASSETS.renwu2_face],
];

const nodes = [
  // 模型链
  { key: 'unet', type: 'UNETLoader', title: 'UNET · ref2va int8', x: 0, y: 0, size: [380, 90],
    widgets: ['minimax_h3_ref2va_int8_convrot.safetensors', 'default'] },
  { key: 'lora', type: 'LoraLoaderModelOnly', title: 'LoRA · 4 步 turbo', x: 0, y: 140, size: [380, 90],
    widgets: ['minimax_h3_turbo_4step_ckpt500.safetensors', 1.0] },
  { key: 'sage', type: 'PathchSageAttentionKJ', title: 'SageAttention', x: 0, y: 280, size: [380, 90],
    widgets: ['auto', false] },
  { key: 'patch', type: 'MiniMaxH3MemoryEfficientSageAttentionPatch', title: '显存优化补丁', x: 0, y: 420, size: [380, 70] },
  { key: 'clip', type: 'CLIPLoader', title: 'CLIP', x: 0, y: 540, size: [380, 110],
    widgets: ['qwen3vl_32b_minimax_h3_int8_convrot.safetensors', 'minimax', 'default'] },
  { key: 'vaeV', type: 'VAELoader', title: '视频 VAE', x: 0, y: 700, size: [380, 60],
    widgets: ['minimax_h3_video_vae_fp16.safetensors'] },
  { key: 'vaeA', type: 'VAELoader', title: '音频 VAE', x: 0, y: 800, size: [380, 60],
    widgets: ['minimax_h3_audio_vae_fp32.safetensors'] },

  // 输入
  { key: 'video', type: 'VHS_LoadVideo', title: '★ 改这里 · 参考视频（要换人的原片）', red: true,
    x: 460, y: 0, size: [420, 500],
    widgets: { video: ASSETS.video, frame_load_cap: FRAMES } },
  ...refs.map(([key, title, file], i) => ({
    key, type: 'LoadImage', title, red: true,
    x: 460 + (i % 2) * 330, y: 520 + Math.floor(i / 2) * 340, size: [300, 320],
    widgets: [file, 'image'],
  })),
  { key: 'prompt', type: 'PrimitiveStringMultiline', title: '★ 改这里 · 提示词（H3 Ref2VA 六段式）', red: true,
    x: 460, y: 2000, size: [620, 420], widgets: [PROMPT] },

  { key: 'wv', type: 'PrimitiveFloat', title: '出片宽（32 的倍数）', x: 1140, y: 520, size: [300, 110], widgets: [WIDTH] },
  { key: 'w', type: 'ComfyMathExpression', title: '宽 → INT', x: 1140, y: 660, size: [300, 110], widgets: ['a'] },
  { key: 'hv', type: 'PrimitiveFloat', title: '出片高（32 的倍数）', x: 1140, y: 800, size: [300, 110], widgets: [HEIGHT] },
  { key: 'h', type: 'ComfyMathExpression', title: '高 → INT', x: 1140, y: 940, size: [300, 110], widgets: ['a'] },

  // 生成
  { key: 'r2v', type: 'MiniMaxH3ReferenceToVideo', title: 'MiniMax H3 参考生视频（出条件 + 潜空间）',
    x: 1500, y: 0, size: [340, 520], widgets: ['', WIDTH, HEIGHT, FRAMES, 'match'] },

  // 一采
  { key: 'sched', type: 'BasicScheduler', title: '调度器 beta / 4 步', x: 1900, y: 0, size: [300, 120], widgets: ['beta', 4, 1] },
  { key: 'refiner', type: 'H3SigmaRefiner', title: 'Sigma 尾部加密（0.7 以下 +2 步）', x: 1900, y: 160, size: [300, 150], widgets: [2, 0.7, 0, 'cosine'] },
  { key: 'split', type: 'SplitSigmas', title: '切分 4：全部给一采', x: 1900, y: 350, size: [300, 90], widgets: [4] },
  { key: 'noise', type: 'RandomNoise', title: '噪声种子', x: 1900, y: 480, size: [300, 90], widgets: [SEED, 'fixed'] },
  { key: 'ksel', type: 'KSamplerSelect', title: '采样器 euler', x: 1900, y: 610, size: [300, 70], widgets: ['euler'] },
  { key: 'guider', type: 'BasicGuider', title: '引导器', x: 1900, y: 720, size: [300, 60] },

  { key: 'pass1', type: 'SamplerCustomAdvanced', title: '一采（4 步 @864×736，直出）', x: 2260, y: 0, size: [260, 160] },

  // 输出
  { key: 'vdec', type: 'VAEDecode', title: '视频解码', x: 2560, y: 0, size: [240, 60] },
  { key: 'vdbg', type: 'VRAM_Debug', title: '显存回收 / 透传', x: 2560, y: 120, size: [300, 200] },
  { key: 'out', type: 'VHS_VideoCombine', title: '输出成片（原声）', orange: true, x: 2560, y: 360, size: [340, 300],
    widgets: { frame_rate: 24, filename_prefix: OUT_PREFIX, format: 'video/h264-mp4', pix_fmt: 'yuv420p', crf: 19 } },
  { key: 'note', type: 'MarkdownNote', title: '说明', x: 2980, y: 0, size: [520, 720], widgets: [''] },
];

const wires = [
  ['unet', 0, 'lora', 'model'],
  ['lora', 0, 'sage', 'model'],
  ['sage', 0, 'patch', 'model'],
  ['patch', 0, 'sched', 'model'],
  ['patch', 0, 'guider', 'model'],

  ['wv', 0, 'w', 'values.a'],
  ['hv', 0, 'h', 'values.a'],
  ['w', 1, 'r2v', 'width'],
  ['h', 1, 'r2v', 'height'],
  ['prompt', 0, 'r2v', 'prompt'],
  ...refs.map(([key], i) => [key, 0, 'r2v', `ref_images.ref_image_${i}`]),
  ['video', 0, 'r2v', 'ref_videos.ref_video_0'],
  ['video', 2, 'r2v', 'ref_video_audios.ref_video_audio_0'],
  ['clip', 0, 'r2v', 'clip'],
  ['vaeV', 0, 'r2v', 'vae'],
  ['vaeA', 0, 'r2v', 'audio_vae'],

  ['sched', 0, 'refiner', 'sigmas'],
  ['refiner', 0, 'split', 'sigmas'],
  ['split', 0, 'pass1', 'sigmas'],
  ['noise', 0, 'pass1', 'noise'],
  ['ksel', 0, 'pass1', 'sampler'],
  ['r2v', 0, 'guider', 'conditioning'],
  ['guider', 0, 'pass1', 'guider'],
  ['r2v', 1, 'pass1', 'latent_image'],

  ['pass1', 1, 'vdec', 'samples'],
  ['vaeV', 0, 'vdec', 'vae'],
  ['vdec', 0, 'vdbg', 'any_input'],
  ['vdbg', 0, 'out', 'images'],
  ['video', 2, 'out', 'audio'],
];

const note = `## H3 两人换人 · 两镜（老者近特写 + 中年男极特写）· 06 机位 · 一采

**红块 = 你要改的**：原片、两张人物图、提示词。**橙块 = 输出**。
种子默认 fixed=${SEED}，要换一版改 build.mjs 顶部 SEED。

### 链路（只有一采，无放大支路）
1. \`一采\`：${WIDTH}×${HEIGHT} 跑 4 步（beta + 尾部加密 2 步，切分 4 全给一采）。
2. \`VAEDecode\` → \`VHS_VideoCombine\`：24fps mp4，**音轨用原片原声**，H3 自编声轨丢弃。

### 这一段的镜头结构（不能改）
- **0.000–1.375s**：单人近特写，白发老者正面朝镜头（原片）。
- **1.375–3.167s**：**硬切**另一人的极特写，红棕发男，脸占满画幅。
- **3.167–3.750s**：最后 14 帧是**静帧 hold**（同一画面复制），任何动作都停住。
- 源片开头那 1 帧是上一镜的尾巴，**已删掉**，所以第 1 镜从干净的近特写开始。

### 参考图顺序（不能错，改一张就改一个人）
- \`Picture 1\` 裕王 → 第 1 镜（唯一大脸）
- \`Picture 2\` 人物2 左脸特写 → 第 2 镜（唯一大脸）

### 台词（STT 实测，别改字）
- **第 1 镜老者说一句**：\`You're out, Norman.\`，0.50s 起、最后一个音节压在切点上。
- 原声里 2.2–3.1s 还有一句 \`Am I?\`，**老板要求不作处理**：不给它写台词、第 2 镜那张脸不动嘴（声音仍在原声里，因为是 1:1 复用）。

### 表演铁律（沿用 05 的教训）
- **表情以原片为起点**：眉高、眼神方向、颧骨与下颌形状照抄；第 1 镜只放开嘴唇和下颌（只在他那句台词期间），第 2 镜只放开眉 / 上眼皮 / 下颌 / 头位，做**一次**震惊。
- **第 2 镜：震惊（一次成型，不垂眼、不眨眼）**——切入第一帧就开始，不先垂：眉抬、眼神从向下抬到平视镜头、上眼皮一次抬到**明显大于原片**（上下露眼白，眼型不变）、下颌微降把小缝变成小张口、头微后仰上抬几像素；约 2.300s 到位后**保持到静帧**。
  - 硬约束：**整镜不许眨眼、不许眼皮抖动、不许二次开合、不许回落下掉**。
  - 踩坑：① 单调睁大模型不响应 → 要写成「一次单向到位再保持」；② 上一版「先垂 0.6s」被模型做成半闭+抖动，观感是「困/沮丧」，而且眼神向下 → **震惊不给垂眼，眼神必须抬起来**。
- 画外音不锁任何人的嘴。
- **第 1 镜**动作幅度写死「逐帧等于原片」：只允许原片那点微点头、眨眼、眼珠移动，**禁止放大、禁止复读**；第 2 镜按上面「一次震惊」走，眨眼一律不许。
- 两镜机位**完全锁死**：无手持抖动、无推镜、无缩放。

### 换片时改哪里
1. \`frame_load_cap\` 与 \`length\` 必须一致，且落在 **17k+5** 网格（73/90/107…）。本段 = **90**。
2. 宽高填 **32 的倍数**，经两个 \`→ INT\` 节点送进模型。
3. 该节点最多 9 个 \`ref_images\` 槽，本段只用 2 个，空槽不接就行。

### 素材有效期
图里是平台 \`fileName\`，**约 24 小时失效**。报「找不到图」不是接线错，重传后改 build.mjs 的 ASSETS：

\`\`\`bash
node <runninghub-cloud-yashu>/scripts/rh.mjs --upload "<本地图>"
\`\`\`

### 验收看什么
抽 1 / 16 / 33 / 50 / 75 / 90 六帧：① 第 1 镜是金冠金袍裕王，**不长眼镜、不留白发** ② 1.375s 处真的硬切、没有叠化（H3 切点可能漂，见 pitfalls）③ 第 2 镜是黑发金冠 + 冰蓝袍 + 长须的人物2，**不是红发蓝眼** ④ 两张脸都不动嘴 ⑤ 没有现代西装、白衬衫、领带、眼镜残留 ⑥ 最后 14 帧完全静止 ⑦ 黑边没被吃掉`;

nodes.find((n) => n.key === 'note').widgets = [note];

// ---------------- 生成 ----------------
const byKey = new Map();
const outNodes = [];
let id = 0;
for (const spec of nodes) {
  const t = TPL.get(spec.type);
  if (!t) throw new Error(`模板里没有 ${spec.type}`);
  id += 1;
  const n = JSON.parse(JSON.stringify(t));
  n.id = id;
  n.type = spec.type;
  n.order = 0;
  n.mode = 0;
  n.flags = {};
  n.pos = [spec.x, spec.y];
  if (spec.size) n.size = spec.size;
  if (spec.title) n.title = spec.title; else delete n.title;
  delete n.color;
  delete n.bgcolor;
  if (spec.red) { n.color = '#c0392b'; n.bgcolor = '#5b1f1f'; }
  if (spec.orange) { n.color = '#d35400'; n.bgcolor = '#5a3208'; }
  delete n.widgets_values_named;
  if (n.properties) {
    delete n.properties.ttNbgOverride;
    delete n.properties['Node name for S&R'];
    delete n.properties.widget_ue_connectable;
    if (!Object.keys(n.properties).length) delete n.properties;
  }
  for (const i of n.inputs || []) i.link = null;
  for (const o of n.outputs || []) o.links = [];
  if (!n.inputs) n.inputs = [];
  if (!n.outputs) n.outputs = [];
  if (spec.widgets !== undefined) {
    const base = n.widgets_values;
    if (spec.widgets && typeof spec.widgets === 'object' && !Array.isArray(spec.widgets)
      && base && typeof base === 'object' && !Array.isArray(base)) {
      n.widgets_values = { ...base, ...spec.widgets };
    } else {
      n.widgets_values = spec.widgets;
    }
  }
  // 底座里带的旧预览信息会指向别的片，清掉
  if (n.widgets_values && typeof n.widgets_values === 'object' && !Array.isArray(n.widgets_values)) {
    delete n.widgets_values.videopreview;
  }
  const wi = (n.inputs || []).filter((i) => i.widget && i.widget.name);
  if (Array.isArray(n.widgets_values) && wi.length) {
    if (wi.length === n.widgets_values.length) {
      n.widgets_values_named = Object.fromEntries(wi.map((i, k) => [i.widget.name, n.widgets_values[k]]));
    } else if (n.widgets_values.length === wi.length + 1) {
      const named = Object.fromEntries(wi.map((i, k) => [i.widget.name, n.widgets_values[k]]));
      named['control_after_generate'] = n.widgets_values[wi.length];
      n.widgets_values_named = named;
    }
  }
  byKey.set(spec.key, n);
  outNodes.push({ key: spec.key, node: n });
}

// 模板只声明了 ref_image_0..3，按 refs 数量补齐（插在 ref_videos 之前，顺序即 Picture 序号）
const r2vNode = byKey.get('r2v');
for (let k = 0; k < refs.length; k += 1) {
  const name = `ref_images.ref_image_${k}`;
  if (!r2vNode.inputs.some((i) => i.name === name)) {
    const at = r2vNode.inputs.findIndex((i) => i.name.startsWith('ref_videos'));
    r2vNode.inputs.splice(at, 0, { name, type: 'IMAGE', link: null });
  }
}

const links = [];
let lid = 0;
for (const [srcKey, srcSlot, dstKey, dstName] of wires) {
  const s = byKey.get(srcKey);
  const d = byKey.get(dstKey);
  if (!s) throw new Error(`没有节点 ${srcKey}`);
  if (!d) throw new Error(`没有节点 ${dstKey}`);
  const so = s.outputs[srcSlot];
  if (!so) throw new Error(`${srcKey} 没有输出槽 ${srcSlot}`);
  const di = d.inputs.findIndex((i) => i.name === dstName);
  if (di < 0) throw new Error(`${dstKey}(${d.type}) 没有输入 ${dstName}；现有：${d.inputs.map((i) => i.name).join(',')}`);
  lid += 1;
  links.push([lid, s.id, srcSlot, d.id, di, so.type]);
  so.links.push(lid);
  d.inputs[di].link = lid;
}

const indeg = new Map(outNodes.map((o) => [o.node.id, 0]));
const adj = new Map(outNodes.map((o) => [o.node.id, []]));
for (const l of links) {
  adj.get(l[1]).push(l[3]);
  indeg.set(l[3], indeg.get(l[3]) + 1);
}
const q = outNodes.filter((o) => indeg.get(o.node.id) === 0).map((o) => o.node.id);
const order = [];
while (q.length) {
  const nid = q.shift();
  order.push(nid);
  for (const nx of adj.get(nid)) {
    indeg.set(nx, indeg.get(nx) - 1);
    if (indeg.get(nx) === 0) q.push(nx);
  }
}
if (order.length !== outNodes.length) throw new Error('接线有环');
const orderMap = new Map(order.map((nid, i) => [nid, i]));
for (const o of outNodes) o.node.order = orderMap.get(o.node.id);

const doc = {
  id: randomUUID(),
  revision: 0,
  last_node_id: id,
  last_link_id: lid,
  nodes: outNodes.map((o) => o.node),
  links,
  groups: [],
  config: {},
  extra: { ds: { scale: 0.5, offset: [600, 500] } },
  version: 0.4,
};

writeFileSync(join(HERE, 'workflow.ui.json'), JSON.stringify(doc, null, 1));
console.log(`workflow.ui.json  nodes=${doc.nodes.length} links=${links.length} ${WIDTH}x${HEIGHT} / ${FRAMES} 帧 / 参考图 ${refs.length} 张`);
