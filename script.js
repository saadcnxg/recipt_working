const SOUND_AUDIO_URL = 'assets/receipt.mp3.mpeg';
const DEFAULT_PRINT_DURATION = 1.75;

let printerAudio = null;
let isSoundMuted = false;
let lastSoundPlayTime = 0;
let audioCtx = null;
let cachedAudioBuffer = null;
let isAudioFetching = false;
let activeBufferSource = null;

try {
  isSoundMuted = localStorage.getItem('ghji_printer_mute') === 'true';
} catch (_) {}

try {
  const audio = getPrinterAudio();
  if (audio) audio.load();
} catch (_) {}

function getPrinterAudio() {
  if (!printerAudio && typeof Audio !== 'undefined') {
    printerAudio = new Audio(SOUND_AUDIO_URL);
    printerAudio.preload = 'auto';
    printerAudio.playsInline = true;
    printerAudio.volume = 0.6;
  }
  return printerAudio;
}

function stopActivePrinterSound() {
  if (printerAudio) {
    try {
      printerAudio.pause();
      printerAudio.currentTime = 0;
    } catch (_) {}
  }
  if (activeBufferSource) {
    try {
      activeBufferSource.stop();
    } catch (_) {}
    activeBufferSource = null;
  }
}

function playPrinterSound() {
  if (isSoundMuted) return;

  const now = Date.now();
  if (now - lastSoundPlayTime < 120) return;
  lastSoundPlayTime = now;

  try {
    const audio = getPrinterAudio();
    if (audio) {
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          return;
        }).catch(() => {
          synthesizeMechanicalPrinterNoise();
        });
        return;
      }
    }
  } catch (_) {}

  synthesizeMechanicalPrinterNoise();
}

