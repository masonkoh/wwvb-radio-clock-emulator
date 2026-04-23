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
const MONITOR_BEEP_TONE = { frequency: 698.46, label: "F5" };
const OUTPUT_MODES = {
  RADIO: "radio",
  AUDIBLE: "audible",
};

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

const PROTOCOLS = [
  {
    id: "wwvb",
    label: "WWVB 60 kHz",
    shortLabel: "WWVB",
    nominalFrequency: "60 kHz",
    status: "stable",
    region: "North America",
    description: "Validated stable mode for WWVB-compatible and Multiband 6 watches in WWVB mode.",
    frameType: "60-bit WWVB frame",
    encoderAvailable: true,
    transmitAvailable: true,
    compatibility: "WWVB-compatible watches and Multiband 6 models receiving WWVB",
    plannedReason: "",
    carrierProfile: {
      label: "20 kHz Square",
      meta: "3rd-harmonic near-field strategy for stable WWVB transmission",
      oscillatorType: "square",
      oscillatorFrequency: 20000,
    },
    audibleMonitorProfile: "Silent on low, F5 monitor beep on high",
    graphProfile: "Readable WWVB step waveform and one-second PWM envelope",
    encodeFrame: buildWwvbFrame,
    bitWidths: BIT_WIDTH_SECONDS,
  },
  {
    id: "msf",
    label: "MSF 60 kHz",
    shortLabel: "MSF",
    nominalFrequency: "60 kHz",
    status: "planned",
    region: "United Kingdom",
    description: "UK radio time standard planned for a future version.",
    frameType: "MSF frame (planned)",
    encoderAvailable: false,
    transmitAvailable: false,
    compatibility: "MSF-capable watches only",
    plannedReason: "MSF is listed in the protocol roadmap, but its encoder and carrier strategy are not implemented yet.",
    carrierProfile: {
      label: "Planned",
      meta: "MSF carrier and protocol logic will be added in a later version.",
    },
    audibleMonitorProfile: "Planned",
    graphProfile: "Planned",
  },
  {
    id: "jjy60",
    label: "JJY 60 kHz",
    shortLabel: "JJY 60",
    nominalFrequency: "60 kHz",
    status: "planned",
    region: "Japan",
    description: "Japanese 60 kHz radio time standard planned for a future version.",
    frameType: "JJY frame (planned)",
    encoderAvailable: false,
    transmitAvailable: false,
    compatibility: "JJY-capable watches only",
    plannedReason: "JJY 60 uses a different timecode format and is not yet implemented.",
    carrierProfile: {
      label: "Planned",
      meta: "JJY 60 carrier and protocol behavior will be added later.",
    },
    audibleMonitorProfile: "Planned",
    graphProfile: "Planned",
  },
  {
    id: "jjy40",
    label: "JJY 40 kHz",
    shortLabel: "JJY 40",
    nominalFrequency: "40 kHz",
    status: "planned",
    region: "Japan",
    description: "Japanese 40 kHz radio time standard planned for a future version.",
    frameType: "JJY frame (planned)",
    encoderAvailable: false,
    transmitAvailable: false,
    compatibility: "JJY-capable watches only",
    plannedReason: "JJY 40 requires a different carrier strategy and is not yet implemented.",
    carrierProfile: {
      label: "Planned",
      meta: "Future work will define the 40 kHz carrier strategy and encoder path.",
    },
    audibleMonitorProfile: "Planned",
    graphProfile: "Planned",
  },
  {
    id: "dcf77",
    label: "DCF77 77.5 kHz",
    shortLabel: "DCF77",
    nominalFrequency: "77.5 kHz",
    status: "planned",
    region: "Central Europe",
    description: "Continental European radio time standard planned for a future version.",
    frameType: "DCF77 frame (planned)",
    encoderAvailable: false,
    transmitAvailable: false,
    compatibility: "DCF77-capable watches only",
    plannedReason: "DCF77 support is planned but not implemented in the current release.",
    carrierProfile: {
      label: "Planned",
      meta: "Future work will define the DCF77 carrier and protocol path.",
    },
    audibleMonitorProfile: "Planned",
    graphProfile: "Planned",
  },
  {
    id: "bpc",
    label: "BPC 68.5 kHz",
    shortLabel: "BPC",
    nominalFrequency: "68.5 kHz",
    status: "planned",
    region: "China",
    description: "Chinese radio time standard planned for a future version.",
    frameType: "BPC frame (planned)",
    encoderAvailable: false,
    transmitAvailable: false,
    compatibility: "BPC-capable watches only",
    plannedReason: "BPC support remains on the roadmap and is not yet implemented.",
    carrierProfile: {
      label: "Planned",
      meta: "Future work will define the BPC carrier and encoder path.",
    },
    audibleMonitorProfile: "Planned",
    graphProfile: "Planned",
  },
];

