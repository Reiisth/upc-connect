/* eslint-disable @typescript-eslint/no-require-imports -- DOM and exact-number animation regressions. */
const test=require('node:test'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost'}),win=dom.window;
for(const key of ['window','document','HTMLElement','Event','navigator'])Object.defineProperty(globalThis,key,{configurable:true,value:key==='window'?win:win[key]});
globalThis.getComputedStyle=win.getComputedStyle.bind(win);
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const frames=new Map(),listeners=new Set();let serial=0,reduced=false;
win.requestAnimationFrame=callback=>{frames.set(++serial,callback);return serial;};
win.cancelAnimationFrame=id=>frames.delete(id);
win.matchMedia=()=>({get matches(){return reduced;},addEventListener:(_event,callback)=>listeners.add(callback),removeEventListener:(_event,callback)=>listeners.delete(callback)});
const React=require('react'),{act}=React,{createRoot}=require('react-dom/client'),{renderToStaticMarkup}=require('react-dom/server');
const {loadTypeScript}=require('./helpers/load-typescript.cjs');
const {AnimatedNumber,interpolateMetric}=loadTypeScript('components/ui/animated-number.tsx',{}, {window:win});
const {AnimatedDisclosure}=loadTypeScript('components/ui/animated-disclosure.tsx');
const ComparisonTicker=loadTypeScript('app/portal/reports/ReportComparisonTicker.tsx',{}, {window:win}).default;
const {Sparkline}=loadTypeScript('components/ui/sparkline.tsx',{'./use-chart-scale':{useChartScale:()=>({max:100})}}, {window:win,document:win.document});
async function mount(component){const host=document.createElement('div');document.body.append(host);const root=createRoot(host);await act(async()=>root.render(component));return {host,async close(){await act(async()=>root.unmount());host.remove();}};}
async function frame(now){await act(async()=>{const callbacks=[...frames.values()];frames.clear();callbacks.forEach(callback=>callback(now));});}

test('comparison ticker percentages count up while retaining their final accessible comparison',async()=>{
 reduced=false;
 const ui=await mount(React.createElement(ComparisonTicker,{comparison:{current:20,previous:10}}));
 try{
  assert.match(ui.host.textContent,/0%/);assert.match(ui.host.querySelector('p').getAttribute('aria-label'),/up 100%/);
  await frame(0);await frame(450);assert.doesNotMatch(ui.host.textContent,/100%/);
  await frame(900);assert.match(ui.host.textContent,/100%/);assert.equal(frames.size,0);
 }finally{await ui.close();}
});

test('sparkline tooltips expose exact period dates, counts and differences through keyboard and touch',async()=>{
 const ui=await mount(React.createElement(Sparkline,{values:[0,10,20],previousValues:[0,15,18],pointLabels:['Before Nov 1','As of Nov 8','As of Nov 15'],previousPointLabels:['Before Oct 1','As of Oct 8','As of Oct 15'],label:'Membership trend',scaleKey:'tooltip'}));
 try{
  const svg=ui.host.querySelector('svg');svg.getBoundingClientRect=()=>({left:0,width:320});
  await act(async()=>svg.focus());let tip=ui.host.querySelector('[role=tooltip]');
  assert.match(tip.textContent,/As of Nov 15/);assert.match(tip.textContent,/20 members/);assert.match(tip.textContent,/As of Oct 15/);assert.match(tip.textContent,/18 members/);assert.match(tip.textContent,/\+2 vs previous/);
  assert.ok(tip.querySelector('strong').className.includes('text-[#5D94E8]'));assert.ok(tip.querySelectorAll('strong')[1].className.includes('text-slate-500'));assert.ok(tip.lastElementChild.className.includes('text-emerald-700'));
  await act(async()=>svg.dispatchEvent(new win.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true})));tip=ui.host.querySelector('[role=tooltip]');assert.match(tip.textContent,/As of Nov 8/);assert.match(tip.textContent,/10 members/);assert.match(tip.textContent,/-5 vs previous/);assert.ok(tip.lastElementChild.className.includes('text-red-700'));
  await act(async()=>svg.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));assert.equal(ui.host.querySelector('[role=tooltip]'),null);
  await act(async()=>svg.dispatchEvent(new win.MouseEvent('pointerdown',{clientX:160,bubbles:true})));assert.match(ui.host.querySelector('[role=tooltip]').textContent,/As of Nov 8/);
  await act(async()=>document.body.dispatchEvent(new win.Event('pointerdown',{bubbles:true})));assert.equal(ui.host.querySelector('[role=tooltip]'),null);
 }finally{await ui.close();}
});

test('count interpolation preserves decimals, signs and exact large currency totals',()=>{
 assert.equal(interpolateMetric('₱9,007,199,254,740,999.99',0.5),'₱4,503,599,627,370,499.99');
 assert.equal(interpolateMetric('₱9,007,199,254,740,999.99',1),'₱9,007,199,254,740,999.99');
 assert.equal(interpolateMetric('-12.50%',0.5),'-6.25%');
 assert.equal(interpolateMetric('Unavailable',0),'Unavailable');
 assert.equal(interpolateMetric('1,234',0),'0');
 assert.match(renderToStaticMarkup(React.createElement(AnimatedNumber,{as:'p',value:'1,234'})),/>1,234<\/p>/);
});

