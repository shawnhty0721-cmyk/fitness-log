let records = JSON.parse(localStorage.getItem("records") || "[]");

function save() {
localStorage.setItem("records", JSON.stringify(records));
}

function addRecord(){
const exercise = document.getElementById("exercise").value;
const weight = document.getElementById("weight").value;
const reps = document.getElementById("reps").value;
const sets = document.getElementById("sets").value;

if(!exercise || !weight) return;

records.push({
date: new Date().toISOString(),
exercise,
weight: Number(weight),
reps,
sets
});

save();
renderAll();

document.getElementById("exercise").value="";
document.getElementById("weight").value="";
document.getElementById("reps").value="";
document.getElementById("sets").value="";
}

function renderHistory(){
const div = document.getElementById("history");
div.innerHTML="";

records.slice().reverse().forEach(r=>{
const item = document.createElement("div");
item.className="record";
item.innerHTML = `
<strong>${r.exercise}</strong> - ${r.weight}kg × ${r.reps}次 × ${r.sets}组
<br><span style="color:#999;font-size:12px">
${new Date(r.date).toLocaleDateString()}
</span>
`;
div.appendChild(item);
});
}

let pieChart;
function renderPie(){
const ctx = document.getElementById("pie7");

const last7 = records.filter(r=>{
const diff = (Date.now() - new Date(r.date))/86400000;
return diff<=7;
});

const map={};
last7.forEach(r=>{
map[r.exercise] = (map[r.exercise]||0)+1;
});

if(pieChart) pieChart.destroy();

pieChart = new Chart(ctx,{
type:"pie",
data:{
labels:Object.keys(map),
datasets:[{
data:Object.values(map),
backgroundColor:["#2E7CF6","#4CAF50","#FF9800","#F44336","#9C27B0"]
}]
},
options:{
plugins:{
legend:{position:"bottom"}
}
}
});
}

let trendChart;
function renderTrend(){
const select = document.getElementById("trendSelect");
const ctx = document.getElementById("trendChart");

const exercise = select.value;
const filtered = records.filter(r=>r.exercise===exercise).slice(-5);

if(trendChart) trendChart.destroy();

trendChart = new Chart(ctx,{
type:"bar",
data:{
labels:filtered.map((_,i)=>"第"+(i+1)+"次"),
datasets:[{
label:"重量 (kg)",
data:filtered.map(r=>r.weight),
backgroundColor:"#2E7CF6"
}]
},
options:{
scales:{
y:{beginAtZero:false}
}
}
});
}

function updateSelect(){
const select = document.getElementById("trendSelect");
select.innerHTML="";
[...new Set(records.map(r=>r.exercise))].forEach(ex=>{
const opt = document.createElement("option");
opt.value=ex;
opt.innerText=ex;
select.appendChild(opt);
});
}

function renderAll(){
renderHistory();
renderPie();
updateSelect();
renderTrend();
}

renderAll();