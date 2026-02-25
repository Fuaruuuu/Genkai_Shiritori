const INITIAL_TIME_MS = 5 * 60 * 1000;
const DRAW_OPTIONS = ["2", "3", "4", "5", "6", "7+"];

const appRoot = document.getElementById("app-root");
const timeEl1 = document.getElementById("player1-time");
const timeEl2 = document.getElementById("player2-time");
const player1LabelEl = document.getElementById("player1-label");
const player2LabelEl = document.getElementById("player2-label");
const card1 = document.getElementById("player1-card");
const card2 = document.getElementById("player2-card");
const timeSettingsSection = document.getElementById("time-settings");
const drawValueEl = document.getElementById("draw-value");
const statusEl = document.getElementById("status");
const startPauseBtn = document.getElementById("start-pause-btn");
const saidBtn = document.getElementById("said-btn");
const resetBtn = document.getElementById("reset-btn");
const player1MinutesInput = document.getElementById("player1-minutes");
const player2MinutesInput = document.getElementById("player2-minutes");
const timeSettingInputs = [player1MinutesInput, player2MinutesInput];
const optionButtons = Array.from(document.querySelectorAll(".option-btn"));

const OPTION_KEYS = ["n-mawashi", "reduce-count", "reset-number", "pass"];
const MIN_MINUTES = 1;
const MAX_MINUTES = 99;
const OPTION_LABELS = {
  "n-mawashi": "ん回し",
  "reduce-count": "文字数減らし",
  "reset-number": "数字リセット",
  pass: "パス",
};

let remainingMs = [INITIAL_TIME_MS, INITIAL_TIME_MS];
let activePlayer = 0;
let running = false;
let previousTick = null;
let animationFrameId = null;
let optionUsed = createInitialOptionUsage();
let hasGameStarted = false;
let configuredMinutes = [5, 5];

function createInitialOptionUsage() {
  return [0, 1].map(() =>
    OPTION_KEYS.reduce((result, key) => {
      result[key] = false;
      return result;
    }, {})
  );
}

function parseMinutes(inputEl) {
  const parsed = Number.parseInt(inputEl.value, 10);
  if (Number.isNaN(parsed)) {
    return null;
  }

  const clamped = Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, parsed));
  inputEl.value = String(clamped);
  return clamped;
}

function getConfiguredMinutes() {
  const player1Minutes = parseMinutes(player1MinutesInput);
  const player2Minutes = parseMinutes(player2MinutesInput);

  if (player1Minutes === null || player2Minutes === null) {
    return null;
  }

  return [player1Minutes, player2Minutes];
}

function applyConfiguredTimes() {
  const nextConfiguredMinutes = getConfiguredMinutes();
  if (nextConfiguredMinutes === null) {
    return false;
  }

  configuredMinutes = nextConfiguredMinutes;
  remainingMs = configuredMinutes.map((minutes) => minutes * 60 * 1000);
  return true;
}

function setTimeInputsDisabled(disabled) {
  timeSettingInputs.forEach((inputEl) => {
    inputEl.disabled = disabled;
  });
}

function setTimeSettingsVisible(visible) {
  if (!timeSettingsSection) {
    return;
  }
  timeSettingsSection.hidden = !visible;
  timeSettingsSection.classList.toggle("is-hidden", !visible);
  if (appRoot) {
    appRoot.classList.toggle("game-started", !visible);
  }
}

