/* =========================================================
   Reveals for traced-v2-clean.html. House rules: wipes, stroke-mask draw-ons, straight slides
   from behind a mask, plain fades. Every property moves one way once and stops. No overshoot.
   ========================================================= */
const mk=h=>{const t=document.createElement('template');t.innerHTML=h.trim();return t.content.firstElementChild};
const E={out:'cubic-bezier(.16,1,.3,1)',io:'cubic-bezier(.65,0,.35,1)',lin:'linear'};
let anims=[];
function an(el,kf,o={}){if(!el)return;const a=el.animate(kf,{duration:o.d||600,delay:o.t||0,easing:o.e||E.out,fill:'both'});anims.push(a);return a}
const LOGOS=[];
const NS='http://www.w3.org/2000/svg';
const svgEl=(n,a={})=>{const e=document.createElementNS(NS,n);for(const k in a)e.setAttribute(k,a[k]);return e};
let maskN=0;
function buildTraced(id,u){
  const L=TRACED[id],[x0,y0,x1,y1]=L.bb,m=6,vx=x0-m,vy=y0-m,vw=x1-x0+2*m,vh=y1-y0+2*m,pid=`mesh${u}${id}`,gr=[];
  const P=(c,i)=>{const f=c.g?`url(#g${u}${id}_${i})`:c.f==='mesh'?`url(#${pid})`:c.f,st=c.k==='col'?` stroke="${f}" stroke-width="${c.sw||.3}"`:'';
    if(c.g)gr.push(`<linearGradient id="g${u}${id}_${i}" gradientUnits="userSpaceOnUse" x1="${c.g.x1}" y1="${c.g.y1}" x2="${c.g.x2}" y2="${c.g.y2}">${c.g.s.map(s=>`<stop offset="${s[0]}" stop-color="${s[1]}"/>`).join('')}</linearGradient>`);
    return `<path class="tc" data-i="${i}" fill-rule="evenodd" fill="${f}"${st} d="${c.d}"/>`};
  const cols=[],inks=[],paps=[];L.comps.forEach((c,i)=>(c.k==='col'?cols:c.k==='pap'?paps:inks).push(P(c,i)));
  const pat=L.mesh?`<pattern id="${pid}" patternUnits="userSpaceOnUse" width="${L.w}" height="${L.h}"><image href="${L.mesh}" width="${L.w}" height="${L.h}" preserveAspectRatio="none"/></pattern>`:'';
  const kid=`k${u}${id}`,kn=L.knock&&L.knock.length?`<mask id="${kid}" maskUnits="userSpaceOnUse" x="-50" y="-50" width="${L.w+100}" height="${L.h+100}"><rect x="-50" y="-50" width="${L.w+100}" height="${L.h+100}" fill="#fff"/>${L.knock.map(k=>`<path d="${k.d}" fill="#000" fill-rule="evenodd"${k.sw?` stroke="#000" stroke-width="${k.sw}" stroke-linejoin="round"`:''}/>`).join('')}</mask>`:'';
  return `<div class="logo" data-id="${id}"><svg class="ts" width="${vw}" height="${vh}" viewBox="${vx} ${vy} ${vw} ${vh}"><defs>${pat}${gr.join('')}${kn}</defs><g class="cols"${kn?` mask="url(#${kid})"`:''}>${cols.join('')}</g><g class="inks">${inks.join('')}</g><g class="paps">${paps.join('')}</g></svg></div>`;
}
function comps(r,id){
  const L=TRACED[id],C=[...r.querySelectorAll('path.tc')].map(el=>{const c=L.comps[+el.dataset.i],[a,b,e,f]=c.b;return {...c,el,x0:a,y0:b,x1:e,y1:f,cx:(a+e)/2,cy:(b+f)/2,w:e-a,h:f-b}});
  C.ink=C.filter(c=>c.k==='ink');C.col=C.filter(c=>c.k==='col');C.pap=C.filter(c=>c.k==='pap');C.bb=L.bb;return C;
}
const byX=l=>[...l].sort((a,b)=>a.cx-b.cx),byY=l=>[...l].sort((a,b)=>a.cy-b.cy);
const box=l=>({x0:Math.min(...l.map(c=>c.x0)),y0:Math.min(...l.map(c=>c.y0)),x1:Math.max(...l.map(c=>c.x1)),y1:Math.max(...l.map(c=>c.y1))});
const big=(l,f)=>[l.filter(f),l.filter(c=>!f(c))];
const rowsOf=l=>{const b=box(l),mid=(b.y0+b.y1)/2;return [l.filter(c=>c.cy<mid),l.filter(c=>c.cy>=mid)]};
const groupFill=l=>{const m=new Map();l.forEach(c=>{if(!m.has(c.f))m.set(c.f,[]);m.get(c.f).push(c)});return [...m.values()].map(items=>({items,...box(items),t:Math.max(...items.map(c=>c.t)),a:items.reduce((s,c)=>s+c.a,0)}))};
/* --- moves --- */
const INS={l:'inset(-6% 106% -6% -6%)',r:'inset(-6% -6% -6% 106%)',t:'inset(-6% -6% 106% -6%)',b:'inset(106% -6% -6% -6%)',c:'inset(-6% 50% -6% 50%)',m:'inset(50% -6% 50% -6%)'};
const wipe=(c,dir,t,d,e=E.io)=>an(c.el||c,[{clipPath:INS[dir]},{clipPath:'inset(-6% -6% -6% -6%)'}],{t,d,e});
const fade=(c,t,d=600,e=E.io)=>an(c.el||c,[{opacity:0},{opacity:1}],{t,d,e});
const slideFade=(c,dx,dy,t,d=800)=>an(c.el||c,[{transform:`translate(${dx}px,${dy}px)`,opacity:0},{transform:'translate(0px,0px)',opacity:1}],{t,d,e:E.out});
const wipes=(l,dir,t0,gap,d=600,e=E.io)=>l.forEach((c,i)=>wipe(c,dir,t0+i*gap,d,e));
/* one wipe front travelling across a word: each letter opens as the front reaches it */
const wordWipe=(l,t0,d=900)=>{const b=box(l),W=b.x1-b.x0;l.forEach(c=>wipe(c,'l',t0+d*(c.x0-b.x0)/W,Math.max(70,d*c.w/W),E.lin))};
const wordWipeR=(l,t0,d=900)=>{const b=box(l),W=b.x1-b.x0;l.forEach(c=>wipe(c,'r',t0+d*(b.x1-c.x1)/W,Math.max(70,d*c.w/W),E.lin))};
const wordWipeC=(l,t0,d=800)=>{const b=box(l),mid=(b.x0+b.x1)/2,H=(b.x1-b.x0)/2;l.forEach(c=>{if(c.x0<mid&&c.x1>mid){wipe(c,'c',t0,Math.max(70,d*c.w/2/H),E.lin);return}
  const left=c.x1<=mid;wipe(c,left?'r':'l',t0+d*(left?mid-c.x1:c.x0-mid)/H,Math.max(70,d*c.w/H),E.lin)})};