test('mounted metrics count up, end exactly, and cancel their animation on unmount',async()=>{
 reduced=false;
 const ui=await mount(React.createElement(AnimatedNumber,{value:'₱9,007,199,254,740,999.99'}));
 try{
  assert.equal(ui.host.textContent,'₱0.00');await frame(0);await frame(450);
  assert.notEqual(ui.host.textContent,'₱0.00');assert.notEqual(ui.host.textContent,'₱9,007,199,254,740,999.99');
  await frame(900);assert.equal(ui.host.textContent,'₱9,007,199,254,740,999.99');assert.equal(frames.size,0);
 }finally{await ui.close();}
 const pending=await mount(React.createElement(AnimatedNumber,{value:'100'}));assert.equal(frames.size,1);await pending.close();assert.equal(frames.size,0);
});

test('reduced motion shows final metrics immediately and stops motion when changed mid-animation',async()=>{
 reduced=true;const ui=await mount(React.createElement(AnimatedNumber,{value:'100'}));
 try{assert.equal(ui.host.textContent,'100');assert.equal(frames.size,0);}finally{await ui.close();}
 reduced=false;const running=await mount(React.createElement(AnimatedNumber,{value:'250'}));
 try{
  assert.equal(frames.size,1);reduced=true;await act(async()=>listeners.forEach(callback=>callback()));
  assert.equal(running.host.textContent,'250');assert.equal(frames.size,0);
 }finally{await running.close();reduced=false;}
});

test('service disclosure expands and retreats while keeping closed content out of focus and accessibility trees',async()=>{
 const ui=await mount(React.createElement(AnimatedDisclosure,{trigger:'2 ONGOING SERVICES'},React.createElement('a',{href:'#service'},'Sunday worship')));
 try{
  const button=ui.host.querySelector('button'),panel=document.getElementById(button.getAttribute('aria-controls'));
  assert.equal(button.getAttribute('aria-expanded'),'false');assert.equal(panel.getAttribute('aria-hidden'),'true');assert.ok(panel.hasAttribute('inert'));
  await act(async()=>button.click());assert.equal(button.getAttribute('aria-expanded'),'true');assert.equal(panel.getAttribute('aria-hidden'),'false');assert.ok(!panel.hasAttribute('inert'));assert.match(panel.className,/grid-rows-\[1fr\]/);
  await act(async()=>button.click());assert.equal(button.getAttribute('aria-expanded'),'false');assert.match(panel.className,/grid-rows-\[0fr\]/);assert.ok(panel.hasAttribute('inert'));assert.match(panel.className,/transition-/);
 }finally{await ui.close();}
});


test('membership chart tooltips support pointer, keyboard, zero values, gaps and dismissal',async()=>{
 let captured;
 const Chart=loadTypeScript('app/portal/reports/ReportChart.tsx',{
  '@/components/ui/use-chart-scale':{useChartScale:()=>({max:100,fit(){}}),useChartReducedMotion:()=>true},
  'react-chartjs-2':{Line:props=>{captured=props;return React.createElement('canvas');},Doughnut:props=>{captured=props;return React.createElement('canvas');}},
 },{window:win,document:win.document}).default;
 const ui=await mount(React.createElement(Chart,{title:'Statuses',appearance:'sparkline',kind:'line',showZeroData:true,labels:['Nov 17','Nov 18','Nov 19'],series:[{label:'Active',values:[null,10,15]},{label:'Inactive',values:[null,5,0],color:'#94A3B8'}],emptyMessage:'None'}));
 try{
  const chart=ui.host.querySelector('[role=group]');await act(async()=>chart.focus());
  let tip=ui.host.querySelector('[role=tooltip]');assert.match(tip.textContent,/Nov 19/);assert.match(tip.textContent,/15/);assert.match(tip.textContent,/Previous point/);assert.match(tip.textContent,/\+5 vs previous point/);assert.match(tip.textContent,/-5 vs previous point/);
  assert.ok(tip.querySelector('.text-emerald-700'));assert.ok(tip.querySelector('.text-red-700'));assert.ok(tip.className.includes('bg-white'));
  chart.getBoundingClientRect=()=>({left:100,top:100,right:700,bottom:300,width:600,height:200});
  tip.getBoundingClientRect=()=>({width:256,height:180});
  await act(async()=>chart.dispatchEvent(new win.MouseEvent('pointermove',{clientX:150,clientY:160,bubbles:true})));
  tip=ui.host.querySelector('[role=tooltip]');const firstLeft=tip.style.left,firstTop=tip.style.top;
  await act(async()=>chart.dispatchEvent(new win.MouseEvent('pointermove',{clientX:250,clientY:190,bubbles:true})));
  assert.notEqual(tip.style.left,firstLeft);assert.notEqual(tip.style.top,firstTop);
  await act(async()=>chart.dispatchEvent(new win.MouseEvent('pointermove',{clientX:win.innerWidth-10,clientY:win.innerHeight-10,bubbles:true})));
  assert.ok(parseFloat(tip.style.left)+100+256<=win.innerWidth-8);assert.ok(parseFloat(tip.style.top)+100+180<=win.innerHeight-8);

  await act(async()=>chart.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Home',bubbles:true})));tip=ui.host.querySelector('[role=tooltip]');assert.match(tip.textContent,/Nov 17/);assert.match(tip.textContent,/Unavailable/);assert.doesNotMatch(tip.textContent,/vs previous point/);
  await act(async()=>chart.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));assert.equal(ui.host.querySelector('[role=tooltip]'),null);
  await act(async()=>captured.options.plugins.tooltip.external({tooltip:{opacity:1,dataPoints:[{dataIndex:1}]}}));assert.match(ui.host.querySelector('[role=tooltip]').textContent,/Nov 18/);
  await act(async()=>document.body.dispatchEvent(new win.Event('pointerdown',{bubbles:true})));assert.equal(ui.host.querySelector('[role=tooltip]'),null);
 }finally{await ui.close();}
 const donut=await mount(React.createElement(Chart,{title:'Distribution',appearance:'sparkline',kind:'doughnut',labels:['Active','Inactive'],series:[{label:'Members',values:[80,20]}],valueUnit:'members',centerValue:100,centerLabel:'Members',emptyMessage:'None'}));
 try{
  await act(async()=>donut.host.querySelector('[role=group]').focus());const tip=donut.host.querySelector('[role=tooltip]');assert.match(tip.textContent,/Inactive/);assert.match(tip.textContent,/20% of members/);
 }finally{await donut.close();}
});


