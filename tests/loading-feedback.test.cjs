/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

test('portal starts with spinner only, reveals messages after three seconds, loops and cleans timers', () => {
  let state = -1, effect, delay, interval, cleared = [];
  const {PortalLoading} = loadTypeScript('components/ui/portal-loading.tsx', {
    react: {...React, useState: () => [state, value => {state = typeof value === 'function' ? value(state) : value;}], useEffect: callback => {effect = callback;}},
  }, {setTimeout: (callback,ms) => {delay={callback,ms};return 1;}, setInterval:(callback,ms)=>{interval={callback,ms};return 2;}, clearTimeout:id=>cleared.push(id),clearInterval:id=>cleared.push(id)});
  let html = renderToStaticMarkup(PortalLoading());
  assert.match(html,/Loading portal/);
  assert.doesNotMatch(html,/Preparing your workspace/);
  const cleanup = effect();
  assert.equal(delay.ms,3000);
  delay.callback();
  html=renderToStaticMarkup(PortalLoading());
  assert.match(html,/Preparing your workspace/);
  assert.equal(interval.ms,4000);
  for(let i=0;i<4;i++)interval.callback();
  assert.match(renderToStaticMarkup(PortalLoading()),/Preparing your workspace/);
  cleanup();assert.deepEqual(cleared,[1,2]);
});

test('submit buttons reflect their form pending status and respect existing disabled state', () => {
  let pending=true;
  const {Button}=loadTypeScript('components/ui/button.tsx',{'react-dom': {useFormStatus:()=>({pending})}});
  let html=renderToStaticMarkup(React.createElement(Button,{type:'submit',pendingLabel:'Saving record...'},'Save'));
  assert.match(html,/disabled=""/);assert.match(html,/aria-busy="true"/);assert.match(html,/Saving record/);
  pending=false;
  html=renderToStaticMarkup(React.createElement(Button,{type:'submit'},'Save'));
  assert.doesNotMatch(html,/aria-busy|disabled=""/);
  html=renderToStaticMarkup(React.createElement(Button,{type:'button',disabled:true},'Unavailable'));
  assert.match(html,/disabled=""/);assert.doesNotMatch(html,/aria-busy/);
});

test('explicit request loading also disables buttons outside server-action forms',()=>{
  const {Button}=loadTypeScript('components/ui/button.tsx',{'react-dom':{useFormStatus:()=>({pending:false})}});
  const html=renderToStaticMarkup(React.createElement(Button,{loading:true,type:'button'},'Generate insights'));
  assert.match(html,/aria-busy="true"/);assert.match(html,/disabled=""/);
});

test('page skeletons expose loading status and use distinct form, history and scanner structures',()=>{
  const {PageSkeleton}=loadTypeScript('components/ui/page-skeleton.tsx');
  const html=kind=>renderToStaticMarkup(React.createElement(PageSkeleton,{kind,label:'member records',metrics:3}));
  for(const kind of ['table','dashboard','form','detail','history','scanner','profiles','auth','settings'])assert.match(html(kind),/role="status"/);
  assert.match(html('scanner'),/aspect-square/);
  assert.doesNotMatch(html('history'),/aspect-square/);
  assert.match(html('form'),/border-t pt-5/);
  assert.doesNotMatch(html('detail'),/border-t pt-5/);
});
