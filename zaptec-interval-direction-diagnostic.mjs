// Diagnostic only. Neither candidate establishes the API's timestamp semantics.
// No raw timestamps or energy values are returned or logged.
export function diagnoseIntervalDirection(sessions) {
  const result={sessions:0,usable:0,invalid:0,firstNearStart:0,lastNearEnd:0,
    bothNear:0,firstPositive:0,lastPositive:0,ambiguous:0,
    conclusion:'unconfirmed'};
  for(const session of sessions) {
    result.sessions++;
    const start=Date.parse(session.startTime),end=Date.parse(session.endTime);
    const points=(session.energyDetails||[]).map(p=>({
      time:Date.parse(p.timestamp),energy:Number(p.energyKWh)
    })).sort((a,b)=>a.time-b.time);
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||
       points.length<2||points.some((p,i)=>!Number.isFinite(p.time)||
       !Number.isFinite(p.energy)||p.energy<0||
       (i>0&&p.time<=points[i-1].time))) {result.invalid++;continue;}
    result.usable++;
    const nearStart=Math.abs(points[0].time-start)<=600000;
    const nearEnd=Math.abs(points.at(-1).time-end)<=600000;
    if(nearStart)result.firstNearStart++;
    if(nearEnd)result.lastNearEnd++;
    if(nearStart&&nearEnd)result.bothNear++;
    if(points[0].energy>0)result.firstPositive++;
    if(points.at(-1).energy>0)result.lastPositive++;
    // Boundary proximity alone cannot distinguish interval-start from interval-end.
    result.ambiguous++;
  }
  return result;
}
