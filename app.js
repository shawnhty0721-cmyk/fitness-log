const STORAGE = "fitness-data";
let records = JSON.parse(localStorage.getItem(STORAGE)) || [];

// 图表实例
let bar7Chart = null;
let bar30Chart = null;
let trendChart = null;

// 历史日期选择（默认最近一次训练日期）
let selectedHistoryDate = "";

// 注册 Chart.js datalabels（显示柱状图数字）
if (window.Chart && window.ChartDataLabels) {
  Chart.register(ChartDataLabels);
}

function save() {
  localStorage.setItem(STORAGE, JSON.stringify(records));
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function safeDate(dateStr) {
  // dateStr: YYYY-MM-DD
  return new Date(dateStr + "T00:00:00");
}

function getLatestTrainingDate() {
  if (!records.length) return "";
  // YYYY-MM-DD 字符串可直接比较
  return records.reduce((max, r) => (r.date > max ? r.date : max), records[0].date);
}

function switchTab(id, btn) {
  document.querySelectorAll(".tab").forEach(t => t.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
  document.querySelectorAll(".tabs button").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderAll();
}

/* ========== 今日训练：分部位动作下拉 ========== */

function updateExerciseOptions() {
  const muscleEl = document.getElementById("muscle");
  const select = document.getElementById("exerciseSelect");
  const input = document.getElementById("exerciseInput");
  if (!muscleEl || !select || !input) return;

  const muscle = muscleEl.value;

  const exercises = [...new Set(
    records
      .filter(r => r.muscle === muscle)
      .map(r => r.exercise)
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, "zh"));

  select.innerHTML = "";

  if (exercises.length === 0) {
    select.classList.add("hidden");
    input.classList.remove("hidden");
    input.value = "";
    return;
  }

  select.classList.remove("hidden");
  input.classList.add("hidden");

  exercises.forEach(ex => {
    const opt = document.createElement("option");
    opt.value = ex;
    opt.textContent = ex;
    select.appendChild(opt);
  });

  const optNew = document.createElement("option");
  optNew.value = "__new__";
  optNew.textContent = "+ 新建动作";
  select.appendChild(optNew);

  // 绑定一次即可（避免重复覆盖）
  select.onchange = () => {
    if (select.value === "__new__") {
      select.classList.add("hidden");
      input.classList.remove("hidden");
      input.value = "";
      input.focus();
    }
  };
}

/* ========== 添加记录 ========== */

function addRecord() {
  const muscle = document.getElementById("muscle")?.value || "其他";
  const select = document.getElementById("exerciseSelect");
  const input = document.getElementById("exerciseInput");

  let exercise = "";

  if (select && !select.classList.contains("hidden")) {
    exercise = select.value;
    if (exercise === "__new__") exercise = input?.value?.trim() || "";
  } else {
    exercise = input?.value?.trim() || "";
  }

  const weight = Number(document.getElementById("weight")?.value);
  const reps = Number(document.getElementById("reps")?.value);
  const sets = Number(document.getElementById("sets")?.value);

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

  // 清空输入（不改变 UI 风格）
  const weightEl = document.getElementById("weight");
  const repsEl = document.getElementById("reps");
  const setsEl = document.getElementById("sets");
  if (weightEl) weightEl.value = "";
  if (repsEl) repsEl.value = "";
  if (setsEl) setsEl.value = "";

  // 若是新建动作输入模式，清空输入
  if (input && !input.classList.contains("hidden")) input.value = "";

  renderAll();
}

/* ========== 删除记录 ========== */

function deleteRecord(id) {
  if (!confirm("确定删除这条记录？")) return;
  records = records.filter(r => r.id !== id);
  save();

  // 如果删除导致历史默认日期失效，重置到最新
  const latest = getLatestTrainingDate();
  if (selectedHistoryDate && latest && selectedHistoryDate > latest) {
    selectedHistoryDate = latest;
  }
  if (!records.length) selectedHistoryDate = "";

  renderAll();
}

/* ========== 今日预览：按动作分组 ========== */

function renderToday() {
  const div = document.getElementById("todayList");
  if (!div) return;

  const t = todayStr();
  const todays = records.filter(r => r.date === t);

  if (!todays.length) {
    div.innerHTML = `<div class="list"><div class="item"><div class="item-main">今天还没有记录</div></div></div>`;
    return;
  }

  // 按动作分组（你要求）
  const groups = {};
  todays.forEach(r => {
    if (!groups[r.exercise]) groups[r.exercise] = [];
    groups[r.exercise].push(r);
  });

  // 动作按字母/中文排序
  const exerciseNames = Object.keys(groups).sort((a, b) => a.localeCompare(b, "zh"));

  let html = `<div class="list">`;
  exerciseNames.forEach(ex => {
    html += `<div class="group-title">${ex}</div>`;
    groups[ex].forEach(r => {
      html += `
        <div class="item">
          <div class="item-head">
            <div class="item-main">${r.muscle} · ${r.weight}kg × ${r.reps} × ${r.sets}</div>
            <div class="delete-btn" onclick="deleteRecord(${r.id})">删除</div>
          </div>
        </div>
      `;
    });
  });
  html += `</div>`;

  div.innerHTML = html;
}

/* ========== 历史记录：按日期查询（默认最近一次训练日期） ========== */

function onHistoryDateChange() {
  const input = document.getElementById("historyDate");
  selectedHistoryDate = input?.value || "";
  renderHistory();
}

function jumpToLatestHistoryDate() {
  selectedHistoryDate = getLatestTrainingDate();
  const input = document.getElementById("historyDate");
  if (input) input.value = selectedHistoryDate || "";
  renderHistory();
}

function ensureHistoryDefaultDate() {
  if (selectedHistoryDate) return;
  selectedHistoryDate = getLatestTrainingDate();
  const input = document.getElementById("historyDate");
  if (input) input.value = selectedHistoryDate || "";
}

function renderHistory() {
  const div = document.getElementById("historyList");
  if (!div) return;

  ensureHistoryDefaultDate();

  if (!records.length) {
    div.innerHTML = `<div class="list"><div class="item"><div class="item-main">暂无记录</div></div></div>`;
    return;
  }

  if (!selectedHistoryDate) {
    div.innerHTML = `<div class="list"><div class="item"><div class="item-main">请选择日期</div></div></div>`;
    return;
  }

  const dayRecords = records
    .filter(r => r.date === selectedHistoryDate)
    .sort((a, b) => (a.exercise || "").localeCompare(b.exercise || "", "zh"));

  if (!dayRecords.length) {
    div.innerHTML = `<div class="list"><div class="item"><div class="item-main">该日期暂无记录</div></div></div>`;
    return;
  }

  let html = `<div class="list">`;
  dayRecords.forEach(r => {
    html += `
      <div class="item">
        <div class="item-head">
          <div class="item-main">${r.muscle} · ${r.exercise} ${r.weight}kg × ${r.reps} × ${r.sets}</div>
          <div class="delete-btn" onclick="deleteRecord(${r.id})">删除</div>
        </div>
      </div>
    `;
  });
  html += `</div>`;

  div.innerHTML = html;
}

/* ========== 分析报告：部位次数按天算 + 柱状图显示数字 ========== */

function getMuscleCountsByDay(windowStartDate, windowEndDate) {
  // windowStartDate/windowEndDate: Date（含当天）
  // 规则：同一天某部位出现过 => 该部位 +1（按天算）
  const muscleToDates = {}; // muscle -> Set(dateStr)

  records.forEach(r => {
    const d = safeDate(r.date);
    if (d < windowStartDate || d > windowEndDate) return;

    const m = r.muscle || "其他";
    if (!muscleToDates[m]) muscleToDates[m] = new Set();
    muscleToDates[m].add(r.date);
  });

  const muscles = Object.keys(muscleToDates);
  const counts = {};
  muscles.forEach(m => counts[m] = muscleToDates[m].size);
  return counts;
}

function getTrainingDaysCount(windowStartDate, windowEndDate) {
  const days = new Set();
  records.forEach(r => {
    const d = safeDate(r.date);
    if (d < windowStartDate || d > windowEndDate) return;
    days.add(r.date);
  });
  return days.size;
}

function renderAnalysis() {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // 今天 00:00
  const start7 = new Date(end); start7.setDate(end.getDate() - 6);
  const start30 = new Date(end); start30.setDate(end.getDate() - 29);

  const days7 = getTrainingDaysCount(start7, end);
  const days30 = getTrainingDaysCount(start30, end);

  const days7El = document.getElementById("days7");
  const days30El = document.getElementById("days30");
  if (days7El) days7El.textContent = String(days7);
  if (days30El) days30El.textContent = String(days30);

  const m7 = getMuscleCountsByDay(start7, end);
  const m30 = getMuscleCountsByDay(start30, end);

  drawBarWithNumbers("bar7", m7, true);
  drawBarWithNumbers("bar30", m30, false);

  renderTrendSelect();
}

function drawBarWithNumbers(canvasId, map, is7) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // 销毁旧图
  if (is7 && bar7Chart) { bar7Chart.destroy(); bar7Chart = null; }
  if (!is7 && bar30Chart) { bar30Chart.destroy(); bar30Chart = null; }

  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
  const labels = entries.map(x => x[0]);
  const values = entries.map(x => x[1]);

  const chart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: "#2E7CF6",
        borderRadius: 8
      }]
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: (ctx) => `${ctx.raw} 次` }
        },
        datalabels: {
          color: "#111",
          anchor: "end",
          align: "end",
          offset: 2,
          formatter: (v) => (v === 0 ? "" : `${v}`)
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 }
        }
      }
    }
  });

  if (is7) bar7Chart = chart;
  else bar30Chart = chart;
}

