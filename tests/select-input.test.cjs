/* eslint-disable @typescript-eslint/no-require-imports -- DOM integration tests for the shared select. */
const test=require('node:test'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost',pretendToBeVisual:true});
const win=dom.window;
for(const key of ['window','document','HTMLElement','HTMLFormElement','HTMLSelectElement','Element','Node','NodeFilter','DocumentFragment','MutationObserver','Event','CustomEvent','KeyboardEvent','getComputedStyle','navigator'])Object.defineProperty(globalThis,key,{configurable:true,value:key==='window'?win:win[key]});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
win.HTMLElement.prototype.scrollIntoView=function(){};
win.HTMLElement.prototype.hasPointerCapture=()=>false;
win.HTMLElement.prototype.setPointerCapture=function(){};
win.HTMLElement.prototype.releasePointerCapture=function(){};
const React=require('react'),{act}=React,{createRoot}=require('react-dom/client');
const {loadTypeScript}=require('./helpers/load-typescript.cjs');
const {Select,selectOptions}=loadTypeScript('components/ui/select.tsx',{}, {window:win,document:win.document,Event:win.Event,queueMicrotask});
const option=(value,label,disabled=false)=>React.createElement('option',{value,disabled,key:value},label);
const choices=[option('','Choose branch'),option('a','North'),option('b','South'),option('c','Closed',true)];
async function mount(element){const host=document.createElement('div');document.body.append(host);const root=createRoot(host);await act(async()=>root.render(element));return {host,async close(){await act(async()=>root.unmount());host.remove();}};}
const key=async(element,value)=>act(async()=>{element.dispatchEvent(new win.KeyboardEvent('keydown',{key:value,bubbles:true}));await new Promise(resolve=>setTimeout(resolve,0));});

test('keyboard selection updates the actual named form control and existing change handler',async()=>{
 const changes=[];
 const ui=await mount(React.createElement('form',{},React.createElement(Select,{id:'branch',name:'branch',defaultValue:'a','aria-label':'Branch',onChange:event=>changes.push([event.target.name,event.target.value,event.target instanceof win.HTMLSelectElement])},choices)));
 try{
  const trigger=ui.host.querySelector('[role=combobox]');assert.match(trigger.textContent,/North/);
  await key(trigger,'ArrowDown');assert.ok(document.querySelector('[role=listbox]'));
  const south=[...document.querySelectorAll('[role=option]')].find(item=>item.textContent==='South');
  await act(async()=>south.focus());await key(south,'Enter');
  assert.deepEqual(changes,[['branch','b',true]]);
  assert.equal(new win.FormData(ui.host.querySelector('form')).get('branch'),'b');
  assert.equal(ui.host.querySelectorAll('select[name=branch]').length,1);
  assert.match(trigger.textContent,/South/);assert.equal(document.querySelector('[role=listbox]'),null);
  assert.equal(document.activeElement,trigger);
 }finally{await ui.close();}
});

test('required validation targets the visible trigger and disabled inputs stay out of submission',async()=>{
 const ref=React.createRef();
 const ui=await mount(React.createElement('form',{},React.createElement(Select,{ref,id:'required-branch',name:'branch',required:true,'aria-label':'Branch'},choices),React.createElement(Select,{name:'disabled',disabled:true,defaultValue:'a'},choices)));
 try{
  const form=ui.host.querySelector('form'),trigger=ui.host.querySelector('#required-branch');
  await act(async()=>assert.equal(form.checkValidity(),false));
  assert.equal(trigger.getAttribute('aria-invalid'),'true');assert.ok(ui.host.querySelector('[role=alert]'));
  await act(async()=>ref.current.focus());assert.equal(document.activeElement,trigger);
  await act(async()=>{ref.current.value='a';ref.current.dispatchEvent(new win.Event('change',{bubbles:true}));});
  assert.equal(form.checkValidity(),true);assert.equal(ui.host.querySelector('[role=alert]'),null);
  assert.equal(new win.FormData(form).has('disabled'),false);
 }finally{await ui.close();}
});

test('reset restores the declared default without emitting a user change; controlled props remain authoritative',async()=>{
 const ref=React.createRef(),changes=[];
 const ui=await mount(React.createElement('form',{},React.createElement(Select,{ref,name:'branch',defaultValue:'b',onChange:event=>changes.push(event.target.value)},choices)));
 try{
  await act(async()=>{ref.current.value='a';ref.current.dispatchEvent(new win.Event('change',{bubbles:true}));});
  await act(async()=>{ui.host.querySelector('form').reset();await Promise.resolve();});
  assert.equal(ref.current.value,'b');assert.match(ui.host.querySelector('[role=combobox]').textContent,/South/);assert.deepEqual(changes,['a']);
 }finally{await ui.close();}
 const controlled=await mount(React.createElement(Select,{value:'a','aria-label':'Controlled'},choices));
 try{assert.match(controlled.host.querySelector('[role=combobox]').textContent,/North/);}finally{await controlled.close();}
});

test('pickers stay inside native modal dialogs and preserve disabled groups and empty options',async()=>{
 const ui=await mount(React.createElement('dialog',{open:true},React.createElement(Select,{'aria-label':'Dialog branch',defaultValue:'a'},choices)));
 try{
  await key(ui.host.querySelector('[role=combobox]'),'ArrowDown');
  assert.ok(ui.host.querySelector('dialog [role=listbox]'));
  await key(document.activeElement,'Escape');assert.equal(document.querySelector('[role=listbox]'),null);
  const rows=selectOptions(React.createElement('optgroup',{label:'Closed branches',disabled:true},option('','No branch'),option('c','Closed')));
  assert.equal(rows[0].value,'');assert.ok(rows.every(row=>row.disabled&&row.group==='Closed branches'));
 }finally{await ui.close();}
});
