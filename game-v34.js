const BUILT_IN_STAGES=[
  [
    "#############",
    "#.....#.....#",
    "#.....#.....#",
    "#.....#.....#",
    "#.P...#...G.#",
    "#.....#.....#",
    "#.....#.....#",
    "#.....#.....#",
    "#.....#.....#",
    "#############"
  ],
  [
    "#############",
    "#.....##....#",
    "#.....##....#",
    "#.....##....#",
    "#.P...#O..G.#",
    "#.....##....#",
    "#.....#.....#",
    "#.....##....#",
    "#.....##....#",
    "#############"
  ],
  [
    "#############",
    "#P..##..#...#",
    "#...#....####",
    "#...#########",
    "###########.#",
    "#.###...##..#",
    "#.##..####.##",
    "#.###########",
    "#..####..##G#",
    "#############"
  ],
  [
    "#############",
    "#....###....#",
    "#....###....#",
    "#....###....#",
    "#.P..#.#..G.#",
    "#....###....#",
    "#....###....#",
    "#....###....#",
    "#....###....#",
    "#############"
  ],
  [
    "#############",
    "#P..##..##..#",
    "#...##..###.#",
    "#...##..#.#.#",
    "#######.###.#",
    "#####.#######",
    "#...#######.#",
    "#....###.#..#",
    "#....#.#.##G#",
    "#############"
  ]
];

const APPLIED_STAGES_KEY="shadowPuzzleAppliedStages";
const SPRITES={
  playerIdle:"assets/sprites/player_reference_32.png?v=1",
  playerWalk:"assets/sprites/player_reference_32.png?v=1",
  playerThrow:"assets/sprites/player_reference_32.png?v=1",
  shadowSpawn:"assets/effects/shadow_spawn.png?v=1",
  swapBurst:"assets/effects/swap_burst.png?v=1",
  shuriken:"assets/projectiles/shuriken_spin.png?v=1"
};
const DIRECTION_ROWS={down:0,left:1,right:2,up:3};
const DIRECTION_VECTORS={down:[0,1],left:[-1,0],right:[1,0],up:[0,-1]};
const REDUCED_MOTION=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches??false;

