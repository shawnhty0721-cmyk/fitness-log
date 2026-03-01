const STORAGE = "fitness-data";
let records = JSON.parse(localStorage.getItem(STORAGE)) || [];

let bar7Chart = null;
let bar30Chart = null;
let trendChart = null;

function save() {
  localStorage.setItem(STORAGE, JSON.stringify(records));
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function safeDate(d) {
  return new Date(d + "T00:00:00");
}

function switchTab(id, btn) {
  document.querySelectorAll(".tab").forEach(t => t.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
  document.querySelectorAll(".tabs button").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderAll();
}

/* =======================
   动作历史：datalist + select
   ======================= */

function getUniqueExercises() {
  return [...new Set(records.map(r => r.exercise).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "zh"));
}

function renderExerciseHistory() {
  // datalist
  const list = document.getElementById("exerciseList");
  if (list) {
    const exs = getUniqueExercises();
    list.innerHTML = "";
    exs.forEach(ex => {
      const opt = document.createElement("option");
      opt.value = ex;
      list.appendChild(opt);
    });
  }

  // select（安卓更稳）
  const sel = document.getElementById("exerciseSelect");
  if (sel) {
    const current = sel.value;
    const exs = getUniqueExercises();

    sel.innerHTML = `<option value="">（选择后会自动填入下面的动作名称）</option>`;
    exs.forEach(ex => {
      const opt = document.createElement("option");
      opt.value = ex;
      opt.textContent = ex;
      sel.appendChild(opt);
    });

    // 尝试保留之前选择
    if (exs.includes(current)) sel.value = current;
  }
}

function pickExerciseFromSelect() {
  const sel = document.getElementById("exerciseSelect");
  const input = document.getElementById("exercise");
  if (!sel || !input) return;
  if (sel.value) input.value = sel.value;
}

/* =======================
   添加记录
   ======================= */

function addRecord() {
  const exercise = document.getElementById("exercise").value.trim();
  const muscle = document.getElementById("muscle").value;
  const weight = Number(document.getElementById("weight").value);
  const reps = Number(document.getElementById("reps").value);
  const sets = Number(document.getElementById("sets").value);

  if (!exercise || !weight || !reps || !sets) {
    alert("请填写完整");
    return;
  }

  records.push({
    id: Date.now(),
    date: todayStr(),
    exercise,
    muscle,
    weight,
    reps,
    sets
  });

  save();

  // 清空输入
  document.getElementById("exercise").value = "";
  document.getElementById("weight").value = "";
  document.getElementById("reps").value = "";
  document.getElementById("sets").value = "";
  const sel = document.getElementById("exerciseSelect");
  if (sel) sel.value = "";

  renderAll();
}

/* =======================
   今日预览
   ======================= */

function renderToday() {
  const div = document.getElementById("todayList");
  if (!div) return;
  div.innerHTML = "";

  const t = todayStr();
  const todays = records.filter(r => r.date === t);

  if (todays.length === 0) {
    div.innerHTML = `<div class="small">今天还没有记录</div>`;
    return;
  }

  todays.forEach(r => {
    div.innerHTML += `
      <div class="record">
        ${r.muscle} · ${r.exercise} ${r.weight}kg × ${r.reps} × ${r.sets}
      </div>
    `;
  });
}

/* =======================
   历史记录（简单倒序）
   ======================= */

function renderHistory() {
  const div = document.getElementById("historyList");
  if (!div) return;
  div.innerHTML = "";

  const data = records.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  if (data.length === 0) {
    div.innerHTML = `<div class="small">暂无记录</div>`;
    return;
  }

  data.forEach(r => {
    div.innerHTML += `
      <div class="record">
        ${r.date} - ${r.muscle} · ${r.exercise} ${r.weight}kg × ${r.reps} × ${r.sets}
      </div>
    `;
  });
}

/* =======================
   分析报告：7天/30天（部位次数柱状图）+ 训练天数
   ======================= */

function renderAnalysis() {
  const now = new Date();
  const last7 = new Date(now); last7.setDate(now.getDate() - 6);
  const last30 = new Date(now); last30.setDate(now.getDate() - 29);

  const days7 = new Set();
  const days30 = new Set();
  const m7 = {};
  const m30 = {};

  records.forEach(r => {
    const d = safeDate(r.date);
    if (d >= last7) {
      days7.add(r.date);
      m7[r.muscle] = (m7[r.muscle] || 0) + 1;
    }
    if (d >= last30) {
      days30.add(r.date);
      m30[r.muscle] = (m30[r.muscle] || 0) + 1;
    }
  });

  const d7El = document.getElementById("days7");
  const d30El = document.getElementById("days30");
  if (d7El) d7El.textContent = days7.size;
  if (d30El) d30El.textContent = days30.size;

  renderBar("bar7", m7, () => bar7Chart, c => bar7Chart = c);
  renderBar("bar30", m30, () => bar30Chart, c => bar30Chart = c);

  renderTrendSelect();
}

function renderBar(canvasId, map, getOld, setNew) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const old = getOld();
  if (old) old.destroy();

  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(x => x[0]);
  const values = sorted.map(x => x[1]);

  const chart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "部位次数",
        data: values,
        backgroundColor: "#2E7CF6",
        borderRadius: 8
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } }
      }
    }
  });

  setNew(chart);
}

