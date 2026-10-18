/**
 * Repo Genesis — standalone showcase port.
 * Demo mode: simulated GitHub responses, no network calls.
 * Live mode: real GitHub REST API (requires a PAT).
 */
import { playCue, initAudio } from './sound.js';

const DEMO_ACCOUNTS = [
  {
    accountId: 'acc_demo',
    username: 'studio-engineer',
    accountLabel: 'Studio',
    vaultType: 'local',
    tokenId: 'tok_demo',
    authMethod: 'pat',
    tokenType: 'fine_grained',
    orgs: ['zero-commit-labs', 'ghost-tree']
  }
];

const DEMO_STAGED_INITIAL = ['src/app.js', 'src/ui/studio-shell.css', 'README.md'];

let DEMO_STAGED = new Set(DEMO_STAGED_INITIAL);

let modalElement = null;
let activeAccountsCatalog = [];
let demoRepos = [];
try {
  demoRepos = JSON.parse(localStorage.getItem('genesis-demo-repos') || '[]');
} catch (_) {
  demoRepos = [];
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function showToast(message, type = 'info', duration = 3200) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .25s';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

function isLive() {
  return !!document.getElementById('toggleLiveMode')?.checked;
}
function getLivePat() {
  return (document.getElementById('livePatInput')?.value || '').trim();
}

function listAllTokens() {
  if (isLive()) {
    return [{
      accountId: 'live',
      username: 'live-session',
      accountLabel: 'Live PAT',
      vaultType: 'live',
      tokenId: 'live',
      authMethod: 'pat',
      tokenType: 'classic',
      orgs: []
    }];
  }
  return DEMO_ACCOUNTS;
}

async function resolveTokenPlaintext(account) {
  if (isLive()) return getLivePat();
  return 'demo-token';
}

async function fetchUserOrganizations(token) {
  if (!token || token === 'demo-token') {
    await wait(350);
    return ['zero-commit-labs', 'ghost-tree'];
  }
  try {
    const res = await fetch('https://api.github.com/user/orgs?per_page=100', {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `token ${token}`
      }
    });
    if (!res.ok) return [];
    const orgs = await res.json();
    return Array.isArray(orgs) ? orgs.map((o) => o.login) : [];
  } catch (_) {
    return [];
  }
}

async function createRemoteRepository({ name, description = '', isPrivate = true, orgName = '', autoInit = true }, token) {
  if (!name || typeof name !== 'string') {
    throw new Error('Repository name is required.');
  }
  const cleanName = name.trim();
  if (!/^[a-zA-Z0-9_.-]+$/.test(cleanName) || cleanName.endsWith('.git') || cleanName.startsWith('.') || cleanName.endsWith('.') || cleanName.startsWith('-')) {
    throw new Error('Invalid repository name. Must use alphanumeric characters, hyphens, dots, or underscores.');
  }

  if (token && token !== 'demo-token') {
    const endpoint = orgName
      ? `https://api.github.com/orgs/${encodeURIComponent(orgName)}/repos`
      : 'https://api.github.com/user/repos';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        Authorization: `token ${token}`
      },
      body: JSON.stringify({
        name: cleanName,
        description: (description || '').trim(),
        private: Boolean(isPrivate),
        auto_init: Boolean(autoInit)
      })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Failed to create repository: HTTP ${res.status}`);
    }
    const data = await res.json();
    return {
      owner: data.owner?.login || '',
      repo: data.name,
      repoUrl: data.html_url,
      defaultBranch: data.default_branch || 'main',
      isPrivate: data.private,
      cloneUrl: data.clone_url
    };
  }

  await wait(900);
  const owner = orgName || (activeAccountsCatalog[0]?.username || 'studio-engineer');
  return {
    owner,
    repo: cleanName,
    repoUrl: `https://github.com/${owner}/${cleanName}`,
    defaultBranch: 'main',
    isPrivate: Boolean(isPrivate),
    cloneUrl: `https://github.com/${owner}/${cleanName}.git`,
    _demo: true
  };
}