const PROTOCOLS_BY_ID = Object.fromEntries(PROTOCOLS.map((protocol) => [protocol.id, protocol]));
const PROTOCOL_STATUS_LABELS = {
  stable: "Stable",
  experimental: "Experimental",
  planned: "Planned",
};

const dom = {
  startButton: document.querySelector("#startButton"),
  stopButton: document.querySelector("#stopButton"),
  outputModeRadio: document.querySelector("#outputModeRadio"),
  outputModeAudible: document.querySelector("#outputModeAudible"),
  supportBoundaryNote: document.querySelector("#supportBoundaryNote"),
  transmitGuardNote: document.querySelector("#transmitGuardNote"),
  protocolSelect: document.querySelector("#protocolSelect"),
  signalModeSummary: document.querySelector("#signalModeSummary"),
  selectedSignalHeroValue: document.querySelector("#selectedSignalHeroValue"),
  selectedSignalHeroMeta: document.querySelector("#selectedSignalHeroMeta"),
  protocolCompatibilityValue: document.querySelector("#protocolCompatibilityValue"),
  protocolCompatibilityMeta: document.querySelector("#protocolCompatibilityMeta"),
  statusBadge: document.querySelector("#statusBadge"),
  localTimeValue: document.querySelector("#localTimeValue"),
  frameTimeValue: document.querySelector("#frameTimeValue"),
  currentBitValue: document.querySelector("#currentBitValue"),
  pulseWidthValue: document.querySelector("#pulseWidthValue"),
  selectedSignalValue: document.querySelector("#selectedSignalValue"),
  selectedSignalMeta: document.querySelector("#selectedSignalMeta"),
  protocolStatusValue: document.querySelector("#protocolStatusValue"),
  protocolStatusMeta: document.querySelector("#protocolStatusMeta"),
  carrierValue: document.querySelector("#carrierValue"),
  carrierMeta: document.querySelector("#carrierMeta"),
  carrierStrategyValue: document.querySelector("#carrierStrategyValue"),
  carrierStrategyMeta: document.querySelector("#carrierStrategyMeta"),
  audioEngineValue: document.querySelector("#audioEngineValue"),
  monitorStatusValue: document.querySelector("#monitorStatusValue"),
  monitorStatusMeta: document.querySelector("#monitorStatusMeta"),
  graphStatusLabel: document.querySelector("#graphStatusLabel"),
  waveformCanvas: document.querySelector("#waveformCanvas"),
  envelopeCanvas: document.querySelector("#envelopeCanvas"),
  frameGrid: document.querySelector("#frameGrid"),
  frameMinuteLabel: document.querySelector("#frameMinuteLabel"),
  signalLogicText: document.querySelector("#signalLogicText"),
};

let audioContext = null;
let oscillatorNode = null;
let gainNode = null;
let monitorOscillatorNode = null;
let monitorGainNode = null;
let isTransmitting = false;
let activeProtocolId = "wwvb";
let activeOutputMode = OUTPUT_MODES.RADIO;
let schedulerFrameId = null;
let uiFrameId = null;
let scheduledThroughSecondMs = null;
let wallToAudioOffsetSeconds = 0;
let referenceFrameKey = "";
let referenceFrame = [];
let frameCells = [];
let waveformCtx = null;
let envelopeCtx = null;
const dstTransitionCache = new Map();

dom.startButton.addEventListener("click", startTransmit);
dom.stopButton.addEventListener("click", stopTransmit);
dom.outputModeRadio.addEventListener("change", handleOutputModeChange);
dom.outputModeAudible.addEventListener("change", handleOutputModeChange);
dom.protocolSelect.addEventListener("change", handleProtocolSelect);
window.addEventListener("resize", resizeGraphCanvases);

setupGraphContexts();
renderProtocolOptions();
syncReferenceFrame(new Date());
updateProtocolPresentation();
startUiLoop();
updateMonitorStatus();

function isAudibleMode() {
  return activeOutputMode === OUTPUT_MODES.AUDIBLE;
}

function getActiveProtocol() {
  return PROTOCOLS_BY_ID[activeProtocolId] || PROTOCOLS[0];
}

