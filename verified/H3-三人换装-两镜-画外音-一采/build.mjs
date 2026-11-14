/**
 * H3 三人换人 · 两镜（三人中景 + 两人对座）（05 机位）· 一采 UI 工作流生成器
 *
 * 底座：04 同款一采链路（864×736 单采，无放大支路）
 * 改动：参考图 5 → 3；已剪掉原片第 1 镜（前 13 帧），尾部静帧补到 107 帧；
 *       两镜结构（00:01.083 硬切）；提示词按 3 人 / 2 人重写，含 STT 出的两句台词
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
const FRAMES = 107;                 // 17*6+5，24fps → 4.458s（94 帧有效内容 + 尾部 13 帧静帧）
const WIDTH = 864;                  // 出片宽 = 生成宽（一采，不放大）
const HEIGHT = 736;                 // 出片高 = 生成高
const SEED = 20261114;
const OUT_PREFIX = 'norman05_onepass_3p';

// 平台 fileName（约 24 小时过期，重传只换这里）
const ASSETS = {
  video: 'openapi/0ae50d019091838da08a87349311d2b07a4a3bdbea20617064d1ea7c321e13bd.mp4',
  huzongxian: 'openapi/3981ed54d8ec515429cbdb995a52e75953d5453b3c6ce4b9052128988b3eb075.png',
  lvfang: 'openapi/025df0d4c693b8d51f040bdda8a2f29b4684ee1c669bfe21a46d7005e3f07c0d.png',
  renwu2: 'openapi/3daceebc09d0e10e8fbab86de5106cdca8f275dfab04d1aaaf8fdbf78ce2acf3.png',
};

const TPL = new Map();
for (const n of JSON.parse(readFileSync(BASE, 'utf8')).nodes) {
  if (!TPL.has(n.type)) TPL.set(n.type, n);
}

// 提示词唯一真相源：改 prompt.txt，再跑本脚本
const PROMPT = readFileSync(join(HERE, 'prompt.txt'), 'utf8').trim();

// ---------------- 节点表 ----------------
const refs = [
  ['img1', '★ 改这里 · 胡宗宪（第1镜左边缘虚焦半头 / 第2镜左中最前·说话者）', ASSETS.huzongxian],
  ['img2', '★ 改这里 · 吕芳（第1镜背对镜头 / 第2镜右侧近景·不说话）', ASSETS.lvfang],
  ['img3', '★ 改这里 · 人物2（第1镜右侧站立·唯一大脸）', ASSETS.renwu2],
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

const note = `## H3 三人换人 · 两镜（三人中景 + 两人对座）· 05 机位 · 一采

**红块 = 你要改的**：原片、三张人物图、提示词。**橙块 = 输出**。
种子默认 fixed=${SEED}，要换一版改 build.mjs 顶部 SEED。

### 链路（只有一采，无放大支路）
1. \`一采\`：${WIDTH}×${HEIGHT} 跑 4 步（beta + 尾部加密 2 步，切分 4 全给一采）。
2. \`VAEDecode\` → \`VHS_VideoCombine\`：24fps mp4，**音轨用原片原声**，H3 自编声轨丢弃。

### 这一段的镜头结构（不能改）
- **0.000–1.083s**：三人同框。左边缘虚焦光头男（半头）、中左侧坐男（背对镜头）、右侧站立男（唯一大脸），站立男不说话。
- **1.083–4.458s**：**硬切**两人对座中景，固定机位微推。
- **3.917–4.458s**：最后 13 帧是**静帧 hold**（同一画面复制），任何动作都停住。

### 参考图顺序（不能错，改一张就改一个人）
- \`Picture 1\` 胡宗宪 → 第 1 镜**左边缘虚焦半头** + 第 2 镜**左中最前**（台词 "The board is unanimous."）
- \`Picture 2\` 吕芳 → 第 1 镜**背对镜头** + 第 2 镜**右侧近景**（全程不说话）
- \`Picture 3\` 人物2 → 第 1 镜**右侧站立**（唯一大脸，不说话）

### 台词（STT 实测，别改字）
- 第 1 镜：「Please, Norman.」是**画外音**，不是画面里三个人说的，脸上不能有任何对口型的动作。
- 第 2 镜：「The board is unanimous.」由左侧光头胡宗宪说，要嘴型跟。

### 表演铁律（05 第一版踩出来的，别再放大动作）
- 第 1 镜站立男：嘴唇**定格在微张的固定缝隙**，缝宽逐帧不变；不许一张一闭、不许抽搐颤动、不许咀嚼、不许露牙露舌（第二版就是这里还在开合）。唯一允许的动作是**一次轻点头**，点头时嘴形不变。
- 第 1 镜画外音不锁任何人的嘴（第一版就是模型把这句安到了站立男脸上）。
- 第 2 镜光头：只允许原片那种**几像素慢摆 + 轻微歪头**和手指小动作，**禁止复读左右摇头、节奏性点头、放大摆幅**。
- 第 2 镜机位**完全锁死**：无手持抖动、无推镜、无缩放。

### 换片时改哪里
1. \`frame_load_cap\` 与 \`length\` 必须一致，且落在 **17k+5** 网格（56/73/90/107…）。
2. 宽高填 **32 的倍数**，经两个 \`→ INT\` 节点送进模型。
3. 该节点实测最多 9 个 \`ref_images\` 槽，本段只用 3 个，空槽不接就行。

### 素材有效期
图里是平台 \`fileName\`，**约 24 小时失效**。报「找不到图」不是接线错，重传后改 build.mjs 的 ASSETS：

\`\`\`bash
node <runninghub-cloud-yashu>/scripts/rh.mjs --upload "<本地图>"
\`\`\`

### 验收看什么
抽 1 / 20 / 40 / 60 / 94 / 107 六帧：① 左边缘只剩虚焦半个帽子、中左是红帽背影、右侧是金冠黑发+冰蓝袍
② 1.083s 处真的硬切、没有叠化（H3 切点可能漂，见 pitfalls）③ 第 2 镜左边说话的是红袍胡宗宪、右边吕芳闭嘴
④ 吕芳不戴眼镜、不留胡须；胡宗宪是黑帽+短须 ⑤ 没有现代西装、白衬衫、领带、口袋巾残留
⑥ 最后 13 帧完全静止 ⑦ 黑边没被吃掉`;

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
