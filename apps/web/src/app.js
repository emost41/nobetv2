const STORAGE_KEY = "hadicoz_progress_v1";
const SESSION_TARGET = 10;

const el = {
  topic: document.getElementById("topic"),
  stem: document.getElementById("stem"),
  options: document.getElementById("options"),
  status: document.getElementById("status"),
  sheet: document.getElementById("explainSheet"),
  explain: document.getElementById("explainText"),
  source: document.getElementById("sourceText"),
  solved: document.getElementById("solvedCount"),
  correct: document.getElementById("correctCount"),
  review: document.getElementById("reviewCount"),
  nextBtn: document.getElementById("nextBtn"),
  card: document.getElementById("card"),
  progressBar: document.getElementById("progressBar"),
  sessionLabel: document.getElementById("sessionLabel"),
  summary: document.getElementById("summary"),
  summaryText: document.getElementById("summaryText"),
  restartBtn: document.getElementById("restartBtn"),
  confidenceWrap: document.getElementById("confidenceWrap"),
  confidentBtn: document.getElementById("confidentBtn"),
  unsureBtn: document.getElementById("unsureBtn")
};

const state = {
  questions: [],
  queue: [],
  index: 0,
  solved: 0,
  correct: 0,
  review: 0,
  answered: false,
  confidence: null,
  touchStartX: 0,
  touchStartY: 0,
  touchEndX: 0,
  touchEndY: 0
};

function updateStats() {
  el.solved.textContent = String(state.solved);
  el.correct.textContent = String(state.correct);
  el.review.textContent = String(state.review);
  el.sessionLabel.textContent = `${Math.min(state.solved, SESSION_TARGET)} / ${SESSION_TARGET}`;
  const progress = Math.min((state.solved / SESSION_TARGET) * 100, 100);
  el.progressBar.style.width = `${progress}%`;
}

function saveProgress() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      solved: state.solved,
      correct: state.correct,
      review: state.review,
      queue: state.queue
    })
  );
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw);
    state.solved = Number(parsed.solved ?? 0);
    state.correct = Number(parsed.correct ?? 0);
    state.review = Number(parsed.review ?? 0);
    state.queue = Array.isArray(parsed.queue) ? parsed.queue : [];
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function getCurrentQuestion() {
  return state.questions[state.index % state.questions.length];
}

function resetVisualState() {
  state.answered = false;
  state.confidence = null;
  el.status.textContent = "";
  el.sheet.classList.remove("open");
  el.sheet.setAttribute("aria-hidden", "true");
  el.confidenceWrap.hidden = true;
  el.confidentBtn.disabled = false;
  el.unsureBtn.disabled = false;
}

function renderQuestion() {
  const q = getCurrentQuestion();
  resetVisualState();

  el.topic.textContent = q.topic;
  el.stem.textContent = q.stem;
  el.explain.textContent = q.explanation_short;
  el.source.textContent = `Kaynak: ${q.source}`;

  el.options.innerHTML = "";
  Object.entries(q.options).forEach(([key, value]) => {
    const btn = document.createElement("button");
    btn.className = "option";
    btn.type = "button";
    btn.dataset.key = key;
    btn.textContent = `${key}) ${value}`;
    btn.addEventListener("click", () => selectOption(btn, key));
    el.options.appendChild(btn);
  });
}

function markForReview(questionId, priority) {
  state.queue.push({ questionId, priority, at: Date.now() });
  state.review += 1;
}

function lockConfidence() {
  el.confidentBtn.disabled = true;
  el.unsureBtn.disabled = true;
}

function setConfidence(type) {
  if (!state.answered || state.confidence) {
    return;
  }
  state.confidence = type;
  const q = getCurrentQuestion();

  if (type === "unsure") {
    markForReview(q.question_id, "medium");
    el.status.textContent = "↩️ Emin değilim kaydedildi. Soru tekrar kuyruğuna eklendi.";
  } else {
    el.status.textContent = "✅ Eminim kaydedildi.";
  }

  lockConfidence();
  updateStats();
  saveProgress();
}

function selectOption(selectedBtn, selectedKey) {
  if (state.answered) {
    return;
  }

  const q = getCurrentQuestion();
  state.answered = true;
  state.solved += 1;

  const buttons = [...document.querySelectorAll(".option")];
  buttons.forEach((btn) => {
    btn.classList.remove("selected");
    if (btn.dataset.key === q.correct_option) {
      btn.classList.add("correct");
    }
  });

  selectedBtn.classList.add("selected");

  if (selectedKey === q.correct_option) {
    state.correct += 1;
    el.status.textContent = "✅ Doğru. Eminlik için sağ/sol swipe yap veya butonu kullan.";
  } else {
    selectedBtn.classList.add("wrong");
    markForReview(q.question_id, "high");
    el.status.textContent = `❌ Yanlış. Doğru cevap: ${q.correct_option}. Açıklama için yukarı kaydır.`;
  }

  el.confidenceWrap.hidden = false;
  updateStats();
  saveProgress();
  checkSessionComplete();
}

function openExplanation() {
  if (!state.answered) {
    el.status.textContent = "Önce bir şık seç, sonra açıklama için yukarı kaydır.";
    return;
  }

  el.sheet.classList.add("open");
  el.sheet.setAttribute("aria-hidden", "false");
}

function evaluateSwipe() {
  const deltaX = state.touchEndX - state.touchStartX;
  const deltaY = state.touchEndY - state.touchStartY;
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  if (absY > absX && deltaY < -45) {
    openExplanation();
    return;
  }

  if (absX > absY && absX > 45 && state.answered) {
    if (deltaX > 0) {
      setConfidence("confident");
    } else {
      setConfidence("unsure");
    }
  }
}

function checkSessionComplete() {
  if (state.solved < SESSION_TARGET) {
    return;
  }

  el.summary.hidden = false;
  el.summaryText.textContent = `Bu oturumda ${state.solved} soru çözdün, ${state.correct} doğru yaptın. Tekrar kuyruğunda ${state.review} kayıt var.`;
}

function moveNext() {
  state.index = (state.index + 1) % state.questions.length;
  renderQuestion();
}

function restartSession() {
  state.index = 0;
  state.solved = 0;
  state.correct = 0;
  state.review = 0;
  state.queue = [];
  el.summary.hidden = true;
  updateStats();
  saveProgress();
  renderQuestion();
}

el.card.addEventListener("touchstart", (e) => {
  const t = e.changedTouches[0];
  state.touchStartX = t.screenX;
  state.touchStartY = t.screenY;
});

el.card.addEventListener("touchend", (e) => {
  const t = e.changedTouches[0];
  state.touchEndX = t.screenX;
  state.touchEndY = t.screenY;
  evaluateSwipe();
});

let mouseDown = false;
el.card.addEventListener("mousedown", (e) => {
  mouseDown = true;
  state.touchStartX = e.screenX;
  state.touchStartY = e.screenY;
});

el.card.addEventListener("mouseup", (e) => {
  if (!mouseDown) {
    return;
  }
  mouseDown = false;
  state.touchEndX = e.screenX;
  state.touchEndY = e.screenY;
  evaluateSwipe();
});

el.nextBtn.addEventListener("click", moveNext);
el.restartBtn.addEventListener("click", restartSession);
el.confidentBtn.addEventListener("click", () => setConfidence("confident"));
el.unsureBtn.addEventListener("click", () => setConfidence("unsure"));

async function init() {
  const response = await fetch("./data/questions.json");
  state.questions = await response.json();
  loadProgress();
  updateStats();
  renderQuestion();
  checkSessionComplete();
}

init();
