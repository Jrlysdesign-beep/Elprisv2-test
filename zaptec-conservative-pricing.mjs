// Conservative experimental pricing of Zaptec interval-end readings.
// A positive reading is priced only when its entire preceding interval lies in one UTC hour.
// UTC epoch-hour buckets also handle Danish daylight-saving transitions without collisions.
// All-or-nothing per session; missing hours and uncertain intervals never receive guessed prices.
export function priceZaptecSessionConservatively(session, hourlyPrices) {
  const fail=(reason)=>({status:'unpriced',reason,cost:null,kwh:0});
  const start=Date.parse(session?.startTime),end=Date.parse(session?.endTime);
  const total=Number(session?.energyKWh);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||
     !Number.isFinite(total)||total<0)return fail('invalid-session');
  const raw=session?.energyDetails;
  if(!Array.isArray(raw)||raw.length<2)return fail('missing-readings');
  const points=raw.map(p=>({t:Date.parse(p?.timestamp),e:Number(p?.energyKWh)}))
    .sort((a,b)=>a.t-b.t);
  if(points.some((p,i)=>!Number.isFinite(p.t)||!Number.isFinite(p.e)||
      p.e<0||(i>0&&p.t<=points[i-1].t)))return fail('invalid-readings');
  if(Math.abs(points[0].t-start)>600000||Math.abs(points.at(-1).t-end)>600000||
     points[0].e!==0)return fail('uncertain-boundaries');
  const sum=points.reduce((n,p)=>n+p.e,0);
  if(Math.abs(sum-total)>Math.max(.05,total*.005))return fail('energy-mismatch');
  if(total===0)return {status:'priced',reason:'zero-energy',cost:0,kwh:0};
  if(!Array.isArray(hourlyPrices))return fail('missing-prices');
  const prices=new Map(hourlyPrices.filter(p=>Number.isFinite(p?.hour)&&
    Number.isFinite(p?.price)&&!p.forecast).map(p=>[p.hour,p.price]));
  let cost=0,energy=0;
  for(let i=1;i<points.length;i++){
    const prev=points[i-1],curr=points[i];
    if(curr.e===0)continue;
    const startHour=Math.floor(prev.t/3600000)*3600000;
    // End exactly on a boundary belongs to the preceding hour.
    const endHour=Math.floor((curr.t-1)/3600000)*3600000;
    if(startHour!==endHour)return fail('cross-hour-interval');
    if(curr.t-prev.t>90*60000)return fail('long-positive-interval');
    if(!prices.has(startHour))return fail('missing-prices');
    cost+=curr.e*prices.get(startHour);
    energy+=curr.e;
  }
  if(Math.abs(energy-total)>Math.max(.05,total*.005))return fail('energy-mismatch');
  return {status:'priced',reason:'strict-interval-end-hypothesis',cost,kwh:energy};
}
