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
  card: document.getElementById("card")
};

const state = {
  questions: [],
  index: 0,
  solved: 0,
  correct: 0,
  review: 0,
  answered: false,
  touchStartX: 0,
  touchStartY: 0,
  touchEndX: 0,
  touchEndY: 0
};

function updateStats() {
  el.solved.textContent = String(state.solved);
  el.correct.textContent = String(state.correct);
  el.review.textContent = String(state.review);
}

function getCurrentQuestion() {
  return state.questions[state.index % state.questions.length];
}

function renderQuestion() {
  const q = getCurrentQuestion();
  state.answered = false;
  el.status.textContent = "";
  el.sheet.classList.remove("open");
  el.sheet.setAttribute("aria-hidden", "true");

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
    el.status.textContent = "✅ Doğru. Açıklamayı görmek için yukarı kaydır.";
  } else {
    state.review += 1;
    selectedBtn.classList.add("wrong");
    el.status.textContent = `❌ Yanlış. Doğru cevap: ${q.correct_option}. Açıklama için yukarı kaydır.`;
  }

  updateStats();
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

  if (absX > absY && absX > 45) {
    if (deltaX > 0) {
      el.status.textContent = "➡️ Sağ swipe: Doğru / Eminim işaretlendi (MVP notu).";
    } else {
      state.review += 1;
      updateStats();
      el.status.textContent = "⬅️ Sol swipe: Yanlış / Emin değilim işaretlendi.";
    }
  }
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

el.nextBtn.addEventListener("click", () => {
  state.index = (state.index + 1) % state.questions.length;
  renderQuestion();
});

async function init() {
  const response = await fetch("./data/questions.json");
  state.questions = await response.json();
  updateStats();
  renderQuestion();
}

init();
