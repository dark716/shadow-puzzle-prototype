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
    this.tagName=tag.toUpperCase();this.children=[];this.parent=null;this.style={};this.dataset={};this.attributes={};this.classList=new FakeClassList();
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
  window:{matchMedia:()=>({matches:false})},
  localStorage:{getItem:()=>null,removeItem(){}},
  location:{href:""},
  performance:{now:()=>now},
  requestAnimationFrame:callback=>{now+=50;queueMicrotask(()=>callback(now));return now},
  setTimeout,clearTimeout,queueMicrotask
});
vm.runInContext(fs.readFileSync(new URL("../game-v34.js",import.meta.url),"utf8"),context,{filename:"game-v34.js"});

const run=source=>vm.runInContext(source,context);
assert.equal(run("state.turn"),0);
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
await new Promise(resolve=>setTimeout(resolve,400));
documentListeners.keyup[0](keyEvent("ArrowRight"));
await new Promise(resolve=>setTimeout(resolve,20));
const heldTurn=run("state.turn");
assert.ok(heldTurn>=2,`holding an arrow key should move more than one tile (turn=${heldTurn}, held=${run("heldDirection")}, gameOver=${run("state.gameOver")})`);
assert.equal(run("state.animating"),false);
console.log("smoke: movement, held movement, shadow spawn, swap, shuriken, expiration passed");
