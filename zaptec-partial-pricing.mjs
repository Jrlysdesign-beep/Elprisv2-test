// Experimental partial pricing. Only intervals wholly inside one UTC hour are priced.
// The interval-end interpretation remains provisional.
export function priceZaptecSessionPartially(session, hourlyPrices) {
  const total=Number(session?.energyKWh);
  const fail=reason=>({status:'unpriced',cost:0,pricedKwh:0,
    unpricedKwh:Number.isFinite(total)&&total>=0?total:0,reasons:{[reason]:1},
    pricedIntervals:0,unpricedIntervals:0});
  const start=Date.parse(session?.startTime),end=Date.parse(session?.endTime);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||
    !Number.isFinite(total)||total<0)return fail('invalid-session');
  if(!Array.isArray(session?.energyDetails)||session.energyDetails.length<2)return fail('missing-readings');
  const points=session.energyDetails.map(p=>({t:Date.parse(p?.timestamp),e:Number(p?.energyKWh)}))
    .sort((a,b)=>a.t-b.t);
  if(points.some((p,i)=>!Number.isFinite(p.t)||!Number.isFinite(p.e)||
    p.e<0||(i>0&&p.t<=points[i-1].t)))return fail('invalid-readings');
  if(Math.abs(points[0].t-start)>600000||Math.abs(points.at(-1).t-end)>600000||
    points[0].e!==0)return fail('uncertain-boundaries');
  if(Math.abs(points.reduce((n,p)=>n+p.e,0)-total)>Math.max(.05,total*.005))
    return fail('energy-mismatch');
  if(total===0)return {status:'zero',cost:0,pricedKwh:0,unpricedKwh:0,
    reasons:{},pricedIntervals:0,unpricedIntervals:0};
  const prices=new Map((Array.isArray(hourlyPrices)?hourlyPrices:[])
    .filter(p=>Number.isFinite(p?.hour)&&Number.isFinite(p?.price)&&!p.forecast)
    .map(p=>[p.hour,p.price]));
  let cost=0,pricedKwh=0,unpricedKwh=0,pricedIntervals=0,unpricedIntervals=0;
  const reasons={};
  for(let i=1;i<points.length;i++){
    const prev=points[i-1],curr=points[i];
    if(curr.e===0)continue;
    const hour=Math.floor(prev.t/3600000)*3600000;
    const endHour=Math.floor((curr.t-1)/3600000)*3600000;
    let reason=null;
    if(curr.t-prev.t>90*60000)reason='long-positive-interval';
    else if(hour!==endHour)reason='cross-hour-interval';
    else if(!prices.has(hour))reason='missing-prices';
    if(reason){unpricedKwh+=curr.e;unpricedIntervals++;reasons[reason]=(reasons[reason]||0)+1;}
    else {pricedKwh+=curr.e;cost+=curr.e*prices.get(hour);pricedIntervals++;}
  }
  if(Math.abs(pricedKwh+unpricedKwh-total)>Math.max(.05,total*.005))
    return fail('energy-mismatch');
  return {status:unpricedKwh===0?'priced':pricedKwh>0?'partial':'unpriced',
    cost,pricedKwh,unpricedKwh,reasons,pricedIntervals,unpricedIntervals};
}
