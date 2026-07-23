/* ═══════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════ */
let currentNoteId   = null;
let currentFolderId = null;
let folders         = [];
let saveTimer       = null;
let isDirty         = false;

/* ═══════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════ */
async function init() {
  await loadFolders();
  // Auto-open Quick Notes and load/create the first note
  const qn = folders.find(f => f.id === 'quick-notes');
  if (qn) {
    await selectFolder('quick-notes', false); // load notes list silently
    const notes = await fetchNotes('quick-notes');
    if (notes.length > 0) {
      await openNote(notes[0].id);
    } else {
      await createNote(false); // create silently without opening panel
    }
  }
}

/* ═══════════════════════════════════════════════
   API HELPERS
   ═══════════════════════════════════════════════ */
async function api(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch('/api' + path, opts);
  return r.json();
}

async function fetchNotes(folderId) {
  return api(`/folders/${folderId}/notes`);
}

/* ═══════════════════════════════════════════════
   FOLDERS
   ═══════════════════════════════════════════════ */
async function loadFolders() {
  folders = await api('/folders');
  renderFolderList();
}

function renderFolderList() {
  const list = document.getElementById('folder-list');
  list.innerHTML = '';
  folders.forEach(f => {
    const el = document.createElement('div');
    el.className = 'folder-item' + (f.id === currentFolderId ? ' active' : '');
    el.innerHTML = `
      <span class="folder-icon">${f.icon}</span>
      <div class="folder-info">
        <div class="folder-name">${esc(f.name)}</div>
        <div class="folder-count">${f.note_count} Notiz${f.note_count !== 1 ? 'en' : ''}</div>
      </div>
      <span class="folder-chevron">›</span>`;
    el.onclick = () => selectFolder(f.id);
    list.appendChild(el);
  });
}

async function selectFolder(folderId, openPanel = true) {
  currentFolderId = folderId;
  renderFolderList();
  const folder = folders.find(f => f.id === folderId);
  document.getElementById('notes-folder-title').textContent = folder ? folder.name : '';
  // load notes
  const notes = await fetchNotes(folderId);
  renderNoteList(notes);
  showNotesView();
  if (openPanel) openSidePanel();
}

/* ═══════════════════════════════════════════════
   NOTES LIST
   ═══════════════════════════════════════════════ */
function renderNoteList(notes) {
  const list = document.getElementById('note-list');
  list.innerHTML = '';
  if (notes.length === 0) {
    list.innerHTML = '<div style="padding:20px 16px;color:var(--text-placeholder);font-size:13px;text-align:center">Noch keine Notizen</div>';
    return;
  }
  notes.forEach(n => {
    const el = document.createElement('div');
    el.className = 'note-card' + (n.id === currentNoteId ? ' active' : '');
    el.innerHTML = `
      <div class="note-card-title">${esc(n.title) || 'Ohne Titel'}</div>
      <div class="note-card-preview">${esc(n.preview) || '—'}</div>
      <div class="note-card-date">${formatDate(n.updated)}</div>`;
    el.onclick = () => openNote(n.id);
    list.appendChild(el);
  });
}

/* ═══════════════════════════════════════════════
   OPEN / CREATE NOTE
   ═══════════════════════════════════════════════ */
async function openNote(noteId) {
  if (isDirty) await saveCurrentNote();
  const note = await api(`/notes/${noteId}`);
  currentNoteId = noteId;

  document.getElementById('note-title-input').value = note.title === 'New Note' ? '' : note.title;
  document.getElementById('editor').innerHTML = note.content || '';
  updateDateLine(note.updated);
  updateToolbarTitle(note.title, note.folder_id);

  // show editor, hide empty state
  setEditorVisible(true);

  closeSidePanel();
  document.getElementById('note-title-input').focus();

  // highlight active card
  document.querySelectorAll('.note-card').forEach(c => {
    c.classList.toggle('active', c.onclick && c.getAttribute('data-id') === noteId);
  });
  // refresh note list highlight
  if (currentFolderId) {
    const notes = await fetchNotes(currentFolderId);
    renderNoteList(notes);
  }
}

