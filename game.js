const MAP=[
"#############",
"#..........G#",
"#..##..##...#",
"#..##..##...#",
"#....###....#",
"#....#P#....#",
"#....###....#",
"#..O.....O..#",
"#...........#",
"#############"
];
const state={player:null,shadow:null,shadowLife:0,turn:0,selecting:false,cleared:false};
const board=document.querySelector("#board");
const message=document.querySelector("#message");
const turnCount=document.querySelector("#turnCount");
const shadowTurns=document.querySelector("#shadowTurns");
const shadowButton=document.querySelector("#shadowButton");
const swapButton=document.querySelector("#swapButton");
const key=(x,y)=>x+","+y;
const walls=new Set(),obstacles=new Set();let goal;
MAP.forEach((row,y)=>[...row].forEach((v,x)=>{if(v==="#")walls.add(key(x,y));if(v==="O")obstacles.add(key(x,y));if(v==="P")state.player={x,y};if(v==="G")goal={x,y}}));
const start={...state.player};
function blocked(x,y){return x<0||y<0||y>=MAP.length||x>=MAP[0].length||walls.has(key(x,y))||obstacles.has(key(x,y))}
function candidates(){const out=[];for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(Math.max(Math.abs(dx),Math.abs(dy))===2)out.push({x:state.player.x+dx,y:state.player.y+dy});return out}
function spendTurn(skipDecay=false){state.turn++;if(state.shadow&&!skipDecay){state.shadowLife--;if(state.shadowLife<=0){state.shadow=null;state.shadowLife=0;message.textContent="그림자가 사라졌습니다. 다시 생성할 수 있습니다."}}checkGoal();render()}
function checkGoal(){if(state.player.x===goal.x&&state.player.y===goal.y){state.cleared=true;state.selecting=false;message.textContent="Stage 1 클리어! 벽은 생성 경로가 아니라 목적지만 막습니다.";document.body.classList.add("cleared")}}
function move(dx,dy){if(state.cleared)return;state.selecting=false;const x=state.player.x+dx,y=state.player.y+dy;if(blocked(x,y)){message.textContent="벽이나 장애물로는 이동할 수 없습니다.";render();return}if(state.shadow&&x===state.shadow.x&&y===state.shadow.y){message.textContent="그림자가 있는 칸입니다. 스왑 버튼을 사용하세요.";render();return}state.player={x,y};message.textContent="한 칸 이동했습니다.";spendTurn()}
function createShadow(x,y){if(blocked(x,y)||state.shadow)return;if(!candidates().some(p=>p.x===x&&p.y===y))return;state.shadow={x,y};state.shadowLife=6;state.selecting=false;message.textContent="그림자를 만들었습니다. 생성 직후 남은 지속시간은 6턴입니다.";spendTurn(true)}
function swap(){if(!state.shadow||state.cleared)return;state.selecting=false;const p=state.player;state.player=state.shadow;state.shadow=p;message.textContent="본체와 그림자의 위치를 바꿨습니다.";spendTurn()}
function render(){board.innerHTML="";const valid=new Set(state.selecting&&!state.shadow?candidates().filter(p=>!blocked(p.x,p.y)).map(p=>key(p.x,p.y)):[]);const ring=new Set(state.selecting&&!state.shadow?candidates().map(p=>key(p.x,p.y)):[]);MAP.forEach((row,y)=>[...row].forEach((_,x)=>{const el=document.createElement("button");el.className="cell";el.setAttribute("role","gridcell");el.setAttribute("aria-label",x+", "+y);const k=key(x,y);if(walls.has(k))el.classList.add("wall");else if(obstacles.has(k))el.classList.add("obstacle");if(goal.x===x&&goal.y===y)el.classList.add("goal");if(valid.has(k))el.classList.add("candidate");else if(ring.has(k))el.classList.add("invalid");if(state.shadow&&state.shadow.x===x&&state.shadow.y===y)el.classList.add("shadow");if(state.player.x===x&&state.player.y===y)el.classList.add("player");el.disabled=!valid.has(k);if(valid.has(k))el.addEventListener("click",()=>createShadow(x,y));board.append(el)}));turnCount.textContent=state.turn;shadowTurns.textContent=state.shadow?state.shadowLife+"턴":"없음";shadowButton.disabled=!!state.shadow||state.cleared;shadowButton.classList.toggle("active",state.selecting);shadowButton.textContent=state.selecting?"보라색 칸을 선택하세요":"그림자 생성 위치 선택";swapButton.disabled=!state.shadow||state.cleared}
shadowButton.addEventListener("click",()=>{if(state.shadow)return;state.selecting=!state.selecting;message.textContent=state.selecting?"보라색 칸은 정확히 2칸 떨어진 빈 목적지입니다.":"그림자 선택을 취소했습니다.";render()});
swapButton.addEventListener("click",swap);
document.querySelectorAll("[data-move]").forEach(b=>b.addEventListener("click",()=>{const d={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[b.dataset.move];move(...d)}));
document.addEventListener("keydown",e=>{const d={ArrowUp:[0,-1],w:[0,-1],W:[0,-1],ArrowDown:[0,1],s:[0,1],S:[0,1],ArrowLeft:[-1,0],a:[-1,0],A:[-1,0],ArrowRight:[1,0],d:[1,0],D:[1,0]}[e.key];if(d){e.preventDefault();move(...d)}});
document.querySelector("#resetButton").addEventListener("click",()=>{Object.assign(state,{player:{...start},shadow:null,shadowLife:0,turn:0,selecting:false,cleared:false});document.body.classList.remove("cleared");message.textContent="걸어서는 나갈 수 없습니다. 그림자를 만들어 보세요.";render()});
render();