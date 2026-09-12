const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const icon = (n, cl = "") => `<i data-lucide="${n}" class="${cl}"></i>`;
const btn = (text, act, ic = "", cl = "") =>
  `<button type="button" class="${cl}" data-action="${act}"${text ? ` title="${esc(text)}" aria-label="${esc(text)}"` : ""}>${ic ? icon(ic) : ""}${text ? `<span>${text}</span>` : ""}</button>`;
const labels = {
  workspace: "내 작업공간",
  clock: "시계",
  idea: "아이디어",
  note: "노트",
  study: "공부용 시계",
  plan: "계획",
  pdf: "PDF 뷰어",
  words: "단어장",
  calendar: "캘린더",
  favorites: "즐겨찾기",
  recent: "최근 사용",
  trash: "휴지통",
  settings: "데이터 관리",
};
const icons = {
  workspace: "folder",
  clock: "clock",
  idea: "lightbulb",
  note: "file-text",
  study: "timer",
  plan: "list-checks",
  pdf: "file-search",
  words: "book-open",
  calendar: "calendar-days",
  favorites: "star",
  recent: "history",
  trash: "trash-2",
  settings: "database",
  folder: "folder",
};
let user = null,
  files = [],
  tab = "workspace",
  folder = null,
  opened = null,
  query = "",
  collapsed = false,
  signup = false,
  wordIndex = 0,
  reveal = false,
  month = new Date(),
  sync = "이 기기에 저장",
  saveTimer,
  cloudConfigured = false;
let timer = { remaining: 1500, end: 0, running: false },
  timerModes = { clock: "clock", study: "focus" },
  stopwatches = {
    clock: { elapsed: 0, startedAt: 0, running: false, laps: [] },
    study: { elapsed: 0, startedAt: 0, running: false, laps: [] },
  },
  ticks = 0;
