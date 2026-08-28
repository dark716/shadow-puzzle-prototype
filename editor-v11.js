const DEFAULT_MAP=[
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
const STAGES_KEY="shadowPuzzleStages";
const LEGACY_MAP_KEY="shadowPuzzleMap";
const CURRENT_STAGE_KEY="shadowPuzzleCurrentStage";
const ALLOWED_TILES=new Set([".","#","O","P","G"]);

const gridEl=document.querySelector("#mapGrid");
const output=document.querySelector("#mapOutput");
const validation=document.querySelector("#validation");
const widthInput=document.querySelector("#widthInput");
const heightInput=document.querySelector("#heightInput");
const stagePosition=document.querySelector("#stagePosition");
const saveState=document.querySelector("#saveState");
const stageJumpInput=document.querySelector("#stageJumpInput");
const copyStatus=document.querySelector("#copyStatus");
const noticeModal=document.querySelector("#noticeModal");
const noticeMessage=document.querySelector("#noticeMessage");
const exportAllModal=document.querySelector("#exportAllModal");
const allStagesOutput=document.querySelector("#allStagesOutput");

let stages=[];
let currentStageIndex=-1;
let map=cloneMap(DEFAULT_MAP);
let dirty=false;
let currentTileType=".";
let activePlacementType=".";
let canPlaceTile=false;

function cloneMap(source){return source.map(row=>[...(Array.isArray(row)?row.join(""):row)])}
function rowsFromMap(source=map){return source.map(row=>row.join(""))}
function normalize(rows){
  if(!Array.isArray(rows)||!rows.length)return null;
  const clean=rows.map(row=>(Array.isArray(row)?row.join(""):String(row)).split("").filter(tile=>ALLOWED_TILES.has(tile)).join(""));
  const width=Math.max(0,...clean.map(row=>row.length));
  if(!width)return null;
  return clean.map(row=>[...row.padEnd(width,".")]);
}
function readSavedStages(){
  const savedText=localStorage.getItem(STAGES_KEY);
  if(savedText!==null){
    try{
      const saved=JSON.parse(savedText);
      if(Array.isArray(saved))return saved.map(normalize).filter(Boolean).map(rowsFromMap);
    }catch{}
    return [];
  }
  try{
    const legacy=normalize(JSON.parse(localStorage.getItem(LEGACY_MAP_KEY)));
    if(legacy){
      const migrated=[rowsFromMap(legacy)];
      localStorage.setItem(STAGES_KEY,JSON.stringify(migrated));
      return migrated;
    }
  }catch{}
  return [];
}
function persistStages(){
  localStorage.setItem(STAGES_KEY,JSON.stringify(stages));
  if(currentStageIndex>=0)localStorage.setItem(CURRENT_STAGE_KEY,String(currentStageIndex+1));
  else localStorage.removeItem(CURRENT_STAGE_KEY);
}
function setDirty(value=true){dirty=value;renderStageControls()}
function setStatus(text){copyStatus.textContent=text}
function showNotice(text){
  noticeMessage.textContent=text;
  noticeModal.hidden=false;
  document.querySelector("#closeNoticeButton").focus();
}
function closeNotice(){noticeModal.hidden=true}
function stagesAsGameCode(){
  const blocks=stages.map(stage=>"  [\n"+stage.map(row=>"    "+JSON.stringify(row)).join(",\n")+"\n  ]");
  return "const STAGES=[\n"+blocks.join(",\n")+"\n];";
}

function render(){
  gridEl.innerHTML="";
  gridEl.style.gridTemplateColumns="repeat("+map[0].length+", var(--cell))";
  map.forEach((row,y)=>row.forEach((value,x)=>{
    const cell=document.createElement("div");
    cell.className="cell";
    cell.dataset.value=value;
    cell.dataset.x=x;
    cell.dataset.y=y;
    cell.title=x+", "+y;
    cell.setAttribute("role","gridcell");
    gridEl.append(cell);
  }));
  widthInput.value=map[0].length;
  heightInput.value=map.length;
  output.value=rowsFromMap().join("\n");
  validate();
  renderStageControls();
}
function renderStageControls(){
  const hasStages=stages.length>0;
  stagePosition.textContent=hasStages?"Stage "+(currentStageIndex+1)+" / "+stages.length:"저장된 스테이지 없음";
  saveState.textContent=dirty?(hasStages?"저장하지 않은 변경사항이 있습니다.":"기본 맵을 편집 중입니다. 저장하면 Stage 1이 됩니다."):(hasStages?"저장됨":"기본 맵을 표시하고 있습니다.");
  saveState.classList.toggle("dirty",dirty);
  stageJumpInput.max=Math.max(1,stages.length);
  stageJumpInput.value=hasStages?currentStageIndex+1:1;
  document.querySelector("#previousStageButton").disabled=!hasStages||currentStageIndex<=0;
  document.querySelector("#nextStageButton").disabled=!hasStages||currentStageIndex>=stages.length-1;
  document.querySelector("#goToStageButton").disabled=!hasStages;
  document.querySelector("#deleteStageButton").disabled=!hasStages;
  document.querySelector("#moveStageEarlierButton").disabled=!hasStages||currentStageIndex<=0;
  document.querySelector("#moveStageLaterButton").disabled=!hasStages||currentStageIndex>=stages.length-1;
}
function validate(){
  const flat=map.flat(),players=flat.filter(v=>v==="P").length,goals=flat.filter(v=>v==="G").length;
  const notes=[];
  if(players!==1)notes.push("시작점 P를 정확히 1개 배치하세요.");
  if(goals!==1)notes.push("출구 G를 정확히 1개 배치하세요.");
  if(players===1&&goals===1){
    const py=map.findIndex(row=>row.includes("P")),px=map[py].indexOf("P"),valid=[];
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(Math.max(Math.abs(dx),Math.abs(dy))===2){
      const value=map[py+dy]?.[px+dx];
      if(value==="."||value==="G")valid.push(1);
    }
    if(!valid.length)notes.push("시작점에서 만들 수 있는 그림자 위치가 없습니다.");
  }
  validation.className="validation "+(notes.length?"warn":"ok");
  validation.textContent=notes.length?notes.join(" "):"기본 검사를 통과했습니다. 현재 스테이지를 저장할 수 있습니다.";
}
function selectTile(value){
  currentTileType=value;
  document.querySelectorAll(".tile").forEach(button=>button.classList.toggle("active",button.dataset.tile===value));
}
function cellFromEvent(event){
  const cell=event.target.closest(".cell");
  return cell&&gridEl.contains(cell)?cell:null;
}
function paint(x,y,value){
  if(value==="P"||value==="G")map.forEach(row=>row.forEach((tile,index)=>{if(tile===value)row[index]="."}));
  if(map[y][x]===value)return;
  map[y][x]=value;
  setDirty();
  render();
}
function saveCurrentStage({silent=false}={}){
  const rows=rowsFromMap();
  if(!stages.length){stages.push(rows);currentStageIndex=0}
  else stages[currentStageIndex]=rows;
  dirty=false;
  persistStages();
  render();
  if(!silent)setStatus("Stage "+(currentStageIndex+1)+"을 저장했습니다.");
}
function loadStageAt(index,{silent=false}={}){
  if(!stages.length){
    currentStageIndex=-1;
    map=cloneMap(DEFAULT_MAP);
    dirty=false;
    render();
    if(!silent)setStatus("저장된 스테이지가 없어 기본 맵을 표시합니다.");
    return;
  }
  const requested=Number(index);
  const valid=Number.isInteger(requested)&&requested>=0&&requested<stages.length;
  currentStageIndex=valid?requested:stages.length-1;
  map=cloneMap(stages[currentStageIndex]);
  dirty=false;
  persistStages();
  render();
  if(!silent){
    if(valid)setStatus("Stage "+(currentStageIndex+1)+"을 불러왔습니다.");
    else{
      const text="요청한 스테이지가 없습니다. 마지막 Stage "+stages.length+"을 표시합니다.";
      setStatus(text);
      showNotice(text);
    }
  }
}
function navigateTo(index){
  if(dirty)saveCurrentStage({silent:true});
  loadStageAt(index);
}
function addStage(){
  if(!stages.length){
    stages.push(rowsFromMap());
    currentStageIndex=0;
  }else{
    if(dirty)saveCurrentStage({silent:true});
    stages.push([...DEFAULT_MAP]);
    currentStageIndex=stages.length-1;
    map=cloneMap(DEFAULT_MAP);
  }
  dirty=false;
  persistStages();
  render();
  setStatus("Stage "+(currentStageIndex+1)+"을 추가했습니다.");
}
function deleteCurrentStage(){
  if(!stages.length)return;
  if(!window.confirm("Stage "+(currentStageIndex+1)+"을 삭제할까요?"))return;
  const deleted=currentStageIndex+1;
  stages.splice(currentStageIndex,1);
  persistStages();
  if(!stages.length){
    currentStageIndex=-1;
    map=cloneMap(DEFAULT_MAP);
    dirty=false;
    persistStages();
    render();
    setStatus("마지막 스테이지를 삭제해 기본 맵을 표시합니다.");
    return;
  }
  loadStageAt(Math.min(currentStageIndex,stages.length-1),{silent:true});
  setStatus("Stage "+deleted+"을 삭제했습니다.");
}
function moveCurrentStage(direction){
  if(!stages.length)return;
  if(dirty)saveCurrentStage({silent:true});
  const target=currentStageIndex+direction;
  if(target<0||target>=stages.length)return;
  [stages[currentStageIndex],stages[target]]=[stages[target],stages[currentStageIndex]];
  currentStageIndex=target;
  persistStages();
  render();
  setStatus("현재 스테이지를 "+(direction<0?"앞":"뒤")+"으로 이동했습니다.");
}
function openAllStagesExport(){
  if(dirty)saveCurrentStage({silent:true});
  if(!stages.length){showNotice("내보낼 스테이지가 없습니다. 먼저 스테이지를 저장해 주세요.");return}
  allStagesOutput.value=stagesAsGameCode();
  exportAllModal.hidden=false;
  document.querySelector("#copyAllStagesButton").focus();
}

gridEl.addEventListener("pointerdown",event=>{
  if(event.button!==0&&event.button!==2)return;
  const cell=cellFromEvent(event);
  if(!cell)return;
  event.preventDefault();
  canPlaceTile=true;
  activePlacementType=event.button===0?currentTileType:".";
  paint(Number(cell.dataset.x),Number(cell.dataset.y),activePlacementType);
});
gridEl.addEventListener("pointerover",event=>{
  if(!canPlaceTile||(event.buttons!==1&&event.buttons!==2))return;
  const cell=cellFromEvent(event);
  if(cell)paint(Number(cell.dataset.x),Number(cell.dataset.y),activePlacementType);
});
gridEl.addEventListener("contextmenu",event=>event.preventDefault());
document.addEventListener("pointerup",()=>{canPlaceTile=false});
document.addEventListener("pointercancel",()=>{canPlaceTile=false});
document.querySelectorAll(".tile").forEach(button=>button.addEventListener("click",()=>selectTile(button.dataset.tile)));

document.querySelector("#resizeButton").addEventListener("click",()=>{
  const width=Math.max(5,Math.min(30,+widthInput.value||13));
  const height=Math.max(5,Math.min(30,+heightInput.value||10));
  map=Array.from({length:height},(_,y)=>Array.from({length:width},(_,x)=>map[y]?.[x]??"."));
  setDirty();render();
});
document.querySelector("#clearButton").addEventListener("click",()=>{map=map.map(row=>row.map(()=>"."));setDirty();render()});
document.querySelector("#borderButton").addEventListener("click",()=>{map=map.map((row,y)=>row.map((value,x)=>y===0||x===0||y===map.length-1||x===row.length-1?"#":value));setDirty();render()});
document.querySelector("#sampleButton").addEventListener("click",()=>{map=cloneMap(DEFAULT_MAP);setDirty();render();setStatus("기본 맵을 불러왔습니다.")});

document.querySelector("#saveStageButton").addEventListener("click",()=>saveCurrentStage());
document.querySelector("#addStageButton").addEventListener("click",addStage);
document.querySelector("#deleteStageButton").addEventListener("click",deleteCurrentStage);
document.querySelector("#moveStageEarlierButton").addEventListener("click",()=>moveCurrentStage(-1));
document.querySelector("#moveStageLaterButton").addEventListener("click",()=>moveCurrentStage(1));
document.querySelector("#exportAllStagesButton").addEventListener("click",openAllStagesExport);
document.querySelector("#previousStageButton").addEventListener("click",()=>navigateTo(currentStageIndex-1));
document.querySelector("#nextStageButton").addEventListener("click",()=>navigateTo(currentStageIndex+1));
document.querySelector("#goToStageButton").addEventListener("click",()=>navigateTo(Number(stageJumpInput.value)-1));
stageJumpInput.addEventListener("keydown",event=>{if(event.key==="Enter")navigateTo(Number(stageJumpInput.value)-1)});
document.querySelector("#closeNoticeButton").addEventListener("click",closeNotice);
noticeModal.addEventListener("click",event=>{if(event.target===noticeModal)closeNotice()});
document.querySelector("#closeExportAllButton").addEventListener("click",()=>{exportAllModal.hidden=true});
exportAllModal.addEventListener("click",event=>{if(event.target===exportAllModal)exportAllModal.hidden=true});
document.querySelector("#copyAllStagesButton").addEventListener("click",async()=>{
  try{await navigator.clipboard.writeText(allStagesOutput.value);setStatus("전체 스테이지 코드를 복사했습니다.")}
  catch{allStagesOutput.select();document.execCommand("copy");setStatus("전체 스테이지 코드를 복사했습니다.")}
});
document.addEventListener("keydown",event=>{
  if(event.key!=="Escape")return;
  if(!exportAllModal.hidden)exportAllModal.hidden=true;
  else if(!noticeModal.hidden)closeNotice();
});

document.querySelector("#copyButton").addEventListener("click",async()=>{
  const text="맵 크기: "+map[0].length+"×"+map.length+"\n\n\u0060\u0060\u0060text\n"+output.value+"\n\u0060\u0060\u0060";
  try{await navigator.clipboard.writeText(text);setStatus("현재 스테이지의 맵 코드를 복사했습니다.")}
  catch{output.select();document.execCommand("copy");setStatus("현재 스테이지의 맵 배열을 복사했습니다.")}
});
document.querySelector("#importButton").addEventListener("click",()=>{
  const rows=output.value.trim().split(/\r?\n/).filter(row=>/^[.#OPG]+$/.test(row));
  const imported=normalize(rows);
  if(!imported){setStatus("읽을 수 있는 맵 코드가 없습니다.");return}
  map=imported;setDirty();render();setStatus("맵 코드를 불러왔습니다. 저장 버튼을 눌러 반영하세요.");
});

stages=readSavedStages();
if(stages.length){
  const requestedFromUrl=new URLSearchParams(location.search).get("stage");
  const requested=requestedFromUrl===null?Number(localStorage.getItem(CURRENT_STAGE_KEY)||1):Number(requestedFromUrl);
  const requestedIndex=requested-1;
  const exists=Number.isInteger(requestedIndex)&&requestedIndex>=0&&requestedIndex<stages.length;
  loadStageAt(requestedIndex,{silent:exists});
}else loadStageAt(-1,{silent:true});
