/**
 * 姿势提取 · 视频 → 骨架视频（DWPose）· UI 工作流生成器
 *
 * 链路：VHS_LoadVideo（全帧）→ DWPreprocessor（DWPose 骨骼）→ ImageScale（拉回源片宽高）→ VHS_VideoCombine（无声 mp4）
 * 产物宽高 / 帧率与源片一致；无音轨。
 *
 * 用法：node build.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = join(HERE, 'templates/base_onepass.ui.json');   // 只借 VHS 两个节点的真实 schema

const WIDTH = 864;      // 出片宽 = 源片宽（红色，换片时改）
const HEIGHT = 736;     // 出片高 = 源片高
const FPS = 24;         // 出片帧率 = 源片帧率
const DETECT_RES = 1024;
const OUT_PREFIX = 'skeleton_joker02';

// 平台 fileName（约 24 小时过期，重传只换这里）
const VIDEO = 'openapi/6ccbc766c8186c9bfcd459a8c522d0206154234353da62294120f1793ecdf4a8.mp4';

const TPL = new Map();
for (const n of JSON.parse(readFileSync(BASE, 'utf8')).nodes) {
  if (!TPL.has(n.type)) TPL.set(n.type, n);
}

// 从模板克隆一个节点，清掉旧连线/配色/预览
function clone(type, spec) {
  const t = TPL.get(type);
  if (!t) throw new Error(`模板里没有 ${type}`);
  const n = JSON.parse(JSON.stringify(t));
  Object.assign(n, {
    id: spec.id,
    type,
    order: spec.order ?? 0,
    mode: 0,
    flags: {},
    pos: [spec.x, spec.y],
    size: spec.size ?? t.size,
  });
  if (spec.title) n.title = spec.title; else delete n.title;
  delete n.color;
  delete n.bgcolor;
  if (spec.red) { n.color = '#c0392b'; n.bgcolor = '#5b1f1f'; }
  if (spec.orange) { n.color = '#d35400'; n.bgcolor = '#5a3208'; }
  delete n.widgets_values_named;
  if (n.properties) {
    delete n.properties.ttNbgOverride;
    delete n.properties.widget_ue_connectable;
  }
  for (const i of n.inputs || []) i.link = null;
  for (const o of n.outputs || []) o.links = [];
  if (spec.widgets !== undefined) {
    if (spec.widgets && typeof spec.widgets === 'object' && !Array.isArray(spec.widgets)
      && n.widgets_values && typeof n.widgets_values === 'object' && !Array.isArray(n.widgets_values)) {
      n.widgets_values = { ...n.widgets_values, ...spec.widgets };
      delete n.widgets_values.videopreview;
    } else {
      n.widgets_values = spec.widgets;
    }
  }
  return n;
}

// ---------- 节点 ----------
const nodes = [
  clone('VHS_LoadVideo', {
    id: 1, order: 0, x: 0, y: 0, size: [440, 520], red: true,
    title: '★ 改这里 · 源片（要提骨骼的视频）',
    widgets: { video: VIDEO, force_rate: 0, frame_load_cap: 0, skip_first_frames: 0, select_every_nth: 1, format: 'AnimateDiff' },
  }),
  // DWPose 骨骼
  {
    id: 2, type: 'DWPreprocessor', order: 1, mode: 0, flags: {},
    pos: [500, 0], size: [340, 380],
    title: '★ 改这里 · DWPose 提骨骼（手部开 / 脸部关）',
    color: '#c0392b', bgcolor: '#5b1f1f',
    inputs: [
      { name: 'image', type: 'IMAGE', link: null },
      { name: 'detect_hand', type: 'COMBO', widget: { name: 'detect_hand' }, link: null },
      { name: 'detect_body', type: 'COMBO', widget: { name: 'detect_body' }, link: null },
      { name: 'detect_face', type: 'COMBO', widget: { name: 'detect_face' }, link: null },
      { name: 'resolution', type: 'INT', widget: { name: 'resolution' }, link: null },
      { name: 'bbox_detector', type: 'COMBO', widget: { name: 'bbox_detector' }, link: null },
      { name: 'pose_estimator', type: 'COMBO', widget: { name: 'pose_estimator' }, link: null },
      { name: 'scale_stick_for_xinsr_cn', type: 'COMBO', widget: { name: 'scale_stick_for_xinsr_cn' }, link: null },
    ],
    outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [] }],
    properties: { 'Node name for S&R': 'DWPreprocessor' },
    // 顺序必须与节点真实定义一致（image 之后：hand, body, face, resolution, bbox, pose_estimator, scale_stick）
    widgets_values: ['enable', 'enable', 'disable', DETECT_RES, 'yolox_l.onnx', 'dw-ll_ucoco_384.onnx', 'disable'],
  },
  // 拉回源片宽高
  {
    id: 3, type: 'ImageScale', order: 2, mode: 0, flags: {},
    pos: [500, 420], size: [340, 180],
    title: '拉回源片宽高（与输入等大）',
    inputs: [
      { name: 'image', type: 'IMAGE', link: null },
      { name: 'upscale_method', type: 'COMBO', widget: { name: 'upscale_method' }, link: null },
      { name: 'width', type: 'INT', widget: { name: 'width' }, link: null },
      { name: 'height', type: 'INT', widget: { name: 'height' }, link: null },
      { name: 'crop', type: 'COMBO', widget: { name: 'crop' }, link: null },
    ],
    outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [] }],
    properties: { 'Node name for S&R': 'ImageScale' },
    widgets_values: ['lanczos', WIDTH, HEIGHT, 'disabled'],
  },
  clone('VHS_VideoCombine', {
    id: 4, order: 3, x: 900, y: 0, size: [360, 420], orange: true,
    title: '输出骨架视频（无声 mp4，同宽高同帧率）',
    widgets: {
      frame_rate: FPS, filename_prefix: OUT_PREFIX, format: 'video/h264-mp4',
      pix_fmt: 'yuv420p', crf: 18, save_output: true, save_metadata: true, trim_to_audio: false,
    },
  }),
  {
    id: 5, type: 'MarkdownNote', order: 4, mode: 0, flags: {}, pos: [900, 450], size: [480, 520],
    title: '说明',
    inputs: [], outputs: [],
    properties: {},
    widgets_values: [`## 姿势提取 · 视频 → 骨架视频（DWPose）

**红块 = 你要改的**：源片、DWPose 参数、宽高。**橙块 = 输出**。

### 它做什么
逐帧跑 DWPose，把每一帧画成黑底彩色骨骼，再拉回**源片宽高**，按**源片帧率**输出无声 mp4。
产物直接当 H3 的参考视频用（H3 没有姿势输入口，这是它能接受姿势的唯一通道）。

### 默认参数
- 源片：已预填，全帧读取（\`frame_load_cap=0\`）。
- DWPose：body \`enable\` / hand \`enable\` / face \`disable\`。
  手部开是因为这段是跳舞；脸部关是因为脸的关键点会糊成一团，头的朝向靠鼻/眼/耳三点已经够了。
- 出片：${WIDTH}×${HEIGHT} / ${FPS}fps / 无音轨。换片时把宽高改成新源片的宽高。
- \`resolution=${DETECT_RES}\`：检测分辨率，调高更准但更慢。

### 已知限制
1. 检测不到人的帧（远景小人、大幅失焦）会输出纯黑帧，属于正常，不是接线错。
2. 328 帧逐帧检测较慢，先拿一条短片段试跑再跑整条。
3. 骨架视频本身不含原片画面；如果你想让 H3 同时看到背景，需要另做一条"原片+骨骼叠加"的版本。
4. 素材 \`fileName\` 约 24 小时过期，重新上传后改节点里的视频名即可，接线不动。`],
  },
];

// ---------- 连线 ----------
const links = [];
let lid = 0;
function wire(from, fromSlot, to, toName) {
  const s = nodes.find((n) => n.id === from);
  const d = nodes.find((n) => n.id === to);
  const si = s.outputs[fromSlot];
  const di = d.inputs.findIndex((i) => i.name === toName);
  if (!si) throw new Error(`#${from} 没有输出槽 ${fromSlot}`);
  if (di < 0) throw new Error(`#${to} 没有输入 ${toName}`);
  lid += 1;
  links.push([lid, from, fromSlot, to, di, si.type]);
  si.links.push(lid);
  d.inputs[di].link = lid;
}
wire(1, 0, 2, 'image');    // 视频帧 → DWPose
wire(2, 0, 3, 'image');    // 骨骼 → 缩放
wire(3, 0, 4, 'images');   // 缩放 → 合成

// order 按链路排
const orderMap = new Map([[1, 0], [2, 1], [3, 2], [4, 3], [5, 4]]);
for (const n of nodes) n.order = orderMap.get(n.id);

const doc = {
  id: randomUUID(),
  revision: 0,
  last_node_id: 5,
  last_link_id: lid,
  nodes,
  links,
  groups: [],
  config: {},
  extra: { ds: { scale: 0.6, offset: [400, 300] } },
  version: 0.4,
};

writeFileSync(join(HERE, 'workflow.ui.json'), JSON.stringify(doc, null, 1));
console.log(`workflow.ui.json  nodes=${nodes.length} links=${links.length} ${WIDTH}x${HEIGHT} ${FPS}fps 无音轨`);
