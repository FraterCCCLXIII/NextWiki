import {finPlan} from './fin-model.js';
import * as T from './three.module.js';
export {stageHardwareMass} from './stage-hardware-mass.js';
export function addStageHardware(parent,s,options={}){
const deployed=options.legs??true,portOpen=options.docking??true,r=s.diameter/2,base=s.base||0,body=s.bodyBase??base+.9,top=base+s.height;
const metal=new T.MeshStandardMaterial({color:'#98aaa0',metalness:.7,roughness:.4}),dark=new T.MeshStandardMaterial({color:'#294238',metalness:.45,roughness:.5}),gold=new T.MeshStandardMaterial({color:'#d8a16b',metalness:.5}),ivory=new T.MeshStandardMaterial({color:'#e0e6d4',metalness:.3});
function mesh(geometry,material,position,root=parent){const o=new T.Mesh(geometry,material);o.position.set(...position);o.castShadow=true;o.receiveShadow=true;root.add(o);return o}
function strut(a,b,radius,material,root){const va=new T.Vector3(...a),vb=new T.Vector3(...b),delta=vb.clone().sub(va);const o=mesh(new T.CylinderGeometry(radius,radius,delta.length(),12),material,va.add(vb).multiplyScalar(.5).toArray(),root);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize())}
const deployment=options.legDeployment??(deployed?1:0),legSpan=Math.min(3.3,r*.8+.4),mount=Math.min(top-.8,body+2.4),foot=r+.25+(legSpan-.25)*deployment,end=(body+.2)*(1-deployment)+(base-.85)*deployment;
// Fin planes lie at 0/90/180/270 degrees; legs occupy the intervening 45-degree bays.

for(let j=0;j<4;j++){const root=new T.Group();root.name="Fin assembly "+j;root.rotation.y=j*Math.PI/2;parent.add(root);const f=finPlan(s,options.aero),tail=f.pattern==='wing'&&j%2===1,ratio=tail?.32:1,rootChord=f.root*ratio,tipChord=f.tip*ratio,span=f.span*ratio,sweep=f.sweep*ratio,fin=new T.Shape();fin.moveTo(r,body+rootChord+.2);fin.lineTo(r+span,body+rootChord+.2-sweep);fin.lineTo(r+span,body+rootChord+.2-sweep-tipChord);fin.lineTo(r,body+.2);fin.closePath();mesh(new T.ExtrudeGeometry(fin,{depth:.045,bevelEnabled:false}),dark,[0,0,-.022],root);
const leg=new T.Group();leg.name='Landing leg assembly '+j;leg.rotation.y=Math.PI/4+j*Math.PI/2;parent.add(leg);
strut([r+.12,mount,0],[foot,end,0],.065,metal,leg);strut([r+.12,Math.min(top-.5,mount+.8),0],[Math.max(r+.2,foot-.15),end+.45,0],.035,ivory,leg);mesh(new T.SphereGeometry(.12,12,8),gold,[r+.12,mount,0],leg);mesh(new T.BoxGeometry(.12+.53*deployment,.65-.53*deployment,.5),dark,[foot,end,0],leg)}
// Common side servicing port: IDSS-inspired depiction, not tolerance-accurate IDSS geometry.
// Kept outside the tank volume; spacecraft integration behind the collar is unresolved.
const port=new T.Group();port.position.set(0,top-.65,r+.1);port.name='Common stage servicing port';parent.add(port);
const collar=mesh(new T.CylinderGeometry(.7,.7,.18,32),metal,[0,0,0],port);collar.rotation.x=Math.PI/2;
const disk=mesh(new T.CircleGeometry(.47,32),dark,[0,0,.1],port);
for(const [radius,tube,z] of [[.62,.045,.13],[.5,.025,.16]])mesh(new T.TorusGeometry(radius,tube,8,48),gold,[0,0,z],port);
for(let j=0;j<3;j++){const a=j*Math.PI*2/3;const petal=mesh(new T.BoxGeometry(.18,.25,.15),ivory,[Math.cos(a)*.58,Math.sin(a)*.58,.22],port);petal.rotation.z=a-Math.PI/2}
for(let j=0;j<12;j++){const a=j*Math.PI/6;const latch=mesh(new T.BoxGeometry(.06,.10,.07),dark,[Math.cos(a)*.65,Math.sin(a)*.65,.17],port);latch.rotation.z=a}
const cover=mesh(new T.CircleGeometry(.72,48),ivory,[portOpen?.95:0,0,portOpen?.27:.31],port);cover.rotation.y=portOpen?Math.PI/3:0;
parent.userData.hardware={fins:4,legs:4,dockingPorts:1,portDiameter:1.4,finAzimuthDegrees:[0,90,180,270],legAzimuthDegrees:[45,135,225,315]};return parent.userData.hardware;
}
