// 自检：接线自洽、节点不重叠、控件格式、红橙标记、提示词结构
// 用法：node check.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const fail = [];
const g = JSON.parse(fs.readFileSync(path.join(DIR, 'workflow.ui.json'), 'utf8'));
const byId = new Map(g.nodes.map((n) => [String(n.id), n]));

for (const n of g.nodes) {
  if (!n.type) fail.push(`node ${n.id} 缺 type`);
  if (n.widgets_values != null && !Array.isArray(n.widgets_values)) fail.push(`node ${n.id} widgets_values 不是数组`);
}

for (const [id, oid, os, tid, ts] of g.links) {
  const o = byId.get(String(oid));
  const t = byId.get(String(tid));
  if (!o || !t) { fail.push(`link ${id} 指向不存在的节点`); continue; }
  if (!(o.outputs?.[os]?.links || []).includes(id)) fail.push(`link ${id} 未登记在源节点 outputs`);
  if (t.inputs?.[ts]?.link !== id) fail.push(`link ${id} 目标槽位不匹配`);
}

const r = g.nodes.map((n) => [n.pos[0], n.pos[1], n.pos[0] + n.size[0], n.pos[1] + n.size[1], n.id]);
for (let i = 0; i < r.length; i++) {
  for (let k = i + 1; k < r.length; k++) {
    const a = r[i], b = r[k];
    if (a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]) fail.push(`节点重叠 ${a[4]} <-> ${b[4]}`);
  }
}

const red = g.nodes.filter((n) => n.color === '#c0392b');
const orange = g.nodes.filter((n) => n.color === '#d35400');
if (!red.length) fail.push('没有红色可改节点');
if (!orange.length) fail.push('没有橙色输出节点');

const h3 = byId.get('5');
const prompt = h3.widgets_values[0];
for (const s of ['[Shot 1]', '[Shot 2] At 00:', '[Shot 3] At 00:', '<d>[Chinese]']) {
  if (!prompt.includes(s)) fail.push(`提示词缺结构标记 ${s}`);
}
const frames = h3.widgets_values[3];
if (frames < 124 || frames > 362) fail.push(`length ${frames} 超出训练区间 124–362`);

if (fail.length) {
  console.error('FAIL');
  for (const f of fail) console.error(' - ' + f);
  process.exit(1);
}
console.log(`PASS nodes=${g.nodes.length} links=${g.links.length} red=${red.length} orange=${orange.length} frames=${frames} (${(frames / 24).toFixed(3)}s)`);
