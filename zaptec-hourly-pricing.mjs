/* Elpris 15.8 — isoleret beregningsmotor, ikke tilsluttet brugerfladen endnu.
 * energyDetails skal først valideres som interval-kWh. Punktets tidsstempel
 * kan betegne start eller slut; dette må IKKE gættes.
 * prices: Map med UTC-timestart (ISO) -> pris DKK/kWh.
 */
export function validateIntervals(session, toleranceFraction=0.02) {
  const points=(session.energyDetails||[]).map(p=>({t:Date.parse(p.timestamp),kwh:Number(p.energyKWh)}));
  if(points.length<2 || points.some(p=>!Number.isFinite(p.t)||!Number.isFinite(p.kwh)||p.kwh<0))
    return {ok:false,reason:'manglende eller ugyldige punkter'};
  if(points.some((p,i)=>i&&p.t<=points[i-1].t))
    return {ok:false,reason:'tidsstempler ikke stigende'};
  const sum=points.reduce((s,p)=>s+p.kwh,0),total=Number(session.energyKWh);
  if(!Number.isFinite(total)||total<0||Math.abs(sum-total)>Math.max(0.15,total*toleranceFraction))
    return {ok:false,reason:'intervalsum afviger fra Zaptec-total'};
  const monotonic=points.every((p,i)=>!i||p.kwh>=points[i-1].kwh);
  const delta=points.at(-1).kwh-points[0].kwh;
  if(monotonic&&Math.abs(delta-total)<=Math.max(0.15,total*toleranceFraction))
    return {ok:false,reason:'tvetydig: kan også være kumulativ'};
  return {ok:true,points};
}
export function hourlyCost(intervals, priceByHour) {
  // intervals: [{start,end,kwh}] med eksplicit bekræftede grænser i UTC-millisekunder.
  let cost=0, pricedKwh=0;const missingHours=new Set();
  for(const interval of intervals){
    const {start,end,kwh}=interval;
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||!Number.isFinite(kwh)||kwh<0)
      throw Error('Ugyldigt energiinterval');
    for(let hour=Math.floor(start/3600000)*3600000;hour<end;hour+=3600000){
      const overlap=Math.max(0,Math.min(end,hour+3600000)-Math.max(start,hour));
      if(!overlap)continue;
      const energy=kwh*overlap/(end-start);
      const price=priceByHour.get(new Date(hour).toISOString());
      if(!Number.isFinite(price)){missingHours.add(new Date(hour).toISOString());continue;}
      cost+=energy*price;pricedKwh+=energy;
    }
  }
  return {cost,pricedKwh,missingHours:[...missingHours],complete:missingHours.size===0,
    method:'lineær fordeling inden for hvert måleinterval; ikke faktisk minutmåling'};
}
// Brug aldrig en ufuldstændig sum som samlet pris. Gem alle år uden udløbsdato.
// Perioder beregnes efter Europe/Copenhagen, inklusive sommertid.