function renderHistory() {
  const list = document.getElementById('historyList');
  if (!list) return;
  if (!demoRepos.length) {
    list.innerHTML = '<div class="history-empty">No repositories created yet — open the modal to try it.</div>';
    return;
  }
  list.innerHTML = demoRepos.map((r) => `
    <div class="history-item">
      <div class="history-item-main">
        <span class="history-repo">@${escapeHtml(r.owner)}/${escapeHtml(r.repo)}</span>
        <span class="history-meta">${r.isPrivate ? 'Private' : 'Public'} · ${escapeHtml(r.defaultBranch)} · ${escapeHtml(r.createdAt)}</span>
      </div>
      <a href="${escapeHtml(r.repoUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-dark-steel">Open</a>
    </div>
  `).join('');
}

function saveDemoRepos() {
  try {
    localStorage.setItem('genesis-demo-repos', JSON.stringify(demoRepos.slice(0, 50)));
  } catch (_) {
    /* storage unavailable (private mode / quota) — showcase continues without persistence */
  }
}

function openRepoGenesisModal() {
  if (!modalElement) buildModalDOM();
  populateInitialForm();
  modalElement.classList.add('active');
  playCue('open');
  const inputName = modalElement.querySelector('#genesisRepoName');
  if (inputName) inputName.focus();
}

function closeRepoGenesisModal() {
  if (modalElement) {
    modalElement.classList.remove('active');
    playCue('close');
  }
}

function buildModalDOM() {
  modalElement = document.createElement('div');
  modalElement.id = 'repoGenesisModal';
  modalElement.className = 'te-modal-overlay';
  modalElement.setAttribute('role', 'dialog');
  modalElement.setAttribute('aria-modal', 'true');

  modalElement.innerHTML = `
    <div class="genesis-modal-card">
      <div class="genesis-header">
        <div class="genesis-header-title-box">
          <svg class="icon-svg" viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" style="color: #ffffff;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
          <h3 class="genesis-header-title">Create New Repository</h3>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span id="genesisModeChip" class="genesis-auth-chip">DEMO</span>
          <button id="btnCloseGenesisModal" class="genesis-close-btn" title="Close (ESC)">ESC</button>
        </div>
      </div>

      <div class="genesis-body">
        <div class="genesis-form-group" id="genesisAccountGroup">
          <div class="genesis-label-row">
            <label class="genesis-label" for="genesisAccountSelect">GitHub Account</label>
            <span id="genesisAccountBadge" class="genesis-auth-chip">Verified</span>
          </div>
          <select id="genesisAccountSelect" class="genesis-input"></select>
        </div>

        <div class="genesis-form-group">
          <label class="genesis-label" for="genesisRepoOwnerSelect">Owner Context</label>
          <select id="genesisRepoOwnerSelect" class="genesis-input"></select>
        </div>

        <div class="genesis-form-group">
          <label class="genesis-label" for="genesisRepoName">Repository Name</label>
          <input type="text" id="genesisRepoName" class="genesis-input" placeholder="my-awesome-project" autocomplete="off" spellcheck="false">
          <div class="genesis-url-preview">
            <span class="genesis-url-prefix">github.com /</span>
            <span class="genesis-url-owner" id="genesisUrlOwner">owner</span>
            <span class="genesis-url-sep">/</span>
            <span class="genesis-url-name" id="genesisUrlName">my-awesome-project</span>
          </div>
          <div id="genesisNameValidation" class="genesis-validation-err" style="display: none;"></div>
        </div>

        <div class="genesis-form-group">
          <label class="genesis-label" for="genesisRepoDesc">Description (Optional)</label>
          <input type="text" id="genesisRepoDesc" class="genesis-input" placeholder="Edge-first web application deployed with ZeroCommit" autocomplete="off">
        </div>

        <div class="genesis-form-group">
          <label class="genesis-label">Visibility</label>
          <div class="genesis-segmented-radio">
            <label class="genesis-radio-card active" data-vis="private">
              <input type="radio" name="genesisVis" value="private" checked style="display: none;">
              <svg class="icon-svg genesis-radio-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <div class="genesis-radio-content">
                <span class="genesis-radio-title">Private</span>
                <span class="genesis-radio-desc">Only you and selected collaborators</span>
              </div>
            </label>
            <label class="genesis-radio-card" data-vis="public">
              <input type="radio" name="genesisVis" value="public" style="display: none;">
              <svg class="icon-svg genesis-radio-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              <div class="genesis-radio-content">
                <span class="genesis-radio-title">Public</span>
                <span class="genesis-radio-desc">Visible to anyone on the internet</span>
              </div>
            </label>
          </div>
        </div>

        <div id="genesisStagedOption" class="genesis-form-group" style="display: none;">
          <div class="genesis-staged-box">
            <label class="hw-toggle" style="font-size: 11px;">
              <input type="checkbox" id="genesisPushStagedChk" checked>
              <span class="toggle-slider"></span>
              <span id="genesisStagedLabel">Carry forward active staged changes to new repository</span>
            </label>
          </div>
        </div>

      </div>

      <div class="genesis-footer-actions">
        <button type="button" id="btnCancelGenesis" class="btn btn-sm btn-dark-steel">Cancel</button>
        <button type="button" id="btnExecuteGenesis" class="btn btn-sm btn-chrome">Create Repository</button>
      </div>
    </div>
  `;

  document.body.appendChild(modalElement);

  modalElement.querySelector('#btnCloseGenesisModal').addEventListener('click', closeRepoGenesisModal);
  modalElement.querySelector('#btnCancelGenesis').addEventListener('click', closeRepoGenesisModal);
  modalElement.addEventListener('click', (e) => {
    if (e.target === modalElement) closeRepoGenesisModal();
  });

  const visCards = modalElement.querySelectorAll('.genesis-radio-card');
  visCards.forEach((card) => {
    card.addEventListener('click', () => {
      visCards.forEach((c) => c.classList.remove('active'));
      card.classList.add('active');
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
      playCue('tick');
    });
  });

  const nameInput = modalElement.querySelector('#genesisRepoName');
  const validationErr = modalElement.querySelector('#genesisNameValidation');
  if (nameInput) {
    nameInput.addEventListener('input', () => {
      const val = nameInput.value.trim();
      if (!val) {
        if (validationErr) validationErr.style.display = 'none';
        return;
      }
      const invalid = !/^[a-zA-Z0-9_.-]+$/.test(val) || val.startsWith('.') || val.endsWith('.') || val.startsWith('-') || val.endsWith('.git');
      if (invalid) {
        if (validationErr) {
          validationErr.textContent = 'Invalid name (cannot start/end with dot or hyphen, or end with .git).';
          validationErr.style.display = 'block';
        }
        playCue('tick');
      } else if (validationErr) {
        validationErr.style.display = 'none';
      }
      updateUrlPreview();
    });
  }

  modalElement.querySelector('#genesisAccountSelect')?.addEventListener('change', () => {
    updateOwnerTargets();
  });
  modalElement.querySelector('#genesisRepoOwnerSelect')?.addEventListener('change', () => {
    updateUrlPreview();
  });

  modalElement.querySelector('#btnExecuteGenesis').addEventListener('click', handleGenesisSubmit);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalElement?.classList.contains('active')) {
      closeRepoGenesisModal();
    }
  });
}

