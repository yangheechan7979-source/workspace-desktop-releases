(() => {
  function mount(doc, action, floating) {
    const root=doc.createElement('section'); root.className='mini-clock'+(floating?' mini-overlay':'');
    root.setAttribute('aria-label','작은 시계');
    root.innerHTML='<header><strong>시계</strong><button data-mini="close" title="작은 시계 닫기" aria-label="작은 시계 닫기"><i data-lucide="x"></i></button></header><output></output><nav></nav>';
    doc.body.append(root);
    root.onclick=event=>{const button=event.target.closest('[data-mini]');if(button)action(button.dataset.mini);};
    let signature='';
    const update=state=>{
      root.querySelector('strong').textContent=state.label;
      root.querySelector('output').textContent=state.time;
      const next=JSON.stringify([state.mode,state.running,state.muted]);
      if(next!==signature){
        signature=next;
        const button=(type,label,icon,disabled=false)=>`<button data-mini="${type}" title="${label}" aria-label="${label}" ${disabled?'disabled':''}><i data-lucide="${icon}"></i></button>`;
        root.querySelector('nav').innerHTML=button('toggle',state.running?'정지':'시작',state.running?'pause':'play',state.mode==='clock')+button('lap','랩','flag',state.mode!=='stopwatch'||!state.running)+button('reset','초기화','rotate-ccw',state.mode==='clock')+button('mute',state.muted?'소리 켜기':'음소거',state.muted?'volume-x':'volume-2');
        root.querySelectorAll('[data-lucide]').forEach(element=>{const name=element.dataset.lucide.replace(/(^|-)(\w)/g,(_,dash,letter)=>letter.toUpperCase());if(window.lucide?.[name])element.replaceWith(window.lucide.createElement(window.lucide[name]));});
      }
    };
    const clamp=()=>{if(!floating)return;const rect=root.getBoundingClientRect();root.style.left=`${Math.max(0,Math.min(innerWidth-root.offsetWidth,rect.left))}px`;root.style.top=`${Math.max(0,Math.min(innerHeight-root.offsetHeight,rect.top))}px`;root.style.right='auto';root.style.bottom='auto';};
    if(floating){
      window.addEventListener('resize',clamp);
      const header=root.querySelector('header');
      header.onpointerdown=event=>{
        if(event.target.closest('button'))return;
        const rect=root.getBoundingClientRect(),dx=event.clientX-rect.left,dy=event.clientY-rect.top;
        header.setPointerCapture(event.pointerId);
        header.onpointermove=move=>{root.style.left=`${Math.max(0,Math.min(innerWidth-root.offsetWidth,move.clientX-dx))}px`;root.style.top=`${Math.max(0,Math.min(innerHeight-root.offsetHeight,move.clientY-dy))}px`;root.style.right='auto';root.style.bottom='auto';};
        header.onpointerup=header.onpointercancel=()=>{header.onpointermove=null;};
      };
    }
    return {root,update,destroy(){window.removeEventListener('resize',clamp);root.remove();}};
  }
  if(document.body.classList.contains('mini-window')){
    const widget=mount(document,action=>window.desktop.miniAction(action),false);
    window.desktop.onMiniState(widget.update);
    window.desktop.miniReady();
    return;
  }
  let widget,pip;
  window.clockWidget={
    async open(action){
      this.close();
      if(window.documentPictureInPicture){
        try{
          pip=await window.documentPictureInPicture.requestWindow({width:280,height:160});
          const link=pip.document.createElement('link');link.rel='stylesheet';link.href=new URL('mini-clock.css',location.href).href;pip.document.head.append(link);pip.document.body.className='mini-window';
          widget=mount(pip.document,type=>type==='close'?this.close():action(type),false);
          pip.addEventListener('pagehide',()=>{widget=null;pip=null;},{once:true});return;
        }catch{}
      }
      widget=mount(document,type=>type==='close'?this.close():action(type),true);
    },
    update(state){widget?.update(state);},
    close(){widget?.destroy();widget=null;if(pip){const old=pip;pip=null;old.close();}},
  };
})();
