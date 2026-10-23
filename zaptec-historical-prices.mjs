// Historical DK2 spot prices for Zaptec test only. No personal Zaptec data is sent.
// Energi Data Service: SpotPriceDKK is DKK/MWh, HourUTC is UTC without suffix.
// Cache successful responses locally for 24 hours to avoid repeated upstream requests.
const KEY='elprisZaptecHistoricalDK2V1';
export function parseHistoricalSpotRecords(records){
  if(!Array.isArray(records))throw Error('Ugyldigt prisdatasæt');
  const out=new Map();
  for(const row of records){
    if(row?.PriceArea!=='DK2'||typeof row.HourUTC!=='string'||
       !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(row.HourUTC))continue;
    const ts=Date.parse(row.HourUTC+'Z'),value=Number(row.SpotPriceDKK);
    if(!Number.isFinite(ts)||ts%3600000!==0||!Number.isFinite(value))continue;
    if(out.has(ts)&&Math.abs(out.get(ts)-value/1000)>1e-8)
      throw Error('Flere forskellige priser for samme time');
    out.set(ts,value/1000);
  }
  return [...out].map(([hour,spot])=>({hour,spot})).sort((a,b)=>a.hour-b.hour);
}
export async function fetchZaptecHistoricalSpot(start,end,fetcher=fetch,storage=localStorage){
  const first=Math.floor(start/86400000)*86400000;
  const last=Math.ceil(end/86400000)*86400000;
  if(!Number.isFinite(first)||!Number.isFinite(last)||last<=first||
     last-first>35*86400000)throw Error('Ugyldigt historikinterval');
  const cacheId=first+':'+last;
  try{
    const cache=JSON.parse(storage.getItem(KEY)||'null');
    if(cache?.id===cacheId&&Date.now()-cache.savedAt<24*3600000&&
       Array.isArray(cache.rows))return {rows:cache.rows,source:'lokalt cachet'};
  }catch(e){}
  const params=new URLSearchParams({
    start:new Date(first).toISOString().slice(0,19),
    end:new Date(last).toISOString().slice(0,19),
    filter:JSON.stringify({PriceArea:['DK2']}),
    columns:'HourUTC,PriceArea,SpotPriceDKK',
    limit:'1500'
  });
  const response=await fetcher('https://api.energidataservice.dk/dataset/Elspotprices?'+params.toString(),
    {cache:'no-store'});
  if(!response.ok)throw Error('Historiske spotpriser kunne ikke hentes (HTTP '+response.status+')');
  const data=await response.json();
  const rows=parseHistoricalSpotRecords(data.records);
  if(!rows.length)throw Error('Ingen historiske DK2-timepriser returneret');
  // An incomplete response is not silently treated as full coverage.
  if(data.total>rows.length)throw Error('Historiske prisdata er ikke komplette');
  try{storage.setItem(KEY,JSON.stringify({id:cacheId,savedAt:Date.now(),rows}));}catch(e){}
  return {rows,source:'Energi Data Service'};
}
