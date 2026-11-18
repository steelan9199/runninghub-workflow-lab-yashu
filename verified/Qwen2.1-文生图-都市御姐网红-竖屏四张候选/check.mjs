/**
 * 交付自检：UI 图结构 + API 图引用 + 上色 + 提示词预填
 * 用法：node check.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ui = JSON.parse(readFileSync(join(HERE, 'workflow.ui.json'), 'utf8'));
const api = JSON.parse(readFileSync(join(HERE, 'workflow.api.json'), 'utf8'));

const errs = [];
const warns = [];

/* ---------- 1. 链接双向自洽 ---------- */
const linkById = new Map(ui.links.map((l) => [l[0], l]));
for (const n of ui.nodes) {
  for (const i of n.inputs) {
    if (i.link === null || i.link === undefined) continue;
    const l = linkById.get(i.link);
    if (!l) { errs.push(`${n.type}.${i.name}: link ${i.link} 不在 links 里`); continue; }
    if (l[3] !== n.id) errs.push(`${n.type}.${i.name}: link ${i.link} 指向节点 ${l[3]}，不是 ${n.id}`);
    const src = ui.nodes.find((x) => x.id === l[1]);
    if (!src) { errs.push(`link ${i.link} 的源节点 ${l[1]} 不存在`); continue; }
    if (!src.outputs[l[2]] || !src.outputs[l[2]].links.includes(l[0])) {
      errs.push(`link ${i.link}: 源 ${src.type}.outputs[${l[2]}] 没有回指该 link`);
    }
  }
  for (const o of n.outputs) {
    for (const lid of o.links || []) {
      const l = linkById.get(lid);
      if (!l) { errs.push(`${n.type} 输出槽引用了不存在的 link ${lid}`); continue; }
      if (l[1] !== n.id) errs.push(`${n.type}: link ${lid} 的源不是本节点`);
    }
  }
}

/* ---------- 2. 控件个数 ---------- */
for (const n of ui.nodes) {
  const wi = n.inputs.filter((i) => i.widget);
  if (!Array.isArray(n.widgets_values)) {
    // 无控件的节点（VAEDecode 这类）ComfyUI 本来就不写 widgets_values
    if (wi.length > 0) errs.push(`${n.type}: 有 ${wi.length} 个控件但缺 widgets_values`);
    else if (n.type === 'SaveImage') errs.push('SaveImage: 缺 widgets_values');
    continue;
  }
  const want = wi.length + (n.type === 'KSampler' ? 1 : 0);
  if (n.type === 'MarkdownNote') {
    if (n.widgets_values.length !== 1) errs.push('MarkdownNote: widgets_values 应为 1 项');
  } else if (n.widgets_values.length !== want) {
    errs.push(`${n.type}: widgets_values ${n.widgets_values.length} 项，按 /object_info 应为 ${want} 项`);
  }
}

/* ---------- 3. 输出节点 ---------- */
const saves = ui.nodes.filter((n) => n.type === 'SaveImage');
if (!saves.length) errs.push('没有 SaveImage');
for (const s of saves) {
  if (!s.inputs.find((i) => i.name === 'images')?.link) errs.push('SaveImage.images 没接线');
}
const outputs = Object.values(api).filter((n) => n.class_type === 'SaveImage');
if (!outputs.length) errs.push('API 图里没有 SaveImage');

/* ---------- 4. 上色 ---------- */
const reds = ui.nodes.filter((n) => n.color === '#c0392b');
const oranges = ui.nodes.filter((n) => n.color === '#d35400');
if (!reds.length) errs.push('没有红块（用户要改的参数）');
if (!oranges.length) errs.push('没有橙块（输出节点）');
if (reds.length > 6) warns.push(`红块 ${reds.length} 个，超过 6 个会失去指路作用`);
for (const n of reds) {
  if (n.bgcolor !== '#5b1f1f') errs.push(`${n.type}: 红块底色不是 #5b1f1f`);
  if (!String(n.title || '').startsWith('★')) errs.push(`${n.type}: 红块标题缺 ★ 前缀`);
}
for (const n of oranges) {
  if (n.bgcolor !== '#5a3208') errs.push(`${n.type}: 橙块底色不是 #5a3208`);
}

/* ---------- 5. 提示词预填 ---------- */
const enc = ui.nodes.find((n) => n.type === 'TextEncodeQwenImage21');
const prompt = enc?.widgets_values?.[0] || '';
if (prompt.length < 120) errs.push(`提示词只有 ${prompt.length} 字，像是占位没预填`);
for (const kw of ['挺立', '吊带', '深圳', '御姐']) {
  if (!prompt.includes(kw)) errs.push(`提示词缺关键词「${kw}」`);
}
if (/example\.png|在这里写/.test(JSON.stringify(ui))) errs.push('图里还有占位内容');

/* ---------- 6. 反广告 ---------- */
const banned = /aijuxi|艾橘溪|B站|抖音|小红书|公众号|邀请码|rh-[a-z0-9]{4,}/i;
const texts = [];
for (const n of ui.nodes) {
  texts.push(n.title || '', n.type);
  if (typeof n.widgets_values?.[0] === 'string' && n.type === 'SaveImage') texts.push(n.widgets_values[0]);
}
if (ui.nodes.some((n) => banned.test(n.title || ''))) errs.push('节点标题里有作者/频道标识');
if (JSON.stringify(ui.extra || {}).match(/cos_url|fullpath|objectKey/)) errs.push('extra 里残留运行记录');

/* ---------- 7. API 图引用 ---------- */
for (const [id, n] of Object.entries(api)) {
  for (const [k, v] of Object.entries(n.inputs || {})) {
    if (Array.isArray(v) && v.length === 2 && typeof v[0] === 'string') {
      if (!api[v[0]]) errs.push(`API ${n.class_type}.${k} 引用了不存在的节点 ${v[0]}`);
    }
  }
}

/* ---------- 8. 尺寸 ---------- */
const lat = ui.nodes.find((n) => n.type === 'EmptyLatentImage');
if (lat) {
  const [w, h, b] = lat.widgets_values;
  if (w % 16 || h % 16) errs.push(`画幅 ${w}x${h} 不是 16 的倍数`);
  if (Math.abs(w / h - 9 / 16) > 0.01) warns.push(`画幅比 ${(w / h).toFixed(3)} 偏离 9:16`);
  if (!(b >= 1)) errs.push('batch_size 不合法');
}

if (warns.length) console.log('[check] 提醒：\n - ' + warns.join('\n - '));
if (errs.length) {
  console.error('[check] 失败：\n - ' + errs.join('\n - '));
  process.exit(1);
}
console.log(`[check] ✓ 通过  nodes=${ui.nodes.length} links=${ui.links.length} 红=${reds.length} 橙=${oranges.length} 提示词=${prompt.length}字`);