/* ========== 重量趋势：最近5次（柱状图显示数字） ========== */

function getUniqueExercisesAll() {
  return [...new Set(records.map(r => r.exercise).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "zh"));
}

function renderTrendSelect() {
  const sel = document.getElementById("trendSelect");
  if (!sel) return;

  const prev = sel.value;
  const exs = getUniqueExercisesAll();

  sel.innerHTML = "";
  exs.forEach(ex => {
    const opt = document.createElement("option");
    opt.value = ex;
    opt.textContent = ex;
    sel.appendChild(opt);
  });

  if (exs.includes(prev)) sel.value = prev;

  // 没有任何动作时，清空图表
  if (!exs.length) {
    if (trendChart) { trendChart.destroy(); trendChart = null; }
    return;
  }

  renderTrend();
}

function renderTrend() {
  const sel = document.getElementById("trendSelect");
  const canvas = document.getElementById("trendChart");
  if (!sel || !canvas) return;

  const ex = sel.value;
  const data = records
    .filter(r => r.exercise === ex)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-5);

  if (trendChart) { trendChart.destroy(); trendChart = null; }
  if (!data.length) return;

  const labels = data.map(d => d.date.slice(5)); // MM-DD
  const weights = data.map(d => d.weight);

  trendChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data: weights,
        backgroundColor: "#2E7CF6",
        borderRadius: 8
      }]
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: (ctx) => `${ctx.raw} kg` }
        },
        datalabels: {
          color: "#111",
          anchor: "end",
          align: "end",
          offset: 2,
          formatter: (v) => (v === 0 ? "" : `${v}`)
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          ticks: { callback: (v) => `${v}` }
        }
      }
    }
  });
}

