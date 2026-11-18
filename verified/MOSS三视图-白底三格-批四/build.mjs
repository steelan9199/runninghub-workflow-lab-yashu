/**
 * MOSS-Image 布局三视图 · 1728×768 三格
 * 接线来源：corpus/wf_2112398936735576066.json（MOSS 布局图文生图，线上实测）
 *   UNET moss_image_sft_bf16 → LoRA KOOK-MOSS-SFT-观澜 → AttentionBackend → SkipLayer → KSampler(8步/cfg2.5/er_sde)
 *   CLIP qwen3.5_9b_qwen_image_2.1_pe_t2i (type=moss_image)
 *   CreateBoundingBoxes → MOSSImageLayoutPrompt → CLIPTextEncode(positive)
 *   EmptyFlux2LatentImage → KSampler → VAEDecode → SaveImage
 * 用法：node build.mjs
 */
import { writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const W = 1728, H = 768, BATCH = 4, SEED = 20261124, STEPS = 8, CFG = 1.1, SAMPLER = 'euler', SCHEDULER = 'simple';

// ---------------- 三格框 ----------------
const BOXES = [
  { x: 24, y: 24, width: 528, height: 430, text: '左格头像特写：正面头部与双肩，画面下缘正好落在肩线，肩线以下即出画，不出现胸口、手臂与裙身；黑色大波浪长卷发，心形脸，眼尾上扬，浆果红唇，黑色中圆领针织长裙的肩部与领口。' },
  { x: 600, y: 120, width: 528, height: 624, text: '中格服装正面：只有躯干与双腿，从肩线开始向下，没有头部、没有头发、没有脖颈、没有脸部区域；黑色中圆领针织修身长裙，收腰包身，裙长到膝下，黑色薄丝袜，黑色过膝长靴，双手自然垂在身侧，双脚踩地。' },
  { x: 1176, y: 24, width: 528, height: 720, text: '右格背面全身：同一套服装，完整带头与黑色大波浪长卷发，看不到面部五官；背面收腰贴合臀线，裙长到膝下，黑色薄丝袜与黑色过膝长靴。' },
].map((b) => ({ metadata: { palette: [], text: b.text, type: 'character', desc: '' }, x: b.x, y: b.y, width: b.width, height: b.height }));

const OVERALL = '真实摄影，纯白背景 #FFFFFF，角色三视图设定图，横向三格等宽排列：最左是肩线以上的头像特写，中间是只有躯干与双腿的服装正面，最右是带头与长发的背面全身。三格同一位人物、同一套服装、同一双鞋、同一光线，人物对齐同一脚底线；格与格之间没有分隔线、没有文字、没有编号、没有水印。人物：约 27 岁的中国女性，暖白皮肤，心形脸，眼尾上扬，黑色大波浪长卷发，眼线拉长，浆果红唇，穿黑色中圆领针织修身长裙、黑色薄丝袜、黑色过膝长靴。质感：真实皮肤纹理，针织与皮革细节清晰，无描边、无插画感。';
const NEG = 'nsfw, blurry, grey face, grey mask, faceless, mannequin head, deformed hands, extra fingers, fused limbs, bad anatomy, watermark, garbled text, jpeg,';
const FULL = '真实摄影，纯白背景 #FFFFFF，角色三视图设定图，整张画布横向三等分，从左到右依次三格，三格等宽，格与格之间没有分隔线、没有文字、没有编号、没有水印。三格同一位人物、同一套服装、同一双鞋、同一光线，人物对齐同一脚底线。\n\n人物：约 28 岁的中国女性，冷白皮肤，长鹅蛋脸，凤眼上挑，黑色低马尾垂到肩，裸妆，哑光豆沙唇，穿白色衬衫、黑色高腰包臀铅笔裙、黑色薄丝袜、黑色尖头细高跟。\n\n左格：正面头像特写，只出现头部与双肩，肩线以下即出画，不出现胸口、手臂与裙身，头像明显大于中格与右格。\n\n中格：同一套服装的正面，只有躯干与双腿，从肩线开始向下，没有头部、没有头发、没有脖颈、没有脸部区域，白衬衫领口在画面顶部清晰可见，双脚踩地。\n\n右格：背面全身，完整带头与黑色低马尾，看不到面部五官，衬衫与包臀裙背面平顺，裙摆与鞋完整入画。\n\n质感：真实皮肤纹理，棉布与丝袜细节清晰，无描边、无插画感。';

const nodes = [
  { key: 'unet', type: 'UNETLoader', title: '底座 · MOSS-Image SFT int8', pos: [0, 0], size: [400, 100],
    inputs: [{ name: 'unet_name', type: 'COMBO', widget: 'unet_name' }, { name: 'weight_dtype', type: 'COMBO', widget: 'weight_dtype' }],
    outputs: [{ name: 'MODEL', type: 'MODEL' }],
    widgets: ['moss_image_sft_int8_convrot.safetensors', 'default'] },

  { key: 'lora', type: 'LoraLoaderModelOnly', title: 'LoRA · Base 8-steps DMD', pos: [0, 160], size: [400, 110],
    inputs: [{ name: 'model', type: 'MODEL' }, { name: 'lora_name', type: 'COMBO', widget: 'lora_name' }, { name: 'strength_model', type: 'FLOAT', widget: 'strength_model' }],
    outputs: [{ name: 'MODEL', type: 'MODEL' }],
    widgets: ['MOSS-Image-Base-8-steps-dmd.safetensors', 1] },

  { key: 'clip', type: 'CLIPLoader', title: '文本编码器 · Qwen3.5 9B w4a8 (moss_image)', pos: [0, 330], size: [400, 130],
    inputs: [{ name: 'clip_name', type: 'COMBO', widget: 'clip_name' }, { name: 'type', type: 'COMBO', widget: 'type' }, { name: 'device', type: 'COMBO', widget: 'device' }],
    outputs: [{ name: 'CLIP', type: 'CLIP' }],
    widgets: ['qwen3.5_9b_w4a8_gptq.safetensors', 'moss_image', 'default'] },

  { key: 'vae', type: 'VAELoader', title: 'VAE · Flux2', pos: [0, 520], size: [400, 80],
    inputs: [{ name: 'vae_name', type: 'COMBO', widget: 'vae_name' }],
    outputs: [{ name: 'VAE', type: 'VAE' }],
    widgets: ['flux2-vae.safetensors'] },

  { key: 'pos', type: 'CLIPTextEncode', title: '★ 改这里 · 三格整段提示词', red: true, pos: [460, 0], size: [640, 520],
    inputs: [{ name: 'text', type: 'STRING' }, { name: 'clip', type: 'CLIP' }],
    outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING' }],
    widgets: [FULL] },

  { key: 'neg', type: 'CLIPTextEncode', title: '负向', pos: [460, 580], size: [640, 160],
    inputs: [{ name: 'text', type: 'STRING', widget: 'text' }, { name: 'clip', type: 'CLIP' }],
    outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING' }],
    widgets: [NEG] },

  { key: 'latent', type: 'EmptyFlux2LatentImage', title: '★ 改这里 · 画幅与张数', red: true, pos: [1140, 440], size: [400, 130],
    inputs: [{ name: 'width', type: 'INT', widget: 'width' }, { name: 'height', type: 'INT', widget: 'height' }, { name: 'batch_size', type: 'INT', widget: 'batch_size' }],
    outputs: [{ name: 'LATENT', type: 'LATENT' }],
    widgets: [W, H, BATCH] },

  { key: 'ks', type: 'KSampler', title: '★ 改这里 · 种子', red: true, pos: [1140, 610], size: [420, 260],
    inputs: [{ name: 'model', type: 'MODEL' }, { name: 'seed', type: 'INT', widget: 'seed' }, { name: 'steps', type: 'INT', widget: 'steps' }, { name: 'cfg', type: 'FLOAT', widget: 'cfg' }, { name: 'sampler_name', type: 'COMBO', widget: 'sampler_name' }, { name: 'scheduler', type: 'COMBO', widget: 'scheduler' }, { name: 'positive', type: 'CONDITIONING' }, { name: 'negative', type: 'CONDITIONING' }, { name: 'latent_image', type: 'LATENT' }, { name: 'denoise', type: 'FLOAT', widget: 'denoise' }],
    outputs: [{ name: 'LATENT', type: 'LATENT' }],
    widgets: [SEED, 'randomize', STEPS, CFG, SAMPLER, SCHEDULER, 1] },

  { key: 'vdec', type: 'VAEDecode', title: 'VAE 解码', pos: [1600, 0], size: [240, 60],
    inputs: [{ name: 'samples', type: 'LATENT' }, { name: 'vae', type: 'VAE' }],
    outputs: [{ name: 'IMAGE', type: 'IMAGE' }] },

  { key: 'save', type: 'SaveImage', title: '输出', orange: true, pos: [1600, 120], size: [340, 300],
    inputs: [{ name: 'images', type: 'IMAGE' }, { name: 'filename_prefix', type: 'STRING', widget: 'filename_prefix' }],
    outputs: [{ name: 'image_urls', type: 'STRING' }, { name: 'images', type: 'IMAGE' }],
    widgets: ['moss_threeview'] },

  { key: 'note', type: 'MarkdownNote', title: '说明', pos: [1600, 460], size: [520, 560],
    inputs: [], outputs: [], widgets: [''] },
];

const wires = [
  ['unet', 0, 'lora', 'model'],
  ['lora', 0, 'ks', 'model'],
  ['clip', 0, 'pos', 'clip'],
  ['clip', 0, 'neg', 'clip'],
  ['latent', 0, 'ks', 'latent_image'],
  ['pos', 0, 'ks', 'positive'],
  ['neg', 0, 'ks', 'negative'],
  ['ks', 0, 'vdec', 'samples'],
  ['vae', 0, 'vdec', 'vae'],
  ['vdec', 0, 'save', 'images'],
];

const note = `## MOSS 三视图（纯文生图版）· 1728×768

**红块 = 你要改的**：正向整段提示词、画幅、种子。
**橙块 = 输出**。

### 这一版没有布局节点
没有 Create Bounding Boxes，也没有 MOSSImageLayoutPrompt。三格版式与左格裁切全靠一段提示词，出图更容易跑偏——左格可能又掉到胸口。

### 当前默认参数
- 画幅 1728×768，每格 576×768（16 的倍数）
- base int8 SFT + Base 8-steps DMD LoRA，8 步 / cfg 1.1 / euler / simple
- batch 1；要一次四张把 Empty Flux 2 Latent 的 batch_size 改 4，小卡会 OOM

### 换角色
只改正向提示词里的「人物：」一行和左/中/右三段的服装描述，三段不要分头改衣。

### 画幅改三处
1. \`Empty Flux 2 Latent\` 的 width/height；
2. 正向提示词里没写画幅，不需要改；
3. 若要换比例（如每格更方），提醒：整图宽度必须是 3 的倍数且是 16 的倍数，1728 已满足。

需要框版本时，同目录 \`workflow_布局版备份.ui.json\` 就是上一版。`;

nodes.find((n) => n.key === 'note').widgets = [note];

// ---------------- 生成 UI ----------------
const byKey = new Map();
const uiNodes = [];
let id = 0;
for (const spec of nodes) {
  id += 1;
  const n = {
    id, type: spec.type, pos: spec.pos, size: spec.size, flags: {}, order: 0, mode: 0,
    inputs: spec.inputs.map((i) => (i.widget ? { name: i.name, type: i.type, widget: { name: i.widget }, link: null } : { name: i.name, type: i.type, link: null })),
    outputs: spec.outputs.map((o) => ({ name: o.name, type: o.type, links: [] })),
    properties: { 'Node name for S&R': spec.type },
  };
  if (spec.title) n.title = spec.title;
  if (spec.red) { n.color = '#c0392b'; n.bgcolor = '#5b1f1f'; }
  if (spec.orange) { n.color = '#d35400'; n.bgcolor = '#5a3208'; }
  if (spec.widgets !== undefined) n.widgets_values = spec.widgets;
  byKey.set(spec.key, { spec, node: n });
  uiNodes.push({ key: spec.key, node: n });
}

const links = [];
let lid = 0;
for (const [srcKey, srcSlot, dstKey, dstName] of wires) {
  const s = byKey.get(srcKey).node;
  const d = byKey.get(dstKey).node;
  const so = s.outputs[srcSlot];
  const di = d.inputs.findIndex((i) => i.name === dstName);
  if (!so || di < 0) throw new Error(`接线失败 ${srcKey}.${srcSlot} → ${dstKey}.${dstName}`);
  lid += 1;
  links.push([lid, s.id, srcSlot, d.id, di, so.type]);
  so.links.push(lid);
  d.inputs[di].link = lid;
}

const indeg = new Map(uiNodes.map((o) => [o.node.id, 0]));
const adj = new Map(uiNodes.map((o) => [o.node.id, []]));
for (const l of links) { adj.get(l[1]).push(l[3]); indeg.set(l[3], indeg.get(l[3]) + 1); }
const q = uiNodes.filter((o) => indeg.get(o.node.id) === 0).map((o) => o.node.id);
const order = [];
while (q.length) { const nid = q.shift(); order.push(nid); for (const nx of adj.get(nid)) { indeg.set(nx, indeg.get(nx) - 1); if (indeg.get(nx) === 0) q.push(nx); } }
if (order.length !== uiNodes.length) throw new Error('接线有环');
const orderMap = new Map(order.map((nid, i) => [nid, i]));
for (const o of uiNodes) o.node.order = orderMap.get(o.node.id);

const ui = { id: randomUUID(), revision: 0, last_node_id: id, last_link_id: lid, nodes: uiNodes.map((o) => o.node), links, groups: [], config: {}, extra: { ds: { scale: 0.6, offset: [40, 40] } }, version: 0.4 };

// ---------------- API ----------------
const api = {};
for (const { spec } of byKey.values()) {
  if (spec.type === 'MarkdownNote') continue;
  const inputs = {};
  let wi = 0;
  for (const i of spec.inputs) {
    const w = wires.find((x) => x[2] === spec.key && x[3] === i.name);
    if (w) { inputs[i.name] = [String(byKey.get(w[0]).node.id), w[1]]; }
    else if (i.widget) {
      const v = spec.widgets[wi]; wi += 1;
      inputs[i.name] = (spec.type === 'KSampler' && i.name === 'seed') ? v : v;
    }
  }
  if (spec.type === 'KSampler') {
    inputs.seed = spec.widgets[0]; inputs.steps = spec.widgets[2]; inputs.cfg = spec.widgets[3];
    inputs.sampler_name = spec.widgets[4]; inputs.scheduler = spec.widgets[5]; inputs.denoise = spec.widgets[6];
  }
  api[String(byKey.get(spec.key).node.id)] = { class_type: spec.type, inputs, _meta: { title: spec.title } };
}

// ---------------- 自检 ----------------
const errs = [];
const linkById = new Map(ui.links.map((l) => [l[0], l]));
for (const n of ui.nodes) {
  for (const i of n.inputs) {
    if (i.link === null) continue;
    const l = linkById.get(i.link);
    if (!l || l[3] !== n.id) errs.push(`${n.type}.${i.name} 连线不自洽`);
    else { const s = ui.nodes.find((x) => x.id === l[1]); if (!s.outputs[l[2]].links.includes(l[0])) errs.push(`${n.type}.${i.name} 源未回指`); }
  }
}
const reds = ui.nodes.filter((n) => n.color === '#c0392b').length;
const oranges = ui.nodes.filter((n) => n.color === '#d35400').length;
if (!reds || !oranges) errs.push('缺红块或橙块');
if (errs.length) { console.error('[build] 失败:\n' + errs.join('\n')); process.exit(1); }

writeFileSync(join(HERE, 'workflow.ui.json'), JSON.stringify(ui, null, 1));
writeFileSync(join(HERE, 'workflow.api.json'), JSON.stringify(api, null, 1));
console.log(`[build] ok nodes=${ui.nodes.length} links=${links.length} red=${reds} orange=${oranges} ${W}x${H}`);
