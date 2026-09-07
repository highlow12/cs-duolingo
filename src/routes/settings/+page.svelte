<script lang="ts">
  import { onMount } from 'svelte';
  import { learningRepository } from '$lib/storage/repositories/learning-repository';
  import { contentRepository } from '$lib/content/repository/static-content-repository';
  import { errorMessage } from '$lib/application/dashboard';
  let dailyGoal = $state(30);
  let reviewLimit = $state(10);
  let buildId = $state('');
  let loaded = $state(false);
  let busy = $state(false);
  let error = $state('');
  let message = $state('');
  let importData = $state<string | null>(null);
  let importName = $state('');
  let importExportedAt = $state<number | null>(null);
  let resetOpen = $state(false);
  let resetText = $state('');
  async function load() { const [snapshot,manifest] = await Promise.all([learningRepository.getSnapshot(),contentRepository.getManifest()]); dailyGoal=snapshot.settings.dailyGoal;reviewLimit=snapshot.settings.reviewLimit;buildId=manifest.buildId;loaded=true; }
  onMount(() => { void load().catch((e)=>{error=errorMessage(e);}); });
  async function action(work:()=>Promise<void>,success:string) { if(busy)return;busy=true;error='';message='';try {await work();message=success;}catch(e){error=errorMessage(e);}finally{busy=false;} }
  function save() { return action(async()=>{await learningRepository.updateSettings({dailyGoal,reviewLimit});},'학습 목표를 저장했습니다.'); }
  function exportData() { return action(async()=>{const json=await learningRepository.exportBackup();const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));const anchor=document.createElement('a');const exportedAt=new Date();anchor.href=url;anchor.download=`cs-duolingo-backup-${exportedAt.toISOString().replace(/\.\d{3}Z$/,'Z').replaceAll(':','-')}.json`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),30000);},'백업 파일을 만들었습니다. 다운로드한 파일을 보관해 주세요.'); }
  async function selectFile(event:Event) { const input=event.target as HTMLInputElement;const file=input.files?.[0];input.value='';if(!file)return;error='';message='';importExportedAt=null;if(file.size>20*1024*1024){error='20MB 이하의 백업 파일을 선택해 주세요.';return;}try{const json=await file.text();const parsed=JSON.parse(json) as {exportedAt?:unknown};importData=json;importName=file.name;importExportedAt=typeof parsed.exportedAt==='number'&&Number.isFinite(parsed.exportedAt)?parsed.exportedAt:null;}catch(e){importData=null;importName='';error=errorMessage(e);} }
  function restore() { if(!importData)return;const json=importData;return action(async()=>{await learningRepository.importBackup(json);importData=null;importName='';importExportedAt=null;await load();},'백업을 복원했습니다. 학습 기록을 확인해 주세요.'); }
  function reset() { if(resetText!=='초기화')return;return action(async()=>{await learningRepository.resetProgress();resetOpen=false;resetText='';await load();},'학습 기록을 초기화했습니다.'); }
</script>
<svelte:head><title>설정 | CS 듀오링고</title></svelte:head>
<div class="stack settings-shell">
  <div class="page-heading"><p class="eyebrow">나에게 맞는 학습</p><h1>설정</h1></div>
  {#if error}<div class="card error" role="alert">{error}{#if !loaded}<button class="button secondary" onclick={()=>{error='';void load().catch((e)=>{error=errorMessage(e);});}}>다시 시도</button>{/if}</div>{/if}
  {#if message}<p class="card success" role="status">{message}</p>{/if}
  {#if !loaded && !error}<p class="card">설정을 불러오는 중입니다…</p>
  {:else if loaded}
    <form class="card stack" onsubmit={(e)=>{e.preventDefault();void save();}}><h2>학습 목표</h2><label>하루 목표 XP<select bind:value={dailyGoal} disabled={busy}>{#each [10,20,30,50,100] as goal}<option value={goal}>{goal} XP</option>{/each}</select></label><label>한 번에 복습할 문제<select bind:value={reviewLimit} disabled={busy}>{#each [5,10,20,30,50] as limit}<option value={limit}>{limit}개</option>{/each}</select></label><button class="button" disabled={busy}>목표 저장</button></form>
    <section class="card stack"><h2>학습 기록 백업</h2><p class="muted">기록은 이 브라우저와 기기에 저장됩니다. 기기를 바꾸거나 브라우저 데이터를 지우기 전에 백업하세요.</p><div class="actions"><button class="button secondary" disabled={busy} onclick={exportData}>백업 다운로드</button><label class="file-label">백업 파일 선택<input type="file" accept=".json,application/json" disabled={busy} onchange={selectFile}/></label></div>
      {#if importData}<div class="confirmation" role="group" aria-label="백업 복원 확인"><strong>{importName}</strong>{#if importExportedAt !== null}<p class="muted">백업 생성 시각: {new Date(importExportedAt).toLocaleString()}</p>{/if}<p>현재 학습 기록을 이 백업으로 교체합니다. 필요한 기록은 먼저 다운로드해 주세요.</p><div class="actions"><button class="button" disabled={busy} onclick={restore}>이 백업으로 복원</button><button class="button secondary" disabled={busy} onclick={()=>{importData=null;importName='';importExportedAt=null;}}>취소</button></div></div>{/if}
    </section>
    <section class="card stack"><h2>앱과 오프라인 학습</h2><p class="muted">웹에서는 한 번 온라인으로 열어 학습 자료 저장이 끝난 뒤 오프라인으로 사용할 수 있습니다. 휴대폰 브라우저의 공유 또는 메뉴에서 ‘홈 화면에 추가’를 선택하세요.</p><p class="muted">새 버전 알림이 보이면 진행 중인 문제를 마친 뒤 새로고침하세요.</p><p class="version">콘텐츠 버전 <code>{buildId.slice(0,12)}</code></p></section>
    <section class="card stack"><h2>학습 기록 초기화</h2><p class="muted">레슨 진행도, 복습 기록과 경험치를 삭제합니다. 백업이 없으면 되돌릴 수 없습니다.</p><button class="button danger-button" disabled={busy} onclick={()=>{resetOpen=true;}}>초기화하기</button>
    {#if resetOpen}<div class="confirmation"><label>계속하려면 ‘초기화’를 입력하세요<input bind:value={resetText} autocomplete="off" disabled={busy}/></label><div class="actions"><button class="button danger-button" disabled={busy||resetText!=='초기화'} onclick={reset}>기록 삭제</button><button class="button secondary" disabled={busy} onclick={()=>{resetOpen=false;resetText='';}}>취소</button></div></div>{/if}</section>
  {/if}
</div>
<style>.settings-shell{max-width:760px;margin:auto}label{display:grid;gap:.5rem}form .button{justify-self:start}.confirmation{border:1px solid var(--border);border-radius:.75rem;padding:1rem;background:var(--primary-soft);overflow-wrap:anywhere}.file-label{font-weight:600;font-size:.9rem}.file-label input{max-width:100%}.version{margin:0;font-size:.9rem}.danger-button{background:var(--danger)}.danger-button:hover{background:#991b1b}</style>
