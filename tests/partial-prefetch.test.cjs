const test=require('node:test'),assert=require('node:assert/strict'),React=require('react');
const{readFileSync}=require('node:fs');const{loadTypeScript}=require('./helpers/load-typescript.cjs');
test('portal-only partial prefetching keeps existing cache and runtime settings',()=>{
 const layout=readFileSync('app/portal/layout.tsx','utf8');assert.match(layout,/export const prefetch = "partial"/);assert.doesNotMatch(layout,/export const instant/);
 const config=loadTypeScript('next.config.ts').default;assert.equal(config.cacheComponents,true);assert.equal(config.partialPrefetching,undefined);assert.equal(config.experimental.staleTimes.dynamic,30);
});
test('navigation delegates intent to the shared default-prefetch link',()=>{
 const Link=loadTypeScript('app/portal/ActiveNavigationLink.tsx',{'next/navigation':{usePathname:()=>'/portal/inactivity'}}).default;
 const node=Link({href:'/portal/inactivity',className:'base',activeClassName:'active',inactiveClassName:'inactive',children:'Inactivity'});
 assert.match(readFileSync('app/portal/ActiveNavigationLink.tsx','utf8'),/components\/ui\/intent-link/);assert.equal(node.props.prefetch,undefined);assert.equal(node.props.onMouseEnter,undefined);assert.equal(node.props['aria-current'],'page');
});
test('table links restore default partial prefetch on intent and preserve external event handlers',()=>{
 for(const intent of [false,true]){
  let changed,called=false;const Link=loadTypeScript('components/ui/intent-link.tsx',{react:{...React,useState:()=>[intent,value=>{changed=value;}]}}).default;
  const node=Link({href:'/portal/members/member',children:'Member',onFocus:()=>{called=true;}});
  assert.equal(node.props.prefetch,intent?null:false);node.props.onFocus({});assert.equal(changed,true);assert.equal(called,true);
 }
});

