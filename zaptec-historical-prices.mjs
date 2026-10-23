// Historical DK2 spot prices for Zaptec test only. No personal Zaptec data is sent.
// Energi Data Service: SpotPriceDKK is DKK/MWh, HourUTC is UTC without suffix.
// Cache successful responses locally for 24 hours to avoid repeated upstream requests.
const KEY='elprisZaptecHistoricalDK2V2';
export function parseHistoricalSpotRecords(records){
  if(!Array.isArray(records))throw Error('Ugyldigt prisdatasæt');
  const quarters=new Map();
  for(const row of records){
    if(row?.PriceArea!=='DK2'||typeof row.TimeUTC!=='string'||
       !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(row.TimeUTC))continue;
    const ts=Date.parse(row.TimeUTC+'Z'),value=Number(row.DayAheadPriceDKK);
    if(!Number.isFinite(ts)||ts%900000!==0||!Number.isFinite(value))continue;
    if(quarters.has(ts)&&Math.abs(quarters.get(ts)-value/1000)>1e-8)
      throw Error('Forskellige priser for samme kvarter');
    quarters.set(ts,value/1000);
  }
  const byHour=new Map();
  for(const [ts,spot] of quarters){
    const hour=Math.floor(ts/3600000)*3600000;
    if(!byHour.has(hour))byHour.set(hour,[]);
    byHour.get(hour).push(spot);
  }
  // Do not invent a full-hour price when one of the four quarters is missing.
  return [...byHour].filter(([hour,values])=>values.length===4)
    .map(([hour,values])=>({hour,spot:values.reduce((a,b)=>a+b,0)/4}))
    .sort((a,b)=>a.hour-b.hour);
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
    start:new Date(first-86400000).toISOString().slice(0,16),
    end:new Date(last+86400000).toISOString().slice(0,16),
    filter:JSON.stringify({PriceArea:['DK2']}),
    columns:'TimeUTC,PriceArea,DayAheadPriceDKK',
    limit:'5000'
  });
  const response=await fetcher('https://api.energidataservice.dk/dataset/DayAheadPrices?'+params.toString(),
    {cache:'no-store'});
  if(!response.ok)throw Error('Historiske spotpriser kunne ikke hentes (HTTP '+response.status+')');
  const data=await response.json();
  const rows=parseHistoricalSpotRecords(data.records).filter(p=>p.hour>=first&&p.hour<last);
  if(!rows.length)throw Error('Ingen historiske DK2-timepriser returneret');
  // An incomplete response is not silently treated as full coverage.
  if(data.total>data.records.length)throw Error('Historiske prisdata er ikke komplette');
  try{storage.setItem(KEY,JSON.stringify({id:cacheId,savedAt:Date.now(),rows}));}catch(e){}
  return {rows,source:'Energi Data Service'};
}
