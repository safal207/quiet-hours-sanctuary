import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const root=path.resolve(new URL('../dist/',import.meta.url).pathname), html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.match(html,/<html lang="ru">/);assert.match(html,/<title>[^<]+<\/title>/);assert.equal((html.match(/<h1[ >]/g)||[]).length,1);
const ids=[...html.matchAll(/\bid="([^"<>]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,'Duplicate HTML IDs');
for(const [,url]of html.matchAll(/(?:src|href)="([^"<>]+)"/g)){if(url.startsWith('#')){if(url.length>1)assert.ok(ids.includes(url.slice(1)),'Missing anchor '+url);continue}if(/^(https?:|data:|mailto:)/.test(url))continue;assert.ok(fs.existsSync(path.resolve(root,url.split(/[?#]/)[0])),'Missing local asset '+url)}
for(const file of fs.readdirSync(root).filter(f=>f.endsWith('.js'))){const result=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8'});assert.equal(result.status,0,result.stderr)}
if(fs.existsSync(path.join(root,'state.js'))){const{preset,validate,estimatedWatts}=await import('../dist/state.js');assert.equal(estimatedWatts(preset('away')),0);assert.equal(estimatedWatts(preset('evening')),32);assert.equal(estimatedWatts(preset('cinema')),3);const changed=preset('evening');changed.lights.floor=false;assert.equal(preset('evening').lights.floor,true);const corrupt=validate({brightness:1000,temperature:-90,lights:{floor:'yes'},ac:'true'});assert.equal(corrupt.brightness,100);assert.equal(corrupt.temperature,16);assert.equal(typeof corrupt.lights.floor,'boolean');assert.equal(typeof corrupt.ac,'boolean');assert.deepEqual(validate(null),preset('evening'))}
if(fs.existsSync(path.join(root,'art.js'))){const{composition,palettes}=await import('../dist/art.js');for(const palette of Object.keys(palettes)){const svg=composition(palette,[true,false,true,false,true]);assert.equal((svg.match(/<g id="layer-/g)||[]).length,3);assert.ok(!svg.includes('id="layer-2"'));assert.ok(!svg.includes('id="layer-4"'));assert.ok(!svg.includes('undefined'));assert.match(svg,/<svg[^>]+viewBox="0 0 600 700"/)}assert.equal((composition('sunset',[false,false,false,false,false]).match(/<g id="layer-/g)||[]).length,0)}
console.log('PASS: HTML metadata, unique IDs, local files, anchors, JS syntax and applicable state/export contracts.');
console.log('LIMIT: no browser rendering, responsive screenshot or WebGL execution checks were available.');
