// UML 2.5 activity diagrams for Figures 5 and 6: partitions, actions, decision/merge, fork/join, signals, expansion region.
const fs = require('fs');
const path = require('path');
const K = { esp: '#3A2A22', body: '#5E524B', muted: '#7A6C63', card: '#FDFBF9', line: '#BFB2A8', terra: '#B5653A', lane: '#F5F0EB', ai: '#F3E6DD', aiLine: '#C9A792', clay: '#8A6A56', light: '#F2EDE8' };
const W = 1664, H = 700;
const css = `
*{box-sizing:border-box;margin:0}
body{width:${W}px;height:${H}px;background:${K.card};font-family:'Inter Tight',Arial,sans-serif;color:${K.esp};position:relative;overflow:hidden}
.lane{position:absolute;top:6px;height:688px;border:1.5px solid ${K.esp};background:${K.lane}}
.lane.ai{background:#F1E6DE}
.lane>p{height:32px;border-bottom:1.5px solid ${K.esp};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;letter-spacing:.3px}
.a{position:absolute;display:flex;align-items:center;justify-content:center;text-align:center;font-size:13px;line-height:1.2;padding:3px 10px;background:#fff;border:1.5px solid ${K.esp};border-radius:12px}
.a.ai{background:${K.ai}}
.a.later{opacity:.45;border-style:dashed}
.o{position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font-size:13px;line-height:1.2;background:#fff;border:1.5px solid ${K.esp};padding:2px 8px}
.o small{font-size:11px;color:${K.muted};line-height:1.25}
.sig{position:absolute;display:flex;align-items:center;justify-content:center;text-align:center;font-size:12.5px;line-height:1.15}
.sig svg{position:absolute;left:0;top:0;z-index:-1}
.sig{isolation:isolate}
.dia{position:absolute;width:30px;height:30px}
.q{position:absolute;font-size:12px;font-weight:600;color:${K.esp};white-space:nowrap}
.g{position:absolute;font-size:12px;color:${K.terra};white-space:nowrap;font-weight:600;background:transparent}
.bar{position:absolute;height:6px;background:${K.esp};border-radius:1px}
.init{position:absolute;width:20px;height:20px;border-radius:50%;background:${K.esp}}
.fin{position:absolute;width:24px;height:24px;border-radius:50%;border:2px solid ${K.esp};display:flex;align-items:center;justify-content:center}
.fin i{width:13px;height:13px;border-radius:50%;background:${K.esp}}
.ff{position:absolute;width:22px;height:22px}
.region{position:absolute;border:1.8px dashed ${K.esp};border-radius:16px}
.region>span{position:absolute;left:12px;top:6px;font-size:12px;font-weight:600;color:${K.muted}}
.pin{position:absolute;width:30px;height:12px;border:1.5px solid ${K.esp};background:#fff;display:flex}
.pin i{flex:1;border-right:1.2px solid ${K.esp}}.pin i:last-child{border-right:none}
.note{position:absolute;font-size:11.5px;line-height:1.3;color:${K.body};background:#FFFBF0;border:1.2px solid ${K.line};padding:6px 10px;clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,0 100%)}
svg.edges{position:absolute;left:0;top:0;width:${W}px;height:${H}px;overflow:visible}
`;
const lane = (x, w, name, ai) => `<div class="lane${ai ? ' ai' : ''}" style="left:${x}px;width:${w}px"><p>${name}</p></div>`;
const act = (id, cx, y, w, h, t, cls = '', call) => `<div id="${id}" class="a ${cls}" style="left:${cx - w / 2}px;top:${y}px;width:${w}px;height:${h}px">${t}${call ? `<svg style="position:absolute;right:7px;bottom:5px" width="12" height="11" viewBox="0 0 12 11"><path d="M6 0v11M1 5v6M11 5v6M1 5h10" fill="none" stroke="${K.esp}" stroke-width="1.4"/></svg>` : ''}</div>`;
const obj = (id, cx, y, w, h, t, sub) => `<div id="${id}" class="o" style="left:${cx - w / 2}px;top:${y}px;width:${w}px;height:${h}px"><span>${t}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
const sig = (id, kind, cx, y, w, h, t) => { const pts = kind === 'send' ? `1,1 ${w - 16},1 ${w - 1},${h / 2} ${w - 16},${h - 1} 1,${h - 1}` : `1,1 ${w - 1},1 ${w - 1},${h - 1} 1,${h - 1} 16,${h / 2}`; return `<div id="${id}" class="sig" style="left:${cx - w / 2}px;top:${y}px;width:${w}px;height:${h}px;padding:0 ${kind === 'send' ? '18px 0 8px' : '8px 0 20px'}"><svg width="${w}" height="${h}"><polygon points="${pts}" fill="#fff" stroke="${K.esp}" stroke-width="1.5"/></svg>${t}</div>`; };
const dia = (id, cx, cy) => `<svg id="${id}" class="dia" style="left:${cx - 15}px;top:${cy - 15}px" viewBox="0 0 30 30"><polygon points="15,1 29,15 15,29 1,15" fill="#fff" stroke="${K.esp}" stroke-width="1.5"/></svg>`;
const q = (x, y, t) => `<p class="q" style="left:${x}px;top:${y}px">${t}</p>`;
const g = (x, y, t) => `<p class="g" style="left:${x}px;top:${y}px">[${t}]</p>`;
const bar = (id, x, y, w) => `<div id="${id}" class="bar" style="left:${x}px;top:${y}px;width:${w}px"></div>`;
const init = (id, cx, cy) => `<div id="${id}" class="init" style="left:${cx - 10}px;top:${cy - 10}px"></div>`;
const fin = (id, cx, cy) => `<div id="${id}" class="fin" style="left:${cx - 12}px;top:${cy - 12}px"><i></i></div>`;
const ff = (id, cx, cy) => `<svg id="${id}" class="ff" style="left:${cx - 11}px;top:${cy - 11}px" viewBox="0 0 22 22"><circle cx="11" cy="11" r="10" fill="#fff" stroke="${K.esp}" stroke-width="1.5"/><path d="M4 4L18 18M18 4L4 18" stroke="${K.esp}" stroke-width="1.5"/></svg>`;
const note = (x, y, w, t) => `<div class="note" style="left:${x}px;top:${y}px;width:${w}px">${t}</div>`;
const router = `
function draw(edges){const NS='http://www.w3.org/2000/svg';const svg=document.createElementNS(NS,'svg');svg.setAttribute('class','edges');
 svg.innerHTML='<defs><marker id="v" viewBox="0 0 10 10" refX="9.5" refY="5" markerWidth="9" markerHeight="9" orient="auto"><path d="M0 0.5L10 5L0 9.5" fill="none" stroke="${K.esp}" stroke-width="1.5"/></marker></defs>';
 for(const p of edges){const pl=document.createElementNS(NS,'polyline');pl.setAttribute('points',p.pts.map(q=>q.join(',')).join(' '));pl.setAttribute('fill','none');pl.setAttribute('stroke','${K.esp}');pl.setAttribute('stroke-width','1.4');pl.setAttribute('stroke-linejoin','round');
  if(p.head!==false)pl.setAttribute('marker-end','url(#v)');if(p.faded)pl.setAttribute('opacity','.45');svg.appendChild(pl);}
 const first=document.querySelector('.a,.o,.sig,.dia,.init');document.body.insertBefore(svg,first);}
`;
const page = (name, body, edges) => {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400..700&display=block" rel="stylesheet"><style>${css}</style></head><body>
${body}
<script>${router}
document.fonts.ready.then(()=>{draw(${JSON.stringify(edges.map(e => Array.isArray(e) ? { pts: e } : e))});document.title='ready';});</script></body></html>`;
  fs.writeFileSync(path.join(__dirname, name + '.html'), html);
};

require('./act-figs.js')({ lane, act, obj, sig, dia, q, g, bar, init, fin, ff, note, page });
console.log('ok');
