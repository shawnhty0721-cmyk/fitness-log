const STORAGE="fitness-data";
let records=JSON.parse(localStorage.getItem(STORAGE))||[];

let bar7Chart=null;
let bar30Chart=null;
let trendChart=null;

function save(){
 localStorage.setItem(STORAGE,JSON.stringify(records));
}

function todayStr(){
 return new Date().toISOString().slice(0,10);
}

function switchTab(id,btn){
 document.querySelectorAll(".tab").forEach(t=>t.classList.add("hidden"));
 document.getElementById(id).classList.remove("hidden");
 document.querySelectorAll(".tabs button").forEach(b=>b.classList.remove("active"));
 btn.classList.add("active");
 renderAll();
}

/* 分部位下拉 */

function updateExerciseOptions(){
 const muscle=document.getElementById("muscle").value;
 const select=document.getElementById("exerciseSelect");
 const input=document.getElementById("exerciseInput");

 const exercises=[...new Set(
  records.filter(r=>r.muscle===muscle).map(r=>r.exercise)
 )];

 select.innerHTML="";

 if(exercises.length===0){
  select.classList.add("hidden");
  input.classList.remove("hidden");
 }else{
  select.classList.remove("hidden");
  input.classList.add("hidden");

  exercises.forEach(ex=>{
   select.innerHTML+=`<option value="${ex}">${ex}</option>`;
  });

  select.innerHTML+=`<option value="__new__">+ 新建动作</option>`;

  select.onchange=function(){
   if(this.value==="__new__"){
    select.classList.add("hidden");
    input.classList.remove("hidden");
   }
  };
 }
}

/* 添加 */

function addRecord(){

 const muscle=document.getElementById("muscle").value;
 const select=document.getElementById("exerciseSelect");
 const input=document.getElementById("exerciseInput");

 let exercise;

 if(!select.classList.contains("hidden")){
  exercise=select.value;
  if(exercise==="__new__") exercise=input.value.trim();
 }else{
  exercise=input.value.trim();
 }

 const weight=Number(document.getElementById("weight").value);
 const reps=Number(document.getElementById("reps").value);
 const sets=Number(document.getElementById("sets").value);

 if(!exercise||!weight||!reps||!sets){
  alert("请填写完整");
  return;
 }

 records.push({
  id:Date.now(),
  date:todayStr(),
  exercise,
  muscle,
  weight,
  reps,
  sets
 });

 save();
 renderAll();
}

/* 今日 */

function renderToday(){
 const div=document.getElementById("todayList");
 const list=records.filter(r=>r.date===todayStr());
 div.innerHTML=list.map(r=>
  `<div class="record">${r.muscle} · ${r.exercise} ${r.weight}kg × ${r.reps} × ${r.sets}</div>`
 ).join("")||"<div>今天还没有记录</div>";
}

/* 历史 */

function renderHistory(){
 const div=document.getElementById("historyList");
 const data=records.slice().reverse();
 div.innerHTML=data.map(r=>
  `<div class="record">${r.date} - ${r.muscle} · ${r.exercise} ${r.weight}kg × ${r.reps} × ${r.sets}</div>`
 ).join("")||"<div>暂无记录</div>";
}

/* 分析 */

function renderAnalysis(){
 const now=new Date();
 const last7=new Date(now);last7.setDate(now.getDate()-6);
 const last30=new Date(now);last30.setDate(now.getDate()-29);

 const days7=new Set(),days30=new Set();
 const m7={},m30={};

 records.forEach(r=>{
  const d=new Date(r.date+"T00:00:00");
  if(d>=last7){days7.add(r.date);m7[r.muscle]=(m7[r.muscle]||0)+1;}
  if(d>=last30){days30.add(r.date);m30[r.muscle]=(m30[r.muscle]||0)+1;}
 });

 document.getElementById("days7").textContent=days7.size;
 document.getElementById("days30").textContent=days30.size;

 drawBar("bar7",m7);
 drawBar("bar30",m30);

 renderTrendSelect();
}

function drawBar(id,map){
 const ctx=document.getElementById(id);
 const labels=Object.keys(map);
 const values=Object.values(map);

 const chart=new Chart(ctx,{
  type:"bar",
  data:{labels,datasets:[{data:values,backgroundColor:"#2E7CF6"}]},
  options:{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}
 });

 if(id==="bar7"){if(bar7Chart)bar7Chart.destroy();bar7Chart=chart;}
 else{if(bar30Chart)bar30Chart.destroy();bar30Chart=chart;}
}

/* 趋势 */

function renderTrendSelect(){
 const sel=document.getElementById("trendSelect");
 const exercises=[...new Set(records.map(r=>r.exercise))];
 sel.innerHTML=exercises.map(e=>`<option>${e}</option>`).join("");
 renderTrend();
}

function renderTrend(){
 const sel=document.getElementById("trendSelect");
 const ex=sel.value;
 const data=records.filter(r=>r.exercise===ex).slice(-5);

 if(trendChart)trendChart.destroy();

 trendChart=new Chart(document.getElementById("trendChart"),{
  type:"bar",
  data:{
   labels:data.map(d=>d.date.slice(5)),
   datasets:[{data:data.map(d=>d.weight),backgroundColor:"#2E7CF6"}]
  },
  options:{plugins:{legend:{display:false}}}
 });
}

/* 极限 */

function renderMax(){
 const div=document.getElementById("maxList");
 const group={};

 records.forEach(r=>{
  if(!group[r.muscle])group[r.muscle]={};
  group[r.muscle][r.exercise]=Math.max(group[r.muscle][r.exercise]||0,r.weight);
 });

 let html="";
 Object.keys(group).forEach(m=>{
  html+=`<div style="margin-top:10px;font-weight:600">${m}</div>`;
  Object.entries(group[m])
   .sort((a,b)=>b[1]-a[1])
   .forEach(([ex,w])=>{
    html+=`<div class="record">${ex} · 最大 ${w}kg</div>`;
   });
 });

 div.innerHTML=html||"暂无记录";
}

function renderAll(){
 updateExerciseOptions();
 renderToday();
 renderHistory();
 renderAnalysis();
 renderMax();
}

renderAll();