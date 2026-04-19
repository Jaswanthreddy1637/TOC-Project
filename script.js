const EPSILON = "\u03B5";
const SEARCH_LIMIT = 6000;
const DEPTH_LIMIT = 220;
const PLAYBACK_DELAY_MS = 620;

const DEFAULT_PDA = {
  name: "Balanced Parentheses PDA",
  states: ["q0", "q_accept"],
  inputAlphabet: ["(", ")"],
  stackAlphabet: ["Z", "X"],
  startState: "q0",
  startStackSymbol: "Z",
  acceptingStates: ["q_accept"],
  transitions: [
    { from: "q0", input: "(", stackTop: "Z", to: "q0", push: ["X", "Z"] },
    { from: "q0", input: "(", stackTop: "X", to: "q0", push: ["X", "X"] },
    { from: "q0", input: ")", stackTop: "X", to: "q0", push: [] },
    { from: "q0", input: EPSILON, stackTop: "Z", to: "q_accept", push: ["Z"] }
  ],
  sampleInput: "(())()"
};

const SAMPLE_CFG = [
  "S -> AB | a | B",
  "A -> aA | " + EPSILON,
  "B -> b | C",
  "C -> b",
  "D -> d"
].join("\n");

const appState = {
  currentTab: "workflowPda",
  currentPda: null,
  simulation: null,
  currentStepIndex: 0,
  isPlayingSimulation: false,
  playbackTimer: null,
  currentCfg: null,
  simplifiedCfg: null,
  renderedStack: [],
  stackAnimationToken: 0
};

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  bindEvents();
  loadDefaultPda();
  loadSampleCfg();
  resetCfgView();
});

function cacheElements() {
  const ids = [
    "loadDefaultBtn",
    "loadSampleCfgBtn",
    "statesInput",
    "inputAlphabetInput",
    "stackAlphabetInput",
    "startStateInput",
    "startStackSymbolInput",
    "acceptingStatesInput",
    "transitionsInput",
    "applyPdaBtn",
    "pdaMessage",
    "testStringInput",
    "simulateBtn",
    "nextStepBtn",
    "runAllBtn",
    "resetBtn",
    "runMessage",
    "statusBadge",
    "currentStateValue",
    "remainingInputValue",
    "transitionValue",
    "stepCounter",
    "stackVisual",
    "stepsTableBody",
    "statesSummary",
    "alphabetSummary",
    "stackSummary",
    "startSummary",
    "acceptingSummary",
    "transitionSummary",
    "pdaDiagramContainer",
    "cfgInput",
    "removeUselessCheck",
    "removeEpsilonCheck",
    "removeUnitCheck",
    "simplifyCfgBtn",
    "clearCfgBtn",
    "cfgMessage",
    "cfgValidationBadge",
    "cfgValidationMessage",
    "cfgStartSymbolValue",
    "cfgTypeValue",
    "cfgOriginalCountValue",
    "cfgSimplifiedCountValue",
    "cfgNonterminalSummary",
    "cfgTerminalSummary",
    "simplificationLog",
    "originalGrammarOutput",
    "simplifiedGrammarOutput"
  ];

  ids.forEach((id) => {
    elements[id] = document.getElementById(id);
  });

  elements.tabButtons = [...document.querySelectorAll(".tab-btn")];
  elements.workflows = [...document.querySelectorAll(".workflow")];
}

function bindEvents() {
  elements.tabButtons.forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.tabTarget));
  });

  elements.loadDefaultBtn.addEventListener("click", loadDefaultPda);
  elements.loadSampleCfgBtn.addEventListener("click", loadSampleCfg);
  elements.applyPdaBtn.addEventListener("click", applyPdaDefinition);
  elements.simulateBtn.addEventListener("click", prepareSimulation);
  elements.nextStepBtn.addEventListener("click", showNextStep);
  elements.runAllBtn.addEventListener("click", showAllSteps);
  elements.resetBtn.addEventListener("click", resetStepView);
  elements.simplifyCfgBtn.addEventListener("click", simplifyCfgWorkflow);
  elements.clearCfgBtn.addEventListener("click", clearCfgWorkflow);
}

function activateTab(targetId) {
  stopSimulationPlayback();
  appState.currentTab = targetId;
  elements.tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tabTarget === targetId);
  });
  elements.workflows.forEach((section) => {
    section.classList.toggle("active", section.id === targetId);
  });
  renderSimulation();
}

function loadDefaultPda() {
  populatePdaEditor(DEFAULT_PDA);
  elements.testStringInput.value = DEFAULT_PDA.sampleInput;
  applyPdaDefinition();
}

function populatePdaEditor(pda) {
  elements.statesInput.value = pda.states.join(", ");
  elements.inputAlphabetInput.value = pda.inputAlphabet.join(", ");
  elements.stackAlphabetInput.value = pda.stackAlphabet.join(", ");
  elements.startStateInput.value = pda.startState;
  elements.startStackSymbolInput.value = pda.startStackSymbol;
  elements.acceptingStatesInput.value = pda.acceptingStates.join(", ");
  elements.transitionsInput.value = pda.transitions
    .map((transition) => formatTransitionForEditor(transition))
    .join("\n");
}

function applyPdaDefinition() {
  clearMessage(elements.runMessage);
  stopSimulationPlayback();
  const result = readPdaFromForm();

  if (!result.ok) {
    appState.currentPda = null;
    appState.simulation = null;
    appState.currentStepIndex = 0;
    renderMachineSummary(null);
    renderSimulation();
    showMessage(elements.pdaMessage, result.errors.join(" "), "error");
    setStatus("PDA error", "error");
    return;
  }

  appState.currentPda = result.pda;
  appState.simulation = null;
  appState.currentStepIndex = 0;

  renderMachineSummary(result.pda);
  renderSimulation();
  showMessage(elements.pdaMessage, "PDA loaded successfully. Enter an input string to simulate it step by step.", "success");
  setStatus("PDA loaded", "info");
}

function readPdaFromForm() {
  const pda = {
    states: splitCommaList(elements.statesInput.value),
    inputAlphabet: splitCommaList(elements.inputAlphabetInput.value),
    stackAlphabet: splitCommaList(elements.stackAlphabetInput.value),
    startState: elements.startStateInput.value.trim(),
    startStackSymbol: elements.startStackSymbolInput.value.trim(),
    acceptingStates: splitCommaList(elements.acceptingStatesInput.value),
    transitions: []
  };

  const transitionResult = parseTransitions(elements.transitionsInput.value, pda.stackAlphabet);
  const errors = [];

  if (!transitionResult.ok) {
    errors.push(...transitionResult.errors);
  } else {
    pda.transitions = transitionResult.transitions;
  }

  errors.push(...validatePda(pda));
  return errors.length ? { ok: false, errors } : { ok: true, pda };
}