function synthesizeMechanicalPrinterNoise() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!audioCtx) audioCtx = new AudioCtx();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});

    const now = audioCtx.currentTime;
    const stepCount = 10;
    const stepDuration = 0.16;

    const bufferSize = Math.floor(audioCtx.sampleRate * 0.08);
    const noiseBuf = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) noiseData[i] = Math.random() * 2 - 1;

    for (let i = 0; i < stepCount; i++) {
      const t = now + i * stepDuration;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(110 + (i % 2) * 35, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.04);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.05);

      const noiseSrc = audioCtx.createBufferSource();
      noiseSrc.buffer = noiseBuf;
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2200, t);
      filter.Q.setValueAtTime(1.8, t);
      const noiseGain = audioCtx.createGain();
      noiseGain.gain.setValueAtTime(0.05, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      noiseSrc.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(audioCtx.destination);
      noiseSrc.start(t);
      noiseSrc.stop(t + 0.07);
    }

    const cutTime = now + stepCount * stepDuration + 0.05;
    const cutNoise = audioCtx.createBufferSource();
    cutNoise.buffer = noiseBuf;
    const cutFilter = audioCtx.createBiquadFilter();
    cutFilter.type = 'highpass';
    cutFilter.frequency.setValueAtTime(3500, cutTime);
    const cutGain = audioCtx.createGain();

    cutGain.gain.setValueAtTime(0.12, cutTime);
    cutGain.gain.exponentialRampToValueAtTime(0.001, cutTime + 0.07);
    cutNoise.connect(cutFilter);
    cutFilter.connect(cutGain);
    cutGain.connect(audioCtx.destination);
    cutNoise.start(cutTime);
    cutNoise.stop(cutTime + 0.08);

    setTimeout(() => {
      if (audioCtx && audioCtx.state === 'running') {
        audioCtx.suspend().catch(() => {});
      }
    }, 2000);
  } catch (_) {}
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderBomReceiptModal(deployedData = {}) {
  const existingModal = document.getElementById('cdagBomModal');
  if (existingModal) existingModal.remove();

  const sha = deployedData.sha || '362f021';
  const shortSha = sha.length > 7 ? sha.substring(0, 7) : sha;
  const branch = deployedData.branch || 'worker';
  const repoOwner = deployedData.repoOwner || 'chromamint';
  const repoName = deployedData.repoName || 'GitWeb-Ji';

  const commitUrl = deployedData.commitUrl || `https://github.com/${repoOwner}/${repoName}/commit/${sha}`;

  const profile = {
    subtitle: 'DEPLOYMENT RECEIPT // PERSISTENT DOM',
    target: `@${repoOwner}/${repoName} : ${branch}`,
    digestLabel: 'COMMIT HASH',
    digestVal: shortSha,
    statusText: 'DEPLOYED_OK',
    externalUrl: commitUrl,
    externalTitle: 'View Commit on GitHub',
    barcodeDigest: `* ${shortSha.toUpperCase()}-VERIFIED *`
  };

  const timestampIso = deployedData.timestamp 
    ? new Date(deployedData.timestamp).toISOString().replace('T', ' ').substring(0, 19) + ' UTC'
    : '2026-10-06 02:36:54 UTC';

  const fileItems = deployedData.committedFiles || [
    { filePath: 'src/features/repo-genesis/genesis-modal.js', status: 'modified' }
  ];

  const githubIconSvg = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
    </svg>`;

  const modalOverlay = document.createElement('div');
  modalOverlay.id = 'cdagBomModal';
  modalOverlay.className = 'pos-backdrop active';
  modalOverlay.setAttribute('aria-hidden', 'false');

  const fileRowsHtml = fileItems.map(f => {
    const rawPath = f.filePath || '';
    const parts = rawPath.split('/');
    const name = parts.pop() || rawPath;
    const dir = parts.length > 0 ? parts.join('/') + '/' : '';

    let badge = 'MODIFIED';
    if (f.status === 'deleted') badge = 'DELETED';
    else if (f.status === 'new') badge = 'NEW';
    else if (f.status === 'mutated') badge = 'ITERATED';

    return `
      <div class="pos-item-row">
        <div class="pos-item-desc">
          ${dir ? `<span class="pos-item-path">${escapeHtml(dir)}</span>` : ''}
          <span class="pos-item-name">${escapeHtml(name)}</span>
        </div>
        <span class="pos-item-badge">${badge}</span>
      </div>
    `;
  }).join('');

  modalOverlay.innerHTML = `
    <section class="printer-root" id="receipt-printer" data-stage="printing">
      <div class="printer-machine">
        
        <div class="printer-header">
          <div class="header-logo" title="ZeroCommit Core">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div class="printer-header-right">
            <button type="button" class="printer-mute-toggle ${isSoundMuted ? 'muted' : ''}" id="printerMuteBtn" title="${isSoundMuted ? 'Unmute' : 'Mute'} Sound">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path class="sound-wave" d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                <line class="mute-slash" x1="23" y1="9" x2="17" y2="15"></line>
                <line class="mute-slash" x1="17" y1="9" x2="23" y2="15"></line>
              </svg>
            </button>
            <button type="button" class="home-btn" id="machineHomeBtn">
              <span>Close</span>
            </button>
          </div>
        </div>

        <div class="printer-micro-strip">
          <div class="strip-status-col">
            <span class="status-led icon-spin" id="microStripLed"></span>
            <span class="status-label" id="microStripLabel">PRINTING...</span>
          </div>

          <div class="strip-meta">
            <span class="strip-branch" title="${escapeHtml(profile.target)}">${escapeHtml(branch)}</span>
            <span class="strip-sep">·</span>
            <span class="strip-digest">${escapeHtml(profile.digestVal)}</span>
          </div>
        </div>

        <div class="printer-slot-area">
          <div class="printer-slot-hole"></div>

          <div class="printer-output-chute" id="printerOutputChute">
            <div class="printer-paper-container" aria-hidden="true" id="printerPaperContainer">
              <article class="printer-paper" id="receiptPaper">
                
                <header class="receipt-header">
                  <div class="receipt-brand-center">
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" class="receipt-logo">
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <a href="https://zerocommit.dev" target="_blank" rel="noopener noreferrer" class="app-domain">zerocommit.dev</a>
                    <span class="receipt-subtitle">${escapeHtml(profile.subtitle)}</span>
                  </div>
                </header>

                <div class="rule-dashed"></div>

                <section class="receipt-meta">
                  <div class="meta-row">
                    <span class="lbl">STATUS</span>
                    <span class="val bold">${escapeHtml(profile.statusText)}</span>
                  </div>
                  <div class="meta-row">
                    <span class="lbl">TARGET</span>
                    <span class="val">${escapeHtml(profile.target)}</span>
                  </div>
                  <div class="meta-row">
                    <span class="lbl">${escapeHtml(profile.digestLabel)}</span>
                    <span class="val">${escapeHtml(profile.digestVal)}</span>
                  </div>
                  <div class="meta-row">
                    <span class="lbl">TIMESTAMP</span>
                    <span class="val">${escapeHtml(timestampIso)}</span>
                  </div>
                </section>

                <div class="rule-dashed"></div>

                <section class="receipt-items">
                  <div class="items-heading">
                    <span>COMMITTED ARTIFACTS (${fileItems.length})</span>
                    <span>STATE</span>
                  </div>

                  <div class="items-list" id="posReceiptItemsList">
                    ${fileRowsHtml}
                  </div>
                </section>

                <div class="rule-solid"></div>

                <section class="receipt-summary">
                  <div class="summary-row">
                    <span>ITEMS TOTAL</span>
                    <span class="bold">${fileItems.length} FILES</span>
                  </div>
                  <div class="summary-row">
                    <span>CHECK INTEGRITY</span>
                    <span>SHA-256 MATCHED</span>
                  </div>
                </section>

                <div class="receipt-barcode">
                  <div class="barcode-lines" aria-hidden="true">
                    <span></span><span></span><span></span><span></span><span></span>
                    <span></span><span></span><span></span><span></span><span></span>
                    <span></span><span></span><span></span><span></span><span></span>
                    <span></span><span></span><span></span><span></span><span></span>
                    <span></span><span></span><span></span><span></span><span></span>
                    <span></span><span></span><span></span><span></span><span></span>
                  </div>
                  <span class="barcode-digest">${escapeHtml(profile.barcodeDigest)}</span>
                </div>

                <footer class="receipt-actions">
                  <a href="${escapeHtml(profile.externalUrl)}" target="_blank" rel="noopener noreferrer" class="icon-deck-btn" id="deckExternalBtn" title="${escapeHtml(profile.externalTitle)}">
                    ${githubIconSvg}
                  </a>
                  <button id="screenshotBtn" class="icon-deck-btn" title="Save Receipt Snapshot (PNG)">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                  </button>
                  <button id="swallowBtn" class="icon-deck-btn" title="Swallow / Retract Receipt into Slot">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M12 19V5M5 12l7-7 7 7"/>
                    </svg>
                  </button>
                </footer>

              </article>
            </div>
          </div>
        </div>

      </div>
    </section>
  `;

  document.body.appendChild(modalOverlay);

  const printerRoot = modalOverlay.querySelector('#receipt-printer');
  const paperContainer = modalOverlay.querySelector('#printerPaperContainer');
  const receiptPaper = modalOverlay.querySelector('#receiptPaper');
  const printerOutputChute = modalOverlay.querySelector('#printerOutputChute');
  const machineHomeBtn = modalOverlay.querySelector('#machineHomeBtn');
  const muteBtn = modalOverlay.querySelector('#printerMuteBtn');
  const swallowBtn = modalOverlay.querySelector('#swallowBtn');
  const screenshotBtn = modalOverlay.querySelector('#screenshotBtn');
  const microLed = modalOverlay.querySelector('#microStripLed');
  const microLabel = modalOverlay.querySelector('#microStripLabel');

  function setStage(stage) {
    if (!printerRoot) return;
    printerRoot.setAttribute('data-stage', stage);
    if (paperContainer) {
      paperContainer.setAttribute('aria-hidden', stage !== 'complete');
    }

    if (stage === 'printing') {
      if (microLed) microLed.className = 'status-led icon-spin';
      if (microLabel) {
        microLabel.className = 'status-label';
        microLabel.textContent = 'PRINTING...';
      }

      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        setStage('complete');
      };

      if (!isSoundMuted) {
        const audio = getPrinterAudio();
        if (audio) {
          try {
            audio.currentTime = 0;
            const playPromise = audio.play();
            if (playPromise && typeof playPromise.then === 'function') {
              playPromise.then(() => {
                audio.addEventListener('ended', finish, { once: true });
              }).catch(() => {
                synthesizeMechanicalPrinterNoise();
              });
            } else {
              audio.addEventListener('ended', finish, { once: true });
            }
          } catch (_) {
            synthesizeMechanicalPrinterNoise();
          }
        } else {
          synthesizeMechanicalPrinterNoise();
        }
      }

      const durStr = printerRoot.style.getPropertyValue('--print-duration').trim() || `${DEFAULT_PRINT_DURATION}s`;
      const durMs = parseFloat(durStr) * 1000 || DEFAULT_PRINT_DURATION * 1000;
      paperContainer?.addEventListener('animationend', finish, { once: true });
      setTimeout(finish, durMs + 400);
    } else if (stage === 'complete') {
      if (microLed) microLed.className = 'status-led complete';
      if (microLabel) {
        microLabel.className = 'status-label complete';
        microLabel.textContent = profile.statusText;
      }
      if (printerOutputChute) {
        printerOutputChute.style.overflow = 'visible';
        printerOutputChute.style.pointerEvents = 'auto';
      }
    }
  }

  try {
    const audio = getPrinterAudio();
    const detected = (audio && !audio.error && isFinite(audio.duration) && audio.duration > 0.3) ? audio.duration : null;
    const printDuration = (!isSoundMuted && detected) ? detected : DEFAULT_PRINT_DURATION;
    printerRoot.style.setProperty('--print-duration', `${printDuration}s`);
  } catch (_) {
    printerRoot.style.setProperty('--print-duration', `${DEFAULT_PRINT_DURATION}s`);
  }

  setStage('printing');

  muteBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    isSoundMuted = !isSoundMuted;
    if (isSoundMuted) stopActivePrinterSound();
    try {
      localStorage.setItem('ghji_printer_mute', String(isSoundMuted));
    } catch (_) {}
    muteBtn.classList.toggle('muted', isSoundMuted);
    muteBtn.title = isSoundMuted ? 'Unmute Sound' : 'Mute Sound';
  });

  let isDismissing = false;
  const dismissModalWithSwallow = () => {
    if (isDismissing) return;
    isDismissing = true;
    stopActivePrinterSound();
    window.removeEventListener('keydown', handleEsc);

    if (printerOutputChute) {
      printerOutputChute.style.overflow = 'hidden';
      printerOutputChute.style.pointerEvents = 'none';
    }

    if (printerRoot) {
      printerRoot.setAttribute('data-stage', 'swallowing');
    }

    if (receiptPaper) {
      receiptPaper.classList.remove('swallowing');
      void receiptPaper.offsetWidth;
      receiptPaper.classList.add('swallowing');
    }

    setTimeout(() => {
      modalOverlay.classList.remove('active');
      modalOverlay.remove();
    }, 450);
  };

  const handleEsc = (e) => {
    if (e.key === 'Escape') dismissModalWithSwallow();
  };
  window.addEventListener('keydown', handleEsc);

  machineHomeBtn?.addEventListener('click', dismissModalWithSwallow);
  swallowBtn?.addEventListener('click', dismissModalWithSwallow);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) dismissModalWithSwallow();
  });

  screenshotBtn?.addEventListener('click', async () => {
    if (!window.html2canvas) return;
    const canvas = await window.html2canvas(receiptPaper, {
      scale: 2,
      backgroundColor: '#f7f7f7',
      useCORS: true
    });
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `receipt-${shortSha}.png`;
    a.click();
  });
}

document.getElementById('btnTriggerReceipt').addEventListener('click', () => {
  renderBomReceiptModal({
    sha: '362f021',
    branch: 'worker',
    repoOwner: 'chromamint',
    repoName: 'GitWeb-Ji',
    timestamp: '2026-10-06T02:36:54Z',
    committedFiles: [
      { filePath: 'src/features/repo-genesis/genesis-modal.js', status: 'modified' }
    ]
  });
});