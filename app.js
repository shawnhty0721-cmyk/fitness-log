const STORAGE="fitness-data";
let records=JSON.parse(localStorage.getItem(STORAGE))||[];

let bar7Chart,bar30Chart,trendChart;

function save(){localStorage.setItem(STORAGE,JSON.stringify(records));}
function today(){return new Date().toISOString().slice(0,10);}

function switchTab(id,btn){
document.querySelectorAll(".tab").forEach(t=>t.classList.add("hidden"));
document.getElementById(id).classList.remove("hidden");
document.querySelectorAll(".tabs button").forEach(b=>b.classList.remove("active"));
btn.classList.add("active");
}

function addRecord(){
const exercise=document.getElementById("exercise").value.trim();
const muscle=document.getElementById("muscle").value;
const weight=+document.getElementById("weight").value;
const reps=+document.getElementById("reps").value;
const sets=+document.getElementById("sets").value;

if(!exercise||!weight||!reps||!sets)return;

records.push({
id:Date.now(),
date:today(),
exercise,muscle,weight,reps,sets
});
save();
renderAll();

document.getElementById("exercise").value="";
document.getElementById("weight").value="";
document.getElementById("reps").value="";
document.getElementById("sets").value="";
}

function renderToday(){
const div=document.getElementById("todayList");
div.innerHTML="";
records.filter(r=>r.date===today())
.forEach(r=>{
div.innerHTML+=`<div class="record">
${r.muscle} · ${r.exercise} ${r.weight}kg × ${r.reps} × ${r.sets}
</div>`;
});
}

function renderHistory(){
const div=document.getElementById("historyList");
div.innerHTML="";
records.slice().reverse().forEach(r=>{
div.innerHTML+=`<div class="record">
${r.date} - ${r.exercise} ${r.weight}kg × ${r.reps} × ${r.sets}
</div>`;
});
}

function renderAnalysis(){
const now=new Date();
const last7=new Date();last7.setDate(now.getDate()-6);
const last30=new Date();last30.setDate(now.getDate()-29);

let m7={},m30={},days7=new Set(),days30=new Set();

records.forEach(r=>{
const d=new Date(r.date);
if(d>=last7){m7[r.muscle]=(m7[r.muscle]||0)+1;days7.add(r.date);}
if(d>=last30){m30[r.muscle]=(m30[r.muscle]||0)+1;days30.add(r.date);}
});

document.getElementById("days7").innerText=days7.size;
document.getElementById("days30").innerText=days30.size;

renderBar("bar7",m7);
renderBar("bar30",m30);
renderTrendSelect();
}

function renderBar(id,data){
const ctx=document.getElementById(id);
const sorted=Object.entries(data).sort((a,b)=>b[1]-a[1]);

if(id==="bar7"&&bar7Chart)bar7Chart.destroy();
if(id==="bar30"&&bar30Chart)bar30Chart.destroy();

const chart=new Chart(ctx,{
type:"bar",
data:{
labels:sorted.map(e=>e[0]),
datasets:[{
data:sorted.map(e=>e[1]),
backgroundColor:"#2E7CF6",
borderRadius:6
}]
},
options:{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{stepSize:1}}}}
});

if(id==="bar7")bar7Chart=chart;
if(id==="bar30")bar30Chart=chart;
}

function renderTrendSelect(){
const sel=document.getElementById("trendSelect");
const set=[...new Set(records.map(r=>r.exercise))];
sel.innerHTML="";
set.forEach(e=>sel.innerHTML+=`<option>${e}</option>`);
renderTrend();
}

function renderTrend(){
const ex=document.getElementById("trendSelect").value;
const data=records.filter(r=>r.exercise===ex)
.sort((a,b)=>a.date.localeCompare(b.date))
.slice(-5);

if(!data.length)return;

const ctx=document.getElementById("trendChart");
if(trendChart)trendChart.destroy();

trendChart=new Chart(ctx,{
type:"bar",
data:{
labels:data.map(d=>d.date),
datasets:[{
label:"重量 kg",
data:data.map(d=>d.weight),
backgroundColor:"#2E7CF6"
}]
},
options:{scales:{y:{beginAtZero:false}}}
});
}

function renderMax(){
const div=document.getElementById("maxList");
div.innerHTML="";
const group={};

records.forEach(r=>{
if(!group[r.muscle])group[r.muscle]={};
group[r.muscle][r.exercise]=Math.max(group[r.muscle][r.exercise]||0,r.weight);
});

Object.keys(group).forEach(m=>{
div.innerHTML+=`<h3>${m}</h3>`;
Object.entries(group[m])
.sort((a,b)=>b[1]-a[1])
.forEach(([ex,max])=>{
div.innerHTML+=`<div class="record">${ex} · 最大 ${max}kg</div>`;
});
});
}

function renderAll(){
renderToday();
renderHistory();
renderAnalysis();
renderMax();
}

renderAll();