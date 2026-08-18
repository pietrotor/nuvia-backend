#!/usr/bin/env node
/**
 * Build-time patch for Evolution 2.3.7.
 *
 * Upstream only exposes findLabels + handleLabel, and associations often fail to
 * sync when applied with a phone-number JID. This script:
 *  1. Makes handleLabel resolve LID before add/remove.
 *  2. Adds ensureLabel(name, color?) — find-or-create via Baileys addLabel.
 *  3. Exposes POST /label/ensureLabel/{instance} on every bundled router copy
 *     AND on dist/main.js (the production entrypoint that start:prod runs).
 *  4. Wires LabelController.ensureLabel.
 *
 * Minified identifier names differ between dist/main.js and the per-route
 * bundles (e.g. F vs W for BadRequestException), so replacements capture them.
 *
 * Re-run after every base image / Baileys override change.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = process.env.EVOLUTION_ROOT || '/evolution';

// Minified error class names (W/F, f/y, …) vary per bundle.
const HANDLE_LABEL_RE =
  /async handleLabel\(e\)\{let t=await this\.whatsappNumber\(\{numbers:\[e\.number\]\}\);if\(t\.length===0\)throw new ([A-Za-z_$][\w$]*)\("Number not found"\);let o=t\[0\];if\(!o\.exists\)throw new \1\("Number is not on WhatsApp"\);try\{if\(e\.action==="add"\)return await this\.client\.addChatLabel\(o\.jid,e\.labelId\),await this\.addLabel\(e\.labelId,this\.instanceId,o\.jid\),\{numberJid:o\.jid,labelId:e\.labelId,add:!0\};if\(e\.action==="remove"\)return await this\.client\.removeChatLabel\(o\.jid,e\.labelId\),await this\.removeLabel\(e\.labelId,this\.instanceId,o\.jid\),\{numberJid:o\.jid,labelId:e\.labelId,remove:!0\}\}catch\(i\)\{throw new ([A-Za-z_$][\w$]*)\(`Unable to \$\{e\.action\} label to chat`,i\.toString\(\)\)\}\}/;

const CONTROLLER_RE =
  /async handleLabel\(\{instanceName:([A-Za-z_$][\w$]*)\},([A-Za-z_$][\w$]*)\)\{return await this\.waMonitor\.waInstances\[\1\]\.handleLabel\(\2\)\}/;

const ROUTE_RE =
  /\.post\(this\.routerPath\("handleLabel"\),(\.\.\.[a-zA-Z]+),async\(([a-zA-Z]+),([a-zA-Z]+)\)=>\{let ([a-zA-Z]+)=await this\.dataValidate\(\{request:\2,schema:[^,]+,ClassRef:[^,]+,execute:\(([a-zA-Z]+),([a-zA-Z]+)\)=>([a-zA-Z]+)\.handleLabel\(\5,\6\)\}\);return \3\.status\(200\)\.json\(\4\)\}\)/g;

function buildHandleAndEnsure(notFoundErr, unableErr) {
  return `
async handleLabel(e){
  let t=await this.whatsappNumber({numbers:[e.number]});
  if(t.length===0)throw new ${notFoundErr}("Number not found");
  let o=t[0];
  if(!o.exists)throw new ${notFoundErr}("Number is not on WhatsApp");
  const targetJid=await this.__nuviaResolveLabelJid(o.jid);
  try{
    if(e.action==="add"){
      await this.client.addChatLabel(targetJid,e.labelId);
      if(targetJid!==o.jid){try{await this.client.addChatLabel(o.jid,e.labelId)}catch(_){}}
      await this.addLabel(e.labelId,this.instanceId,o.jid);
      return{numberJid:targetJid,labelId:e.labelId,add:!0};
    }
    if(e.action==="remove"){
      await this.client.removeChatLabel(targetJid,e.labelId);
      if(targetJid!==o.jid){try{await this.client.removeChatLabel(o.jid,e.labelId)}catch(_){}}
      await this.removeLabel(e.labelId,this.instanceId,o.jid);
      return{numberJid:targetJid,labelId:e.labelId,remove:!0};
    }
  }catch(i){throw new ${unableErr}(\`Unable to \${e.action} label to chat\`,i.toString())}
}
async __nuviaResolveLabelJid(pnJid){
  try{
    const lid=await this.client?.signalRepository?.lidMapping?.getLIDForPN?.(pnJid);
    return lid||pnJid;
  }catch(_){return pnJid}
}
async ensureLabel(e){
  const name=String(e?.name||"").trim();
  if(!name)throw new ${notFoundErr}("Label name is required");
  const color=Number.isFinite(Number(e?.color))?Number(e.color):0;
  const existing=await this.fetchLabels();
  const match=existing.find(l=>String(l.name).toLowerCase()===name.toLowerCase());
  if(match)return{id:String(match.id),name:match.name,color:match.color,created:false};
  const nextId=String(
    existing.reduce((max,l)=>{const n=Number.parseInt(String(l.id),10);return Number.isFinite(n)?Math.max(max,n):max},0)+1
  );
  await this.client.addLabel("",{id:nextId,name,color,deleted:false});
  try{
    await this.prismaRepository.label.upsert({
      where:{labelId_instanceId:{instanceId:this.instanceId,labelId:nextId}},
      update:{name,color:String(color),predefinedId:null},
      create:{labelId:nextId,name,color:String(color),predefinedId:null,instanceId:this.instanceId}
    });
  }catch(_){}
  return{id:nextId,name,color,created:true};
}
`.replace(/\n\s*/g, '');
}

