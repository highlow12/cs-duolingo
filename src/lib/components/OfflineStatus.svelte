<script lang="ts">
  import { onMount } from 'svelte';
  let online=$state(true);
  let offlineReady=$state(false);
  let update=$state<ServiceWorker | null>(null);
  let updating=$state(false);
  onMount(()=>{
    let disposed=false;
    const connection=()=>{online=navigator.onLine;};connection();
    window.addEventListener('online',connection);window.addEventListener('offline',connection);
    let registration:ServiceWorkerRegistration|undefined;
    const detect=()=>{if(disposed)return;offlineReady=!!registration?.active;update=registration?.waiting??null;};
    const watch=()=>{registration?.installing?.addEventListener('statechange',detect);detect();};
    const controller=()=>{if(updating)window.location.reload();else detect();};
    if('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange',controller);
      void navigator.serviceWorker.ready.then((r)=>{if(disposed)return;registration=r;detect();r.addEventListener('updatefound',watch);watch();});
    }
    return ()=>{disposed=true;window.removeEventListener('online',connection);window.removeEventListener('offline',connection);registration?.removeEventListener('updatefound',watch);navigator.serviceWorker?.removeEventListener('controllerchange',controller);};
  });
  function refresh(){if(!update)return;updating=true;update.postMessage({type:'ACTIVATE_UPDATE'});}
</script>
<div class="connection" role="status"><span>{!online ? '오프라인 학습 중' : offlineReady ? '오프라인 학습 준비 완료' : '기기에서 바로 학습'}</span>{#if update}<span>새 버전이 있어요.</span><button onclick={refresh} disabled={updating}>{updating?'새로 여는 중…':'문제를 마친 뒤 새로고침'}</button>{/if}</div>
<style>.connection{display:flex;flex-wrap:wrap;align-items:center;gap:.75rem;font-size:.875rem}.connection button{padding:.5rem .75rem;border-radius:.5rem;color:var(--primary);background:var(--primary-soft);font-weight:700;min-height:44px}</style>
