(() => {
  const RELEASE='3.7.10';
  const IRIS='Iris';
  const RAID_LEADER='Onie';
  let storageIssue=null;
  let actionIssue=null;
  let versionObserver=null;

  window.__AVOID_IRIS__=Object.freeze({
    name:IRIS,
    release:RELEASE,
    raidLeader:RAID_LEADER,
    architecture:'multi-encounter',
    corpusScope:'encounter+difficulty+partition',
  });

  function patchVersion(){
    const b=document.querySelector('.sidebar .division b,.division b');
    if(!b)return;
    const wanted=`v${RELEASE}`;
    if(b.textContent!==wanted)b.textContent=wanted;
    b.title=`AvoiD Raid Operations ${wanted} · Iris intelligence`;
    if(!versionObserver){
      versionObserver=new MutationObserver(()=>{
        if(b.textContent!==wanted)b.textContent=wanted;
      });
      versionObserver.observe(b,{childList:true,characterData:true,subtree:true});
    }
  }

  function patchRaidLeader(){
    const profile=document.querySelector('.sidebar .profile,.profile');
    if(!profile)return;
    profile.classList.add('iris-profile');
    const avatar=profile.querySelector('i');
    const name=profile.querySelector('span b,b');
    const role=profile.querySelector('span small,small');
    if(avatar)avatar.textContent='ON';
    if(name)name.textContent=RAID_LEADER;
    if(role)role.textContent='Raid Leader · AvoiD';
  }

  function patchIrisBrand(){
    const panel=document.querySelector('.corpus-workbench');
    if(!panel)return;
    const title=panel.querySelector('.panel-title');
    if(!title)return;
    const candidates=[...title.querySelectorAll('i,span,b,small')];
    const mark=candidates.find(el=>String(el.textContent||'').trim().toUpperCase()==='AI');
    if(mark){mark.textContent='IRIS';mark.classList.add('iris-mark');mark.title='Iris · AvoiD raid intelligence';}
  }

  function corpusRoot(){return document.querySelector('.encounter-intelligence-v375');}
  function corpusPanel(){return document.querySelector('.corpus-workbench');}
  function actionButtons(){return [...(corpusPanel()?.querySelectorAll('button')||[])];}
  function actionLabel(button){return String(button?.textContent||'').trim().toUpperCase();}
  function corpusActionButton(button){return /BUILD CORPUS|BUILD|ENRICH|IMPROVE|RECOMPILE|RESUME|PAUSE|RESET|TRY AGAIN/.test(actionLabel(button));}

  function disableCorpusActions(){
    for(const button of actionButtons()){
      if(!corpusActionButton(button))continue;
      if(button.dataset.irisStorageDisabled!=='1')button.dataset.irisWasDisabled=button.disabled?'1':'0';
      button.disabled=true;
      button.style.pointerEvents='none';
      button.style.opacity='.42';
      button.dataset.irisStorageDisabled='1';
      button.title='Corpus actions are disabled while Vercel Blob is blocked by its usage limit.';
    }
  }

  function restoreCorpusActions(){
    for(const button of actionButtons()){
      if(button.dataset.irisStorageDisabled!=='1')continue;
      button.disabled=button.dataset.irisWasDisabled==='1';
      button.style.pointerEvents='';
      button.style.opacity='';
      delete button.dataset.irisStorageDisabled;
      delete button.dataset.irisWasDisabled;
    }
  }

  function renderStorageIssue(){
    const panel=corpusPanel();
    if(!panel)return;
    let alert=panel.querySelector('.iris-storage-alert');
    if(!storageIssue){
      alert?.remove();
      corpusRoot()?.classList.remove('iris-storage-blocked');
      restoreCorpusActions();
      return;
    }
    if(!alert){
      alert=document.createElement('div');
      alert.className='iris-storage-alert';
      const host=corpusRoot()||panel;
      if(host===panel){
        const title=panel.querySelector('.panel-title');
        title?.insertAdjacentElement('afterend',alert);
      }else host.prepend(alert);
    }
    alert.innerHTML=`<div><b>IRIS STORAGE BLOCKED</b><p>Vercel Blob has reached the current plan operation limit, so corpus reads and writes are unavailable.</p><small>The corpus has not been reset or deleted. AvoiD has stopped browser-side corpus polling for this session to avoid pointless retries.</small></div><em>403 · STORAGE</em>`;
    corpusRoot()?.classList.add('iris-storage-blocked');
    disableCorpusActions();
  }

  function renderActionIssue(){
    const panel=corpusPanel();
    if(!panel)return;
    let alert=panel.querySelector('.iris-action-alert');
    if(!actionIssue){alert?.remove();return;}
    if(!alert){
      alert=document.createElement('div');
      alert.className='iris-action-alert';
      const title=panel.querySelector('.panel-title');
      title?.insertAdjacentElement('afterend',alert);
    }
    const status=actionIssue.status?`HTTP ${actionIssue.status}`:'NETWORK';
    const code=actionIssue.code?` · ${actionIssue.code}`:'';
    alert.innerHTML=`<div><b>IRIS ACTION FAILED</b><p>${escapeHtml(actionIssue.message||'The corpus action could not be completed.')}</p><small>${escapeHtml(actionIssue.action||'CORPUS')} · ${status}${escapeHtml(code)}</small></div><button type="button" aria-label="Dismiss error">DISMISS</button>`;
    alert.querySelector('button')?.addEventListener('click',()=>{actionIssue=null;renderActionIssue();},{once:true});
  }

  function escapeHtml(value){
    return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function rememberStorageFailure(payload,status){
    const message=String(payload?.error||'');
    if(payload?.code==='CORPUS_BLOB_READ_BLOCKED'||status===403||/Vercel Blob: Failed to fetch blob: 403 Forbidden/i.test(message)||/Blob content access is blocked \(403 Forbidden\)/i.test(message)){
      storageIssue={at:Date.now(),message,storage:payload?.storage||null};
      actionIssue=null;
      renderStorageIssue();
      renderActionIssue();
      return true;
    }
    return false;
  }

  function requestInfo(args){
    const first=args[0];
    const init=args[1]||{};
    const raw=typeof first==='string'?first:first?.url||'';
    const url=new URL(String(raw||location.href),location.origin);
    const method=String(init.method||first?.method||'GET').toUpperCase();
    let action=url.searchParams.get('action')||'';
    if(method!=='GET'&&init.body){
      try{action=JSON.parse(String(init.body))?.action||action;}catch{}
    }
    return{url,method,action:String(action||'corpus').toUpperCase(),isCorpus:url.pathname==='/api/wcl/corpus'};
  }

  function blockedResponse(){
    return new Response(JSON.stringify({
      ok:false,
      code:'CORPUS_BLOB_READ_BLOCKED',
      error:'Iris corpus storage is blocked by the current Vercel Blob usage limit. Reload the page after storage access is restored to retry.',
      storage:storageIssue?.storage||{kind:'vercel-blob-private',corpusReset:false},
    }),{status:503,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
  }

  const nativeFetch=window.fetch.bind(window);
  window.fetch=async (...args)=>{
    let info;
    try{info=requestInfo(args);}catch{info={isCorpus:false,method:'GET',action:'CORPUS'};}
    if(info.isCorpus&&storageIssue)return blockedResponse();

    let response;
    try{
      response=await nativeFetch(...args);
    }catch(error){
      if(info.isCorpus&&info.method!=='GET'){
        actionIssue={at:Date.now(),action:info.action,status:0,code:'NETWORK_ERROR',message:String(error?.message||error||'Network request failed')};
        renderActionIssue();
      }
      throw error;
    }

    if(!info.isCorpus)return response;
    try{
      const payload=await response.clone().json().catch(()=>null);
      if(!response.ok){
        if(!rememberStorageFailure(payload,response.status)&&info.method!=='GET'){
          actionIssue={
            at:Date.now(),
            action:info.action,
            status:response.status,
            code:String(payload?.code||'CORPUS_ACTION_FAILED'),
            message:String(payload?.error||`Corpus action failed with HTTP ${response.status}`),
          };
          renderActionIssue();
        }
      }else if(info.method!=='GET'){
        actionIssue=null;
        renderActionIssue();
      }
    }catch{}
    return response;
  };

  function patchAll(){patchVersion();patchRaidLeader();patchIrisBrand();renderStorageIssue();renderActionIssue();}
  document.addEventListener('DOMContentLoaded',patchAll,{once:true});
  window.addEventListener('load',patchAll,{once:true});
  setInterval(patchAll,1200);
})();
