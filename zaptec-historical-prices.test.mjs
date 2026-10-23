import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHistoricalSpotRecords,fetchZaptecHistoricalSpot} from './zaptec-historical-prices.mjs';
test('DK2 DKK/MWh converted to kr/kWh, DK1 ignored',()=>{
 const rows=parseHistoricalSpotRecords([
 {HourUTC:'2026-10-01T00:00:00',PriceArea:'DK2',SpotPriceDKK:1250},
 {HourUTC:'2026-10-01T00:00:00',PriceArea:'DK1',SpotPriceDKK:400}]);
 assert.deepEqual(rows,[{hour:Date.parse('2026-10-01T00:00:00Z'),spot:1.25}]);
});
test('rejects conflicting duplicate hour',()=>{
 assert.throws(()=>parseHistoricalSpotRecords([
 {HourUTC:'2026-10-01T00:00:00',PriceArea:'DK2',SpotPriceDKK:1000},
 {HourUTC:'2026-10-01T00:00:00',PriceArea:'DK2',SpotPriceDKK:2000}]));
});
test('rejects incomplete paginated data',async()=>{
 const storage={getItem:()=>null,setItem:()=>{}};
 const fetcher=async()=>({ok:true,json:async()=>({total:999,records:[
 {HourUTC:'2026-10-01T00:00:00',PriceArea:'DK2',SpotPriceDKK:1000}]})});
 await assert.rejects(fetchZaptecHistoricalSpot(Date.parse('2026-10-01T00:00Z'),
 Date.parse('2026-10-02T00:00Z'),fetcher,storage),/ikke komplette/);
});
test('cached result reused without refetch',async()=>{
 let calls=0,cache=null;
 const storage={getItem:()=>cache,setItem:(k,v)=>{cache=v}};
 const fetcher=async()=>{calls++;return {ok:true,json:async()=>({total:1,records:[
 {HourUTC:'2026-10-01T00:00:00',PriceArea:'DK2',SpotPriceDKK:900}]})}};
 const start=Date.parse('2026-10-01T00:00Z'),end=Date.parse('2026-10-02T00:00Z');
 await fetchZaptecHistoricalSpot(start,end,fetcher,storage);
 await fetchZaptecHistoricalSpot(start,end,fetcher,storage);
 assert.equal(calls,1);
});
