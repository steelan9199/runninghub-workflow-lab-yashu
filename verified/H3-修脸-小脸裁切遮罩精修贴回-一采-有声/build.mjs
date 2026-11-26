/**
 * 生成器：templates/base.json → workflow.ui.json
 * 只做三件事：清平台/作者痕迹、落常量、不动接线与控件顺序。
 *
 * 用法：node build.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/* ---------------- 四个常量：换片子只改这里 ---------------- */
const VIDEO_FILE = '4a757e9b4b30be2744124e542e8b9733250d7b1325fd107514b067c99a146426.mp4'; // 节点 9，平台 fileName
const FACE_REF_FILE = 'openapi/acb32efc61d32b05d06eada8a76dda5e5ba00776fb72b755314ea2c38bfacbc3.png'; // 节点 257
const DENOISE = 0.25;   // 节点 175：1 = 全重绘（换脸彻底、表情丢）；0.25 = 保原片表情与几何
const CANVAS = 512;     // 节点 163：裁脸画布

/* 平台/作者痕迹：整块清掉（SKILL.md §4.0） */
const EXTRA_DROP = [
  'pixaromaGroups',
  'xzgGroups',
  '0246.VERSION',
  'KKvideo_latentpreview',
  'KKvideo_latentpreviewrate',
  'ue_links',
  'links_added_by_ue',
];

const j = JSON.parse(readFileSync(join(HERE, 'templates', 'base.json'), 'utf8'));

for (const k of EXTRA_DROP) {
  if (j.extra) delete j.extra[k];
}

const byId = new Map(j.nodes.map((n) => [n.id, n]));

/** 清掉 videopreview 里的产物地址（cos_url / fullpath / objectKey / workflow） */
function scrubPreview(obj) {
  if (!obj || typeof obj !== 'object' || !obj.videopreview) return obj;
  obj.videopreview = { paused: !!obj.videopreview.paused, hidden: !!obj.videopreview.hidden, params: {} };
  return obj;
}

for (const n of j.nodes) {
  if (n.widgets_values && !Array.isArray(n.widgets_values)) scrubPreview(n.widgets_values);
  if (n.widgets_values_named) scrubPreview(n.widgets_values_named);
}

/** 同时写数组与命名两种控件值，避免新旧前端取值不一致 */
function setWidget(n, key, val) {
  if (n.widgets_values_named && key in n.widgets_values_named) n.widgets_values_named[key] = val;
  if (Array.isArray(n.widgets_values) && n.widgets_values_named) {
    const names = Object.keys(n.widgets_values_named);
    const idx = names.indexOf(key);
    if (idx >= 0 && idx < n.widgets_values.length) n.widgets_values[idx] = val;
  }
}

setWidget(byId.get(9), 'video', VIDEO_FILE);
setWidget(byId.get(257), 'image', FACE_REF_FILE);
setWidget(byId.get(175), 'denoise', DENOISE);
setWidget(byId.get(163), 'canvas_width', CANVAS);
setWidget(byId.get(163), 'canvas_height', CANVAS);

const out = join(HERE, 'workflow.ui.json');
writeFileSync(out, JSON.stringify(j, null, 2));

console.log(`✓ workflow.ui.json  节点 ${j.nodes.length} / 连线 ${j.links.length}`);
console.log(`  9  视频   ${VIDEO_FILE}`);
console.log(`  257 参考图 ${FACE_REF_FILE}`);
console.log(`  175 denoise ${DENOISE}`);
console.log(`  163 canvas  ${CANVAS}×${CANVAS}`);