function splitCommaList(raw) {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseTransitions(raw, stackAlphabet) {
  const lines = raw.split(/\r?\n/);
  const transitions = [];
  const errors = [];
  const singleCharStackAlphabet = stackAlphabet.length > 0 && stackAlphabet.every((symbol) => symbol.length === 1);

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const parts = trimmed.split("->");
    if (parts.length !== 2) {
      errors.push(`Transition line ${index + 1} is invalid. Use "state, input, stackTop -> state, pushSymbols".`);
      return;
    }

    const left = parts[0].split(",").map((part) => part.trim());
    if (left.length !== 3 || left.some((part) => !part)) {
      errors.push(`Transition line ${index + 1} must contain current state, input symbol, and stack top.`);
      return;
    }

    const rightText = parts[1].trim();
    const rightParts = rightText.split(",");
    const toState = (rightParts[0] || "").trim();
    const pushText = rightParts.slice(1).join(",").trim() || EPSILON;

    if (!toState) {
      errors.push(`Transition line ${index + 1} is missing the next state.`);
      return;
    }

    transitions.push({
      from: left[0],
      input: normalizeSymbol(left[1]),
      stackTop: left[2],
      to: toState,
      push: parsePushSymbols(pushText, singleCharStackAlphabet),
      lineNumber: index + 1
    });
  });

  return errors.length ? { ok: false, errors } : { ok: true, transitions };
}

function parsePushSymbols(raw, singleCharStackAlphabet) {
  const normalized = normalizeSymbol(raw);
  if (normalized === EPSILON) {
    return [];
  }

  if (raw.includes(" ")) {
    return raw.trim().split(/\s+/).filter(Boolean);
  }

  if (singleCharStackAlphabet && raw.length > 1) {
    return raw.split("");
  }

  return [raw.trim()];
}

function normalizeSymbol(value) {
  const trimmed = (value || "").trim();
  const lowered = trimmed.toLowerCase();
  if (!trimmed || lowered === "e" || lowered === "eps" || lowered === "epsilon" || lowered === "lambda" || trimmed === EPSILON) {
    return EPSILON;
  }
  return trimmed;
}

function validatePda(pda) {
  const errors = [];
  const states = new Set(pda.states);
  const inputAlphabet = new Set(pda.inputAlphabet);
  const stackAlphabet = new Set(pda.stackAlphabet);

  if (!pda.states.length) {
    errors.push("Add at least one PDA state.");
  }
  if (!pda.inputAlphabet.length) {
    errors.push("Add at least one input alphabet symbol.");
  }
  if (!pda.stackAlphabet.length) {
    errors.push("Add at least one stack alphabet symbol.");
  }
  if (!pda.startState) {
    errors.push("The start state is required.");
  }
  if (!pda.startStackSymbol) {
    errors.push("The initial stack symbol is required.");
  }
  if (!pda.acceptingStates.length) {
    errors.push("Add at least one accepting state.");
  }

  const duplicatedStates = findDuplicates(pda.states);
  const duplicatedInput = findDuplicates(pda.inputAlphabet);
  const duplicatedStack = findDuplicates(pda.stackAlphabet);

  if (duplicatedStates.length) {
    errors.push(`Duplicate states found: ${duplicatedStates.join(", ")}.`);
  }
  if (duplicatedInput.length) {
    errors.push(`Duplicate input symbols found: ${duplicatedInput.join(", ")}.`);
  }
  if (duplicatedStack.length) {
    errors.push(`Duplicate stack symbols found: ${duplicatedStack.join(", ")}.`);
  }

  if (inputAlphabet.has(EPSILON)) {
    errors.push("The input alphabet cannot contain epsilon.");
  }

  if (pda.startState && !states.has(pda.startState)) {
    errors.push(`Start state "${pda.startState}" is not listed in Q.`);
  }
  if (pda.startStackSymbol && !stackAlphabet.has(pda.startStackSymbol)) {
    errors.push(`Initial stack symbol "${pda.startStackSymbol}" is not listed in the stack alphabet.`);
  }

  pda.acceptingStates.forEach((state) => {
    if (!states.has(state)) {
      errors.push(`Accepting state "${state}" is not listed in Q.`);
    }
  });

  pda.transitions.forEach((transition) => {
    if (!states.has(transition.from)) {
      errors.push(`Transition line ${transition.lineNumber} uses unknown source state "${transition.from}".`);
    }
    if (!states.has(transition.to)) {
      errors.push(`Transition line ${transition.lineNumber} uses unknown target state "${transition.to}".`);
    }
    if (transition.input !== EPSILON && !inputAlphabet.has(transition.input)) {
      errors.push(`Transition line ${transition.lineNumber} uses input symbol "${transition.input}" outside the input alphabet.`);
    }
    if (!stackAlphabet.has(transition.stackTop)) {
      errors.push(`Transition line ${transition.lineNumber} uses stack symbol "${transition.stackTop}" outside the stack alphabet.`);
    }
    transition.push.forEach((symbol) => {
      if (!stackAlphabet.has(symbol)) {
        errors.push(`Transition line ${transition.lineNumber} pushes "${symbol}" which is not in the stack alphabet.`);
      }
    });
  });

  return errors;
}

function findDuplicates(items) {
  const seen = new Set();
  const duplicates = new Set();

  items.forEach((item) => {
    if (seen.has(item)) {
      duplicates.add(item);
    }
    seen.add(item);
  });

  return [...duplicates];
}

function prepareSimulation() {
  clearMessage(elements.runMessage);
  stopSimulationPlayback();

  if (!appState.currentPda) {
    showMessage(elements.runMessage, "Apply a valid PDA before starting a simulation.", "error");
    setStatus("PDA required", "error");
    return;
  }

  const tokenResult = tokenizeInput(elements.testStringInput.value, appState.currentPda.inputAlphabet);
  if (!tokenResult.ok) {
    appState.simulation = null;
    appState.currentStepIndex = 0;
    renderSimulation();
    showMessage(elements.runMessage, tokenResult.error, "error");
    setStatus("Input error", "error");
    return;
  }

  const simulation = searchSimulationPath(appState.currentPda, tokenResult.tokens);
  const finalStep = simulation.path[simulation.path.length - 1] || null;
  const fullyConsumed = finalStep ? finalStep.inputIndex === tokenResult.tokens.length : false;
  const endedInAcceptState = finalStep ? appState.currentPda.acceptingStates.includes(finalStep.state) : false;
  simulation.accepted = Boolean(simulation.accepted && fullyConsumed && endedInAcceptState);
  appState.simulation = simulation;
  appState.currentStepIndex = 0;
  renderSimulation();

  if (simulation.accepted) {
    showMessage(elements.runMessage, `Accepted. ${simulation.path.length - 1} transition step(s) were recorded.`, "success");
    setStatus("Accepted", "success");
  } else {
    let reason = simulation.exhausted
      ? "Rejected. No accepting configuration was found."
      : "Rejected within the current search limits.";
    if (endedInAcceptState && !fullyConsumed) {
      reason = `Rejected. The PDA reached accepting state ${finalStep.state} with input still remaining (${finalStep.remainingInput}).`;
    } else if (!endedInAcceptState && fullyConsumed) {
      reason = `Rejected. All input was consumed, but the PDA stopped in non-accepting state ${finalStep ? finalStep.state : "-"}.`;
    }
    showMessage(elements.runMessage, `${reason} The step table shows the most advanced explored branch.`, "error");
    setStatus("Rejected", "error");
  }
}

function tokenizeInput(raw, alphabet) {
  const text = raw.trim();
  if (!text) {
    return { ok: true, tokens: [] };
  }

  let tokens = [];
  if (/\s/.test(text)) {
    tokens = text.split(/\s+/).filter(Boolean);
  } else if (alphabet.every((symbol) => symbol.length === 1)) {
    tokens = text.split("");
  } else {
    const sorted = [...alphabet].sort((a, b) => b.length - a.length);
    let cursor = 0;
    while (cursor < text.length) {
      const match = sorted.find((symbol) => text.startsWith(symbol, cursor));
      if (!match) {
        return {
          ok: false,
          error: `Could not tokenize the input near "${text.slice(cursor)}". Use spaces between symbols for multi-character alphabets.`
        };
      }
      tokens.push(match);
      cursor += match.length;
    }
  }

  const invalid = tokens.find((token) => !alphabet.includes(token));
  if (invalid) {
    return { ok: false, error: `Input symbol "${invalid}" is not in the PDA input alphabet.` };
  }

  return { ok: true, tokens };
}

