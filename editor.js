const SAMPLE=[
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
const gridEl=document.querySelector("#mapGrid");
const output=document.querySelector("#mapOutput");
const validation=document.querySelector("#validation");
const widthInput=document.querySelector("#widthInput");
const heightInput=document.querySelector("#heightInput");
let map=SAMPLE.map(row=>[...row]),selected=".";

function normalize(rows){
  const width=Math.max(...rows.map(r=>r.length));
  return rows.map(r=>[...r.padEnd(width,".")]);
}
function save(){localStorage.setItem("shadowPuzzleMap",JSON.stringify(map))}
function render(){
  gridEl.innerHTML="";
  gridEl.style.gridTemplateColumns="repeat("+map[0].length+", var(--cell))";
  map.forEach((row,y)=>row.forEach((value,x)=>{
    const cell=document.createElement("button");
    cell.className="cell";cell.dataset.value=value;cell.title=x+", "+y;
    cell.addEventListener("click",()=>paint(x,y,selected));
    cell.addEventListener("contextmenu",e=>{e.preventDefault();paint(x,y,".")});
    gridEl.append(cell);
  }));
  widthInput.value=map[0].length;heightInput.value=map.length;
  output.value=map.map(row=>row.join("")).join("\n");
  validate();save();
}
function selectTile(value){
  selected=value;
  document.querySelectorAll(".tile").forEach(button=>button.classList.toggle("active",button.dataset.tile===value));
}
function paint(x,y,value){
  if(value==="P"||value==="G")map.forEach(row=>row.forEach((v,i)=>{if(v===value)row[i]="."}));
  map[y][x]=value;
  selectTile(".");
  render();
}
function validate(){
  const flat=map.flat(),players=flat.filter(v=>v==="P").length,goals=flat.filter(v=>v==="G").length;
  const notes=[];
  if(players!==1)notes.push("시작점 P를 정확히 1개 배치하세요.");
  if(goals!==1)notes.push("출구 G를 정확히 1개 배치하세요.");
  if(players===1&&goals===1){
    const py=map.findIndex(r=>r.includes("P")),px=map[py].indexOf("P");
    const valid=[];for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(Math.max(Math.abs(dx),Math.abs(dy))===2){const v=map[py+dy]?.[px+dx];if(v==="."||v==="G")valid.push(1)}
    if(!valid.length)notes.push("시작점에서 만들 수 있는 그림자 위치가 없습니다.");
  }
  validation.className="validation "+(notes.length?"warn":"ok");
  validation.textContent=notes.length?notes.join(" "):"기본 검사를 통과했습니다. 맵 코드를 복사해도 좋습니다.";
}
document.querySelectorAll(".tile").forEach(btn=>btn.addEventListener("click",()=>selectTile(btn.dataset.tile)));
document.querySelector("#resizeButton").addEventListener("click",()=>{
  const w=Math.max(5,Math.min(30,+widthInput.value||13)),h=Math.max(5,Math.min(30,+heightInput.value||10));
  const next=Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>map[y]?.[x]??"."));
  map=next;render();
});
document.querySelector("#clearButton").addEventListener("click",()=>{map=map.map(row=>row.map(()=>"."));render()});
document.querySelector("#borderButton").addEventListener("click",()=>{map=map.map((row,y)=>row.map((v,x)=>y===0||x===0||y===map.length-1||x===row.length-1?"#":v));render()});
document.querySelector("#sampleButton").addEventListener("click",()=>{map=SAMPLE.map(r=>[...r]);render()});
document.querySelector("#copyButton").addEventListener("click",async()=>{
  const text="맵 크기: "+map[0].length+"×"+map.length+"\n\n\u0060\u0060\u0060text\n"+output.value+"\n\u0060\u0060\u0060";
  try{await navigator.clipboard.writeText(text);document.querySelector("#copyStatus").textContent="복사했습니다. 이 대화에 그대로 붙여 넣으세요."}
  catch{output.select();document.execCommand("copy");document.querySelector("#copyStatus").textContent="맵 배열을 복사했습니다."}
});
document.querySelector("#importButton").addEventListener("click",()=>{
  const rows=output.value.trim().split(/\r?\n/).filter(r=>/^[.#OPG]+$/.test(r));
  if(!rows.length){document.querySelector("#copyStatus").textContent="읽을 수 있는 맵 코드가 없습니다.";return}
  map=normalize(rows);render();document.querySelector("#copyStatus").textContent="맵 코드를 불러왔습니다.";
});
try{const saved=JSON.parse(localStorage.getItem("shadowPuzzleMap"));if(Array.isArray(saved)&&saved.length&&saved[0].length)map=saved}catch{}
render();