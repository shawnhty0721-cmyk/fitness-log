// ==========================================
// Fitness Log 2.0 - app.js (Charts + nicer typography)
// 结构：按“训练日”保存，每天包含多个动作条目
// Tabs：记录 / 分析 / 历史
// ==========================================

const STORAGE_KEY = "fitness_days_v2";
const SETTINGS_KEY = "fitness_settings_v2";

let days = loadDays();
let settings = loadSettings(); // { weeklyGoal: number }

function loadDays() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    return raw.map(d => ({
      id: d.id || Date.now() + Math.floor(Math.random() * 1000),
      date: d.date, // "YYYY-MM-DD"
      entries: Array.isArray(d.entries) ? d.entries : []
    })).filter(d => !!d.date);
  } catch {
    return [];
  }
}

function saveDays() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(days));
}

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
    return { weeklyGoal: Number(s.weeklyGoal) || 5 };
  } catch {
    return { weeklyGoal: 5 };
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function todayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatYMD(ymd) {
  try {
    const d = new Date(ymd + "T00:00:00");
    return d.toLocaleDateString();
  } catch {
    return ymd;
  }
}

function calculate1RM(weight, reps) {
  return (weight * (1 + reps / 30)).toFixed(1);
}

function startOfWeekMonday(d = new Date()) {
  const date = new Date(d);
  const day = date.getDay(); // 0..6
  const diff = (day === 0 ? -6 : 1 - day); // Monday start
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function inLastNDays(ymd, n) {
  const d = new Date(ymd + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - (n - 1));
  return d >= cutoff && d <= today;
}

function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[s]));
}

// --- Sparkline (SVG) ---
function sparklineSVG(values, width = 160, height = 44, pad = 4) {
  const vs = values.map(Number).filter(v => !Number.isNaN(v));
  if (vs.length < 2) {
    // placeholder
    return `
      <svg class="spark" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
        <line class="spark-grid" x1="0" y1="${height-1}" x2="${width}" y2="${height-1}" />
        <line class="spark-grid" x1="0" y1="1" x2="${width}" y2="1" />
      </svg>
    `;
  }

  const minV = Math.min(...vs);
  const maxV = Math.max(...vs);
  const span = Math.max(0.0001, maxV - minV);

  const xStep = (width - pad * 2) / (vs.length - 1);

  const pts = vs.map((v, i) => {
    const x = pad + i * xStep;
    const norm = (v - minV) / span;        // 0..1
    const y = pad + (1 - norm) * (height - pad * 2);
    return { x, y };
  });

  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
  const last = pts[pts.length - 1];

  return `
    <svg class="spark" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      <line class="spark-grid" x1="0" y1="${height-1}" x2="${width}" y2="${height-1}" />
      <line class="spark-grid" x1="0" y1="1" x2="${width}" y2="1" />
      <path class="spark-line" d="${d}" />
      <circle class="spark-dot" cx="${last.x.toFixed(2)}" cy="${last.y.toFixed(2)}" r="2.6" />
    </svg>
  `;
}

function switchTab(name) {
  const tabs = ["record", "analytics", "history"];
  tabs.forEach(t => {
    document.getElementById(`tab-${t}`).classList.toggle("hidden", t !== name);
    document.getElementById(`nav-${t}`).classList.toggle("active", t === name);
  });
  renderAll();
}

function saveWeeklyGoal() {
  const goalEl = document.getElementById("weeklyGoal");
  const val = Number(goalEl.value);
  settings.weeklyGoal = clamp(val || 5, 1, 14);
  saveSettings();
  renderAll();
  alert("周目标已保存");
}

function ensureDom() {
  const required = [
    "recordDate", "weeklyGoal", "muscle", "exercise", "exerciseList",
    "weight", "reps", "sets",
    "todayPreview",
    "mWeekDays", "mLast7", "mLast30", "mGoalText", "mGoalFill",
    "muscleBars", "trendList",
    "historyList"
  ];
  const missing = required.filter(id => !document.getElementById(id));
  if (missing.length) {
    console.warn("缺少页面元素：", missing);
    return false;
  }
  return true;
}

