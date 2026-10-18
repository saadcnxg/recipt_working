(function () {
  const deploys = [
    {
      id: 't1',
      title: 'T1',
      added: 130,
      deleted: 0,
      isNew: true,
      files: [
        { path: 'index.html', lines: 68 },
        { path: 'styles.css', lines: 62 }
      ]
    },
    {
      id: 't1-t2',
      title: 'T1 → T2',
      added: 84,
      deleted: 12,
      isNew: false,
      files: [
        { path: 'sound.js', lines: 52 },
        { path: 'genesis.js', lines: 44 }
      ]
    }
  ];

  const artifacts = [
    { name: 'index.html', state: 'NEW' },
    { name: 'styles.css', state: 'NEW' },
    { name: 'sound.js', state: 'NEW' },
    { name: 'genesis.js', state: 'ITERATED' }
  ];

  const els = {
    list: document.getElementById('deployList'),
    ship: document.getElementById('shipBtn'),
    refresh: document.getElementById('refreshBtn'),
    totalAdded: document.querySelector('.counters .added'),
    totalDeleted: document.querySelector('.counters .deleted'),
    confirmOverlay: document.getElementById('confirmOverlay'),
    okBtn: document.getElementById('okBtn'),
    cancelBtn: document.getElementById('cancelBtn'),
    receiptOverlay: document.getElementById('receiptOverlay'),
    receiptPaper: document.getElementById('receiptPaper'),
    receiptStatus: document.getElementById('receiptStatus'),
    statusText: document.querySelector('.status-text'),
    closeReceipt: document.getElementById('closeReceipt'),
    soundToggle: document.getElementById('soundToggle'),
    timestamp: document.getElementById('timestamp'),
    artifacts: document.getElementById('artifacts')
  };

  function renderDeploys() {
    els.list.innerHTML = deploys.map(d => `
      <div class="deploy-block" data-id="${d.id}">
        <div class="block-header" role="button" tabindex="0" aria-expanded="false">
          <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          <span class="block-title">${d.title}</span>
          ${d.isNew ? '<span class="badge-new">NEW</span>' : ''}
          <span class="block-stats">
            <span class="added">+${d.added}</span>
            <span class="deleted">-${d.deleted}</span>
          </span>
          <button class="edit-btn" type="button" data-edit>Edit</button>
        </div>
        <div class="block-body">
          <div class="block-body-inner">
            ${d.files.map(f => `<code>${f.path} <span style="color:#666">(+${f.lines})</span></code>`).join('')}
          </div>
        </div>
      </div>
    `).join('');

    els.list.querySelectorAll('.deploy-block').forEach(block => {
      const head = block.querySelector('.block-header');
      const toggle = () => {
        const open = block.classList.toggle('open');
        head.setAttribute('aria-expanded', String(open));
      };
      head.addEventListener('click', (e) => {
        if (e.target.closest('[data-edit]')) return;
        toggle();
      });
      head.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (e.target.closest('[data-edit]')) return;
          e.preventDefault();
          toggle();
        }
      });
    });
  }

  function renderArtifacts() {
    els.artifacts.innerHTML = artifacts.map(a => `
      <li>
        <span class="file">${a.name}</span>
        <span class="badge ${a.state === 'NEW' ? 'new' : 'iter'}">${a.state}</span>
      </li>
    `).join('');
  }

  function updateCounters() {
    const added = deploys.reduce((s, d) => s + d.added, 0);
    const deleted = deploys.reduce((s, d) => s + d.deleted, 0);
    els.totalAdded.textContent = `+${added}`;
    els.totalDeleted.textContent = `-${deleted}`;
  }

  function formatTimestamp() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return (
      d.getUTCFullYear() + '-' +
      pad(d.getUTCMonth() + 1) + '-' +
      pad(d.getUTCDate()) + ' ' +
      pad(d.getUTCHours()) + ':' +
      pad(d.getUTCMinutes()) + ':' +
      pad(d.getUTCSeconds()) + ' UTC'
    );
  }

  function openConfirm() {
    els.confirmOverlay.hidden = false;
    els.okBtn.focus();
  }
  function closeConfirm() {
    els.confirmOverlay.hidden = true;
    els.ship.focus();
  }

  function openReceipt() {
    els.timestamp.textContent = formatTimestamp();
    els.receiptOverlay.hidden = false;
    els.receiptStatus.classList.remove('printed');
    els.statusText.textContent = '... PRINTING...';

    els.receiptPaper.classList.remove('printing');
    void els.receiptPaper.offsetWidth;
    els.receiptPaper.classList.add('printing');

    window.printerSound.unlock();
    window.printerSound.play();

    clearTimeout(openReceipt._t);
    openReceipt._t = setTimeout(() => {
      els.receiptStatus.classList.add('printed');
      els.statusText.textContent = '✓ PRINTED';
    }, 2200);
  }

  function closeReceipt() {
    els.receiptOverlay.hidden = true;
    clearTimeout(openReceipt._t);
  }

  function refresh() {
    els.refresh.style.transform = 'rotate(360deg)';
    setTimeout(() => { els.refresh.style.transform = ''; }, 500);
    updateCounters();
  }

  els.ship.addEventListener('click', openConfirm);
  els.cancelBtn.addEventListener('click', closeConfirm);
  els.okBtn.addEventListener('click', () => { closeConfirm(); openReceipt(); });
  els.closeReceipt.addEventListener('click', closeReceipt);
  els.refresh.addEventListener('click', refresh);

  els.confirmOverlay.addEventListener('click', (e) => {
    if (e.target === els.confirmOverlay) closeConfirm();
  });
  els.receiptOverlay.addEventListener('click', (e) => {
    if (e.target === els.receiptOverlay) closeReceipt();
  });

  els.soundToggle.addEventListener('click', () => {
    const next = !window.printerSound.isMuted();
    window.printerSound.setMuted(next);
    els.soundToggle.classList.toggle('muted', next);
    els.soundToggle.setAttribute('aria-pressed', String(next));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!els.receiptOverlay.hidden) closeReceipt();
      else if (!els.confirmOverlay.hidden) closeConfirm();
    }
  });

  renderDeploys();
  renderArtifacts();
  updateCounters();
})();