// Use case diagram v3: UML-correct actors, subject areas, include/extend, releases. Renders as HTML for Chrome at 3x.
const fs = require('fs');
const path = require('path');
const K = { esp: '#3A2A22', body: '#5E524B', muted: '#7A6C63', light: '#F2EDE8', card: '#FDFBF9', line: '#DCD2CA', clay: '#8A6A56', terra: '#B5653A', peach: '#F2C9A8', lane: '#F5F0EB', ai: '#F3E6DD', aiLine: '#C9A792' };
const W = 1664, H = 700;

const css = `
*{box-sizing:border-box;margin:0}
body{width:${W}px;height:${H}px;background:${K.card};font-family:'Inter Tight',Arial,sans-serif;color:${K.esp};position:relative;overflow:hidden}
.uc{position:absolute;display:flex;align-items:center;gap:8px;border-radius:50%;background:#fff;border:1.5px solid ${K.line};padding:0 22px 0 28px;font-size:13.5px;line-height:1.15;height:44px;width:276px}
.uc b{color:${K.clay};font-weight:700;flex-shrink:0;font-size:13px}
.uc span{flex:1}
.uc i{font-style:normal;font-size:11px;font-weight:700;color:${K.light};background:${K.clay};border-radius:9px;padding:1px 6px;flex-shrink:0}
.uc.r1 i{background:${K.esp}}
.uc.ai{background:${K.ai};border-color:${K.aiLine}}
.uc.new{border-style:dashed;border-color:${K.terra}}
.pk{position:absolute;border-radius:22px;background:${K.lane}}
.pk p{position:absolute;left:0;right:0;top:9px;text-align:center}
.pk p span{background:${K.esp};color:${K.light};font-size:12.5px;font-weight:600;letter-spacing:1.4px;padding:4px 14px;border-radius:16px}
.act{position:absolute;display:flex;flex-direction:column;align-items:center;gap:3px;width:150px}
.act p{font-size:14.5px;font-weight:600;text-align:center;line-height:1.15}
.ext{position:absolute;top:648px;height:40px;display:flex;align-items:center;justify-content:center;flex-direction:column;border:1.5px solid ${K.esp};border-radius:10px;background:#fff;font-size:13px;font-weight:600;line-height:1.1}
.ext small{font-size:10.5px;font-weight:500;color:${K.muted}}
.lab{position:absolute;font-size:11.5px;font-weight:600;color:${K.terra};white-space:nowrap;background:#fff;border-radius:6px;padding:0 4px}
.key{position:absolute;font-size:12px;color:${K.muted};line-height:1.5}
svg.edges{position:absolute;left:0;top:0;width:${W}px;height:${H}px;overflow:visible}
`;
const router = `
function box(id){const e=document.getElementById(id);if(!e)throw new Error('no '+id);const r=e.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height};}
function port(b,s,o){o=o||0;if(s==='t')return [b.x+b.w/2+o,b.y];if(s==='b')return [b.x+b.w/2+o,b.y+b.h];if(s==='l')return [b.x+4,b.y+b.h/2+o];return [b.x+b.w-4,b.y+b.h/2+o];}
function draw(edges){const NS='http://www.w3.org/2000/svg';const svg=document.createElementNS(NS,'svg');svg.setAttribute('class','edges');
 svg.innerHTML='<defs><marker id="o" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10" fill="none" stroke="${K.terra}" stroke-width="1.6"/></marker><marker id="g" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="15" markerHeight="15" orient="auto"><path d="M1 1L11 6L1 11z" fill="#fff" stroke="${K.esp}" stroke-width="1.1"/></marker></defs>';
 for(const e of edges){const A=Array.isArray(e.from)?e.from:port(box(e.from),e.fs||'r',e.fo);const B=Array.isArray(e.to)?e.to:port(box(e.to),e.ts||'l',e.to2);const p=[A,...(e.via||[]),B];
  const pl=document.createElementNS(NS,'polyline');pl.setAttribute('points',p.map(q=>q.join(',')).join(' '));pl.setAttribute('fill','none');pl.setAttribute('stroke-linejoin','round');
  const c=e.k==='inc'||e.k==='ext'?'${K.terra}':(e.k==='gen'?'${K.esp}':(e.k==='sec'?'#B9A99C':'#9C8A7E'));pl.setAttribute('stroke',c);pl.setAttribute('stroke-width',e.k==='gen'?1.5:1.3);
  if(e.k==='inc'||e.k==='ext'||e.k==='sec')pl.setAttribute('stroke-dasharray',e.k==='sec'?'2 4':'6 4');if(e.k==='inc'||e.k==='ext')pl.setAttribute('marker-end','url(#o)');if(e.k==='gen')pl.setAttribute('marker-end','url(#g)');svg.appendChild(pl);
  if(e.label){const d=document.createElement('p');d.className='lab';d.textContent=e.label;d.style.left=e.lp[0]+'px';d.style.top=e.lp[1]+'px';document.body.appendChild(d);}}
 document.body.insertBefore(svg,document.querySelector('.uc'));}
`;
const fig = (id, cx, cy, label) => `<div id="${id}" class="act" style="left:${cx - 75}px;top:${cy - 36}px"><svg width="34" height="56" viewBox="0 0 36 60"><circle cx="18" cy="9" r="8" fill="none" stroke="${K.esp}" stroke-width="2.4"/><path d="M18 17v22M4 26h28M18 39L6 58M18 39l12 19" fill="none" stroke="${K.esp}" stroke-width="2.4" stroke-linecap="round"/></svg><p>${label}</p></div>`;
const { body, edges } = require('./uc-layout.js')(K, fig);
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400..700&family=Instrument+Serif&display=block" rel="stylesheet"><style>${css}</style></head><body>
${body}
<script>${router}
document.fonts.ready.then(()=>{draw(${JSON.stringify(edges)});document.title='ready';});</script></body></html>`;
fs.writeFileSync(path.join(__dirname, 'uc.html'), html);
console.log('ok');
