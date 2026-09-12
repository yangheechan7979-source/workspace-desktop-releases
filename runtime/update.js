(() => {
  const currentVersion = document.querySelector('meta[name="workspace-version"]').content;
  const endpoint = 'https://workspace-app-jeh.pages.dev/version.json';
  let pending = null;
  let checking = false;
  async function check() {
    if (checking || document.hidden || pending) return;
    checking = true;
    try {
      const response = await fetch(endpoint, {cache:'no-store'});
      if (!response.ok) return;
      const release = await response.json();
      if (!Number.isSafeInteger(release.version) || release.version <= Number(currentVersion)) return;
      if (localStorage.getItem('update-dismissed') === String(release.version)) return;
      pending = release;
      show();
    } catch { /* An offline check can wait until the next interval. */ }
    finally { checking = false; }
  }
  function show() {
    if (!pending || document.querySelector('dialog[open]')) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'update-dialog';
    const desktop = Boolean(window.desktop);
    dialog.innerHTML = `<h2>Workspace 새 버전이 출시되었습니다</h2><p>${desktop ? '새로운 기능과 개선 사항이 추가되었습니다. 새 데스크톱 버전을 설치해주세요.' : '새로운 기능과 개선 사항이 추가되었습니다.'}</p><p id="update-error" role="status"></p><div class="actions"><button type="button" id="update-later">나중에</button>${desktop ? '<button type="button" id="update-close" class="primary">확인</button>' : '<button type="button" id="update-now" class="primary">업데이트</button>'}</div>`;
    document.body.appendChild(dialog);
    const dismiss = () => {
      localStorage.setItem('update-dismissed', String(pending.version));
      pending = null;
      dialog.close();dialog.remove();
    };
    dialog.addEventListener('cancel', event => {event.preventDefault();dismiss();});
    dialog.querySelector('#update-later').onclick = dismiss;
    dialog.querySelector('#update-close')?.addEventListener('click', () => {
      dialog.querySelector('h2').textContent = '다시 실행해주세요';
      dialog.querySelector('p').textContent = '확인을 누르면 작성 내용을 저장하고 Workspace를 종료합니다.';
      const oldButton = dialog.querySelector('#update-close');
      const confirm = oldButton.cloneNode(true);
      oldButton.replaceWith(confirm);
      confirm.onclick = async () => {
        confirm.disabled = true;
        dialog.querySelector('#update-later').disabled = true;
        try {
          await window.prepareWorkspaceUpdate();
          await window.desktop.quitForUpdate();
        } catch (error) {
          dialog.querySelector('#update-error').textContent = error.message;
          confirm.disabled = false;
          dialog.querySelector('#update-later').disabled = false;
        }
      };
      confirm.focus();
    });
    dialog.querySelector('#update-now')?.addEventListener('click', async event => {
      event.target.disabled = true;
      try {
        await window.prepareWorkspaceUpdate();
        location.reload();
      } catch (error) {
        dialog.querySelector('#update-error').textContent = error.message;
        event.target.disabled = false;
      }
    });
    dialog.showModal();
  }
  setTimeout(check, 5000);
  setInterval(check, 60000);
  setInterval(() => {if (pending && !document.querySelector('#update-dialog')) show();}, 2000);
  document.addEventListener('visibilitychange', check);
})();
