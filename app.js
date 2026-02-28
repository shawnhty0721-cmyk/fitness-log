const STORAGE = "fitness-data";
let workouts = JSON.parse(localStorage.getItem(STORAGE)) || [];

function save() {
  localStorage.setItem(STORAGE, JSON.stringify(workouts));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function calc1RM(w, r) {
  return +(w * (1 + r / 30)).toFixed(1);
}

/* =========================
   添加记录 + 动作沉淀
========================= */

function addWorkout() {
  const muscle = muscleEl().value;
  const exercise = exerciseEl().value.trim();
  const weight = +weightEl().value;
  const reps = +repsEl().value;
  const sets = +setsEl().value;

  if (!exercise || !weight || !reps || !sets) {
    alert("请填写完整");
    return;
  }

  workouts.push({
    id: Date.now(),
    date: today(),
    muscle,
    exercise,
    weight,
    reps,
    sets
  });

  save();
  clearInputs();
  renderAll();
}

function muscleEl() { return document.getElementById("muscle"); }
function exerciseEl() { return document.getElementById("exercise"); }
function weightEl() { return document.getElementById("weight"); }
function repsEl() { return document.getElementById("reps"); }
function setsEl() { return document.getElementById("sets"); }

function clearInputs() {
  exerciseEl().value = "";
  weightEl().value = "";
  repsEl().value = "";
  setsEl().value = "";
}

/* =========================
   动作历史下拉（修复版）
========================= */

function renderExerciseList() {
  const list = document.getElementById("exerciseList");
  if (!list) return;

  const unique = [...new Set(workouts.map(w => w.exercise).filter(Boolean))];
  list.innerHTML = "";

  unique.sort().forEach(e => {
    const option = document.createElement("option");
    option.value = e;
    list.appendChild(option);
  });
}

/* =========================
   删除
========================= */

function deleteItem(id) {
  workouts = workouts.filter(w => w.id !== id);
  save();
  renderAll();
}

function deleteDay(date) {
  workouts = workouts.filter(w => w.date !== date);
  save();
  renderAll();
}

function clearDate() {
  document.getElementById("historyDate").value = "";
  renderHistory();
}

/* =========================
   今日预览
========================= */

function renderToday() {
  const div = document.getElementById("todayPreview");
  div.innerHTML = "";

  workouts.filter(w => w.date === today())
    .forEach(w => {
      div.innerHTML += `
        <div class="record">
          ${w.muscle} · ${w.exercise} ${w.weight}kg × ${w.reps} × ${w.sets}
          <button onclick="deleteItem(${w.id})">删</button>
        </div>`;
    });

  renderExerciseList();
}

/* =========================
   历史
========================= */

function renderHistory() {
  const date = document.getElementById("historyDate").value;
  const list = document.getElementById("historyList");
  list.innerHTML = "";

  let data = workouts;
  if (date) data = data.filter(w => w.date === date);

  const group = {};
  data.forEach(w => {
    if (!group[w.date]) group[w.date] = [];
    group[w.date].push(w);
  });

  Object.keys(group).sort().reverse().forEach(d => {
    list.innerHTML += `<h3>${d} <button onclick="deleteDay('${d}')">删整天</button></h3>`;
    group[d].forEach(w => {
      list.innerHTML += `
        <div class="record">
          ${w.muscle} · ${w.exercise} ${w.weight}kg × ${w.reps}
          <button onclick="deleteItem(${w.id})">删</button>
        </div>`;
    });
  });
}

/* =========================
   饼图（带标题标注）
========================= */

function drawPie(canvasId, data, title) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.font = "14px sans-serif";
  ctx.fillStyle = "#111";
  ctx.fillText(title, 10, 18);

  const total = Object.values(data).reduce((a, b) => a + b, 0);
  if (!total) return;

  let start = 0;
  const colors = ["#60a5fa", "#34d399", "#f87171", "#fbbf24", "#a78bfa", "#f472b6", "#94a3b8"];
  let i = 0;

  for (let key in data) {
    const slice = data[key] / total * 2 * Math.PI;
    ctx.fillStyle = colors[i++ % colors.length];
    ctx.beginPath();
    ctx.moveTo(150, 120);
    ctx.arc(150, 120, 80, start, start + slice);
    ctx.closePath();
    ctx.fill();

    start += slice;
  }
}

/* =========================
   分析
========================= */

function renderAnalysis() {
  const now = new Date();
  const last7 = new Date(); last7.setDate(now.getDate() - 6);
  const last30 = new Date(); last30.setDate(now.getDate() - 29);

  let days7 = new Set();
  let days30 = new Set();
  let m7 = {}, m30 = {};

  workouts.forEach(w => {
    const d = new Date(w.date);
    if (d >= last7) { days7.add(w.date); m7[w.muscle] = (m7[w.muscle] || 0) + 1; }
    if (d >= last30) { days30.add(w.date); m30[w.muscle] = (m30[w.muscle] || 0) + 1; }
  });

  document.getElementById("days7").innerText = days7.size;
  document.getElementById("days30").innerText = days30.size;

  drawPie("pie7", m7, "最近7天部位分布");
  drawPie("pie30", m30, "最近30天部位分布");

  renderTrendSelect();
}

/* =========================
   折线图（带标题）
========================= */

function renderTrendSelect() {
  const sel = document.getElementById("trendSelect");
  const set = [...new Set(workouts.map(w => w.exercise))];
  sel.innerHTML = "";
  set.forEach(e => sel.innerHTML += `<option>${e}</option>`);
  renderTrend();
}

function renderTrend() {
  const ex = document.getElementById("trendSelect").value;
  const data = workouts.filter(w => w.exercise === ex)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-5);

  const ctx = document.getElementById("trendChart").getContext("2d");
  ctx.clearRect(0, 0, 400, 220);

  ctx.font = "14px sans-serif";
  ctx.fillText("最近5次重量趋势", 10, 18);

  if (!data.length) return;

  const max = Math.max(...data.map(d => d.weight));
  ctx.beginPath();
  data.forEach((d, i) => {
    const x = 50 + i * 60;
    const y = 180 - (d.weight / max) * 120;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 2;
  ctx.stroke();
}

/* =========================
   极限重量（1RM排序）
========================= */

function renderMax() {
  const div = document.getElementById("maxList");
  div.innerHTML = "";

  const group = {};

  workouts.forEach(w => {
    if (!group[w.muscle]) group[w.muscle] = {};
    if (!group[w.muscle][w.exercise])
      group[w.muscle][w.exercise] = { maxW: 0, max1RM: 0 };

    group[w.muscle][w.exercise].maxW =
      Math.max(group[w.muscle][w.exercise].maxW, w.weight);

    group[w.muscle][w.exercise].max1RM =
      Math.max(group[w.muscle][w.exercise].max1RM, calc1RM(w.weight, w.reps));
  });

  Object.keys(group).forEach(m => {
    div.innerHTML += `<h3>${m}</h3>`;

    Object.entries(group[m])
      .sort((a, b) => b[1].max1RM - a[1].max1RM)
      .forEach(([ex, val]) => {
        div.innerHTML += `
        <div class="record">
          ${ex} · 最大 ${val.maxW}kg · 最高1RM ${val.max1RM}kg
        </div>`;
      });
  });
}

/* ========================= */

function switchPage(id, btn) {
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
  document.querySelectorAll(".bottom-nav button").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderAll();
}

function renderAll() {
  renderToday();
  renderHistory();
  renderAnalysis();
  renderMax();
}

renderAll();