function searchSimulationPath(pda, tokens) {
  const startConfig = {
    state: pda.startState,
    index: 0,
    stack: [pda.startStackSymbol],
    previous: null,
    via: null,
    depth: 0
  };

  const queue = [startConfig];
  const visited = new Set([configurationKey(startConfig)]);
  let expansions = 0;
  let best = startConfig;

  while (queue.length && expansions < SEARCH_LIMIT) {
    const current = queue.shift();

    if (isAcceptingConfig(current, pda, tokens)) {
      return { accepted: true, exhausted: true, path: unwindPath(current, tokens) };
    }

    if (scoreConfig(current, pda, tokens) > scoreConfig(best, pda, tokens)) {
      best = current;
    }

    if (current.depth >= DEPTH_LIMIT) {
      expansions += 1;
      continue;
    }

    const moves = getApplicableTransitions(current, pda, tokens);
    if (!moves.length && scoreConfig(current, pda, tokens) > scoreConfig(best, pda, tokens)) {
      best = current;
    }

    moves.forEach((transition) => {
      const nextConfig = applyTransition(current, transition);
      const key = configurationKey(nextConfig);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push(nextConfig);
      }
    });

    expansions += 1;
  }

  return {
    accepted: false,
    exhausted: queue.length === 0,
    path: unwindPath(best, tokens)
  };
}

function configurationKey(config) {
  return `${config.state}|${config.index}|${config.stack.join(" ")}`;
}

function isAcceptingConfig(config, pda, tokens) {
  return config.index === tokens.length && pda.acceptingStates.includes(config.state);
}

function scoreConfig(config, pda, tokens) {
  let score = config.index * 1000 - config.stack.length * 10 + (tokens.length - config.index === 0 ? 5 : 0);

  if (pda.acceptingStates.includes(config.state)) {
    score += config.index === tokens.length ? 200 : -400;
  }

  return score;
}

function getApplicableTransitions(config, pda, tokens) {
  const top = config.stack[config.stack.length - 1];
  const nextSymbol = tokens[config.index];

  return pda.transitions.filter((transition) => {
    if (transition.from !== config.state || transition.stackTop !== top) {
      return false;
    }
    return transition.input === EPSILON || nextSymbol === transition.input;
  });
}

function applyTransition(config, transition) {
  const nextStack = [...config.stack];
  nextStack.pop();

  for (let index = transition.push.length - 1; index >= 0; index -= 1) {
    nextStack.push(transition.push[index]);
  }

  return {
    state: transition.to,
    index: config.index + (transition.input === EPSILON ? 0 : 1),
    stack: nextStack,
    previous: config,
    via: transition,
    depth: config.depth + 1
  };
}

function unwindPath(config, tokens) {
  const chain = [];
  let cursor = config;

  while (cursor) {
    chain.push(cursor);
    cursor = cursor.previous;
  }

  return chain.reverse().map((stepConfig, index, chainArray) => ({
    stepNumber: index,
    state: stepConfig.state,
    inputIndex: stepConfig.index,
    remainingInput: formatTokenList(tokens.slice(stepConfig.index)),
    stack: [...stepConfig.stack],
    transition: stepConfig.via || null,
    transitionText: index === 0 ? "Initial configuration" : formatTransition(stepConfig.via),
    isFinal: index === chainArray.length - 1
  }));
}

function showNextStep() {
  if (!appState.simulation) {
    return;
  }
  stopSimulationPlayback();
  appState.currentStepIndex = Math.min(appState.currentStepIndex + 1, appState.simulation.path.length - 1);
  renderSimulation();
}

function showAllSteps() {
  if (!appState.simulation) {
    return;
  }
  if (appState.currentStepIndex >= appState.simulation.path.length - 1) {
    return;
  }
  stopSimulationPlayback();
  appState.isPlayingSimulation = true;
  renderSimulation();
  advanceSimulationPlayback();
}

function resetStepView() {
  if (!appState.simulation) {
    return;
  }
  stopSimulationPlayback();
  appState.currentStepIndex = 0;
  renderSimulation();
}

function stopSimulationPlayback() {
  if (appState.playbackTimer) {
    window.clearTimeout(appState.playbackTimer);
    appState.playbackTimer = null;
  }
  appState.isPlayingSimulation = false;
}

function advanceSimulationPlayback() {
  const simulation = appState.simulation;
  if (!appState.isPlayingSimulation || !simulation) {
    stopSimulationPlayback();
    renderSimulation();
    return;
  }

  const lastStepIndex = simulation.path.length - 1;
  if (appState.currentStepIndex >= lastStepIndex) {
    stopSimulationPlayback();
    renderSimulation();
    return;
  }

  appState.currentStepIndex += 1;
  renderSimulation();

  if (appState.currentStepIndex >= lastStepIndex) {
    stopSimulationPlayback();
    renderSimulation();
    return;
  }

  appState.playbackTimer = window.setTimeout(advanceSimulationPlayback, PLAYBACK_DELAY_MS);
}

function renderSimulation() {
  const simulation = appState.simulation;
  const hasSimulation = Boolean(simulation && simulation.path.length);
  const isPlaying = appState.isPlayingSimulation;

  elements.nextStepBtn.disabled = !hasSimulation || isPlaying || appState.currentStepIndex >= simulation.path.length - 1;
  elements.runAllBtn.disabled = !hasSimulation || isPlaying || appState.currentStepIndex >= simulation.path.length - 1;
  elements.resetBtn.disabled = !hasSimulation;
  elements.runAllBtn.textContent = isPlaying ? "Running..." : "Run All Steps";

  if (!hasSimulation) {
    elements.currentStateValue.textContent = "-";
    elements.remainingInputValue.textContent = "-";
    elements.transitionValue.textContent = "Prepare a simulation to begin.";
    elements.stepCounter.textContent = "No active simulation";
    renderStack([], false);
    renderPdaDiagram(appState.currentPda, appState.currentPda ? appState.currentPda.startState : null, null);
    elements.stepsTableBody.innerHTML = `<tr><td colspan="5" class="empty-cell">No steps yet.</td></tr>`;
    return;
  }

  const step = simulation.path[appState.currentStepIndex];
  elements.currentStateValue.textContent = step.state;
  elements.remainingInputValue.textContent = step.remainingInput;
  elements.transitionValue.textContent = step.transitionText;
  elements.stepCounter.textContent = isPlaying
    ? `Auto-playing step ${appState.currentStepIndex} of ${simulation.path.length - 1}`
    : `Viewing step ${appState.currentStepIndex} of ${simulation.path.length - 1}`;
  renderStack(step.stack, true);
  renderPdaDiagram(appState.currentPda, step.state, step.transition);
  renderStepsTable(simulation.path);
}