async function createNote(openPanel = true) {
  if (!currentFolderId) currentFolderId = 'quick-notes';
  if (isDirty) await saveCurrentNote();
  const note = await api(`/folders/${currentFolderId}/notes`, 'POST');
  currentNoteId = note.id;

  document.getElementById('note-title-input').value = '';
  document.getElementById('editor').innerHTML = '';
  updateDateLine(note.updated);
  updateToolbarTitle('Neue Notiz', currentFolderId);
  setEditorVisible(true);

  await loadFolders(); // refresh counts
  if (currentFolderId) {
    const notes = await fetchNotes(currentFolderId);
    renderNoteList(notes);
  }

  closeSidePanel();
  document.getElementById('note-title-input').focus();
}

/* ═══════════════════════════════════════════════
   SAVE
   ═══════════════════════════════════════════════ */
function scheduleSave() {
  isDirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveCurrentNote, parseInt(getComputedStyle(document.documentElement)
    .getPropertyValue('--save-delay')) || 800);
}

async function saveCurrentNote() {
  if (!currentNoteId || !isDirty) return;
  isDirty = false;
  clearTimeout(saveTimer);
  const title = document.getElementById('note-title-input').value.trim() || 'Ohne Titel';
  const content = document.getElementById('editor').innerHTML;
  const note = await api(`/notes/${currentNoteId}`, 'PUT', { title, content });
  updateToolbarTitle(note.title, note.folder_id);
  updateDateLine(note.updated);
  showSaveIndicator();
  // refresh sidebar if visible
  if (currentFolderId) {
    const notes = await fetchNotes(currentFolderId);
    renderNoteList(notes);
    await loadFolders();
  }
}

function showSaveIndicator() {
  const el = document.getElementById('save-indicator');
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 2000);
}

/* ═══════════════════════════════════════════════
   FORMAT COMMANDS
   (hier neue Formatierungen ergänzen)
   ═══════════════════════════════════════════════ */
function fmt(cmd, value = null) {
  if(cmd == 'insertHTML' && value == 'input') {
    value = '<input type="checkbox" class="checkbox">';
  }
  if (cmd === 'formatBlock' && value) {
    const isActive = isHeadingActive(value.toUpperCase());
    value = isActive ? 'p' : value;
  }

  document.getElementById('editor').focus();
  document.execCommand(cmd, false, value);
  updateFmtButtons();
  scheduleSave();
}

function updateFmtButtons() {
  document.getElementById('fmt-bold').classList.toggle('active',   document.queryCommandState('bold'));
  document.getElementById('fmt-italic').classList.toggle('active', document.queryCommandState('italic'));
  document.getElementById('fmt-ul').classList.toggle('active',     document.queryCommandState('insertUnorderedList'));
  document.getElementById('fmt-ol').classList.toggle('active',     document.queryCommandState('insertOrderedList'));
  updateHeadingButtons();
}

function updateHeadingButtons() {
  const selection = window.getSelection();
  if (!selection.rangeCount) {
    ['fmt-h1', 'fmt-h2', 'fmt-h3'].forEach(id => {
      document.getElementById(id).classList.remove('active');
    });
    return;
  }

  const container = selection.getRangeAt(0).startContainer;
  let element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;

  // Traverse up to find heading or paragraph
  while (element && element !== document.getElementById('editor')) {
    if (element.tagName === 'H1' || element.tagName === 'H2' || element.tagName === 'H3') {
      ['fmt-h1', 'fmt-h2', 'fmt-h3'].forEach((id, index) => {
        document.getElementById(id).classList.toggle('active', element.tagName === `H${index + 1}`);
      });
      return;
    }
    element = element.parentElement;
  }

  // Default to paragraph (no heading active)
  ['fmt-h1', 'fmt-h2', 'fmt-h3'].forEach(id => {
    document.getElementById(id).classList.remove('active');
  });
}

function isHeadingActive(tag) {
  const editor = document.getElementById('editor');
  const selection = window.getSelection();
  if (!selection.rangeCount) return false;

  let node = selection.getRangeAt(0).startContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;

  while (node && node !== editor) {
    if (node.tagName === tag) return true;
    node = node.parentElement;
  }
  return false;
}

/* ═══════════════════════════════════════════════
   SIDE PANEL
   ═══════════════════════════════════════════════ */
