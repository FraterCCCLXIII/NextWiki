export function layoutCallouts(entries,bounds,width,height){
 const groups=[[],[]],center=(bounds.left+bounds.right)/2;
 for(const e of entries){const side=Math.abs(e.x-center)<10?(groups[0].length<=groups[1].length?0:1):(e.x<center?0:1);groups[side].push(e);}
 const output=[];
 groups.forEach((items,side)=>{const room=side?width-bounds.right-30:bounds.left-30,labelWidth=Math.min(175,room);if(labelWidth<95){items.forEach(e=>output.push({...e,hidden:true}));return;}items.sort((a,b)=>a.y-b.y);let bottom=74;for(const e of items){e.height=Math.max(25,Math.ceil(e.text.length*5.15/labelWidth)*12+12);e.top=Math.max(bottom,Math.min(height-150-e.height,e.y-e.height/2));bottom=e.top+e.height+10;}
 let next=height-150;for(let i=items.length-1;i>=0;i--){const e=items[i];e.top=Math.min(e.top,next-e.height);next=e.top-10;}
 for(const e of items){if(e.top<65){output.push({...e,hidden:true});continue;}const x=side?bounds.right+22:bounds.left-22-labelWidth,edgeX=side?x:x+labelWidth,elbow=side?edgeX-12:edgeX+12,labelY=e.top+e.height/2;output.push({...e,labelX:x,labelY:e.top,width:labelWidth,hidden:false,points:`${e.x},${e.y} ${elbow},${e.y} ${elbow},${labelY} ${edgeX},${labelY}`});}});return output;
}