function renderStepsTable(path) {
  elements.stepsTableBody.innerHTML = "";

  path.forEach((step, index) => {
    const row = document.createElement("tr");
    row.className = "clickable";
    if (index === appState.currentStepIndex) {
      row.classList.add("active-row");
    }

    row.innerHTML = `
      <td>${step.stepNumber}</td>
      <td>${escapeHtml(step.state)}</td>
      <td>${escapeHtml(step.remainingInput)}</td>
      <td>${escapeHtml(formatStack(step.stack))}</td>
      <td>${escapeHtml(step.transitionText)}</td>
    `;

    row.addEventListener("click", () => {
      stopSimulationPlayback();
      appState.currentStepIndex = index;
      renderSimulation();
    });

    elements.stepsTableBody.appendChild(row);
  });
}

function renderStack(stack, animate) {
  const previousStack = [...appState.renderedStack];
  appState.stackAnimationToken += 1;
  const currentToken = appState.stackAnimationToken;

  if (!animate) {
    renderStackFinal(stack);
    appState.renderedStack = [...stack];
    return;
  }

  const comparison = compareStacks(previousStack, stack);
  const hasChanges = comparison.added.length || comparison.removed.length;

  if (!hasChanges) {
    renderStackFinal(stack);
    appState.renderedStack = [...stack];
    return;
  }

  elements.stackVisual.innerHTML = "";
  elements.stackVisual.classList.toggle("empty", stack.length === 0 && comparison.removed.length === 0);
  elements.stackVisual.classList.remove("stack-push", "stack-pop", "stack-mixed");

  const animationTone = comparison.added.length && comparison.removed.length
    ? "stack-mixed"
    : comparison.added.length
      ? "stack-push"
      : "stack-pop";
  elements.stackVisual.classList.add(animationTone);

  [...comparison.removed].reverse().forEach((symbol, index, removedVisible) => {
    elements.stackVisual.appendChild(createStackCell(symbol, {
      top: index === 0,
      exiting: true
    }));
  });

  if (!stack.length) {
    const placeholder = document.createElement("p");
    placeholder.className = "empty-cell stack-empty-enter";
    placeholder.textContent = "Stack is empty.";
    elements.stackVisual.appendChild(placeholder);
  } else {
    const visibleStack = [...stack].reverse();
    const enteringCount = comparison.added.length;
    visibleStack.forEach((symbol, index) => {
      elements.stackVisual.appendChild(createStackCell(symbol, {
        top: index === 0,
        entering: index < enteringCount
      }));
    });
  }

  window.setTimeout(() => {
    if (appState.stackAnimationToken !== currentToken) {
      return;
    }
    renderStackFinal(stack);
  }, 460);

  appState.renderedStack = [...stack];
}

function renderStackFinal(stack) {
  elements.stackVisual.innerHTML = "";
  elements.stackVisual.classList.remove("stack-push", "stack-pop", "stack-mixed");

  if (!stack.length) {
    elements.stackVisual.classList.add("empty");
    const empty = document.createElement("p");
    empty.className = "empty-cell";
    empty.textContent = "Stack is empty.";
    elements.stackVisual.appendChild(empty);
    return;
  }

  elements.stackVisual.classList.remove("empty");
  [...stack].reverse().forEach((symbol, index) => {
    elements.stackVisual.appendChild(createStackCell(symbol, {
      top: index === 0
    }));
  });
}

function createStackCell(symbol, options = {}) {
  const cell = document.createElement("div");
  const classes = ["stack-cell"];
  if (options.top) {
    classes.push("top");
  }
  if (options.entering) {
    classes.push("entering");
  }
  if (options.exiting) {
    classes.push("exiting");
  }

  cell.className = classes.join(" ");
  cell.textContent = options.top ? `${symbol}  <- top` : symbol;
  return cell;
}

function compareStacks(previousStack, nextStack) {
  let commonPrefixLength = 0;

  while (
    commonPrefixLength < previousStack.length &&
    commonPrefixLength < nextStack.length &&
    previousStack[commonPrefixLength] === nextStack[commonPrefixLength]
  ) {
    commonPrefixLength += 1;
  }

  return {
    added: nextStack.slice(commonPrefixLength),
    removed: previousStack.slice(commonPrefixLength)
  };
}

function renderMachineSummary(pda) {
  renderChipSet(elements.statesSummary, pda ? pda.states : []);
  renderChipSet(elements.alphabetSummary, pda ? pda.inputAlphabet : []);
  renderChipSet(elements.stackSummary, pda ? pda.stackAlphabet : []);

  if (!pda) {
    renderChipSet(elements.startSummary, []);
    renderChipSet(elements.acceptingSummary, []);
    elements.transitionSummary.innerHTML = `<p class="empty-cell">No PDA loaded.</p>`;
    return;
  }

  renderChipSet(elements.startSummary, [`q0 = ${pda.startState}`, `Z0 = ${pda.startStackSymbol}`]);
  renderChipSet(elements.acceptingSummary, pda.acceptingStates);
  elements.transitionSummary.innerHTML = "";

  pda.transitions.forEach((transition) => {
    const chip = document.createElement("span");
    chip.className = "chip transition-chip";
    chip.textContent = formatTransition(transition);
    elements.transitionSummary.appendChild(chip);
  });
}

function renderPdaDiagram(pda, activeState, activeTransition) {
  elements.pdaDiagramContainer.innerHTML = "";

  if (!pda || !pda.states.length) {
    elements.pdaDiagramContainer.classList.add("empty");
    elements.pdaDiagramContainer.innerHTML = `<p class="empty-cell">Apply a valid PDA to draw its state diagram.</p>`;
    return;
  }

  elements.pdaDiagramContainer.classList.remove("empty");

  const width = 980;
  const height = pda.states.length <= 2 ? 360 : pda.states.length <= 4 ? 430 : 520;
  const stateRadius = pda.states.length <= 4 ? 34 : 30;
  const positions = calculateStatePositions(pda.states, width, height, stateRadius);
  const svg = createSvgElement("svg", {
    viewBox: `0 0 ${width} ${height}`,
    class: "pda-diagram-svg",
    role: "img",
    "aria-label": "PDA state diagram"
  });

  svg.appendChild(createDiagramDefs());

  const transitionGroups = groupDiagramTransitions(pda.transitions);
  const transitionMap = new Map(transitionGroups.map((group) => [diagramPairKey(group.from, group.to), group]));

  const edgeLayer = createSvgElement("g", { class: "diagram-edge-layer" });
  transitionGroups.forEach((group) => {
    edgeLayer.appendChild(renderTransitionGroup(group, positions, transitionMap, stateRadius, activeTransition));
  });

  const startStatePosition = positions[pda.startState];
  if (startStatePosition) {
    edgeLayer.appendChild(renderStartArrow(startStatePosition, stateRadius));
  }
  svg.appendChild(edgeLayer);

  const stateLayer = createSvgElement("g", { class: "diagram-state-layer" });
  pda.states.forEach((state) => {
    const isAccepting = pda.acceptingStates.includes(state);
    const isActive = state === activeState;
    stateLayer.appendChild(renderStateNode(state, positions[state], stateRadius, isAccepting, isActive));
  });
  svg.appendChild(stateLayer);

  elements.pdaDiagramContainer.appendChild(svg);
  restartDiagramMotion(svg);
}

function restartDiagramMotion(svg) {
  const motionAnimations = [...svg.querySelectorAll("animateMotion")];
  if (!motionAnimations.length) {
    return;
  }

  window.requestAnimationFrame(() => {
    motionAnimations.forEach((animation) => {
      if (typeof animation.beginElement === "function") {
        try {
          animation.beginElement();
        } catch (error) {
          // Ignore browsers that don't expose SMIL restart hooks consistently.
        }
      }
    });
  });
}

