/**
 * H3 八人换人 · 董事会宽景 · 一采 UI 工作流生成器
 *
 * 底座：verified/H3-双人换人-极短镜头-一采（同尺寸 864×736 单采链路）
 * 改动：参考图 2 → 7；帧数 158 → 73；提示词按八人（七换一留）重写
 *
 * 用法：node build.mjs [--video openapi/xxx.mp4]
 * 产物：workflow.ui.json（本目录）
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = join(HERE, 'templates/base_onepass.ui.json');

// ---------------- 可调常量 ----------------
const FRAMES = 73;                  // 17*4+5，24fps → 3.042s（源片正好 73 帧）
const WIDTH = 864;                  // 出片宽 = 生成宽（一采，不放大）
const HEIGHT = 736;                 // 出片高 = 生成高
const SEED = 20261114;
const OUT_PREFIX = 'norman02_onepass_8p';

// 平台 fileName（约 24 小时过期，重传只换这里）
const ASSETS = {
  video: 'openapi/d2c1cb7f35eb7400da741b56332c2ec6f97497a473620e48f112e98ec904f3a2.mp4',
  norman: 'openapi/19bb73ad09adfd9035e0581c47ee07f594d8a7c4000f58b0f3da9cf171574aea.png',
  gaogong: 'openapi/04eca517dcf9a3152ec1511c8ddbe3f2a43b23f6d3012803869d449c66ffe224.png',
  zhangjuzheng: 'openapi/9a7f61b3ef9c2d32bbe2856c4efcd5646997be2ed20e9c7d76dbb4f43f804d73.png',
  yanshifan: 'openapi/fd97b654899729e1acf0c39ca4d253f31d4c502293a37134d3a6a30aab517889.png',
  yuwang: 'openapi/c8a5fb11528e7afa62f0aa9538908d51c3a6263221f8f22ee1cca70a1c82e7a9.png',
  lifei: 'openapi/9ad6736784fa9cc0e0624c4b22fd95e34715c2b799328bf5732cd2e45f7f172b.png',
  hairui: 'openapi/a69312a48318098e2435d6d7acb865014788c9e4d654634468bb773478a82911.png',
};

const TPL = new Map();
for (const n of JSON.parse(readFileSync(BASE, 'utf8')).nodes) {
  if (!TPL.has(n.type)) TPL.set(n.type, n);
}

// 提示词唯一真相源：改 prompt.txt，再跑本脚本
const PROMPT = readFileSync(join(HERE, 'prompt.txt'), 'utf8').trim();

// ---------------- 节点表 ----------------
const refs = [
  ['img1', '★ 改这里 · 诺曼（近端左侧背影）', ASSETS.norman],
  ['img2', '★ 改这里 · 高拱（左一）', ASSETS.gaogong],
  ['img3', '★ 改这里 · 张居正（左二）', ASSETS.zhangjuzheng],
  ['img4', '★ 改这里 · 严世蕃（左三）', ASSETS.yanshifan],
  ['img5', '★ 改这里 · 裕王（长桌尽头）', ASSETS.yuwang],
  ['img6', '★ 改这里 · 李妃（右侧）', ASSETS.lifei],
  ['img7', '★ 改这里 · 海瑞（右边缘仅肩与拳）', ASSETS.hairui],
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

const note = `## H3 八人换人 · 董事会宽景 · 一采

**红块 = 你要改的**：原片、七张人物图、提示词。**橙块 = 输出**。
种子默认 fixed=${SEED}，要换一版改 build.mjs 顶部 SEED。

### 链路（只有一采，无放大支路）
1. \`一采\`：${WIDTH}×${HEIGHT} 跑 4 步（beta + 尾部加密 2 步，切分 4 全给一采）。
2. \`VAEDecode\` → \`VHS_VideoCombine\`：24fps mp4，**音轨用原片原声**，H3 自编声轨丢弃。

### 参考图顺序（不能错，改一张就改一个人）
- \`Picture 1\` 诺曼 → 近端左侧背影（脸全程在画外）
- \`Picture 2\` 高拱 → 左一 · \`Picture 3\` 张居正 → 左二 · \`Picture 4\` 严世蕃 → 左三
- \`Picture 5\` 裕王 → 长桌尽头 · \`Picture 6\` 李妃 → 右侧
- \`Picture 7\` 海瑞 → 右边缘（只露肩与拳，脸在画外）
- 右下角那只手 **不换**，提示词已写死「不补脸、不补上身」。

### 换片时改哪里
1. \`frame_load_cap\` 与 \`length\` 必须一致，且落在 **17k+5** 网格（56/73/90…）。
2. 宽高填 **32 的倍数**，经两个 \`→ INT\` 节点送进模型。
3. 加人：在 \`MiniMaxH3 参考生视频\` 上新增 \`ref_images.ref_image_7\`，接新图，提示词补 \`<Subject 8>\` 并写清座位。
   该节点实测最多 9 个 ref_images 槽。

### 素材有效期
图里是平台 \`fileName\`，**约 24 小时失效**。报「找不到图」不是接线错，重传后改 build.mjs 的 ASSETS：

\`\`\`bash
node <runninghub-cloud-yashu>/scripts/rh.mjs --upload "<本地图>"
\`\`\`

### 验收看什么
抽 0.2 / 1.5 / 3.0 秒三帧：① 七个人各对各的参考图、不串脸 ② 诺曼仍是背影虚焦、没有凭空长出脸
③ 裕王端茶杯的手势保住 ④ 海瑞只有肩膀与拳头 ⑤ 右下角那只手没被补成人 ⑥ 没有现代西装残留、没有多余的人
⑦ 黑边没被吃掉。`;

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

// 模板只声明了 ref_image_0..3，补到 7 个（插在 ref_videos 之前，顺序即 Picture 序号）
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