const wordFade=(l,t,d=800)=>l.forEach(c=>fade(c,t,d));
function clipGroup(l,rect){
  const svg=l[0].el.ownerSVGElement,id=`mr${++maskN}`,cp=svgEl('clipPath',{id});
  cp.appendChild(svgEl('rect',{x:rect.x0,y:rect.y0,width:rect.x1-rect.x0,height:rect.y1-rect.y0}));svg.querySelector('defs').appendChild(cp);
  const g=svgEl('g',{'clip-path':`url(#${id})`});l[0].el.parentNode.appendChild(g);l.forEach(c=>g.appendChild(c.el));return g;
}
/* letters rise (dir 1) or drop (dir -1) out of a fixed mask line, one after another */
function maskRise(l,t0,gap=32,d=800,dir=1){
  if(!l.length)return;const b=box(l),p=8,xs=byX(l),H=b.y1-b.y0+2*p;clipGroup(xs,{x0:b.x0-p,y0:b.y0-p,x1:b.x1+p,y1:b.y1+p});
  xs.forEach((c,i)=>an(c.el,[{transform:`translateY(${dir*H}px)`},{transform:'translateY(0px)'}],{t:t0+i*gap,d,e:E.out}));
}
const maskRows=(l,t0,gap=30,stag=220)=>rowsOf(l).forEach((row,k)=>maskRise(row,t0+k*stag,gap));
/* a whole group slides out from behind a fixed edge */
function maskSlide(l,dx,dy,rect,t,d=1000){if(!l.length)return;clipGroup(l,rect);l.forEach(c=>an(c.el,[{transform:`translate(${dx}px,${dy}px)`},{transform:'translate(0px,0px)'}],{t,d,e:E.out}))}
function maskFor(el,child,t,d){
  const svg=el.ownerSVGElement,vb=svg.viewBox.baseVal,id=`wm${++maskN}`,m=svgEl('mask',{id,maskUnits:'userSpaceOnUse',x:vb.x-20,y:vb.y-20,width:vb.width+40,height:vb.height+40});
  m.appendChild(child);const full=svgEl('rect',{x:vb.x-20,y:vb.y-20,width:vb.width+40,height:vb.height+40,fill:'#fff',opacity:0});m.appendChild(full);
  svg.querySelector('defs').appendChild(m);el.setAttribute('mask',`url(#${id})`);
  an(full,[{opacity:0},{opacity:0,offset:.995},{opacity:1}],{t,d,e:'linear'}); // last frame = whole shape
}
function conic(c,cx,cy,startDeg,sweep,t,d,e=E.io){
  const el=c.el||c,R=1400,circ=svgEl('circle',{cx,cy,r:R,fill:'none',stroke:'#fff','stroke-width':2*R,pathLength:1,'stroke-dasharray':'1 2',transform:`rotate(${startDeg} ${cx} ${cy})`,style:'transform-box:view-box;transform-origin:0 0'});
  maskFor(el,circ,t,d);an(circ,[{strokeDashoffset:1},{strokeDashoffset:1-sweep}],{t,d,e});
}
function pathWipe(c,d0,w,t,d,e=E.io){
  const el=c.el||c,p=svgEl('path',{d:d0,fill:'none',stroke:'#fff','stroke-width':w,pathLength:1,'stroke-dasharray':'1 2','stroke-linecap':'butt'});
  maskFor(el,p,t,d);an(p,[{strokeDashoffset:1},{strokeDashoffset:0}],{t,d,e});
}
const roundRect=(x0,y0,x1,y1,r)=>`M${x0+r} ${y0}H${x1-r}A${r} ${r} 0 0 1 ${x1} ${y0+r}V${y1-r}A${r} ${r} 0 0 1 ${x1-r} ${y1}H${x0+r}A${r} ${r} 0 0 1 ${x0} ${y1-r}V${y0+r}A${r} ${r} 0 0 1 ${x0+r} ${y0}Z`;
const ringsDraw=(l,t0,rf=.3)=>groupFill(l).sort((a,e)=>(e.x1-e.x0)-(a.x1-a.x0)).forEach((g,i)=>{const p=g.t/2,dd=roundRect(g.x0+p,g.y0+p,g.x1-p,g.y1-p,Math.min(g.x1-g.x0,g.y1-g.y0)*rf);g.items.forEach(c=>pathWipe(c,c.cd||dd,g.t*2.8,t0+i*130,1100))});
const armsWipe=(l,cy,t0,gap=60)=>byX(l).forEach((c,i)=>wipe(c,c.cy<cy?'b':'t',t0+i*gap,700,E.out));