async function populateInitialForm() {
  if (!modalElement) return;
  const accountSelect = modalElement.querySelector('#genesisAccountSelect');
  const stagedOpt = modalElement.querySelector('#genesisStagedOption');
  const stagedLabel = modalElement.querySelector('#genesisStagedLabel');
  const nameInput = modalElement.querySelector('#genesisRepoName');
  const validationErr = modalElement.querySelector('#genesisNameValidation');
  const modeChip = modalElement.querySelector('#genesisModeChip');

  if (modeChip) modeChip.textContent = isLive() ? 'LIVE' : 'DEMO';
  if (nameInput) nameInput.value = '';
  if (validationErr) validationErr.style.display = 'none';

  activeAccountsCatalog = listAllTokens();

  if (accountSelect) {
    accountSelect.innerHTML = '';
    activeAccountsCatalog.forEach((acc, idx) => {
      const opt = document.createElement('option');
      opt.value = acc.accountId;
      const method = acc.authMethod === 'oauth' ? 'OAuth' : 'PAT';
      opt.textContent = acc.accountId === 'live'
        ? 'Live PAT Session'
        : `${acc.username} (${acc.accountLabel}) [${method}]`;
      if (idx === 0) opt.selected = true;
      accountSelect.appendChild(opt);
    });
  }

  await updateOwnerTargets();

  const stagedCount = DEMO_STAGED.size;
  if (stagedOpt) {
    stagedOpt.style.display = stagedCount > 0 ? 'block' : 'none';
  }
  if (stagedLabel && stagedCount > 0) {
    stagedLabel.textContent = `Carry forward ${stagedCount} active staged ${stagedCount === 1 ? 'buffer' : 'buffers'} to new repository`;
  }
}

