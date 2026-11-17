/* eslint-disable @typescript-eslint/no-require-imports -- Pure analytics and actual SVG regression harness. */
const test=require('node:test'),assert=require('node:assert/strict'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {loadTypeScript}=require('./helpers/load-typescript.cjs');
const {registrationSparkline}=loadTypeScript('lib/analytics/registration-trend.ts');
const {cumulativeMembershipSparkline}=loadTypeScript('lib/analytics/registration-trend.ts');
const range=(from,to)=>({from,to,timeZone:'Asia/Manila'});

test('cumulative membership retains the opening population, carries quiet periods and reaches the end-date total',()=>{
  assert.deepEqual(Array.from(cumulativeMembershipSparkline([{periodStart:'2026-11-02',value:3}],range('2026-11-01','2026-11-04'),'day',103)),[100,100,103,103,103]);
  assert.deepEqual(Array.from(cumulativeMembershipSparkline([],range('2026-11-01','2026-11-04'),'day',100)),[100,100,100,100,100]);
  assert.deepEqual(Array.from(cumulativeMembershipSparkline([{periodStart:'2026-11-01',value:2}],range('2026-11-01','2026-11-01'),'day',102)),[100,102]);
  assert.deepEqual(Array.from(cumulativeMembershipSparkline([],range('2026-11-01','2026-11-01'),'day',0)),[0,0]);
});

test('registration trend includes zero periods and respects partial Monday weeks and calendar months',()=>{
  assert.deepEqual(Array.from(registrationSparkline([{periodStart:'2026-11-02',value:3}],range('2026-11-01','2026-11-04'),'day')),[0,3,0,0]);
  assert.deepEqual(Array.from(registrationSparkline([{periodStart:'2026-10-26',value:2},{periodStart:'2026-11-09',value:1}],range('2026-11-01','2026-11-15'),'week')),[2,0,1]);
  assert.deepEqual(Array.from(registrationSparkline([{periodStart:'2025-12-01',value:2},{periodStart:'2026-02-01',value:5}],range('2025-12-29','2026-02-02'),'month')),[2,0,5]);
  assert.deepEqual(Array.from(registrationSparkline([],range('2024-02-28','2024-03-01'),'day')),[0,0,0]);
  assert.deepEqual(Array.from(registrationSparkline([{periodStart:'2026-11-01',value:7}],range('2026-11-01','2026-11-01'),'day')),[7]);
});

test('long miniature trends stay bounded, preserve registration totals and exclude outside-range or invalid values',()=>{
  const trend=[{periodStart:'2026-01-01',value:5},{periodStart:'2026-12-31',value:7},{periodStart:'2025-12-31',value:99},{periodStart:'2026-01-04',value:-1},{periodStart:'invalid',value:2}];
  const values=registrationSparkline(trend,range('2026-01-01','2026-12-31'),'day');
  assert.ok(values.length<=64);assert.equal(values.reduce((sum,value)=>sum+value,0),12);
  assert.deepEqual(Array.from(registrationSparkline([],range('2026-11-02','2026-11-01'),'day')),[]);
});

test('sparkline stays finite for empty/single periods and visibly shrinks on a held filter scale',()=>{
  const {createChartScaleStore}=loadTypeScript('lib/chart-scale.ts');const store=createChartScaleStore();
  const {Sparkline}=loadTypeScript('components/ui/sparkline.tsx',{'./use-chart-scale':{useChartScale:(key,required)=>{store.set(key,required);return {max:store.get(key)};}}});
  const render=values=>renderToStaticMarkup(React.createElement(Sparkline,{values,label:'Registration trend',scaleKey:'members'}));
  const y=html=>Number(/<circle[^>]*cy="([^"]+)"/.exec(html)[1]);
  const larger=render([0,100]),smaller=render([0,10]);assert.ok(y(smaller)>y(larger));
  for(const values of [[],[0],[2],[NaN,-1,Infinity]]){
    const html=render(values);assert.doesNotMatch(html,/NaN|Infinity/);assert.match(html,/role="img"/);assert.match(html,/aria-label="Registration trend"/);
  }
});