function validAppliedStage(stage){
  if(!Array.isArray(stage)||!stage.length)return false;
  const width=stage[0]?.length??0;
  if(!width||stage.some(row=>typeof row!=="string"||row.length!==width||!/^[.#OPG]+$/.test(row)))return false;
  const tiles=stage.join("");
  return (tiles.match(/P/g)||[]).length===1&&(tiles.match(/G/g)||[]).length===1;
}
function readAppliedStages(){
  try{
    const saved=JSON.parse(localStorage.getItem(APPLIED_STAGES_KEY));
    if(!Array.isArray(saved)||!saved.length||!saved.every(validAppliedStage))return null;
    return saved.map(stage=>[...stage]);
  }catch{return null}
}

const appliedStages=readAppliedStages();
const USING_EDITOR_STAGES=Boolean(appliedStages);
const STAGES=appliedStages??BUILT_IN_STAGES;
let MAP=[],currentStage=0,start=null,goal=null,stageTimer=null;
let walls=new Set(),obstacles=new Set();
const state={
  player:null,
  shadow:null,
  shadowLife:0,
  swapUsed:false,
  turn:0,
  selecting:false,
  cursor:null,
  cleared:false,
  gameOver:false,
  transitioning:false,
  animating:false,
  facing:"down",
  shadowFacing:"down"
};

const board=document.querySelector("#board"),message=document.querySelector("#message");
const turnCount=document.querySelector("#turnCount"),shadowTurns=document.querySelector("#shadowTurns");
const shadowButton=document.querySelector("#shadowButton"),shurikenButton=document.querySelector("#shurikenButton");
const cancelShadowButton=document.querySelector("#cancelShadowButton"),swapButton=document.querySelector("#swapButton");
const gameOverModal=document.querySelector("#gameOverModal"),stageTitle=document.querySelector("#stageTitle");
const restoreStagesButton=document.querySelector("#restoreStagesButton"),resetButton=document.querySelector("#resetButton");
document.querySelector(".board-panel").append(gameOverModal);
restoreStagesButton.hidden=!USING_EDITOR_STAGES;

const key=(x,y)=>x+","+y;
const samePosition=(a,b)=>Boolean(a&&b&&a.x===b.x&&a.y===b.y);
const duration=ms=>REDUCED_MOTION?1:ms;

function prepareStage(index){
  currentStage=index;MAP=STAGES[index];walls=new Set();obstacles=new Set();goal=null;start=null;
  MAP.forEach((row,y)=>[...row].forEach((v,x)=>{
    if(v==="#")walls.add(key(x,y));
    if(v==="O")obstacles.add(key(x,y));
    if(v==="P")start={x,y};
    if(v==="G")goal={x,y};
  }));
}
function blocked(x,y){return x<0||y<0||y>=MAP.length||x>=MAP[0].length||walls.has(key(x,y))||obstacles.has(key(x,y))}
function ringFrom(player){const out=[];for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(Math.max(Math.abs(dx),Math.abs(dy))===2)out.push({x:player.x+dx,y:player.y+dy});return out}
function candidates(){return ringFrom(state.player)}
function directionFrom(dx,dy){if(dx<0)return"left";if(dx>0)return"right";if(dy<0)return"up";return"down"}
function decaySnapshot(s){
  if(!s.shadow)return s;
  const life=s.life-1;
  return life<=0?{...s,shadow:null,life:0,swapUsed:false}:{...s,life};
}
function canStillReachGoal(){
  const initial={player:{...state.player},shadow:state.shadow?{...state.shadow}:null,life:state.shadowLife,swapUsed:state.swapUsed};
  const queue=[initial],seen=new Set();
  const signature=s=>[s.player.x,s.player.y,s.shadow?.x??-1,s.shadow?.y??-1,s.life,s.swapUsed?1:0].join(",");
  while(queue.length){
    const s=queue.shift(),sig=signature(s);
    if(seen.has(sig))continue;
    seen.add(sig);
    if(s.player.x===goal.x&&s.player.y===goal.y)return true;
    const next=[];
    for(const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]]){
      const p={x:s.player.x+dx,y:s.player.y+dy};
      if(!blocked(p.x,p.y)&&!(s.shadow&&samePosition(p,s.shadow)))next.push(decaySnapshot({...s,player:p}));
    }
    if(!s.shadow){
      for(const p of ringFrom(s.player))if(!blocked(p.x,p.y))next.push({...s,shadow:p,life:6,swapUsed:false});
    }else if(!s.swapUsed){
      next.push(decaySnapshot({...s,player:{...s.shadow},shadow:{...s.player},swapUsed:true}));
    }
    for(const n of next)if(!seen.has(signature(n)))queue.push(n);
  }
  return false;
}

function setSheetFrame(element,frame,row,columns=4,rows=4){
  const x=columns<=1?0:(frame*100)/(columns-1);
  const y=rows<=1?0:(row*100)/(rows-1);
  element.style.backgroundPositionX=x+"%";
  element.style.backgroundPositionY=y+"%";
}
function positionEntity(element,position){
  element.style.left=`calc(${position.x} * var(--cell))`;
  element.style.top=`calc(${position.y} * var(--cell))`;
}
function createActor(kind,position,facing){
  const actor=document.createElement("div");
  actor.className=`actor ${kind}-actor idle-animation`;
  actor.dataset.kind=kind;
  actor.style.backgroundImage=`url("${SPRITES.playerIdle}")`;
  actor.style.backgroundSize="800% 400%";
  actor.style.backgroundPositionY=((DIRECTION_ROWS[facing]*100)/3)+"%";
  positionEntity(actor,position);
  return actor;
}
function createEffect(position,sheet,columns=6){
  const layer=board.querySelector(".effect-layer");
  if(!layer)return null;
  const effect=document.createElement("div");
  effect.className="cell-effect manual-animation";
  effect.style.backgroundImage=`url("${sheet}")`;
  effect.style.backgroundSize=`${columns*100}% 100%`;
  positionEntity(effect,position);
  layer.append(effect);
  setSheetFrame(effect,0,0,columns,1);
  return effect;
}
function render(){
  board.innerHTML="";
  board.style.gridTemplateColumns=`repeat(${MAP[0].length},var(--cell))`;
  board.style.gridTemplateRows=`repeat(${MAP.length},var(--cell))`;
  board.setAttribute("aria-label",`Stage ${currentStage+1} 격자`);
  const valid=new Set(state.selecting&&!state.shadow?candidates().filter(p=>!blocked(p.x,p.y)).map(p=>key(p.x,p.y)):[]);
  const ring=new Set(state.selecting&&!state.shadow?candidates().map(p=>key(p.x,p.y)):[]);
  MAP.forEach((row,y)=>[...row].forEach((_,x)=>{
    const el=document.createElement("button");
    el.className="cell";el.setAttribute("role","gridcell");el.setAttribute("aria-label",x+", "+y);
    const k=key(x,y);
    if(walls.has(k))el.classList.add("wall");
    else if(obstacles.has(k)){
      el.classList.add("obstacle");
      const sprite=document.createElement("img");sprite.className="entity-sprite obstacle-sprite";sprite.src="assets/obstacle.png?v=1";sprite.alt="장애물";sprite.draggable=false;el.append(sprite);
    }
    if(goal.x===x&&goal.y===y){
      el.classList.add("goal");
      const sprite=document.createElement("img");sprite.className="entity-sprite goal-sprite";sprite.src="assets/goal.png?v=1";sprite.alt="출구";sprite.draggable=false;el.append(sprite);
    }
    if(valid.has(k))el.classList.add("candidate");else if(ring.has(k))el.classList.add("invalid");
    if(state.shadow&&samePosition(state.shadow,{x,y}))el.classList.add("shadow");
    if(state.player&&samePosition(state.player,{x,y}))el.classList.add("player");
    if(state.cursor&&samePosition(state.cursor,{x,y}))el.classList.add("target-cursor");
    el.disabled=!valid.has(k)||state.animating;
    if(valid.has(k))el.addEventListener("click",()=>void createShadow(x,y));
    board.append(el);
  }));
  const entityLayer=document.createElement("div");entityLayer.className="entity-layer";board.append(entityLayer);
  const effectLayer=document.createElement("div");effectLayer.className="effect-layer";board.append(effectLayer);
  if(state.shadow)entityLayer.append(createActor("shadow",state.shadow,state.shadowFacing));
  if(state.player)entityLayer.append(createActor("player",state.player,state.facing));
  turnCount.textContent=state.turn;
  shadowTurns.textContent=state.shadow?state.shadowLife+"턴 · "+(state.swapUsed?"스왑 사용":"스왑 가능"):"없음";
  shadowButton.disabled=state.animating||state.cleared||state.gameOver;
  shadowButton.classList.toggle("active",state.selecting);
  const shadowLabel=state.shadow?(state.swapUsed?"스왑 완료":"스왑"):state.selecting?"위치 확정":"그림자";
  shadowButton.innerHTML=`<strong>W</strong><span>${shadowLabel}</span>`;
  if(shurikenButton)shurikenButton.disabled=state.animating||state.cleared||state.gameOver;
  cancelShadowButton.hidden=!state.selecting;
  cancelShadowButton.disabled=!state.selecting||state.animating||state.gameOver;
  swapButton.disabled=state.animating||!state.shadow||state.swapUsed||state.cleared||state.gameOver;
  resetButton.disabled=state.animating;
}

function playFrames(element,frameCount,totalDuration,{reverse=false,onPeak=null}={}){
  if(!element)return Promise.resolve();
  return new Promise(resolve=>{
    const started=performance.now();let peakCalled=false;
    function tick(now){
      const progress=Math.min(1,(now-started)/duration(totalDuration));
      const raw=Math.min(frameCount-1,Math.floor(progress*frameCount));
      const frame=reverse?frameCount-1-raw:raw;
      setSheetFrame(element,frame,0,frameCount,1);
      if(!peakCalled&&progress>=.5){peakCalled=true;onPeak?.()}
      if(progress<1)requestAnimationFrame(tick);else{if(!peakCalled)onPeak?.();resolve()}
    }
    requestAnimationFrame(tick);
  });
}
function playActorFrames(actor,sheet,facing,totalDuration,onFrame){
  if(!actor)return Promise.resolve();
  actor.classList.remove("idle-animation");actor.classList.add("manual-animation");
  actor.style.backgroundImage=`url("${sheet}")`;
  return new Promise(resolve=>{
    const started=performance.now();let previous=-1;
    function tick(now){
      const progress=Math.min(1,(now-started)/duration(totalDuration));
      const frame=Math.min(7,Math.floor(progress*8));
      setSheetFrame(actor,frame,DIRECTION_ROWS[facing],8,4);
      if(frame!==previous){previous=frame;onFrame?.(frame)}
      if(progress<1)requestAnimationFrame(tick);else resolve();
    }
    requestAnimationFrame(tick);
  });
}
function playEffect(position,sheet,totalDuration,{reverse=false,onPeak=null}={}){
  const effect=createEffect(position,sheet,6);
  return playFrames(effect,6,totalDuration,{reverse,onPeak}).finally(()=>effect?.remove());
}
function fadeElement(element,from,to,totalDuration){
  if(!element)return Promise.resolve();
  return new Promise(resolve=>{
    const started=performance.now();
    function tick(now){
      const progress=Math.min(1,(now-started)/duration(totalDuration));
      element.style.opacity=String(from+(to-from)*progress);
      if(progress<1)requestAnimationFrame(tick);else resolve();
    }
    requestAnimationFrame(tick);
  });
}
function animatePlayerMove(from,to,facing){
  const actor=board.querySelector(".player-actor");
  if(!actor)return Promise.resolve();
  const cell=board.querySelector(".cell")?.getBoundingClientRect();
  const distanceX=(to.x-from.x)*(cell?.width??48),distanceY=(to.y-from.y)*(cell?.height??48);
  actor.classList.remove("idle-animation");actor.classList.add("manual-animation");
  actor.style.backgroundImage=`url("${SPRITES.playerWalk}")`;
  actor.style.backgroundSize="800% 400%";
  return new Promise(resolve=>{
    const started=performance.now();
    function tick(now){
      const progress=Math.min(1,(now-started)/duration(333));
      const eased=progress;
      setSheetFrame(actor,Math.min(7,Math.floor(progress*8)),DIRECTION_ROWS[facing],8,4);
      actor.style.transform=`translate(${distanceX*eased}px,${distanceY*eased}px)`;
      if(progress<1)requestAnimationFrame(tick);else resolve();
    }
    requestAnimationFrame(tick);
  });
}

function showGameOver(){
  state.gameOver=true;state.selecting=false;state.cursor=null;
  message.textContent="현재 상태에서는 더 이상 출구에 도달할 수 없습니다.";
  gameOverModal.hidden=false;render();
}
function evaluateState(){if(!state.cleared&&!state.gameOver&&!canStillReachGoal())showGameOver()}
async function expireShadow(position){
  render();
  const actor=board.querySelector(".shadow-actor");
  await Promise.all([
    playEffect(position,SPRITES.shadowSpawn,180,{reverse:true}),
    fadeElement(actor,1,0,180)
  ]);
  state.shadow=null;state.shadowLife=0;state.swapUsed=false;
  message.textContent="그림자가 사라졌습니다. 다시 생성할 수 있습니다.";
}
async function spendTurn(skipDecay=false){
  state.turn++;
  if(state.shadow&&!skipDecay){
    state.shadowLife--;
    if(state.shadowLife<=0)await expireShadow({...state.shadow});
  }
  checkGoal();render();evaluateState();
}
function checkGoal(){
  if(!state.player||!samePosition(state.player,goal)||state.transitioning)return;
  state.cleared=true;state.selecting=false;state.cursor=null;
  if(currentStage<STAGES.length-1){
    state.transitioning=true;
    message.textContent="Stage "+(currentStage+1)+" 클리어! 잠시 후 다음 스테이지로 이동합니다.";
    document.body.classList.add("cleared");
    clearTimeout(stageTimer);stageTimer=setTimeout(()=>loadStage(currentStage+1),900);
  }else{
    message.textContent="모든 스테이지 클리어!";
    document.body.classList.add("cleared");
  }
}

async function move(dx,dy){
  if(state.animating||state.cleared||state.gameOver)return;
  state.facing=directionFrom(dx,dy);state.selecting=false;state.cursor=null;
  const from={...state.player},to={x:from.x+dx,y:from.y+dy};
  if(blocked(to.x,to.y)){message.textContent="벽이나 장애물로는 이동할 수 없습니다.";render();return}
  if(state.shadow&&samePosition(to,state.shadow)){message.textContent="그림자가 있는 칸입니다.";render();return}
  state.animating=true;render();
  try{
    await animatePlayerMove(from,to,state.facing);
    state.player=to;message.textContent="한 칸 이동했습니다.";
    await spendTurn();
  }finally{state.animating=false;render()}
}
async function createShadow(x,y){
  if(state.animating||blocked(x,y)||state.shadow||state.gameOver)return;
  if(!candidates().some(p=>p.x===x&&p.y===y))return;
  state.animating=true;state.shadow={x,y};state.shadowLife=6;state.swapUsed=false;state.shadowFacing=state.facing;state.selecting=false;state.cursor=null;render();
  const actor=board.querySelector(".shadow-actor");if(actor)actor.style.opacity="0";
  try{
    await Promise.all([playEffect(state.shadow,SPRITES.shadowSpawn,180),fadeElement(actor,0,1,180)]);
    message.textContent="그림자를 만들었습니다. 이 그림자와 한 번만 스왑할 수 있습니다.";
    await spendTurn(true);
  }finally{state.animating=false;render()}
}
async function swap(){
  if(state.animating||!state.shadow||state.cleared||state.gameOver)return;
  if(state.swapUsed){message.textContent="이 그림자와는 이미 위치를 교환했습니다.";render();return}
  state.animating=true;state.selecting=false;state.cursor=null;render();
  const playerActor=board.querySelector(".player-actor"),shadowActor=board.querySelector(".shadow-actor");
  const oldPlayer={...state.player},oldShadow={...state.shadow};
  let swapped=false;
  const applySwap=()=>{
    if(swapped)return;swapped=true;
    state.player=oldShadow;state.shadow=oldPlayer;
    const oldFacing=state.facing;state.facing=state.shadowFacing;state.shadowFacing=oldFacing;
    positionEntity(playerActor,state.player);positionEntity(shadowActor,state.shadow);
  };
  try{
    playerActor?.classList.add("swap-flicker");shadowActor?.classList.add("swap-flicker");
    const first=createEffect(oldPlayer,SPRITES.swapBurst,6),second=createEffect(oldShadow,SPRITES.swapBurst,6);
    await Promise.all([playFrames(first,6,240,{onPeak:applySwap}),playFrames(second,6,240)]);
    first?.remove();second?.remove();applySwap();state.swapUsed=true;
    message.textContent="위치를 교환했습니다. 이 그림자와는 더 이상 스왑할 수 없습니다.";
    await spendTurn();
  }finally{state.animating=false;render()}
}
function projectileDistance(origin,dx,dy){
  for(let step=1;step<=2;step++)if(blocked(origin.x+dx*step,origin.y+dy*step))return Math.max(.35,step-.55);
  return 2;
}
function launchProjectile(origin,facing){
  const layer=board.querySelector(".effect-layer");if(!layer)return Promise.resolve();
  const projectile=document.createElement("div");projectile.className="projectile manual-animation";
  projectile.style.backgroundImage=`url("${SPRITES.shuriken}")`;projectile.style.backgroundSize="400% 100%";
  positionEntity(projectile,origin);layer.append(projectile);
  const [dx,dy]=DIRECTION_VECTORS[facing],travel=projectileDistance(origin,dx,dy);
  const cell=board.querySelector(".cell")?.getBoundingClientRect();
  const distanceX=dx*travel*(cell?.width??48),distanceY=dy*travel*(cell?.height??48);
  return new Promise(resolve=>{
    const started=performance.now();
    function tick(now){
      const progress=Math.min(1,(now-started)/duration(190));
      setSheetFrame(projectile,Math.min(3,Math.floor(progress*8)%4),0,4,1);
      projectile.style.transform=`translate(${distanceX*progress}px,${distanceY*progress}px) rotate(${progress*45}deg)`;
      if(progress>.78)projectile.style.opacity=String((1-progress)/.22);
      if(progress<1)requestAnimationFrame(tick);else{projectile.remove();resolve()}
    }
    requestAnimationFrame(tick);
  });
}
async function throwShuriken(){
  if(state.animating||state.cleared||state.gameOver)return;
  state.animating=true;state.selecting=false;state.cursor=null;render();
  const actor=board.querySelector(".player-actor"),origin={...state.player};let flight=null;
  try{
    await playActorFrames(actor,SPRITES.playerThrow,state.facing,280,frame=>{if(frame>=4&&!flight)flight=launchProjectile(origin,state.facing)});
    if(flight)await flight;
    message.textContent="표창을 던졌습니다.";
    await spendTurn();
  }finally{state.animating=false;render()}
}

function cancelShadowSelection(reason="그림자 생성을 취소했습니다."){
  if(state.animating)return;
  state.selecting=false;state.cursor=null;message.textContent=reason;render();
}
function toggleShadowSelection(){
  if(state.animating||state.shadow||state.cleared||state.gameOver)return;
  if(state.selecting){cancelShadowSelection();return}
  state.selecting=true;state.cursor={...state.player};
  message.textContent="방향키로 빈 네모를 옮긴 뒤 W를 누르세요. Esc로 취소할 수 있습니다.";render();
}
function moveCursor(dx,dy){
  if(state.animating||!state.cursor)return;
  state.cursor.x=Math.max(0,Math.min(MAP[0].length-1,state.cursor.x+dx));
  state.cursor.y=Math.max(0,Math.min(MAP.length-1,state.cursor.y+dy));
  const valid=candidates().some(p=>samePosition(p,state.cursor))&&!blocked(state.cursor.x,state.cursor.y);
  message.textContent=valid?"이 위치에는 그림자를 생성할 수 있습니다. W로 확정하세요.":"현재 위치에는 그림자를 생성할 수 없습니다.";render();
}
function confirmShadow(){
  if(state.animating||!state.selecting||!state.cursor||state.shadow)return;
  const {x,y}=state.cursor;
  if(!candidates().some(p=>p.x===x&&p.y===y)){cancelShadowSelection("생성 범위를 벗어나 그림자 생성을 취소했습니다.");return}
  if(blocked(x,y)){cancelShadowSelection("벽이나 장애물이 있는 위치라 그림자 생성을 취소했습니다.");return}
  void createShadow(x,y);
}
function loadStage(index){
  clearTimeout(stageTimer);prepareStage(index);
  Object.assign(state,{player:{...start},shadow:null,shadowLife:0,swapUsed:false,turn:0,selecting:false,cursor:null,cleared:false,gameOver:false,transitioning:false,animating:false,facing:"down",shadowFacing:"down"});
  document.body.classList.remove("cleared");gameOverModal.hidden=true;
  const stageNames=BUILT_IN_STAGES.map(()=>"그림자 퍼즐");
  const stageMessages=BUILT_IN_STAGES.map(()=>"그림자를 만들고 위치를 교환해 출구에 도달하세요.");
  stageTitle.textContent="Stage "+(currentStage+1)+" — "+(USING_EDITOR_STAGES?"에디터 스테이지":stageNames[currentStage]??"퍼즐");
  message.textContent=USING_EDITOR_STAGES?"에디터에서 적용한 스테이지입니다.":stageMessages[currentStage]??"출구에 도달하세요.";
  render();
}
function resetCurrentStage(){if(!state.animating)loadStage(currentStage)}
function resetAllStages(){if(!state.animating)loadStage(0)}
function shadowAction(){
  if(state.animating)return;
  if(state.shadow)void swap();
  else if(state.selecting)confirmShadow();
  else toggleShadowSelection();
}

shadowButton.addEventListener("click",shadowAction);
shurikenButton?.addEventListener("click",()=>void throwShuriken());
cancelShadowButton.addEventListener("click",()=>cancelShadowSelection());
swapButton.addEventListener("click",()=>void swap());
document.querySelectorAll("[data-move]").forEach(button=>button.addEventListener("click",()=>{
  const vector=DIRECTION_VECTORS[button.dataset.move];
  if(state.selecting)moveCursor(...vector);else void move(...vector);
}));
document.addEventListener("keydown",event=>{
  if(state.animating)return;
  if(event.key==="Escape"&&state.selecting){event.preventDefault();cancelShadowSelection();return}
  if(event.key==="w"||event.key==="W"){event.preventDefault();shadowAction();return}
  if(event.key==="q"||event.key==="Q"){event.preventDefault();void throwShuriken();return}
  const direction={ArrowUp:"up",ArrowDown:"down",ArrowLeft:"left",ArrowRight:"right"}[event.key];
  if(direction){event.preventDefault();const vector=DIRECTION_VECTORS[direction];if(state.selecting)moveCursor(...vector);else void move(...vector)}
});
resetButton.addEventListener("click",resetAllStages);
document.querySelector("#restartGameButton").addEventListener("click",resetCurrentStage);
document.querySelector("#endGameButton").addEventListener("click",()=>{if(state.animating)return;gameOverModal.hidden=true;message.textContent="게임을 종료했습니다. ‘처음부터’를 누르면 다시 시작할 수 있습니다.";render()});
restoreStagesButton.addEventListener("click",()=>{if(state.animating)return;localStorage.removeItem(APPLIED_STAGES_KEY);location.href="index.html"});

loadStage(0);