/* =======================
   重量趋势：最近5次（柱状图）
   ======================= */

function renderTrendSelect() {
  const sel = document.getElementById("trendSelect");
  if (!sel) return;

  const prev = sel.value;
  const exs = getUniqueExercises();

  sel.innerHTML = "";
  exs.forEach(ex => {
    const opt = document.createElement("option");
    opt.value = ex;
    opt.textContent = ex;
    sel.appendChild(opt);
  });

  if (exs.includes(prev)) sel.value = prev;
  renderTrend();
}

function renderTrend() {
  const sel = document.getElementById("trendSelect");
  const canvas = document.getElementById("trendChart");
  if (!sel || !canvas) return;

  const ex = sel.value;
  const data = records
    .filter(r => r.exercise === ex)
    .sort((a, b) => (a.date > b.date ? 1 : -1))
    .slice(-5);

  if (trendChart) trendChart.destroy();
  if (data.length === 0) return;

  const labels = data.map(d => d.date.slice(5)); // MM-DD
  const weights = data.map(d => d.weight);

  trendChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: `${ex} 最近5次重量(kg)`,
        data: weights,
        backgroundColor: "#2E7CF6",
        borderRadius: 8
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: false,
          ticks: { callback: (v) => `${v}kg` }
        }
      }
    }
  });
}

/* =======================
   极限重量：按部位 -> 动作最大重量排序
   ======================= */

function renderMax() {
  const div = document.getElementById("maxList");
  if (!div) return;
  div.innerHTML = "";

  if (records.length === 0) {
    div.innerHTML = `<div class="small">暂无记录</div>`;
    return;
  }

  const group = {};
  records.forEach(r => {
    if (!group[r.muscle]) group[r.muscle] = {};
    group[r.muscle][r.exercise] = Math.max(group[r.muscle][r.exercise] || 0, r.weight);
  });

  Object.keys(group).forEach(m => {
    div.innerHTML += `<div class="small" style="margin-top:10px;">${m}</div>`;
    Object.entries(group[m])
      .sort((a, b) => b[1] - a[1])
      .forEach(([ex, maxW]) => {
        div.innerHTML += `<div class="record">${ex} · 最大 ${maxW}kg</div>`;
      });
  });
}

/* =======================
   总渲染
   ======================= */

function renderAll() {
  renderExerciseHistory();
  renderToday();
  renderHistory();
  renderAnalysis();
  renderMax();
}

renderAll();