async function updateOwnerTargets() {
  if (!modalElement) return;
  const accountSelect = modalElement.querySelector('#genesisAccountSelect');
  const selectOwner = modalElement.querySelector('#genesisRepoOwnerSelect');
  if (!selectOwner) return;

  selectOwner.innerHTML = '<option value="">Loading...</option>';
  const selectedAccountId = accountSelect?.value;
  const currentAcc = activeAccountsCatalog.find((a) => a.accountId === selectedAccountId);

  let activeToken = '';
  let activeUsername = '';

  if (currentAcc && currentAcc.accountId !== 'live') {
    activeToken = 'demo-token';
    activeUsername = (currentAcc.username || '').replace(/^@/, '');
  } else if (isLive()) {
    activeToken = getLivePat();
    if (!activeToken) {
      selectOwner.innerHTML = '<option value="">Enter PAT above to load owners</option>';
      updateUrlPreview();
      return;
    }
    try {
      const res = await fetch('https://api.github.com/user', {
        headers: { Authorization: `token ${activeToken}`, Accept: 'application/vnd.github.v3+json' }
      });
      if (res.ok) {
        const u = await res.json();
        activeUsername = u.login;
      }
    } catch (_) {}
  } else {
    activeToken = await resolveTokenPlaintext(currentAcc);
  }

  selectOwner.innerHTML = '';
  const userOpt = document.createElement('option');
  userOpt.value = '';
  userOpt.textContent = `Personal (@${activeUsername || 'user'})`;
  selectOwner.appendChild(userOpt);

  if (activeToken) {
    let orgs = currentAcc && Array.isArray(currentAcc.orgs) ? currentAcc.orgs : [];
    if (!orgs.length) {
      orgs = await fetchUserOrganizations(activeToken);
    }
    orgs.forEach((org) => {
      const opt = document.createElement('option');
      opt.value = org;
      opt.textContent = `Organization: ${org}`;
      selectOwner.appendChild(opt);
    });
  }

  updateUrlPreview();
}

function updateUrlPreview() {
  if (!modalElement) return;
  const urlOwner = modalElement.querySelector('#genesisUrlOwner');
  const urlName = modalElement.querySelector('#genesisUrlName');
  const accountBadge = modalElement.querySelector('#genesisAccountBadge');
  const accountSelect = modalElement.querySelector('#genesisAccountSelect');
  const selectOwner = modalElement.querySelector('#genesisRepoOwnerSelect');
  const nameInput = modalElement.querySelector('#genesisRepoName');

  const selectedAccountId = accountSelect?.value;
  const currentAcc = activeAccountsCatalog.find((a) => a.accountId === selectedAccountId);
  const rawOwner = selectOwner?.value || (currentAcc ? currentAcc.username : 'user');
  const cleanOwner = String(rawOwner || 'user').replace(/^@/, '');
  const repoName = nameInput?.value.trim() || 'my-awesome-project';

  if (urlOwner) urlOwner.textContent = cleanOwner;
  if (urlName) {
    urlName.textContent = repoName;
    urlName.classList.toggle('is-empty', !nameInput?.value.trim());
  }

  if (accountBadge && currentAcc) {
    if (currentAcc.accountId === 'live') {
      accountBadge.textContent = 'Live · PAT';
    } else {
      const authType = currentAcc.authMethod === 'oauth'
        ? 'OAuth'
        : (currentAcc.tokenType === 'fine_grained' ? 'Fine-Grained' : 'PAT');
      accountBadge.textContent = `${authType} · ${String(currentAcc.vaultType).toUpperCase()}`;
    }
  }
}

