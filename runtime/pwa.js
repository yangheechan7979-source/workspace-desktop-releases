(() => {
  let pendingInstall;
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); pendingInstall = event; });
  window.addEventListener('appinstalled', () => { pendingInstall = null; });
  window.installWorkspace = async () => {
    if (standalone()) { notice('이미 앱으로 실행 중입니다.'); return; }
    if (pendingInstall) {
      const prompt = pendingInstall;
      pendingInstall = null;
      document.querySelector('#modal')?.close();
      await prompt.prompt();
      await prompt.userChoice;
      return;
    }
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    showModal('Workspace 앱 설치', `<p>${ios ? 'Safari에서 이 사이트를 연 뒤 공유 버튼 → 홈 화면에 추가 → 추가를 누르세요.' : '브라우저 메뉴에서 앱 설치 또는 홈 화면에 추가를 선택하세요. 설치 메뉴가 없으면 Chrome이나 Edge에서 다시 열어주세요.'}</p><p>클라우드 자료를 열고 동기화하려면 인터넷 연결이 필요합니다.</p>`, () => {});
  };
  if (!window.desktop && ['http:','https:'].includes(location.protocol) && 'serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('/sw.js', {updateViaCache:'none'}).catch(error => console.warn('Workspace offline page unavailable:', error.message));
  }
  const closeMenu = () => {
    const trigger = document.querySelector('.mobile-menu');
    document.body.classList.remove('mobile-nav-open');
    trigger?.setAttribute('aria-expanded','false');
    document.querySelector('.main')?.removeAttribute('inert');
  };
  document.addEventListener('click', event => {
    const trigger = event.target.closest('.mobile-menu');
    if (trigger) {
      const open = document.body.classList.toggle('mobile-nav-open');
      trigger.setAttribute('aria-expanded',String(open));
      if (open) {
        document.querySelector('.main')?.setAttribute('inert','');
        document.querySelector('.sidebar button')?.focus();
      } else closeMenu();
    } else if (event.target.closest('.mobile-shade, .sidebar [data-action]')) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (!document.body.classList.contains('mobile-nav-open')) return;
    if (event.key === 'Escape') { closeMenu(); document.querySelector('.mobile-menu')?.focus(); }
    if (event.key === 'Tab') {
      const buttons = [...document.querySelectorAll('.sidebar button')].filter(button => !button.disabled);
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) {event.preventDefault();last?.focus();}
      else if (!event.shiftKey && document.activeElement === last) {event.preventDefault();first?.focus();}
    }
  });
  matchMedia('(max-width: 760px)').addEventListener('change',closeMenu);
})();
