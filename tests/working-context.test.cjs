/* eslint-disable @typescript-eslint/no-require-imports -- Regression harness for browser state and safe return navigation. */
const test = require('node:test'), assert = require('node:assert/strict');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');

function runtime(initialUrl) {
  const slots=[], effects=[], listeners=new Map(); let cursor=0;
  let location=new URL(initialUrl);
  const window={
    get location(){return location;},
    history:{replaceState(_state,_title,url){location=new URL(url,location);}},
    addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);},
    removeEventListener(name,fn){listeners.get(name)?.delete(fn);},
    dispatchEvent(event){for(const fn of listeners.get(event.type)??[])fn();},
  };
  const react={...require('react'),
    useMemo(factory){return factory();},
    useTransition(){return [false, action=>action()];},
    useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},
    useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i];},
    useEffect(effect,deps){const i=cursor++;if(!slots[i]||deps.some((dep,j)=>!Object.is(dep,slots[i].deps[j]))){slots[i]?.cleanup?.();slots[i]={deps};effects.push(()=>{slots[i].cleanup=effect();});}},
  };
  return {window, react,
    render(fn){cursor=0;return fn();},
    flush(){while(effects.length)effects.shift()();},
    pop(url){location=new URL(url,location);window.dispatchEvent({type:'popstate'});},
    globals:{window,Event:class Event{constructor(type){this.type=type;}}},
  };
}

test('list state restores from URL, updates independent controls atomically and responds to browser Back',()=>{
  const r=runtime('https://portal.test/portal/services?other=kept&view.search=%22Ana%22&view.page=3');
  const {useListState}=loadTypeScript('lib/use-list-state.ts',{react:r.react},r.globals);
  const render=()=>r.render(()=>({search:useListState('search',''),page:useListState('page',1)}));
  let state=render();assert.equal(state.search[0],''); // SSR/hydration defaults match.
  r.flush();state=render();assert.equal(state.search[0],'Ana');assert.equal(state.page[0],3);
  state.search[1]('Ben');state.page[1](1);
  assert.equal(new URLSearchParams(r.window.location.search).get('view.search'),'"Ben"');
  assert.equal(new URLSearchParams(r.window.location.search).has('view.page'),false);
  assert.equal(new URLSearchParams(r.window.location.search).get('other'),'kept');
  state=render();state.page[1](value=>value+1);state.page[1](value=>value+1);assert.equal(render().page[0],3);
  r.pop('/portal/services?view.search=%22Cruz%22&view.page=2');state=render();
  assert.equal(state.search[0],'Cruz');assert.equal(state.page[0],2);
});

test('malformed URL state cannot change the expected filter shape or create invalid page numbers',()=>{
  const {readListState}=loadTypeScript('lib/use-list-state.ts');
  for(const raw of ['bad','null','[]','{}','-1','0','1.5','"3"'])assert.equal(readListState('?view.page='+encodeURIComponent(raw),'page',1),1);
  const fallback={search:'',branch:''};
  for(const raw of ['{"search":1,"branch":"a"}','{"search":"a","branch":"b","extra":true}'])assert.equal(readListState('?view.filters='+encodeURIComponent(raw),'filters',fallback),fallback);
  assert.equal(readListState('?view.search='+encodeURIComponent(JSON.stringify('x'.repeat(501))),'search',''),'');
});

test('context links carry live filters and Back/Cancel restore only their intended destination',()=>{
  const r=runtime('https://portal.test/portal/services?view.page=2');
  const Link=loadTypeScript('components/ui/intent-link.tsx',{react:r.react},r.globals).default;
  const props={href:'/portal/services/service-1',preserveContext:true};
  const render=()=>r.render(()=>Link(props));render();r.flush();
  assert.equal(new URL(render().props.href,'https://portal.test').searchParams.get('returnTo'),'/portal/services?view.page=2');
  r.window.history.replaceState(null,'','/portal/services?view.page=3');r.window.dispatchEvent({type:'portal:list-state'});
  assert.equal(new URL(render().props.href,'https://portal.test').searchParams.get('returnTo'),'/portal/services?view.page=3');
  const {safeListReturnHref}=loadTypeScript('lib/list-context-navigation.ts');
  assert.equal(safeListReturnHref('/portal/services','/portal/services?view.page=3'),'/portal/services?view.page=3');
  for(const candidate of ['//evil.test','https://evil.test','/portal/accounts','/portal/services/../accounts','/portal/services\\evil','/portal/services\n','/portal/services#x'])assert.equal(safeListReturnHref('/portal/services',candidate),'/portal/services');
});

test('member and migration histories retain filtered list sources across pagination and nested navigation',()=>{
  const {memberHistoryNavigation}=loadTypeScript('lib/member-history-navigation.ts');
  for(const source of ['/portal/members?branch=north&page=4','/portal/members/migrations?kind=departure&page=3','/portal/members/member-1?returnTo=%2Fportal%2Fmembers%3Fpage%3D4','/portal/contributions?view.page=2']){
    const navigation=memberHistoryNavigation('member-1',source,'/portal/members','Back to Members');
    assert.equal(navigation.backHref,source);
    assert.equal(new URLSearchParams(navigation.pageHref(2)).get('returnTo'),source);
  }
});

test('restored analytics ranges reload their summary and never show figures from the default period',async()=>{
  const {findElement}=require('./helpers/client-hooks.cjs');
  for(const [module,component,refresh] of [['contributions','ContributionsTable','refreshContributionSummary'],['baptisms','BaptismsTable','refreshBaptismSummary']]){
    const range={from:'2026-10-01',to:'2026-10-31',...(module==='baptisms'?{includeUndated:false}:{})};
    const r=runtime(`https://portal.test/portal/${module}?view.range=${encodeURIComponent(JSON.stringify(range))}`);
    let resolveSummary;const calls=[];
    const Component=loadTypeScript(`app/portal/${module}/${component}.tsx`,{react:r.react,'./dashboard-actions':{[refresh]:(from,to)=>{calls.push([from,to]);return new Promise(resolve=>{resolveSummary=resolve;});}}},r.globals).default;
    const props={records:[],branches:[],canUpdate:false,dashboard:{module,from:'2026-11-01',to:'2026-11-30',totals:[],trend:[],breakdown:[]}};
    const render=()=>r.render(()=>Component(props));
    render();r.flush();let tree=render();r.flush();
    assert.equal(findElement(tree,e=>e.type.name==='ModuleMiniDashboard'),undefined);
    assert.ok(findElement(tree,e=>e.props.role==='status'&&String(e.props.children).includes('Restoring')));
    assert.deepEqual(calls,[['2026-10-01','2026-10-31']]);
    resolveSummary({...props.dashboard,...range});await Promise.resolve();
    tree=render();const data=findElement(tree,e=>e.type.name==='ModuleMiniDashboard').props.data;
    assert.equal(data.from,'2026-10-01');assert.equal(data.to,'2026-10-31');
  }
});
