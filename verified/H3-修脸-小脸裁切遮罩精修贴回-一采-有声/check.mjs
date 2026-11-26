/**
 * 自检：节点/连线/素材/参数/痕迹
 * 用法：node check.mjs [workflow.ui.json]
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] || join(HERE, 'workflow.ui.json');
if (!existsSync(file)) { console.log(`FAIL: 找不到 ${file}`); process.exit(1); }

const raw = readFileSync(file, 'utf8');
const j = JSON.parse(raw);
const nodes = j.nodes || [];
const links = j.links || [];
const byId = new Map(nodes.map((n) => [n.id, n]));
const linkMap = new Map(links.map((l) => [l[0], l]));
const errs = [];
const warns = [];

/* 1. 连线双向自洽 */
for (const n of nodes) {
  for (const i of n.inputs || []) {
    if (i.link == null) continue;
    const l = linkMap.get(i.link);
    if (!l) { errs.push(`#${n.id} ${i.name} 指向不存在的 link ${i.link}`); continue; }
    if (l[3] !== n.id) errs.push(`L${i.link} 目标不是 #${n.id}`);
  }
  for (const o of n.outputs || []) {
    for (const id of o.links || []) {
      const l = linkMap.get(id);
      if (!l) { errs.push(`#${n.id} 输出指向不存在的 link ${id}`); continue; }
      if (l[1] !== n.id) errs.push(`L${id} 源不是 #${n.id}`);
    }
  }
}
for (const l of links) {
  const s = byId.get(l[1]);
  const d = byId.get(l[3]);
  if (!s || !d) { errs.push(`L${l[0]} 端点缺失`); continue; }
  if (!(d.inputs[l[4]] || {}).link) errs.push(`L${l[0]} 目标输入未回指`);
  if (!((s.outputs[l[2]] || {}).links || []).includes(l[0])) errs.push(`L${l[0]} 源输出未回指`);
}

/* 2. 关键节点在位（按本包锁定的节点 ID） */
const NEED = {
  2: 'PrimitiveStringMultiline', 9: 'VHS_LoadVideo', 163: 'H3FaceTrackCrop',
  164: 'MiniMaxH3ReferenceToVideo', 175: 'BasicScheduler', 191: 'H3FaceStitch',
  192: 'VHS_VideoCombine', 241: 'MVEx_MaskToLatentSpace', 242: 'SetLatentNoiseMask',
  251: 'SolidMask', 252: 'SetLatentNoiseMask', 257: 'LoadImage', 261: 'TrimAudioDuration',
  263: 'PrimitiveFloat', 264: 'SAMLoader', 265: 'H3FaceMaskSAM',
  267: 'VHS_VideoCombine', 268: 'VHS_VideoCombine',
};
for (const [id, type] of Object.entries(NEED)) {
  const n = byId.get(Number(id));
  if (!n) errs.push(`缺节点 #${id}（${type}）`);
  else if (n.type !== type) errs.push(`#${id} 类型是 ${n.type}，应为 ${type}`);
}

/* 3. 素材槽位已预填 */
const vid = byId.get(9)?.widgets_values_named || byId.get(9)?.widgets_values || {};
if (!vid.video || !String(vid.video).endsWith('.mp4')) errs.push(`#9 视频未预填：${vid.video}`);
const img = byId.get(257)?.widgets_values_named?.image || (byId.get(257)?.widgets_values || [])[0];
if (!img || !String(img).startsWith('openapi/')) errs.push(`#257 参考图未填平台 fileName：${img}`);

/* 4. 关键参数 */
const denoise = (byId.get(175)?.widgets_values || [])[2];
if (denoise == null || denoise <= 0 || denoise > 1) errs.push(`#175 denoise 越界：${denoise}`);
const canvas = byId.get(163)?.widgets_values_named || {};
if (canvas.canvas_width !== 512 || canvas.canvas_height !== 512) {
  errs.push(`#163 画布不是 512×512：${canvas.canvas_width}×${canvas.canvas_height}`);
}
if (Number(canvas.crop_factor) < 2) warns.push(`#163 crop_factor=${canvas.crop_factor}，小于 2 会把脸裁掉`);

/* 5. 遮罩链：265 → 241（潜空间）/ 191（贴回）/ 266（验证） */
const m265 = byId.get(265);
const mLinks = m265?.outputs?.[0]?.links || [];
const targets = mLinks.map((id) => linkMap.get(id)).filter(Boolean).map((l) => l[3]);
for (const t of [241, 191, 266]) {
  if (!targets.includes(t)) errs.push(`#265 遮罩没有接到 #${t}`);
}
const stitchMasks = (byId.get(191)?.inputs || []).find((i) => i.name === 'masks');
if (stitchMasks?.link == null) errs.push('#191 masks 未接');

/* 6. 成片输出：画面 + 音轨都要接 */
const out192 = byId.get(192);
for (const name of ['images', 'audio']) {
  const i = (out192?.inputs || []).find((x) => x.name === name);
  if (!i || i.link == null) errs.push(`#192 缺少 ${name}`);
}
if ((out192?.widgets_values?.frame_rate) !== 24) errs.push(`#192 帧率不是 24：${out192?.widgets_values?.frame_rate}`);

/* 7. 广告/产物痕迹 */
for (const bad of ['cos_url', 'objectKey', 'fullpath', 'rh-comfyui01']) {
  if (raw.includes(bad)) errs.push(`残留平台产物痕迹：${bad}`);
}

/* 8. 配色 */
const red = nodes.filter((n) => n.color === '#c0392b');
const orange = nodes.filter((n) => n.color === '#d35400');
if (!red.length) errs.push('没有红色可改节点');
if (!orange.length) errs.push('没有橙色输出节点');
if (red.length > 9) warns.push(`红块 ${red.length} 个，超过 9 会失去指路作用`);

console.log(`节点 ${nodes.length} / 连线 ${links.length} / 红 ${red.length} 橙 ${orange.length}`);
if (warns.length) console.log('WARN:\n  ' + warns.join('\n  '));
if (errs.length) {
  console.log('FAIL:\n  ' + errs.join('\n  '));
  process.exit(1);
}
console.log('✓ 自检通过');
