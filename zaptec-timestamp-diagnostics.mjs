// Kun aggregerede tidsafvigelser; ingen rå tidsstempler eller energiværdier vises.
export function diagnoseTimestampBoundaries(sessions) {
 const result={sessions:0,firstNearStart:0,lastNearEnd:0,bothNear:0,neitherNear:0,invalid:0,typicalSpacingMinutes:null,intervals:0};
 const spacings=[];
 for(const s of sessions){
  const start=Date.parse(s.startTime),end=Date.parse(s.endTime);
  const times=(s.energyDetails||[]).map(p=>Date.parse(p.timestamp)).sort((a,b)=>a-b);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||times.length<2||times.some((t,i)=>!Number.isFinite(t)||(i>0&&t<=times[i-1]))){result.invalid++;continue;}
  result.sessions++;
  const distances=times.slice(1).map((t,i)=>(t-times[i])/60000);
  spacings.push(...distances);result.intervals+=distances.length;
  // 10 min tolerance accommodates polling delays, not proof of interval direction.
  const nearStart=Math.abs(times[0]-start)<=600000,nearEnd=Math.abs(times.at(-1)-end)<=600000;
  if(nearStart)result.firstNearStart++;
  if(nearEnd)result.lastNearEnd++;
  if(nearStart&&nearEnd)result.bothNear++;
  if(!nearStart&&!nearEnd)result.neitherNear++;
 }
 if(spacings.length){spacings.sort((a,b)=>a-b);result.typicalSpacingMinutes=Math.round(spacings[Math.floor(spacings.length/2)]*10)/10;}
 return result;
}
// Tidsstemplernes placering alene kan ikke bevise om energi tilhører intervallet før eller efter punktet.
