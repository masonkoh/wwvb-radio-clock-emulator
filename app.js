const MARKER = "marker";
const LOW_GAIN = 0.12;
const HIGH_GAIN = 0.92;
const MONITOR_GAIN = 0.03;
const MONITOR_GLIDE_SECONDS = 0.04;
const RAMP_SECONDS = 0.005;
const SCHEDULE_AHEAD_SECONDS = 12;
const DAY_MS = 24 * 60 * 60 * 1000;
const TRANSITION_SCAN_DAYS = 370;
const MARKER_SECONDS = new Set([0, 9, 19, 29, 39, 49, 59]);

const BIT_WIDTH_SECONDS = {
  0: 0.2,
  1: 0.5,
  [MARKER]: 0.8,
};

const BIT_LABELS = {
  0: "0",
  1: "1",
  [MARKER]: "Marker",
};

const MONITOR_BEEP_TONE = { frequency: 698.46, label: "F5" };

const dom = {
  startButton: document.querySelector("#startButton"),
  stopButton: document.querySelector("#stopButton"),
  monitorToggle: document.querySelector("#monitorToggle"),
  statusBadge: document.querySelector("#statusBadge"),
  localTimeValue: document.querySelector("#localTimeValue"),
  frameTimeValue: document.querySelector("#frameTimeValue"),
  currentBitValue: document.querySelector("#currentBitValue"),
  pulseWidthValue: document.querySelector("#pulseWidthValue"),
  audioEngineValue: document.querySelector("#audioEngineValue"),
  monitorStatusValue: document.querySelector("#monitorStatusValue"),
  monitorStatusMeta: document.querySelector("#monitorStatusMeta"),
  graphStatusLabel: document.querySelector("#graphStatusLabel"),
  waveformCanvas: document.querySelector("#waveformCanvas"),
  envelopeCanvas: document.querySelector("#envelopeCanvas"),
  frameGrid: document.querySelector("#frameGrid"),
  frameMinuteLabel: document.querySelector("#frameMinuteLabel"),
};

let audioContext = null;
let oscillatorNode = null;
let gainNode = null;
let monitorOscillatorNode = null;
let monitorGainNode = null;
let isTransmitting = false;
let isMonitorEnabled = false;
let schedulerFrameId = null;
let uiFrameId = null;
let scheduledThroughSecondMs = null;
let wallToAudioOffsetSeconds = 0;
let activeFrameKey = "";
let activeFrame = [];
let frameCells = [];
let waveformCtx = null;
let envelopeCtx = null;
const dstTransitionCache = new Map();

dom.startButton.addEventListener("click", startTransmit);
dom.stopButton.addEventListener("click", stopTransmit);
dom.monitorToggle.addEventListener("change", handleMonitorToggle);
window.addEventListener("resize", resizeGraphCanvases);

renderFrame(Array.from({ length: 60 }, (_, index) => (MARKER_SECONDS.has(index) ? MARKER : 0)));
setupGraphContexts();
startUiLoop();
updateMonitorStatus();

function floorToMinute(date) {
  return new Date(date.getTime() - date.getUTCSeconds() * 1000 - date.getUTCMilliseconds());
}