function patchHandleLabelInSource(source, filePath) {
  if (source.includes('async ensureLabel(') && source.includes('__nuviaResolveLabelJid')) {
    return { source, changed: false, reason: 'already patched' };
  }
  const match = source.match(HANDLE_LABEL_RE);
  if (!match) {
    throw new Error(
      `handleLabel body not found in ${filePath} — Evolution layout changed`,
    );
  }
  const [, notFoundErr, unableErr] = match;
  return {
    source: source.replace(
      HANDLE_LABEL_RE,
      buildHandleAndEnsure(notFoundErr, unableErr),
    ),
    changed: true,
  };
}

function patchControllerInSource(source, filePath) {
  if (/async ensureLabel\(\{instanceName:/.test(source)) {
    return { source, changed: false, reason: 'already patched' };
  }
  const match = source.match(CONTROLLER_RE);
  if (!match) {
    throw new Error(`handleLabel controller method not found in ${filePath}`);
  }
  const [full, instanceVar, dataVar] = match;
  const replacement =
    `${full}async ensureLabel({instanceName:${instanceVar}},${dataVar}){` +
    `return await this.waMonitor.waInstances[${instanceVar}].ensureLabel(${dataVar})}`;
  return { source: source.replace(CONTROLLER_RE, replacement), changed: true };
}

function patchRoutesInSource(source, filePath) {
  if (!source.includes('routerPath("handleLabel")')) {
    return { source, changed: false, reason: 'no handleLabel route' };
  }
  if (source.includes('routerPath("ensureLabel")')) {
    return { source, changed: false, reason: 'already patched' };
  }

  let replacements = 0;
  const next = source.replace(
    ROUTE_RE,
    (
      full,
      guards,
      req,
      res,
      response,
      instanceArg,
      dataArg,
      controller,
    ) => {
      replacements += 1;
      return (
        `${full}.post(this.routerPath("ensureLabel"),${guards},async(${req},${res})=>{` +
        `let ${response}=await this.dataValidate({request:${req},schema:null,ClassRef:Object,execute:(${instanceArg},${dataArg})=>${controller}.ensureLabel(${instanceArg},${dataArg})});` +
        `return ${res}.status(200).json(${response})})`
      );
    },
  );

  if (replacements === 0) {
    throw new Error(`Could not patch handleLabel route in ${filePath}`);
  }
  return { source: next, changed: true, replacements };
}

function writeIfChanged(filePath, result, label) {
  if (!result.changed) {
    console.log(`skip ${label} (${result.reason}): ${filePath}`);
    return;
  }
  fs.writeFileSync(filePath, result.source);
  const extra = result.replacements ? ` (${result.replacements}x)` : '';
  console.log(`patched ${label}${extra}: ${filePath}`);
}

function patchFile(filePath, kinds) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }
  let source = fs.readFileSync(filePath, 'utf8');
  if (kinds.includes('service')) {
    const result = patchHandleLabelInSource(source, filePath);
    writeIfChanged(filePath, result, 'Baileys service');
    source = result.changed ? result.source : source;
  }
  if (kinds.includes('controller')) {
    // Re-read if service wrote, or use current buffer
    source = fs.readFileSync(filePath, 'utf8');
    const result = patchControllerInSource(source, filePath);
    writeIfChanged(filePath, result, 'label controller');
  }
  if (kinds.includes('route')) {
    source = fs.readFileSync(filePath, 'utf8');
    const result = patchRoutesInSource(source, filePath);
    writeIfChanged(filePath, result, 'router');
  }
}

function patchRouterBundles(dir) {
  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.js') || name.endsWith('.mjs'));
  for (const name of files) {
    const filePath = path.join(dir, name);
    const source = fs.readFileSync(filePath, 'utf8');
    if (!source.includes('routerPath("handleLabel")')) continue;
    patchFile(filePath, ['route']);
  }
}

function main() {
  // Production entrypoint — this is what `node dist/main` actually loads.
  patchFile(path.join(ROOT, 'dist/main.js'), [
    'service',
    'controller',
    'route',
  ]);

  // Keep the modular copies in sync (useful for debugging / alternate entrypoints).
  patchFile(
    path.join(
      ROOT,
      'dist/api/integrations/channel/whatsapp/whatsapp.baileys.service.js',
    ),
    ['service'],
  );
  patchFile(path.join(ROOT, 'dist/api/controllers/label.controller.js'), [
    'controller',
  ]);
  patchRouterBundles(path.join(ROOT, 'dist/api/routes'));

  const mainJs = fs.readFileSync(path.join(ROOT, 'dist/main.js'), 'utf8');
  if (!mainJs.includes('routerPath("ensureLabel")')) {
    throw new Error('dist/main.js is missing ensureLabel route after patch');
  }
  if (!mainJs.includes('async ensureLabel(')) {
    throw new Error('dist/main.js is missing ensureLabel method after patch');
  }

  console.log('Evolution label patch applied.');
}

main();