function formatTime(ms) {
  const clamped = Math.max(ms, 0);
  const totalSeconds = Math.floor(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function updateView() {
  setTimeSettingsVisible(!hasGameStarted);
  timeEl1.textContent = formatTime(remainingMs[0]);
  timeEl2.textContent = formatTime(remainingMs[1]);

  card1.classList.toggle("active", activePlayer === 0);
  card2.classList.toggle("active", activePlayer === 1);
  updatePlayerLabels();
  updateOptionButtons();

  if (!running && remainingMs[0] > 0 && remainingMs[1] > 0) {
    if (hasGameStarted) {
      statusEl.textContent = `プレイヤー${activePlayer + 1}の手番です。`;
    } else {
      statusEl.textContent = `プレイヤー${activePlayer + 1}から開始できます。`;
    }
  }
}

function updatePlayerLabels() {
  if (hasGameStarted) {
    player1LabelEl.textContent = `プレイヤー1（開始時間：${configuredMinutes[0]}分）`;
    player2LabelEl.textContent = `プレイヤー2（開始時間：${configuredMinutes[1]}分）`;
    return;
  }

  player1LabelEl.textContent = "プレイヤー1";
  player2LabelEl.textContent = "プレイヤー2";
}

function updateOptionButtons() {
  const isGameOver = remainingMs[0] <= 0 || remainingMs[1] <= 0;

  optionButtons.forEach((button) => {
    const player = Number(button.dataset.player);
    const optionKey = button.dataset.option;
    const isUsed = optionUsed[player][optionKey];
    button.disabled = !hasGameStarted || isGameOver || isUsed || player !== activePlayer;
    button.classList.toggle("used", isUsed);
  });
}

function switchActivePlayer() {
  activePlayer = activePlayer === 0 ? 1 : 0;
}

function reduceDrawValue() {
  if (drawValueEl.textContent === "-") {
    drawValueEl.textContent = randomDraw();
  }

  const currentText = drawValueEl.textContent.trim();
  const currentValue =
    currentText === "7+" ? 7 : Number.parseInt(currentText, 10);

  if (Number.isNaN(currentValue)) {
    drawValueEl.textContent = "2";
    return;
  }

  drawValueEl.textContent = String(Math.max(1, currentValue - 1));
}

function useOption(optionKey) {
  if (!OPTION_KEYS.includes(optionKey)) {
    return;
  }
  if (remainingMs[0] <= 0 || remainingMs[1] <= 0) {
    return;
  }
  if (optionUsed[activePlayer][optionKey]) {
    return;
  }

  const currentPlayer = activePlayer;
  optionUsed[currentPlayer][optionKey] = true;

  if (optionKey === "reduce-count") {
    reduceDrawValue();
  } else if (optionKey === "reset-number") {
    drawValueEl.textContent = randomDraw();
  }

  let nextStatus = "";
  if (optionKey !== "reset-number") {
    switchActivePlayer();
    nextStatus = `プレイヤー${currentPlayer + 1}が${OPTION_LABELS[optionKey]}を使用。プレイヤー${activePlayer + 1}の手番です。`;
  } else {
    nextStatus = `プレイヤー${currentPlayer + 1}が${OPTION_LABELS[optionKey]}を使用。手番はそのままです。`;
  }

  updateView();
  statusEl.textContent = nextStatus;
}

function stopTimer() {
  running = false;
  previousTick = null;
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  startPauseBtn.textContent = "開始";
}

function handleTimeOver(playerIndex) {
  stopTimer();
  remainingMs[playerIndex] = 0;
  updateView();
  const winner = playerIndex === 0 ? 2 : 1;
  statusEl.textContent = `プレイヤー${playerIndex + 1}の時間切れ。プレイヤー${winner}の勝ち！`;
}

function tick(timestamp) {
  if (!running) {
    return;
  }

  if (previousTick === null) {
    previousTick = timestamp;
  }

  const elapsed = timestamp - previousTick;
  previousTick = timestamp;

  remainingMs[activePlayer] -= elapsed;

  if (remainingMs[activePlayer] <= 0) {
    handleTimeOver(activePlayer);
    return;
  }

  updateView();
  animationFrameId = requestAnimationFrame(tick);
}

function startTimer() {
  if (remainingMs[0] <= 0 || remainingMs[1] <= 0) {
    return;
  }
  running = true;
  previousTick = null;
  startPauseBtn.textContent = "一時停止";
  animationFrameId = requestAnimationFrame(tick);
}

function randomDraw() {
  const index = Math.floor(Math.random() * DRAW_OPTIONS.length);
  return DRAW_OPTIONS[index];
}

startPauseBtn.addEventListener("click", () => {
  if (running) {
    stopTimer();
    statusEl.textContent = "一時停止中。再開できます。";
    return;
  }

  if (!hasGameStarted) {
    if (!applyConfiguredTimes()) {
      statusEl.textContent = "開始時間を正しく入力してください。";
      return;
    }

    hasGameStarted = true;
    setTimeInputsDisabled(true);
    setTimeSettingsVisible(false);
    updateView();
  }

  if (drawValueEl.textContent === "-") {
    drawValueEl.textContent = randomDraw();
  }

  startTimer();
  if (running) {
    statusEl.textContent = `プレイヤー${activePlayer + 1}の時間が進行中。`;
  }
});

saidBtn.addEventListener("click", () => {
  if (remainingMs[0] <= 0 || remainingMs[1] <= 0) {
    return;
  }

  drawValueEl.textContent = randomDraw();
  switchActivePlayer();
  statusEl.textContent = `プレイヤー${activePlayer + 1}の手番です。`;
  updateView();
});

optionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const player = Number(button.dataset.player);
    if (player !== activePlayer) {
      return;
    }
    useOption(button.dataset.option || "");
  });
});

timeSettingInputs.forEach((inputEl) => {
  inputEl.addEventListener("change", () => {
    if (hasGameStarted || running) {
      return;
    }

    if (!applyConfiguredTimes()) {
      statusEl.textContent = "開始時間を正しく入力してください。";
      return;
    }

    updateView();
  });
});

resetBtn.addEventListener("click", () => {
  stopTimer();
  hasGameStarted = false;
  activePlayer = 0;
  optionUsed = createInitialOptionUsage();
  setTimeInputsDisabled(false);
  setTimeSettingsVisible(true);
  if (!applyConfiguredTimes()) {
    remainingMs = [INITIAL_TIME_MS, INITIAL_TIME_MS];
  }
  drawValueEl.textContent = "-";
  statusEl.textContent = "プレイヤー1から開始できます。";
  updateView();
});

applyConfiguredTimes();
setTimeInputsDisabled(false);
setTimeSettingsVisible(true);
updateView();
