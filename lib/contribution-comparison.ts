export type ContributionTicker = {direction:"up"|"down"|"flat";percent:string|null;label:string};
/** Decimal-string arithmetic: monetary comparison never sums/divides binary floats. */
export function contributionTicker(current:string|number|null,previous:string|number|null):ContributionTicker {
 const units=(value:string|number|null)=>{
  if(value===null)return null;
  const match=/^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
  return match?BigInt(match[1])*BigInt(100)+BigInt((match[2]??"").padEnd(2,"0")):null;
 };
 const a=units(current),b=units(previous);
 if(a===null||b===null)return {direction:"flat",percent:null,label:"No previous comparison"};
 if(b===BigInt(0)&&a!==BigInt(0))return {direction:"flat",percent:null,label:"Previous value was 0"};
 const delta=a-b,absolute=delta<BigInt(0)?-delta:delta;
 const tenths=b===BigInt(0)?BigInt(0):(absolute*BigInt(1000)+b/BigInt(2))/b;
 return {direction:delta===BigInt(0)?"flat":delta>BigInt(0)?"up":"down",percent:`${tenths/BigInt(10)}${tenths%BigInt(10)?`.${tenths%BigInt(10)}`:""}%`,label:"vs previous period"};
}
