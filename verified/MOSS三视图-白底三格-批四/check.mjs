/**
 * 契约自检：node check.mjs
 * 只校验"这一版交付的硬约束"，不重复 build 的逻辑。
 */
import { readFileSync } from 'node:fs';

const ui = JSON.parse(readFileSync(new URL('./workflow.ui.json', import.meta.url), 'utf8'));
const errs = [];

const types = ui.nodes.map((n) => n.type);
const node = (t) => ui.nodes.find((n) => n.type === t);

if (ui.nodes.length !== 11) errs.push(`节点数应为 11，实际 ${ui.nodes.length}`);
if (ui.links.length !== 10) errs.push(`连线数应为 10，实际 ${ui.links.length}`);
for (const bad of ['CreateBoundingBoxes', 'MOSSImageLayoutPrompt']) {
  if (types.includes(bad)) errs.push(`不应包含 ${bad}`);
}

const latent = node('EmptyFlux2LatentImage');
if (!latent) errs.push('缺少 EmptyFlux2LatentImage');
else {
  const [w, h, b] = latent.widgets_values;
  if (w !== 1728 || h !== 768) errs.push(`画幅应为 1728×768，实际 ${w}×${h}`);
  if (b !== 4) errs.push(`batch 应为 4，实际 ${b}`);
}

const ks = node('KSampler');
if (!ks) errs.push('缺少 KSampler');
else {
  const [seed, ctrl, steps, cfg, sampler, sched] = ks.widgets_values;
  if (steps !== 8) errs.push(`steps 应为 8，实际 ${steps}`);
  if (cfg !== 1.1) errs.push(`cfg 应为 1.1，实际 ${cfg}`);
  if (sampler !== 'euler' || sched !== 'simple') errs.push(`采样应为 euler/simple，实际 ${sampler}/${sched}`);
  if (typeof seed !== 'number') errs.push('seed 应为数字');
  if (ctrl !== 'randomize') errs.push('seed 控制应为 randomize');
}

const pos = ui.nodes.filter((n) => n.type === 'CLIPTextEncode')[0];
const text = pos && pos.widgets_values[0];
if (!text) errs.push('缺少正向提示词');
else {
  for (const k of ['左格', '中格', '右格', '肩线', '没有头部', '纯白背景', '同一套服装']) {
    if (!text.includes(k)) errs.push(`正向提示词缺关键词「${k}」`);
  }
  if (text.length < 300) errs.push(`正向提示词过短（${text.length} 字）`);
}

const neg = ui.nodes.filter((n) => n.type === 'CLIPTextEncode')[1];
if (!neg || !/grey face/.test(neg.widgets_values[0])) errs.push('负向缺 grey face');

const reds = ui.nodes.filter((n) => n.color === '#c0392b').length;
const oranges = ui.nodes.filter((n) => n.color === '#d35400').length;
if (!reds) errs.push('缺红块（可改参数节点）');
if (!oranges) errs.push('缺橙块（输出节点）');

const linkById = new Map(ui.links.map((l) => [l[0], l]));
for (const n of ui.nodes) {
  for (const i of n.inputs || []) {
    if (i.link === null) continue;
    const l = linkById.get(i.link);
    if (!l || l[3] !== n.id) errs.push(`${n.type}.${i.name} 连线不自洽`);
  }
}

if (errs.length) {
  console.error('[check] 失败：\n- ' + errs.join('\n- '));
  process.exit(1);
}
console.log(`[check] ok nodes=${ui.nodes.length} links=${ui.links.length} batch=4 1728x768 red=${reds} orange=${oranges}`);
