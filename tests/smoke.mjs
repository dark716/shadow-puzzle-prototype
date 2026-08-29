import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

class FakeClassList{
  constructor(){this.values=new Set()}
  add(...names){names.forEach(name=>this.values.add(name))}
  remove(...names){names.forEach(name=>this.values.delete(name))}
  contains(name){return this.values.has(name)}
  toggle(name,force){const enabled=force??!this.values.has(name);enabled?this.values.add(name):this.values.delete(name);return enabled}
}
class FakeElement{
  constructor(tag="div"){
    this.tagName=tag.toUpperCase();this.children=[];this.parent=null;this.style={setProperty(name,value){this[name]=value},removeProperty(name){delete this[name]}};this.dataset={};this.attributes={};this.classList=new FakeClassList();
    this.disabled=false;this.hidden=false;this.textContent="";this._innerHTML="";this.listeners={};
  }
  set className(value){this.classList=new FakeClassList();String(value).split(/\s+/).filter(Boolean).forEach(name=>this.classList.add(name))}
  get className(){return [...this.classList.values].join(" ")}
  set innerHTML(value){this._innerHTML=String(value);this.children=[]}
  get innerHTML(){return this._innerHTML}
  append(...nodes){for(const node of nodes){if(!node)continue;node.parent=this;this.children.push(node)}}
  appendChild(node){this.append(node);return node}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=null}
  setAttribute(name,value){this.attributes[name]=String(value)}
  addEventListener(type,handler){(this.listeners[type]??=[]).push(handler)}
  getBoundingClientRect(){return{width:48,height:48,left:0,top:0,right:48,bottom:48}}
  querySelector(selector){return this.querySelectorAll(selector)[0]??null}
  querySelectorAll(selector){
    const matches=node=>selector.startsWith(".")?node.classList.contains(selector.slice(1)):selector.startsWith("#")?node.id===selector.slice(1):false;
    const result=[];const visit=node=>{for(const child of node.children){if(matches(child))result.push(child);visit(child)}};visit(this);return result;
  }
}

const ids=["board","message","turnCount","shadowTurns","shadowButton","shurikenButton","cancelShadowButton","swapButton","gameOverModal","stageTitle","restoreStagesButton","resetButton","restartGameButton","endGameButton"];
const elements=Object.fromEntries(ids.map(id=>{const el=new FakeElement(id.includes("Button")?"button":"div");el.id=id;return[id,el]}));
const boardPanel=new FakeElement("section");boardPanel.className="board-panel";boardPanel.append(elements.board);
const moveButtons=["up","left","right","down"].map(direction=>{const el=new FakeElement("button");el.dataset.move=direction;return el});
const body=new FakeElement("body");
const documentListeners={};
const document={
  body,
  createElement:tag=>new FakeElement(tag),
  querySelector(selector){if(selector===".board-panel")return boardPanel;if(selector.startsWith("#"))return elements[selector.slice(1)]??null;return null},
  querySelectorAll(selector){return selector==="[data-move]"?moveButtons:[]},
  addEventListener(type,handler){(documentListeners[type]??=[]).push(handler)}
};
let now=0;
const context=vm.createContext({
  console,document,
  window:{innerWidth:412,matchMedia:()=>({matches:false}),addEventListener(){}},
  localStorage:{getItem:()=>null,removeItem(){}},
  location:{href:""},
  performance:{now:()=>now},
  requestAnimationFrame:callback=>{now+=50;queueMicrotask(()=>callback(now));return now},
  setTimeout,clearTimeout,queueMicrotask
});
vm.runInContext(fs.readFileSync(new URL("../game-v34.js",import.meta.url),"utf8"),context,{filename:"game-v34.js"});

