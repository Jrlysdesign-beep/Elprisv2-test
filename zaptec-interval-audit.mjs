// Read-only audit: preserve unknown distribution, never assign costs to long intervals.
export function auditZaptecIntervals(sessions) {
  const intervals=[];
  for(const session of sessions||[]){
    const pts=(session.energyDetails||[]).map(p=>({t:Date.parse(p.timestamp),e:Number(p.energyKWh)})).sort((a,b)=>a.t-b.t);
    for(let i=1;i<pts.length;i++){
      const a=pts[i-1],b=pts[i];
      if(!Number.isFinite(a.t)||!Number.isFinite(b.t)||!Number.isFinite(b.e)||b.e<=0||b.t<=a.t)continue;
      const hours=(b.t-a.t)/3600000;
      const crosses=Math.floor(a.t/3600000)!==Math.floor((b.t-1)/3600000);
      if(hours>1.5||crosses)intervals.push({
        sessionStart:session.startTime,from:new Date(a.t).toISOString(),to:new Date(b.t).toISOString(),
        durationMinutes:Math.round(hours*60),kwh:b.e,averageKw:b.e/hours,
        reason:hours>1.5?'long-positive-interval':'cross-hour-interval'
      });
    }
  }
  return {intervals,totalKwh:intervals.reduce((n,p)=>n+p.kwh,0)};
}
