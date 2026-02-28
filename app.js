const STORAGE_KEY = "fitness-data";
let workouts = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workouts));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function calc1RM(weight, reps) {
  return +(weight * (1 + reps / 30)).toFixed(1);
}

function addWorkout() {
  const muscle = muscleEl().value;
  const exercise = exerciseEl().value.trim();
  const weight = Number(weightEl().value);
  const reps = Number(repsEl().value);
  const sets = Number(setsEl().value);

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
}

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
   分析报告（饼图 + 天数统计）
========================= */

function renderAnalysis() {
  const now = new Date();
  const last7 = new Date(); last7.setDate(now.getDate() - 6);
  const last30 = new Date(); last30.setDate(now.getDate() - 29);

  let days7 = new Set();
  let days30 = new Set();

  let muscle7 = {};
  let muscle30 = {};

  workouts.forEach(w => {
    const d = new Date(w.date);

    if (d >= last7) {
      days7.add(w.date);
      muscle7[w.muscle] = (muscle7[w.muscle] || 0) + 1;
    }

    if (d >= last30) {
      days30.add(w.date);
      muscle30[w.muscle] = (muscle30[w.muscle] || 0) + 1;
    }
  });

  document.getElementById("days7").innerText = days7.size;
  document.getElementById("days30").innerText = days30.size;

  drawPie("chart7", muscle7);
  drawPie("chart30", muscle30);

  renderTrendSelect();
}

/* =========================
   饼图绘制
========================= */

function drawPie(canvasId, dataObj) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const total = Object.values(dataObj).reduce((a, b) => a + b, 0);
  if (!total) return;

  const colors = ["#60a5fa", "#34d399", "#f87171", "#fbbf24", "#a78bfa", "#f472b6", "#94a3b8"];

  let start = 0;
  let i = 0;

  Object.entries(dataObj).forEach(([key, val]) => {
    const slice = (val / total) * 2 * Math.PI;
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.moveTo(100, 90);
    ctx.arc(100, 90, 70, start, start + slice);
    ctx.closePath();
    ctx.fill();
    start += slice;
    i++;
  });
}

/* =========================
   重量趋势折线图
========================= */

function renderTrendSelect() {
  const sel = document.getElementById("trendExercise");
  const exercises = [...new Set(workouts.map(w => w.exercise))];
  sel.innerHTML = "";
  exercises.forEach(e => sel.innerHTML += `<option>${e}</option>`);
  renderTrend();
}

function renderTrend() {
  const ex = document.getElementById("trendExercise").value;
  const data = workouts.filter(w => w.exercise === ex)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-5);

  const canvas = document.getElementById("trendChart");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!data.length) return;

  const max = Math.max(...data.map(d => d.weight));
  const step = 300 / (data.length - 1 || 1);

  ctx.beginPath();
  data.forEach((d, i) => {
    const x = 50 + i * step;
    const y = 180 - (d.weight / max) * 120;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 2;
  ctx.stroke();
}

/* =========================
   极限重量（按1RM排序）
========================= */

function renderMax() {
  const div = document.getElementById("maxList");
  div.innerHTML = "";

  const group = {};

  workouts.forEach(w => {
    if (!group[w.muscle]) group[w.muscle] = {};
    if (!group[w.muscle][w.exercise])
      group[w.muscle][w.exercise] = { maxWeight: 0, max1RM: 0 };

    group[w.muscle][w.exercise].maxWeight =
      Math.max(group[w.muscle][w.exercise].maxWeight, w.weight);

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
          ${ex} · 最大重量 ${val.maxWeight}kg · 最高估算1RM ${val.max1RM}kg
        </div>`;
      });
  });
}

/* =========================
   页面切换
========================= */

function switchPage(id, btn) {
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");

  document.querySelectorAll(".bottom-nav button")
    .forEach(b => b.classList.remove("active"));

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