function getUtcDayKey(date) {
  return date.toISOString().slice(0, 10);
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function getDayOfYearUtc(date) {
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  return Math.floor((date.getTime() - yearStart) / DAY_MS) + 1;
}

function applyWeightedBits(frame, positions, value, weights) {
  positions.forEach((position, index) => {
    frame[position] = value >= weights[index] ? 1 : 0;
    if (frame[position] === 1) {
      value -= weights[index];
    }
  });
}

function buildWwvbFrame(date) {
  const frameStart = floorToMinute(date);
  const frame = Array(60).fill(0);

  MARKER_SECONDS.forEach((second) => {
    frame[second] = MARKER;
  });

  const minute = frameStart.getUTCMinutes();
  const hour = frameStart.getUTCHours();
  const dayOfYear = getDayOfYearUtc(frameStart);
  const year = frameStart.getUTCFullYear() % 100;
  const dstBits = computeDstBits(frameStart);

  applyWeightedBits(frame, [1, 2, 3], Math.floor(minute / 10) * 10, [40, 20, 10]);
  applyWeightedBits(frame, [5, 6, 7, 8], minute % 10, [8, 4, 2, 1]);

  applyWeightedBits(frame, [12, 13], Math.floor(hour / 10) * 10, [20, 10]);
  applyWeightedBits(frame, [15, 16, 17, 18], hour % 10, [8, 4, 2, 1]);

  applyWeightedBits(frame, [22, 23], Math.floor(dayOfYear / 100) * 100, [200, 100]);
  applyWeightedBits(frame, [25, 26, 27, 28], Math.floor((dayOfYear % 100) / 10) * 10, [80, 40, 20, 10]);
  applyWeightedBits(frame, [30, 31, 32, 33], dayOfYear % 10, [8, 4, 2, 1]);

  applyWeightedBits(frame, [45, 46, 47, 48], Math.floor(year / 10) * 10, [80, 40, 20, 10]);
  applyWeightedBits(frame, [50, 51, 52, 53], year % 10, [8, 4, 2, 1]);

  frame[55] = isLeapYear(frameStart.getUTCFullYear()) ? 1 : 0;
  frame[56] = 0;
  frame[57] = dstBits[0];
  frame[58] = dstBits[1];

  return frame;
}

function getZoneYearKey(date) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
  return `${tz}:${date.getUTCFullYear()}`;
}

function offsetForDate(date) {
  return new Date(date.getTime()).getTimezoneOffset();
}