function addEntry() {
  if (!ensureDom()) return;

  const dateEl = document.getElementById("recordDate");
  const muscleEl = document.getElementById("muscle");
  const exerciseEl = document.getElementById("exercise");
  const weightEl = document.getElementById("weight");
  const repsEl = document.getElementById("reps");
  const setsEl = document.getElementById("sets");

  const date = (dateEl.value || todayYMD()).trim();
  const muscle = muscleEl.value;
  const exercise = exerciseEl.value.trim();
  const weight = Number(weightEl.value);
  const reps = Number(repsEl.value);
  const sets = Number(setsEl.value);

  if (!date || !exercise || !weight || !reps || !sets) {
    alert("请填写完整（日期/动作/重量/次数/组数）");
    return;
  }

  let day = days.find(d => d.date === date);
  if (!day) {
    day = { id: Date.now(), date, entries: [] };
    days.push(day);
    days.sort((a, b) => b.date.localeCompare(a.date));
  }

  day.entries.push({
    id: Date.now() + Math.floor(Math.random() * 1000),
    muscle,
    exercise,
    weight,
    reps,
    sets,
    createdAt: new Date().toISOString()
  });

  saveDays();

  // 清空输入（保留日期/部位）
  exerciseEl.value = "";
  weightEl.value = "";
  repsEl.value = "";
  setsEl.value = "";

  renderAll();
}

function deleteEntry(dayId, entryId) {
  const day = days.find(d => d.id === dayId);
  if (!day) return;
  day.entries = day.entries.filter(e => e.id !== entryId);
  if (day.entries.length === 0) {
    days = days.filter(d => d.id !== dayId);
  }
  saveDays();
  renderAll();
}

function deleteDay(dayId) {
  if (!confirm("确定删除该训练日所有记录？")) return;
  days = days.filter(d => d.id !== dayId);
  saveDays();
  renderAll();
}

function exportAll() {
  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    settings,
    days
  };
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "fitness-data-v2.json";
  a.click();
}

function importAll(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const payload = JSON.parse(e.target.result);
      if (!payload || !Array.isArray(payload.days)) {
        alert("导入失败：格式不正确");
        return;
      }
      days = payload.days.map(d => ({
        id: d.id || Date.now() + Math.floor(Math.random() * 1000),
        date: d.date,
        entries: Array.isArray(d.entries) ? d.entries : []
      })).filter(d => !!d.date);

      settings = { weeklyGoal: Number(payload.settings?.weeklyGoal) || 5 };

      saveDays();
      saveSettings();
      renderAll();
      alert("导入成功！");
    } catch {
      alert("导入失败：JSON 解析错误");
    }
  };
  reader.readAsText(file);
}

function buildExerciseSet() {
  const set = new Set();
  days.forEach(d => d.entries.forEach(e => set.add(e.exercise)));
  return [...set].filter(Boolean).sort((a, b) => a.localeCompare(b, "zh"));
}

function flattenEntries() {
  const all = [];
  days.forEach(d => {
    d.entries.forEach(e => all.push({ date: d.date, ...e }));
  });
  all.sort((a, b) => a.date.localeCompare(b.date));
  return all;
}

function renderRecordTab() {
  const dateEl = document.getElementById("recordDate");
  const goalEl = document.getElementById("weeklyGoal");

  if (!dateEl.value) dateEl.value = todayYMD();
  goalEl.value = settings.weeklyGoal;

  // datalist
  const exerciseList = document.getElementById("exerciseList");
  const exercises = buildExerciseSet();
  exerciseList.innerHTML = "";
  exercises.forEach(ex => {
    const opt = document.createElement("option");
    opt.value = ex;
    exerciseList.appendChild(opt);
  });

  // 今日预览：按 recordDate 预览
  const previewDate = dateEl.value || todayYMD();
  const day = days.find(d => d.date === previewDate);
  const preview = document.getElementById("todayPreview");
  preview.innerHTML = "";

  if (!day || day.entries.length === 0) {
    preview.innerHTML = `<div class="item muted">暂无记录</div>`;
    return;
  }

  day.entries.slice().reverse().forEach(e => {
    const est1RM = calculate1RM(e.weight, e.reps);
    preview.innerHTML += `
      <div class="item">
        <div class="item-title">【${escapeHtml(e.muscle)}】${escapeHtml(e.exercise)}</div>
        <div class="textblock">
          <strong>${e.weight}kg</strong> × ${e.reps} × ${e.sets}
          <span class="muted"> · 估算1RM <strong>${est1RM}kg</strong></span>
        </div>
        <div class="kv" style="margin-top:8px;">
          <span class="pill">${escapeHtml(formatYMD(previewDate))}</span>
          <span class="pill">${escapeHtml(e.muscle)}</span>
        </div>
      </div>
    `;
  });
}

