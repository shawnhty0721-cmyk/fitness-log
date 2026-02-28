const STORAGE="fitness-data";
let workouts=JSON.parse(localStorage.getItem(STORAGE))||[];

function save(){localStorage.setItem(STORAGE,JSON.stringify(workouts));}
function today(){return new Date().toISOString().slice(0,10);}
function calc1RM(w,r){return +(w*(1+r/30)).toFixed(1);}
function calcLoad(w){return w.weight*w.reps*w.sets;}

function addWorkout(){
const muscle=muscleEl().value;
const exercise=exerciseEl().value.trim();
const weight=+weightEl().value;
const reps=+repsEl().value;
const sets=+setsEl().value;
if(!exercise||!weight||!reps||!sets){alert("请填写完整");return;}

const prevMax=Math.max(
...workouts.filter(w=>w.exercise===exercise).map(w=>w.weight),0);

workouts.push({id:Date.now(),date:today(),muscle,exercise,weight,reps,sets});
save();
clearInputs();

if(weight>prevMax && prevMax>0){
alert("🎉 新PR诞生！");
}

renderAll();
}

function muscleEl(){return document.getElementById("muscle");}
function exerciseEl(){return document.getElementById("exercise");}
function weightEl(){return document.getElementById("weight");}
function repsEl(){return document.getElementById("reps");}
function setsEl(){return document.getElementById("sets");}

function clearInputs(){
exerciseEl().value="";
weightEl().value="";
repsEl().value="";
setsEl().value="";
}

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

/* ========= 今日 ========= */

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

/* ========= 周期分析 ========= */

function renderAnalysis(){

const now=new Date();
const last7=new Date(); last7.setDate(now.getDate()-6);
const prev7=new Date(); prev7.setDate(now.getDate()-13);

let load7=0, loadPrev=0;
let days7=new Set();
let dailyLoad={};

workouts.forEach(w=>{
const d=new Date(w.date);
const load=calcLoad(w);

if(d>=last7){
load7+=load;
days7.add(w.date);
}
else if(d>=prev7 && d<last7){
loadPrev+=load;
}

if(!dailyLoad[w.date])dailyLoad[w.date]=0;
dailyLoad[w.date]+=load;
});

document.getElementById("days7").innerText=days7.size;

/* 强度判断 */
let msg="";
if(loadPrev>0){
const diff=(load7-loadPrev)/loadPrev;
if(diff>0.4)msg="⚠️ 负荷增长过快，注意恢复";
else if(diff>0.1)msg="📈 训练强度提升";
else if(diff<-0.2)msg="📉 强度下降明显";
else msg="✅ 强度稳定";
}

document.getElementById("days30").innerText=msg;

/* 负荷曲线 */
drawLoadTrend(dailyLoad);

renderTrendSelect();
}

/* ========= 负荷趋势图 ========= */

function drawLoadTrend(data){

const canvas=document.getElementById("trendChart");
const ctx=canvas.getContext("2d");
ctx.clearRect(0,0,400,220);

const entries=Object.entries(data)
.sort((a,b)=>a[0].localeCompare(b[0]))
.slice(-14);

if(entries.length===0)return;

const max=Math.max(...entries.map(e=>e[1]));

ctx.beginPath();
entries.forEach((e,i)=>{
const x=40+i*20;
const y=180-(e[1]/max)*140;
if(i===0)ctx.moveTo(x,y);
else ctx.lineTo(x,y);
});
ctx.strokeStyle="#2563eb";
ctx.lineWidth=2;
ctx.stroke();
}

/* ========= 极限 ========= */

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