import test from 'node:test';
import assert from 'node:assert/strict';
import {priceZaptecSessionConservatively as price} from './zaptec-conservative-pricing.mjs';
const d=t=>new Date(t).toISOString();
const session=(start,end,energyDetails,energyKWh)=>({
  startTime:d(start),endTime:d(end),energyKWh,
  energyDetails:energyDetails.map(([t,e])=>({timestamp:d(t),energyKWh:e}))
});
const prices=[{hour:Date.parse('2026-10-22T20:00:00Z'),price:2},
 {hour:Date.parse('2026-10-22T21:00:00Z'),price:3}];
test('full hour uses preceding hour at end boundary',()=>{
 const s=session('2026-10-22T20:00:00Z','2026-10-22T21:00:00Z',
 [['2026-10-22T20:00:00Z',0],['2026-10-22T21:00:00Z',4]],4);
 assert.deepEqual(price(s,prices),{status:'priced',reason:'strict-interval-end-hypothesis',cost:8,kwh:4});
});
test('partial start interval priced only inside same hour',()=>{
 const s=session('2026-10-22T20:45:00Z','2026-10-22T21:00:00Z',
 [['2026-10-22T20:45:00Z',0],['2026-10-22T21:00:00Z',1]],1);
 assert.equal(price(s,prices).cost,2);
});
test('interval across hour boundary is not guessed',()=>{
 const s=session('2026-10-22T20:45:00Z','2026-10-22T21:15:00Z',
 [['2026-10-22T20:45:00Z',0],['2026-10-22T21:15:00Z',2]],2);
 assert.equal(price(s,prices).reason,'cross-hour-interval');
});
test('missing historical hour rejects whole session',()=>{
 const s=session('2026-10-22T20:00:00Z','2026-10-22T22:00:00Z',
 [['2026-10-22T20:00:00Z',0],['2026-10-22T21:00:00Z',2],['2026-10-22T22:00:00Z',3]],5);
 assert.equal(price(s,prices).reason,'missing-prices');
});
test('long positive interval is rejected',()=>{
 const s=session('2026-10-22T19:00:00Z','2026-10-22T21:00:00Z',
 [['2026-10-22T19:00:00Z',0],['2026-10-22T21:00:00Z',4]],4);
 assert.equal(price(s,prices).status,'unpriced');
});
test('zero energy interval can span many hours',()=>{
 const s=session('2026-10-22T19:00:00Z','2026-10-22T21:00:00Z',
 [['2026-10-22T19:00:00Z',0],['2026-10-22T21:00:00Z',0]],0);
 assert.equal(price(s,[]).cost,0);
});
test('energy mismatch rejects session',()=>{
 const s=session('2026-10-22T20:00:00Z','2026-10-22T21:00:00Z',
 [['2026-10-22T20:00:00Z',0],['2026-10-22T21:00:00Z',2]],4);
 assert.equal(price(s,prices).reason,'energy-mismatch');
});
test('DST repeated local hour remains distinct UTC buckets',()=>{
 const s=session('2026-10-25T00:00:00Z','2026-10-25T02:00:00Z',
 [['2026-10-25T00:00:00Z',0],['2026-10-25T01:00:00Z',1],['2026-10-25T02:00:00Z',2]],3);
 assert.equal(price(s,[{hour:Date.parse('2026-10-25T00:00:00Z'),price:2},
 {hour:Date.parse('2026-10-25T01:00:00Z'),price:4}]).cost,10);
});
