const STORAGE = "fitness-data";
const BODY_PARTS = ["胸", "背", "腿", "肩", "手臂", "核心", "其他"];

let records = loadRecords();
let selectedHistoryDate = getLatestTrainingDate();
let analysisRange = 7;
let historyMonth = selectedHistoryDate ? selectedHistoryDate.slice(0, 7) : todayStr().slice(0, 7);

let analysisChart = null;
let trendChart = null;

if (window.Chart && window.ChartDataLabels) {
  Chart.register(ChartDataLabels);
}

if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(error => {
      console.warn("Service worker 注册失败", error);
    });
  });
}

function loadRecords() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE) || "[]");
    return normalizeImportedData(raw);
  } catch (error) {
    console.warn("读取本地数据失败", error);
    return [];
  }
}

function save() {
  records = normalizeImportedData(records);
  localStorage.setItem(STORAGE, JSON.stringify(records));
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function safeDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`);
}

function uid() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function isDateString(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeItem(item, fallbackDate) {
  if (!item || typeof item !== "object") return null;

  const date = isDateString(item.date) ? item.date : fallbackDate;
  const exercise = String(item.exercise || item.name || "").trim();
  const muscle = String(item.muscle || item.bodyPart || item.part || "其他").trim() || "其他";
  const weight = Number(item.weight);
  const reps = Number(item.reps);
  const sets = Number(item.sets || 1);

  if (!isDateString(date) || !exercise || !Number.isFinite(weight) || !Number.isFinite(reps) || !Number.isFinite(sets)) {
    return null;
  }

  return {
    id: Number(item.id) || uid(),
    date,
    muscle,
    bodyPart: muscle,
    exercise,
    weight,
    reps,
    sets,
    createdAt: item.createdAt || `${date}T00:00:00`
  };
}

function normalizeImportedData(data) {
  const result = [];

  function addRecord(item, fallbackDate) {
    const normalized = normalizeItem(item, fallbackDate);
    if (normalized) result.push(normalized);
  }

  if (Array.isArray(data)) {
    data.forEach(entry => {
      if (entry && Array.isArray(entry.items)) {
        entry.items.forEach(item => addRecord(item, entry.date));
      } else {
        addRecord(entry);
      }
    });
  } else if (data && typeof data === "object") {
    if (Array.isArray(data.records)) {
      data.records.forEach(item => addRecord(item));
    }
    if (Array.isArray(data.workouts)) {
      data.workouts.forEach(day => {
        if (day && Array.isArray(day.items)) {
          day.items.forEach(item => addRecord(item, day.date));
        }
      });
    }
    if (isDateString(data.date) && Array.isArray(data.items)) {
      data.items.forEach(item => addRecord(item, data.date));
    }
  }

  const seen = new Set();
  return result
    .filter(r => r.weight > 0 && r.reps > 0 && r.sets > 0)
    .sort((a, b) => `${a.date}-${a.id}`.localeCompare(`${b.date}-${b.id}`))
    .map(r => {
      while (seen.has(r.id)) r.id = uid();
      seen.add(r.id);
      return r;
    });
}

function buildWorkoutsExport() {
  const byDate = {};
  records.forEach(r => {
    if (!byDate[r.date]) byDate[r.date] = [];
    byDate[r.date].push({
      id: r.id,
      bodyPart: r.bodyPart || r.muscle || "其他",
      muscle: r.muscle || r.bodyPart || "其他",
      exercise: r.exercise,
      weight: r.weight,
      reps: r.reps,
      sets: r.sets,
      estimated1RM: Number(estimate1RM(r).toFixed(1))
    });
  });

  return Object.keys(byDate)
    .sort()
    .map(date => ({ date, items: byDate[date] }));
}

function getLatestTrainingDate() {
  if (!records.length) return "";
  return records.reduce((max, r) => (r.date > max ? r.date : max), records[0].date);
}

function estimate1RM(record) {
  return Number(record.weight) * (1 + Number(record.reps) / 30);
}

function getChartSuggestedMax(values) {
  const max = Math.max(0, ...values.map(Number));
  if (max <= 0) return 1;
  return Math.ceil(max * 1.25);
}

function switchTab(id, btn) {
  document.querySelectorAll(".tab").forEach(t => t.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
  document.querySelectorAll(".tabs button").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderAll();
}

function updateExerciseOptions() {
  const muscleEl = document.getElementById("muscle");
  const muscleInput = document.getElementById("muscleInput");
  const select = document.getElementById("exerciseSelect");
  const input = document.getElementById("exerciseInput");
  if (!muscleEl || !select || !input) return;

  const isCustomMuscle = muscleEl.value === "__custom__";
  if (muscleInput) muscleInput.classList.toggle("hidden", !isCustomMuscle);

  const muscle = getSelectedMuscle();
  const previous = select.value;
  const exercises = getExercisesByMuscle(muscle);

  select.innerHTML = "";

  if (!exercises.length) {
    select.classList.add("hidden");
    input.classList.remove("hidden");
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

  if (exercises.includes(previous)) select.value = previous;

  select.onchange = () => {
    if (select.value === "__new__") {
      select.classList.add("hidden");
      input.classList.remove("hidden");
      input.value = "";
      input.focus();
    }
  };
}

function getSelectedMuscle() {
  const muscleEl = document.getElementById("muscle");
  const muscleInput = document.getElementById("muscleInput");
  if (muscleEl?.value === "__custom__") {
    return muscleInput?.value?.trim() || "";
  }
  return muscleEl?.value || "其他";
}

function getExercisesByMuscle(muscle) {
  if (!muscle) return [];
  return [...new Set(
    records
      .filter(r => (r.muscle || r.bodyPart || "其他") === muscle)
      .map(r => r.exercise)
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, "zh"));
}

function getUniqueExercisesAll() {
  return [...new Set(records.map(r => r.exercise).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "zh"));
}

function addRecord() {
  const muscle = getSelectedMuscle();
  const select = document.getElementById("exerciseSelect");
  const input = document.getElementById("exerciseInput");

  let exercise = "";
  if (select && !select.classList.contains("hidden")) {
    exercise = select.value === "__new__" ? input?.value?.trim() || "" : select.value;
  } else {
    exercise = input?.value?.trim() || "";
  }

  const weight = Number(document.getElementById("weight")?.value);
  const reps = Number(document.getElementById("reps")?.value);
  const sets = Number(document.getElementById("sets")?.value);

  if (!muscle || !exercise || weight <= 0 || reps <= 0 || sets <= 0) {
    alert("请填写完整，并确保训练部位、重量、次数、组数都有效");
    return;
  }

  const date = todayStr();
  records.push({
    id: uid(),
    date,
    muscle,
    bodyPart: muscle,
    exercise,
    weight,
    reps,
    sets,
    createdAt: new Date().toISOString()
  });

  selectedHistoryDate = date;
  save();

  ["weight", "reps", "sets"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  if (input && !input.classList.contains("hidden")) input.value = "";

  renderAll();
}

function deleteRecord(id) {
  if (!confirm("确定删除这条记录？")) return;
  records = records.filter(r => r.id !== id);
  afterDelete();
}

function deleteSelectedDay() {
  ensureHistoryDefaultDate();
  if (!selectedHistoryDate) return;
  const count = records.filter(r => r.date === selectedHistoryDate).length;
  if (!count) return;
  if (!confirm(`确定删除 ${selectedHistoryDate} 的 ${count} 条记录？`)) return;
  records = records.filter(r => r.date !== selectedHistoryDate);
  afterDelete();
}

function afterDelete() {
  save();
  const latest = getLatestTrainingDate();
  if (!records.length) selectedHistoryDate = "";
  else if (!records.some(r => r.date === selectedHistoryDate)) selectedHistoryDate = latest;
  historyMonth = selectedHistoryDate ? selectedHistoryDate.slice(0, 7) : todayStr().slice(0, 7);
  renderAll();
}

function groupByExercise(list) {
  const groups = {};
  list.forEach(r => {
    if (!groups[r.exercise]) groups[r.exercise] = [];
    groups[r.exercise].push(r);
  });
  return groups;
}

function renderGroupedRecords(container, list, emptyText) {
  if (!list.length) {
    container.innerHTML = `<div class="list"><div class="item"><div class="item-main">${emptyText}</div></div></div>`;
    return;
  }

  const groups = groupByExercise(list);
  const names = Object.keys(groups).sort((a, b) => a.localeCompare(b, "zh"));
  let html = `<div class="list">`;

  names.forEach(ex => {
    html += `<div class="group-title">${escapeHTML(ex)}</div>`;
    groups[ex]
      .sort((a, b) => a.id - b.id)
      .forEach((r, index) => {
        html += `
          <div class="item">
            <div class="item-head">
              <div class="item-main">
                第 ${index + 1} 组 · ${escapeHTML(r.muscle)} · ${formatNumber(r.weight)}kg × ${formatNumber(r.reps)} × ${formatNumber(r.sets)}
                <div class="item-sub">推测 1RM ${formatNumber(estimate1RM(r))}kg</div>
              </div>
              <div class="delete-btn" onclick="deleteRecord(${r.id})">删除</div>
            </div>
          </div>
        `;
      });
  });

  html += `</div>`;
  container.innerHTML = html;
}

function renderToday() {
  const div = document.getElementById("todayList");
  if (!div) return;
  const todays = records.filter(r => r.date === todayStr());
  renderGroupedRecords(div, todays, "今天还没有记录");
}

function onHistoryDateChange() {
  const input = document.getElementById("historyDate");
  selectedHistoryDate = input?.value || "";
  if (selectedHistoryDate) historyMonth = selectedHistoryDate.slice(0, 7);
  renderHistory();
}

function jumpToLatestHistoryDate() {
  selectedHistoryDate = getLatestTrainingDate();
  if (selectedHistoryDate) historyMonth = selectedHistoryDate.slice(0, 7);
  renderHistory();
}

function ensureHistoryDefaultDate() {
  if (selectedHistoryDate && records.some(r => r.date === selectedHistoryDate)) return;
  selectedHistoryDate = getLatestTrainingDate();
  if (selectedHistoryDate) historyMonth = selectedHistoryDate.slice(0, 7);
}

function renderHistory() {
  const div = document.getElementById("historyList");
  const input = document.getElementById("historyDate");
  if (!div) return;

  ensureHistoryDefaultDate();
  if (input) input.value = selectedHistoryDate || "";
  renderHistoryDateList();

  if (!records.length) {
    div.innerHTML = `<div class="list"><div class="item"><div class="item-main">暂无记录</div></div></div>`;
    return;
  }

  const dayRecords = records
    .filter(r => r.date === selectedHistoryDate)
    .sort((a, b) => `${a.exercise}-${a.id}`.localeCompare(`${b.exercise}-${b.id}`, "zh"));

  renderGroupedRecords(div, dayRecords, "该日期暂无记录");
}

function getTrainingDates() {
  return [...new Set(records.map(r => r.date).filter(Boolean))]
    .sort((a, b) => b.localeCompare(a));
}

function selectHistoryDate(date) {
  selectedHistoryDate = date;
  historyMonth = date.slice(0, 7);
  renderHistory();
}

function shiftHistoryMonth(offset) {
  const [year, month] = historyMonth.split("-").map(Number);
  const d = new Date(year, month - 1 + offset, 1);
  historyMonth = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  renderHistory();
}

function renderHistoryDateList() {
  const div = document.getElementById("historyDateList");
  if (!div) return;

  const dateSet = new Set(getTrainingDates());
  if (!dateSet.size) {
    div.innerHTML = "";
    return;
  }

  const [year, month] = historyMonth.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startBlank = first.getDay();
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];

  let html = `
    <div class="calendar">
      <div class="calendar-head">
        <div class="calendar-title">${year}年${month}月</div>
        <div class="calendar-nav">
          <button onclick="shiftHistoryMonth(-1)" aria-label="上个月">‹</button>
          <button onclick="shiftHistoryMonth(1)" aria-label="下个月">›</button>
        </div>
      </div>
      <div class="calendar-grid">
  `;
  weekdays.forEach(day => {
    html += `<div class="calendar-weekday">${day}</div>`;
  });

  for (let i = 0; i < startBlank; i++) {
    html += `<div class="calendar-day blank"></div>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${historyMonth}-${pad2(day)}`;
    const hasRecord = dateSet.has(date);
    const active = date === selectedHistoryDate;
    const classes = [
      "calendar-day",
      hasRecord ? "has-record" : "",
      active ? "active" : ""
    ].filter(Boolean).join(" ");
    const action = hasRecord ? ` onclick="selectHistoryDate('${date}')"` : "";
    html += `<button class="${classes}"${action}>${day}</button>`;
  }

  html += `</div></div>`;
  div.innerHTML = html;
}

function setAnalysisRange(days) {
  analysisRange = days === 30 ? 30 : 7;
  renderAnalysis();
}

function getRangeDates(days) {
  const end = safeDate(todayStr());
  const start = new Date(end);
  start.setDate(end.getDate() - days + 1);
  return { start, end };
}

function getRecordsInRange(days) {
  const { start, end } = getRangeDates(days);
  return records.filter(r => {
    const d = safeDate(r.date);
    return d >= start && d <= end;
  });
}

function getTrainingDaysCount(list) {
  return new Set(list.map(r => r.date)).size;
}

function getMuscleCountsByDay(list) {
  const muscleToDates = {};
  list.forEach(r => {
    const m = r.muscle || r.bodyPart || "其他";
    if (!muscleToDates[m]) muscleToDates[m] = new Set();
    muscleToDates[m].add(r.date);
  });

  const counts = {};
  Object.keys(muscleToDates).forEach(m => {
    counts[m] = muscleToDates[m].size;
  });
  return counts;
}

function renderAnalysis() {
  const rangeRecords = getRecordsInRange(analysisRange);
  const counts = getMuscleCountsByDay(rangeRecords);

  document.getElementById("range7Btn")?.classList.toggle("active", analysisRange === 7);
  document.getElementById("range30Btn")?.classList.toggle("active", analysisRange === 30);

  const daysEl = document.getElementById("analysisDays");
  if (daysEl) daysEl.textContent = String(getTrainingDaysCount(rangeRecords));

  drawAnalysisBar(counts);
  renderAnalysisPr(rangeRecords);
  renderTrendSelect();
}

function drawAnalysisBar(map) {
  const canvas = document.getElementById("analysisBar");
  if (!canvas || !window.Chart) return;

  if (analysisChart) {
    analysisChart.destroy();
    analysisChart = null;
  }

  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
  const labels = entries.length ? entries.map(x => x[0]) : ["暂无"];
  const values = entries.length ? entries.map(x => x[1]) : [0];

  analysisChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: `近${analysisRange}天各部位训练次数`,
        data: values,
        backgroundColor: "#2E7CF6",
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      layout: {
        padding: { top: 28 }
      },
      plugins: {
        title: {
          display: true,
          text: `近${analysisRange}天各部位训练次数`
        },
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => `${ctx.raw} 次` }
        },
        datalabels: {
          color: "#111",
          anchor: "end",
          align: "end",
          offset: 2,
          formatter: v => (v ? `${v}` : "")
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          suggestedMax: getChartSuggestedMax(values),
          ticks: { stepSize: 1 }
        }
      }
    }
  });
}

function getPrList(list) {
  const best = {};
  list.forEach(r => {
    const key = `${r.muscle}__${r.exercise}`;
    const oneRm = estimate1RM(r);
    if (!best[key]) {
      best[key] = {
        muscle: r.muscle,
        exercise: r.exercise,
        weight: r.weight,
        reps: r.reps,
        sets: r.sets,
        date: r.date,
        estimated1RM: oneRm,
        maxWeight: r.weight,
        maxWeightDate: r.date
      };
      return;
    }

    if (oneRm > best[key].estimated1RM) {
      best[key].weight = r.weight;
      best[key].reps = r.reps;
      best[key].sets = r.sets;
      best[key].date = r.date;
      best[key].estimated1RM = oneRm;
    }

    if (r.weight > best[key].maxWeight) {
      best[key].maxWeight = r.weight;
      best[key].maxWeightDate = r.date;
    }
  });
  return Object.values(best).sort((a, b) => b.estimated1RM - a.estimated1RM);
}

function renderAnalysisPr(list) {
  const div = document.getElementById("analysisPrList");
  if (!div) return;

  const prs = getPrList(list).slice(0, 8);
  if (!prs.length) {
    div.innerHTML = `<div class="list"><div class="item"><div class="item-main">近${analysisRange}天暂无 PR 数据</div></div></div>`;
    return;
  }

  let html = `<div class="list">`;
  prs.forEach(pr => {
    html += `
      <div class="item">
        <div class="item-main">${escapeHTML(pr.exercise)} · ${formatNumber(pr.weight)}kg × ${formatNumber(pr.reps)}</div>
        <div class="item-meta">
          <span class="pill">${escapeHTML(pr.muscle)}</span>
          <span class="pill">1RM ${formatNumber(pr.estimated1RM)}kg</span>
          <span class="pill">${escapeHTML(pr.date)}</span>
        </div>
      </div>
    `;
  });
  html += `</div>`;
  div.innerHTML = html;
}

function renderTrendSelect() {
  const sel = document.getElementById("trendSelect");
  if (!sel) return;

  const prev = sel.value;
  const exs = getUniqueExercisesAll();
  sel.innerHTML = "";

  if (!exs.length) {
    const opt = document.createElement("option");
    opt.textContent = "暂无动作";
    sel.appendChild(opt);
    if (trendChart) {
      trendChart.destroy();
      trendChart = null;
    }
    return;
  }

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
  if (!sel || !canvas || !window.Chart) return;

  const ex = sel.value;
  const data = records
    .filter(r => r.exercise === ex)
    .sort((a, b) => `${a.date}-${a.id}`.localeCompare(`${b.date}-${b.id}`))
    .slice(-5);

  if (trendChart) {
    trendChart.destroy();
    trendChart = null;
  }
  if (!data.length) return;

  trendChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: data.map(d => d.date.slice(5)),
      datasets: [{
        label: `${ex} 最近5次重量`,
        data: data.map(d => d.weight),
        backgroundColor: "#2E7CF6",
        borderRadius: 8
      }]
    },
    options: {
      layout: {
        padding: { top: 28 }
      },
      plugins: {
        title: {
          display: true,
          text: `${ex} 最近5次重量`
        },
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => `${ctx.raw} kg` }
        },
        datalabels: {
          color: "#111",
          anchor: "end",
          align: "end",
          offset: 2,
          formatter: v => (v ? `${v}` : "")
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          suggestedMax: getChartSuggestedMax(data.map(d => d.weight)),
          ticks: { callback: v => `${v}` }
        }
      }
    }
  });
}

function renderMax() {
  const div = document.getElementById("maxList");
  if (!div) return;

  if (!records.length) {
    div.innerHTML = `<div class="list"><div class="item"><div class="item-main">暂无记录</div></div></div>`;
    return;
  }

  const prs = getPrList(records);
  const byMuscle = {};
  prs.forEach(pr => {
    if (!byMuscle[pr.muscle]) byMuscle[pr.muscle] = [];
    byMuscle[pr.muscle].push(pr);
  });

  let html = `<div class="list">`;
  Object.keys(byMuscle).sort((a, b) => a.localeCompare(b, "zh")).forEach(muscle => {
    html += `<div class="group-title">${escapeHTML(muscle)}</div>`;
    byMuscle[muscle]
      .sort((a, b) => b.estimated1RM - a.estimated1RM)
      .forEach(pr => {
        html += `
          <div class="item">
            <div class="item-main">${escapeHTML(pr.exercise)} · 最大 ${formatNumber(pr.maxWeight)}kg</div>
            <div class="item-sub">最佳 1RM ${formatNumber(pr.estimated1RM)}kg · ${escapeHTML(pr.date)} · ${formatNumber(pr.weight)}kg × ${formatNumber(pr.reps)}</div>
          </div>
        `;
      });
  });
  html += `</div>`;
  div.innerHTML = html;
}

function exportJSON() {
  const payload = {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    app: "fitness-log",
    workouts: buildWorkoutsExport(),
    records
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fitness-log-${todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importJSON(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = normalizeImportedData(JSON.parse(reader.result));
      if (!imported.length) {
        alert("没有识别到可导入的训练记录");
        return;
      }

      const merged = confirm("选择“确定”合并到当前数据；选择“取消”则用导入文件覆盖当前数据。");
      records = merged ? normalizeImportedData([...records, ...imported]) : imported;
      selectedHistoryDate = getLatestTrainingDate();
      save();
      renderAll();
      alert(`已导入 ${imported.length} 条记录`);
    } catch (error) {
      console.error(error);
      alert("JSON 文件格式不正确");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function renderAll() {
  updateExerciseOptions();
  renderToday();
  renderHistory();
  renderAnalysis();
  renderMax();
}

save();
renderAll();