async function handleGenesisSubmit() {
  if (!modalElement) return;
  const accountSelect = modalElement.querySelector('#genesisAccountSelect');
  const nameInput = modalElement.querySelector('#genesisRepoName');
  const descInput = modalElement.querySelector('#genesisRepoDesc');
  const ownerSelect = modalElement.querySelector('#genesisRepoOwnerSelect');
  const visRadio = modalElement.querySelector('input[name="genesisVis"]:checked');
  const pushStagedChk = modalElement.querySelector('#genesisPushStagedChk');
  const btnExecute = modalElement.querySelector('#btnExecuteGenesis');

  const repoName = (nameInput?.value || '').trim();
  if (!repoName) {
    showToast('Please enter a repository name.', 'warn');
    playCue('tick');
    nameInput?.focus();
    return;
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(repoName) || repoName.startsWith('.') || repoName.endsWith('.') || repoName.startsWith('-') || repoName.endsWith('.git')) {
    showToast('Invalid repository name format.', 'warn');
    playCue('tick');
    nameInput?.focus();
    return;
  }

  const selectedAccountId = accountSelect?.value;
  const currentAcc = activeAccountsCatalog.find((a) => a.accountId === selectedAccountId);

  let activeToken = '';
  if (currentAcc && currentAcc.accountId !== 'live') {
    activeToken = await resolveTokenPlaintext(currentAcc);
  } else if (isLive()) {
    activeToken = getLivePat();
  }
  if (!activeToken) {
    showToast('Authentication token is required to create a repository.', 'error');
    playCue('error');
    return;
  }

  const isPrivate = visRadio?.value === 'private';
  const orgName = ownerSelect?.value || '';
  const description = descInput?.value || '';

  if (isLive()) {
    const target = orgName ? `${orgName}/${repoName}` : repoName;
    const ok = window.confirm(`This will create a real repository on github.com: ${target}. Continue?`);
    if (!ok) return;
  }

  btnExecute.disabled = true;
  btnExecute.textContent = 'Creating...';
  playCue('whoosh');

  try {
    const newRepo = await createRemoteRepository({
      name: repoName,
      description,
      isPrivate,
      orgName,
      autoInit: true
    }, activeToken);

    const shouldKeepStaged = pushStagedChk && pushStagedChk.checked && DEMO_STAGED.size > 0;

    demoRepos.unshift({
      owner: newRepo.owner,
      repo: newRepo.repo,
      repoUrl: newRepo.repoUrl,
      defaultBranch: newRepo.defaultBranch,
      isPrivate: newRepo.isPrivate,
      createdAt: new Date().toLocaleString()
    });
    saveDemoRepos();
    renderHistory();

    if (!shouldKeepStaged) {
      DEMO_STAGED = new Set();
    }

    showToast(`Created repository @${newRepo.owner}/${newRepo.repo}!`, 'success');
    playCue('success');

    if (shouldKeepStaged) {
      showToast(`${DEMO_STAGED.size} staged ${DEMO_STAGED.size === 1 ? 'file' : 'files'} carried into @${newRepo.owner}/${newRepo.repo}.`, 'info', 4200);
    }

    closeRepoGenesisModal();
  } catch (err) {
    console.error('[Repo Genesis]', err);
    showToast(`Error: ${err.message}`, 'error', 4800);
    playCue('error');
  } finally {
    btnExecute.disabled = false;
    btnExecute.textContent = 'Create Repository';
  }
}

/* === Showcase page wiring === */
function wireShowcase() {
  document.getElementById('btnOpenModal')?.addEventListener('click', () => {
    initAudio();
    openRepoGenesisModal();
  });

  const toggleLive = document.getElementById('toggleLiveMode');
  const patInput = document.getElementById('livePatInput');
  const hint = document.getElementById('modeHint');

  toggleLive?.addEventListener('change', (e) => {
    const live = e.target.checked;
    if (patInput) patInput.style.display = live ? 'inline-block' : 'none';
    if (hint) {
      hint.textContent = live
        ? 'Live mode — requests go to api.github.com'
        : 'Demo mode — simulated responses';
    }
    if (modalElement && modalElement.classList.contains('active')) {
      populateInitialForm();
    }
  });

  patInput?.addEventListener('change', () => {
    if (modalElement && modalElement.classList.contains('active')) {
      populateInitialForm();
    }
  });

  renderHistory();
}

wireShowcase();