let saveMenu = false;
let richDirty = false;
let cardMenu = null;
let sharedSession = null;
let parkedShare = null;
let openedTabs = {};
const pdfBlobs = new Map();
const pdfUrls = new Map();
const pdfLoads = new Map();
let pdfMigrationRunning = false;
function closeDocument(destination = tab) {
  const file = current();
  if (!file) { nav(destination);return; }
  clearTimeout(saveTimer);
  if ($('#edit-title')) {
    file.name = $('#edit-title').value.trim() || '제목 없음';
    file.body = $('#edit-body').value;
  }
  const session = sharedSession;
  const closingTab = tab;
  modal.className = '';
  modal.innerHTML = `<h2>저장하셨나요?</h2><p>${esc(file.name)}</p><p id="close-error" role="status"></p><div class="actions"><button type="button" id="close-cancel" style="margin-right:auto">취소</button><button type="button" id="close-discard">저장하지 않습니다</button><button type="button" id="close-save" class="primary">저장</button></div>`;
  $('#close-cancel').onclick = () => modal.close();
  const finish = () => {
    if (session) { stopShared?.();sharedSession=null;shareDirty=false;history.replaceState(null,'',location.pathname+location.search); }
    delete openedTabs[closingTab];
    delete drafts[closingTab];
    opened=null;tab=destination;folder=null;saveMenu=false;
    modal.close();render();
  };
  $('#close-discard').onclick = finish;
  $('#close-save').onclick = async () => {
    const buttons = modal.querySelectorAll('button');
    buttons.forEach(button=>button.disabled=true);
    try {
      if (shareSaving) throw Error('저장 중입니다. 잠시 후 다시 눌러주세요.');
      const saved = JSON.parse(JSON.stringify(file));
      if (session && session.owner !== user.id) {
        saved.id=crypto.randomUUID();saved.parent=null;saved.created=Date.now();
        delete saved.shareId;delete saved.revision;
        if (saved.type === 'pdf') {
          saved.data = await blobDataUrl(await pdfBlob(file));
          saved.hasPdfBody = true;
        }
      }
      saved.modified=Date.now();
      if (user.cloud) await cloud.save(user.id,saved);
      const index=files.findIndex(item=>item.id===saved.id);
      if(index<0) files.push(saved);else files[index]=saved;
      cache();finish();notice('작업공간에 저장했습니다.');
    } catch(error) { $('#close-error').textContent=error.message;buttons.forEach(button=>button.disabled=false); }
  };
  modal.showModal();
}
let stopShared = null;
let shareDirty = false;
let shareSaving = false;
let sharingTarget = null;
async function sharingDialog(targetId) {
  const file = targetId ? files.find(item => item.id === targetId && !item.deleted) : current();
  if (!file || !user.cloud) return notice('로그인 후 저장한 파일을 공유할 수 있습니다.');
  if (!targetId && sharedSession && sharedSession.owner !== user.id) return notice('소유자만 공유 권한을 변경할 수 있습니다.');
  sharingTarget = file;
  flush();
  if (!file.shareId) await cloud.save(user.id, file);
  const info = file.shareId ? await cloud.shareInfo(file.shareId) : null;
  showModal('링크 공유', `<p>${esc(file.name)}</p>${file.type === 'folder' ? '<p>현재 내부 폴더와 파일에 같은 공유 권한이 적용됩니다. 기존 개별 링크의 권한도 변경됩니다. 파일을 추가·이동한 뒤에는 여기서 확인을 눌러 목록을 갱신해주세요. 공유 해제는 현재 내부 항목의 개별 링크도 해제합니다.</p>' : ''}<label>링크가 있는 로그인 사용자</label><select name="role"><option value="viewer">뷰어 · 읽기 전용</option><option value="editor">편집자 · 내용 수정 가능</option></select><input id="share-link" aria-label="공유 링크" readonly value="${file.shareId && info ? 'https://workspace-app-jeh.pages.dev/#share=' + file.shareId : ''}" placeholder="확인을 누르면 링크가 생성됩니다.">${btn('링크 복사','share-copy','copy')}${info ? btn('공유 해제','share-revoke','link-2-off') : ''}`, async data => {
    await (file.type === 'folder' ? cloud.shareFolder(user.id, file, data.get('role')) : cloud.share(user.id, file, data.get('role')));
    cache();
    notice('공유 링크를 생성했습니다. 링크 복사를 눌러주세요.');
    setTimeout(() => sharingDialog(targetId), 0);
  });
  modal.querySelector('select').value = info?.role || 'viewer';
}
let sharedFolderTrail = [];
function openSharedLink(keepTrail = false) {
  if (!keepTrail) sharedFolderTrail = [];
  const id = new URLSearchParams(location.hash.slice(1)).get('share');
  if (!id || !user) return;
  stopShared?.();
  parkedShare = null;
  shareDirty = false;
  stopShared = cloud.watchShare(id, (file, info) => {
    if (parkedShare?.id === id) {
      if (!shareDirty) parkedShare.file=normalizeFile(file);
      parkedShare.role=info.role;
      return;
    }
    const canEdit = info.owner === user.id || info.role === 'editor';
    if (sharedSession?.file.id === file.id && shareDirty && canEdit) { sharedSession.role = info.role; return; }
    sharedSession = {...info, file:normalizeFile(file), id};
    tab = file.type === 'folder' ? 'workspace' : file.type;
    opened = file.id;
    sync = canEdit ? '공유 파일 · 편집 가능' : '공유 파일 · 읽기 전용';
    render();
  }, error => {
    if (parkedShare?.id === id) { delete openedTabs[parkedShare.file.type];parkedShare=null; }
    else { sharedSession = null; opened = null; }
    stopShared?.(); render();
    notice(error.message || '공유 파일을 열 수 없습니다.');
  });
}
let recentSort = "recent";
let selectedFileId = null;
function selectFile(id) {
  selectedFileId = id;
  document.querySelectorAll('[data-file-select]').forEach(element => {
    const selected = element.dataset.fileSelect === id;
    element.classList.toggle('file-selected', selected);
    element.setAttribute('aria-selected', String(selected));
  });
}
function bindFileSelection(element, id, trigger = element) {
  element.dataset.fileSelect = id;
  element.tabIndex = 0;
  trigger.removeAttribute('data-action');
  trigger.onclick = event => { if (event.target.closest('button') && !event.target.closest('.card-open')) return; event.stopPropagation(); selectFile(id); };
  trigger.ondblclick = event => { event.preventDefault(); event.stopPropagation(); openFile(id); };
  if(element!==trigger){
    element.onclick=event=>{if(!event.target.closest('button'))selectFile(id);};
    element.ondblclick=event=>{if(!event.target.closest('button')){event.preventDefault();openFile(id);}};
  }
  element.onkeydown = event => {
    if (event.target !== element && event.target !== trigger) return;
    if (event.key === 'Enter') { event.preventDefault(); openFile(id); }
    if (event.key === ' ') { event.preventDefault(); selectFile(id); }
  };
}
function searchFiles() {
  flush();
  modal.className = "search-dialog";
  modal.innerHTML = `<h2>파일 검색</h2><input id="global-search" type="search" aria-label="파일 검색" placeholder="이름 또는 내용 검색" autocomplete="off"><div id="search-results" class="list"></div><div class="actions">${btn("닫기", "close")}</div>`;
  const update = () => {
    const term = $("#global-search").value.trim().toLocaleLowerCase();
    const matches = files.filter(f => !f.deleted && `${f.name} ${f.body || ""}`.toLocaleLowerCase().includes(term)).sort((a,b) => b.modified - a.modified).slice(0, 30);
    $("#search-results").innerHTML = matches.length ? matches.map(f => btn(`${esc(f.name)} <small>${esc(labels[f.type] || "폴더")}</small>`, "search-open:" + f.id, f.type === "folder" ? "folder" : icons[f.type])).join("") : '<p class="muted">검색 결과가 없습니다.</p>';
    refreshIcons();
  };
  modal.showModal();
  $("#global-search").oninput = update;
  $("#global-search").focus();
  update();
}
const defaultFirebaseConfig = {
  apiKey: "AIzaSyDPHpcFnV1Lc47GlzWoTwq1nbjG2PALxbI",
  authDomain: "the-workspace-659e5.firebaseapp.com",
  databaseURL: "https://the-workspace-659e5-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "the-workspace-659e5",
  storageBucket: "the-workspace-659e5.firebasestorage.app",
  messagingSenderId: "65223890615",
  appId: "1:65223890615:web:a52fd54727f10fd1af9f32",
  measurementId: "G-CXETTW80JL",
};
const featureTypes = ["note", "idea", "words", "plan", "calendar"];
let drafts = {};
function draftFor(type) {
  return drafts[type] ||= {
    id: crypto.randomUUID(), type, name: "새 " + labels[type], parent: null,
    body: "", words: [], tasks: [], events: [], star: false, deleted: false,
    created: Date.now(), modified: Date.now(),
  };
}
const modal = $("#modal");
function notice(t) {
  $("#toast").textContent = t;
  $("#toast").style.display = "block";
  clearTimeout(notice.id);
  notice.id = setTimeout(() => ($("#toast").style.display = "none"), 3500);
}
function browserDownload(name, content, type = "application/octet-stream") {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
async function pdfBlob(file) {
  if (pdfBlobs.has(file.id)) return pdfBlobs.get(file.id);
  if (file.data) {
    const blob = await (await fetch(file.data)).blob();
    pdfBlobs.set(file.id, blob);
    return blob;
  }
  const session = sharedSession?.file.id === file.id ? sharedSession : parkedShare?.file.id === file.id ? parkedShare : null;
  const data = await cloud.loadPdf(session?.owner || user.id, file.id);
  const blob = await (await fetch(data)).blob();
  pdfBlobs.set(file.id, blob);
  return blob;
}
function blobDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || Error("PDF를 읽을 수 없습니다."));
    reader.readAsDataURL(blob);
  });
}
async function ensurePdfLoaded(file) {
  if (!file || file.type !== "pdf" || file.data || pdfUrls.has(file.id) || pdfLoads.has(file.id)) return;
  const loading = pdfBlob(file).then(blob => {
    const old = pdfUrls.get(file.id);
    if (old) URL.revokeObjectURL(old);
    pdfUrls.set(file.id, URL.createObjectURL(blob));
    if (current()?.id === file.id) render();
  }).catch(error => notice(error.message)).finally(() => pdfLoads.delete(file.id));
  pdfLoads.set(file.id, loading);
}
async function browserSaveLocal(file) {
  const base = String(file.name || "workspace").replace(/[\\/:*?"<>|]/g, "-");
  if (file.type === "pdf") {
    browserDownload(`${base}.pdf`, await pdfBlob(file), "application/pdf");
    return true;
  }
  const extension = !file.richBody && (file.type === "note" || file.type === "idea") ? "md" : "json";
  const content = extension === "md"
    ? `# ${file.name}\n\n${file.body || ""}`
    : JSON.stringify(file, null, 2);
  return browserDownload(`${base}.${extension}`, content, extension === "md" ? "text/markdown" : "application/json");
}
function showModal(title, body, onSubmit) {
  modal.className = title === '계정' ? 'account-popup' : '';
  modal.innerHTML = `<form id="modalform"><h2>${title}</h2>${body}<div class="actions">${btn("취소", "close")}<button class="primary" type="submit">확인</button></div></form>`;
  modal.showModal();
  modal.querySelector("input")?.focus();
  $("#modalform").onsubmit = async (e) => {
    e.preventDefault();
    try {
      await onSubmit(new FormData(e.target));
      modal.close();
    } catch (err) {
      notice(err.message);
    }
  };
  $("#modalform").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.tagName !== "TEXTAREA" && !e.isComposing) {
      e.preventDefault();
      e.currentTarget.requestSubmit();
    }
  });
  refreshIcons();
}
function refreshIcons() {
  lucide.createIcons();
  const names={collapse:'사이드바 접기 / 펼치기',menu:'더보기',bold:'굵게',italic:'기울임',checklist:'체크리스트',favorite:'즐겨찾기','month-prev':'이전 달','month-next':'다음 달','task-delete':'할 일 삭제','event-delete':'일정 삭제'};
  document.querySelectorAll('button[data-action]').forEach(b=>{if(!b.textContent.trim()){const name=b.title || ({'feature-home':'탭 홈','search-files':'파일 검색'}[b.dataset.action]) || names[b.dataset.action.split(':')[0]]||'더보기';b.title=name;b.setAttribute('aria-label',name);}});
}
function errorMessage(e) {
  return (
    {
      "auth/invalid-credential": "이메일 또는 비밀번호가 올바르지 않습니다.",
      "auth/email-already-in-use": "이미 가입된 이메일입니다.",
      "auth/weak-password": "비밀번호를 8자 이상 입력해주세요.",
      "auth/network-request-failed": "네트워크 연결을 확인해주세요.",
      "permission-denied": "Firebase 접근 규칙을 확인해주세요.",
    }[e.code] || e.message
  );
}
async function hashPassword(p, s) {
  const k = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(p),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const b = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(s),
      iterations: 210000,
      hash: "SHA-256",
    },
    k,
    256,
  );
  return Array.from(new Uint8Array(b), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
}
function authScreen() {
  user = null;
  $("#app").innerHTML =
    `<div class="auth"><form class="authbox" id="authform"><div class="mark">W</div><h1>Workspace</h1><p class="muted">${signup ? "새 계정 만들기" : "나의 생각과 공부가 모이는 곳"}</p><label>이메일</label><input type="email" name="email" autocomplete="email" required maxlength="200" placeholder="you@example.com"><label>비밀번호</label><input type="password" name="password" autocomplete="${signup ? "new-password" : "current-password"}" minlength="8" required placeholder="8자 이상">${signup ? '<label>비밀번호 확인</label><input type="password" name="confirm" minlength="8" required>' : ""}<p class="muted">Firebase 계정 · 기기 간 동기화</p><button class="primary" type="submit">${signup ? "회원가입" : "로그인"}</button>${btn("Google로 계속하기", "google-login", "chrome", "google-login")}${btn(signup ? "이미 계정이 있어요 · 로그인" : "처음이신가요? 회원가입", "auth-toggle", "", "switch")}${btn("비밀번호 재설정", "reset-password", "", "switch")}<small id="autherror" class="danger"></small></form></div>`;
  refreshIcons();
  $('#authform button[type="submit"]').insertAdjacentHTML('beforebegin', `<label class="remember-login"><input type="checkbox" id="remember-login" ${localStorage.getItem('remember-login') === 'true' ? 'checked' : ''}><span>로그인 유지</span></label>`);
  $('#remember-login').onchange = e => localStorage.setItem('remember-login', String(e.target.checked));
  $("#authform").onsubmit = async (e) => {
    e.preventDefault();
    const submit = e.target.querySelector("[type=submit]");
    submit.disabled = true;
    const d = new FormData(e.target),
      email = d.get("email").trim().toLowerCase(),
      password = d.get("password");
    try {
      if (signup && password !== d.get("confirm"))
        throw Error("비밀번호가 일치하지 않습니다.");
      if (cloudConfigured) {
        await cloud.persistence($('#remember-login').checked);
        const result = await cloud[signup ? "register" : "login"](
          email,
          password,
        );
        if (user?.id !== result.user.uid) await enter({ id: result.user.uid, email, cloud: true });
      } else {
        const accounts = JSON.parse(localStorage.getItem("accounts") || "{}");
        if (signup) {
          if (accounts[email]) throw Error("이미 가입된 이메일입니다.");
          const salt = crypto.randomUUID();
          accounts[email] = {
            id: crypto.randomUUID(),
            salt,
            hash: await hashPassword(password, salt),
          };
          localStorage.setItem("accounts", JSON.stringify(accounts));
        }
        const a = accounts[email];
        if (!a || (await hashPassword(password, a.salt)) !== a.hash)
          throw Error("이메일 또는 비밀번호가 올바르지 않습니다.");
        await enter({ id: a.id, email, cloud: false });
      }
    } catch (err) {
      $("#autherror").textContent = errorMessage(err);
      submit.disabled = false;
    }
  };
}
async function enter(u) {
  stopShared?.();
  sharedSession = null;
  parkedShare=null;openedTabs={};
  shareDirty = false;
  drafts = {};
  signup = false;
  user = u;
  files = JSON.parse(localStorage.getItem("files:" + u.id) || "[]").map(normalizeFile);
  tab = "workspace";
  folder = null;
  opened = null;
  if (u.cloud) {
    sync = "동기화 연결 중";
    cloud.watch(
      u.id,
      (remote) => {
        const editing = current();
        const keepEditing = editing && document.activeElement?.closest('.rich-surface');
        files = remote.map(item => keepEditing && item.id === editing.id ? editing : normalizeFile(item));
        cache();
        if (sharedSession) return;
        sync = "클라우드 동기화됨";
        if (!document.activeElement?.matches("textarea,.title-input") && !keepEditing) render();
      },
      (e) => {
        sync = "동기화 오류";
        notice(errorMessage(e));
        render();
      },
    );
  } else sync = "이 기기에 저장";
  render();
  openSharedLink();
}
function cache() {
  const cached = files.map((file) => {
    if (file.type === "pdf" && file.data?.length > 400000) {
      const copy = { ...file };
      delete copy.data;
      return copy;
    }
    return file;
  });
  localStorage.setItem("files:" + user.id, JSON.stringify(cached));
}
function normalizeFile(file) {
  if (file.type === "words") file.words ||= [];
  if (file.type === "plan") file.tasks ||= [];
  if (file.type === "calendar") file.events ||= [];
  if (["note", "idea"].includes(file.type)) file.body ||= "";
  file.deleted ||= false;
  return file;
}
async function migrateLegacyPdfs() {
  if (pdfMigrationRunning || !user?.cloud || !files.some(file => file.type === "pdf" && file.data)) return;
  pdfMigrationRunning = true;
  try {
    let count = 0;
    for (const file of files.filter(item => item.type === "pdf" && item.data)) {
      await cloud.save(user.id, file);
      file.hasPdfBody = true;
      delete file.data;
      count += 1;
    }
    cache();
    if (count) notice(`${count}개의 기존 PDF 본문을 파일 목록에서 분리했습니다.`);
  } catch (error) {
    notice(`PDF 정리 보류: ${error.message}`);
  } finally {
    pdfMigrationRunning = false;
  }
}
async function persist(f) {
  if (sharedSession?.file.id === f.id) {
    if (sharedSession.owner !== user.id && sharedSession.role !== 'editor') return false;
    if (shareSaving) return false;
    shareSaving = true;
    const session = sharedSession;
    const copy = JSON.parse(JSON.stringify(f));
    copy.modified = Date.now();
    try {
      await cloud.save(session.owner, copy);
      f.revision = copy.revision;
      f.modified = copy.modified;
      shareDirty = JSON.stringify(f.richBody) !== JSON.stringify(copy.richBody) || Boolean($('#edit-body') && ($('#edit-body').value !== copy.body || $('#edit-title').value !== copy.name));
      notice('공유 파일을 저장했습니다.');
      return true;
    }
    catch (error) { shareDirty=true;notice(error.message);return false; }
    finally { shareSaving = false; }
  }
  if (!files.some(x => x.id === f.id)) files.push(f);
  if (drafts[f.type]?.id === f.id) {
    if (tab === f.type) opened = f.id;
    delete drafts[f.type];
  }
  f.modified = Date.now();
  try {
    cache();
    if (user.cloud) {
      sync = "동기화 중";
      await cloud.save(user.id, f);
      if (f.type === "pdf" && f.data) {
        f.hasPdfBody = true;
        delete f.data;
        cache();
      }
      sync = "클라우드 동기화됨";
    } else sync = "이 기기에 저장";
    $(".status") && ($(".status").textContent = sync);
    return true;
  } catch (e) {
    sync = "저장 실패";
    notice(errorMessage(e));
    return false;
  }
}
function current() {
  if (sharedSession?.file.id === opened) return sharedSession.file;
  const file = files.find((f) => f.id === opened && !f.deleted) || drafts[tab] || null;
  return file ? normalizeFile(file) : null;
}
function discardEmptyDraft(type) {
  const draft = drafts[type];
  if (!draft) return;
  const empty = !draft.body && !draft.words?.length && !draft.tasks?.length && !draft.events?.length;
  if (empty) delete drafts[type];
}
async function nav(t) {
  flush();
  if (opened) openedTabs[tab]=opened;
  if (sharedSession) { parkedShare=sharedSession;sharedSession=null; }
  tab = t;
  opened = openedTabs[t] || null;
  if ((parkedShare?.file.type === 'folder' ? 'workspace' : parkedShare?.file.type) === t && parkedShare.file.id === opened) { sharedSession=parkedShare;parkedShare=null; }
  folder = null;
  query = "";
  wordIndex = 0;
  reveal = false;
  render();
}
function render() {
  window.richNotes?.destroy();
  if (!user) return authScreen();
  const navButton = (t) =>
    btn(labels[t], `tab:${t}`, icons[t], tab === t ? "active" : "");
  $("#app").innerHTML =
    `<div class="shell"><aside class="sidebar ${collapsed ? "collapsed" : ""}"><div class="brand"><span class="mark">W</span><strong>Workspace</strong>${btn("", "collapse", "panel-left-close")}</div><nav class="nav">${["clock", "idea", "note", "study", "plan", "pdf", "words", "calendar"].map(navButton).join("")}<label>자료 관리</label>${["workspace", "favorites", "recent", "trash"].map(navButton).join("")}<label>시스템</label>${btn("새 창", "new-window", "panels-top-left")}${btn("비밀번호 변경", "password", "key-round")}${navButton("settings")}</nav><div class="account">${btn("계정", "account", "user-round")}${btn("로그아웃", "logout", "log-out")}</div></aside><main class="main"><header class="top"><div><h1>${esc(labels[tab])}</h1><div class="status">${esc(sync)}</div></div><div class="actions">${headerActions()}</div></header><section class="content">${content()}</section></main></div>`;
  const titleGroup = $('.top > div');
  titleGroup.classList.add('header-title');
  titleGroup.insertAdjacentHTML('afterbegin', '<button type="button" class="icon-action header-fullscreen" data-action="fullscreen"></button>');
  updateFullscreenButton();
  refreshIcons();
  bindContent();
}
function updateFullscreenButton() {
  const button = $('.header-fullscreen');
  if (!button) return;
  const active = Boolean(document.fullscreenElement);
  button.title = active ? '전체 화면 나가기' : '전체 화면';
  button.setAttribute('aria-label', button.title);
  button.setAttribute('aria-pressed', String(active));
  button.disabled = !document.fullscreenEnabled;
  button.innerHTML = icon(active ? 'minimize' : 'maximize');
  refreshIcons();
}
document.addEventListener('fullscreenchange', updateFullscreenButton);
function headerActions() {
  const file = current();
  const enabled = file && !file.deleted && (!sharedSession || sharedSession.owner === user.id);
  return (sharedSession && sharedFolderTrail.length ? btn('공유 폴더로','shared-parent','folder-up') : '') + `<button type="button" class="icon-action ${file?.star ? 'yellow' : ''}" data-action="favorite" title="즐겨찾기" aria-label="즐겨찾기" aria-pressed="${Boolean(file?.star)}" ${enabled ? '' : 'disabled'}>${icon('star')}</button>` + headerControls();
}
function headerControls() {
  if (sharedSession?.file.type === 'folder' && sharedSession.file.id === opened) return btn('내 작업공간','shared-exit','folder') + (sharedSession.owner === user.id ? btn('공유','share','share-2') : '');
  const searchButton = btn("", "search-files", "search", "icon-action");
  if (["clock", "study"].includes(tab))
    return `<button class="icon-action" data-action="clock-mute" title="${clockMuted?'소리 켜기':'음소거'}" aria-label="${clockMuted?'소리 켜기':'음소거'}" aria-pressed="${clockMuted}">${icon(clockMuted?'volume-x':'volume-2')}</button><button class="icon-action" data-action="mini-clock" title="작은 시계" aria-label="작은 시계">${icon('picture-in-picture-2')}</button>`;
  if (tab === "settings") return "";
  if (featureTypes.includes(tab) || tab === "pdf") {
    const editing = Boolean(opened || drafts[tab]);
    return searchButton + btn("작업공간", "tab:workspace", "folder") +
      (editing ? featureHeaderActions() : "");
  }
  if (opened)
    return (
      btn("목록", "back", "arrow-left") +
      btn("저장 위치", "move", "folder") +
      btn("저장", "save", "save", "primary")
    );
  return (
    searchButton + `<input id="search" aria-label="현재 폴더 검색" placeholder="현재 폴더 검색" value="${esc(query)}">` +
    (tab === "trash"
      ? ""
      : btn("새 폴더", "new-folder", "folder-plus", "yellow") +
        btn(
          tab === "workspace" ? "새 파일" : "새로 만들기",
          "new",
          "plus",
          "primary",
        ))
  );
}
function featureHeaderActions() {
  if (sharedSession) return btn('홈','feature-home','house') + (sharedSession.owner === user.id ? btn('공유','share','share-2') : '') + (sharedSession.owner === user.id || sharedSession.role === 'editor' ? btn('저장','save','save','primary') : '');
  const items = featureItems();
  const index = items.findIndex(x => x.id === opened);
  const disabled = (action, state, iconName, label) => `<button class="icon-action" data-action="${action}" ${state ? "disabled" : ""} title="${label}" aria-label="${label}">${icon(iconName)}</button>`;
  return `<div class="feature-actions">${btn("", "feature-home", "house", "icon-action")}${disabled("feature-prev", index <= 0, "chevron-left", "이전 항목")}${disabled("feature-next", index < 0 || index >= items.length - 1, "chevron-right", "다음 항목")}<div class="save-split">${btn("저장", "save-menu", "save", "primary")}${saveMenu ? `<div class="save-dropdown">${btn("작업공간에 저장", "save-workspace", "cloud")}${btn("로컬 파일에 저장", "save-local", "download")}</div>` : ""}</div></div>`;
}
function featureItems() {
  return files.filter(x => x.type === tab && !x.deleted).sort((a, b) => a.modified - b.modified);
}
function content() {
  if (sharedSession?.file.type === 'folder' && sharedSession.file.id === opened) {
    const entries = sharedSession.file.sharedEntries || [];
    return `<h2>${esc(sharedSession.file.name)}</h2><div class="list">${entries.length ? entries.map(item => `<div class="shared-folder-row">${btn(esc(item.name), 'shared-open:' + item.shareId, item.type === 'folder' ? 'folder' : icons[item.type] || 'file')}${btn('공유 링크 복사','shared-copy:' + item.shareId,'link')}</div>`).join('') : '<p>공유된 내부 파일이 없습니다.</p>'}</div>`;
  }
  if (tab === "clock" || tab === "study") return timerView();
  if (tab === "settings") return settingsView();
  if (featureTypes.includes(tab) || tab === "pdf") return featureView();
  return listView();
}
function featureView() {
  return opened || drafts[tab] ? featureContent() : featureHome();
}
function featureHome() {
  if (tab === "pdf") return `<div class="start-gallery"><div class="gallery-inner"><h2>PDF 시작</h2><div class="template-row"><button class="template-card pdf-card" data-action="pdf-open">${icon("file-search")}<strong>PDF 열기</strong><span>파일을 선택해 읽기</span></button></div><div class="recent-heading"><h2>최근 PDF</h2></div>${recentCards()}</div></div>`;
  const templates = {
    note: [["blank", "빈 노트", "새 생각을 기록하세요"], ["study", "학습 정리", "핵심 개념 · 질문 · 복습"], ["meeting", "회의 메모", "안건과 다음 할 일"]],
    idea: [["blank", "빠른 아이디어", "떠오른 생각을 붙잡기"], ["project", "프로젝트 구상", "문제 · 해결 · 다음 단계"], ["brainstorm", "브레인스토밍", "가능성을 자유롭게 펼치기"]],
    words: [["blank", "새 단어장", "단어와 뜻을 바로 추가"], ["english", "영어 단어", "오늘 외울 표현 모음"], ["exam", "시험 대비", "중요 단어를 한곳에"]],
    plan: [["blank", "오늘의 계획", "해야 할 일부터 시작"], ["weekly", "주간 계획", "이번 주 우선순위"], ["project", "프로젝트 계획", "단계별 할 일 정리"]],
    calendar: [["blank", "새 캘린더", "일정을 한눈에 관리"], ["study", "공부 일정", "학습 루틴을 계획"], ["project", "프로젝트 일정", "마감일과 주요 일정"]],
  }[tab] || [];
  return `<div class="start-gallery"><div class="gallery-inner"><h2>새 ${labels[tab]} 시작</h2><div class="template-row">${templates.map(([kind, title, desc]) => `<button class="template-card ${tab}" data-action="template:${tab}:${kind}"><span class="template-symbol">${icon(icons[tab])}</span><strong>${title}</strong><span>${desc}</span></button>`).join("")}</div><div class="recent-heading"><h2>최근 ${labels[tab]}</h2><span>${files.filter(x => x.type === tab && !x.deleted).length}개</span></div>${recentCards()}</div></div>`;
}
function recentCards() {
  const rows = files.filter(x => x.type === tab && !x.deleted).sort((a, b) => recentSort === "name" ? a.name.localeCompare(b.name, "ko") : recentSort === "modified" ? b.modified - a.modified : (b.lastOpened || b.modified) - (a.lastOpened || a.modified));
  if (!rows.length) return `<div class="recent-empty">${icon("sparkles")}<p>아직 만든 ${labels[tab]}이 없습니다. 위에서 하나를 골라 시작하세요.</p></div>`;
  return `<div class="recent-grid">${rows.map(f => `<article class="recent-card"><button class="card-open" data-action="open:${f.id}"><span class="doc-preview ${f.type}">${previewText(f)}</span><strong>${esc(f.name)}</strong><small>${new Date(f.modified).toLocaleDateString("ko-KR")}</small></button><button class="card-menu" data-action="card-menu:${f.id}" title="파일 메뉴" aria-label="파일 메뉴">${icon("ellipsis-vertical")}</button>${cardMenu === f.id ? `<div class="card-dropdown">${btn("열기", "open:" + f.id, "folder-open")}${btn("복사", "copy:" + f.id, "copy")}${btn("이름 바꾸기", "rename:" + f.id, "pencil")}${btn("이동", "move:" + f.id, "folder-input")}${btn("삭제", "delete:" + f.id, "trash-2", "danger")}</div>` : ""}</article>`).join("")}</div>`;
}
function previewText(f) {
  if (f.type === "words") return esc(f.words.slice(0, 3).map(x => x.word).join("\n") || "WORD\nVOCABULARY");
  if (f.type === "plan") return esc(f.tasks.slice(0, 3).map(x => "□ " + x.text).join("\n") || "□ 할 일\n□ 할 일");
  if (f.type === "calendar") return "CALENDAR\n" + new Date(f.modified).toLocaleDateString("ko-KR");
  if (f.type === "idea") return esc((f.body || "IDEA").slice(0, 80));
  return esc((f.body || "새 문서").slice(0, 110));
}
function startTemplate(type, kind) {
  if (type === "pdf") return importPdf();
  const samples = {
    note: { study: ["학습 정리", "# 오늘 배운 것\n\n## 핵심 개념\n\n## 더 알아볼 점"], meeting: ["회의 메모", "# 안건\n\n# 결정한 내용\n\n# 다음 할 일"] },
    idea: { project: ["프로젝트 아이디어", "# 문제\n\n# 해결 방법\n\n# 다음 단계"], brainstorm: ["브레인스토밍", "# 생각\n\n- \n- \n-"] },
    words: { english: ["영어 단어", ""], exam: ["시험 대비 단어", ""] },
    plan: { weekly: ["주간 계획", ""], project: ["프로젝트 계획", ""] },
    calendar: { study: ["공부 일정", ""], project: ["프로젝트 일정", ""] },
  };
  const [name, body] = samples[type]?.[kind] || ["새 " + labels[type], ""];
  drafts[type] = { ...draftFor(type), name, body, words: [], tasks: [], events: [] };
  opened = null;
  render();
}
function featureContent() {
  const f = current();
  if (f) {
    if (f.type === 'words' && window.wordTools.active(quizKey(f))) return wordsView(f);
    if (f.type === "idea") return `<div class="idea-layout"><div><h2>아이디어 메모</h2><input class="title-input" id="edit-title" aria-label="제목" maxlength="200" value="${esc(f.name)}"><textarea id="edit-body" aria-label="내용" placeholder="떠오른 생각을 적어보세요">${esc(f.body)}</textarea></div><aside><h2>저장한 아이디어</h2><div class="list">${files.filter(x => x.type === "idea" && !x.deleted).map(x => btn(esc(x.name), "open:" + x.id, "lightbulb")).join("")}</div></aside></div>`;
    if (f.type === "words") return `<form id="quick-form" class="quick-form"><input name="word" required aria-label="단어" placeholder="단어"><input name="meaning" required aria-label="뜻" placeholder="뜻"><button type="submit" class="primary">단어 저장</button></form>` + wordsView(f);
    if (f.type === "plan") return `<form id="quick-form" class="quick-form"><input name="text" required aria-label="할 일" placeholder="오늘 할 일"><input name="date" type="date" aria-label="마감일"><button type="submit" class="primary">추가</button></form>` + planView(f);
    if (f.type === "calendar") return calendarView(f);
    if (f.type === "pdf") {
      const source = f.data || pdfUrls.get(f.id);
      return `<h2>${esc(f.name)}</h2>${source ? `<embed class="file-preview" type="application/pdf" src="${esc(source)}">` : `<div class="empty"><div class="spinner" aria-hidden="true"></div><h2>PDF 불러오는 중</h2></div>`}`;
    }
    return `<div class="editor"><div class="toolbar">${btn("", "bold", "bold")}${btn("", "italic", "italic")}${btn("", "checklist", "list-checks")}${btn("", "favorite", "star", f.star ? "yellow" : "")}</div><input class="title-input" id="edit-title" aria-label="제목" maxlength="200" value="${esc(f.name)}"><textarea id="edit-body" aria-label="내용" placeholder="내용을 입력하세요">${esc(f.body)}</textarea><small>마지막 수정 ${new Date(f.modified).toLocaleString("ko-KR")}</small></div>`;
  }
  return "";
}
function listView() {
  let rows = files.filter((f) => (tab === "trash" ? f.deleted : !f.deleted));
  if (tab === "favorites") rows = rows.filter((f) => f.star);
  else if (tab === "recent")
    rows = rows
      .filter((f) => f.lastOpened)
      .sort((a, b) => b.lastOpened - a.lastOpened);
  else if (tab !== "trash")
    rows = rows.filter(
      (f) =>
        (f.parent || null) === folder &&
        (tab === "workspace" || f.type === tab || f.type === "folder"),
    );
  if (query)
    rows = rows.filter((f) =>
      f.name.toLowerCase().includes(query.toLowerCase()),
    );
  if (tab !== "recent")
    rows.sort(
      (a, b) =>
        (b.type === "folder") - (a.type === "folder") ||
        b.modified - a.modified,
    );
  return `<div class="crumbs">${btn("내 작업공간", "root", "home")}${folder ? btn(esc(files.find((f) => f.id === folder)?.name), "up", "chevron-left") : ""}</div>${rows.length ? `<table class="table"><thead><tr><th>이름</th><th>종류</th><th>수정일</th><th class="size">크기</th><th></th></tr></thead><tbody>${rows.map((f) => `<tr><td><div class="filename" ${tab === "workspace" ? `data-open-double="${f.id}" title="더블클릭하여 열기"` : `data-action="open:${f.id}"`}>${icon(f.type === "folder" ? "folder" : "file", f.type === "folder" ? "yellow" : "")}<span>${esc(f.name)}</span>${f.star ? icon("star", "yellow") : ""}</div></td><td>${esc(labels[f.type] || "폴더")}</td><td>${new Date(f.modified).toLocaleDateString("ko-KR")}</td><td class="size">${f.type === "folder" ? "—" : Math.max(1, Math.ceil(new Blob([JSON.stringify(f)]).size / 1024)) + " KB"}</td><td>${btn("", "menu:" + f.id, "ellipsis-vertical")}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">${icon("folder-open")}<h2>${query ? "검색 결과가 없습니다" : "아직 파일이 없습니다"}</h2>${tab !== "trash" ? btn("새 파일 만들기", "new", "plus") : ""}</div>`}`;
}
function bindContent() {
  richDirty = false;
  if (current()?.type === 'note') window.richNotes?.mount(current(), !sharedSession || sharedSession.owner === user.id || sharedSession.role === 'editor', () => {
    richDirty = true;
    if (sharedSession) { shareDirty = true; return; }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 600);
  });
  if (current()?.type === "pdf") ensurePdfLoaded(current());
  if (current()?.type === 'words' && !window.wordTools.active(quizKey(current()))) {
    $('.content .actions')?.insertAdjacentHTML('afterend', `<div class="actions" style="margin-top:18px">${btn('퀴즈','word-quiz','circle-help')}</div>`);
    $('.content')?.insertAdjacentHTML('beforeend', window.wordTools.historyView(quizKey(current())));
  }
  if (current() && !sharedSession && $('.feature-actions')) $('.feature-actions').insertAdjacentHTML('afterbegin', btn('공유','share','share-2'));
  if (sharedSession && sharedSession.owner !== user.id) {
    document.querySelectorAll('.content [data-action="favorite"]').forEach(button => button.disabled = true);
  }
  if (sharedSession && sharedSession.owner !== user.id && sharedSession.role !== 'editor') {
    document.querySelectorAll('.content input,.content textarea,.content select').forEach(input => input.disabled = true);
    document.querySelectorAll('.content button').forEach(button => {
      if (!['word-quiz','word-prev','word-next','reveal','speak','month-prev','month-next','month-today'].includes(button.dataset.action) && !/^(shared-open|shared-copy):/.test(button.dataset.action || '')) button.disabled = true;
    });
  }
  if (current()?.type === 'words') {
    document.querySelectorAll('.quiz-screen input,.quiz-screen button').forEach(control => control.disabled = false);
    window.wordTools.mount(quizKey(current()), render);
  }
  document.querySelectorAll('.table .filename').forEach(row => {
    const id = row.dataset.openDouble || row.dataset.action?.slice(5);
    const file = files.find(item => item.id === id);
    if (!file) return;
    bindFileSelection(row.closest('tr'), id, row);
    row.closest('tr').oncontextmenu = event => { event.preventDefault(); menuFile(id); };
    const type = Object.hasOwn(icons, file.type) ? file.type : 'note';
    const symbol = type === 'note' ? 'file' : icons[type];
    const badge = document.createElement('span');
    badge.className = `file-kind file-kind-${type}`;
    badge.title = labels[type] || '폴더';
    badge.setAttribute('aria-label', badge.title);
    badge.innerHTML = icon(symbol);
    row.firstElementChild.replaceWith(badge);
  });
  document.querySelectorAll('.recent-card').forEach(card => {
    const trigger = card.querySelector('.card-open');
    const id = trigger.dataset.action.slice(5);
    card.oncontextmenu = event => { event.preventDefault(); selectFile(id); menuFile(id); };
    card.querySelector('.card-dropdown')?.insertAdjacentHTML('afterbegin', btn('공유','share:' + id,'share-2'));
    bindFileSelection(card, id, trigger);
  });
  selectFile(selectedFileId);
  refreshIcons();
  if ($(".recent-heading")) {
    $(".recent-heading").insertAdjacentHTML("beforeend", `<select id="recent-sort" aria-label="파일 정렬"><option value="recent">최근 열기 순</option><option value="modified">수정일 순</option><option value="name">이름 순</option></select>`);
    $("#recent-sort").value = recentSort;
    $("#recent-sort").onchange = e => { recentSort = e.target.value; render(); };
  }
  if ($("#quick-form")) $("#quick-form").onsubmit = e => {
    e.preventDefault();
    const d = new FormData(e.target), f = current();
    if (tab === "words") f.words.push({word:d.get("word").trim(),meaning:d.get("meaning").trim(),example:"",known:false});
    else f.tasks.push({text:d.get("text").trim(),date:d.get("date"),done:false});
    persist(f);
    render();
  };
  if ($("#search"))
    $("#search").oninput = (e) => {
      query = e.target.value;
      const p = e.target.selectionStart;
      render();
      $("#search").focus();
      $("#search").setSelectionRange(p, p);
    };
  for (const id of ["edit-title", "edit-body"])
    if ($("#" + id))
      $("#" + id).oninput = () => {
        if (sharedSession) { shareDirty = true; return; }
        clearTimeout(saveTimer);
        saveTimer = setTimeout(flush, 600);
      };
  if (tab === "settings") $("#backup-import").onchange = importBackup;
}
function flush() {
  clearTimeout(saveTimer);
  const f = current();
  if (f && $("#edit-title")) {
    if (!richDirty && f.name === ($("#edit-title").value.trim() || "제목 없음") && f.body === $("#edit-body").value) return;
    richDirty = false;
    f.name = $("#edit-title").value.trim() || "제목 없음";
    f.body = $("#edit-body").value;
    if (!sharedSession && files.some((x) => x.id === f.id)) persist(f);
  }
}
function createFile(type, name, parent = folder, save = true) {
  const f = {
    id: crypto.randomUUID(),
    name,
    type,
    parent,
    body: "",
    modified: Date.now(),
    created: Date.now(),
    star: false,
    deleted: false,
    words: [],
    tasks: [],
    events: [],
  };
  files.push(f);
  if (save) persist(f);
  return f;
}
function createDialog(type) {
  showModal(
    type === "folder" ? "새 폴더" : "새 파일",
    `${type ? "" : `<label>종류</label><select name="type">${["note", "idea", "words", "plan", "calendar", "pdf"].map((t) => `<option value="${t}">${labels[t]}</option>`).join("")}</select>`}<label>이름</label><input name="name" maxlength="200" required placeholder="이름">`,
    async (d) => {
      // Read the selection before starting the native file picker. The picker is
      // asynchronous, so relying on the current tab after it opens can route a
      // newly imported PDF to the wrong editor.
      const t = String(type || d.get("type") || "").trim();
      if (t === "pdf") {
        await importPdf(String(d.get("name") || "").trim());
        return;
      }
      const f = createFile(t, d.get("name").trim());
      if (t === "folder") render();
      else openFile(f.id);
    },
  );
}
async function openFile(id) {
  flush();
  const f = files.find((f) => f.id === id);
  if (!f || f.deleted) return;
  if (f.type === "folder") {
    folder = f.id;
    render();
    return;
  }
  if (f.shareId && await cloud.shareInfo(f.shareId)) { history.replaceState(null,'','#share=' + f.shareId);openSharedLink();return; }
  opened = id;
  tab = f.type;
  wordIndex = 0;
  reveal = false;
  f.lastOpened = Date.now();
  persist(f);
  render();
}
function menuFile(id) {
  const f = files.find((f) => f.id === id);
  if (!f) return;
  modal.innerHTML = `<h2>${esc(f.name)}</h2><div class="list">${f.deleted ? btn("복원", "restore:" + id, "undo-2") + btn("영구 삭제", "destroy:" + id, "trash-2", "danger") : btn("열기", "open:" + id, "folder-open") + btn("이름 변경", "rename:" + id, "pencil") + btn(f.star ? "즐겨찾기 해제" : "즐겨찾기", "star:" + id, "star") + btn("이동", "move:" + id, "folder-input") + btn("휴지통으로 이동", "delete:" + id, "trash-2")}</div>${btn("닫기", "close")}`;
  modal.showModal();
  if (!f.deleted) modal.querySelector('.list').insertAdjacentHTML('afterbegin', btn('공유', 'share:' + id, 'share-2'));
  refreshIcons();
}
function moveDialog(id) {
  const f = files.find((f) => f.id === id);
  const descendants = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    files.forEach((x) => {
      if (descendants.has(x.parent) && !descendants.has(x.id)) {
        descendants.add(x.id);
        changed = true;
      }
    });
  }
  showModal(
    "저장 위치",
    `<select name="parent"><option value="">내 작업공간</option>${files
      .filter(
        (x) => x.type === "folder" && !x.deleted && !descendants.has(x.id),
      )
      .map((x) => `<option value="${x.id}">${esc(x.name)}</option>`)
      .join("")}</select>`,
    (d) => {
      f.parent = d.get("parent") || null;
      persist(f);
      render();
    },
  );
}
function timerView() {
  const mode = timerModes[tab];
  const modeButton = (label, value) => btn(label, `mode:${value}`, "", mode === value ? "primary" : "");
  const modes = tab === "study"
    ? modeButton("집중", "focus") + modeButton("짧은 휴식", "short") + modeButton("긴 휴식", "long") + modeButton("스톱워치", "stopwatch")
    : modeButton("현재 시각", "clock") + modeButton("타이머", "focus") + modeButton("스톱워치", "stopwatch");
  if (mode === "stopwatch") {
    const watch = stopwatches[tab];
    const laps = watch.laps.map((total, index) => {
      const previous = index ? watch.laps[index - 1] : 0;
      return `<li><span>랩 ${index + 1}</span><strong>${stopwatchText(total - previous)}</strong><span>${stopwatchText(total)}</span></li>`;
    }).reverse().join("");
    return `<div class="timer"><div class="actions timer-modes">${modes}</div><div class="clock stopwatch-clock" id="time">${timeText()}</div><p class="muted">스톱워치</p><div class="actions">${btn(watch.running ? "일시정지" : watch.elapsed ? "계속" : "시작", "stopwatch-toggle", watch.running ? "pause" : "play", "primary")}${btn("랩", "stopwatch-lap", "flag")}${btn("초기화", "stopwatch-reset", "rotate-ccw")}</div>${laps ? `<ol class="lap-list"><li class="lap-head"><span>구간</span><strong>랩 시간</strong><span>전체 시간</span></li>${laps}</ol>` : `<div class="lap-empty">랩 버튼을 누르면 구간 기록이 여기에 표시됩니다.</div>`}</div>`;
  }
  const label = mode === "clock" ? "현재 시각" : mode === "focus" ? (tab === "study" ? "집중 시간" : "타이머") : "휴식 시간";
  const controls = mode === "clock" ? "" : `<div class="actions">${btn(timer.running ? "일시정지" : "시작", "timer-toggle", timer.running ? "pause" : "play", "primary")}${btn("초기화", "timer-reset", "rotate-ccw")}</div><div class="actions timer-setting"><input id="minutes" type="number" min="1" max="240" value="${Math.max(1, Math.ceil(timer.remaining / 60))}" aria-label="분">분 ${btn("설정", "timer-set")}</div>`;
  return `<div class="timer"><div class="actions timer-modes">${modes}</div><div class="clock" id="time">${timeText()}</div><p class="muted">${label}</p>${controls}<div class="stat"><div>완료 세션<h2 id="sessioncount">${localStorage.getItem("sessions:" + user.id) || 0}회</h2></div><div>오늘 날짜<h2>${new Date().toLocaleDateString("ko-KR")}</h2></div></div></div>`;
}
let clockMuted = localStorage.getItem('clock-muted') === 'true';
let clockAudio;
let miniSource = null;
function unlockClockAudio() {
  if (!clockAudio) clockAudio = new (window.AudioContext || window.webkitAudioContext)();
  if (clockAudio.state === 'suspended') clockAudio.resume().catch(()=>{});
}
function clockAlarm() {
  if (clockMuted || !clockAudio) return;
  const now=clockAudio.currentTime;
  for(let i=0;i<3;i++){
    const oscillator=clockAudio.createOscillator(), gain=clockAudio.createGain(),start=now+i*.24;
    oscillator.frequency.value=880;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.12,start+.02);gain.gain.exponentialRampToValueAtTime(.001,start+.18);
    oscillator.connect(gain);gain.connect(clockAudio.destination);oscillator.start(start);oscillator.stop(start+.2);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
  }
}
function clockControl(source, action) {
  unlockClockAudio();
  const mode=timerModes[source], watch=stopwatches[source];
  if(action==='mute'){clockMuted=!clockMuted;localStorage.setItem('clock-muted',String(clockMuted));}
  else if(mode==='stopwatch'){
    if(action==='toggle'){
      if(watch.running){watch.elapsed=stopwatchElapsed(watch);watch.running=false;clockAlarm();}
      else {watch.startedAt=Date.now();watch.running=true;}
    }
    if(action==='lap'&&watch.running)watch.laps.push(stopwatchElapsed(watch));
    if(action==='reset'){watch.elapsed=0;watch.startedAt=0;watch.running=false;watch.laps=[];}
  }else if(mode!=='clock'){
    if(action==='toggle'){
      if(timer.running){timer.remaining=Math.max(0,Math.ceil((timer.end-Date.now())/1000));timer.running=false;}
      else {timer.end=Date.now()+timer.remaining*1000;timer.running=true;}
    }
    if(action==='reset'){timer.running=false;timer.remaining=mode==='short'?300:mode==='long'?900:1500;}
  }
  if(tab==='clock'||tab==='study')render();
  updateMiniClock();
}
function miniClockState() {
  const source=miniSource||'clock',mode=timerModes[source];
  return {label:(source==='study'?'공부용 시계':'시계')+(mode==='stopwatch'?' · 스톱워치':''),time:timeText(source),mode,running:mode==='stopwatch'?stopwatches[source].running:mode==='clock'?false:timer.running,muted:clockMuted};
}
function updateMiniClock() {
  if(!miniSource)return;
  if(!user){window.clockWidget?.close();window.desktop?.closeMiniClock?.();miniSource=null;return;}
  const state=miniClockState();
  window.clockWidget?.update(state);window.desktop?.updateMiniClock?.(state);
}
window.desktop?.onMiniAction?.(action=>{if(user&&miniSource)clockControl(miniSource,action);});
function activeStopwatch() {
  return stopwatches[tab === "study" ? "study" : "clock"];
}
function stopwatchElapsed(watch) {
  return watch.elapsed + (watch.running ? Date.now() - watch.startedAt : 0);
}
function stopwatchText(milliseconds) {
  const totalCentiseconds = Math.floor(Math.max(0, milliseconds) / 10);
  const centiseconds = totalCentiseconds % 100;
  const totalSeconds = Math.floor(totalCentiseconds / 100);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  const main = hours
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(totalMinutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${main}.${String(centiseconds).padStart(2, "0")}`;
}
function timeText(source = tab) {
  const mode = timerModes[source] || "clock";
  if (mode === "stopwatch") return stopwatchText(stopwatchElapsed(stopwatches[source]));
  if (mode === "clock")
    return new Date().toLocaleTimeString("ko-KR", { hour12: false });
  const s = timer.running
    ? Math.max(0, Math.ceil((timer.end - Date.now()) / 1000))
    : timer.remaining;
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
setInterval(() => {
  if (timer.running && Date.now() >= timer.end) {
    timer.running = false;
    timer.remaining = 0;
    clockAlarm();
    if (user) {
      localStorage.setItem(
        "sessions:" + user.id,
        1 + Number(localStorage.getItem("sessions:" + user.id) || 0),
      );
      notice("시간이 끝났습니다.");
      render();
    }
  }
  if ($("#time")) $("#time").textContent = timeText();
  updateMiniClock();
}, 250);
function quizKey(f) {
  return JSON.stringify([user.id, sharedSession?.owner || user.id, f.id]);
}
function wordsView(f) {
  if (window.wordTools.active(quizKey(f))) return window.wordTools.view(quizKey(f));
  const w = f.words[wordIndex];
  return `<div class="actions">${btn("단어 추가", "word-add", "plus")}${btn("CSV 가져오기", "word-import", "upload")}<span class="muted">${esc(f.name)} · ${f.words.length}개</span></div>${w ? `<div class="split"><div class="list" style="margin-top:30px">${f.words.map((x, i) => btn(esc(x.word), "word:" + i, "", i === wordIndex ? "primary" : "")).join("")}</div><div class="flash"><div class="word">${esc(w.word)}</div>${btn("발음", "speak", "volume-2")}<h2>${reveal ? esc(w.meaning) : "•••"}</h2><p>${reveal ? esc(w.example) : ""}</p><div class="actions" style="justify-content:center">${btn("이전", "word-prev", "chevron-left")}${btn(reveal ? "뜻 가리기" : "뜻 보기", "reveal", "eye")}${btn("다음", "word-next", "chevron-right")}</div><p>${wordIndex + 1} / ${f.words.length}</p>${btn(w.known ? "암기 완료" : "암기 완료로 표시", "known", "check")}${btn("삭제", "word-delete", "trash-2")}</div></div>` : '<div class="empty">첫 단어를 추가해주세요.</div>'}`;
}
function planView(f) {
  return `<div class="actions"><h2>${esc(f.name)}</h2>${btn("할 일 추가", "task-add", "plus")}</div><p class="muted">${f.tasks.filter((t) => t.done).length} / ${f.tasks.length} 완료</p>${f.tasks.map((t, i) => `<div class="task"><input type="checkbox" data-task="${i}" ${t.done ? "checked" : ""}><span style="text-decoration:${t.done ? "line-through" : "none"}">${esc(t.text)}</span><small>${esc(t.date)}</small>${btn("", "task-delete:" + i, "trash-2")}</div>`).join("") || '<div class="empty">할 일을 추가해주세요.</div>'}`;
}
function calendarView(f) {
  const y = month.getFullYear(),
    m = month.getMonth(),
    start = new Date(y, m, 1).getDay(),
    days = new Date(y, m + 1, 0).getDate();
  let cells = "";
  for (let i = 0; i < Math.ceil((start + days) / 7) * 7; i++) {
    const d = i - start + 1,
      date = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells +=
      d < 1 || d > days
        ? '<div class="day"></div>'
        : `<div class="day ${date === localDate() ? "today" : ""}" data-action="event-add:${date}">${d}${f.events
            .filter((e) => e.date === date)
            .map((e) => `<div class="event">${esc(e.text)}</div>`)
            .join("")}</div>`;
  }
  return `<div class="actions" style="margin-bottom:20px">${btn("", "month-prev", "chevron-left")}<h2>${y}년 ${m + 1}월</h2>${btn("", "month-next", "chevron-right")}${btn("오늘", "month-today")}</div><div class="calendar">${["일", "월", "화", "수", "목", "금", "토"].map((d) => `<div class="week">${d}</div>`).join("")}${cells}</div><h2>일정</h2>${f.events
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(
      (e, i) =>
        `<div class="task"><span>${esc(e.date)} · ${esc(e.text)}</span>${btn("", "event-delete:" + i, "trash-2")}</div>`,
    )
    .join("")}`;
}
function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function settingsView() {
  return `<div class="settings"><h2>계정과 저장</h2><p>${esc(user.email)}</p><p>Firebase 클라우드 동기화 계정</p><h2>백업</h2>${btn("전체 백업 내보내기", "export", "download")}<p><label>백업 가져오기 <input type="file" id="backup-import" accept=".json"></label></p><h2>화면</h2>${btn("라이트 / 다크 전환", "theme", "sun-moon")}<h2>데이터</h2><p>저장된 항목 ${files.length}개</p></div>`;
}
function firebaseDialog() {
  showModal(
    "Firebase 연결",
    `<p class="muted">Firebase 웹 앱의 공개 설정을 입력하세요. 연결 후 클라우드 계정으로 로그인합니다.</p><label>설정 JSON</label><textarea name="config" style="width:100%;height:180px" required placeholder='{"apiKey":"...","authDomain":"...","projectId":"...","appId":"..."}'>${esc(localStorage.getItem("firebaseConfig") || "")}</textarea>`,
    (d) => {
      const c = JSON.parse(d.get("config"));
      if (!c.apiKey || !c.projectId || !c.appId)
        throw Error("apiKey, projectId, appId가 필요합니다.");
      localStorage.setItem("firebaseConfig", JSON.stringify(c));
      location.reload();
    },
  );
}
async function importPdf(name) {
  const requestedName = String(name || "").trim();
  tab = "pdf";
  opened = null;
  folder = null;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".pdf";
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    const limit = user.cloud ? 10 * 1024 * 1024 : 3 * 1024 * 1024;
    if (file.size > limit) {
      notice(`현재 PDF 저장 한도는 파일당 ${user.cloud ? "10MB" : "3MB"}입니다.`);
      return;
    }
    const f = createFile("pdf", requestedName || file.name, folder, false);
    f.size = file.size;
    f.mimeType = "application/pdf";
    pdfBlobs.set(f.id, file);
    const r = new FileReader();
    r.onload = async () => {
      f.data = r.result;
      // Keep the destination explicit even if the user started this flow from
      // another feature or the renderer re-rendered while choosing the file.
      tab = "pdf";
      opened = f.id;
      if (await persist(f) === false) {
        files = files.filter(item => item.id !== f.id);
        render();
        return;
      }
      await openFile(f.id);
    };
    r.readAsDataURL(file);
  };
  input.click();
}
async function importBackup(e) {
  try {
    const payload = JSON.parse(await e.target.files[0].text());
    if (!Array.isArray(payload.files))
      throw Error("올바른 백업 파일이 아닙니다.");
    const allowed = [
      "folder",
      "note",
      "idea",
      "words",
      "plan",
      "calendar",
      "pdf",
    ];
    if (
      payload.files.some(
        (f) =>
          !allowed.includes(f.type) ||
          typeof f.name !== "string" ||
          typeof f.id !== "string",
      )
    )
      throw Error("지원하지 않는 항목이 있습니다.");
    const idMap = new Map(
      payload.files.map((f) => [f.id, crypto.randomUUID()]),
    );
    for (const old of payload.files) {
      const f = {
        ...old,
        id: idMap.get(old.id),
        parent: idMap.get(old.parent) || null,
      };
      files.push(f);
      await persist(f);
    }
    render();
    notice("백업을 새 항목으로 가져왔습니다.");
  } catch (err) {
    notice(err.message);
  }
}
document.addEventListener("change", (e) => {
  if (e.target.dataset.task !== undefined) {
    const f = current();
    f.tasks[+e.target.dataset.task].done = e.target.checked;
    persist(f);
    render();
  }
});
document.addEventListener("click", async (e) => {
  if ((cardMenu || saveMenu) && !e.target.closest(".card-menu,.card-dropdown,.save-split")) {
    cardMenu = null;
    saveMenu = false;
    document.querySelectorAll(".card-dropdown,.save-dropdown").forEach(menu => menu.remove());
  }
  const target = e.target.closest("[data-action]");
  if (!target) return;
  e.preventDefault();
  const [a, ...parts] = target.dataset.action.split(":"),
    id = parts.join(":");
  try {
    if (a === 'share-copy') {
      const value = $('#share-link')?.value;
      if (value) { await navigator.clipboard.writeText(value);notice('공유 링크를 복사했습니다.'); }
      else notice('확인을 눌러 공유 링크를 먼저 생성해주세요.');
      return;
    }
    if (a === "close") {
      modal.close();
      return;
    }
    if (modal.open) modal.close();
    const f = current();
    if (['stopwatch-toggle','stopwatch-lap','stopwatch-reset','timer-toggle','timer-reset','clock-mute'].includes(a)) {
      clockControl(tab,a==='clock-mute'?'mute':a.split('-')[1]);return;
    }
    switch (a) {
      case 'mini-clock':
        unlockClockAudio();miniSource=tab;
        if(window.desktop?.openMiniClock) await window.desktop.openMiniClock(miniClockState());
        else await window.clockWidget.open(action=>clockControl(miniSource,action));
        updateMiniClock();
        break;
      case 'share':
        await sharingDialog(id || undefined);
        break;
      case 'share-revoke':
        if (!sharingTarget) break;
        if (sharingTarget.type === 'folder') await cloud.revokeFolder(user.id, sharingTarget.id);
        else await cloud.revoke(sharingTarget.shareId);
        notice('공유를 해제했습니다.');
        break;
      case 'shared-copy':
        await navigator.clipboard.writeText('https://workspace-app-jeh.pages.dev/#share=' + id);
        notice('공유 링크를 복사했습니다.');
        break;
      case 'shared-open':
        if (sharedSession?.file.type === 'folder') sharedFolderTrail.push(sharedSession.id);
        history.pushState(null, '', '#share=' + encodeURIComponent(id));
        openSharedLink(true);
        break;
      case 'shared-parent': {
        flush();
        if (shareDirty || shareSaving) { notice('수정 내용을 저장한 뒤 공유 폴더로 돌아가주세요.'); break; }
        const parentLink = sharedFolderTrail.pop();
        if (parentLink) { history.pushState(null, '', '#share=' + encodeURIComponent(parentLink)); openSharedLink(true); }
        break;
      }
      case 'shared-exit':
        stopShared?.(); sharedSession = null; parkedShare = null; opened = null;
        delete openedTabs.workspace;
        history.replaceState(null, '', location.pathname + location.search);
        await nav('workspace');
        break;
      case "search-files":
        searchFiles();
        break;
      case "search-open": {
        const item = files.find(x => x.id === id);
        if (item?.type === "folder") nav("workspace");
        openFile(id);
        break;
      }
      case "auth-toggle":
        signup = !signup;
        authScreen();
        break;
      case "google-login": {
        await cloud.persistence($('#remember-login').checked);
        const result = await cloud.googleLogin();
        if (user?.id !== result.user.uid) await enter({ id: result.user.uid, email: result.user.email || "Google 계정", cloud: true });
        break;
      }
      case "firebase":
        firebaseDialog();
        break;
      case "reset-password":
        showModal(
          "비밀번호 재설정",
          '<input type="email" name="email" required placeholder="이메일">',
          async (d) => {
            await cloud.reset(d.get("email"));
            notice("재설정 이메일을 요청했습니다.");
          },
        );
        break;
      case "tab":
        if (id === 'workspace' && current() && !target.closest('.sidebar')) closeDocument('workspace');
        else nav(id);
        break;
      case "collapse":
        collapsed = !collapsed;
        render();
        break;
      case "new-window":
        if (window.desktop?.newWindow) window.desktop.newWindow();
        else window.open(location.href, "_blank", "noopener");
        break;
      case "new-folder":
        createDialog("folder");
        break;
      case "fresh":
        flush();
        drafts[tab] = null;
        opened = null;
        wordIndex = 0;
        reveal = false;
        render();
        break;
      case "template": {
        const [type, kind] = id.split(":");
        startTemplate(type, kind);
        break;
      }
      case "pdf-open":
        importPdf();
        break;
      case "new":
        createDialog(
          ["note", "idea", "words", "plan", "calendar", "pdf"].includes(tab)
            ? tab
            : null,
        );
        break;
      case "open":
        openFile(id);
        break;
      case "card-menu":
        cardMenu = cardMenu === id ? null : id;
        render();
        break;
      case "copy": {
        const source = files.find((x) => x.id === id);
        if (!source) break;
        const duplicate = JSON.parse(JSON.stringify(source));
        delete duplicate.shareId;
        delete duplicate.revision;
        duplicate.id = crypto.randomUUID();
        duplicate.name = `${source.name} 복사본`;
        duplicate.created = Date.now();
        duplicate.modified = Date.now();
        duplicate.lastOpened = null;
        duplicate.star = false;
        if (duplicate.type === "pdf" && user.cloud) {
          duplicate.data = await blobDataUrl(await pdfBlob(source));
          duplicate.hasPdfBody = true;
          pdfBlobs.set(duplicate.id, pdfBlobs.get(source.id));
        }
        await persist(duplicate);
        cardMenu = null;
        render();
        notice("복사본을 만들었습니다.");
        break;
      }
      case "root":
        folder = null;
        render();
        break;
      case "up":
        folder = files.find((x) => x.id === folder)?.parent || null;
        render();
        break;
      case "back":
        flush();
        opened = null;
        render();
        break;
      case "feature-home": {
        closeDocument();
        break;
      }
      case "feature-prev":
      case "feature-next": {
        flush();
        const items = featureItems();
        const index = items.findIndex((x) => x.id === opened);
        const next = items[index + (a === "feature-prev" ? -1 : 1)];
        if (next) openFile(next.id);
        break;
      }
      case "save-menu":
        saveMenu = !saveMenu;
        render();
        break;
      case "save-workspace": {
        flush();
        const item = current();
        if (item) {
          await persist(item);
          opened = item.id;
        }
        saveMenu = false;
        render();
        notice("작업공간에 저장했습니다.");
        break;
      }
      case "save-local": {
        flush();
        const item = current();
        let localItem = item;
        if (item?.type === "pdf" && window.desktop?.saveLocal && !item.data) {
          localItem = { ...item, data: await blobDataUrl(await pdfBlob(item)) };
        }
        const saved = item && (window.desktop?.saveLocal
          ? await window.desktop.saveLocal(localItem)
          : await browserSaveLocal(item));
        saveMenu = false;
        render();
        if (saved) notice("로컬 파일로 저장했습니다.");
        break;
      }
      case "save":
        flush();
        if (f) { if (await persist(f) === false) break; opened = f.id; if (!sharedSession || !shareDirty) render(); }
        notice("저장했습니다.");
        break;
      case "menu":
        menuFile(id);
        break;
      case "move":
        flush();
        if (!id && f) { await persist(f); opened = f.id; }
        moveDialog(id || f?.id);
        break;
      case "rename": {
        const x = files.find((x) => x.id === id);
        showModal(
          "이름 변경",
          `<input name="name" required maxlength="200" value="${esc(x.name)}">`,
          (d) => {
            x.name = d.get("name").trim();
            persist(x);
            render();
          },
        );
        break;
      }
      case "star":
      case "favorite": {
        flush();
        const x = id ? files.find((x) => x.id === id) : f;
        if (!x || (sharedSession && sharedSession.owner !== user.id)) break;
        x.star = !x.star;
        persist(x);
        render();
        break;
      }
      case "delete":
      case "restore": {
        const x = files.find((x) => x.id === id);
        const affected = new Set([id]);
        let growth=true;
        while(growth){growth=false;files.forEach(f=>{if(affected.has(f.parent)&&!affected.has(f.id)){affected.add(f.id);growth=true;}});}
        for(const child of files.filter(f=>affected.has(f.id))){
          if(a==='delete'&&!child.deleted){child.deleted=true;child.trashGroup=id;await persist(child);}
          else if(a==='restore'&&(child.id===id||child.trashGroup===id)){child.deleted=false;delete child.trashGroup;await persist(child);}
        }
        if (!x.deleted && files.find((z) => z.id === x.parent)?.deleted)
          x.parent = null;
        persist(x);
        render();
        break;
      }
      case "destroy":
        showModal(
          "영구 삭제",
          "<p>이 항목은 복구할 수 없습니다.</p>",
          async () => {
            for(const child of files.filter(x=>x.parent===id)){child.parent=null;await persist(child);}
            if (user.cloud) await cloud.remove(user.id, id);
            if (pdfUrls.has(id)) URL.revokeObjectURL(pdfUrls.get(id));
            pdfUrls.delete(id);pdfBlobs.delete(id);pdfLoads.delete(id);
            files = files.filter((x) => x.id !== id);
            cache();
            render();
          },
        );
        break;
      case "logout":
        stopShared?.();sharedSession=null;
        flush();
        timer.running = false;
        cloud.unwatch();
        if (user.cloud) await cloud.logout();
        files = [];
        opened = null;
        authScreen();
        break;
      case "account":
        showModal(
          "계정",
          `<p>${esc(user.email)}</p><p>${user.cloud ? "Firebase 동기화 계정" : "로컬 계정"}</p>${btn("라이트 / 다크", "theme", "sun-moon")}${btn("비밀번호 변경", "password", "key-round")}${!window.desktop ? `<hr>${btn('데스크톱 앱 설치','desktop-install','download')}` : ''}`,
          () => {},
        );
        break;
      case 'desktop-install': {
        if (window.desktop) break;
        const response = await fetch('desktop-download.json', {cache:'no-store'});
        if (!response.ok) { notice('설치 파일 정보를 불러오지 못했습니다.'); break; }
        const config = await response.json();
        if (!config.windowsUrl && !config.macUrl) {
          modal.close();
          showModal('데스크톱 앱 설치', '<p>Windows 설치 파일 준비 중입니다.</p><p>아직 다운로드가 제공되지 않습니다.</p>', () => {});
          break;
        }
        modal.close();
        showModal('데스크톱 앱 설치 안내', `<p>Workspace 공식 배포 파일입니다. 코드 서명 및 Apple 공증이 없어 첫 실행 시 보안 경고가 표시될 수 있습니다.</p><p><strong>Windows</strong><br>공식 파일인지 확인한 뒤 ‘추가 정보 → 실행’을 누르세요.</p><p><strong>Mac</strong><br>DMG를 열고 Workspace를 Applications 폴더로 옮기세요. 실행이 차단되면 시스템 설정 → 개인정보 보호 및 보안에서 해당 앱의 ‘확인 없이 열기’를 선택하세요.</p><p>출처가 다르거나 악성코드로 탐지된 경우 실행하지 마세요. 보안 기능 전체를 끌 필요는 없습니다.</p>`, () => {
          setTimeout(() => {
            showModal('운영체제 선택', `<div class="download-platforms"><button type="button" id="download-windows" ${config.windowsUrl ? '' : 'disabled'}>${icon('monitor')}<span>Windows용 다운로드<small>Windows 10 · 11 / 64비트</small></span></button><button type="button" id="download-mac" ${config.macUrl ? '' : 'disabled'}>${icon('laptop')}<span>Mac용 다운로드<small>Apple Silicon · Intel / macOS 12 이상</small></span></button></div>`, () => {});
            modal.classList.add('install-guide');
            modal.querySelector('[type="submit"]').remove();
            for (const [id, address] of [['download-windows', config.windowsUrl], ['download-mac', config.macUrl]]) {
              document.getElementById(id).onclick = () => {
                try {
                  const url = new URL(address);
                  if (url.protocol !== 'https:') throw new Error('올바른 설치 파일 주소가 아닙니다.');
                  const link = document.createElement('a');
                  link.href=url.href; link.target='_blank'; link.rel='noopener noreferrer';
                  document.body.append(link); link.click(); link.remove();
                  modal.close();
                } catch(error) { notice(error.message); }
              };
            }
          }, 0);
        });
        modal.classList.add('install-guide');
        modal.querySelector('[type="submit"]').textContent = '확인하고 다운로드';
        break;
      }
      case "password":
        if (user.cloud) {
          await cloud.reset(user.email);
          notice("비밀번호 재설정 이메일을 요청했습니다.");
        } else
          showModal(
            "비밀번호 변경",
            '<input type="password" name="old" required placeholder="현재 비밀번호"><input type="password" name="new" minlength="8" required placeholder="새 비밀번호 (8자 이상)">',
            async (d) => {
              const all = JSON.parse(localStorage.getItem("accounts")),
                x = all[user.email];
              if ((await hashPassword(d.get("old"), x.salt)) !== x.hash)
                throw Error("현재 비밀번호가 올바르지 않습니다.");
              x.salt = crypto.randomUUID();
              x.hash = await hashPassword(d.get("new"), x.salt);
              localStorage.setItem("accounts", JSON.stringify(all));
              notice("비밀번호를 변경했습니다.");
            },
          );
        break;
      case "theme":
        document.body.classList.toggle("dark");
        localStorage.setItem("dark", document.body.classList.contains("dark"));
        break;
      case "export":
        flush();
        const backupFiles = await Promise.all(files.map(async file => {
          if (!user.cloud || file.type !== "pdf" || file.data) return file;
          return { ...file, data: await cloud.loadPdf(user.id, file.id) };
        }));
        const backup = JSON.stringify({ version: 1, files: backupFiles }, null, 2);
        if (window.desktop?.export) await window.desktop.export(backup);
        else browserDownload("workspace-backup.json", backup, "application/json");
        notice("백업 파일을 내보냈습니다.");
        break;
      case "bold":
      case "italic":
      case "checklist": {
        const ta = $("#edit-body"),
          s = ta.selectionStart,
          end = ta.selectionEnd,
          mark = a === "bold" ? "**" : a === "italic" ? "*" : "- [ ] ";
        ta.setRangeText(
          mark + ta.value.slice(s, end) + (a === "checklist" ? "" : mark),
          s,
          end,
          "end",
        );
        ta.focus();
        flush();
        break;
      }
      case "fullscreen":
        await (document.fullscreenElement
          ? document.exitFullscreen()
          : document.documentElement.requestFullscreen());
        break;
      case "mode":
        timerModes[tab] = id;
        timer.running = false;
        if (id !== "stopwatch") {
          timer.remaining = id === "short" ? 300 : id === "long" ? 900 : 1500;
        }
        render();
        break;
      case "timer-set":
        timer.remaining =
          Math.min(240, Math.max(1, Number($("#minutes").value) || 25)) * 60;
        timer.running = false;
        render();
        break;
      case "word-add":
        showModal(
          "단어 추가",
          '<input name="word" required placeholder="단어"><input name="meaning" required placeholder="뜻"><input name="example" placeholder="예문">',
          (d) => {
            f.words.push({
              word: d.get("word"),
              meaning: d.get("meaning"),
              example: d.get("example"),
              known: false,
            });
            persist(f);
            render();
          },
        );
        break;
      case "word":
        wordIndex = +id;
        reveal = false;
        render();
        break;
      case "word-prev":
        wordIndex = (wordIndex - 1 + f.words.length) % f.words.length;
        reveal = false;
        render();
        break;
      case "word-next":
        wordIndex = (wordIndex + 1) % f.words.length;
        reveal = false;
        render();
        break;
      case "reveal":
        reveal = !reveal;
        render();
        break;
      case "known":
        f.words[wordIndex].known = !f.words[wordIndex].known;
        persist(f);
        render();
        break;
      case "word-delete":
        f.words.splice(wordIndex, 1);
        wordIndex = 0;
        persist(f);
        render();
        break;
      case "speak": {
        const u = new SpeechSynthesisUtterance(f.words[wordIndex].word);
        u.lang = "en-US";
        speechSynthesis.speak(u);
        break;
      }
      case 'word-quiz':
        window.wordTools.quiz(f.words || [], quizKey(f), render);
        break;
      case "word-import":
        window.wordTools.import(async words => {
          f.words.push(...words);
          await persist(f);
          render();
          notice(`${words.length}개 단어를 가져왔습니다.`);
        }, notice);
        break;
      case "task-add":
        showModal(
          "할 일 추가",
          '<input name="text" required placeholder="할 일"><input name="date" type="date">',
          (d) => {
            f.tasks.push({
              text: d.get("text"),
              date: d.get("date"),
              done: false,
            });
            persist(f);
            render();
          },
        );
        break;
      case "task-delete":
        f.tasks.splice(+id, 1);
        persist(f);
        render();
        break;
      case "month-prev":
        month = new Date(month.getFullYear(), month.getMonth() - 1, 1);
        render();
        break;
      case "month-next":
        month = new Date(month.getFullYear(), month.getMonth() + 1, 1);
        render();
        break;
      case "month-today":
        month = new Date();
        render();
        break;
      case "event-add":
        showModal(
          "일정 추가",
          `<input type="date" name="date" value="${id}" required><input name="text" required placeholder="일정">`,
          (d) => {
            f.events.push({ date: d.get("date"), text: d.get("text") });
            persist(f);
            render();
          },
        );
        break;
      case "event-delete":
        f.events.splice(+id, 1);
        persist(f);
        render();
        break;
    }
  } catch (err) {
    notice(errorMessage(err));
  }
});
window.addEventListener("beforeunload", flush);
window.prepareWorkspaceUpdate = async () => {
  clearTimeout(saveTimer);
  if (!user) return;
  if (shareSaving) throw Error('저장 중입니다. 잠시 후 다시 눌러주세요.');
  const file = current();
  if (!file) return;
  if (sharedSession && sharedSession.owner !== user.id && sharedSession.role !== 'editor') return;
  if ($('#edit-title')) {
    file.name = $('#edit-title').value.trim() || '제목 없음';
    file.body = $('#edit-body').value;
  }
  if (user.cloud) await cloud.save(sharedSession?.owner || user.id, file);
  if (!sharedSession) {
    if (!files.some(item => item.id === file.id)) files.push(file);
    cache();
  }
  shareDirty = false;
};
document.addEventListener("keydown", e => {
  if (user && !modal.open && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    searchFiles();
  }
  if (e.key === "Escape") {
    cardMenu = null;
    saveMenu = false;
    document.querySelectorAll(".card-dropdown,.save-dropdown").forEach(menu => menu.remove());
  }
});
document.addEventListener('keydown',async e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();flush();if(sharedSession) await persist(sharedSession.file);}});
window.addEventListener('hashchange', () => { if (user) openSharedLink(); });
window.addEventListener('storage',e=>{if(user&&e.key==='files:'+user.id&&!document.activeElement?.matches('textarea,.title-input')){files=JSON.parse(e.newValue||'[]');render();}});
if (localStorage.getItem("dark") !== "false")
  document.body.classList.add("dark");
