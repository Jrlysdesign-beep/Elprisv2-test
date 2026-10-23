import test from 'node:test';
import assert from 'node:assert/strict';
import {priceZaptecSessionPartially as price} from './zaptec-partial-pricing.mjs';
const iso=s=>new Date(s).toISOString();
const s=(times,values,total)=>({startTime:iso(times[0]),endTime:iso(times.at(-1)),
 energyKWh:total,energyDetails:times.map((t,i)=>({timestamp:iso(t),energyKWh:values[i]}))});
test('prices safe hour and leaves cross-hour reading unpriced',()=>{
 const x=s(['2026-10-22T20:00Z','2026-10-22T21:00Z','2026-10-22T21:30Z'],[0,4,2],6);
 const r=price(x,[{hour:Date.parse('2026-10-22T20:00Z'),price:2}]);
 assert.equal(r.status,'partial');assert.equal(r.pricedKwh,4);
 assert.equal(r.unpricedKwh,2);assert.equal(r.cost,8);
});
test('unknown prices do not erase known priced interval',()=>{
 const x=s(['2026-10-22T20:00Z','2026-10-22T21:00Z','2026-10-22T22:00Z'],[0,4,2],6);
 const r=price(x,[{hour:Date.parse('2026-10-22T20:00Z'),price:2}]);
 assert.equal(r.pricedKwh,4);assert.equal(r.unpricedKwh,2);
 assert.equal(r.reasons['missing-prices'],1);
});
test('long positive intervals are never assigned to last hour',()=>{
 const x=s(['2026-10-22T19:00Z','2026-10-22T21:00Z'],[0,3],3);
 assert.equal(price(x,[]).unpricedKwh,3);
});
test('zero-energy sessions have no charge',()=>{
 const x=s(['2026-10-22T19:00Z','2026-10-22T21:00Z'],[0,0],0);
 assert.equal(price(x,[]).status,'zero');
});
test('repeated DST local hour uses distinct UTC hour',()=>{
 const x=s(['2026-10-25T00:00Z','2026-10-25T01:00Z','2026-10-25T02:00Z'],[0,1,2],3);
 const r=price(x,[{hour:Date.parse('2026-10-25T00:00Z'),price:2},
 {hour:Date.parse('2026-10-25T01:00Z'),price:4}]);
 assert.equal(r.cost,10);assert.equal(r.status,'priced');
});
test('inconsistent session total rejects entire calculation',()=>{
 const x=s(['2026-10-22T20:00Z','2026-10-22T21:00Z'],[0,2],4);
 assert.equal(price(x,[]).reason,undefined);
 assert.equal(price(x,[]).reasons['energy-mismatch'],1);
});
