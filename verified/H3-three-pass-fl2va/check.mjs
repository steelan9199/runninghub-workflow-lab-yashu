import { readFileSync } from 'node:fs';

const files = process.argv.slice(2);
for (const f of files) {
  const j = JSON.parse(readFileSync(f, 'utf8'));
  const errs = [];
  const ids = new Set();
  for (const n of j.nodes) {
    if (ids.has(n.id)) errs.push(`重复节点 id ${n.id}`);
    ids.add(n.id);
    if (typeof n.type !== 'string') errs.push(`节点 ${n.id} 无 type`);
    if (!Array.isArray(n.pos)) errs.push(`节点 ${n.id} 无 pos`);
    if (n.widgets_values && !Array.isArray(n.widgets_values)) errs.push(`节点 ${n.id} 的 widgets_values 不是数组`);
  }
  const linkById = new Map();
  for (const l of j.links) {
    if (l.length !== 6) errs.push(`link 结构不对 ${JSON.stringify(l)}`);
    const [id, src, ss, dst, ds, type] = l;
    if (linkById.has(id)) errs.push(`重复 link id ${id}`);
    linkById.set(id, l);
    const s = j.nodes.find((n) => n.id === src);
    const d = j.nodes.find((n) => n.id === dst);
    if (!s) { errs.push(`link ${id} 源节点 ${src} 不存在`); continue; }
    if (!d) { errs.push(`link ${id} 目标节点 ${dst} 不存在`); continue; }
    const so = s.outputs[ss];
    if (!so) { errs.push(`link ${id} 源槽 ${src}:${ss} 不存在`); continue; }
    const di = d.inputs[ds];
    if (!di) { errs.push(`link ${id} 目标槽 ${dst}:${ds} 不存在`); continue; }
    if (!(so.links || []).includes(id)) errs.push(`link ${id} 没写进 ${src}.outputs[${ss}].links`);
    if (di.link !== id) errs.push(`link ${id} 与 ${dst}.inputs[${ds}].link 不一致`);
    if (String(so.type) !== String(type) && !String(so.type).includes(type)) errs.push(`link ${id} 类型不匹配 ${so.type} vs ${type}`);
  }
  for (const n of j.nodes) {
    for (const [i, inp] of (n.inputs || []).entries()) {
      if (inp.link == null) continue;
      const l = linkById.get(inp.link);
      if (!l) errs.push(`节点 ${n.id}.inputs[${i}](${inp.name}) 指向不存在的 link ${inp.link}`);
      else if (l[3] !== n.id || l[4] !== i) errs.push(`节点 ${n.id}.inputs[${i}](${inp.name}) link ${inp.link} 指向别处`);
    }
    for (const [i, o] of (n.outputs || []).entries()) {
      for (const lid of o.links || []) {
        const l = linkById.get(lid);
        if (!l) errs.push(`节点 ${n.id}.outputs[${i}] 有野 link ${lid}`);
        else if (l[1] !== n.id || l[2] !== i) errs.push(`节点 ${n.id}.outputs[${i}] link ${lid} 指向别处`);
      }
    }
  }
  if (j.last_node_id < Math.max(...j.nodes.map((n) => n.id))) errs.push('last_node_id 偏小');
  if (j.last_link_id < Math.max(...j.links.map((l) => l[0]))) errs.push('last_link_id 偏小');

  // 交付规范：红=可改参数、橙=输出、素材必须已预填
  const RED = '#c0392b', ORANGE = '#d35400';
  const nRed = j.nodes.filter((n) => n.color === RED).length;
  const nOrange = j.nodes.filter((n) => n.color === ORANGE).length;
  if (!nRed) errs.push('没有红色可改节点');
  if (!nOrange) errs.push('没有橙色输出节点');
  for (const n of j.nodes) {
    if (n.color && n.color !== RED && n.color !== ORANGE) errs.push(`节点 ${n.id} 用了规范外的颜色 ${n.color}`);
    if (n.color === RED && !(n.title || '').startsWith('★')) errs.push(`红节点 ${n.id} 标题缺少 ★ 前缀`);
    if (n.type === 'LoadImage') {
      const v = (n.widgets_values || [])[0];
      if (!v || /example\.(png|jpg)$/i.test(v) || !/^openapi\//.test(v)) errs.push(`LoadImage ${n.id} 未预填 RH fileName（当前 ${v}）`);
    }
  }
  console.log(`\n${f}`);
  console.log(`  nodes=${j.nodes.length} links=${j.links.length} red=${nRed} orange=${nOrange}`);
  console.log(errs.length ? '  ✗ ' + errs.join('\n  ✗ ') : '  ✓ 结构自洽');
}