function isProtocolTransmissible(protocol) {
  return Boolean(protocol && protocol.transmitAvailable && protocol.encoderAvailable);
}

function getProtocolStatusLabel(protocol) {
  return PROTOCOL_STATUS_LABELS[protocol.status] || protocol.status;
}

function getPulseWidthForBit(protocol, bit) {
  return protocol.bitWidths?.[bit] ?? BIT_WIDTH_SECONDS[bit];
}

function encodeFrame(date, protocol) {
  if (!protocol || !protocol.encoderAvailable || typeof protocol.encodeFrame !== "function") {
    return null;
  }
  return protocol.encodeFrame(date);
}

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

function syncReferenceFrame(now) {
  const frameStart = floorToMinute(now);
  const frameKey = frameStart.toISOString();
  if (frameKey !== referenceFrameKey) {
    referenceFrameKey = frameKey;
    referenceFrame = buildWwvbFrame(frameStart);
    renderFrame(referenceFrame);
  }
  return { frameStart, frame: referenceFrame };
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
  return new Intl.DateTimeFormat([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
}

function renderProtocolOptions() {
  const activeProtocol = getActiveProtocol();

  dom.protocolSelect.innerHTML = "";
  PROTOCOLS.forEach((protocol) => {
    const option = document.createElement("option");
    option.value = protocol.id;
    option.selected = protocol.id === activeProtocol.id;
    option.textContent = `${protocol.label} — ${getProtocolStatusLabel(protocol)}`;
    dom.protocolSelect.appendChild(option);
  });

  dom.protocolSelect.disabled = isTransmitting;
}

function handleProtocolSelect(event) {
  const protocolId = event?.target?.value ?? event;
  if (isTransmitting || protocolId === activeProtocolId || !PROTOCOLS_BY_ID[protocolId]) {
    return;
  }

  activeProtocolId = protocolId;
  updateProtocolPresentation();
  updateStatusPanel(new Date());
  drawSignalGraphs(new Date());
}

function updateControlState() {
  const protocol = getActiveProtocol();
  dom.startButton.disabled = isTransmitting || !isProtocolTransmissible(protocol);
  dom.stopButton.disabled = !isTransmitting;
  dom.outputModeRadio.disabled = isTransmitting;
  dom.outputModeAudible.disabled = isTransmitting;
}

function setLiveState(live) {
  dom.statusBadge.textContent = live ? "Live" : "Idle";
  dom.statusBadge.classList.toggle("badge-live", live);
  dom.statusBadge.classList.toggle("badge-idle", !live);
  dom.audioEngineValue.textContent = live ? "Running" : "Standby";
  renderProtocolOptions();
  updateControlState();
}

function updateProtocolPresentation() {
  const protocol = getActiveProtocol();
  const transmissible = isProtocolTransmissible(protocol);

  dom.signalModeSummary.textContent = `${protocol.label} selected · ${getProtocolStatusLabel(protocol)}`;
  dom.selectedSignalHeroValue.textContent = protocol.label;
  dom.selectedSignalHeroMeta.textContent = `${protocol.region} · ${getProtocolStatusLabel(protocol)} · ${protocol.frameType}`;
  dom.protocolCompatibilityValue.textContent = protocol.compatibility;
  dom.protocolCompatibilityMeta.textContent = transmissible
    ? "Only WWVB is transmissible in v0.3. Planned standards are shown so the expansion path is explicit."
    : protocol.plannedReason;

  dom.supportBoundaryNote.textContent = transmissible
    ? "Stable today: WWVB-compatible watches. Other radio time standards are planned, not active yet."
    : `${protocol.label} is planned. Stable live transmission remains available only in WWVB mode today.`;

  if (!transmissible) {
    dom.transmitGuardNote.textContent = `${protocol.shortLabel} cannot transmit yet. Select WWVB to use the validated live transmission path.`;
  } else if (isAudibleMode()) {
    dom.transmitGuardNote.textContent = "Audible Monitor Tone Mode is for human listening only. Switch back to Radio Reception Mode for real watch synchronization.";
  } else {
    dom.transmitGuardNote.textContent = "Radio Reception Mode uses the validated WWVB path for actual watch synchronization.";
  }

  updateControlState();
  updateMonitorStatus();
}

function updateSignalLogicText(protocol) {
  dom.signalLogicText.textContent = isProtocolTransmissible(protocol)
    ? "Markers are emitted at seconds 0, 9, 19, 29, 39, 49, and 59. Data pulses follow the NIST WWVB AM timing envelope."
    : `${protocol.label} is currently listed as a planned protocol. Transmission remains blocked until its encoder, carrier strategy, graph profile, and validation path are implemented.`;
}

function updateStatusPanel(now) {
  const protocol = getActiveProtocol();
  const transmissible = isProtocolTransmissible(protocol);
  const { frameStart, frame } = syncReferenceFrame(now);
  const second = now.getUTCSeconds();
  const currentBit = transmissible ? frame[second] : null;

  frameCells.forEach((cell, index) => {
    cell.classList.toggle("frame-cell-active", isTransmitting && transmissible && index === second);
  });

  dom.localTimeValue.textContent = formatLocalTime(now);
  dom.selectedSignalValue.textContent = protocol.label;
  dom.selectedSignalMeta.textContent = `${protocol.region} · ${protocol.frameType}`;
  dom.protocolStatusValue.textContent = getProtocolStatusLabel(protocol);
  dom.protocolStatusMeta.textContent = transmissible
    ? isTransmitting
      ? isAudibleMode()
        ? "Audible monitor output is transmitting the WWVB timing pattern."
        : "Validated WWVB mode is transmitting."
      : isAudibleMode()
        ? "Audible monitor mode is ready to play the WWVB timing pattern."
        : "Validated WWVB mode is ready to transmit."
    : protocol.plannedReason;
  dom.carrierValue.textContent = transmissible
    ? isAudibleMode()
      ? `${MONITOR_BEEP_TONE.label} Monitor`
      : protocol.carrierProfile.label
    : `${protocol.nominalFrequency} Target`;
  dom.carrierMeta.textContent = transmissible
    ? isAudibleMode()
      ? "Human-audible output path. This mode is not for actual watch radio reception."
      : "Active near-field carrier path for the validated WWVB transmission mode"
    : "No live carrier path is implemented yet for the selected planned protocol.";
  dom.carrierStrategyValue.textContent = isAudibleMode() ? "Audible Monitor Playback" : protocol.carrierProfile.label;
  dom.carrierStrategyMeta.textContent = isAudibleMode()
    ? "WWVB timing is rendered as an audible monitor pattern instead of a radio reception carrier."
    : protocol.carrierProfile.meta;

  if (transmissible) {
    const pulseWidth = getPulseWidthForBit(protocol, currentBit);
    dom.frameTimeValue.textContent = formatUtcFrame(frameStart);
    dom.frameMinuteLabel.textContent = `Minute frame: ${frameStart.toISOString().slice(11, 16)} UTC`;
    dom.currentBitValue.textContent = BIT_LABELS[currentBit];
    dom.pulseWidthValue.textContent = `Pulse width: ${pulseWidth.toFixed(1)}s`;
    dom.graphStatusLabel.textContent = isTransmitting
      ? `Live ${protocol.shortLabel} bit ${BIT_LABELS[currentBit]} with ${pulseWidth.toFixed(1)}s low pulse`
      : `${protocol.shortLabel} graph is armed and ready`;
  } else {
    dom.frameTimeValue.textContent = "Planned mode";
    dom.frameMinuteLabel.textContent = `WWVB reference frame: ${frameStart.toISOString().slice(11, 16)} UTC`;
    dom.currentBitValue.textContent = "Unavailable";
    dom.pulseWidthValue.textContent = "Pulse width: --";
    dom.graphStatusLabel.textContent = `${protocol.shortLabel} is planned. Live graphs activate only in WWVB stable mode.`;
  }

  updateSignalLogicText(protocol);
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

function updateMonitorStatus(currentBit = null) {
  const protocol = getActiveProtocol();
  const transmissible = isProtocolTransmissible(protocol);
  const audible = isAudibleMode();
  const active = isTransmitting && transmissible;

  if (!transmissible) {
    dom.monitorStatusValue.textContent = audible ? "Audible" : "Radio";
    dom.monitorStatusMeta.textContent = `${protocol.shortLabel} has no live output path yet in either mode.`;
    return;
  }

  dom.monitorStatusValue.textContent = audible ? "Audible" : "Radio";

  if (active && currentBit !== null) {
    const inLowPhase = new Date().getUTCMilliseconds() / 1000 < getPulseWidthForBit(protocol, currentBit);
    dom.monitorStatusMeta.textContent = audible
      ? inLowPhase
        ? "Audible mode active: low state is silent."
        : `Audible mode active: high state plays ${MONITOR_BEEP_TONE.label} (${MONITOR_BEEP_TONE.frequency.toFixed(2)} Hz).`
      : "Radio reception mode active: validated WWVB path is driving the speaker for watch synchronization.";
    return;
  }

  dom.monitorStatusMeta.textContent = audible
    ? "Audible mode is selected. This mode is for human listening, not actual watch synchronization."
    : "Radio reception mode is selected for real watch synchronization.";
}

function syncOutputModeGains() {
  if (!monitorGainNode || !audioContext) {
    updateMonitorStatus();
    return;
  }

  const now = audioContext.currentTime;
  monitorGainNode.gain.cancelScheduledValues(now);
  monitorGainNode.gain.setValueAtTime(monitorGainNode.gain.value, now);
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(gainNode.gain.value, now);

  if (!isTransmitting || !isAudibleMode()) {
    monitorGainNode.gain.linearRampToValueAtTime(0, now + RAMP_SECONDS);
  }

  if (!isTransmitting || isAudibleMode()) {
    gainNode.gain.linearRampToValueAtTime(0, now + RAMP_SECONDS);
  }

  updateMonitorStatus();
}

function handleOutputModeChange(event) {
  if (!event.target.checked) {
    return;
  }

  activeOutputMode = event.target.value;
  updateProtocolPresentation();
  updateStatusPanel(new Date());
  syncOutputModeGains();
}

function ensureAudioGraph() {
  if (audioContext) {
    return;
  }

  const protocol = getActiveProtocol();
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  audioContext = new AudioContextClass();
  oscillatorNode = audioContext.createOscillator();
  gainNode = audioContext.createGain();
  monitorOscillatorNode = audioContext.createOscillator();
  monitorGainNode = audioContext.createGain();

  oscillatorNode.type = protocol.carrierProfile.oscillatorType;
  oscillatorNode.frequency.value = protocol.carrierProfile.oscillatorFrequency;
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

function drawIdleGraphState(protocol) {
  if (!waveformCtx || !envelopeCtx) {
    return;
  }

  const ratio = window.devicePixelRatio || 1;
  drawCanvasFrame(waveformCtx, dom.waveformCanvas, "rgba(86, 217, 255, 0.9)");
  drawCanvasFrame(envelopeCtx, dom.envelopeCanvas, "rgba(255, 211, 108, 0.9)");

  waveformCtx.fillStyle = "rgba(148, 165, 199, 0.92)";
  waveformCtx.font = `${14 * ratio}px SFMono-Regular, Menlo, monospace`;
  waveformCtx.fillText(
    isProtocolTransmissible(protocol)
      ? "No live waveform. Start transmission to visualize output."
      : `${protocol.shortLabel} is planned. Live waveform remains available only in WWVB stable mode.`,
    24,
    32,
  );

  envelopeCtx.fillStyle = "rgba(148, 165, 199, 0.92)";
  envelopeCtx.font = `${14 * ratio}px SFMono-Regular, Menlo, monospace`;
  envelopeCtx.fillText(
    isProtocolTransmissible(protocol)
      ? "PWM envelope preview is inactive until transmission starts."
      : "Current PWM envelope becomes available when a supported protocol is implemented.",
    24,
    32,
  );
}

function drawWaveformGraph(now, protocol) {
  if (!waveformCtx || !referenceFrame.length || !isProtocolTransmissible(protocol)) {
    drawIdleGraphState(protocol);
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
    const bit = referenceFrame[bitSecond] ?? MARKER;
    const pulseWidth = getPulseWidthForBit(protocol, bit);
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
  waveformCtx.fillText(`Step waveform view of recent ${protocol.shortLabel} pulse windows`, padX, padY);

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

function drawEnvelopeGraph(now, protocol) {
  if (!envelopeCtx || !isProtocolTransmissible(protocol)) {
    return;
  }

  const canvas = dom.envelopeCanvas;
  drawCanvasFrame(envelopeCtx, canvas, "rgba(255, 211, 108, 0.95)");

  const bit = referenceFrame[now.getUTCSeconds()] ?? MARKER;
  const pulseWidth = getPulseWidthForBit(protocol, bit);
  const currentSecondFraction = now.getUTCMilliseconds() / 1000;
  const ratio = window.devicePixelRatio || 1;
  const padX = 24 * ratio;
  const padY = 22 * ratio;
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
  envelopeCtx.font = `${14 * ratio}px SFMono-Regular, Menlo, monospace`;
  envelopeCtx.fillText(
    `Bit ${BIT_LABELS[bit]}: low for ${pulseWidth.toFixed(1)}s, high for ${(1 - pulseWidth).toFixed(1)}s`,
    padX,
    padY,
  );
  envelopeCtx.fillText("0.0s", padX, canvas.height - 6 * ratio);
  envelopeCtx.fillText("1.0s", canvas.width - padX - 40 * ratio, canvas.height - 6 * ratio);
}

function drawSignalGraphs(now) {
  resizeGraphCanvases();
  const protocol = getActiveProtocol();

  if (!isTransmitting || !audioContext || !isProtocolTransmissible(protocol)) {
    drawIdleGraphState(protocol);
    return;
  }

  drawWaveformGraph(now, protocol);
  drawEnvelopeGraph(now, protocol);
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
  const protocol = getActiveProtocol();
  const frame = encodeFrame(secondDate, protocol);
  if (!frame) {
    return;
  }

  const bit = frame[secondDate.getUTCSeconds()];
  const dropDuration = getPulseWidthForBit(protocol, bit);
  const dropEndTime = audioStartTime + dropDuration;
  const secondEndTime = audioStartTime + 1;
  const rampDownEnd = audioStartTime + RAMP_SECONDS;
  const holdLowUntil = Math.max(rampDownEnd, dropEndTime - RAMP_SECONDS);

  if (isAudibleMode()) {
    gainNode.gain.setValueAtTime(0, audioStartTime);
    gainNode.gain.setValueAtTime(0, secondEndTime);
    scheduleMonitorToneForSecond(audioStartTime, dropDuration);
    return;
  }

  monitorGainNode.gain.setValueAtTime(0, audioStartTime);
  monitorGainNode.gain.setValueAtTime(0, secondEndTime);
  gainNode.gain.setValueAtTime(HIGH_GAIN, audioStartTime);
  gainNode.gain.linearRampToValueAtTime(LOW_GAIN, rampDownEnd);
  gainNode.gain.setValueAtTime(LOW_GAIN, holdLowUntil);
  gainNode.gain.linearRampToValueAtTime(HIGH_GAIN, dropEndTime);
  gainNode.gain.setValueAtTime(HIGH_GAIN, secondEndTime);
}

function primeCurrentSecond(nowMs) {
  const protocol = getActiveProtocol();
  const currentSecondMs = Math.floor(nowMs / 1000) * 1000;
  const secondDate = new Date(currentSecondMs);
  const frame = encodeFrame(secondDate, protocol);
  if (!frame) {
    scheduledThroughSecondMs = currentSecondMs;
    return;
  }

  const bit = frame[secondDate.getUTCSeconds()];
  const secondPhaseSeconds = (nowMs - currentSecondMs) / 1000;
  const dropDuration = getPulseWidthForBit(protocol, bit);
  const nowAudio = audioContext.currentTime;
  if (!isAudibleMode()) {
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
    monitorGainNode.gain.cancelScheduledValues(nowAudio);
    monitorGainNode.gain.setValueAtTime(0, nowAudio);
  }

  if (monitorOscillatorNode && monitorGainNode && isAudibleMode()) {
    const inLowPhase = secondPhaseSeconds < dropDuration;
    const currentSecondEndAudio = audioTimeForWallMs(currentSecondMs + 1000);
    monitorOscillatorNode.frequency.cancelScheduledValues(nowAudio);
    monitorOscillatorNode.frequency.setValueAtTime(MONITOR_BEEP_TONE.frequency, nowAudio);

    monitorGainNode.gain.cancelScheduledValues(nowAudio);
    monitorGainNode.gain.setValueAtTime(monitorGainNode.gain.value, nowAudio);

    gainNode.gain.cancelScheduledValues(nowAudio);
    gainNode.gain.setValueAtTime(0, nowAudio);

    if (inLowPhase) {
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
  const protocol = getActiveProtocol();
  if (!isTransmitting || !audioContext || !gainNode || !isProtocolTransmissible(protocol)) {
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
  const protocol = getActiveProtocol();
  if (isTransmitting || !isProtocolTransmissible(protocol)) {
    updateProtocolPresentation();
    return;
  }

  ensureAudioGraph();
  await audioContext.resume();

  const nowMs = Date.now();
  wallToAudioOffsetSeconds = audioContext.currentTime - nowMs / 1000;
  isTransmitting = true;
  setLiveState(true);
  primeCurrentSecond(nowMs);
  syncOutputModeGains();
  schedulerLoop();
}

async function stopTransmit() {
  if (!isTransmitting && !audioContext) {
    return;
  }

  isTransmitting = false;
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
  setLiveState(false);
  updateProtocolPresentation();
}
