const STORAGE = "fitness-data";
let workouts = JSON.parse(localStorage.getItem(STORAGE)) || [];

function save(){localStorage.setItem(STORAGE,JSON.stringify(workouts));}
function today(){return new Date().toISOString().slice(0,10);}
function calc1RM(w,r){return +(w*(1+r/30)).toFixed(1);}
function calcLoad(w){return w.weight*w.reps*w.sets;}

/* ================= 添加记录 ================= */

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

/* ================= 动作沉淀 ================= */

function renderExerciseList(){
const list=document.getElementById("exerciseList");
if(!list)return;
const unique=[...new Set(workouts.map(w=>w.exercise))];
list.innerHTML="";
unique.sort().forEach(e=>{
const option=document.createElement("option");
option.value=e;
list.appendChild(option);
});
}

/* ================= 今日 ================= */

function renderToday(){
const div=document.getElementById("todayPreview");
div.innerHTML="";
workouts.filter(w=>w.date===today())
.forEach(w=>{
div.innerHTML+=`
<div class="record">
${w.muscle} · ${w.exercise} ${w.weight}kg × ${w.reps} × ${w.sets}
<button onclick="deleteItem(${w.id})">删</button>
</div>`;
});
renderExerciseList();
}

function deleteItem(id){
workouts=workouts.filter(w=>w.id!==id);
save();
renderAll();
}

/* ================= 饼图 ================= */

function drawPie(canvasId,data,title){
const canvas=document.getElementById(canvasId);
const ctx=canvas.getContext("2d");
ctx.clearRect(0,0,canvas.width,canvas.height);

ctx.font="14px sans-serif";
ctx.fillText(title,10,18);

const total=Object.values(data).reduce((a,b)=>a+b,0);
if(!total){ctx.fillText("暂无数据",10,40);return;}

let start=0;
const colors=["#60a5fa","#34d399","#f87171","#fbbf24","#a78bfa","#f472b6"];
let i=0,yLegend=30;

for(let key in data){
const val=data[key];
const percent=Math.round(val/total*100);

const slice=val/total*2*Math.PI;
ctx.fillStyle=colors[i];
ctx.beginPath();
ctx.moveTo(150,120);
ctx.arc(150,120,80,start,start+slice);
ctx.closePath();
ctx.fill();

ctx.fillStyle="#111";
ctx.fillRect(300,yLegend,12,12);
ctx.fillText(`${key} ${val}次 (${percent}%)`,320,yLegend+10);

start+=slice;
i++;yLegend+=20;
}
}

/* ================= 折线图 ================= */

function drawLine(canvasId,data,title){
const canvas=document.getElementById(canvasId);
const ctx=canvas.getContext("2d");
ctx.clearRect(0,0,canvas.width,canvas.height);

ctx.font="14px sans-serif";
ctx.fillText(title,10,18);

if(!data.length){
ctx.fillText("暂无数据",10,40);
return;
}

const max=Math.max(...data.map(d=>d.value));
const min=Math.min(...data.map(d=>d.value));

ctx.strokeStyle="#ddd";
ctx.beginPath();
ctx.moveTo(40,30);
ctx.lineTo(40,180);
ctx.lineTo(360,180);
ctx.stroke();

ctx.fillText(max,5,40);
ctx.fillText(min,5,180);

ctx.beginPath();
data.forEach((d,i)=>{
const x=60+i*(260/(data.length-1||1));
const y=180-(d.value/max)*140;
if(i===0)ctx.moveTo(x,y);
else ctx.lineTo(x,y);
});
ctx.strokeStyle="#2563eb";
ctx.lineWidth=2;
ctx.stroke();

data.forEach((d,i)=>{
const x=60+i*(260/(data.length-1||1));
const y=180-(d.value/max)*140;
ctx.beginPath();
ctx.arc(x,y,4,0,2*Math.PI);
ctx.fillStyle="#2563eb";
ctx.fill();
ctx.fillText(d.value,x-10,y-8);
});
}

/* ================= 分析 ================= */

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

drawPie("pie7",m7,"最近7天部位分布");
drawPie("pie30",m30,"最近30天部位分布");

renderTrendSelect();
}

/* ================= 重量趋势 ================= */

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
.slice(-5)
.map(w=>({date:w.date,value:w.weight}));

drawLine("trendChart",data,ex+" 最近5次重量");
}

/* ================= 极限重量 ================= */

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