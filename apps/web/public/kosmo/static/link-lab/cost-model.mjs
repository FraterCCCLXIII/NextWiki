export const presets={
 beacon:{name:'Beacon / nanosatellite',nre:400000,qual:120000,test:25000,assembly:15000,ops:20000,rows:[['Structure',3,12000],['Radio & antennas',1,22000],['Power electronics & batteries',1,18000],['Control & harness',1,20000]]},
 compact:{name:'Compact relay',nre:1500000,qual:400000,test:80000,assembly:60000,ops:50000,rows:[['Structure',12,60000],['Radio & reflector',15,130000],['Power electronics & batteries',10,70000],['Avionics & attitude control',8,150000],['Thermal & harness',5,40000]]},
 solar:{name:'Solar relay',nre:5000000,qual:1000000,test:250000,assembly:200000,ops:100000,rows:[['Two deployable reflectors',90,500000],['Structure',70,200000],['Radio & modem',15,300000],['Power electronics & storage',50,250000],['Radiators',40,120000],['Optional cooling',10,150000],['Radiation shield',80,70000],['Harness',15,50000],['Attitude control',20,180000]]},
 relay:{name:'Nuclear relay / speculative',nre:25000000,qual:5000000,test:1000000,assembly:750000,ops:500000,rows:[['Two deployable reflectors',90,500000],['Structure & boom',100,400000],['Radio & modem',15,300000],['Nuclear power allowance',350,15000000],['Radiators',80,500000],['Optional cooling',10,150000],['Radiation shield',100,200000],['Harness',20,100000],['Attitude control',30,250000]]},
 archive:{name:'Archive node',nre:2000000,qual:500000,test:100000,assembly:80000,ops:50000,rows:[['Shielded archive capsule',100,300000],['Passive optical records',10,200000],['Radio & antenna',15,100000],['Power electronics & batteries',20,120000],['Structure & attitude control',25,180000]]}
};
export function calculate(s){
 const q=Math.max(1,Math.floor(s.quantity)),discount=Math.max(0,Math.min(.8,s.discount/100));
 const dry=s.rows.reduce((a,r)=>a+r[1],0),hardware=s.rows.reduce((a,r)=>a+r[2],0)*(1-discount),launchMass=dry*(1+s.margin/100)+s.adapter;
 const perBuild=hardware+s.assembly+s.test,manufacturing=perBuild*q,nonrec=s.nre+s.qual;
 let launch=q*(s.minimum+Math.max(0,launchMass-s.included)*s.rate),flights=q;
 if(s.launchMode==='dedicated'){const perFlight=Math.floor(s.capacity/launchMass);flights=perFlight>0?Math.ceil(q/perFlight):0;launch=flights*s.flightPrice;}
 const integration=q*s.integration,operations=q*s.ops*s.years,extension=s.extension;
 const subtotal=nonrec+manufacturing+launch+integration+operations+extension,contingency=subtotal*s.contingency/100,total=subtotal+contingency;
 const reasons=[];if(s.launchMode==='rideshare'&&launchMass>831)reasons.push('Mass exceeds the published 831 kg standard-port limit: this is only a price extrapolation; obtain a custom launch quote.');if(s.launchMode==='dedicated'&&flights===0)reasons.push('One unit exceeds the configured launch capacity. Launch is unpriced.');if(s.node==='relay')reasons.push('Nuclear system costs are placeholders. Development, approvals and launch acceptance are unresolved; this is not a procurement or approved launch estimate.');if(s.destination!=='orbit')reasons.push('Beyond-orbit delivery is not modeled. The mission allowance does not establish propulsion, trajectory, braking or interstellar feasibility.');
 return {q,dry,hardware,launchMass,manufacturing,nonrec,launch,integration,operations,extension,subtotal,contingency,total,perUnit:total/q,flights,reasons,parts:[['Development & qualification',nonrec],['Manufacturing, assembly & testing',manufacturing],['Launch service',launch],['Launch integration',integration],['Operations',operations],['Beyond-orbit allowance',extension],['Contingency',contingency]]};
}