function renderAnalyticsTab() {
  const mWeekDays = document.getElementById("mWeekDays");
  const mLast7 = document.getElementById("mLast7");
  const mLast30 = document.getElementById("mLast30");
  const mGoalText = document.getElementById("mGoalText");
  const mGoalFill = document.getElementById("mGoalFill");
  const muscleBars = document.getElementById("muscleBars");
  const trendList = document.getElementById("trendList");

  const validDays = days.filter(d => d.entries && d.entries.length > 0);

  // 本周（周一开始）
  const sow = startOfWeekMonday(new Date());
  const weekCount = validDays.filter(d => new Date(d.date + "T00:00:00") >= sow).length;

  const last7Count = validDays.filter(d => inLastNDays(d.date, 7)).length;
  const last30Count = validDays.filter(d => inLastNDays(d.date, 30)).length;

  mWeekDays.textContent = String(weekCount);
  mLast7.textContent = String(last7Count);
  mLast30.textContent = String(last30Count);

  const goal = settings.weeklyGoal || 5;
  mGoalText.textContent = `${weekCount} / ${goal}`;
  const pct = Math.min(100, Math.round((weekCount / goal) * 100));
  mGoalFill.style.width = `${pct}%`;

  // 近30天部位覆盖：按条目数
  const muscles = ["胸", "背", "腿", "肩", "手臂", "核心", "其他"];
  const counts = Object.fromEntries(muscles.map(m => [m, 0]));
  validDays.forEach(d => {
    if (!inLastNDays(d.date, 30)) return;
    d.entries.forEach(e => {
      const m = muscles.includes(e.muscle) ? e.muscle : "其他";
      counts[m] += 1;
    });
  });

  const maxCount = Math.max(1, ...muscles.map(m => counts[m]));
  muscleBars.innerHTML = "";
  muscles.forEach(m => {
    const c = counts[m];
    const w = Math.round((c / maxCount) * 100);
    muscleBars.innerHTML += `
      <div class="bar-row">
        <div><strong>${escapeHtml(m)}</strong></div>
        <div class="bar-bg"><div class="bar-fill" style="width:${w}%"></div></div>
        <div class="muted" style="text-align:right">${c}</div>
      </div>
    `;
  });

  // 趋势：每个动作做 sparkline + 文案（去掉箭头）
  const entries = flattenEntries();
  const byExercise = new Map();
  entries.forEach(e => {
    if (!byExercise.has(e.exercise)) byExercise.set(e.exercise, []);
    byExercise.get(e.exercise).push(e);
  });

  const avg = (xs) => xs.length ? xs.reduce((a,b)=>a+b,0) / xs.length : 0;

  const items = [];
  for (const [exercise, arr] of byExercise.entries()) {
    const weights = arr.map(x => Number(x.weight)).filter(n => !Number.isNaN(n));
    const pr = weights.length ? Math.max(...weights) : 0;

    const last5 = weights.slice(-5);
    const prev5 = weights.slice(-10, -5);

    const aLast = avg(last5);
    const aPrev = avg(prev5);

    // delta：用于颜色 pill（更直观）
    let delta = null;
    if (prev5.length >= 3) delta = aLast - aPrev;

    const latest = arr[arr.length - 1];
    const latest1RM = calculate1RM(latest.weight, latest.reps);

    // sparkline 取最近 12 次更直观
    const sparkValues = weights.slice(-12);

    items.push({
      exercise,
      pr,
      aLast,
      aPrev,
      delta,
      latestDate: latest.date,
      latestLine: `${latest.weight}kg × ${latest.reps} × ${latest.sets}`,
      latest1RM,
      sparkValues
    });
  }

  // 排序：最近训练靠前
  items.sort((x, y) => y.latestDate.localeCompare(x.latestDate));

  trendList.innerHTML = "";
  if (items.length === 0) {
    trendList.innerHTML = `<div class="item muted">暂无数据</div>`;
    return;
  }

  items.forEach(it => {
    const deltaPill = (() => {
      if (it.delta === null) return `<span class="pill">样本不足</span>`;
      const sign = it.delta >= 0 ? "+" : "";
      const txt = `${sign}${it.delta.toFixed(1)}kg`;
      if (it.delta >= 1) return `<span class="pill pill-green">近5次较前5次 ${txt}</span>`;
      if (it.delta <= -1) return `<span class="pill pill-red">近5次较前5次 ${txt}</span>`;
      return `<span class="pill">近5次较前5次 ${txt}</span>`;
    })();

    const avgText = (it.aPrev > 0)
      ? `最近5次均重 <code>${it.aLast.toFixed(1)}kg</code> · 之前5次均重 <code>${it.aPrev.toFixed(1)}kg</code>`
      : `最近5次均重 <code>${it.aLast.toFixed(1)}kg</code>`;

    trendList.innerHTML += `
      <div class="trend-card">
        <div class="trend-head">
          <div>
            <div class="trend-title">${escapeHtml(it.exercise)}</div>
            <div class="kv">
              <span class="pill pill-blue">PR ${it.pr}kg</span>
              ${deltaPill}
            </div>
          </div>
          <span class="pill">${escapeHtml(formatYMD(it.latestDate))}</span>
        </div>

        <div class="spark-wrap">
          ${sparklineSVG(it.sparkValues)}
        </div>

        <div class="trend-meta">
          最近：<code>${escapeHtml(it.latestLine)}</code> · 估算1RM <code>${escapeHtml(it.latest1RM)}kg</code>
        </div>
        <div class="trend-sub">${avgText}</div>
      </div>
    `;
  });
}

