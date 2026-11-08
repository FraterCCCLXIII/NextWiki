export const solarDefaults={beacon:20,compact:250,solar:2500,archive:100,relay:1000};
export function sizeSolar({load,distance=1,luminosity=1,efficiency=30,reserve=25,packing=88,conversion=90,eol=80,incidence=0}){
 const irradiance=1361*luminosity/distance**2,cos=Math.cos(incidence*Math.PI/180),density=irradiance*(efficiency/100)*(packing/100)*(conversion/100)*(eol/100)*cos;
 const required=load*(1+reserve/100),area=required/density,wingArea=area/2;
 const length=Math.sqrt(wingArea*1.8),width=Math.sqrt(wingArea/1.8);
 return {irradiance,density,required,area,wingArea,length,width,mass:area*4+Math.max(.3,Math.sqrt(area)*1.5),cost:area*12000+2500};
}