function calculateStatePositions(states, width, height, stateRadius) {
  const positions = {};
  const centerX = width / 2;
  const centerY = height / 2;
  const count = states.length;

  if (count === 1) {
    positions[states[0]] = { x: centerX, y: centerY };
    return positions;
  }

  if (count === 2) {
    positions[states[0]] = { x: width * 0.32, y: centerY };
    positions[states[1]] = { x: width * 0.68, y: centerY };
    return positions;
  }

  const orbitRadiusX = width * (count <= 4 ? 0.27 : 0.31);
  const orbitRadiusY = height * (count <= 4 ? 0.26 : 0.3);
  states.forEach((state, index) => {
    const angle = (-Math.PI / 2) + (index * (2 * Math.PI / count));
    positions[state] = {
      x: centerX + orbitRadiusX * Math.cos(angle),
      y: centerY + orbitRadiusY * Math.sin(angle)
    };
  });

  return positions;
}

function groupDiagramTransitions(transitions) {
  const groups = new Map();

  transitions.forEach((transition) => {
    const key = diagramPairKey(transition.from, transition.to);
    if (!groups.has(key)) {
      groups.set(key, {
        from: transition.from,
        to: transition.to,
        transitions: []
      });
    }
    groups.get(key).transitions.push(transition);
  });

  return [...groups.values()];
}

function diagramPairKey(from, to) {
  return `${from}>>>${to}`;
}

function createDiagramDefs() {
  const defs = createSvgElement("defs");

  const normalMarker = createSvgElement("marker", {
    id: "diagram-arrow",
    markerWidth: "12",
    markerHeight: "12",
    refX: "10",
    refY: "6",
    orient: "auto",
    markerUnits: "userSpaceOnUse"
  });
  normalMarker.appendChild(createSvgElement("path", {
    d: "M 0 0 L 12 6 L 0 12 z",
    fill: "#7dcfca"
  }));

  const activeMarker = createSvgElement("marker", {
    id: "diagram-arrow-active",
    markerWidth: "12",
    markerHeight: "12",
    refX: "10",
    refY: "6",
    orient: "auto",
    markerUnits: "userSpaceOnUse"
  });
  activeMarker.appendChild(createSvgElement("path", {
    d: "M 0 0 L 12 6 L 0 12 z",
    fill: "#b8ff58"
  }));

  defs.appendChild(normalMarker);
  defs.appendChild(activeMarker);
  return defs;
}

function renderTransitionGroup(group, positions, transitionMap, stateRadius, activeTransition) {
  const fromPos = positions[group.from];
  const toPos = positions[group.to];
  const isSelfLoop = group.from === group.to;
  const isActive = group.transitions.includes(activeTransition);
  const wrapper = createSvgElement("g", {
    class: `diagram-edge-group${isActive ? " active" : ""}`
  });
  const pathId = `diagram-path-${sanitizeSvgId(group.from)}-${sanitizeSvgId(group.to)}`;

  const lines = group.transitions.map(formatDiagramTransitionLabel);
  const edgeTitle = createSvgElement("title");
  edgeTitle.textContent = `${group.from} -> ${group.to}: ${lines.join(" | ")}`;
  wrapper.appendChild(edgeTitle);

  if (isSelfLoop) {
    const loopPath = buildSelfLoopPath(fromPos, stateRadius);
    wrapper.appendChild(createSvgElement("path", {
      id: pathId,
      d: loopPath.d,
      class: `diagram-edge${isActive ? " active" : ""}`,
      "marker-end": `url(#${isActive ? "diagram-arrow-active" : "diagram-arrow"})`
    }));
    wrapper.appendChild(createDiagramLabel(loopPath.label.x, loopPath.label.y, lines, isActive));
    if (isActive) {
      wrapper.appendChild(createDiagramTracer(pathId));
    }
    return wrapper;
  }

  const reverseGroup = transitionMap.get(diagramPairKey(group.to, group.from));
  const hasReverse = Boolean(reverseGroup) && reverseGroup !== group;
  const directionSign = hasReverse && group.from.localeCompare(group.to) > 0 ? -1 : 1;
  const curveOffset = hasReverse ? 44 * directionSign : 0;
  const curve = buildCurvedEdgePath(fromPos, toPos, stateRadius, curveOffset);

  wrapper.appendChild(createSvgElement("path", {
    id: pathId,
    d: curve.d,
    class: `diagram-edge${isActive ? " active" : ""}`,
    "marker-end": `url(#${isActive ? "diagram-arrow-active" : "diagram-arrow"})`
  }));
  wrapper.appendChild(createDiagramLabel(curve.label.x, curve.label.y, lines, isActive));
  if (isActive) {
    wrapper.appendChild(createDiagramTracer(pathId));
  }
  return wrapper;
}

