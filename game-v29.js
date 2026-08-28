const STAGES=[
  [
    "#############",
    "#....OO.....#",
    "#....OO.....#",
    "#....OO.....#",
    "#.P...O...G.#",
    "#....OO.....#",
    "#....OO.....#",
    "#....OO.....#",
    "#....OO.....#",
    "#############"
  ],
  [
    "#############",
    "#...#.......#",
    "#.P.###.....#",
    "#...#.#.....#",
    "#####O#..####",
    "#####.####O.#",
    "#........####",
    "#........#O.#",
    "#........#.G#",
    "#############"
  ],
  [
    "#############",
    "#############",
    "#############",
    "#############",
    "P...#.O...OO.",
    "....######.OG",
    "#############",
    "#############",
    "#############",
    "#############"
  ]
];
let MAP=[],currentStage=0,start=null,goal=null;
let walls=new Set(),obstacles=new Set();
const state={player:null,shadow:null,shadowLife:0,swapUsed:false,turn:0,selecting:false,cursor:null,cleared:false,gameOver:false,transitioning:false};
const board=document.querySelector("#board"),message=document.querySelector("#message");
const turnCount=document.querySelector("#turnCount"),shadowTurns=document.querySelector("#shadowTurns");
const shadowButton=document.querySelector("#shadowButton"),cancelShadowButton=document.querySelector("#cancelShadowButton"),swapButton=document.querySelector("#swapButton");
const gameOverModal=document.querySelector("#gameOverModal"),stageTitle=document.querySelector("#stageTitle");
document.querySelector(".board-panel").append(gameOverModal);
const key=(x,y)=>x+","+y;
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
      if(!blocked(p.x,p.y)&&!(s.shadow&&p.x===s.shadow.x&&p.y===s.shadow.y))next.push(decaySnapshot({...s,player:p}));
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
function showGameOver(){
  state.gameOver=true;state.selecting=false;state.cursor=null;
  message.textContent="현재 상태에서는 더 이상 출구에 도달할 수 없습니다.";
  gameOverModal.hidden=false;render();
}
function evaluateState(){
  if(!state.cleared&&!state.gameOver&&!canStillReachGoal())showGameOver();
}
function spendTurn(skipDecay=false){
  state.turn++;
  if(state.shadow&&!skipDecay){
    state.shadowLife--;
    if(state.shadowLife<=0){state.shadow=null;state.shadowLife=0;state.swapUsed=false;message.textContent="그림자가 사라졌습니다. 다시 생성할 수 있습니다."}
  }
  checkGoal();render();evaluateState();
}
function checkGoal(){
  if(state.player.x!==goal.x||state.player.y!==goal.y||state.transitioning)return;
  state.cleared=true;state.selecting=false;state.cursor=null;
  if(currentStage<STAGES.length-1){
    state.transitioning=true;
    message.textContent="Stage "+(currentStage+1)+" 클리어! 잠시 후 다음 스테이지로 이동합니다.";
    document.body.classList.add("cleared");
    setTimeout(()=>loadStage(currentStage+1),1000);
  }else{
    message.textContent="모든 스테이지 클리어!";
    document.body.classList.add("cleared");
  }
}
function move(dx,dy){
  if(state.cleared||state.gameOver)return;
  state.selecting=false;state.cursor=null;
  const x=state.player.x+dx,y=state.player.y+dy;
  if(blocked(x,y)){message.textContent="벽이나 장애물로는 이동할 수 없습니다.";render();return}
  if(state.shadow&&x===state.shadow.x&&y===state.shadow.y){message.textContent="그림자가 있는 칸입니다.";render();return}
  state.player={x,y};message.textContent="한 칸 이동했습니다.";spendTurn();
}
function createShadow(x,y){
  if(blocked(x,y)||state.shadow||state.gameOver)return;
  if(!candidates().some(p=>p.x===x&&p.y===y))return;
  state.shadow={x,y};state.shadowLife=6;state.swapUsed=false;state.selecting=false;state.cursor=null;
  message.textContent="그림자를 만들었습니다. 이 그림자와 한 번만 스왑할 수 있습니다.";spendTurn(true);
}
function swap(){
  if(!state.shadow||state.cleared||state.gameOver)return;
  if(state.swapUsed){message.textContent="이 그림자와는 이미 위치를 교환했습니다.";render();return}
  state.selecting=false;state.cursor=null;
  const p=state.player;state.player=state.shadow;state.shadow=p;state.swapUsed=true;
  message.textContent="위치를 교환했습니다. 이 그림자와는 더 이상 스왑할 수 없습니다.";spendTurn();
}
function render(){
  board.innerHTML="";
  const valid=new Set(state.selecting&&!state.shadow?candidates().filter(p=>!blocked(p.x,p.y)).map(p=>key(p.x,p.y)):[]);
  const ring=new Set(state.selecting&&!state.shadow?candidates().map(p=>key(p.x,p.y)):[]);
  MAP.forEach((row,y)=>[...row].forEach((_,x)=>{
    const el=document.createElement("button");el.className="cell";el.setAttribute("role","gridcell");el.setAttribute("aria-label",x+", "+y);
    const k=key(x,y);
    if(walls.has(k))el.classList.add("wall");
    else if(obstacles.has(k)){
      el.classList.add("obstacle");
      const obstacleSprite=document.createElement("img");
      obstacleSprite.className="entity-sprite obstacle-sprite";
      obstacleSprite.src="assets/obstacle.png?v=1";
      obstacleSprite.alt="장애물";
      obstacleSprite.draggable=false;
      el.append(obstacleSprite);
    }
    if(goal.x===x&&goal.y===y){
      el.classList.add("goal");
      const goalSprite=document.createElement("img");
      goalSprite.className="entity-sprite goal-sprite";
      goalSprite.src="assets/goal.png?v=1";
      goalSprite.alt="출구";
      goalSprite.draggable=false;
      el.append(goalSprite);
    }
    if(valid.has(k))el.classList.add("candidate");else if(ring.has(k))el.classList.add("invalid");
    if(state.shadow&&state.shadow.x===x&&state.shadow.y===y){
      el.classList.add("shadow");
      const sprite=document.createElement("img");
      sprite.className="entity-sprite shadow-sprite";
      sprite.src="assets/shadow.png?v=2";
      sprite.alt="그림자";
      sprite.draggable=false;
      el.append(sprite);
    }
    if(state.cursor&&state.cursor.x===x&&state.cursor.y===y)el.classList.add("target-cursor");
    if(state.player.x===x&&state.player.y===y)el.classList.add("player");
    el.disabled=!valid.has(k);if(valid.has(k))el.addEventListener("click",()=>createShadow(x,y));board.append(el);
  }));
  turnCount.textContent=state.turn;
  shadowTurns.textContent=state.shadow?state.shadowLife+"턴 · "+(state.swapUsed?"스왑 사용":"스왑 가능"):"없음";
  shadowButton.disabled=state.cleared||state.gameOver;
  shadowButton.classList.toggle("active",state.selecting);
  shadowButton.textContent=state.shadow?(state.swapUsed?"W · 스왑 완료":"W · 스왑"):state.selecting?"W · 위치 확정":"W · 그림자";
  cancelShadowButton.hidden=!state.selecting;
  cancelShadowButton.disabled=!state.selecting||state.gameOver;
  swapButton.disabled=!state.shadow||state.swapUsed||state.cleared||state.gameOver;
  swapButton.textContent=state.swapUsed?"스왑 사용 완료":"그림자와 스왑";
}
function cancelShadowSelection(reason="그림자 생성을 취소했습니다."){
  state.selecting=false;state.cursor=null;message.textContent=reason;render();
}
function toggleShadowSelection(){
  if(state.shadow||state.cleared||state.gameOver)return;
  if(state.selecting){cancelShadowSelection();return}
  state.selecting=true;state.cursor={...state.player};
  message.textContent="방향키로 빈 네모를 옮긴 뒤 W를 누르세요. Esc로 취소할 수 있습니다.";render();
}
function moveCursor(dx,dy){
  if(!state.cursor)return;
  state.cursor.x=Math.max(0,Math.min(MAP[0].length-1,state.cursor.x+dx));
  state.cursor.y=Math.max(0,Math.min(MAP.length-1,state.cursor.y+dy));
  const valid=candidates().some(p=>p.x===state.cursor.x&&p.y===state.cursor.y)&&!blocked(state.cursor.x,state.cursor.y);
  message.textContent=valid?"이 위치에는 그림자를 생성할 수 있습니다. W로 확정하세요.":"현재 위치에는 그림자를 생성할 수 없습니다.";render();
}
function confirmShadow(){
  if(!state.selecting||!state.cursor||state.shadow)return;
  const {x,y}=state.cursor;
  if(!candidates().some(p=>p.x===x&&p.y===y)){cancelShadowSelection("생성 범위를 벗어나 그림자 생성을 취소했습니다.");return}
  if(blocked(x,y)){cancelShadowSelection("벽이나 장애물이 있는 위치라 그림자 생성을 취소했습니다.");return}
  createShadow(x,y);
}
function loadStage(index){
  prepareStage(index);
  Object.assign(state,{player:{...start},shadow:null,shadowLife:0,swapUsed:false,turn:0,selecting:false,cursor:null,cleared:false,gameOver:false,transitioning:false});
  document.body.classList.remove("cleared");gameOverModal.hidden=true;
  const stageNames=["장애물 장벽","벽 너머의 그림자","좁은 통로"];
  const stageMessages=["그림자를 이용해 장애물 장벽을 건너세요.","복합 지형을 통과해 출구에 도달하세요.","막힌 통로에서 그림자 이동 경로를 찾으세요."];
  stageTitle.textContent="Stage "+(currentStage+1)+" — "+stageNames[currentStage];
  message.textContent=stageMessages[currentStage];
  render();
}
function resetCurrentStage(){loadStage(currentStage)}
function resetAllStages(){loadStage(0)}
function shadowAction(){
  if(state.shadow)swap();
  else if(state.selecting)confirmShadow();
  else toggleShadowSelection();
}
shadowButton.addEventListener("click",shadowAction);
cancelShadowButton.addEventListener("click",()=>cancelShadowSelection());
swapButton.addEventListener("click",swap);
document.querySelectorAll("[data-move]").forEach(b=>b.addEventListener("click",()=>{const d={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[b.dataset.move];if(state.selecting)moveCursor(...d);else move(...d)}));
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&state.selecting){e.preventDefault();cancelShadowSelection();return}
  if(e.key==="w"||e.key==="W"){e.preventDefault();shadowAction();return}
  const d={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]}[e.key];
  if(d){e.preventDefault();if(state.selecting)moveCursor(...d);else move(...d)}
});
document.querySelector("#resetButton").addEventListener("click",resetAllStages);
document.querySelector("#restartGameButton").addEventListener("click",resetCurrentStage);
document.querySelector("#endGameButton").addEventListener("click",()=>{gameOverModal.hidden=true;message.textContent="게임을 종료했습니다. ‘처음부터’를 누르면 다시 시작할 수 있습니다.";render()});
loadStage(0);