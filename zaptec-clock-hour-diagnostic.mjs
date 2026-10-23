// Diagnostic only: no raw readings or prices exposed.
export function diagnoseClockHours(sessions) {
  const r={sessions:0,usable:0,invalid:0,midnight:0,midnightUsable:0,
    firstZero:0,lastPositive:0,clockAligned:0,clockTotal:0,
    intervalsCrossingMidnight:0,gapsOver90Minutes:0,negativeOrDuplicate:0,
    conclusion:'unconfirmed'};
  for(const s of sessions||[]) {
    r.sessions++;
    const start=Date.parse(s.startTime),end=Date.parse(s.endTime);
    const points=(Array.isArray(s.energyDetails)?s.energyDetails:[])
      .map(p=>({t:Date.parse(p.timestamp),e:Number(p.energyKWh)}))
      .sort((a,b)=>a.t-b.t);
    const crosses=Number.isFinite(start)&&Number.isFinite(end)&&
      new Date(start).toISOString().slice(0,10)!==new Date(end).toISOString().slice(0,10);
    if(crosses)r.midnight++;
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||
      points.length<2||points.some((p,i)=>!Number.isFinite(p.t)||
      !Number.isFinite(p.e)||p.e<0||(i&&p.t<=points[i-1].t))) {
      r.invalid++;continue;
    }
    r.usable++;if(crosses)r.midnightUsable++;
    if(points[0].e===0)r.firstZero++;
    if(points.at(-1).e>0)r.lastPositive++;
    for(let i=0;i<points.length;i++){
      const p=points[i],d=new Date(p.t);
      r.clockTotal++;
      if(d.getUTCMinutes()===0&&d.getUTCSeconds()===0)r.clockAligned++;
      if(i){
        const prev=points[i-1];
        if(p.t-prev.t>90*60000)r.gapsOver90Minutes++;
        if(new Date(prev.t).toISOString().slice(0,10)!==
          new Date(p.t).toISOString().slice(0,10))r.intervalsCrossingMidnight++;
      }
    }
  }
  return r;
}
