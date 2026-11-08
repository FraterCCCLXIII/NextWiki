#!/usr/bin/env node
/* Comparison sheet: every version of every logo side by side, similar logos together, click to play.
   Each version runs its own page's code, in shadow DOM so their styles can't collide.
   Run: node kosmographica-logos/build-sheet.mjs  →  sheet.html + sheet-numbers.json */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));

const VERSIONS = [
  { key: "A", title: "Redrawn, web fonts", file: "index-v1-webfonts.html", finish: true },
  { key: "B", title: "Redrawn, font outlines", file: "index.html", finish: true },
  { key: "C", title: "Traced from original", file: "traced-v1.html", finish: false },
  { key: "D", title: "Traced and cleaned", file: "traced-v2-clean.html", finish: false },
];

const MARKER = "const nav=document.getElementById('nav')";
let fontLink = "";
for (const v of VERSIONS) {
  const html = readFileSync(join(dir, v.file), "utf8");
  v.css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  const code = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
  const cut = code.indexOf(MARKER);
  if (cut < 0) throw new Error(`player marker not found in ${v.file}`);
  v.code = code.slice(0, cut);
  const link = html.match(/<link href="(https:\/\/fonts\.googleapis\.com[^"]+)"/);
  if (link && link[1].length > fontLink.length) fontLink = link[1];
}

/* Within a group, the same idea from different sheets sits side by side. Order sets the number. */
const GROUPS = [
  ["Rainbow K, striped arms", ["10", "17", "D09", "29", "C02", "50", "61"]],
  ["K as a mark", ["56", "63", "34", "12", "D11"]],
  ["Rainbow arcs and fans", ["49", "D12", "Star", "32"]],
  ["Discs and bullseyes", ["D07", "C07", "60"]],
  ["Stripes that turn a corner", ["28", "36", "C04", "D10"]],
  ["Slanted speed stripes", ["33", "C01", "11", "18", "D14", "C06"]],
  ["Straight colour bars", ["52", "C03", "30", "D08", "59", "57", "31", "54"]],
  ["Framed and ringed", ["C05", "16"]],
  ["Band through the word", ["35", "C09"]],
  ["Stairs and rising bars", ["14", "C08", "D02", "D13", "D15"]],
  ["Wedges, arrows and beams", ["D05", "15", "D01", "38", "D03"]],
  ["Swooshes, orbits and ribbons", ["51", "D06", "62", "58", "D04"]],
  ["Colour in the letters and pixels", ["55", "64", "13", "42", "53"]],
];

let n = 0;
const numbers = {};
const body = GROUPS.map(([title, ids]) => {
  const rows = ids
    .map((id) => {
      n += 1;
      numbers[n] = id;
      const cells = VERSIONS.map(
        (v) =>
          `<figure tabindex="0" role="button" data-v="${v.key}" data-id="${id}" aria-label="Play logo ${n}${v.key}"><figcaption><b>${n}${v.key}</b><span>${id}</span></figcaption><div class="host"></div></figure>`
      ).join("");
      return `<div class="row">${cells}</div>`;
    })
    .join("");
  return `<section><h2>${title}</h2>${rows}</section>`;
}).join("");

const runtimes = VERSIONS.map(
  (v) => `V[${JSON.stringify(v.key)}]={finish:${v.finish},css:${JSON.stringify(v.css)},api:(function(){
${v.code}
return {LOGOS,mk,layout:typeof layoutWords==='function'?layoutWords:null,take(){const a=anims;anims=[];return a},clear(){anims=[]}};
})()};`
).join("\n");

const sound = readFileSync(join(dir, "../tools/logo-sound.js"), "utf8");
const legend = VERSIONS.map((v) => `<span><b>${v.key}</b> ${v.title}</span>`).join("");

