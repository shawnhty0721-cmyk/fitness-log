const STORAGE="fitness-data";
let workouts=JSON.parse(localStorage.getItem(STORAGE))||[];

let pie7Chart,pie30Chart,trendChart;

function save(){localStorage.setItem(STORAGE,JSON.stringify(workouts));}
function today(){return new Date().toISOString().slice(0,10);}
function calc1RM(w,r){return +(w*(1+r/30)).toFixed(1);}

/* 添加记录 */
function addWorkout(){
const muscle=document.getElementById("muscle").value;
const exercise=document.getElementById("exercise").value.trim();
const weight=+document.getElementById("weight").value;
const reps=+document.getElementById("reps").value;
const sets=+document.getElementById("sets").value;

if(!exercise||!weight||!reps||!sets){alert("请填写完整");return;}

const prevMax=Math.max(...workouts.filter(w=>w.exercise===exercise).map(w=>w.weight),0);

workouts.push({id:Date.now(),date:today(),muscle,exercise,weight,reps,sets});
save();

if(weight>prevMax && prevMax>0) alert("🎉 新PR！");

document.getElementById("exercise").value="";
document.getElementById("weight").value="";
document.getElementById("reps").value="";
document.getElementById("sets").value="";

renderAll();
}

/* 动作沉淀 */
function renderExerciseList(){
const list=document.getElementById("exerciseList");
const unique=[...new Set(workouts.map(w=>w.exercise))];
list.innerHTML="";
unique.sort().forEach(e=>{
const option=document.createElement("option");
option.value=e;
list.appendChild(option);
});
}

/* 今日 */
function renderToday(){
const div=document.getElementById("todayPreview");
div.innerHTML="";
workouts.filter(w=>w.date===today())
.forEach(w=>{
div.innerHTML+=`
<div class="record">
${w.muscle} · ${w.exercise} ${w.weight}kg × ${w.reps} × ${w.sets}
</div>`;
});
renderExerciseList();
}

/* 分析 */
function renderAnalysis(){
const now=new Date();
const last7=new Date();last7.setDate(now.getDate()-6);
const last30=new Date();last30.setDate(now.getDate()-29);

let m7={},m30={};
let days7=new Set();

workouts.forEach(w=>{
const d=new Date(w.date);
if(d>=last7){
m7[w.muscle]=(m7[w.muscle]||0)+1;
days7.add(w.date);
}
if(d>=last30){
m30[w.muscle]=(m30[w.muscle]||0)+1;
}
});

document.getElementById("days7").innerText=days7.size;

renderPie("pie7",m7,"最近7天部位分布");
renderPie("pie30",m30,"最近30天部位分布");

renderTrendSelect();
}

function renderPie(canvasId,data,title){
const ctx=document.getElementById(canvasId);

if(canvasId==="pie7" && pie7Chart)pie7Chart.destroy();
if(canvasId==="pie30" && pie30Chart)pie30Chart.destroy();

pie7Chart=new Chart(ctx,{
type:"pie",
data:{
labels:Object.keys(data),
datasets:[{
data:Object.values(data),
backgroundColor:["#60a5fa","#34d399","#f87171","#fbbf24","#a78bfa","#f472b6"]
}]
},
options:{
plugins:{title:{display:true,text:title}}
}
});
}

function renderTrendSelect(){
const sel=document.getElementById("trendSelect");
const set=[...new Set(workouts.map(w=>w.exercise))];
sel.innerHTML="";
set.forEach(e=>sel.innerHTML+=`<option>${e}</option>`);
renderTrend();
}

function renderTrend(){
const ex=document.getElementById("trendSelect").value;
const data=workouts.filter(w=>w.exercise===ex)
.sort((a,b)=>a.date.localeCompare(b.date))
.slice(-5);

const ctx=document.getElementById("trendChart");

if(trendChart)trendChart.destroy();

trendChart=new Chart(ctx,{
type:"line",
data:{
labels:data.map(d=>d.date),
datasets:[{
label:ex+" 重量趋势",
data:data.map(d=>d.weight),
borderColor:"#2563eb",
backgroundColor:"rgba(37,99,235,0.1)",
fill:true,
tension:0.3
}]
},
options:{
scales:{y:{beginAtZero:false}}
}
});
}

/* 极限 */
function renderMax(){
const div=document.getElementById("maxList");
div.innerHTML="";
const group={};

workouts.forEach(w=>{
if(!group[w.muscle])group[w.muscle]={};
if(!group[w.muscle][w.exercise])
group[w.muscle][w.exercise]={maxW:0,max1RM:0};
group[w.muscle][w.exercise].maxW=
Math.max(group[w.muscle][w.exercise].maxW,w.weight);
group[w.muscle][w.exercise].max1RM=
Math.max(group[w.muscle][w.exercise].max1RM,calc1RM(w.weight,w.reps));
});

Object.keys(group).forEach(m=>{
div.innerHTML+=`<h3>${m}</h3>`;
Object.entries(group[m])
.sort((a,b)=>b[1].max1RM-a[1].max1RM)
.forEach(([ex,val])=>{
div.innerHTML+=`
<div class="record">
${ex} · 最大 ${val.maxW}kg · 最高1RM ${val.max1RM}kg
</div>`;
});
});
}

function switchPage(id,btn){
document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));
document.getElementById(id).classList.remove("hidden");
document.querySelectorAll(".bottom-nav button").forEach(b=>b.classList.remove("active"));
btn.classList.add("active");
renderAll();
}

function renderAll(){
renderToday();
renderAnalysis();
renderMax();
}

renderAll();