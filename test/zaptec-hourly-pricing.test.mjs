import {validateIntervals,hourlyCost} from '../zaptec-hourly-pricing.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const iso=t=>new Date(t).toISOString();
test('afviser ufuldstændige og tvetydige målinger',()=>{
 assert.equal(validateIntervals({energyKWh:4,energyDetails:[{timestamp:iso(0),energyKWh:4}]}).ok,false);
 assert.equal(validateIntervals({energyKWh:3,energyDetails:[{timestamp:iso(0),energyKWh:1},{timestamp:iso(3600000),energyKWh:9}]}).ok,false);
});
test('godkender summen af intervalmålinger',()=>{
 const s={energyKWh:3,energyDetails:[{timestamp:iso(0),energyKWh:2},{timestamp:iso(3600000),energyKWh:1}]};
 assert.equal(validateIntervals(s).ok,true);
});
test('fordeler hen over timegrænse uden at miste kWh',()=>{
 const prices=new Map([[iso(0),1],[iso(3600000),3]]);
 const r=hourlyCost([{start:1800000,end:5400000,kwh:4}],prices);
 assert.equal(r.pricedKwh,4);assert.equal(r.cost,8);assert.equal(r.complete,true);
});
test('manglende priser giver ikke falsk total',()=>{
 const r=hourlyCost([{start:1800000,end:5400000,kwh:4}],new Map([[iso(0),1]]));
 assert.equal(r.complete,false);assert.equal(r.pricedKwh,2);assert.equal(r.missingHours.length,1);
});
test('sommertid håndteres via UTC-timer',()=>{
 const start=Date.parse('2026-10-25T00:30:00Z'),end=Date.parse('2026-10-25T02:30:00Z');
 const p=new Map([[iso(Date.parse('2026-10-25T00:00:00Z')),1],[iso(Date.parse('2026-10-25T01:00:00Z')),2],[iso(Date.parse('2026-10-25T02:00:00Z')),3]]);
 const r=hourlyCost([{start,end,kwh:4}],p);
 assert.equal(r.cost,8);assert.equal(r.pricedKwh,4);
});
