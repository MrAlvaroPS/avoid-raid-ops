(() => {
  const RELEASE='3.7.6';
  const IRIS='Iris';
  const RAID_LEADER='Onie';
  let storageIssue=null;
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

  function renderStorageIssue(){
    const panel=document.querySelector('.corpus-workbench');
    if(!panel)return;
    let alert=panel.querySelector('.iris-storage-alert');
    if(!storageIssue){
      alert?.remove();
      corpusRoot()?.classList.remove('iris-storage-blocked');
      for(const button of corpusRoot()?.querySelectorAll('.ei3-btn')||[]){
        if(button.dataset.irisStorageDisabled==='1'){
          button.disabled=false;button.style.pointerEvents='';button.style.opacity='';delete button.dataset.irisStorageDisabled;
        }
      }
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
    alert.innerHTML=`<div><b>IRIS STORAGE BLOCKED</b><p>Vercel Blob is refusing corpus content reads with HTTP 403. The stored corpus has not been reset or deleted.</p><small>Check Vercel → Storage → Blob → Usage/limits and the production Blob binding before recompiling.</small></div><em>403 · STORAGE</em>`;
    const root=corpusRoot();
    root?.classList.add('iris-storage-blocked');
    for(const button of root?.querySelectorAll('.ei3-btn')||[]){
      const label=String(button.textContent||'').toUpperCase();
      if(label.includes('RECOMPILE')||label.includes('IMPROVE')||label.includes('TRY AGAIN')){
        button.disabled=true;button.style.pointerEvents='none';button.style.opacity='.42';button.dataset.irisStorageDisabled='1';
        button.title='Corpus actions are disabled while Vercel Blob content reads return 403.';
      }
    }
  }

  function rememberStorageFailure(payload,status){
    const message=String(payload?.error||'');
    if(payload?.code==='CORPUS_BLOB_READ_BLOCKED'||status===403||/Vercel Blob: Failed to fetch blob: 403 Forbidden/i.test(message)||/Blob content access is blocked \(403 Forbidden\)/i.test(message)){
      storageIssue={at:Date.now(),message,storage:payload?.storage||null};
      renderStorageIssue();
    }
  }

  const nativeFetch=window.fetch.bind(window);
  window.fetch=async (...args)=>{
    const response=await nativeFetch(...args);
    try{
      const first=args[0];
      const url=typeof first==='string'?first:first?.url||'';
      if(String(url).includes('/api/wcl/corpus')){
        if(!response.ok){
          const payload=await response.clone().json().catch(()=>null);
          rememberStorageFailure(payload,response.status);
        }else if(storageIssue){
          const u=new URL(String(url),location.origin);
          const action=u.searchParams.get('action')||'';
          if(action==='model'||action==='status'||action==='health'){
            storageIssue=null;
            renderStorageIssue();
          }
        }
      }
    }catch{}
    return response;
  };

  function patchAll(){patchVersion();patchRaidLeader();patchIrisBrand();renderStorageIssue();}
  document.addEventListener('DOMContentLoaded',patchAll,{once:true});
  window.addEventListener('load',patchAll,{once:true});
  setInterval(patchAll,1200);
})();