const spritePng=fs.readFileSync(new URL("../assets/sprites/player_reference_32.png",import.meta.url));
assert.equal(spritePng.readUInt32BE(16),256,"sprite sheet width must remain 8 × 32px");
assert.equal(spritePng.readUInt32BE(20),128,"sprite sheet height must remain 4 × 32px");
const obstaclePng=fs.readFileSync(new URL("../assets/obstacles/stone-pillar-32.png",import.meta.url));
assert.equal(obstaclePng.readUInt32BE(16),32,"obstacle asset must remain one 32px tile wide");
assert.equal(obstaclePng.readUInt32BE(20),32,"obstacle asset must remain one 32px tile high");
const tilesetPng=fs.readFileSync(new URL("../assets/tiles/shadow_puzzle_tileset_v1.png",import.meta.url));
assert.equal(tilesetPng.readUInt32BE(16),256,"environment tileset must remain 8 × 32px wide");
assert.equal(tilesetPng.readUInt32BE(20),128,"environment tileset must remain 4 × 32px high");
const consolePanelPng=fs.readFileSync(new URL("../assets/ui/ui_console_panel_v1.png",import.meta.url));
assert.equal(consolePanelPng.readUInt32BE(16),1024,"console panel width must remain 1024px");
assert.equal(consolePanelPng.readUInt32BE(20),403,"console panel height must remain 403px");
const consoleButtonsPng=fs.readFileSync(new URL("../assets/ui/ui_console_buttons_v1.png",import.meta.url));
assert.equal(consoleButtonsPng.readUInt32BE(16),384,"console button sheet must remain 3 × 128px wide");
assert.equal(consoleButtonsPng.readUInt32BE(20),256,"console button sheet must remain 2 × 128px high");
const finalPanelPng=fs.readFileSync(new URL("../assets/ui/final/control_panel_frame.png",import.meta.url));
assert.equal(finalPanelPng.readUInt32BE(16),1024,"final console panel width must remain 1024px");
assert.equal(finalPanelPng.readUInt32BE(20),284,"final console panel height must remain 284px");
for(const [file,width,height] of [["dpad_button.png",128,128],["option_button.png",128,106],["inventory_slot.png",96,84],["skill_button.png",128,128]]){
  const png=fs.readFileSync(new URL(`../assets/ui/final/${file}`,import.meta.url));
  assert.equal(png.readUInt32BE(16),width,`${file} width contract`);
  assert.equal(png.readUInt32BE(20),height,`${file} height contract`);
}
const uiCss=fs.readFileSync(new URL("../game-ui-v1.css",import.meta.url),"utf8");
assert.match(uiCss,/\.actor\{[^}]*width:64px;[^}]*height:64px;/s,"32px actors must render at exact 2× size");
assert.match(uiCss,/transform-origin:32px 56px/,"scaled (16,28) anchor must remain (32,56)");
assert.match(uiCss,/@media\(max-width:820px\)\{[^}]*\}\s*\.actor\{[^}]*width:32px;[^}]*height:32px;[^}]*transform-origin:16px 28px/s,"mobile actors must use exact 1× size and the original anchor");
assert.match(uiCss,/margin-top:calc\(var\(--cell\) - 32px\)/,"the mobile sprite canvas must end at the tile boundary");
assert.match(uiCss,/\.actor\.facing-left\{margin-left:calc\(var\(--cell\)\/2 - 18px\)\}/,"left-facing sprites need a mobile-only 2px optical correction");
assert.match(uiCss,/\.skill-pad\{width:40vw;max-width:164px\}/,"mobile console action buttons need balanced space beside the d-pad");
assert.match(uiCss,/\.cell\.art-tile\{/,"board environment must use the unified PNG tileset");
assert.match(uiCss,/ui_console_panel_v1\.png/,"control deck must use the raster console panel");
assert.match(uiCss,/ui_console_buttons_v1\.png/,"controls must use the raster button sheet");
assert.match(uiCss,/control_panel_frame\.png/,"final UI must use the reference-extracted panel");
assert.match(uiCss,/grid-template-columns:30% 40% 30%/,"console must preserve the 30/40/30 layout");
const indexHtml=fs.readFileSync(new URL("../index.html",import.meta.url),"utf8");
assert.equal((indexHtml.match(/class="inventory-slot"/g)||[]).length,6,"inventory must contain exactly six slots");
assert.equal((indexHtml.match(/skill-(?:north|west|east|south)/g)||[]).length,4,"skill group must contain four diamond positions");

const run=source=>vm.runInContext(source,context);
assert.equal(run("state.turn"),0);
assert.equal(run("board.style['--cell']"),"30px");
assert.equal(run("state.player.x+','+state.player.y"),"2,4");
await run("move(0,-1)");
assert.equal(run("state.turn"),1);
assert.equal(run("state.player.x+','+state.player.y"),"2,3");
await run("createShadow(4,3)");
assert.equal(run("state.turn"),2);
assert.equal(run("state.shadowLife"),6);
await run("swap()");
assert.equal(run("state.turn"),3);
assert.equal(run("state.shadowLife"),5);
assert.equal(run("state.player.x+','+state.player.y"),"4,3");
await run("throwShuriken()");
assert.equal(run("state.turn"),4);
assert.equal(run("state.shadowLife"),4);
await run("throwShuriken()");
await run("throwShuriken()");
await run("throwShuriken()");
await run("throwShuriken()");
assert.equal(run("state.shadow"),null);
assert.equal(run("state.shadowLife"),0);
assert.equal(run("state.animating"),false);

run("loadStage(0)");
const keyEvent=key=>({key,repeat:false,preventDefault(){}});
documentListeners.keydown[0](keyEvent("ArrowRight"));
await new Promise(resolve=>setTimeout(resolve,650));
documentListeners.keyup[0](keyEvent("ArrowRight"));
await new Promise(resolve=>setTimeout(resolve,20));
const heldTurn=run("state.turn");
assert.ok(heldTurn>=2,`holding an arrow key should move more than one tile (turn=${heldTurn}, held=${run("heldDirection")}, gameOver=${run("state.gameOver")})`);
assert.equal(run("state.animating"),false);

run("loadStage(0)");
const rightButton=moveButtons.find(button=>button.dataset.move==="right");
rightButton.listeners.pointerdown[0]({button:0,pointerId:1,preventDefault(){}});
await new Promise(resolve=>setTimeout(resolve,650));
rightButton.listeners.pointerup[0]({pointerId:1});
await new Promise(resolve=>setTimeout(resolve,20));
const touchHeldTurn=run("state.turn");
assert.ok(touchHeldTurn>=2,`holding a movement button should move more than one tile (turn=${touchHeldTurn})`);
assert.equal(run("state.animating"),false);
console.log("smoke: movement, keyboard hold, touch hold, shadow spawn, swap, shuriken, expiration passed");