function buildCurvedEdgePath(fromPos, toPos, stateRadius, curveOffset) {
  const dx = toPos.x - fromPos.x;
  const dy = toPos.y - fromPos.y;
  const distance = Math.max(Math.hypot(dx, dy), 1);
  const unitX = dx / distance;
  const unitY = dy / distance;
  const perpX = -unitY;
  const perpY = unitX;

  const start = {
    x: fromPos.x + unitX * stateRadius,
    y: fromPos.y + unitY * stateRadius
  };
  const end = {
    x: toPos.x - unitX * stateRadius,
    y: toPos.y - unitY * stateRadius
  };

  if (!curveOffset) {
    return {
      d: `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
      label: {
        x: (start.x + end.x) / 2 + perpX * 16,
        y: (start.y + end.y) / 2 + perpY * 16
      }
    };
  }

  const control = {
    x: (start.x + end.x) / 2 + perpX * curveOffset,
    y: (start.y + end.y) / 2 + perpY * curveOffset
  };

  return {
    d: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`,
    label: quadraticPoint(start, control, end, 0.5, curveOffset > 0 ? 16 : -16, perpX, perpY)
  };
}

function buildSelfLoopPath(position, stateRadius) {
  const topY = position.y - stateRadius;
  return {
    d: `M ${position.x - stateRadius * 0.55} ${topY + 6}
        C ${position.x - stateRadius - 20} ${topY - 52},
          ${position.x + stateRadius + 20} ${topY - 52},
          ${position.x + stateRadius * 0.55} ${topY + 6}`,
    label: {
      x: position.x,
      y: topY - 56
    }
  };
}

function quadraticPoint(start, control, end, t, labelOffset, perpX, perpY) {
  const oneMinusT = 1 - t;
  return {
    x: oneMinusT * oneMinusT * start.x + 2 * oneMinusT * t * control.x + t * t * end.x + perpX * labelOffset,
    y: oneMinusT * oneMinusT * start.y + 2 * oneMinusT * t * control.y + t * t * end.y + perpY * labelOffset
  };
}

function renderStartArrow(position, stateRadius) {
  const group = createSvgElement("g", { class: "diagram-start-group" });
  const startX = position.x - stateRadius - 82;
  const endX = position.x - stateRadius - 8;
  const y = position.y;

  group.appendChild(createSvgElement("path", {
    d: `M ${startX} ${y} L ${endX} ${y}`,
    class: "diagram-start-arrow",
    "marker-end": "url(#diagram-arrow)"
  }));

  const label = createSvgElement("text", {
    x: startX + 6,
    y: y - 10,
    class: "diagram-start-label"
  });
  label.textContent = "start";
  group.appendChild(label);
  return group;
}

function renderStateNode(state, position, stateRadius, isAccepting, isActive) {
  const group = createSvgElement("g", {
    class: `diagram-state-group${isAccepting ? " accepting" : ""}${isActive ? " active" : ""}`,
    transform: `translate(${position.x}, ${position.y})`
  });

  const title = createSvgElement("title");
  title.textContent = `${state}${isAccepting ? " (accepting)" : ""}${isActive ? " (current state)" : ""}`;
  group.appendChild(title);

  if (isActive) {
    group.appendChild(createSvgElement("circle", {
      r: stateRadius + 12,
      class: "diagram-state-pulse"
    }));
    group.appendChild(createSvgElement("circle", {
      r: stateRadius + 4,
      class: "diagram-state-halo"
    }));
  }

  group.appendChild(createSvgElement("circle", {
    r: stateRadius,
    class: "diagram-state"
  }));

  if (isAccepting) {
    group.appendChild(createSvgElement("circle", {
      r: stateRadius - 6,
      class: "diagram-state-inner"
    }));
  }

  const text = createSvgElement("text", {
    x: "0",
    y: "1",
    class: "diagram-state-text"
  });
  text.textContent = state;
  group.appendChild(text);

  return group;
}

function createDiagramLabel(x, y, lines, isActive) {
  const sanitizedLines = lines.length ? lines : [EPSILON];
  const group = createSvgElement("g", {
    class: `diagram-label${isActive ? " active" : ""}`,
    transform: `translate(${x}, ${y})`
  });

  const estimatedWidth = Math.max(...sanitizedLines.map((line) => line.length), 1) * 6.9 + 20;
  const width = Math.min(Math.max(estimatedWidth, 84), 260);
  const height = sanitizedLines.length * 15 + 10;

  group.appendChild(createSvgElement("rect", {
    x: String(-width / 2),
    y: String(-height / 2),
    width: String(width),
    height: String(height),
    rx: "10",
    ry: "10",
    class: "diagram-label-box"
  }));

  const text = createSvgElement("text", {
    x: "0",
    y: String(-(sanitizedLines.length - 1) * 6.5),
    class: "diagram-label-text"
  });

  sanitizedLines.forEach((line, index) => {
    const tspan = createSvgElement("tspan", {
      x: "0",
      dy: index === 0 ? "0" : "14"
    });
    tspan.textContent = line;
    text.appendChild(tspan);
  });

  group.appendChild(text);
  return group;
}

function createDiagramTracer(pathId) {
  const tracer = createSvgElement("circle", {
    r: "6",
    class: "diagram-tracer"
  });
  const animateMotion = createSvgElement("animateMotion", {
    begin: "indefinite",
    dur: "0.75s",
    repeatCount: "1",
    rotate: "auto"
  });
  const mpath = createSvgElement("mpath");
  mpath.setAttribute("href", `#${pathId}`);
  mpath.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", `#${pathId}`);
  animateMotion.appendChild(mpath);
  tracer.appendChild(animateMotion);
  return tracer;
}

function formatDiagramTransitionLabel(transition) {
  return `${transition.input}, ${transition.stackTop} -> ${transition.push.length ? transition.push.join(" ") : EPSILON}`;
}

function sanitizeSvgId(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]+/g, "-");
}

function createSvgElement(tag, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attributes).forEach(([name, value]) => {
    element.setAttribute(name, value);
  });
  return element;
}

function renderChipSet(container, items) {
  container.innerHTML = "";
  if (!items.length) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = "-";
    container.appendChild(chip);
    return;
  }

  items.forEach((item) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = item;
    container.appendChild(chip);
  });
}

function loadSampleCfg() {
  elements.cfgInput.value = SAMPLE_CFG;
}

function clearCfgWorkflow() {
  elements.cfgInput.value = "";
  clearMessage(elements.cfgMessage);
  appState.currentCfg = null;
  appState.simplifiedCfg = null;
  resetCfgView();
}

function resetCfgView() {
  setCfgValidationState("Not Checked", "neutral");
  showMessage(elements.cfgValidationMessage, "Enter a grammar and run simplification to validate whether it is context-free.", "info");
  elements.cfgStartSymbolValue.textContent = "-";
  elements.cfgTypeValue.textContent = "-";
  elements.cfgOriginalCountValue.textContent = "-";
  elements.cfgSimplifiedCountValue.textContent = "-";
  renderChipSet(elements.cfgNonterminalSummary, []);
  renderChipSet(elements.cfgTerminalSummary, []);
  elements.simplificationLog.innerHTML = `<p class="empty-cell">No simplification has been run yet.</p>`;
  renderGrammarBlock(elements.originalGrammarOutput, null, "No grammar loaded.");
  renderGrammarBlock(elements.simplifiedGrammarOutput, null, "Run simplification to see the result.");
}

function simplifyCfgWorkflow() {
  clearMessage(elements.cfgMessage);
  const parseResult = parseCfgInput(elements.cfgInput.value);

  if (!parseResult.ok) {
    appState.currentCfg = null;
    appState.simplifiedCfg = null;
    resetCfgView();
    setCfgValidationState("Invalid", "error");
    elements.cfgTypeValue.textContent = "No";
    showMessage(elements.cfgValidationMessage, "The grammar is not a valid CFG. Fix the production rules and try again.", "error");
    showMessage(elements.cfgMessage, parseResult.errors.join(" "), "error");
    return;
  }

  const originalGrammar = normalizeGrammar(parseResult.grammar);
  let workingGrammar = cloneGrammar(originalGrammar);
  const logEntries = [];

  if (elements.removeEpsilonCheck.checked) {
    workingGrammar = eliminateEpsilonProductions(workingGrammar, logEntries);
  }
  if (elements.removeUnitCheck.checked) {
    workingGrammar = eliminateUnitProductions(workingGrammar, logEntries);
  }
  if (elements.removeUselessCheck.checked) {
    workingGrammar = removeUselessSymbols(workingGrammar, logEntries);
  }
  if (!elements.removeEpsilonCheck.checked && !elements.removeUnitCheck.checked && !elements.removeUselessCheck.checked) {
    logEntries.push("No simplification operation was selected. The grammar below is the normalized original grammar.");
  }

  workingGrammar = normalizeGrammar(workingGrammar);
  appState.currentCfg = originalGrammar;
  appState.simplifiedCfg = workingGrammar;

  renderCfgResults(originalGrammar, workingGrammar, logEntries);
  setCfgValidationState("Valid CFG", "success");
  showMessage(
    elements.cfgValidationMessage,
    `Valid context-free grammar detected. Simplification finished with ${workingGrammar.productions.length} production(s).`,
    "success"
  );
  showMessage(elements.cfgMessage, "CFG parsed and simplified successfully.", "success");
}

