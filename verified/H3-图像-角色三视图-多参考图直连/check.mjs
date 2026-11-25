#!/usr/bin/env node
/**
 * 自检：workflow.ui.json 结构 / 接线 / 上色 / 提示词契约 / 画幅。
 * 用法：node check.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const ui = JSON.parse(fs.readFileSync(path.join(ROOT, 'workflow.ui.json'), 'utf8'));
const errs = [];
const warns = [];

const byId = new Map(ui.nodes.map(n => [n.id, n]));
const linkById = new Map(ui.links.map(l => [l[0], l]));

// 1) LoadImage：必须 3 张且非空
const imgs = ui.nodes.filter(n => n.type === 'LoadImage');
if (imgs.length !== 3) errs.push(`LoadImage 数量应为 3，实际 ${imgs.length}`);
for (const n of imgs) {
  const v = (n.widgets_values || [])[0];
  if (!v) errs.push(`LoadImage ${n.id} image 为空`);
  if (v === 'example.png' || v === 'character.png') errs.push(`LoadImage ${n.id} 仍是占位图 ${v}`);
}

// 2) 每条 input 的 link 双向自洽
for (const n of ui.nodes) {
  (n.inputs || []).forEach((inp, idx) => {
    if (inp.link == null) return;
    const l = linkById.get(inp.link);
    if (!l) return errs.push(`节点 ${n.id} 输入 ${inp.name} 的 link ${inp.link} 不存在`);
    const [, srcId, srcSlot, dstId, dstSlot] = l;
    if (dstId !== n.id || dstSlot !== idx) errs.push(`link ${inp.link} 目标 ${dstId}:${dstSlot} ≠ ${n.id}:${idx}`);
    const src = byId.get(srcId);
    const out = src?.outputs?.[srcSlot];
    if (!out || !(out.links || []).includes(inp.link)) errs.push(`link ${inp.link} 源端未回指`);
  });
}

// 3) 上色
const red = ui.nodes.filter(n => n.color === '#c0392b').length;
const orange = ui.nodes.filter(n => n.color === '#d35400').length;
if (red < 1) errs.push('没有红色可改节点');
if (orange < 1) errs.push('没有橙色输出节点');
if (red >= 10) warns.push(`红色节点 ${red} 个，偏多（上限 10）`);

// 4) 提示词契约
const cond = ui.nodes.find(n => n.id === 164);
if (!cond) errs.push('缺少条件节点 164');
else {
  const p = (cond.widgets_values || [])[0] || '';
  for (const kw of ['three equal vertical panels', 'Left panel', 'Middle panel', 'Right panel', 'headless', 'back view', 'pure white']) {
    if (!p.includes(kw)) errs.push(`提示词缺关键词: ${kw}`);
  }
  const w = cond.widgets_values[1], h = cond.widgets_values[2];
  if (!(w % 32 === 0 && h % 32 === 0)) errs.push(`宽高必须 32 的倍数，当前 ${w}×${h}`);
  if (w * h > 6_000_000) warns.push(`面积 ${(w * h / 1e6).toFixed(2)}MP 偏大`);
  if (cond.inputs.filter(i => i.name.startsWith('images.') && i.link != null).length !== 3) errs.push('应恰好接 3 张参考图');
}

// 5) 必须有 SaveImage
if (!ui.nodes.some(n => n.type === 'SaveImage')) errs.push('缺少 SaveImage');

// 6) widgets_values 不能是裸字符串/数字
for (const n of ui.nodes) {
  if (n.type === 'MarkdownNote') continue;
  const wv = n.widgets_values;
  if (wv == null) continue;
  if (typeof wv === 'string' || typeof wv === 'number') errs.push(`节点 ${n.id} widgets_values 不是数组`);
}

console.log(`nodes=${ui.nodes.length} links=${ui.links.length} red=${red} orange=${orange}`);
if (warns.length) warns.forEach(w => console.log('WARN', w));
if (errs.length) { errs.forEach(e => console.log('ERROR', e)); process.exit(1); }
console.log('✓ 自检通过');