function openSidePanel() {
  document.getElementById('side-panel').classList.add('open');
  document.getElementById('overlay').style.display = 'block';
  requestAnimationFrame(() => document.getElementById('overlay').classList.add('visible'));
}

function closeSidePanel() {
  document.getElementById('side-panel').classList.remove('open');
  const ov = document.getElementById('overlay');
  ov.classList.remove('visible');
  setTimeout(() => { ov.style.display = 'none'; }, 250);
}

function showFolderView() {
  document.getElementById('folders-view').classList.remove('hidden');
  document.getElementById('notes-view').classList.remove('visible');
}

function showNotesView() {
  document.getElementById('folders-view').classList.add('hidden');
  document.getElementById('notes-view').classList.add('visible');
}

/* ═══════════════════════════════════════════════
   MODAL
   ═══════════════════════════════════════════════ */
function openNewFolderModal() {
  const sheet = document.getElementById('modal-sheet');
  sheet.innerHTML = `
    <div class="modal-title">Neuer Ordner</div>
    <input class="modal-input" id="new-folder-name" placeholder="Ordnername" type="text" autocomplete="off">
    <div class="modal-btn-row">
      <button class="modal-btn secondary" onclick="closeModal()">Abbrechen</button>
      <button class="modal-btn primary"   onclick="submitNewFolder()">Erstellen</button>
    </div>`;
  document.getElementById('modal-backdrop').classList.add('visible');
  setTimeout(() => document.getElementById('new-folder-name').focus(), 100);
}

async function submitNewFolder() {
  const name = document.getElementById('new-folder-name').value.trim();
  if (!name) return;
  await api('/folders', 'POST', { name, icon: '📁' });
  await loadFolders();
  closeModal();
}

function closeModal(event) {
  if (event && event.target !== document.getElementById('modal-backdrop')) return;
  document.getElementById('modal-backdrop').classList.remove('visible');
}

/* ═══════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════ */
function setEditorVisible(visible) {
  document.getElementById('note-title-input').style.display = visible ? '' : 'none';
  document.getElementById('note-date-line').style.display  = visible ? '' : 'none';
  document.getElementById('editor').style.display          = visible ? '' : 'none';
  document.getElementById('empty-state').classList.toggle('visible', !visible);
}

function updateToolbarTitle(title, folderId) {
  document.getElementById('note-title-display').textContent = title || 'Neue Notiz';
  const folder = folders.find(f => f.id === folderId);
  document.getElementById('folder-badge').textContent = folder ? folder.name : '';
}

function updateDateLine(iso) {
  const d = new Date(iso + 'Z');
  document.getElementById('note-date-line').textContent = d.toLocaleString('de-DE', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatDate(iso) {
  const d = new Date(iso + 'Z');
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60)   return 'Gerade eben';
  if (diff < 3600) return `Vor ${Math.floor(diff/60)} Min.`;
  if (diff < 86400 && d.getDate() === now.getDate()) return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
}

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ═══════════════════════════════════════════════
   EVENT LISTENERS
   ═══════════════════════════════════════════════ */
document.getElementById('menu-btn').addEventListener('click', () => {
  saveCurrentNote();
  showFolderView();
  openSidePanel();
});

document.getElementById('panel-close').addEventListener('click', closeSidePanel);
document.getElementById('overlay').addEventListener('click', closeSidePanel);

document.getElementById('note-title-input').addEventListener('input', function () {
  // auto-resize
  this.style.height = 'auto';
  this.style.height = this.scrollHeight + 'px';
  scheduleSave();
});

document.getElementById('editor').addEventListener('input', () => {
  scheduleSave();
  updateFmtButtons();
});

document.getElementById('editor').addEventListener('keyup', updateFmtButtons);
document.getElementById('editor').addEventListener('mouseup', updateFmtButtons);
document.getElementById('editor').addEventListener('selectionchange', updateFmtButtons);

// save on visibility change (phone locks / switches app)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveCurrentNote();
});

// prevent accidental navigation
window.addEventListener('beforeunload', () => {
  if (isDirty) saveCurrentNote();
});

/* ═══════════════════════════════════════════════
   START
   ═══════════════════════════════════════════════ */
setEditorVisible(false);
init();
