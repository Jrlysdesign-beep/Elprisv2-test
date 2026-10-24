// Estimated session pricing using archived Zaptec interval energy and actual quarter-hour prices.
// An energyDetails point describes the interval ending at its timestamp.
// Zero-energy intervals are excluded only when consecutive boundaries are known.
export function estimateChargingSession(session, quarterPrices, priceAt) {
  const start=Date.parse(session.startTime), end=Date.parse(session.endTime);
  const energy=session.energyKWh;
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>48*3600000||!Number.isFinite(energy)||energy<0)
    return {status:'invalid'};
  const points=(session.energyDetails||[]).filter(p=>Number.isFinite(Date.parse(p.timestamp))&&Number.isFinite(p.energyKWh)&&p.energyKWh>=0)
    .map(p=>({t:Date.parse(p.timestamp),kwh:p.energyKWh})).sort((a,b)=>a.t-b.t);
  const sum=points.reduce((n,p)=>n+p.kwh,0);
  const trustworthy=points.length>=2 && points.every((p,i)=>!i||p.t>points[i-1].t) &&
    Math.abs(sum-energy)<=Math.max(.15,energy*.02);
  const excluded=[];
  if(trustworthy) {
    for(let i=1;i<points.length;i++){
      if(points[i].kwh!==0)continue;
      const a=Math.max(start,points[i-1].t), b=Math.min(end,points[i].t);
      // Only accept a known interval no longer than 90 minutes.
      if(b>a && points[i].t-points[i-1].t<=90*60000)excluded.push([a,b]);
    }
  }
  const active=end-start-excluded.reduce((n,[a,b])=>n+b-a,0);
  if(active<=0)return energy===0?{status:'priced',cost:0,energyKWh:0,excludedMinutes:(end-start)/60000}:{status:'unknown'};
  const prices=new Map(quarterPrices.filter(p=>Number.isFinite(p.quarter)&&Number.isFinite(p.spot)).map(p=>[p.quarter,p.spot]));
  let weighted=0,covered=0;
  for(let t=start;t<end;){
    const q=Math.floor(t/900000)*900000,next=Math.min(end,q+900000);
    const blocked=excluded.reduce((n,[a,b])=>n+Math.max(0,Math.min(next,b)-Math.max(t,a)),0);
    const duration=next-t-blocked;
    if(duration>0){
      const spot=prices.get(q);
      if(spot===undefined)return {status:'missing-prices',excludedMinutes:(end-start-active)/60000};
      const price=priceAt(spot,new Date(q));
      if(!Number.isFinite(price))return {status:'missing-prices'};
      weighted+=duration*price;covered+=duration;
    }
    t=next;
  }
  if(Math.abs(covered-active)>1)return {status:'unknown'};
  return {status:'priced',cost:energy*weighted/active,energyKWh:energy,
    excludedMinutes:(end-start-active)/60000,activeMinutes:active/60000,
    usedZeroIntervals:trustworthy,averagePrice:weighted/active};
}
