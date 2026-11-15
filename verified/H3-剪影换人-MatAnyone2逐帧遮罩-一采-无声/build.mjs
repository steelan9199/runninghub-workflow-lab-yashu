/**
 * H3 剪影换人 · 单镜一采 · 无声
 *
 * 做法：不靠参考视频给结构，而是把原片帧编码成潜空间当起点，
 * 用 MatAnyone2 逐帧剪影 + SetLatentNoiseMask 只重绘人物，denoise=1 保证彻底换人。
 *
 * 用法：node build.mjs
 * 产物：workflow.ui.json（本目录）
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = join(HERE, 'templates/base_onepass.ui.json');

// ---------------- 可调常量 ----------------
const FRAMES = 107;        // 17k+5；24fps → 4.458s
const SKIP = 0;            // 从源片第几帧开始
const WIDTH = 864;         // 32 的倍数
const HEIGHT = 736;        // 32 的倍数
const SEED = 20261115;
const REF_FRAME = 100;     // 分割参考帧：必须是人物最大、最清晰的那帧
const GROW = 8;            // 剪影外扩像素
const OUT_PREFIX = 'joker02_shot1_silhouette';

// 平台 fileName（约 1 天过期，重传只换这里）
const ASSETS = {
  video: 'openapi/6ccbc766c8186c9bfcd459a8c522d0206154234353da62294120f1793ecdf4a8.mp4',
  renwu2_sheet: 'openapi/19bb73ad09adfd9035e0581c47ee07f594d8a7c4000f58b0f3da9cf171574aea.png',
};

const j = JSON.parse(readFileSync(BASE, 'utf8'));
const byId = new Map(j.nodes.map((n) => [n.id, n]));
let nextLink = j.last_link_id + 1;

const N = (id) => byId.get(id);
const outSlot = (id, slot, linkId) => {
  const o = N(id).outputs[slot];
  o.links = o.links || [];
  o.links.push(linkId);
};
const mkInput = (name, type, widget, link = null, shape) => {
  const i = { label: name, name, type };
  if (shape) i.shape = shape;
  if (widget) i.widget = { name };
  i.link = link;
  return i;
};
function connect(src, srcSlot, dst, dstInputName, type) {
  const id = nextLink++;
  const d = N(dst);
  const inp = d.inputs.find((x) => x.name === dstInputName);
  if (!inp) throw new Error(`#${dst} 没有输入 ${dstInputName}`);
  if (inp.link != null) throw new Error(`#${dst}.${dstInputName} 已有连线`);
  inp.link = id;
  outSlot(src, srcSlot, id);
  j.links.push([id, src, srcSlot, dst, d.inputs.indexOf(inp), type]);
}
function addNode(spec) {
  const n = {
    id: spec.id,
    type: spec.type,
    pos: spec.pos,
    size: spec.size,
    flags: {},
    order: j.nodes.length,
    mode: 0,
    inputs: spec.inputs,
    outputs: spec.outputs.map((o) => ({ label: o[0], name: o[0], type: o[1], links: [] })),
    properties: { 'Node name for S&R': spec.type, cnr_id: 'comfy-core', ver: '0.30.0', widget_ue_connectable: {} },
    widgets_values: spec.widgets,
  };
  if (spec.color) { n.color = spec.color; n.bgcolor = spec.bgcolor; }
  j.nodes.push(n);
  byId.set(n.id, n);
}

// ---- 基础节点参数 ----
N(8).widgets_values.video = ASSETS.video;
N(8).widgets_values.frame_load_cap = FRAMES;
N(8).widgets_values.skip_first_frames = SKIP;
N(9).widgets_values[0] = ASSETS.renwu2_sheet;
N(10).widgets_values[0] = readFileSync(join(HERE, 'prompt.txt'), 'utf8').trim();
N(11).widgets_values[0] = WIDTH;
N(13).widgets_values[0] = HEIGHT;
N(15).widgets_values[3] = FRAMES;
N(19).widgets_values[0] = SEED;
N(16).widgets_values[2] = 1;          // denoise=1：遮罩内彻底重绘

// ---- 断开 15.LATENT → 采样器 latent_image（改吃自建 AV 潜空间）----
const sampler = N(22);
const latentIn = sampler.inputs.find((x) => x.name === 'latent_image');
const oldLink = latentIn.link;
if (oldLink != null) {
  const l = j.links.find((x) => x[0] === oldLink);
  if (l) {
    const src = N(l[1]);
    src.outputs[l[2]].links = (src.outputs[l[2]].links || []).filter((x) => x !== oldLink);
    j.links = j.links.filter((x) => x[0] !== oldLink);
  }
  latentIn.link = null;
}

// ---- 潜空间：视频段 + 音频段 ----
addNode({
  id: 30, type: 'VAEEncode', pos: [1180, 900], size: [220, 60],
  inputs: [mkInput('pixels', 'IMAGE'), mkInput('vae', 'VAE')],
  outputs: [['LATENT', 'LATENT']], widgets: [],
});
addNode({
  id: 31, type: 'VAEEncodeAudio', pos: [1180, 1000], size: [220, 60],
  inputs: [mkInput('audio', 'AUDIO'), mkInput('vae', 'VAE')],
  outputs: [['LATENT', 'LATENT']], widgets: [],
});
addNode({
  id: 32, type: 'SolidMask', pos: [1180, 1120], size: [220, 110],
  inputs: [mkInput('value', 'FLOAT', true), mkInput('width', 'INT', true), mkInput('height', 'INT', true)],
  outputs: [['MASK', 'MASK']], widgets: [0, 32, 32],
});
addNode({
  id: 33, type: 'SetLatentNoiseMask', pos: [1450, 1000], size: [220, 60],
  inputs: [mkInput('samples', 'LATENT'), mkInput('mask', 'MASK')],
  outputs: [['LATENT', 'LATENT']], widgets: [],
});
addNode({
  id: 38, type: 'LTXVConcatAVLatent', pos: [1720, 1050], size: [240, 80],
  inputs: [mkInput('video_latent', 'LATENT'), mkInput('audio_latent', 'LATENT')],
  outputs: [['LATENT', 'LATENT']], widgets: [],
});

// ---- 逐帧剪影：SAM 单帧分割 → MatAnyone2 追踪 ----
addNode({
  id: 40, type: 'LayerMask: LoadSegmentAnythingModels', pos: [1180, 1300], size: [300, 90],
  inputs: [mkInput('sam_model', 'COMBO', true), mkInput('grounding_dino_model', 'COMBO', true)],
  outputs: [['sam_models', 'LS_SAM_MODELS']],
  widgets: ['sam_vit_h (2.56GB)', 'GroundingDINO_SwinT_OGC (694MB)'],
});
addNode({
  id: 41, type: 'RH_Translator', pos: [1180, 1430], size: [300, 140],
  inputs: [mkInput('prompt', 'STRING', true), mkInput('seed', 'INT', true), mkInput('advanced_options', 'COMBO', true, null, 7)],
  outputs: [['translation', 'STRING']],
  widgets: ['person', 601, 'auto'],
});
addNode({
  id: 42, type: 'ImageFromBatch+', pos: [1520, 1300], size: [240, 100],
  inputs: [mkInput('image', 'IMAGE'), mkInput('start', 'INT', true), mkInput('length', 'INT', true)],
  outputs: [['IMAGE', 'IMAGE']], widgets: [REF_FRAME, 1],
});
addNode({
  id: 43, type: 'LayerMask: SegmentAnythingUltra V3', pos: [1810, 1300], size: [330, 340],
  inputs: [
    mkInput('image', 'IMAGE'), mkInput('sam_models', 'LS_SAM_MODELS'),
    mkInput('threshold', 'FLOAT', true), mkInput('detail_method', 'COMBO', true),
    mkInput('detail_erode', 'INT', true), mkInput('detail_dilate', 'INT', true),
    mkInput('black_point', 'FLOAT', true), mkInput('white_point', 'FLOAT', true),
    mkInput('process_detail', 'BOOLEAN', true), mkInput('prompt', 'STRING', true),
    mkInput('device', 'COMBO', true), mkInput('max_megapixels', 'FLOAT', true),
  ],
  outputs: [['image', 'IMAGE'], ['mask', 'MASK']],
  widgets: [0.3, 'VITMatte', 6, 6, 0.15, 0.99, true, 'person', 'cuda', 2],
});
addNode({
  id: 44, type: 'PrimitiveInt', pos: [1520, 1440], size: [240, 60],
  inputs: [mkInput('value', 'INT', true)],
  outputs: [['INT', 'INT']], widgets: [REF_FRAME],
});
addNode({
  id: 45, type: 'MatAnyone2', pos: [2180, 1300], size: [300, 120],
  inputs: [
    mkInput('images', 'IMAGE'),
    mkInput('mask_frame_index', 'INT'),
    mkInput('invert_mask', 'BOOLEAN', true),
    mkInput('mask', 'MASK', false, null, 7),
  ],
  outputs: [['rgba_image', 'IMAGE'], ['alpha_mask', 'MASK']], widgets: [false],
});
addNode({
  id: 46, type: 'GrowMask', pos: [2180, 1480], size: [280, 100],
  inputs: [mkInput('mask', 'MASK'), mkInput('expand', 'INT', true), mkInput('tapered_corners', 'BOOLEAN', true)],
  outputs: [['MASK', 'MASK']], widgets: [GROW, true],
});
addNode({
  id: 39, type: 'SetLatentNoiseMask', pos: [2500, 1480], size: [220, 60],
  inputs: [mkInput('samples', 'LATENT'), mkInput('mask', 'MASK')],
  outputs: [['LATENT', 'LATENT']], widgets: [],
});

// ---- 连线 ----
connect(8, 0, 30, 'pixels', 'IMAGE');
connect(6, 0, 30, 'vae', 'VAE');
connect(8, 2, 31, 'audio', 'AUDIO');
connect(7, 0, 31, 'vae', 'VAE');
connect(31, 0, 33, 'samples', 'LATENT');
connect(32, 0, 33, 'mask', 'MASK');
connect(8, 0, 42, 'image', 'IMAGE');
connect(42, 0, 43, 'image', 'IMAGE');
connect(40, 0, 43, 'sam_models', 'LS_SAM_MODELS');
connect(41, 0, 43, 'prompt', 'STRING');
connect(8, 0, 45, 'images', 'IMAGE');
connect(44, 0, 45, 'mask_frame_index', 'INT');
connect(43, 1, 45, 'mask', 'MASK');
connect(45, 1, 46, 'mask', 'MASK');
connect(30, 0, 39, 'samples', 'LATENT');
connect(46, 0, 39, 'mask', 'MASK');
connect(39, 0, 38, 'video_latent', 'LATENT');
connect(33, 0, 38, 'audio_latent', 'LATENT');
connect(38, 0, 22, 'latent_image', 'LATENT');

// ---- 输出与配色 ----
N(25).widgets_values.filename_prefix = OUT_PREFIX;
for (const id of [11, 13]) {
  N(id).color = '#c0392b';
  N(id).bgcolor = '#5b1f1f';
}
N(11).title = '★ 改这里 · 出片宽（32 的倍数）';
N(13).title = '★ 改这里 · 出片高（32 的倍数）';

j.last_link_id = nextLink - 1;
j.nodes.forEach((n, i) => { n.order = i; });

writeFileSync(join(HERE, 'workflow.ui.json'), JSON.stringify(j, null, 1));
console.log(`workflow.ui.json：${j.nodes.length} 节点 / ${j.links.length} 连线`);
