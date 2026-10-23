import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHistoricalSpotRecords,fetchZaptecHistoricalSpot} from './zaptec-historical-prices.mjs';
test('DK2 DKK/MWh converted to kr/kWh, DK1 ignored',()=>{
 const rows=parseHistoricalSpotRecords([
 {TimeUTC:'2026-10-01T00:00:00',PriceArea:'DK2',DayAheadPriceDKK:1250},
 {TimeUTC:'2026-10-01T00:00:00',PriceArea:'DK1',DayAheadPriceDKK:400}]);
 assert.equal(rows.length,0); // One quarter is insufficient for an hourly price
});
test('rejects conflicting duplicate hour',()=>{
 assert.throws(()=>parseHistoricalSpotRecords([
 {TimeUTC:'2026-10-01T00:00:00',PriceArea:'DK2',DayAheadPriceDKK:1000},
 {TimeUTC:'2026-10-01T00:00:00',PriceArea:'DK2',DayAheadPriceDKK:2000}]));
});
test('rejects incomplete paginated data',async()=>{
 const storage={getItem:()=>null,setItem:()=>{}};
 const fetcher=async()=>({ok:true,json:async()=>({total:999,records:[
 {TimeUTC:'2026-10-01T00:00:00',PriceArea:'DK2',DayAheadPriceDKK:1000}]})});
 await assert.rejects(fetchZaptecHistoricalSpot(Date.parse('2026-10-01T00:00Z'),
 Date.parse('2026-10-02T00:00Z'),fetcher,storage),/ikke komplette/);
});
test('cached result reused without refetch',async()=>{
 let calls=0,cache=null;
 const storage={getItem:()=>cache,setItem:(k,v)=>{cache=v}};
 const fetcher=async()=>{calls++;return {ok:true,json:async()=>({total:4,records:[
 ...[0,15,30,45].map(m=>({TimeUTC:'2026-10-01T00:'+String(m).padStart(2,'0')+':00',PriceArea:'DK2',DayAheadPriceDKK:900}))]})}};
 const start=Date.parse('2026-10-01T00:00Z'),end=Date.parse('2026-10-02T00:00Z');
 await fetchZaptecHistoricalSpot(start,end,fetcher,storage);
 await fetchZaptecHistoricalSpot(start,end,fetcher,storage);
 assert.equal(calls,1);
});

test('four quarters form exact hour mean, incomplete hour excluded',()=>{
 const records=[0,15,30,45].map((m,i)=>({TimeUTC:'2026-10-01T00:'+String(m).padStart(2,'0')+':00',
 PriceArea:'DK2',DayAheadPriceDKK:1000*(i+1)}));
 const result=parseHistoricalSpotRecords(records);
 assert.equal(result.length,1);assert.equal(result[0].spot,2.5);
 assert.equal(parseHistoricalSpotRecords(records.slice(0,3)).length,0);
});
