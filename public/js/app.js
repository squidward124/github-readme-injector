// GitHub README Injector - Frontend

(function () {
  // --- State ---
  let ws = null;
  let ghAuthenticated = false;
  let sessionRunning = false;
  let defaultSystemPrompt = '';
  let currentTotal = 0;

  // --- DOM refs ---
  const $ = (id) => document.getElementById(id);

  // Config inputs
  const apiKeyInput = $('apiKey');
  const modelSelect = $('model');
  const modelCustomInput = $('modelCustom');
  const behaviorGoalInput = $('behaviorGoal');
  const exampleExploitsInput = $('exampleExploits');
  const systemPromptInput = $('systemPrompt');
  const repoPrefixInput = $('repoPrefix');
  const iterationsInput = $('iterations');
  const resetPromptBtn = $('resetPromptBtn');
  const toggleApiKeyBtn = $('toggleApiKey');

  // Run buttons
  const runBtn = $('runBtn');
  const pauseBtn = $('pauseBtn');
  const resumeBtn = $('resumeBtn');
  const abortBtn = $('abortBtn');
  const exportBtn = $('exportBtn');

  // Display
  const authStatusEl = $('authStatus');
  const authUserEl = $('authUser');
  const authDot = $('authDot');
  const authHintEl = $('authHint');
  const sessionStatusEl = $('sessionStatus');
  const sessionDot = $('sessionDot');
  const progressBar = $('progressBar');
  const progressText = $('progressText');
  const progressPct = $('progressPct');
  const progressCounter = $('progressCounter');
  const stepIndicator = $('stepIndicator');
  const logContainer = $('logContainer');
  const repoList = $('repoList');
  const toastContainer = $('toastContainer');
  const secondaryControls = $('secondaryControls');

  // --- Init ---
  async function init() {
    initPanelToggles();
    restoreState();
    connectWebSocket();
    await checkAuth();
    await fetchDefaultPrompt();
    bindEvents();
  }

  // --- Collapsible Panels (Hick's Law / Miller's Law) ---
  function initPanelToggles() {
    document.querySelectorAll('.panel-header[aria-expanded]').forEach((header) => {
      header.addEventListener('click', () => {
        const expanded = header.getAttribute('aria-expanded') === 'true';
        header.setAttribute('aria-expanded', String(!expanded));
        const body = header.nextElementSibling;
        if (body && body.classList.contains('panel-body')) {
          body.classList.toggle('open', !expanded);
        }
      });
    });
  }

  // --- LocalStorage persistence (Zeigarnik — remember state) ---
  function restoreState() {
    const saved = localStorage.getItem('ri_apiKey');
    if (saved) apiKeyInput.value = saved;

    const savedModel = localStorage.getItem('ri_model');
    if (savedModel) modelSelect.value = savedModel;

    const savedCustomModel = localStorage.getItem('ri_modelCustom');
    if (savedCustomModel) modelCustomInput.value = savedCustomModel;

    const savedPrefix = localStorage.getItem('ri_repoPrefix');
    if (savedPrefix) repoPrefixInput.value = savedPrefix;

    const savedIterations = localStorage.getItem('ri_iterations');
    if (savedIterations) iterationsInput.value = savedIterations;
  }

  function saveState() {
    localStorage.setItem('ri_apiKey', apiKeyInput.value);
    localStorage.setItem('ri_model', modelSelect.value);
    localStorage.setItem('ri_modelCustom', modelCustomInput.value);
    localStorage.setItem('ri_repoPrefix', repoPrefixInput.value);
    localStorage.setItem('ri_iterations', iterationsInput.value);
  }

  // --- Toast Notifications (Doherty Threshold — instant feedback) ---
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-dot"></span><span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-out');
      toast.addEventListener('animationend', () => toast.remove());
    }, 3500);
  }

  // --- API helpers ---
  async function api(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch('/api' + path, opts);
    return res.json();
  }

  // --- WebSocket ---
  function connectWebSocket() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${proto}//${location.host}`);

    ws.onopen = () => addLog('WebSocket connected', 'info');

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleWSMessage(msg);
      } catch (e) {
        // ignore
      }
    };

    ws.onclose = () => {
      addLog('WebSocket disconnected, reconnecting...', 'warn');
      setTimeout(connectWebSocket, 2000);
    };
  }

  function handleWSMessage(msg) {
    const { type, payload } = msg;

    switch (type) {
      case 'status_update':
        if (payload.status === 'running') {
          sessionRunning = true;
          updateSessionStatus('running');
        } else if (payload.status === 'paused') {
          updateSessionStatus('paused');
        } else if (payload.status === 'done') {
          sessionRunning = false;
          updateSessionStatus('done');
        }
        updateButtons();
        break;

      case 'log':
        addLog(payload.message, 'info');
        break;

      case 'error':
        addLog('ERROR: ' + payload.message, 'error');
        break;

      case 'generation_start':
        updateProgress(payload.iteration, payload.total, `Generating README #${payload.iteration}...`);
        updateRepoCard(payload.repoName, payload.iteration, 'generating', null, '');
        setStep('generate');
        break;

      case 'generation_complete':
        addLog(`Generated: [${payload.technique}] ${payload.reasoning}`, 'success');
        setStep('create');
        break;

      case 'repo_creating':
        updateRepoCard(payload.repoName, payload.iteration, 'creating', null, '');
        setStep('push');
        break;

      case 'repo_created':
        updateRepoCard(payload.repoName, payload.iteration, 'created', payload.repoUrl, payload.technique);
        completeSteps();
        break;

      case 'repo_error':
        updateRepoCard(payload.repoName, payload.iteration, 'error', null, '', payload.error);
        addLog(`Repo error: ${payload.error}`, 'error');
        break;

      case 'session_complete':
        sessionRunning = false;
        updateSessionStatus('done');
        updateButtons();
        addLog(`Session complete! Created: ${payload.totalCreated}, Errors: ${payload.totalErrors}`, 'success');
        updateProgress(payload.totalCreated + payload.totalErrors, payload.totalCreated + payload.totalErrors, 'Done');
        showToast(`Session complete — ${payload.totalCreated} repos created`, 'success');
        hideStepIndicator();
        break;
    }
  }

  // --- Step Indicator (Goal-Gradient Effect) ---
  function setStep(stepName) {
    stepIndicator.classList.remove('hidden');
    const steps = stepIndicator.querySelectorAll('.step');
    const lines = stepIndicator.querySelectorAll('.step-line');
    const order = ['generate', 'create', 'push'];
    const idx = order.indexOf(stepName);

    steps.forEach((s, i) => {
      s.classList.remove('active', 'done');
      if (i < idx) s.classList.add('done');
      else if (i === idx) s.classList.add('active');
    });

    lines.forEach((l, i) => {
      l.classList.toggle('filled', i < idx);
    });
  }

  function completeSteps() {
    stepIndicator.querySelectorAll('.step').forEach((s) => s.classList.add('done'));
    stepIndicator.querySelectorAll('.step-line').forEach((l) => l.classList.add('filled'));
  }

  function hideStepIndicator() {
    stepIndicator.classList.add('hidden');
  }

  // --- Check gh auth on load ---
  async function checkAuth() {
    try {
      const data = await api('GET', '/check-auth');
      if (data.authenticated) {
        ghAuthenticated = true;
        authStatusEl.textContent = 'Authenticated';
        authDot.className = 'chip-dot dot-green';
        authUserEl.textContent = data.username;
        authHintEl.textContent = `Ready — logged in as ${data.username}`;
      } else {
        ghAuthenticated = false;
        authStatusEl.textContent = 'Not Auth';
        authDot.className = 'chip-dot dot-red';
        authHintEl.textContent = 'Run "gh auth login" in terminal first';
      }
      updateButtons();
    } catch (e) {
      ghAuthenticated = false;
      authStatusEl.textContent = 'Error';
      authDot.className = 'chip-dot dot-red';
      authHintEl.textContent = 'Could not reach server';
    }
  }

  async function fetchDefaultPrompt() {
    try {
      const data = await api('GET', '/system-prompt');
      defaultSystemPrompt = data.defaultPrompt;
      if (!systemPromptInput.value) {
        systemPromptInput.value = defaultSystemPrompt;
      }
    } catch (e) {
      // ignore
    }
  }

  // --- Event bindings ---
  function bindEvents() {
    // Model custom override
    modelCustomInput.addEventListener('input', () => {
      if (modelCustomInput.value.trim()) {
        modelSelect.style.opacity = '0.5';
      } else {
        modelSelect.style.opacity = '1';
      }
    });

    // Toggle API key visibility (Fitts's Law — easy to reach)
    toggleApiKeyBtn.addEventListener('click', () => {
      const isPassword = apiKeyInput.type === 'password';
      apiKeyInput.type = isPassword ? 'text' : 'password';
      toggleApiKeyBtn.style.opacity = isPassword ? '1' : '0.5';
    });

    // Reset system prompt
    resetPromptBtn.addEventListener('click', () => {
      systemPromptInput.value = defaultSystemPrompt;
      showToast('System prompt reset to default', 'info');
    });

    // Auto-save on change (Zeigarnik — state persistence)
    [apiKeyInput, modelSelect, modelCustomInput, repoPrefixInput, iterationsInput].forEach((el) => {
      el.addEventListener('change', saveState);
    });

    // Run controls
    runBtn.addEventListener('click', startRun);
    pauseBtn.addEventListener('click', () => {
      api('POST', '/pause');
      showToast('Session paused', 'info');
    });
    resumeBtn.addEventListener('click', () => {
      api('POST', '/resume');
      showToast('Session resumed', 'info');
    });
    abortBtn.addEventListener('click', () => {
      if (confirm('Abort the current session?')) {
        api('POST', '/abort');
        showToast('Session aborted', 'error');
      }
    });

    exportBtn.addEventListener('click', () => {
      window.open('/api/results/export', '_blank');
    });
  }

  // --- Start Run ---
  async function startRun() {
    const apiKey = apiKeyInput.value.trim();
    const model = modelCustomInput.value.trim() || modelSelect.value;
    const behaviorGoal = behaviorGoalInput.value.trim();
    const exampleExploits = exampleExploitsInput.value.trim();
    const systemPrompt = systemPromptInput.value.trim();
    const repoPrefix = repoPrefixInput.value.trim() || 'sec-research';
    const iterations = parseInt(iterationsInput.value) || 5;

    // Validation with toasts instead of alerts (Doherty Threshold)
    if (!apiKey) {
      showToast('Please enter an OpenRouter API key', 'error');
      apiKeyInput.focus();
      return;
    }
    if (!behaviorGoal) {
      showToast('Please enter a target behavior goal', 'error');
      behaviorGoalInput.focus();
      return;
    }

    saveState();

    // Clear previous results
    repoList.innerHTML = '<p class="empty-state">Starting...</p>';
    logContainer.innerHTML = '';
    currentTotal = iterations;

    runBtn.disabled = true;
    sessionRunning = true;
    updateSessionStatus('running');
    runBtn.classList.add('running');
    runBtn.querySelector('span').textContent = 'Running...';

    const res = await api('POST', '/run', {
      apiKey,
      model,
      behaviorGoal,
      exampleExploits,
      systemPrompt,
      repoPrefix,
      iterations
    });

    if (!res.success) {
      addLog('Failed to start: ' + res.error, 'error');
      showToast('Failed to start: ' + res.error, 'error');
      sessionRunning = false;
      updateSessionStatus('error');
      runBtn.disabled = false;
      runBtn.classList.remove('running');
      runBtn.querySelector('span').textContent = 'Start Session';
    } else {
      addLog(`Session started: ${iterations} iterations`, 'success');
      showToast(`Session started — ${iterations} iterations`, 'success');
      updateProgress(0, iterations, 'Starting...');
      updateButtons();
    }
  }

  // --- UI Updates ---
  function updateSessionStatus(status) {
    sessionStatusEl.textContent = formatStatus(status);

    // Dot color mapping
    const dotMap = {
      running: 'dot-blue',
      paused: 'dot-orange',
      done: 'dot-green',
      error: 'dot-red'
    };
    sessionDot.className = 'chip-dot ' + (dotMap[status] || '');

    // Update run button state
    if (status === 'done' || status === 'error') {
      runBtn.classList.remove('running');
      runBtn.querySelector('span').textContent = 'Start Session';
    }
  }

  function formatStatus(s) {
    return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function updateButtons() {
    const isReady = ghAuthenticated;
    const isRunning = sessionRunning;

    runBtn.disabled = !isReady || isRunning;
    pauseBtn.disabled = !isRunning;
    resumeBtn.disabled = !isRunning;
    abortBtn.disabled = !isRunning;
    exportBtn.disabled = isRunning;

    // Show/hide secondary controls contextually
    secondaryControls.style.display = isRunning ? 'flex' : 'none';
  }

  function updateProgress(current, total, text) {
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    progressBar.style.width = pct + '%';
    progressText.textContent = text || `Processing iteration ${current} of ${total}`;
    progressPct.textContent = pct > 0 ? pct + '%' : '';
    progressCounter.textContent = `${current} / ${total}`;
  }

  function addLog(message, level = 'info') {
    // Clear empty state
    const empty = logContainer.querySelector('.log-empty');
    if (empty) empty.remove();

    const entry = document.createElement('div');
    entry.className = 'log-entry log-' + level;
    const time = new Date().toLocaleTimeString();
    entry.textContent = `[${time}] ${message}`;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
  }

  function updateRepoCard(repoName, iteration, status, repoUrl, technique, error) {
    // Remove empty state
    const empty = repoList.querySelector('.empty-state');
    if (empty) empty.remove();

    // Find or create card
    let card = repoList.querySelector(`[data-repo="${repoName}"]`);
    if (!card) {
      card = document.createElement('div');
      card.className = 'repo-card';
      card.setAttribute('data-repo', repoName);
      repoList.prepend(card);
    }

    let nameHtml;
    if (repoUrl) {
      nameHtml = `<a class="repo-name" href="${repoUrl}" target="_blank">${repoName}</a>`;
    } else {
      nameHtml = `<span class="repo-name">${repoName}</span>`;
    }

    card.innerHTML = `
      <div class="repo-header">
        ${nameHtml}
        <span class="repo-iteration">#${iteration}</span>
      </div>
      ${technique ? `<div class="repo-technique">Technique: ${technique}</div>` : ''}
      <div class="repo-status ${status}">${status.toUpperCase()}${error ? ': ' + error : ''}</div>
    `;
  }

  // --- Boot ---
  init();
})();
