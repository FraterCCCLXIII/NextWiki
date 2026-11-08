onmessage=({data:{settings:q,truth,points,mask,N,B}})=>{
try{
let seed=42;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return(seed+.5)/4294967296},normal=()=>Math.sqrt(-2*Math.log(rand()))*Math.cos(2*Math.PI*rand());
const P=N*N,raster=q.instrument.raster,count=Math.max(1,Math.round(raster*raster*q.coverage/100)),rows=count*B,sigma=q.blurDegrees*Math.PI/180,cut=Math.min(Math.PI/2,sigma*Math.sqrt(-2*Math.log(.001))),scans=Array.from({length:count},(_,s)=>({x:(s%raster+.5)/raster*2-1,y:(Math.floor(s/raster)+.5)/raster*2-1}));
let expected=count*P*B*Math.min(1,2*cut/Math.PI)*.8;
if(expected>24000000)throw Error('This configuration exceeds the browser computation budget. Use an 8 × 8 raster for 128², a smaller reconstruction grid, or a larger aperture to narrow ring blur.');
let rowI=Array.from({length:rows},()=>[]),rowV=Array.from({length:rows},()=>[]),entries=0;
for(let s=0;s<count;s++){
for(let i=0;i<P;i++){if(!mask[i])continue;let dx=points[i].x-scans[s].x,dy=points[i].y-scans[s].y,phi=Math.atan2(dy,dx),w=1/Math.sqrt(dx*dx+dy*dy+.0064);
for(let b=0;b<B;b++){let d=Math.acos(Math.min(1,Math.abs(Math.cos(b/B*2*Math.PI-phi))));if(d>cut)continue;let r=s*B+b;rowI[r].push(i);rowV[r].push(w*Math.exp(-.5*(d/sigma)**2));entries++}}
if(s%8===0)postMessage({type:'status',text:'Building sparse optical operator · '+(s+1)+' / '+count+' scans'});
}
let offsets=new Uint32Array(rows+1),indices=new Uint16Array(entries),weights=new Float32Array(entries),k=0,norm=new Float64Array(P);
for(let r=0;r<rows;r++){offsets[r]=k;indices.set(rowI[r],k);weights.set(rowV[r],k);k+=rowI[r].length;rowI[r]=null;rowV[r]=null}offsets[rows]=k;rowI=null;rowV=null;
let Y=Array.from({length:rows},()=>[0,0,0]);
for(let r=0;r<rows;r++)for(let a=offsets[r];a<offsets[r+1];a++){let i=indices[a],w=weights[a];norm[i]+=w;for(let c=0;c<3;c++)Y[r][c]+=w*truth[i][c]}
for(let s=0;s<count;s++){let sum=0;for(let b=0;b<B;b++)sum+=Y[s*B+b].reduce((a,v)=>a+v,0);let factor=q.photons/sum;for(let b=0;b<B;b++)for(let c=0;c<3;c++){let mu=Y[s*B+b][c]*factor,k;if(mu<30){let l=Math.exp(-mu),prod=1;k=-1;do{k++;prod*=rand()}while(prod>l)}else k=Math.max(0,Math.round(mu+Math.sqrt(mu)*normal()));Y[s*B+b][c]=Math.max(0,k+normal()*Math.sqrt(q.instrument.dark*q.instrument.t+q.instrument.read**2))/factor}}
postMessage({type:'measurements',Y,scans});
let est=new Float64Array(P*3);for(let i=0;i<P;i++)if(mask[i])est.fill(.3,i*3,i*3+3);
for(let it=0;it<q.iterations;it++){let corr=new Float64Array(P*3);for(let r=0;r<rows;r++){let pr=0,pg=0,pb=0;for(let a=offsets[r];a<offsets[r+1];a++){let i=indices[a]*3,w=weights[a];pr+=w*est[i];pg+=w*est[i+1];pb+=w*est[i+2]}let rr=Y[r][0]/Math.max(pr,1e-10),rg=Y[r][1]/Math.max(pg,1e-10),rb=Y[r][2]/Math.max(pb,1e-10);for(let a=offsets[r];a<offsets[r+1];a++){let i=indices[a]*3,w=weights[a];corr[i]+=w*rr;corr[i+1]+=w*rg;corr[i+2]+=w*rb}}
for(let i=0;i<P;i++)if(mask[i])for(let c=0;c<3;c++)est[i*3+c]*=corr[i*3+c]/Math.max(norm[i],1e-10);
if(it%2===0||it===q.iterations-1){let error=0,n=0,estimate=Array.from({length:P},(_,i)=>Array.from(est.slice(i*3,i*3+3)));for(let i=0;i<P;i++)if(mask[i])for(let c=0;c<3;c++){error+=(est[i*3+c]-truth[i][c])**2;n++}postMessage({type:'result',estimate,error:Math.sqrt(error/n),iteration:it+1,done:it===q.iterations-1})}}
}catch(e){postMessage({type:'error',text:e.message})}};