function refineTransition(startMs, endMs) {
  let low = startMs;
  let high = endMs;
  const lowOffset = offsetForDate(new Date(low));

  while (high - low > 60_000) {
    const mid = Math.floor((low + high) / 2);
    if (offsetForDate(new Date(mid)) === lowOffset) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return high;
}

function collectDstTransitions(referenceDate) {
  const cacheKey = getZoneYearKey(referenceDate);
  if (dstTransitionCache.has(cacheKey)) {
    return dstTransitionCache.get(cacheKey);
  }

  const transitions = [];
  const scanStart = Date.UTC(referenceDate.getUTCFullYear() - 1, 0, 1);
  const scanEnd = Date.UTC(referenceDate.getUTCFullYear() + 2, 0, 1);

  let previousMs = scanStart;
  let previousOffset = offsetForDate(new Date(previousMs));

  for (let cursor = scanStart + DAY_MS; cursor <= scanEnd; cursor += DAY_MS) {
    const currentOffset = offsetForDate(new Date(cursor));
    if (currentOffset !== previousOffset) {
      const transitionMs = refineTransition(previousMs, cursor);
      transitions.push({
        at: new Date(transitionMs),
        offsetBefore: previousOffset,
        offsetAfter: currentOffset,
        type: currentOffset < previousOffset ? "start" : "end",
      });
      previousOffset = currentOffset;
    }
    previousMs = cursor;
  }

  dstTransitionCache.set(cacheKey, transitions);
  return transitions;
}

function isDstObserved(date) {
  const year = date.getUTCFullYear();
  const offsets = [
    new Date(year, 0, 1).getTimezoneOffset(),
    new Date(year, 3, 1).getTimezoneOffset(),
    new Date(year, 6, 1).getTimezoneOffset(),
    new Date(year, 9, 1).getTimezoneOffset(),
    new Date(year, 11, 31).getTimezoneOffset(),
  ];
  return new Set(offsets).size > 1;
}

function isDstActive(date) {
  const year = date.getUTCFullYear();
  const offsets = [
    new Date(year, 0, 1).getTimezoneOffset(),
    new Date(year, 3, 1).getTimezoneOffset(),
    new Date(year, 6, 1).getTimezoneOffset(),
    new Date(year, 9, 1).getTimezoneOffset(),
    new Date(year, 11, 31).getTimezoneOffset(),
  ];
  const standardOffset = Math.max(...offsets);
  return date.getTimezoneOffset() < standardOffset;
}

function computeDstBits(frameStart) {
  if (!isDstObserved(frameStart)) {
    return [0, 0];
  }

  const transitions = collectDstTransitions(frameStart).filter(
    (transition) => Math.abs(transition.at.getTime() - frameStart.getTime()) <= TRANSITION_SCAN_DAYS * DAY_MS,
  );
  const transitionToday = transitions.find(
    (transition) => getUtcDayKey(transition.at) === getUtcDayKey(frameStart),
  );

  if (transitionToday) {
    return transitionToday.type === "start" ? [1, 0] : [0, 1];
  }

  return isDstActive(frameStart) ? [1, 1] : [0, 0];
}

function describeBit(bit) {
  return `${BIT_LABELS[bit]} (${BIT_WIDTH_SECONDS[bit].toFixed(1)}s)`;
}

function setupGraphContexts() {
  waveformCtx = dom.waveformCanvas.getContext("2d");
  envelopeCtx = dom.envelopeCanvas.getContext("2d");
  resizeGraphCanvases();
}

function resizeCanvasToDisplaySize(canvas, heightPx) {
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(320, Math.floor(canvas.clientWidth * ratio));
  const height = Math.floor(heightPx * ratio);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function resizeGraphCanvases() {
  if (!dom.waveformCanvas || !dom.envelopeCanvas) {
    return;
  }

  resizeCanvasToDisplaySize(dom.waveformCanvas, 220);
  resizeCanvasToDisplaySize(dom.envelopeCanvas, 180);
}

function describeSecond(second, bit) {
  if (bit === MARKER) {
    return `Marker at second ${second}`;
  }

  if (second >= 1 && second <= 8) {
    return "Minute";
  }
  if (second >= 12 && second <= 18) {
    return "Hour";
  }
  if ((second >= 22 && second <= 23) || (second >= 25 && second <= 28) || (second >= 30 && second <= 33)) {
    return "Day of year";
  }
  if ((second >= 45 && second <= 48) || (second >= 50 && second <= 53)) {
    return "Year";
  }
  if (second === 55) {
    return "Leap year flag";
  }
  if (second === 56) {
    return "Leap second flag";
  }
  if (second === 57 || second === 58) {
    return "DST flag";
  }
  return "Reserved";
}

function renderFrame(frame) {
  dom.frameGrid.innerHTML = "";
  frameCells = frame.map((bit, second) => {
    const cell = document.createElement("div");
    const symbol = bit === MARKER ? "M" : String(bit);
    cell.className = `frame-cell frame-cell-${bit === MARKER ? "marker" : bit === 1 ? "one" : "zero"}`;
    cell.innerHTML = `
      <span class="frame-second">sec ${String(second).padStart(2, "0")}</span>
      <strong class="frame-symbol">${symbol}</strong>
      <span class="frame-desc">${describeSecond(second, bit)}</span>
    `;
    dom.frameGrid.appendChild(cell);
    return cell;
  });
}

function setLiveState(live) {
  dom.startButton.disabled = live;
  dom.stopButton.disabled = !live;
  dom.statusBadge.textContent = live ? "Live" : "Idle";
  dom.statusBadge.classList.toggle("badge-live", live);
  dom.statusBadge.classList.toggle("badge-idle", !live);
  dom.audioEngineValue.textContent = live ? "Running" : "Standby";
}

function updateMonitorStatus(currentBit = null) {
  const active = isTransmitting && isMonitorEnabled;
  dom.monitorStatusValue.textContent = active ? "Enabled" : "Disabled";

  if (active && currentBit !== null) {
    const inLowPhase = new Date().getUTCMilliseconds() / 1000 < BIT_WIDTH_SECONDS[currentBit];
    dom.monitorStatusMeta.textContent =
      inLowPhase
        ? "Monitor active: low state is silent"
        : `Monitor active: high state beep ${MONITOR_BEEP_TONE.label} (${MONITOR_BEEP_TONE.frequency.toFixed(2)} Hz)`;
    return;
  }

  dom.monitorStatusMeta.textContent = isMonitorEnabled
    ? `Monitor armed: silent on low, beep on high (${MONITOR_BEEP_TONE.label})`
    : "Audible monitor is off";
}

function syncMonitorGain() {
  if (!monitorGainNode || !audioContext) {
    updateMonitorStatus();
    return;
  }

  const now = audioContext.currentTime;
  monitorGainNode.gain.cancelScheduledValues(now);
  monitorGainNode.gain.setValueAtTime(monitorGainNode.gain.value, now);

  if (!isTransmitting || !isMonitorEnabled) {
    monitorGainNode.gain.linearRampToValueAtTime(0, now + RAMP_SECONDS);
  }

  updateMonitorStatus();
}

function handleMonitorToggle(event) {
  isMonitorEnabled = event.target.checked;
  syncMonitorGain();
}

function formatLocalTime(date) {
  return new Intl.DateTimeFormat([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(date);
}

function formatUtcFrame(date) {
  return `${new Intl.DateTimeFormat([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date)}`;
}

function updateStatusPanel(now) {
  const frameStart = floorToMinute(now);
  const frameKey = frameStart.toISOString();

  if (frameKey !== activeFrameKey) {
    activeFrameKey = frameKey;
    activeFrame = buildWwvbFrame(frameStart);
    renderFrame(activeFrame);
  }

  const second = now.getUTCSeconds();
  const currentBit = activeFrame[second];

  frameCells.forEach((cell, index) => {
    cell.classList.toggle("frame-cell-active", isTransmitting && index === second);
  });

  dom.localTimeValue.textContent = formatLocalTime(now);
  dom.frameTimeValue.textContent = formatUtcFrame(frameStart);
  dom.frameMinuteLabel.textContent = `Minute frame: ${frameStart.toISOString().slice(11, 16)} UTC`;
  dom.currentBitValue.textContent = BIT_LABELS[currentBit];
  dom.pulseWidthValue.textContent = `Pulse width: ${BIT_WIDTH_SECONDS[currentBit].toFixed(1)}s`;
  dom.graphStatusLabel.textContent = isTransmitting
    ? `Live bit ${BIT_LABELS[currentBit]} with ${BIT_WIDTH_SECONDS[currentBit].toFixed(1)}s low pulse`
    : "Waiting for transmission";
  updateMonitorStatus(currentBit);
}

function startUiLoop() {
  cancelAnimationFrame(uiFrameId);
  const draw = () => {
    const now = new Date();
    updateStatusPanel(now);
    drawSignalGraphs(now);
    uiFrameId = requestAnimationFrame(draw);
  };
  draw();
}

function ensureAudioGraph() {
  if (audioContext) {
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  audioContext = new AudioContextClass();
  oscillatorNode = audioContext.createOscillator();
  gainNode = audioContext.createGain();
  monitorOscillatorNode = audioContext.createOscillator();
  monitorGainNode = audioContext.createGain();

  oscillatorNode.type = "square";
  oscillatorNode.frequency.value = 20000;
  gainNode.gain.value = HIGH_GAIN;
  monitorOscillatorNode.type = "triangle";
  monitorOscillatorNode.frequency.value = MONITOR_BEEP_TONE.frequency;
  monitorGainNode.gain.value = 0;

  oscillatorNode.connect(gainNode);
  gainNode.connect(audioContext.destination);
  monitorOscillatorNode.connect(monitorGainNode);
  monitorGainNode.connect(audioContext.destination);
  oscillatorNode.start();
  monitorOscillatorNode.start();
}

function drawCanvasFrame(ctx, canvas, accent) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#071121";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(115, 245, 199, 0.10)";
  ctx.lineWidth = 1;

  for (let x = 0; x <= canvas.width; x += canvas.width / 8) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y <= canvas.height; y += canvas.height / 5) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
}

function drawIdleGraphState() {
  if (!waveformCtx || !envelopeCtx) {
    return;
  }

  drawCanvasFrame(waveformCtx, dom.waveformCanvas, "rgba(86, 217, 255, 0.9)");
  drawCanvasFrame(envelopeCtx, dom.envelopeCanvas, "rgba(255, 211, 108, 0.9)");

  waveformCtx.fillStyle = "rgba(148, 165, 199, 0.92)";
  waveformCtx.font = `${14 * (window.devicePixelRatio || 1)}px SFMono-Regular, Menlo, monospace`;
  waveformCtx.fillText("No live waveform. Start transmission to visualize output.", 24, 32);

  envelopeCtx.fillStyle = "rgba(148, 165, 199, 0.92)";
  envelopeCtx.font = `${14 * (window.devicePixelRatio || 1)}px SFMono-Regular, Menlo, monospace`;
  envelopeCtx.fillText("PWM envelope preview is inactive until transmission starts.", 24, 32);
}

function drawWaveformGraph(now) {
  if (!waveformCtx || !activeFrame.length) {
    drawIdleGraphState();
    return;
  }

  const canvas = dom.waveformCanvas;
  const ratio = window.devicePixelRatio || 1;
  const nowSeconds = now.getUTCSeconds() + now.getUTCMilliseconds() / 1000;
  const visibleSeconds = 5;
  const maxWindowStart = Math.max(0, 60 - visibleSeconds);
  const startTime = Math.min(maxWindowStart, Math.max(0, nowSeconds - 1.15));
  const endTime = Math.min(60, startTime + visibleSeconds);
  const firstVisibleSecond = Math.max(0, Math.floor(startTime));
  const lastVisibleSecond = Math.min(59, Math.ceil(endTime));
  const padX = 28 * ratio;
  const padY = 24 * ratio;
  const graphWidth = canvas.width - padX * 2;
  const graphHeight = canvas.height - padY * 2;
  const highY = padY + graphHeight * 0.18;
  const lowY = padY + graphHeight * 0.82;
  const xForTime = (timeSeconds) => padX + ((timeSeconds - startTime) / visibleSeconds) * graphWidth;

  drawCanvasFrame(waveformCtx, canvas, "rgba(232, 232, 232, 0.95)");
  waveformCtx.strokeStyle = "rgba(232, 232, 232, 0.95)";
  waveformCtx.lineWidth = 2.5 * ratio;
  waveformCtx.lineJoin = "round";
  waveformCtx.lineCap = "round";

  waveformCtx.beginPath();
  waveformCtx.moveTo(xForTime(startTime), highY);

  for (let bitSecond = firstVisibleSecond; bitSecond <= lastVisibleSecond; bitSecond += 1) {
    const bit = activeFrame[bitSecond] ?? MARKER;
    const pulseWidth = BIT_WIDTH_SECONDS[bit];
    const segStartTime = bitSecond;
    const segPulseEndTime = bitSecond + pulseWidth;
    const segEndTime = bitSecond + 1;

    if (segEndTime < startTime || segStartTime > endTime) {
      continue;
    }

    const visibleSegStart = Math.max(segStartTime, startTime);
    const visiblePulseEnd = Math.min(segPulseEndTime, endTime);
    const visibleSegEnd = Math.min(segEndTime, endTime);

    waveformCtx.lineTo(xForTime(visibleSegStart), highY);

    if (visiblePulseEnd > visibleSegStart) {
      waveformCtx.lineTo(xForTime(visibleSegStart), lowY);
      waveformCtx.lineTo(xForTime(visiblePulseEnd), lowY);
      waveformCtx.lineTo(xForTime(visiblePulseEnd), highY);
    }

    waveformCtx.lineTo(xForTime(visibleSegEnd), highY);
  }

  waveformCtx.stroke();
  waveformCtx.fillStyle = "rgba(239, 245, 255, 0.9)";
  waveformCtx.font = `${14 * ratio}px SFMono-Regular, Menlo, monospace`;
  waveformCtx.fillText("Step waveform view of recent WWVB pulse windows", padX, padY);

  const cursorX = xForTime(Math.min(endTime, nowSeconds));
  waveformCtx.strokeStyle = "rgba(115, 245, 199, 0.9)";
  waveformCtx.lineWidth = 2 * ratio;
  waveformCtx.beginPath();
  waveformCtx.moveTo(cursorX, padY);
  waveformCtx.lineTo(cursorX, canvas.height - padY);
  waveformCtx.stroke();

  waveformCtx.fillStyle = "rgba(148, 165, 199, 0.9)";
  waveformCtx.font = `${12 * ratio}px SFMono-Regular, Menlo, monospace`;
  for (let bitSecond = firstVisibleSecond; bitSecond <= lastVisibleSecond; bitSecond += 1) {
    if (bitSecond < startTime || bitSecond > endTime) {
      continue;
    }

    const labelX = xForTime(bitSecond) + 6 * ratio;
    waveformCtx.fillText(`s${String(bitSecond).padStart(2, "0")}`, labelX, canvas.height - 8 * ratio);
  }
}

function drawEnvelopeGraph(now) {
  if (!envelopeCtx) {
    return;
  }

  const canvas = dom.envelopeCanvas;
  drawCanvasFrame(envelopeCtx, canvas, "rgba(255, 211, 108, 0.95)");

  const bit = activeFrame[now.getUTCSeconds()] ?? MARKER;
  const pulseWidth = BIT_WIDTH_SECONDS[bit];
  const currentSecondFraction = now.getUTCMilliseconds() / 1000;
  const padX = 24 * (window.devicePixelRatio || 1);
  const padY = 22 * (window.devicePixelRatio || 1);
  const graphWidth = canvas.width - padX * 2;
  const highLevelY = padY + (canvas.height - padY * 2) * 0.16;
  const lowLevelY = padY + (canvas.height - padY * 2) * 0.78;
  const pulseEndX = padX + graphWidth * pulseWidth;
  const cursorX = padX + graphWidth * currentSecondFraction;

  envelopeCtx.strokeStyle = "rgba(115, 245, 199, 0.26)";
  envelopeCtx.lineWidth = 2;
  envelopeCtx.beginPath();
  envelopeCtx.moveTo(padX, highLevelY);
  envelopeCtx.lineTo(pulseEndX, highLevelY);
  envelopeCtx.lineTo(pulseEndX, lowLevelY);
  envelopeCtx.lineTo(padX + graphWidth, lowLevelY);
  envelopeCtx.stroke();

  envelopeCtx.fillStyle = "rgba(255, 211, 108, 0.18)";
  envelopeCtx.fillRect(padX, highLevelY, Math.max(2, pulseEndX - padX), lowLevelY - highLevelY);

  envelopeCtx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  envelopeCtx.lineWidth = 2;
  envelopeCtx.beginPath();
  envelopeCtx.moveTo(cursorX, padY);
  envelopeCtx.lineTo(cursorX, canvas.height - padY);
  envelopeCtx.stroke();

  envelopeCtx.fillStyle = "rgba(239, 245, 255, 0.92)";
  envelopeCtx.font = `${14 * (window.devicePixelRatio || 1)}px SFMono-Regular, Menlo, monospace`;
  envelopeCtx.fillText(`Bit ${BIT_LABELS[bit]}: low for ${pulseWidth.toFixed(1)}s, high for ${(1 - pulseWidth).toFixed(1)}s`, padX, padY);
  envelopeCtx.fillText("0.0s", padX, canvas.height - 6 * (window.devicePixelRatio || 1));
  envelopeCtx.fillText("1.0s", canvas.width - padX - 40 * (window.devicePixelRatio || 1), canvas.height - 6 * (window.devicePixelRatio || 1));
}

function drawSignalGraphs(now) {
  resizeGraphCanvases();

  if (!isTransmitting || !audioContext) {
    drawIdleGraphState();
    return;
  }

  drawWaveformGraph(now);
  drawEnvelopeGraph(now);
}

function audioTimeForWallMs(wallMs) {
  return wallMs / 1000 + wallToAudioOffsetSeconds;
}

function scheduleMonitorToneForSecond(audioStartTime, dropDuration) {
  if (!monitorOscillatorNode || !monitorGainNode) {
    return;
  }

  const dropEndTime = audioStartTime + dropDuration;
  const secondEndTime = audioStartTime + 1;

  monitorOscillatorNode.frequency.setValueAtTime(MONITOR_BEEP_TONE.frequency, audioStartTime);
  monitorGainNode.gain.setValueAtTime(0, audioStartTime);
  monitorGainNode.gain.linearRampToValueAtTime(0, Math.max(audioStartTime + RAMP_SECONDS, dropEndTime - RAMP_SECONDS));
  monitorGainNode.gain.linearRampToValueAtTime(MONITOR_GAIN, dropEndTime + MONITOR_GLIDE_SECONDS);
  monitorGainNode.gain.setValueAtTime(
    MONITOR_GAIN,
    Math.max(dropEndTime + MONITOR_GLIDE_SECONDS, secondEndTime - RAMP_SECONDS),
  );
  monitorGainNode.gain.linearRampToValueAtTime(0, secondEndTime);
}

function scheduleBitForSecond(secondDate, audioStartTime) {
  const frame = buildWwvbFrame(secondDate);
  const bit = frame[secondDate.getUTCSeconds()];
  const dropDuration = BIT_WIDTH_SECONDS[bit];
  const dropEndTime = audioStartTime + dropDuration;
  const secondEndTime = audioStartTime + 1;
  const rampDownEnd = audioStartTime + RAMP_SECONDS;
  const holdLowUntil = Math.max(rampDownEnd, dropEndTime - RAMP_SECONDS);

  gainNode.gain.setValueAtTime(HIGH_GAIN, audioStartTime);
  gainNode.gain.linearRampToValueAtTime(LOW_GAIN, rampDownEnd);
  gainNode.gain.setValueAtTime(LOW_GAIN, holdLowUntil);
  gainNode.gain.linearRampToValueAtTime(HIGH_GAIN, dropEndTime);
  gainNode.gain.setValueAtTime(HIGH_GAIN, secondEndTime);
  if (isMonitorEnabled) {
    scheduleMonitorToneForSecond(audioStartTime, dropDuration);
  }
}

function primeCurrentSecond(nowMs) {
  const currentSecondMs = Math.floor(nowMs / 1000) * 1000;
  const secondDate = new Date(currentSecondMs);
  const frame = buildWwvbFrame(secondDate);
  const bit = frame[secondDate.getUTCSeconds()];
  const secondPhaseSeconds = (nowMs - currentSecondMs) / 1000;
  const dropDuration = BIT_WIDTH_SECONDS[bit];
  const nowAudio = audioContext.currentTime;
  const currentValue = gainNode.gain.value;
  const targetValue = secondPhaseSeconds < dropDuration ? LOW_GAIN : HIGH_GAIN;

  gainNode.gain.cancelScheduledValues(nowAudio);
  gainNode.gain.setValueAtTime(currentValue, nowAudio);
  gainNode.gain.linearRampToValueAtTime(targetValue, nowAudio + RAMP_SECONDS);

  if (secondPhaseSeconds < dropDuration) {
    const dropEndWallMs = currentSecondMs + dropDuration * 1000;
    const dropEndAudioTime = audioTimeForWallMs(dropEndWallMs);
    gainNode.gain.setValueAtTime(LOW_GAIN, Math.max(nowAudio + RAMP_SECONDS, dropEndAudioTime - RAMP_SECONDS));
    gainNode.gain.linearRampToValueAtTime(HIGH_GAIN, dropEndAudioTime);
  }

  gainNode.gain.setValueAtTime(HIGH_GAIN, audioTimeForWallMs(currentSecondMs + 1000));

  if (monitorOscillatorNode && monitorGainNode) {
    const inLowPhase = secondPhaseSeconds < dropDuration;
    const currentSecondEndAudio = audioTimeForWallMs(currentSecondMs + 1000);
    monitorOscillatorNode.frequency.cancelScheduledValues(nowAudio);
    monitorOscillatorNode.frequency.setValueAtTime(MONITOR_BEEP_TONE.frequency, nowAudio);

    monitorGainNode.gain.cancelScheduledValues(nowAudio);
    monitorGainNode.gain.setValueAtTime(monitorGainNode.gain.value, nowAudio);

    if (!isMonitorEnabled) {
      monitorGainNode.gain.linearRampToValueAtTime(0, nowAudio + RAMP_SECONDS);
    } else if (inLowPhase) {
      const dropEndWallMs = currentSecondMs + dropDuration * 1000;
      const dropEndAudioTime = audioTimeForWallMs(dropEndWallMs);
      monitorGainNode.gain.linearRampToValueAtTime(0, Math.max(nowAudio + RAMP_SECONDS, dropEndAudioTime - RAMP_SECONDS));
      monitorGainNode.gain.linearRampToValueAtTime(MONITOR_GAIN, dropEndAudioTime + MONITOR_GLIDE_SECONDS);
      monitorGainNode.gain.setValueAtTime(
        MONITOR_GAIN,
        Math.max(dropEndAudioTime + MONITOR_GLIDE_SECONDS, currentSecondEndAudio - RAMP_SECONDS),
      );
      monitorGainNode.gain.linearRampToValueAtTime(0, currentSecondEndAudio);
    } else {
      monitorGainNode.gain.linearRampToValueAtTime(MONITOR_GAIN, nowAudio + MONITOR_GLIDE_SECONDS);
      monitorGainNode.gain.setValueAtTime(
        MONITOR_GAIN,
        Math.max(nowAudio + MONITOR_GLIDE_SECONDS, currentSecondEndAudio - RAMP_SECONDS),
      );
      monitorGainNode.gain.linearRampToValueAtTime(0, currentSecondEndAudio);
    }
  }

  scheduledThroughSecondMs = currentSecondMs;
}

function schedulerLoop() {
  if (!isTransmitting || !audioContext || !gainNode) {
    return;
  }

  const scheduleUntilWallMs = Math.floor(
    (audioContext.currentTime - wallToAudioOffsetSeconds + SCHEDULE_AHEAD_SECONDS) * 1000,
  );

  let nextSecondMs = scheduledThroughSecondMs === null ? null : scheduledThroughSecondMs + 1000;

  if (nextSecondMs === null) {
    const leadTimeMs = 300;
    nextSecondMs = Math.ceil((Date.now() + leadTimeMs) / 1000) * 1000;
  }

  while (nextSecondMs <= scheduleUntilWallMs) {
    scheduleBitForSecond(new Date(nextSecondMs), audioTimeForWallMs(nextSecondMs));
    scheduledThroughSecondMs = nextSecondMs;
    nextSecondMs += 1000;
  }

  schedulerFrameId = requestAnimationFrame(schedulerLoop);
}

async function startTransmit() {
  if (isTransmitting) {
    return;
  }

  ensureAudioGraph();
  await audioContext.resume();

  const nowMs = Date.now();
  wallToAudioOffsetSeconds = audioContext.currentTime - nowMs / 1000;
  isTransmitting = true;
  setLiveState(true);
  primeCurrentSecond(nowMs);
  syncMonitorGain();
  schedulerLoop();
}

async function stopTransmit() {
  if (!isTransmitting && !audioContext) {
    return;
  }

  isTransmitting = false;
  setLiveState(false);
  cancelAnimationFrame(schedulerFrameId);
  schedulerFrameId = null;
  scheduledThroughSecondMs = null;

  if (gainNode && audioContext) {
    const now = audioContext.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(0, now + RAMP_SECONDS);
  }

  if (monitorGainNode && audioContext) {
    const now = audioContext.currentTime;
    monitorGainNode.gain.cancelScheduledValues(now);
    monitorGainNode.gain.setValueAtTime(monitorGainNode.gain.value, now);
    monitorGainNode.gain.linearRampToValueAtTime(0, now + RAMP_SECONDS);
  }

  if (audioContext) {
    await audioContext.close();
  }

  audioContext = null;
  oscillatorNode = null;
  gainNode = null;
  monitorOscillatorNode = null;
  monitorGainNode = null;
  updateMonitorStatus();
}
