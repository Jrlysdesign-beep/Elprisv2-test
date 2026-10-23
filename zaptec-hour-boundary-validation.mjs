// Privacy-preserving structural validation. No prices or raw readings are exposed.
// Classifies interval-end hypothesis only; does not assert Zaptec API semantics.
export function diagnoseHourBoundaries(sessions) {
  const r={sessions:0,usable:0,invalid:0,firstZero:0,firstNearStart:0,
    nonHourInterior:0,interior:0,interiorOnHour:0,
    lastNearEnd:0,lastOffHour:0,shortIntervals:0,normalIntervals:0,
    longIntervals:0,longWithEnergy:0,longWithoutEnergy:0,
    midnightIntervals:0,midnightWithEnergy:0,
    totalMatches:0,totalMismatch:0,zeroEnergySessions:0,
    inferredEndCompatible:0,unconfirmed:0};
  for(const s of sessions||[]){
    r.sessions++;
    const start=Date.parse(s.startTime),end=Date.parse(s.endTime);
    const pts=(Array.isArray(s.energyDetails)?s.energyDetails:[])
      .map(p=>({t:Date.parse(p.timestamp),e:Number(p.energyKWh)}))
      .sort((a,b)=>a.t-b.t);
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||
       pts.length<2||pts.some((p,i)=>!Number.isFinite(p.t)||!Number.isFinite(p.e)||
         p.e<0||(i>0&&p.t<=pts[i-1].t))){
      r.invalid++;continue;
    }
    r.usable++;
    const nearStart=Math.abs(pts[0].t-start)<=600000;
    const nearEnd=Math.abs(pts.at(-1).t-end)<=600000;
    if(nearStart)r.firstNearStart++;
    if(nearEnd)r.lastNearEnd++;
    if(pts[0].e===0)r.firstZero++;
    if(new Date(pts.at(-1).t).getUTCMinutes()!==0)r.lastOffHour++;
    let regular=true;
    for(let i=1;i<pts.length;i++){
      const prev=pts[i-1],p=pts[i],dt=p.t-prev.t;
      if(dt<45*60000)r.shortIntervals++;
      else if(dt<=90*60000)r.normalIntervals++;
      else {r.longIntervals++;if(p.e>0)r.longWithEnergy++;else r.longWithoutEnergy++;regular=false;}
      if(i<pts.length-1){
        r.interior++;
        const d=new Date(p.t);
        if(d.getUTCMinutes()===0&&d.getUTCSeconds()===0)r.interiorOnHour++;
        else {r.nonHourInterior++;regular=false;}
      }
      // UTC day boundary is not a Danish local midnight; report explicitly as UTC.
      if(new Date(prev.t).toISOString().slice(0,10)!==new Date(p.t).toISOString().slice(0,10)){
        r.midnightIntervals++;if(p.e>0)r.midnightWithEnergy++;
      }
    }
    const sum=pts.reduce((a,p)=>a+p.e,0),total=Number(s.energyKWh);
    if(Number.isFinite(total)){
      if(Math.abs(sum-total)<=Math.max(.15,Math.abs(total)*.02))r.totalMatches++;
      else r.totalMismatch++;
      if(total===0)r.zeroEnergySessions++;
    }
    if(nearStart&&nearEnd&&pts[0].e===0&&regular)r.inferredEndCompatible++;
    else r.unconfirmed++;
  }
  return r;
}
