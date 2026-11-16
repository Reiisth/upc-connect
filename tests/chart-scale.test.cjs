/* eslint-disable @typescript-eslint/no-require-imports -- Chart configuration regression tests. */
const test=require('node:test'),assert=require('node:assert/strict'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {loadTypeScript}=require('./helpers/load-typescript.cjs');
const {chartExtent,chartCeiling,createChartScaleStore}=loadTypeScript('lib/chart-scale.ts');

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
 assert.match(html,/Fit current data/);assert.equal(chart.options.animation.duration,350);
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
 assert.match(html,/Slices show proportions/);assert.doesNotMatch(html,/Fit current data/);
 assert.equal(captured.options.scales,undefined);
});