const TR={
10:['Rainbow K','Stem bands draw down · arms wipe out with flat edges · word wipe',(r,C)=>{const [Arm,Stem]=big(C.col,c=>!!c.cl);
  byX(Stem).forEach((c,i)=>wipe(c,'t',i*90,800,E.io));
  const ab=box(Arm);armsWipe(Arm,(ab.y0+ab.y1)/2,650,50);
  wordWipe(C.ink,1050,800)}],
11:['Speed Caps','Lines sweep · word wipe',(r,C)=>{wipes(byY(C.col),'l',0,60,800);wordWipe(C.ink,300,1000)}],
12:['Badge','Frame draw · K wipe · mask rise · bars run',(r,C)=>{const [F,rest]=big(C.ink,c=>c.w>300),[K,W_]=big(rest,c=>c.h>100),[Dv,Kk]=big(K,c=>c.w<12);
  F.forEach(c=>{const p=c.t/2;pathWipe(c,roundRect(c.x0+p,c.y0+p,c.x1-p,c.y1-p,18),c.t*3,0,1100)});Kk.forEach(c=>wipe(c,'l',450,700));Dv.forEach(c=>wipe(c,'t',750,450));maskRows(W_,800);wipes(byX(C.col),'l',650,70,350,E.lin)}],
13:['Rainbow O','Word wipe · rainbow O fades up',(r,C)=>{wordWipe(C.ink,0,1100);C.col.forEach(c=>fade(c,1000+(c.cx-C.bb[0])*1.2,500))}],
14:['Staircase','Bars rise behind a line · label wipe · mask rise',(r,C)=>{wipes(byX(C.col),'b',0,110,700);C.ink.forEach(c=>wipe(c,'l',700,700));maskRise(C.pap,1000,28)}],
15:['Arrow Chevrons','Chevrons slide · mask rise',(r,C)=>{byX(C.col).forEach((c,i)=>slideFade(c,-70,0,i*85));maskRows(C.ink,600)}],
16:['Pill Rings','Rings draw inward · label fade',(r,C)=>{ringsDraw(C.col,0,.42);wordFade(C.ink,1150,700)}],
17:['Diagonal K','Stem wipe · arms wipe · centre word wipe',(r,C)=>{const [K,W_]=big(C.ink,c=>c.h>100);K.forEach(c=>wipe(c,'b',0,700));const b=box(C.col);armsWipe(C.col,(b.y0+b.y1)/2,450);wordWipeC(W_,1000)}],
18:['Banded Italic','Bands wipe from both sides · word wipe',(r,C)=>{const [T,B]=rowsOf(C.col);wipes(byX(T),'l',0,70,420,E.lin);wipes(byX(B).reverse(),'r',150,70,420,E.lin);wordWipe(C.ink,350,1000)}],
28:['Rainbow Runway','Stripes run and turn · word mask rise',(r,C)=>{groupFill(C.col).sort((a,e)=>a.y0-e.y0).forEach((g,i)=>{const X=g.x1-g.t/2,Y=g.y0+g.t/2,rr=Math.max(g.t,(g.y1-g.y0-g.t)*.8),dd=`M${g.x0-5} ${Y}H${X-rr}A${rr} ${rr} 0 0 1 ${X} ${Y+rr}V${g.y1+5}`;g.items.forEach(c=>pathWipe(c,c.cd||dd,g.t*3.2,i*90,1200))});maskRise(C.ink,500,38)}],
29:['Slab K Chevrons','K wipe · stripes slide from behind · word wipe',(r,C)=>{const [K,W_]=big(C.ink,c=>c.h>100);K.forEach(c=>wipe(c,'b',0,700));byX(C.col).forEach((c,i)=>slideFade(c,-100,0,450+i*85));wordWipe(W_,1000,800)}],
30:['Spectrum Bar','Bar runs across · mask rise',(r,C)=>{wipes(byX(C.col),'l',0,90,110,E.lin);maskRise(C.ink,450,30)}],
31:['Stacked Caps','Lines slide out of a mask · stripes wipe',(r,C)=>{const [T,B]=rowsOf(C.ink),bt=box(T),bb=box(B),p=6;maskSlide(T,-(bt.x1-bt.x0)-p*2,0,{x0:bt.x0-p,y0:bt.y0-p,x1:bt.x1+p,y1:bt.y1+p},0);maskSlide(B,(bb.x1-bb.x0)+p*2,0,{x0:bb.x0-p,y0:bb.y0-p,x1:bb.x1+p,y1:bb.y1+p},150);wipes(byY(C.col),'r',600,80,500)}],
32:['Fan Dial','Radial sweep opens the fan · word mask rise',(r,C)=>{const b=box(C.col);C.col.forEach(c=>conic(c,(b.x0+b.x1)/2,b.y1,180,.5,0,1400,E.io));maskRise(C.ink,800,35)}],
33:['Speed Stripes','Stripe sweep · word wipe',(r,C)=>{wipes(byY(C.col),'l',0,90,800);wordWipe(C.ink,350,1000)}],
34:['Ring K','Rings draw inward · K wipe · word rise',(r,C)=>{const [K,W_]=big(C.ink,c=>c.h>=90);ringsDraw(C.col,0);K.forEach(c=>wipe(c,'c',950,700));maskRise(W_,1100,32)}],
35:['Split Band','Halves emerge from the band · band wipe',(r,C)=>{const b=box(C.col),mid=(b.y0+b.y1)/2;maskRise(C.ink.filter(c=>c.cy<mid),350,25,800,1);maskRise(C.ink.filter(c=>c.cy>=mid),350,25,800,-1);C.col.forEach(c=>wipe(c,'c',0,700))}],
36:['Corner Sweep','Stripes run and turn · mask rise',(r,C)=>{groupFill(C.col).sort((a,e)=>a.y0-e.y0).forEach((g,i)=>{const X=g.x0+g.t/2,Y=g.y0+g.t/2,rr=Math.max(g.t,(g.x1-g.x0)*.04+(6-i)*12+18),dd=`M${g.x1+5} ${Y}H${X+rr}A${rr} ${rr} 0 0 0 ${X} ${Y+rr}V${g.y1+5}`;g.items.forEach(c=>pathWipe(c,c.cd||dd,g.t*3.2,i*100,1300))});maskRows(C.ink,800,38,250)}],
38:['Vanishing Road','One swoop per band, top to bottom · centre word wipe',(r,C)=>{byX(C.col).forEach((c,i)=>wipe(c,'t',Math.abs(i-3)*90,1500,E.io));wordWipeC(C.ink,800,800)}],
42:['Pixel Bloom','Pixels fade in left to right · word wipe',(r,C)=>{byX(C.col).forEach((c,i)=>fade(c,i*65,350,E.lin));wordWipe(C.ink,700,800)}],
49:['Rainbow Arc','Radial arc wipes · word mask rise',(r,C)=>{const b=box(C.col);[...C.col].sort((a,e)=>e.w-a.w).forEach((a,i)=>conic(a,(b.x0+b.x1)/2,b.y1,180,.5,i*120,950));maskRise(C.ink,950,35)}],
50:['Chevron K','K wipe · chevrons slide from behind · word fade',(r,C)=>{const [K,W_]=big(C.ink,c=>c.h>80);K.forEach(c=>wipe(c,'b',0,650));byX(C.col).forEach((c,i)=>slideFade(c,-90,0,450+i*90));wordFade(W_,1000)}],
51:['Rainbow Swash','Word wipe · swoosh sweep',(r,C)=>{wordWipe(C.ink,0,950);C.col.forEach(c=>wipe(c,'l',600,1250))}],
52:['Condensed Bars','Letters rise from a mask line · bar runs',(r,C)=>{maskRise(C.ink,0,55,750);wipes(byX(C.col),'l',800,80,110,E.lin)}],
53:['Block Mark','Black blocks wipe up · colour wipes across · mask rise',(r,C)=>{const [M,W_]=big(C.ink,c=>c.h>=60);wipes(byX(M),'b',0,160,700);C.col.forEach(c=>wipe(c,'l',450,900));maskRise(W_,950,35)}],
54:['Spectrum Ticks','Ticks draw out from the word · word fade',(r,C)=>{const b=box(C.ink),mid=(b.y0+b.y1)/2,cx=(b.x0+b.x1)/2;C.col.forEach(c=>wipe(c,c.cy<mid?'b':'t',Math.abs(c.cx-cx)*5,700,E.out));wordFade(C.ink,350,900)}],
55:['Groovy Wipe','Rainbow word wipes across',(r,C)=>wordWipe(C.col,0,1500)],
56:['Petal K','K wipe · petals sweep up · word fade',(r,C)=>{const [K,W_]=big(C.ink,c=>c.h>=70);K.forEach((c,i)=>wipe(c,'t',i*120,800));C.col.forEach(c=>wipe(c,'b',650,900));wordFade(W_,1200)}],
57:['Pixel Dots','Word mask rise · dots wipe in',(r,C)=>{maskRise(C.ink,0,35);wipes(byX(C.col),'l',600,80,260,E.lin)}],
58:['Ribbon','Ribbon unfurls along its fold · mask rise',(r,C)=>{const b=box(C.col),X=f=>b.x0+(b.x1-b.x0)*f,Y=f=>b.y0+(b.y1-b.y0)*f;C.col.forEach(c=>pathWipe(c,`M${X(1.1)} ${Y(.1)}L${X(.1)} ${Y(.26)}C${X(-.1)} ${Y(.36)} ${X(.1)} ${Y(.5)} ${X(.5)} ${Y(.5)}C${X(1.1)} ${Y(.52)} ${X(1.1)} ${Y(.72)} ${X(.5)} ${Y(.8)}L${X(-.1)} ${Y(.95)}`,(b.x1-b.x0)*.58,0,1500));maskRise(C.ink,1000,35)}],
59:['Thin + Bold','Halves slide out of the seam · underline wipe',(r,C)=>{const b=box(C.ink),cut=b.x0+(b.x1-b.x0)*.37,A=C.ink.filter(c=>c.cx<cut),B=C.ink.filter(c=>c.cx>=cut),ba=box(A),bb=box(B),seam=(ba.x1+bb.x0)/2,p=8;
  maskSlide(A,seam-ba.x0,0,{x0:b.x0-p,y0:b.y0-p,x1:seam,y1:b.y1+p},0);maskSlide(B,seam-bb.x1,0,{x0:seam,y0:b.y0-p,x1:b.x1+p,y1:b.y1+p},0);C.col.forEach(c=>wipe(c,'c',600,900))}],
60:['Swirl Orb','Full radial sweep · word mask rise',(r,C)=>{const b=box(C.col);C.col.forEach(c=>conic(c,(b.x0+b.x1)/2,(b.y0+b.y1)/2,-90,1,0,1400));maskRise(C.ink,950,35)}],
61:['Echo K','K slides in · layers wipe out of it · word rise',(r,C)=>{const [K,W_]=big(C.ink,c=>c.h>80);K.forEach(c=>slideFade(c,60,0,0,700));byX(C.col).reverse().forEach((c,i)=>wipe(c,'r',350+i*45,750,E.out));maskRise(W_,1100,30)}],
62:['Orbit','Orbit draws around · word fade',(r,C)=>{const b=box(C.col),cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2;byY(C.col).forEach((c,i)=>conic(c,cx,cy,i?-30:150,.56,i*850,900,E.lin));wordFade(C.ink,500,1000)}],
63:['Tile K','Stem wipes · tiles wipe in turn · word rise',(r,C)=>{const [St,W_]=big(C.ink,c=>c.h>=45);St.forEach(c=>wipe(c,c.cy<(C.bb[1]+C.bb[3])/2?'t':'b',0,600));const D='ltrb';[...C.col].sort((a,e)=>Math.hypot(a.cx-130,a.cy-130)-Math.hypot(e.cx-130,e.cy-130)).forEach((c,i)=>wipe(c,D[i%4],300+i*100,500));maskRise(W_,1150,30)}],
64:['Colour Sweep','Letters rise in black · colour fades through',(r,C)=>{
  const all=byX([...C.ink,...C.col]),b=box(all),p=8,H=b.y1-b.y0+2*p,seq=[];
  all.forEach(c=>{seq.push(c);if(c.k==='col'){const o=c.el.cloneNode();o.setAttribute('fill','#0d0d10');o.setAttribute('stroke','#0d0d10');o.classList.remove('tc');c.el.parentNode.appendChild(o);seq.push({...c,el:o,ov:1})}});
  clipGroup(seq,{x0:b.x0-p,y0:b.y0-p,x1:b.x1+p,y1:b.y1+p});
  let i=0;all.forEach(c=>{seq.filter(s=>s.cx===c.cx&&s.cy===c.cy).forEach(s=>{an(s.el,[{transform:`translateY(${H}px)`},{transform:'translateY(0px)'}],{t:i*55,d:800});if(s.ov)an(s.el,[{opacity:1},{opacity:0}],{t:1100+i*70,d:600,e:E.io})});i++})}],
D01:['Beam Tower','Pillars wipe up · beam fans out · word wipe',(r,C)=>{const [T,W_]=big(C.ink,c=>c.h>100);byX(T).forEach((c,i)=>wipe(c,'b',i*170,750));wipes(byY(C.col),'l',600,70,900);wordWipe(W_,450,800)}],
D02:['Block Stairs','Rows rise · stairs wipe up',(r,C)=>{maskRows(C.ink,0,40);wipes(byX(C.col),'b',600,90,600)}],
D03:['Deco Building','Roof wipe · stripes rise · word wipe',(r,C)=>{const [B,W_]=big(C.ink,c=>c.w>200);B.forEach((c,i)=>wipe(c,'l',i*220,950));wipes(byX(C.col),'b',480,80,600);wordWipe(W_,850,900)}],
D04:['Atom','Orbit sweep · electrons fade · word rise',(r,C)=>{const [O,W_]=big(C.ink,c=>c.h>80),b=box(O);O.forEach(c=>conic(c,(b.x0+b.x1)/2,(b.y0+b.y1)/2,-90,1,0,1200));C.col.forEach((c,i)=>fade(c,750+i*110,400));maskRise(W_,750,32)}],
D05:['Sawtooth Wedges','Wedges wipe across · word wipe',(r,C)=>{wipes(byX(C.col),'l',0,110,350,E.lin);wordWipe(C.ink,450,1000)}],
D06:['Star Swoosh','Swooshes sweep · star fade · word wipe',(r,C)=>{const [S_,W_]=big(C.ink,c=>c.h>100),b=box(C.col),mid=(b.y0+b.y1)/2;C.col.filter(c=>c.cy<mid).forEach(c=>wipe(c,'l',0,1200));C.col.filter(c=>c.cy>=mid).forEach(c=>wipe(c,'r',220,1200));S_.forEach(c=>wipe(c,'m',500,700));wordWipe(W_,750,800)}],
D07:['Bullseye','Rings sweep around · mask rise',(r,C)=>{const b=box(C.col);[...C.col].sort((a,e)=>e.w-a.w).forEach((c,i)=>conic(c,(b.x0+b.x1)/2,(b.y0+b.y1)/2,-90,1,i*110,800));maskRows(C.ink,600)}],
D08:['Band Frame','Bands wipe from both sides · centre word wipe',(r,C)=>{const [T,B]=rowsOf(C.col);wipes(byX(T),'l',0,70,120,E.lin);wipes(byX(B).reverse(),'r',0,70,120,E.lin);wordWipeC(C.ink,500)}],
D09:['Block K','Blocks wipe · arms run out · word wipe',(r,C)=>{const [K,W_]=big(C.ink,c=>c.h>=40&&c.cx<240);K.forEach((c,i)=>wipe(c,i%2?'b':'t',i*140,600));const b=box(C.col);armsWipe(C.col,(b.y0+b.y1)/2,450);wordWipe(W_,900,800)}],
D10:['Rainbow Loop','Band sweep · word mask rise',(r,C)=>{wipes(byY(C.col),'l',0,90,1000);maskRise(C.ink,750,38)}],
D11:['K Runway','K wipe · stripes run out · word rise',(r,C)=>{const [K,W_]=big(C.ink,c=>c.h>70);K.forEach(c=>wipe(c,'l',0,700));wipes(byY(C.col),'l',350,90,1000);maskRise(W_,950,30)}],
D12:['Arch Caps','Radial arc wipes · mask rise',(r,C)=>{const b=box(C.col);[...C.col].sort((a,e)=>e.w-a.w).forEach((c,i)=>conic(c,(b.x0+b.x1)/2,b.y1,180,.5,i*110,950));maskRise(C.ink,800,28)}],
D13:['Isometric Steps','Columns wipe up · tops fade · word wipe',(r,C)=>{const [K,W_]=big(C.ink,c=>c.h>=36);wipes(byX(K),'b',0,95,650);byX(C.col).forEach((c,i)=>fade(c,300+i*95,450));wordWipe(W_,750,800)}],
D14:['Slant Bands','Parallelograms slide in · word wipe',(r,C)=>{const [T,B]=rowsOf(C.col);byX(T).forEach((c,i)=>slideFade(c,-110,0,i*85));byX(B).reverse().forEach((c,i)=>slideFade(c,110,0,i*85));wordWipe(C.ink,450,900)}],
D15:['Sunrise Ramp','Sun rises · stairs wipe · ramp stripes · word fade',(r,C)=>{const [S_,R_]=big(C.col,c=>c.cx<170),[K,W_]=big(C.ink,c=>c.h>50);S_.forEach(c=>slideFade(c,0,40,0,1000));K.forEach(c=>wipe(c,'b',300,700));wipes(byX(R_),'b',500,65,500);wordFade(W_,1050)}],
C01:['Italic Stripe Slab','Stripe sweep · word wipe',(r,C)=>{wipes(byY(C.col),'l',0,90,800);wordWipe(C.ink,550,1000)}],
C02:['Chevron Slab K','Stem wipe · chevrons slide · rows rise',(r,C)=>{const [K,W_]=big(C.ink,c=>c.h>120);K.forEach(c=>wipe(c,'b',0,600));byX(C.col).forEach((c,i)=>slideFade(c,-90,0,400+i*70));maskRows(W_,900)}],
C03:['Tall Caps Bar','Letters rise from a mask line · bar runs',(r,C)=>{maskRise(C.ink,0,50,750);wipes(byX(C.col),'l',750,80,110,E.lin)}],
C04:['Rainbow Tail','Stripes travel · word fade',(r,C)=>{groupFill(C.col).sort((a,e)=>a.y1-e.y1).forEach((g,i)=>{const X=g.x0+g.t/2,Yb=g.y1-g.t/2,rr=Math.max(12,(Yb-g.y0)*.55),dd=`M${X} ${g.y0-5}V${Yb-rr}A${rr} ${rr} 0 0 0 ${X+rr} ${Yb}H${g.x1+5}`;g.items.forEach(c=>pathWipe(c,c.cd||dd,g.t*3,i*110,1200))});wordFade(C.ink,500,900)}],
C05:['Framed Slants','Frame wipe · mask rise · cards wipe',(r,C)=>{const [F,W_]=big(C.ink,c=>c.w>300);F.forEach(c=>wipe(c,'l',0,900));maskRise(W_,350,30);wipes(byX(C.col),'l',700,90,350,E.lin)}],
C06:['Compact Lowercase','Word rise · chips wipe',(r,C)=>{maskRise(C.ink,0,36);wipes(byX(C.col),'l',450,90,350,E.lin)}],
C07:['Colour Wheel','Wheel sweeps round · hub fade · stripes wipe · rows rise',(r,C)=>{const [S_,Wh]=big(C.col,c=>c.h<18),[Hub,W_]=big(C.ink,c=>c.h>60),b=box(Hub);Wh.forEach(c=>conic(c,(b.x0+b.x1)/2,(b.y0+b.y1)/2,-90,1,0,1200));Hub.forEach(c=>fade(c,500,600));wipes(byY(S_),'l',800,70,600);maskRows(W_,800,28)}],
C08:['Rising Bars','Bars wipe up · mask rise',(r,C)=>{wipes(byX(C.col),'b',0,110,700);maskRise(C.ink,800,28)}],
C09:['Sliced Band','Halves emerge from the band · band wipe',(r,C)=>{const b=box(C.col),mid=(b.y0+b.y1)/2;maskRise(C.ink.filter(c=>c.cy<mid),350,25,800,1);maskRise(C.ink.filter(c=>c.cy>=mid),350,25,800,-1);C.col.forEach(c=>wipe(c,'c',0,700))}],
Star:['Night Rainbow','Radial sweep · stars fade · word rise',(r,C)=>{const [D,rest]=big(C.ink,c=>c.h>150),b=box(D),cx=(C.bb[0]+C.bb[2])/2,cy=b.y1,[W_,inner]=big(rest,c=>c.y0>cy-2);D.forEach(c=>conic(c,cx,cy,180,.5,0,1100));[...C.col,...inner].sort((a,e)=>a.x0-e.x0).forEach((c,i)=>conic(c,cx,cy,180,.5,120+i*85,1000));C.pap.forEach((c,i)=>fade(c,1200+i*170,400));maskRise(W_,800,36)}],
};
const DEFAULT_REVEAL=['Traced logo','Colour wipe · word wipe',(r,C)=>{wipes(byX(C.col),'l',0,70,800);wordWipe(C.ink,500,900)}];