function parseCfgInput(raw) {
  const lines = raw.split(/\r?\n/);
  const productions = [];
  const errors = [];
  let startSymbol = null;

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const parts = trimmed.split("->");
    if (parts.length !== 2) {
      errors.push(`Grammar line ${index + 1} must contain exactly one "->".`);
      return;
    }

    const lhs = parts[0].trim();
    if (!isNonterminalToken(lhs)) {
      errors.push(`Grammar line ${index + 1} has invalid left side "${lhs}". A CFG production must have one nonterminal on the left.`);
      return;
    }

    if (!startSymbol) {
      startSymbol = lhs;
    }

    const alternatives = parts[1].split("|");
    if (!alternatives.length) {
      errors.push(`Grammar line ${index + 1} must contain at least one right-hand alternative.`);
      return;
    }

    alternatives.forEach((alternative) => {
      const altResult = parseGrammarAlternative(alternative.trim(), index + 1);
      if (!altResult.ok) {
        errors.push(altResult.error);
        return;
      }

      productions.push({
        lhs,
        rhs: altResult.rhs
      });
    });
  });

  if (!productions.length && !errors.length) {
    errors.push("Enter at least one production rule.");
  }

  return errors.length
    ? { ok: false, errors }
    : { ok: true, grammar: { startSymbol, productions } };
}

function parseGrammarAlternative(text, lineNumber) {
  const normalizedWhole = normalizeSymbol(text);
  if (!text || normalizedWhole === EPSILON) {
    return { ok: true, rhs: [] };
  }

  let tokens;
  if (/\s/.test(text)) {
    tokens = text.split(/\s+/).filter(Boolean);
  } else {
    const compactTokens = tokenizeCompactGrammar(text);
    if (!compactTokens.ok) {
      return { ok: false, error: `Grammar line ${lineNumber}: ${compactTokens.error}` };
    }
    tokens = compactTokens.tokens;
  }

  if (tokens.some((token) => normalizeSymbol(token) === EPSILON) && tokens.length > 1) {
    return { ok: false, error: `Grammar line ${lineNumber} mixes epsilon with other symbols in one alternative.` };
  }

  return { ok: true, rhs: tokens.map((token) => normalizeSymbol(token)).filter((token) => token !== EPSILON) };
}

