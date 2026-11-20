/* eslint-disable @typescript-eslint/no-require-imports -- Chart configuration regression tests. */
const test=require('node:test'),assert=require('node:assert/strict'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {loadTypeScript}=require('./helpers/load-typescript.cjs');
const {chartExtent,chartCeiling,createChartScaleStore}=loadTypeScript('lib/chart-scale.ts');

test('sparkline tooltip dates match cumulative buckets and cap every final point at the range end',()=>{
 const {membershipSparklineDates,cumulativeMembershipSparkline}=loadTypeScript('lib/analytics/registration-trend.ts');
 for(const grouping of ['day','week','month']) for(const range of [{from:'2024-02-01',to:'2024-02-29'},{from:'0001-01-01',to:'0001-02-28'},{from:'9999-12-25',to:'9999-12-31'},{from:'2020-01-01',to:'2026-11-18'}]){
  const dates=membershipSparklineDates(range,grouping),values=cumulativeMembershipSparkline([],range,grouping,20);
  assert.equal(dates.length,values.length);assert.equal(dates[0],range.from);assert.equal(dates.at(-1),range.to);assert.ok(dates.every(date=>date>=range.from&&date<=range.to));
 }
 assert.equal(membershipSparklineDates({from:'0001-01-01',to:'0001-02-28'},'month')[1],'0001-01-31');
});

test('dashboard blue series use the softer brand blue without glow or recoloring other categories',()=>{
 let captured;
 const Chart=loadTypeScript('app/portal/reports/ReportChart.tsx',{'@/components/ui/use-chart-scale':{useChartScale:()=>({max:100,fit(){}}),useChartReducedMotion:()=>false},'react-chartjs-2':{Bar:props=>{captured=props;return null;}}}).default;
 renderToStaticMarkup(React.createElement(Chart,{title:'Glow',labels:['Now'],series:[{label:'Blue',color:'#365FA6',values:[20]},{label:'Other',color:'#16836B',values:[10]}],emptyMessage:'Empty'}));
 assert.equal(captured.data.datasets[0].borderColor,'#5D94E8');assert.equal(captured.data.datasets[1].borderColor,'#16836B');
 assert.equal(captured.data.datasets[0].hoverBackgroundColor,'#5D94E8');assert.equal(captured.data.datasets[0].pointHoverBackgroundColor,'#5D94E8');
 assert.ok(!captured.plugins?.some(plugin=>plugin.id==='dashboardBlueGlow'));
});

test('membership sparkline compares periods on one scale with linear paths, fading fills and vertical grid lines',()=>{
 let ceiling;
 const {Sparkline}=loadTypeScript('components/ui/sparkline.tsx',{
  './use-chart-scale':{useChartScale:(_key,required)=>{ceiling=required;return {max:required};}},
 });
 const props={values:[0,10,20],previousValues:[50,200],label:'Membership comparison',scaleKey:'test'};
 const html=renderToStaticMarkup(React.createElement(Sparkline,props));
 assert.ok(ceiling>=200);
 const lines=[...html.matchAll(/<polyline[^>]*points="([^"]*)"/g)];assert.equal(lines.length,2);
 const end=match=>match[1].split(' ').at(-1).split(',').map(Number);
 assert.equal(end(lines[0])[0],end(lines[1])[0]);assert.ok(end(lines[0])[1]<end(lines[1])[1]);
 assert.equal((html.match(/stroke-dasharray="2 3"/g)||[]).length,6);
 assert.equal((html.match(/<linearGradient/g)||[]).length,2);assert.match(html,/stop-opacity="0"/);assert.match(html,/stroke-linejoin="miter"/);
 assert.match(html,/preserveAspectRatio="xMidYMid meet"/);assert.match(html,/width="320" height="88"/);assert.doesNotMatch(html,/preserveAspectRatio="none"/);
 const single=renderToStaticMarkup(React.createElement(Sparkline,{...props,previousValues:[]}));assert.equal((single.match(/<polyline/g)||[]).length,1);
});

test('scale holds when filtering down, expands before clipping and fits only on request',()=>{
 const store=createChartScaleStore();let notifications=0;const unsubscribe=store.subscribe(()=>notifications++);
 store.set('attendance',chartCeiling(100));const baseline=store.get('attendance');
 store.set('attendance',chartCeiling(10));assert.equal(store.get('attendance'),baseline);
 store.set('attendance',chartCeiling(250));assert.ok(store.get('attendance')>=250);
 store.set('attendance',chartCeiling(10),true);assert.equal(store.get('attendance'),chartCeiling(10));
 assert.equal(store.get('contributions'),0);assert.equal(notifications,3);unsubscribe();
 // A chart remount reads the same store rather than resetting the axis to its filtered maximum.
 assert.equal(store.get('attendance'),chartCeiling(10));
});

test('stacked extents use totals; ceilings cover sparse, zero, fractional and very large data',()=>{
 assert.equal(chartExtent([[20,null,5],[30,2,10]],true),50);
 assert.equal(chartExtent([[20,null,5],[30,2,10]],false),30);
 assert.equal(chartExtent([[NaN,Infinity,-1]],false),0);
 for(const value of [0,0.01,0.3,1,7,100,100.01,99999999999999,Number.MAX_VALUE]){
   for(const money of [false,true]){const max=chartCeiling(value,money);assert.ok(Number.isFinite(max));assert.ok(max>=value);}
 }
 assert.ok(Number.isInteger(chartCeiling(0.3)));assert.ok(chartCeiling(0.3,true)<4);
});

test('actual chart geometry visibly shrinks on a held scale, with horizontal, stacked and money support',()=>{
 const store=createChartScaleStore();let chart;
 const Chart=loadTypeScript('app/portal/reports/ReportChart.tsx',{
   '@/components/ui/use-chart-scale':{useChartScale:(key,required)=>{
     store.set(key,required);return{max:store.get(key),fit:()=>store.set(key,required,true)};
   },useChartReducedMotion:()=>false},
   'react-chartjs-2':{Bar:props=>{chart=props;return null;},Line:props=>{chart=props;return null;}},
 }).default;
 const props={title:'Stable attendance',labels:['Nov'],series:[{label:'Present',values:[100]}],emptyMessage:'Empty'};
 let html=renderToStaticMarkup(React.createElement(Chart,props));const max=chart.options.scales.y.max;
 assert.match(html,/Fit current data/);assert.equal(chart.options.animation.duration,700);
 renderToStaticMarkup(React.createElement(Chart,{...props,series:[{label:'Present',values:[10]}]}));
 assert.equal(chart.options.scales.y.max,max);assert.equal(chart.data.datasets[0].data[0],10);
 renderToStaticMarkup(React.createElement(Chart,{...props,horizontal:true,stacked:true,series:[{label:'A',values:[100]},{label:'B',values:[80]}]}));
 assert.ok(chart.options.scales.x.max>=180);assert.equal(chart.options.scales.x.min,0);
 html=renderToStaticMarkup(React.createElement(Chart,{...props,title:'Stable PHP',money:true,series:[{label:'Received',values:['1000.25']}]}));
 assert.equal(chart.data.datasets[0].data[0],1000.25);assert.equal(chart.options.scales.y.title.text,'Amount (PHP)');
 assert.match(html,/1,000\.25/);assert.doesNotMatch(html,/Relative to the largest/);
});

test('reduced motion disables transitions; doughnuts keep proportion semantics and no axis controls',()=>{
 let captured;const Chart=loadTypeScript('app/portal/reports/ReportChart.tsx',{
   '@/components/ui/use-chart-scale':{useChartScale:()=>({max:100,fit(){}}),useChartReducedMotion:()=>true},
   'react-chartjs-2':{Bar:props=>{captured=props;return null;},Doughnut:props=>{captured=props;return null;}},
 }).default;
 const props={title:'Motion',labels:['Present'],series:[{label:'Records',values:[10]}],emptyMessage:'Empty'};
 renderToStaticMarkup(React.createElement(Chart,props));assert.equal(captured.options.animation,false);
 const html=renderToStaticMarkup(React.createElement(Chart,{...props,kind:'doughnut',centerValue:10}));
 assert.doesNotMatch(html,/Slices show proportions/);assert.doesNotMatch(html,/Fit current data/);
 assert.equal(captured.options.scales,undefined);
});


test('membership line charts use linear paths, fading areas and vertical grid lines without bridging unknown history',()=>{
 let captured;const Chart=loadTypeScript('app/portal/reports/ReportChart.tsx',{
  '@/components/ui/use-chart-scale':{useChartScale:()=>({max:100,fit(){}}),useChartReducedMotion:()=>false},
  'react-chartjs-2':{Line:props=>{captured=props;return null;}},
 }).default;
 renderToStaticMarkup(React.createElement(Chart,{title:'Statuses',appearance:'sparkline',kind:'line',labels:['Before','Today'],series:[{label:'Active',values:[null,10]}],emptyMessage:'None'}));
 const dataset=captured.data.datasets[0];assert.equal(dataset.tension,0);assert.equal(dataset.spanGaps,false);assert.equal(dataset.fill,true);
 assert.equal(captured.options.scales.x.grid.display,true);assert.equal(captured.options.scales.y.grid.display,true);assert.equal(captured.options.plugins.tooltip.enabled,false);
 const stops=[];dataset.backgroundColor({chart:{chartArea:{top:0,bottom:100},ctx:{createLinearGradient:()=>({addColorStop:(...args)=>stops.push(args)})}}});
 assert.deepEqual(stops,[[0,'#5D94E83D'],[1,'#5D94E800']]);
 assert.equal(captured.options.scales.y.min,0);assert.equal(captured.options.scales.y.max,100);
});


test('bar labels draw exact current values near horizontal and vertical ends and skip missing or hidden bars',()=>{
 let captured;
 const Chart=loadTypeScript('app/portal/reports/ReportChart.tsx',{
  '@/components/ui/use-chart-scale':{useChartScale:()=>({max:100,fit(){}}),useChartReducedMotion:()=>true},
  'react-chartjs-2':{Bar:props=>{captured=props;return null;}},
 }).default;
 for(const horizontal of [true,false]){
  renderToStaticMarkup(React.createElement(Chart,{title:'Labels',horizontal,labels:['A','B','C'],series:[{label:'Members',values:[30,0,null]},{label:'Hidden',values:[99,99,99]}],emptyMessage:'None'}));
  const drawn=[],ctx={save(){},restore(){},measureText:text=>({width:text.length*6}),strokeText(){},fillText:(...args)=>drawn.push(args)};
  const chart={ctx,width:320,chartArea:{left:40,right:272},options:captured.options,data:captured.data,isDatasetVisible:index=>index===0,getDatasetMeta:()=>({data:[{getProps:()=>({x:270,y:60})},{getProps:()=>({x:40,y:90})},{getProps:()=>({x:200,y:120})}]})};
  const plugin=captured.plugins.find(plugin=>plugin.id==='barValueLabels');plugin.afterDatasetsDraw(chart);
  assert.deepEqual(drawn.map(row=>row[0]),['30','0']);assert.ok(drawn.every(([,x,y])=>x>=0&&x<=320&&y>=0));
  assert.equal(drawn[0][1],horizontal?276:270);assert.equal(drawn[0][2],horizontal?60:50);
  captured.data.datasets[0].valueLabels=['75','0',null];drawn.length=0;plugin.afterDatasetsDraw(chart);assert.equal(drawn[0][0],'75');
 }
 renderToStaticMarkup(React.createElement(Chart,{title:'Exact money labels',money:true,horizontal:true,labels:['A'],series:[{label:'Amount',values:['99999999999900.01']}],emptyMessage:'None'}));
 assert.match(captured.data.datasets[0].valueLabels[0],/99,999,999,999,900\.01/);
});