try {
  cloud.init(defaultFirebaseConfig);
  cloudConfigured = true;
} catch (e) {
  notice("Firebase 설정을 확인해주세요.");
}
if (cloudConfigured && cloud.ready) {
  $('#app').innerHTML = '<div class="auth"><div class="session-check" role="status" aria-live="polite"><div class="mark">W</div><h1>Workspace</h1><span class="session-spinner" aria-hidden="true"></span><p>세션 확인 중</p></div></div>';
  let firstAuthState = true;
  let clearingSession = false;
  const checkTimer = setTimeout(() => {
    if (firstAuthState) $('#app').innerHTML = '<div class="auth"><div class="session-check" role="status"><h1>Workspace</h1><p>세션 확인이 지연되고 있습니다.</p><button type="button" id="retry-session">다시 확인</button></div></div>';
    $('#retry-session')?.addEventListener('click', () => location.reload());
  }, 15000);
  cloud.ready(async account => {
    clearTimeout(checkTimer);
    if (clearingSession) return;
    if (firstAuthState) {
      firstAuthState = false;
      if (localStorage.getItem('remember-login') !== 'true' && account) {
        clearingSession = true;
        try { await cloud.logout(); }
        catch { /* Automatic entry remains disabled if clearing a saved session fails. */ }
        finally { clearingSession = false; authScreen(); }
        return;
      }
    }
    if (account && user?.id !== account.uid) await enter({id:account.uid,email:account.email || 'Google 계정',cloud:true});
    else if (!account) {
      if (user?.cloud) { cloud.unwatch();stopShared?.();sharedSession=null; }
      authScreen();
    }
  }, error => {
    clearTimeout(checkTimer);
    firstAuthState = false;
    authScreen();
    $('#autherror').textContent = errorMessage(error);
  });
} else authScreen();