function tokenizeCompactGrammar(text) {
  const tokens = [];
  let cursor = 0;

  while (cursor < text.length) {
    const char = text[cursor];

    if (char === "<") {
      const end = text.indexOf(">", cursor);
      if (end === -1) {
        return { ok: false, error: "Unmatched angle bracket in the right-hand side." };
      }
      tokens.push(text.slice(cursor, end + 1));
      cursor = end + 1;
      continue;
    }

    if (char === "'") {
      if (!tokens.length) {
        return { ok: false, error: "A right-hand side cannot start with an apostrophe." };
      }
      tokens[tokens.length - 1] += "'";
      cursor += 1;
      continue;
    }

    if (/[A-Z]/.test(char)) {
      let token = char;
      cursor += 1;
      while (cursor < text.length && /[0-9_']/.test(text[cursor])) {
        token += text[cursor];
        cursor += 1;
      }
      tokens.push(token);
      continue;
    }

    if (/[a-z]/.test(char)) {
      let token = char;
      cursor += 1;
      while (cursor < text.length && /[a-z0-9_]/.test(text[cursor])) {
        token += text[cursor];
        cursor += 1;
      }
      tokens.push(token);
      continue;
    }

    if (/[0-9]/.test(char)) {
      let token = char;
      cursor += 1;
      while (cursor < text.length && /[0-9]/.test(text[cursor])) {
        token += text[cursor];
        cursor += 1;
      }
      tokens.push(token);
      continue;
    }

    tokens.push(char);
    cursor += 1;
  }

  return { ok: true, tokens };
}

function isNonterminalToken(token) {
  return /^([A-Z][A-Za-z0-9_']*|<[^<>\s]+>)$/.test(token);
}

function normalizeGrammar(grammar) {
  const seen = new Set();
  const productions = [];

  grammar.productions.forEach((production) => {
    const cleanProduction = {
      lhs: production.lhs.trim(),
      rhs: [...production.rhs]
    };
    const key = productionKey(cleanProduction);
    if (!seen.has(key)) {
      seen.add(key);
      productions.push(cleanProduction);
    }
  });

  productions.sort((left, right) => {
    if (left.lhs !== right.lhs) {
      if (left.lhs === grammar.startSymbol) {
        return -1;
      }
      if (right.lhs === grammar.startSymbol) {
        return 1;
      }
      return left.lhs.localeCompare(right.lhs);
    }
    return formatCfgRhs(left.rhs).localeCompare(formatCfgRhs(right.rhs));
  });

  const nonterminals = new Set();
  const terminals = new Set();

  productions.forEach((production) => {
    nonterminals.add(production.lhs);
    production.rhs.forEach((symbol) => {
      if (isNonterminalToken(symbol)) {
        nonterminals.add(symbol);
      } else {
        terminals.add(symbol);
      }
    });
  });

  return {
    startSymbol: grammar.startSymbol,
    productions,
    nonterminals: [...nonterminals].sort(),
    terminals: [...terminals].sort()
  };
}

function cloneGrammar(grammar) {
  return {
    startSymbol: grammar.startSymbol,
    productions: grammar.productions.map((production) => ({
      lhs: production.lhs,
      rhs: [...production.rhs]
    }))
  };
}

function productionKey(production) {
  return `${production.lhs}->${production.rhs.length ? production.rhs.join(" ") : EPSILON}`;
}

function computeNullableNonterminals(grammar) {
  const nullable = new Set();
  let changed = true;

  while (changed) {
    changed = false;
    grammar.productions.forEach((production) => {
      const rhsNullable = production.rhs.length === 0 || production.rhs.every((symbol) => isNonterminalToken(symbol) && nullable.has(symbol));
      if (rhsNullable && !nullable.has(production.lhs)) {
        nullable.add(production.lhs);
        changed = true;
      }
    });
  }

  return nullable;
}

function eliminateEpsilonProductions(grammar, logEntries) {
  const nullable = computeNullableNonterminals(grammar);
  if (!nullable.size) {
    logEntries.push("No epsilon-productions were found.");
    return grammar;
  }

  const existingNonterminals = new Set(grammar.nonterminals);
  let startSymbol = grammar.startSymbol;
  const productions = [];
  const startWasNullable = nullable.has(grammar.startSymbol);

  grammar.productions.forEach((production) => {
    if (production.rhs.length === 0) {
      return;
    }

    expandNullableRhs(production.rhs, nullable).forEach((variant) => {
      if (variant.length === 0) {
        return;
      }
      productions.push({ lhs: production.lhs, rhs: variant });
    });
  });

  if (startWasNullable) {
    startSymbol = makeFreshStartSymbol(existingNonterminals);
    productions.push({ lhs: startSymbol, rhs: [grammar.startSymbol] });
    productions.push({ lhs: startSymbol, rhs: [] });
  }

  const result = normalizeGrammar({ startSymbol, productions });
  const nullableList = [...nullable].sort().join(", ");
  const note = startWasNullable
    ? `Removed epsilon-productions. Nullable nonterminals: ${nullableList}. Added new start symbol ${startSymbol} to preserve the empty string.`
    : `Removed epsilon-productions. Nullable nonterminals: ${nullableList}.`;
  logEntries.push(note);
  return result;
}

function expandNullableRhs(rhs, nullable) {
  const variants = new Set();

  function build(index, current) {
    if (index === rhs.length) {
      variants.add(current.join("\u0001"));
      return;
    }

    const symbol = rhs[index];
    current.push(symbol);
    build(index + 1, current);
    current.pop();

    if (isNonterminalToken(symbol) && nullable.has(symbol)) {
      build(index + 1, current);
    }
  }

  build(0, []);
  return [...variants].map((entry) => (entry ? entry.split("\u0001") : []));
}

function makeFreshStartSymbol(existingNonterminals) {
  let candidate = "S0";
  let counter = 1;

  while (existingNonterminals.has(candidate)) {
    candidate = `S0_${counter}`;
    counter += 1;
  }

  return candidate;
}

function eliminateUnitProductions(grammar, logEntries) {
  const productionsByLhs = groupCfgProductions(grammar.productions);
  const unitPairs = new Map();
  let unitCount = 0;

  grammar.nonterminals.forEach((nonterminal) => {
    const closure = new Set([nonterminal]);
    const queue = [nonterminal];

    while (queue.length) {
      const current = queue.shift();
      const productions = productionsByLhs.get(current) || [];
      productions.forEach((production) => {
        if (production.rhs.length === 1 && isNonterminalToken(production.rhs[0])) {
          unitCount += 1;
          const target = production.rhs[0];
          if (!closure.has(target)) {
            closure.add(target);
            queue.push(target);
          }
        }
      });
    }

    unitPairs.set(nonterminal, closure);
  });

  if (!unitCount) {
    logEntries.push("No unit productions were found.");
    return grammar;
  }

  const newProductions = [];
  grammar.nonterminals.forEach((lhs) => {
    const closure = unitPairs.get(lhs) || new Set([lhs]);
    closure.forEach((target) => {
      const productions = productionsByLhs.get(target) || [];
      productions.forEach((production) => {
        if (!(production.rhs.length === 1 && isNonterminalToken(production.rhs[0]))) {
          newProductions.push({ lhs, rhs: [...production.rhs] });
        }
      });
    });
  });

  logEntries.push("Removed unit productions by replacing nonterminal-to-nonterminal chains with their non-unit alternatives.");
  return normalizeGrammar({ startSymbol: grammar.startSymbol, productions: newProductions });
}

function removeUselessSymbols(grammar, logEntries) {
  const productive = new Set();
  let changed = true;

  while (changed) {
    changed = false;
    grammar.productions.forEach((production) => {
      const rhsProductive = production.rhs.every((symbol) => !isNonterminalToken(symbol) || productive.has(symbol));
      if (rhsProductive && !productive.has(production.lhs)) {
        productive.add(production.lhs);
        changed = true;
      }
    });
  }

  const productiveProductions = grammar.productions.filter((production) => {
    return productive.has(production.lhs) && production.rhs.every((symbol) => !isNonterminalToken(symbol) || productive.has(symbol));
  });

  const reachable = new Set([grammar.startSymbol]);
  let frontierChanged = true;

  while (frontierChanged) {
    frontierChanged = false;
    productiveProductions.forEach((production) => {
      if (!reachable.has(production.lhs)) {
        return;
      }
      production.rhs.forEach((symbol) => {
        if (isNonterminalToken(symbol) && !reachable.has(symbol)) {
          reachable.add(symbol);
          frontierChanged = true;
        }
      });
    });
  }

  const filteredProductions = productiveProductions.filter((production) => reachable.has(production.lhs));
  const result = normalizeGrammar({ startSymbol: grammar.startSymbol, productions: filteredProductions });
  const removed = grammar.nonterminals.filter((symbol) => !result.nonterminals.includes(symbol));

  if (!removed.length) {
    logEntries.push("No useless symbols were removed.");
  } else {
    logEntries.push(`Removed useless symbols: ${removed.join(", ")}.`);
  }

  return result;
}

function groupCfgProductions(productions) {
  const grouped = new Map();
  productions.forEach((production) => {
    if (!grouped.has(production.lhs)) {
      grouped.set(production.lhs, []);
    }
    grouped.get(production.lhs).push(production);
  });
  return grouped;
}

function renderCfgResults(originalGrammar, simplifiedGrammar, logEntries) {
  const startText = originalGrammar.startSymbol === simplifiedGrammar.startSymbol
    ? originalGrammar.startSymbol
    : `${originalGrammar.startSymbol} -> ${simplifiedGrammar.startSymbol}`;

  elements.cfgStartSymbolValue.textContent = startText;
  elements.cfgTypeValue.textContent = "Yes";
  elements.cfgOriginalCountValue.textContent = String(originalGrammar.productions.length);
  elements.cfgSimplifiedCountValue.textContent = String(simplifiedGrammar.productions.length);
  renderChipSet(elements.cfgNonterminalSummary, simplifiedGrammar.nonterminals);
  renderChipSet(elements.cfgTerminalSummary, simplifiedGrammar.terminals);
  renderLog(logEntries);
  renderGrammarBlock(elements.originalGrammarOutput, originalGrammar, "No grammar loaded.");
  renderGrammarBlock(elements.simplifiedGrammarOutput, simplifiedGrammar, "No productions remain after simplification.");
}

function renderLog(entries) {
  elements.simplificationLog.innerHTML = "";
  if (!entries.length) {
    elements.simplificationLog.innerHTML = `<p class="empty-cell">No changes were applied.</p>`;
    return;
  }

  entries.forEach((entry) => {
    const item = document.createElement("p");
    item.className = "log-item";
    item.textContent = entry;
    elements.simplificationLog.appendChild(item);
  });
}

function renderGrammarBlock(container, grammar, emptyText) {
  container.innerHTML = "";
  if (!grammar || !grammar.productions.length) {
    container.innerHTML = `<p class="empty-cell">${escapeHtml(emptyText)}</p>`;
    return;
  }

  const grouped = groupCfgProductions(grammar.productions);
  const orderedLhs = [...grouped.keys()].sort((left, right) => {
    if (left === grammar.startSymbol) {
      return -1;
    }
    if (right === grammar.startSymbol) {
      return 1;
    }
    return left.localeCompare(right);
  });

  orderedLhs.forEach((lhs) => {
    const row = document.createElement("div");
    row.className = "grammar-line";

    const lhsCell = document.createElement("div");
    lhsCell.className = "grammar-lhs";
    lhsCell.textContent = lhs;

    const rhsCell = document.createElement("div");
    rhsCell.className = "grammar-rhs";
    rhsCell.textContent = `-> ${(grouped.get(lhs) || []).map((production) => formatCfgRhs(production.rhs)).join(" | ")}`;

    row.appendChild(lhsCell);
    row.appendChild(rhsCell);
    container.appendChild(row);
  });
}

function setCfgValidationState(text, tone) {
  elements.cfgValidationBadge.textContent = text;
  elements.cfgValidationBadge.className = `status-badge ${tone}`;
}

function showMessage(element, text, kind) {
  element.textContent = text;
  element.className = `message ${kind}`;
}

function clearMessage(element) {
  element.textContent = "";
  element.className = "message hidden";
}

function setStatus(text, tone) {
  elements.statusBadge.textContent = text;
  elements.statusBadge.className = `status-badge ${tone}`;
}

function formatTransitionForEditor(transition) {
  return `${transition.from}, ${transition.input}, ${transition.stackTop} -> ${transition.to}, ${transition.push.length ? transition.push.join(" ") : EPSILON}`;
}

function formatTransition(transition) {
  return `\u03B4(${transition.from}, ${transition.input}, ${transition.stackTop}) -> (${transition.to}, ${transition.push.length ? transition.push.join(" ") : EPSILON})`;
}

function formatTokenList(tokens) {
  return tokens.length ? tokens.join(" ") : EPSILON;
}

function formatStack(stack) {
  return stack.length ? [...stack].reverse().join(" | ") : "empty";
}

function formatCfgRhs(rhs) {
  return rhs.length ? rhs.join(" ") : EPSILON;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
