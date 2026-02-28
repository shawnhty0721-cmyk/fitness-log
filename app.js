const STORAGE="fitness-data";
let workouts=JSON.parse(localStorage.getItem(STORAGE))||[];

let bar7Chart,bar30Chart,trendChart;

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

/* 分析 */
function renderAnalysis(){
const now=new Date();
const last7=new Date();last7.setDate(now.getDate()-6);
const last30=new Date();last30.setDate(now.getDate()-29);

let m7={},m30={};
let days7=new Set();

workouts.forEach(w=>{
const d=new Date(w.date);
if(d>=last7){m7[w.muscle]=(m7[w.muscle]||0)+1;days7.add(w.date);}
if(d>=last30){m30[w.muscle]=(m30[w.muscle]||0)+1;}
});

document.getElementById("days7").innerText=days7.size;

renderBar("bar7",m7,true);
renderBar("bar30",m30,false);

renderTrendSelect();
}

function renderBar(canvasId,data,store){
const ctx=document.getElementById(canvasId);
const sorted=Object.entries(data).sort((a,b)=>b[1]-a[1]);

if(canvasId==="bar7" && bar7Chart)bar7Chart.destroy();
if(canvasId==="bar30" && bar30Chart)bar30Chart.destroy();

const chart=new Chart(ctx,{
type:"bar",
data:{
labels:sorted.map(e=>e[0]),
datasets:[{
data:sorted.map(e=>e[1]),
backgroundColor:"#3b82f6",
borderRadius:6
}]
},
options:{
plugins:{legend:{display:false}},
scales:{
y:{beginAtZero:true,ticks:{stepSize:1}}
}
}
});

if(canvasId==="bar7")bar7Chart=chart;
if(canvasId==="bar30")bar30Chart=chart;
}

/* 重量趋势（双轴） */
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

if(!data.length)return;

const weights=data.map(d=>d.weight);
const rm=data.map(d=>calc1RM(d.weight,d.reps));

const max=Math.max(...weights);
const min=Math.min(...weights);

const ctx=document.getElementById("trendChart");
if(trendChart)trendChart.destroy();

trendChart=new Chart(ctx,{
data:{
labels:data.map(d=>d.date),
datasets:[
{
type:"bar",
label:"重量 kg",
data:weights,
backgroundColor:"#3b82f6",
yAxisID:"y"
},
{
type:"line",
label:"估算1RM",
data:rm,
borderColor:"#ef4444",
tension:0.3,
yAxisID:"y1"
}
]
},
options:{
responsive:true,
scales:{
y:{
position:"left",
min:min*0.9,
max:max*1.1
},
y1:{
position:"right",
grid:{drawOnChartArea:false}
}
}
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