test('bar tooltips target the hovered category and dataset for horizontal and vertical bars',async()=>{
 let captured;
 const Chart=loadTypeScript('app/portal/reports/ReportChart.tsx',{
  '@/components/ui/use-chart-scale':{useChartScale:()=>({max:100,fit(){}}),useChartReducedMotion:()=>true},
  'react-chartjs-2':{Bar:props=>{captured=props;return React.createElement('canvas');}},
 },{window:win,document:win.document}).default;
 for(const horizontal of [false,true]){
  const ui=await mount(React.createElement(Chart,{title:'Service comparison',appearance:'sparkline',kind:'bar',horizontal,labels:['Sunday','Midweek'],series:[{label:'North',values:[10,30]},{label:'South',values:[20,40]}],emptyMessage:'None'}));
  try{
   assert.equal(captured.options.interaction.mode,'nearest');assert.equal(captured.options.interaction.intersect,true);assert.equal(captured.options.interaction.axis,'xy');
   await act(async()=>captured.options.plugins.tooltip.external({tooltip:{opacity:1,dataPoints:[{dataIndex:1,datasetIndex:1}]}}));
   let tip=ui.host.querySelector('[role=tooltip]');assert.match(tip.textContent,/Midweek/);assert.match(tip.textContent,/South/);assert.match(tip.textContent,/40/);assert.doesNotMatch(tip.textContent,/North|Sunday|30/);
   const chart=ui.host.querySelector('[role=group]');
   await act(async()=>chart.dispatchEvent(new win.KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true})));
   tip=ui.host.querySelector('[role=tooltip]');assert.match(tip.textContent,/North/);assert.match(tip.textContent,/30/);assert.doesNotMatch(tip.textContent,/South/);
  }finally{await ui.close();}
 }
});


test('service-type checkbox switches totals to averages per completed service and back',async()=>{
 let chart;
 const ServiceChart=loadTypeScript('app/portal/reports/ServiceTypeAttendanceChart.tsx',{
  './ReportChart':{__esModule:true,default:props=>{chart=props;return React.createElement('div',null,props.headerActions);}},
 }).default;
 const ui=await mount(React.createElement(ServiceChart,{types:[{label:'Sunday Worship',attendance:80,completedServices:4},{label:'Midweek',attendance:51,completedServices:2},{label:'No services',attendance:0,completedServices:0}]}));
 try{
  const checkbox=ui.host.querySelector('[role=checkbox]');assert.ok(checkbox);assert.match(ui.host.textContent,/Average per service/);
  assert.equal(chart.series[0].label,'Physical Check-ins');assert.deepEqual(Array.from(chart.series[0].values),[80,51,0]);
  await act(async()=>checkbox.click());assert.equal(checkbox.getAttribute('aria-checked'),'true');assert.equal(chart.series[0].label,'Average attendees per service');assert.deepEqual(Array.from(chart.series[0].values),[20,25.5,null]);
  await act(async()=>checkbox.click());assert.equal(checkbox.getAttribute('aria-checked'),'false');assert.deepEqual(Array.from(chart.series[0].values),[80,51,0]);
 }finally{await ui.close();}
});
