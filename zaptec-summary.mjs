// Aggregate completed Zaptec sessions into clearly labeled reporting periods.
// Prices are estimates. Incomplete historical coverage must not be presented as full-year totals.
export function summarizeCharging(entries, now=Date.now()) {
  const dateParts=t=>{const d=new Date(t);const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Copenhagen',year:'numeric',month:'2-digit'}).formatToParts(d);
    return {year:Number(p.find(x=>x.type==='year').value),month:Number(p.find(x=>x.type==='month').value)};};
  const current=dateParts(now), previous=current.month===1?{year:current.year-1,month:12}:{year:current.year,month:current.month-1};
  const inMonth=(d,m)=>d.year===m.year&&d.month===m.month;
  const groups={day:[],month:[],previous:[],year:[],rolling:[]};
  const twelveAgo=new Date(now);twelveAgo.setUTCFullYear(twelveAgo.getUTCFullYear()-1);
  for(const entry of entries){
    const t=Date.parse(entry.item.endTime);
    if(!Number.isFinite(t)||t>now)continue;
    const d=dateParts(t);
    if(t>=now-86400000)groups.day.push(entry);
    if(inMonth(d,current))groups.month.push(entry);
    if(inMonth(d,previous))groups.previous.push(entry);
    if(d.year===current.year)groups.year.push(entry);
    if(t>=twelveAgo.getTime())groups.rolling.push(entry);
  }
  const sum=rows=>({
    count:rows.length,
    kwh:rows.reduce((n,x)=>n+x.item.energyKWh,0),
    pricedKwh:rows.reduce((n,x)=>n+(x.estimate?.status==='priced'?x.item.energyKWh:0),0),
    cost:rows.reduce((n,x)=>n+(x.estimate?.status==='priced'?x.estimate.cost:0),0),
    complete:rows.every(x=>x.estimate?.status==='priced')
  });
  return Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,sum(v)]));
}