function renderHistoryTab() {
  const historyList = document.getElementById("historyList");
  historyList.innerHTML = "";

  const validDays = days
    .filter(d => d.entries && d.entries.length > 0)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));

  if (validDays.length === 0) {
    historyList.innerHTML = `<div class="item muted">暂无历史记录</div>`;
    return;
  }

  validDays.forEach(d => {
    const muscles = [...new Set(d.entries.map(e => e.muscle))].join(" / ");
    const count = d.entries.length;

    let entriesHtml = "";
    d.entries.slice().reverse().forEach(e => {
      const est1RM = calculate1RM(e.weight, e.reps);
      entriesHtml += `
        <div class="item" style="margin-top:10px;">
          <div class="item-title">【${escapeHtml(e.muscle)}】${escapeHtml(e.exercise)}</div>
          <div class="textblock">
            <strong>${e.weight}kg</strong> × ${e.reps} × ${e.sets}
            <span class="muted"> · 估算1RM <strong>${est1RM}kg</strong></span>
          </div>
          <div class="actions">
            <button class="small-btn small-btn-danger" onclick="deleteEntry(${d.id}, ${e.id})">删除该条</button>
          </div>
        </div>
      `;
    });

    historyList.innerHTML += `
      <div class="item">
        <div class="item-title">${escapeHtml(formatYMD(d.date))}</div>
        <div class="textblock">
          <span class="muted">部位：</span><strong>${escapeHtml(muscles || "未标注部位")}</strong>
          <span class="muted"> · 条目：</span><strong>${count}</strong>
        </div>

        <div class="actions">
          <button class="small-btn" onclick="toggleDay(${d.id})">展开/收起</button>
          <button class="small-btn small-btn-danger" onclick="deleteDay(${d.id})">删除当天</button>
        </div>

        <div id="day-${d.id}" class="hidden">
          ${entriesHtml}
        </div>
      </div>
    `;
  });
}

function toggleDay(dayId) {
  const el = document.getElementById(`day-${dayId}`);
  if (!el) return;
  el.classList.toggle("hidden");
}

function renderAll() {
  if (!ensureDom()) return;
  renderRecordTab();
  renderAnalyticsTab();
  renderHistoryTab();
}

// 暴露给 HTML onclick
window.switchTab = switchTab;
window.addEntry = addEntry;
window.deleteEntry = deleteEntry;
window.deleteDay = deleteDay;
window.toggleDay = toggleDay;
window.exportAll = exportAll;
window.importAll = importAll;
window.saveWeeklyGoal = saveWeeklyGoal;

document.addEventListener("DOMContentLoaded", () => {
  if (!ensureDom()) return;
  document.getElementById("recordDate").value = todayYMD();
  document.getElementById("weeklyGoal").value = settings.weeklyGoal;
  renderAll();
  switchTab("record");
});