/* ========== 极限重量：保持原逻辑 + 去网格线呈现 ========== */

function renderMax() {
  const div = document.getElementById("maxList");
  if (!div) return;

  if (!records.length) {
    div.innerHTML = `<div class="list"><div class="item"><div class="item-main">暂无记录</div></div></div>`;
    return;
  }

  const group = {}; // muscle -> exercise -> maxWeight
  records.forEach(r => {
    const m = r.muscle || "其他";
    if (!group[m]) group[m] = {};
    group[m][r.exercise] = Math.max(group[m][r.exercise] || 0, r.weight);
  });

  const muscles = Object.keys(group).sort((a, b) => a.localeCompare(b, "zh"));

  let html = `<div class="list">`;
  muscles.forEach(m => {
    html += `<div class="group-title">${m}</div>`;
    const items = Object.entries(group[m]).sort((a, b) => b[1] - a[1]);
    items.forEach(([ex, w]) => {
      html += `
        <div class="item">
          <div class="item-head">
            <div class="item-main">${ex} · 最大 ${w}kg</div>
          </div>
        </div>
      `;
    });
  });
  html += `</div>`;

  div.innerHTML = html;
}

/* ========== 总渲染 ========== */

function renderAll() {
  updateExerciseOptions();
  renderToday();
  renderHistory();
  renderAnalysis();
  renderMax();
}

// 初始化：历史默认日期设为最近一次训练日期
selectedHistoryDate = getLatestTrainingDate() || "";
renderAll();