writeFileSync(join(dir, "sheet-numbers.json"), JSON.stringify({ versions: Object.fromEntries(VERSIONS.map((v) => [v.key, v.title])), logos: numbers }, null, 1));
writeFileSync(
  join(dir, "sheet.html"),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Kosmographica Logo Sheet</title>
<link href="${fontLink}" rel="stylesheet">
<style>
*::-webkit-scrollbar{width:10px;height:10px}*::-webkit-scrollbar-track,*::-webkit-scrollbar-corner{background:transparent}*::-webkit-scrollbar-thumb{background:rgba(128,128,128,.45);background-clip:padding-box;border:2px solid transparent;border-radius:8px}*::-webkit-scrollbar-thumb:hover{background:rgba(128,128,128,.7);background-clip:padding-box;border:2px solid transparent}
@supports not selector(::-webkit-scrollbar){*{scrollbar-width:thin;scrollbar-color:rgba(128,128,128,.45) transparent}}
*{box-sizing:border-box;margin:0}
body{background:#15151b;color:#ececf1;font:14px/1.4 system-ui,sans-serif;padding:20px 16px 48px}
h1{font-size:20px;font-weight:600}
p{color:#a4a4b2;margin:4px 0 12px}
.legend{position:sticky;top:0;z-index:5;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;background:#15151b;padding:8px 0;font-size:12px;color:#c8c8d4}
.legend b{color:#fff;margin-right:4px}
h2{font-size:13px;font-weight:600;letter-spacing:.04em;color:#c8c8d4;margin:22px 0 8px}
.row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:8px}
figure{position:relative;aspect-ratio:3/2;border-radius:8px;overflow:hidden;background:#fdf7ee;cursor:pointer}
figure:hover{box-shadow:0 0 0 2px #7c8cff}
figure:focus-visible{outline:2px solid #7c8cff;outline-offset:2px}
figure.none{background:#22222b;cursor:default;box-shadow:none}
figure.none .host::after{content:"No version";position:absolute;inset:0;display:grid;place-items:center;color:#70707e;font-size:12px}
figcaption{position:absolute;z-index:2;left:8px;top:4px;right:8px;display:flex;justify-content:space-between;align-items:baseline;color:#17171b;pointer-events:none}
figure.none figcaption{color:#70707e}
figcaption b{font-size:15px}
figcaption span{font-size:10px;color:#6d6d78}
.host{position:absolute;inset:24px 6px 4px}
</style></head><body><h1>Kosmographica logos, every version</h1>
<p>Each row is one logo. Click any version to play its reveal, and refer to it by its label, such as 12D. <label style="margin-left:8px;cursor:pointer;color:#ececf1"><input type="checkbox" id="sound" checked> Sound</label></p>
<div class="legend">${legend}</div>${body}
<script>
const V={};
${sound}
const nextSound=createSoundShuffle('kosmo-sheet-sound-bag',KOSMO_SOUNDS),player=createJinglePlayer('audio/'),soundBox=document.getElementById('sound');
try{soundBox.checked=localStorage.getItem('kosmo-logo-sound')!=='0'}catch{}
soundBox.addEventListener('change',()=>{try{localStorage.setItem('kosmo-logo-sound',soundBox.checked?'1':'0')}catch{};if(!soundBox.checked)player.mute()});
const ring=fig=>{if(soundBox.checked)player.play(nextSound()).catch(()=>{})};
${runtimes}
const find=(v,id)=>V[v].api.LOGOS.find(L=>String(L.n)===id||(typeof L.n==='number'&&L.n>100&&'D'+String(L.n-100).padStart(2,'0')===id));
let uid=0;
function fit(el,box){
  el.style.transform='none';
  const s=Math.min(box.clientWidth*.94/el.offsetWidth,box.clientHeight*.94/el.offsetHeight);
  el.style.left='50%';el.style.top='50%';el.style.transform='translate(-50%,-50%) scale('+s+')';
}
function draw(fig,playIt){
  const v=fig.dataset.v,R=V[v],L=find(v,fig.dataset.id),host=fig.querySelector('.host');
  if(!L)return;
  (fig._anims||[]).forEach(a=>a.cancel());
  const root=host.shadowRoot||host.attachShadow({mode:'open'});
  root.innerHTML='<style>'+R.css+'</style>';
  const el=R.api.mk(L.build('x'+(++uid)));root.appendChild(el);
  if(R.api.layout)R.api.layout(el);
  fit(el,host);fig._el=el;
  if(playIt||R.finish){
    R.api.clear();L.play(el);fig._anims=R.api.take();
    if(!playIt)fig._anims.forEach(a=>a.finish());
    fit(el,host);
  }else fig._anims=[];
}
const figs=[...document.querySelectorAll('figure')];
const seen=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting&&!e.target._drawn){e.target._drawn=1;draw(e.target,false);seen.unobserve(e.target)}}),{rootMargin:'500px'});
figs.forEach(fig=>{
  if(!find(fig.dataset.v,fig.dataset.id)){fig.classList.add('none');fig.removeAttribute('role');fig.removeAttribute('tabindex');return}
  seen.observe(fig);
  fig.addEventListener('click',()=>{fig._drawn=1;draw(fig,true);ring(fig)});
  fig.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fig._drawn=1;draw(fig,true);ring(fig)}});
});
if(document.fonts)document.fonts.addEventListener('loadingdone',()=>figs.forEach(f=>{if(f._el)fit(f._el,f.querySelector('.host'))}));
</script></body></html>`
);
console.log(`${n} logos, ${VERSIONS.map((v) => v.key).join("/")} versions`);
