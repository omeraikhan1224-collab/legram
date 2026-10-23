const {WORLDS,WORD_ART,MONSTERS,SENTENCE_PLACES}=LegramContent;

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const store=LegramCore.createStore();
const catalog=LegramCore.createCatalog(WORLDS,{wordsPerLevel:10,levelsPerWorld:10});
let state=store.get();
state.phrases={level:null,records:{},progress:{},scores:{},stars:{},completed:{},...(state.phrases||{})};
state.phrases.records=state.phrases.records||{};
let streak=0,selectedWorld=0,currentLevel=0,queue=[],qIndex=0,lives=3,correct=0,timerId=null,timeLeft=3,answered=false,paused=false,pendingAnswer=[],encounterStart=0,victoryTimer=null,wordInputMode=false;
let sentencePlaceIndex=0,sentenceStep=0,sentenceCorrect=0,sentenceAttempts=0,sentenceLocked=false,sentenceTimerId=null,sentenceRemaining=12,sentenceTimerReady=false,sentenceInputMode=false,sentenceAdvanceTimer=null,sentenceVoiceFallback=null,activeSentenceUtterance=null,activeSentenceAudio=null,lastNpcReply=null,pendingConversationLevel=state.phrases.level;
let activeDialog=null,dialogReturnFocus=null,cloudSync=null;
const ENCOUNTER_MS=3000;
const save=()=>{const saved=store.save();cloudSync?.schedule(saved);return saved};
const {normalizeGerman:normalize,isCorrectAnswer,editDistance}=LegramCore;
const DIALOGUE_LEVELS=LegramDialogueContent.levels;
const dialogueEngine=new LegramDialogueEngine({content:LegramDialogueContent,similarity:sentenceSimilarity,normalize});
window.__legramTest={normalize,isCorrectAnswer,editDistance};
window.__legramArchitecture={saveVersion:store.version,totalWorlds:catalog.worlds.length,totalLevels:catalog.totalLevels,wordsPerLevel:catalog.wordsPerLevel};
window.__legramDialogue={engine:dialogueEngine,content:LegramDialogueContent,current:()=>dialogueEngine.current(),profile:()=>dialogueEngine.session?.profile||null};
const speak=(text,rate=.82)=>{
 if(!state.sound||!('speechSynthesis'in window))return;
 const synth=window.speechSynthesis;synth.cancel();synth.resume?.();
 const u=new SpeechSynthesisUtterance(text);u.lang='de-DE';u.rate=rate;u.volume=1;
 synth.speak(u);
};
const SENTENCE_VOICE_PROFILES={
 home:{preferred:['Anna','Katja','Marlene','Petra','Vicki'],rate:.83,pitch:1.08,label:'صوت Lea طبيعي'},
 work:{preferred:['Markus','Martin','Yannick','Stefan','Conrad'],rate:.78,pitch:.84,label:'صوت Helmut عميق'},
 market:{preferred:['Flo','Amala','Sandy','Shelley','Eddy'],rate:.9,pitch:1.02,label:'صوت Daniel واضح'}
};
const sentenceVoicePreloads=new Map();
const generatedSentenceVoices=new Map();
const generatedSentenceCharacters=new Map();
let generatedSentenceVoiceTimer=null;
const generatedSentenceVoiceKey=(place,text)=>`${place}\u0000${String(text||'').trim()}`;
async function loadGeneratedSentenceVoices(){
 clearTimeout(generatedSentenceVoiceTimer);generatedSentenceVoiceTimer=null;
 try{
  const response=await fetch('voices/manifest.json',{cache:'no-store'});if(!response.ok)return;
  const payload=await response.json();
  generatedSentenceVoices.clear();
  generatedSentenceCharacters.clear();
  (payload.characters||[]).forEach(character=>{if(character?.place)generatedSentenceCharacters.set(character.place,character)});
  (payload.clips||[]).forEach(clip=>{if(clip?.place&&clip?.text&&clip?.id)generatedSentenceVoices.set(generatedSentenceVoiceKey(clip.place,clip.text),`voices/clips/${clip.id}.mp3`)});
  if(['preparing','running'].includes(payload.job?.status))generatedSentenceVoiceTimer=setTimeout(loadGeneratedSentenceVoices,20000);
 }catch{}
}
let germanVoices=[];
function refreshGermanVoices(){if(!('speechSynthesis'in window))return[];germanVoices=speechSynthesis.getVoices().filter(voice=>/^de([-_]|$)/i.test(voice.lang||''));return germanVoices}
if('speechSynthesis'in window){refreshGermanVoices();speechSynthesis.addEventListener?.('voiceschanged',refreshGermanVoices)}
function sentenceVoiceFor(place){
 const profile=SENTENCE_VOICE_PROFILES[place.id]||SENTENCE_VOICE_PROFILES.home,voices=refreshGermanVoices();
 for(const wanted of profile.preferred){const voice=voices.find(item=>item.name.toLowerCase().includes(wanted.toLowerCase()));if(voice)return voice}
 const placeOffset={home:0,work:1,market:2}[place.id]||0;return voices.length?voices[placeOffset%voices.length]:null;
}
function sentenceSpeechDuration(text,rate){return Math.max(1500,Math.min(4300,560+String(text).split(/\s+/).length*390/Math.max(.65,rate)))}
function sentenceVoiceItem(place,itemOrText){
 if(itemOrText&&typeof itemOrText==='object')return itemOrText;
 const current=dialogueEngine.current();
 if(current&&(current.reply===itemOrText||(current.answers||[]).some(answer=>answer.reply===itemOrText)))return current;
 return place.sentences.find(item=>item.reply===itemOrText)||null;
}
function sentenceVoiceIndex(place,itemOrText){
 const item=sentenceVoiceItem(place,itemOrText);
 if(Number(item?.voice)>0)return Number(item.voice)-1;
 const exact=place.sentences.findIndex(entry=>entry.reply===itemOrText);
 return exact;
}
function sentenceVoiceClip(place,itemOrText,spokenText=null){
 const index=sentenceVoiceIndex(place,itemOrText);
 const actual=String(spokenText??(typeof itemOrText==='object'?itemOrText?.reply:itemOrText)??'').trim();
 const generated=generatedSentenceVoices.get(generatedSentenceVoiceKey(place.id,actual));if(generated)return generated;
 if(index<0)return null;
 const expected=String(place.sentences[index]?.reply||'').trim();
 return expected&&expected===actual?`assets/audio/sentences/${place.id}-${String(index+1).padStart(2,'0')}.mp3`:null;
}
function preloadSentenceVoice(place,item){
 if(!place||!item||typeof Audio==='undefined')return;
 const src=sentenceVoiceClip(place,item);
 if(!src)return;
 if(sentenceVoicePreloads.has(src))return;
 const audio=new Audio(src);audio.preload='auto';audio.load?.();sentenceVoicePreloads.set(src,audio);
}
function resetNpcVoiceState(){
 clearTimeout(sentenceVoiceFallback);sentenceVoiceFallback=null;
 if(activeSentenceAudio){activeSentenceAudio.onended=null;activeSentenceAudio.onerror=null;activeSentenceAudio.onplay=null;try{activeSentenceAudio.pause?.();activeSentenceAudio.currentTime=0}catch{}activeSentenceAudio=null}
 if(activeSentenceUtterance&&'speechSynthesis'in window)window.speechSynthesis.cancel();
 activeSentenceUtterance=null;
 const npc=$('#sentenceNpc'),reply=$('#sentenceNpcReply');npc?.classList.remove('talking');reply?.classList.remove('speaking');
 npcMotion?.stop();
}
function speakNpc(text,place,onDone,item=dialogueEngine.current()){
 resetNpcVoiceState();
 const index=sentenceVoiceIndex(place,item||text),src=sentenceVoiceClip(place,item||text,text);
 lastNpcReply={text,place,index,item};
 const profile=SENTENCE_VOICE_PROFILES[place.id]||SENTENCE_VOICE_PROFILES.home,npc=$('#sentenceNpc'),reply=$('#sentenceNpcReply');
 let duration=sentenceSpeechDuration(text,profile.rate),finished=false,began=false,beganAt=0,fallbackStarted=false;
 const scheduleFinish=ms=>{clearTimeout(sentenceVoiceFallback);sentenceVoiceFallback=setTimeout(finish,Math.max(700,ms)+900)};
 const begin=(audio=null)=>{
  if(finished)return;
  npc.classList.remove('listening','responded');npc.classList.add('talking');reply.hidden=false;reply.classList.add('show','speaking');
  if(!began){began=true;beganAt=performance.now();npcMotion.speak(text,duration,place.id,audio)}
  const generatedVoice=generatedSentenceCharacters.get(place.id)?.voiceName;
  
  $('#sentenceReplayVoice')?.classList.add('is-playing');
 };
 const finish=()=>{
  if(finished)return;finished=true;clearTimeout(sentenceVoiceFallback);
  if(activeSentenceAudio){activeSentenceAudio.onended=null;activeSentenceAudio.onerror=null;activeSentenceAudio.onplay=null;activeSentenceAudio=null}
  npc.classList.remove('talking');npc.classList.add('responded');npcMotion.respond(place.id);reply.classList.remove('speaking');
  $('#sentenceReplayVoice')?.classList.remove('is-playing');activeSentenceUtterance=null;onDone?.();
 };
 const browserVoiceFallback=()=>{
  if(finished||fallbackStarted)return;fallbackStarted=true;
  if(began)npcMotion.speak(text,duration,place.id,null);
  if(!state.sound||!('speechSynthesis'in window)){begin();scheduleFinish(duration);return}
  const synth=window.speechSynthesis,utterance=new SpeechSynthesisUtterance(text);activeSentenceUtterance=utterance;
  utterance.lang='de-DE';utterance.rate=profile.rate;utterance.pitch=profile.pitch;utterance.volume=1;
  const voice=sentenceVoiceFor(place);if(voice)utterance.voice=voice;
  utterance.onstart=()=>begin();
  utterance.onend=()=>{const minimum=Math.min(1200,duration*.8),remaining=minimum-(performance.now()-beganAt);if(remaining>30){clearTimeout(sentenceVoiceFallback);sentenceVoiceFallback=setTimeout(finish,remaining)}else finish()};
  utterance.onerror=()=>{begin();scheduleFinish(Math.min(1100,duration))};
  begin();synth.cancel();synth.resume?.();synth.speak(utterance);scheduleFinish(duration);
 };
 if(!state.sound){begin();scheduleFinish(duration);return duration}
 if(!src||typeof Audio==='undefined'){browserVoiceFallback();return duration}
 const audio=new Audio(src);activeSentenceAudio=audio;audio.preload='auto';audio.playsInline=true;
 audio.onloadedmetadata=()=>{
  if(Number.isFinite(audio.duration)&&audio.duration>0){duration=audio.duration*1000;if(began)npcMotion.speak(text,duration,place.id,audio);scheduleFinish(duration)}
 };
 audio.onplay=()=>{begin(audio);scheduleFinish(duration)};
 audio.onended=finish;
 audio.onerror=()=>{if(activeSentenceAudio===audio)activeSentenceAudio=null;browserVoiceFallback()};
 begin(audio);scheduleFinish(duration);
 const playback=audio.play();
 if(playback&&typeof playback.catch==='function')playback.catch(()=>{if(activeSentenceAudio===audio)activeSentenceAudio=null;browserVoiceFallback()});
 return duration;
}
window.__legramSentenceVoices={
 profiles:SENTENCE_VOICE_PROFILES,
 voiceFor:sentenceVoiceFor,
 duration:sentenceSpeechDuration,
 clipFor:sentenceVoiceClip,
 indexFor:sentenceVoiceIndex,
 generatedCount:()=>generatedSentenceVoices.size,
 active:()=>activeSentenceAudio?{src:activeSentenceAudio.currentSrc||activeSentenceAudio.src,time:activeSentenceAudio.currentTime,duration:activeSentenceAudio.duration,paused:activeSentenceAudio.paused}:null
};
loadGeneratedSentenceVoices();
const AudioEngine=window.AudioContext||window.webkitAudioContext;
const haptic=pattern=>{let hardware=false;try{if('vibrate'in navigator){hardware=navigator.vibrate(pattern)!==false}}catch{}if(!hardware){const target=document.querySelector('#micBtn');try{target?.animate([{translate:'-2px 0'},{translate:'2px 0'},{translate:'-1px 0'},{translate:'0 0'}],{duration:180,easing:'ease-out'})}catch{}}};
let musicCtx=null,motionFrame=null,motionLast=0,encounterProgress=0,lastStepAt=0;
const engine=new LegramEngine2D({arena:$('#arena'),hero:$('#gameHero'),monster:$('#monster'),heroShadow:$('#heroShadow'),monsterShadow:$('#bossShadow'),fxLayer:$('#fxLayer')});
const npcMotion=new LegramNpcMotion($('#sentenceNpc'));
window.__legramEngine=engine;
$('#monster').appendChild($('#monsterHp'));
const worldFx=new LegramWorldFx($('#arena'));window.__worldFx=worldFx;
const sfx=new LegramSfx();sfx.isEnabled=()=>state.sound!==false;
const wordVoice=new LegramWordVoice({fallback:text=>speak(text,.75),getContext:()=>sfx.ensure(),onStart:()=>sfx.duck(true),onEnd:()=>sfx.duck(false)});window.__legramWordVoice=wordVoice;
['pointerdown','keydown','touchend'].forEach(type=>window.addEventListener(type,()=>sfx.unlock(),{capture:true,passive:true}));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const sayWord=(item,delay,alive)=>wait(delay).then(()=>alive()?wordVoice.play(item):false);
const untilSaid=(voice,cap=2800)=>Promise.race([voice||Promise.resolve(),wait(cap)]);
const combat=new LegramCombatDirector({arena:$('#arena'),hero:$('#gameHero'),monster:$('#monster'),engine,sfx});
window.__legramSfx=sfx;
window.__legramCombat=combat;
window.__legramNpcMotion=npcMotion;
function audio(){if(!state.sound||!AudioEngine)return null;try{musicCtx=musicCtx||new AudioEngine();if(musicCtx.state==='suspended')musicCtx.resume();return musicCtx}catch{return null}}
function noiseSource(ctx,duration){const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);const source=ctx.createBufferSource();source.buffer=buffer;return source}
function playFootstep(){const ctx=audio();if(!ctx)return;const t=ctx.currentTime,n=noiseSource(ctx,.1),f=ctx.createBiquadFilter(),g=ctx.createGain(),o=ctx.createOscillator(),og=ctx.createGain();f.type='lowpass';f.frequency.value=420;n.connect(f);f.connect(g);g.connect(ctx.destination);g.gain.setValueAtTime(.035,t);g.gain.exponentialRampToValueAtTime(.001,t+.1);o.type='sine';o.frequency.setValueAtTime(105,t);o.frequency.exponentialRampToValueAtTime(52,t+.09);o.connect(og);og.connect(ctx.destination);og.gain.setValueAtTime(.025,t);og.gain.exponentialRampToValueAtTime(.001,t+.1);n.start(t);o.start(t);o.stop(t+.1)}
function swordStrikeSound(){const ctx=audio();if(!ctx)return;const t=ctx.currentTime,n=noiseSource(ctx,.24),f=ctx.createBiquadFilter(),g=ctx.createGain(),ring=ctx.createOscillator(),rg=ctx.createGain();f.type='bandpass';f.Q.value=.7;f.frequency.setValueAtTime(2600,t);f.frequency.exponentialRampToValueAtTime(520,t+.22);n.connect(f);f.connect(g);g.connect(ctx.destination);g.gain.setValueAtTime(.095,t);g.gain.exponentialRampToValueAtTime(.001,t+.24);ring.type='triangle';ring.frequency.setValueAtTime(520,t+.08);ring.frequency.exponentialRampToValueAtTime(1180,t+.2);ring.connect(rg);rg.connect(ctx.destination);rg.gain.setValueAtTime(.0001,t);rg.gain.exponentialRampToValueAtTime(.045,t+.08);rg.gain.exponentialRampToValueAtTime(.001,t+.28);n.start(t);ring.start(t);ring.stop(t+.3)}
function monsterStrikeSound(){const ctx=audio();if(!ctx)return;const t=ctx.currentTime,n=noiseSource(ctx,.32),f=ctx.createBiquadFilter(),g=ctx.createGain();f.type='lowpass';f.frequency.value=680;n.connect(f);f.connect(g);g.connect(ctx.destination);g.gain.setValueAtTime(.11,t);g.gain.exponentialRampToValueAtTime(.001,t+.3);n.start(t);[92,138].forEach((hz,i)=>{const o=ctx.createOscillator(),og=ctx.createGain();o.type=i?'sawtooth':'sine';o.frequency.setValueAtTime(hz,t);o.frequency.exponentialRampToValueAtTime(42+i*18,t+.3);o.connect(og);og.connect(ctx.destination);og.gain.setValueAtTime(i?.035:.09,t);og.gain.exponentialRampToValueAtTime(.001,t+.32);o.start(t);o.stop(t+.33)})}
function monsterDeathSound(){const ctx=audio();if(!ctx)return;const t=ctx.currentTime;[310,220,145,82].forEach((hz,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type=i%2?'triangle':'sawtooth';o.frequency.setValueAtTime(hz,t+i*.045);o.frequency.exponentialRampToValueAtTime(Math.max(38,hz*.3),t+.48+i*.04);o.connect(g);g.connect(ctx.destination);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.04/(i+1),t+i*.045+.02);g.gain.exponentialRampToValueAtTime(.001,t+.52+i*.04);o.start(t+i*.045);o.stop(t+.58+i*.04)})}
function showDeathLight(target){const arena=$('#arena'),light=$('#deathLight'),a=arena.getBoundingClientRect(),r=target.getBoundingClientRect();light.style.setProperty('--death-x',`${r.left-a.left+r.width*.5}px`);light.style.setProperty('--death-y',`${r.top-a.top+r.height*.55}px`);light.classList.remove('active');void light.offsetWidth;light.classList.add('active');setTimeout(()=>light.classList.remove('active'),1250)}
function victorySound(){const ctx=audio();if(!ctx)return;const start=ctx.currentTime;[293.66,392,493.88,587.33,783.99].forEach((hz,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type=i%2?'triangle':'sine';o.frequency.setValueAtTime(hz,start+i*.18);o.connect(g);g.connect(ctx.destination);g.gain.setValueAtTime(.0001,start+i*.18);g.gain.exponentialRampToValueAtTime(.055,start+i*.18+.035);g.gain.exponentialRampToValueAtTime(.001,start+i*.18+.48);o.start(start+i*.18);o.stop(start+i*.18+.52)});setTimeout(swordStrikeSound,1050);setTimeout(swordStrikeSound,2050);setTimeout(monsterDeathSound,3150)}
function motionLoop(now){
 const arena=$('#arena'),active=$('#gameScreen').classList.contains('active');
 if(!motionLast)motionLast=now;
 const dt=Math.min(34,now-motionLast);motionLast=now;
 if(active&&!paused&&!answered&&encounterStart){
  const ms=answerMs(),elapsed=Math.max(0,now-encounterStart),remaining=Math.max(0,ms-elapsed),sec=Math.ceil(remaining/1000);
  encounterProgress=Math.min(1,elapsed/ms);timeLeft=sec;
  $('#timer').textContent=String(sec);$('.timer-ring').style.setProperty('--timer',`${remaining/ms*100}%`);$('#promptCard').style.setProperty('--time-left',String(remaining/ms));
  if(sec!==lastTickSecond&&sec>0){lastTickSecond=sec;sfx.tick(sec<=1)}
  if(remaining<=1000){combat.warn();$('.timer-ring').classList.add('urgent')}
  if(encounterProgress>=1)handleAnswer(pendingAnswer,!pendingAnswer.length);
 }
 engine.tick(dt,{active,paused});
 const running=active&&!paused&&engine.state==='passing';
 if(running&&now-lastStepAt>290){sfx.footstep();lastStepAt=now}
 arena.dataset.motion=running?'running':'battle';motionFrame=requestAnimationFrame(motionLoop)
}
motionFrame=requestAnimationFrame(motionLoop);
function activateExperienceSound(){
 if(!state.sound){state.sound=true;save();$('#soundToggle')?.classList.remove('muted')}
 try{const ctx=audio();ctx?.resume?.()}catch{}
 if('speechSynthesis'in window){
  const synth=window.speechSynthesis;synth.resume?.();refreshGermanVoices();
  try{const primer=new SpeechSynthesisUtterance('\u00a0');primer.lang='de-DE';primer.volume=.01;primer.rate=2;synth.speak(primer)}catch{}
 }
}
window.__legramActivateSound=activateExperienceSound;

const REEL_DEMOS=[
 {id:'user-01',src:'assets/reels/legram-user-01.mp4',topic:'Deutsch im Alltag',caption:'',de:'Ich möchte einen Termin vereinbaren.',ar:'أريد حجز موعد.',words:['Termin','vereinbaren']},
 {id:'user-02',src:'assets/reels/legram-user-02.mp4',topic:'Deutsch-Meme',caption:'',de:'Das ist meine Pflanze.',ar:'هذا نباتي.',words:['Pflanze','Wohnung']},
 {id:'user-03',src:'assets/reels/legram-user-03.mp4',topic:'Deutsch-Moment',caption:'',de:'Warum ist die Treppe so lang?',ar:'لماذا الدرج طويل هكذا؟',words:['Treppe','lang']},
 {id:'user-04',src:'assets/reels/legram-user-04.mp4',topic:'Deutsch-Meme',caption:'',de:'Warum habe ich immer so viele blaue Flecke?',ar:'لماذا لدي دائمًا كل هذه الكدمات؟',words:['blau','Flecke']},
 {id:'user-05',src:'assets/reels/legram-user-05.mp4',topic:'Deutsch-Meme',caption:'',de:'Wassermelone mit Kokosmilch.',ar:'بطيخ مع حليب جوز الهند.',words:['Wassermelone','Kokosmilch']},
 {id:'user-06',src:'assets/reels/legram-user-06.mp4',topic:'Deutsch im Alltag',caption:'',de:'POV: Du hast gerade Deutsch gelernt.',ar:'عندما تتعلم الألمانية للتو.',words:['gerade','gelernt']},
 {id:'user-07',src:'assets/reels/legram-user-07.mp4',topic:'Deutsch-Meme',caption:'',de:'Bitte mach Termine bei mir.',ar:'من فضلك احجز المواعيد لدي.',words:['Termin','bitte']}
];
const BLOCKED_REEL_IDS=new Set(['demo-01','demo-02','demo-03']);
const safeStoredJson=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key)||'null');return value??fallback}catch{return fallback}};
const escapeAttribute=value=>String(value??'').replace(/[&"'<>]/g,char=>({"&":"&amp;","\"":"&quot;","'":"&#39;","<":"&lt;",">":"&gt;"}[char]));
const reelApiHeaders=extra=>({...LegramCloudSync.deviceHeaders(),...extra});
async function reelCatalog(){
 try{
  let published=REEL_DEMOS,cloud=[];
  try{const response=await fetch(`assets/reels/catalog-public.json?v=${Date.now()}`,{cache:'no-store'});if(response.ok){const entries=await response.json();if(Array.isArray(entries)&&entries.length)published=entries.map(item=>({...item,topic:item.topic||'Deutsch-Meme',caption:item.caption||item.title||'',de:item.de||'',ar:item.ar||'',words:Array.isArray(item.words)?item.words:[]}))}}catch{}
  
  cloud.forEach(item=>reelState.liked.delete(item.id));
  cloud.filter(item=>item.liked).forEach(item=>reelState.liked.add(item.id));
  const seen=new Set();return [...cloud,...published.filter(item=>!BLOCKED_REEL_IDS.has(item.id))].filter(item=>{const key=String(item.id||item.src||'');if(!key||seen.has(key))return false;seen.add(key);return true});
 }catch{return REEL_DEMOS}
}
const reelState={liked:new Set(safeStoredJson('legram-reel-likes',[])),muted:true};
function persistReelState(){localStorage.setItem('legram-reel-likes',JSON.stringify([...reelState.liked]))}
function reelIcon(name){if(name==='heart')return '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 39S8 29 8 18a8 8 0 0 1 15-4 8 8 0 0 1 15 4c0 11-14 21-14 21Z"/></svg>';if(name==='share')return '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M30 18 40 8m0 0v11m0-11H29"/><path d="M40 27v8a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4h7"/></svg>';return reelState.muted?'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M9 20v8h7l10 8V12l-10 8H9Z"/><path d="m34 18 8 12M42 18 34 30"/></svg>':'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M9 20v8h7l10 8V12l-10 8H9Z"/><path d="M32 18c4 3 4 9 0 12M36 13c7 6 7 16 0 22"/></svg>'}
function reelShareUrl(id){const url=new URL(location.href);url.searchParams.set('reel',id);url.hash=`reel-${encodeURIComponent(id)}`;return url.href}
function syncReelSound(cards=$$('.reel-card')){cards.forEach(card=>{const current=card.classList.contains('is-current'),video=card.querySelector('video'),button=card.querySelector('[data-reel-action="sound"]');if(video)video.muted=reelState.muted||!current;if(button){button.innerHTML=reelIcon('sound');button.classList.toggle('sound-on',!reelState.muted);button.setAttribute('aria-label',reelState.muted?'تشغيل صوت المقطع':'كتم صوت المقطع')}})}
function finishReelView(card,video){const started=Number(video.dataset.watchStarted)||0;if(!started)return;delete video.dataset.watchStarted;const watchedMs=Math.min(120000,Math.max(0,performance.now()-started)),completed=video.dataset.completed==='true',progress=video.duration?video.currentTime/video.duration:0;video.dataset.completed='false';if(card.dataset.cloud!=='true'||watchedMs<500)return;fetch(`/api/reels/${encodeURIComponent(card.dataset.reelId)}/view`,{method:'POST',credentials:'same-origin',keepalive:true,headers:reelApiHeaders({'content-type':'application/json'}),body:JSON.stringify({watchedMs:Math.round(watchedMs),completed,skipped:!completed&&progress<.65})}).catch(()=>{})}
function setReelPlayback(active){
 const videos=$$('[data-reel-video]');
 if(!active){videos.forEach(video=>video.pause());return}
 const current=$('.reel-card.is-current [data-reel-video]')||videos[0];if(current)current.muted=reelState.muted;current?.play().catch(()=>{});
}
async function renderReels(){
 const host=$('#reelsFeed');if(!host)return;
 const demos=await reelCatalog();
 const itemsById=new Map(demos.map(item=>[String(item.id),item]));
 host.innerHTML=demos.map((item,index)=>`<article class="reel-card" id="reel-${escapeAttribute(item.id)}" data-reel-id="${escapeAttribute(item.id)}" data-cloud="${item.cloud?'true':'false'}"><video class="reel-video" data-reel-video playsinline muted loop preload="${index?'metadata':'auto'}" src="${escapeAttribute(item.src)}"></video><div class="reel-shade"></div>${item.cloud?`<div class="reel-copy"><small>${escapeAttribute(item.topic||item.level||'Legram')}</small><strong lang="de" dir="ltr">${escapeAttribute(item.de||item.title||'')}</strong>${item.ar?`<span>${escapeAttribute(item.ar)}</span>`:''}</div>`:''}<div class="reel-actions"><button class="${reelState.liked.has(item.id)?'is-active':''}" data-reel-action="like" aria-label="إعجاب">${reelIcon('heart')}<em>${Math.max(0,Number(item.likes)||0)}</em></button><button data-reel-action="share" aria-label="مشاركة المقطع">${reelIcon('share')}</button><button data-reel-action="sound" aria-label="تشغيل صوت المقطع">${reelIcon('sound')}</button></div><div class="reel-progress"><i></i></div></article>`).join('');
 const cards=$$('.reel-card');
 const observer='IntersectionObserver' in window?new IntersectionObserver(entries=>entries.forEach(entry=>{const video=entry.target.querySelector('video');if(entry.isIntersecting&&entry.intersectionRatio>.7){cards.forEach(card=>card.classList.toggle('is-current',card===entry.target));syncReelSound(cards);if($('#feedScreen').classList.contains('active'))video.play().catch(()=>{})}else{video.pause();video.muted=true;if(!entries.some(item=>item.target===entry.target&&item.isIntersecting&&item.intersectionRatio>.7))entry.target.classList.remove('is-current')}}),{root:host,threshold:[.2,.7]}):null;cards.forEach(card=>observer?.observe(card));
 cards.forEach(card=>{const video=card.querySelector('video');video.addEventListener('play',()=>{if(!video.dataset.watchStarted)video.dataset.watchStarted=String(performance.now())});video.addEventListener('pause',()=>finishReelView(card,video));video.addEventListener('timeupdate',()=>{const progress=video.duration?video.currentTime/video.duration:0;card.querySelector('.reel-progress i').style.width=`${progress*100}%`;if(progress>.9)video.dataset.completed='true'});card.addEventListener('click',event=>{const button=event.target.closest('[data-reel-action]');if(!button){video.paused?video.play().catch(()=>{}):video.pause();return}const action=button.dataset.reelAction,id=card.dataset.reelId,item=itemsById.get(id);if(action==='like'){const wasLiked=reelState.liked.has(id),liked=!wasLiked;liked?reelState.liked.add(id):reelState.liked.delete(id);button.classList.toggle('is-active',liked);persistReelState();const count=button.querySelector('em');count.textContent=String(Math.max(0,(Number(count.textContent)||0)+(liked?1:-1)));if(item?.cloud)fetch(`/api/reels/${encodeURIComponent(id)}/like`,{method:'PUT',credentials:'same-origin',headers:reelApiHeaders({'content-type':'application/json'}),body:JSON.stringify({liked})}).catch(()=>{})}if(action==='sound'){activateExperienceSound();reelState.muted=!reelState.muted;card.classList.add('is-current');syncReelSound(cards);video.play().catch(()=>{})}if(action==='share'){const url=reelShareUrl(id),data={title:'Legram',text:'شاهد هذا المقطع على Legram',url};const done=()=>{button.classList.add('is-active');button.setAttribute('aria-label','تمت المشاركة');setTimeout(()=>{button.classList.remove('is-active');button.setAttribute('aria-label','مشاركة المقطع')},900)};if(navigator.share)navigator.share(data).then(done).catch(()=>{});else if(navigator.clipboard)navigator.clipboard.writeText(url).then(done).catch(()=>{})}})});
 const requested=new URL(location.href).searchParams.get('reel'),selected=cards.find(card=>card.dataset.reelId===requested)||cards[0];if(selected){host.scrollTop=selected.offsetTop;selected.classList.add('is-current');syncReelSound(cards);selected.querySelector('video')?.play().catch(()=>{})}
}
renderReels();

const APP_NAV_TARGETS={feedScreen:'feed',mapScreen:'words',phrasesScreen:'sentences',reviewScreen:null};
const dialogFocusable='button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';
function syncAppNav(id){const nav=$('.app-nav');if(!nav)return;const supported=Object.prototype.hasOwnProperty.call(APP_NAV_TARGETS,id),visible=supported&&!activeDialog;nav.classList.toggle('nav-hidden',!visible);nav.setAttribute('aria-hidden',String(!visible));nav.inert=!visible;$$('[data-feed-nav]').forEach(button=>button.classList.toggle('active',button.dataset.feedNav===APP_NAV_TARGETS[id]))}
function activeScreenId(){return $('.screen.active')?.id||'feedScreen'}
function openAccessibleDialog(dialog,focusTarget){if(!dialog)return;dialogReturnFocus=document.activeElement;activeDialog=dialog;dialog.classList.add('show');dialog.setAttribute('aria-hidden','false');syncAppNav(activeScreenId());requestAnimationFrame(()=>{(focusTarget||dialog.querySelector(dialogFocusable)||dialog.querySelector('[tabindex="-1"]'))?.focus()})}
function closeAccessibleDialog(dialog,{restore=true}={}){if(!dialog)return;dialog.classList.remove('show');dialog.setAttribute('aria-hidden','true');if(activeDialog===dialog)activeDialog=null;syncAppNav(activeScreenId());if(restore&&dialogReturnFocus?.isConnected)dialogReturnFocus.focus();dialogReturnFocus=null}
document.addEventListener('keydown',event=>{if(!activeDialog)return;if(event.key==='Escape'){event.preventDefault();if(activeDialog.id==='pauseModal')$('#resumeBtn').click();else closeAccessibleDialog(activeDialog);return}if(event.key!=='Tab')return;const focusable=$$(dialogFocusable).filter(node=>activeDialog.contains(node)&&node.offsetParent!==null);if(!focusable.length){event.preventDefault();return}const first=focusable[0],last=focusable[focusable.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}});
function go(id){if(activeDialog)closeAccessibleDialog(activeDialog,{restore:false});if(id!=='gameScreen'){worldFx.stop();combat.stopAll();wordVoice.stop();duelToken++;if(duel)duel.ready=false;hideFeedback?.();window.gsap?.globalTimeline.resume();clearInterval(timerId);stopRecognition();paused=false;closeAccessibleDialog($('#pauseModal'),{restore:false});clearTimeout(victoryTimer);$('#victoryOverlay')?.classList.remove('show')}if(id!=='phraseGameScreen'){stopSentenceListening();talkScene.stop()}$$('.screen').forEach(screen=>{const active=screen.id===id;screen.classList.toggle('active',active);screen.setAttribute('aria-hidden',String(!active));screen.inert=!active});setReelPlayback(id==='feedScreen');syncAppNav(id);if(id==='mapScreen')renderMap();if(id==='phrasesScreen')renderPhraseHub();if(id==='reviewScreen')renderReview()}
$$('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
$('#playBtn')?.addEventListener('click',()=>{activateExperienceSound();go('mapScreen')});
$('#reviewBtn')?.addEventListener('click',()=>go('reviewScreen'));
$('#sentenceBtn')?.addEventListener('click',()=>{activateExperienceSound();go('phrasesScreen')});
$('#feedWordBtn').onclick=()=>{activateExperienceSound();go('mapScreen')};
$('#feedSentenceBtn').onclick=()=>{activateExperienceSound();go('phrasesScreen')};
$('#feedHomeBtn').onclick=()=>go('feedScreen');
syncAppNav('feedScreen');
$('#soundToggle')?.addEventListener('click',()=>{state.sound=!state.sound;save();$('#soundToggle')?.classList.toggle('muted',!state.sound)});

function renderMap(){
 $('#worldTabs').innerHTML=catalog.worlds.map((w,i)=>`<button class="world-tab ${i===selectedWorld?'active':''}" data-w="${i}">${w.id}</button>`).join('');
 $$('.world-tab').forEach(b=>b.onclick=()=>{selectedWorld=+b.dataset.w;renderMap()});
 const w=catalog.world(selectedWorld),preview=MONSTERS[selectedWorld%MONSTERS.length];$('#worldGerman').textContent=w.de;$('#worldName').textContent=w.name;$('#worldDesc').textContent=w.desc;$('#worldMonster').textContent='';$('#worldMonster').className=`world-monster map-monster ${preview.className}`;$('#worldHero').style.setProperty('--world-color',w.color);
 const base=selectedWorld*catalog.levelsPerWorld;$('#levelsGrid').innerHTML=Array.from({length:catalog.levelsPerWorld},(_,i)=>{const global=base+i+1,locked=global>state.unlocked,stars=state.stars[global]||0;return `<button class="level-card ${locked?'locked':''}" data-level="${i}" ${locked?'disabled':''}><span class="level-no">${i+1}</span><div><b>المستوى ${i+1}</b><small>زعيم · ${bossMaxHp(i)} ضربات</small><span class="mini-stars">${'★'.repeat(stars)}${'☆'.repeat(3-stars)}</span></div>${locked?'<span class="lock" aria-label="مغلق"></span>':''}</button>`}).join('');
 $$('.level-card:not(.locked)').forEach(b=>b.onclick=()=>{activateExperienceSound();startLevel(selectedWorld,+b.dataset.level)});
 const done=Object.keys(state.stars).length;$('#mapProgress').textContent=`${done} من ${catalog.totalLevels} مستوى`;$('#totalStars').textContent=Object.values(state.stars).reduce((a,b)=>a+b,0);
}

const phraseRecordKey=(levelId,placeId)=>`${levelId}:${placeId}`;
const getPhraseRecord=(levelId,placeId)=>state.phrases.records[phraseRecordKey(levelId,placeId)]||{};

/* ---------- Sentence adventures: voice only ---------- */
/* Push-to-talk recogniser: one tap = one utterance, live words while speaking. */
const talkScene=new LegramTalkScene({stage:$('#sentenceStage'),cam:$('#tkCam'),le:$('#tkLe'),npcBox:$('#characterFocus'),dust:$('#tkDust')});window.__talkScene=talkScene;
class TalkListener{
 constructor(){this.Rec=window.SpeechRecognition||window.webkitSpeechRecognition;this.rec=null}
 get supported(){return Boolean(this.Rec)}
 stop(){const r=this.rec;this.rec=null;if(r){r.onresult=r.onerror=r.onend=null;try{r.abort()}catch{}}}
 listen({onStart,onInterim}={}){
  return new Promise(resolve=>{
   if(!this.supported)return resolve({error:'unsupported'});
   this.stop();
   let finals=null,interim='',settled=false;const done=v=>{if(settled)return;settled=true;this.rec=null;resolve(v)};
   let r;try{r=new this.Rec()}catch{return resolve({error:'unsupported'})}
   this.rec=r;r.lang='de-DE';r.interimResults=true;r.maxAlternatives=3;r.continuous=false;
   r.onstart=()=>onStart?.();
   r.onresult=e=>{let text='';for(let i=e.resultIndex;i<e.results.length;i++){const res=e.results[i];if(res.isFinal){finals=[...res].map(a=>a.transcript.trim()).filter(Boolean)}else text+=res[0].transcript}
    interim=text.trim();onInterim?.(finals?.[0]||interim)};
   r.onerror=e=>{if(['not-allowed','service-not-allowed'].includes(e.error))done({error:'denied'});else if(e.error==='audio-capture')done({error:'nomic'});else if(e.error==='network')done({error:'network'});else if(e.error==='no-speech')done({alternatives:[]});};
   r.onend=()=>done({alternatives:finals||(interim?[interim]:[])});
   try{r.start()}catch{done({error:'unsupported'})}
  });
 }
}
const talk=new TalkListener();
const sentenceSpeech={stop(){talk.stop()},setAccepting(){},start(){},retry(){},get active(){return false}};
let talkState='idle',talkTimer=null,talkDeadline=0,talkToken=0,talkHistory=[];
const inClaudePreview=()=>{try{return Boolean(window.claude&&typeof window.claude.use==='function')||/claudeusercontent|claude\.ai/.test(location.hostname)}catch{return false}};
const micMessages={
 preview:'صفحات Claude لا تسمح باستخدام الميكروفون. لتجربة المحادثة الصوتية افتح نسخة Legram المنشورة على الويب.',
 unsupported:'هذا المتصفح لا يدعم التعرّف على الكلام. افتح Legram في Chrome أو Edge أو Safari على الجوال.',
 denied:'لم يُسمح باستخدام الميكروفون. اسمح به من إعدادات الموقع في المتصفح، ثم اضغط «حاول مرة أخرى».',
 nomic:'لم نجد ميكروفونًا متصلًا بالجهاز. صِل ميكروفونًا أو استخدم الجوال، ثم حاول مرة أخرى.',
 network:'التعرّف على الكلام يحتاج اتصالًا بالإنترنت. تأكد من الاتصال ثم حاول مرة أخرى.'
};

/* ---- hub ---- */
function renderConversationLevelOptions(){
 const selected=state.phrases.level||'A1';
 const short={A1:'مبتدئ',A2:'يومي',B1:'مستقل',B2:'عملي',C1:'متقدم'};$('#tkLevelTabs').innerHTML=DIALOGUE_LEVELS.map(level=>`<button type="button" role="radio" aria-checked="${level.id===selected}" aria-label="${level.id} — ${escapeAttribute(level.name)}" data-conversation-level="${level.id}"><b>${level.id}</b><small>${short[level.id]||level.name}</small></button>`).join('');
 const p=dialogueEngine.profile(selected);
 $('#tkLevelNote').innerHTML=`<b>${escapeAttribute(p.name)}</b> — ${escapeAttribute(p.description)} ${p.turns} مواقف، و${p.time} ثانية للرد.`;
 $$('[data-conversation-level]').forEach(b=>b.onclick=()=>{state.phrases.level=b.dataset.conversationLevel;pendingConversationLevel=state.phrases.level;save();renderPhraseHub();b.parentElement.querySelector(`[data-conversation-level="${state.phrases.level}"]`)?.focus()});
}
function openConversationLevelPicker(){$('#tkLevelTabs [aria-checked="true"]')?.focus()}
function closeConversationLevelPicker(){}
function setMicCheck(stateName,title,text){const box=$('#tkMicCheck');if(!box)return;box.dataset.state=stateName;$('#tkMicCheckTitle').textContent=title;$('#tkMicCheckText').textContent=text}
async function refreshMicCheck(){
 if(inClaudePreview())return setMicCheck('blocked','الميكروفون غير متاح هنا','صفحات Claude تمنع الميكروفون. المحادثة تعمل في النسخة المنشورة على الويب.');
 if(!talk.supported){setMicCheck('unsupported','المتصفح لا يدعم الكلام','افتح Legram في Chrome أو Edge أو Safari على الجوال.');return}
 try{const st=await navigator.permissions?.query({name:'microphone'});if(st?.state==='granted')return setMicCheck('ready','الميكروفون جاهز','تحدّث بوضوح وبسرعة طبيعية.');if(st?.state==='denied')return setMicCheck('blocked','الميكروفون محظور','اسمح به من إعدادات الموقع في المتصفح.')}catch{}
 setMicCheck('unknown','المحادثة بالصوت فقط','ستحتاج إلى السماح باستخدام الميكروفون.');
}
$('#tkMicCheckBtn').onclick=async()=>{
 activateExperienceSound();
 if(!talk.supported)return refreshMicCheck();
 try{const s=await navigator.mediaDevices.getUserMedia({audio:true});s.getTracks().forEach(t=>t.stop());setMicCheck('ready','الميكروفون جاهز','تحدّث بوضوح وبسرعة طبيعية.')}
 catch(e){setMicCheck('blocked',e?.name==='NotFoundError'?'لا يوجد ميكروفون':'الميكروفون محظور',e?.name==='NotFoundError'?micMessages.nomic:micMessages.denied)}
};
function renderPhraseHub(){
 const levelId=state.phrases.level||'A1',profile=dialogueEngine.profile(levelId),records=SENTENCE_PLACES.map(place=>getPhraseRecord(levelId,place.id));
 const completed=records.filter(r=>r.completed).length,totalStars=records.reduce((s,r)=>s+(Number(r.stars)||0),0);
 $('#phraseMapProgress').textContent=`${completed} من ${SENTENCE_PLACES.length} أماكن مكتملة في ${levelId}`;$('#phraseTotalStars').textContent=totalStars;
 renderConversationLevelOptions();refreshMicCheck();
 const arrow='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>';
 $('#placeGrid').innerHTML=SENTENCE_PLACES.map((place,index)=>{const record=getPhraseRecord(levelId,place.id),saved=Math.min(profile.turns,Number(record.progress)||0),stars=Number(record.stars)||0,complete=Boolean(record.completed);
  const status=complete?'مكتمل':saved?`تابع من الموقف ${saved+1}`:`${profile.turns} مواقف`;
  return `<button class="tk-place ${complete?'complete':''}" data-place="${index}" style="--place-accent:${place.accent}" aria-label="${escapeAttribute(place.name)} — ${escapeAttribute(status)}"><span class="tk-place-info"><small lang="de" dir="ltr">${place.de}</small><strong>${place.name}</strong><span>تتحدث مع ${place.npc} · ${place.npcRole}</span><span class="tk-place-meter"><i><b style="width:${(complete?profile.turns:saved)/profile.turns*100}%"></b></i><em>${status}</em></span>${stars?`<span class="tk-place-stars" aria-label="${stars} نجوم">${'★'.repeat(stars)}${'☆'.repeat(3-stars)}</span>`:''}</span><span class="tk-place-go" aria-hidden="true">${arrow}</span><span class="tk-place-art" aria-hidden="true"><i class="${place.npcClass}"></i></span></button>`}).join('');
 $$('[data-place]').forEach(button=>button.onclick=()=>{activateExperienceSound();startSentencePlace(Number(button.dataset.place))});
}

function sentenceSimilarity(spoken,target){
 const heard=normalize(spoken),expected=normalize(target);if(!heard||!expected)return 0;if(heard===expected)return 1;
 const characterScore=1-editDistance(heard,expected)/Math.max(heard.length,expected.length),heardWords=heard.split(' '),targetWords=expected.split(' '),pool=[...heardWords];let matched=0;
 targetWords.forEach(word=>{const exact=pool.indexOf(word);if(exact>=0){matched++;pool.splice(exact,1);return}const near=pool.findIndex(item=>word.length>4&&editDistance(item,word)<=1);if(near>=0){matched++;pool.splice(near,1)}});
 return Math.max(characterScore,matched/targetWords.length*.92);
}

/* ---- talk screen helpers ---- */
function setTalkStatus(text,warn=false){const s=$('#sentenceMicText');s.textContent=text;s.classList.toggle('warn',warn)}
function setMic(stateName,label){const b=$('#sentenceMicBtn');talkState=stateName;b.dataset.state=stateName;b.disabled=stateName==='busy';b.setAttribute('aria-label',label||({idle:'اضغط وتحدث',listening:'إيقاف الاستماع',busy:'انتظر'}[stateName]||'اضغط وتحدث'))}
function setRing(fraction,seconds){$('#sentenceMicBtn').style.setProperty('--ring',`${Math.max(0,Math.min(1,fraction))*100}%`);$('#sentenceTimer').textContent=seconds==null?'':String(seconds)}
function renderSteps(){const s=dialogueEngine.session;if(!s)return;$('#tkSteps').innerHTML=s.items.map((_,i)=>`<i class="${i<s.index?(talkHistory[i]===false?'missed':'done'):i===s.index?'now':''}"></i>`).join('');$('#sentenceCounter').textContent=`${Math.min(s.index+1,s.items.length)}/${s.items.length}`}
function showBlocker(kind){if(inClaudePreview()&&kind!=='network')kind='preview';talk.stop();clearInterval(talkTimer);setMic('idle');$('#tkBlockerText').textContent=micMessages[kind]||micMessages.unsupported;$('#tkBlocker').hidden=false;$('#tkBlockerRetry').hidden=kind==='unsupported'||kind==='preview';$('#tkBlockerTitle').textContent=kind==='preview'?'الميكروفون غير متاح هنا':'نحتاج الميكروفون';requestAnimationFrame(()=>($('#tkBlockerRetry').hidden?$('#tkBlockerBack'):$('#tkBlockerRetry')).focus())}
function hideBlocker(){$('#tkBlocker').hidden=true}
function meBubble({text='',state='',live=false,verdict=null,good=null}={}){
 const b=$('#tkMeBubble');b.hidden=false;b.classList.toggle('live',live);b.classList.toggle('good',good===true);b.classList.toggle('bad',good===false);
 $('#tkMeText').textContent=text;$('#tkMeState').textContent=state;
 const v=$('#sentenceFeedback');if(!verdict){v.hidden=true;return}
 v.hidden=false;v.querySelector('strong').textContent=verdict.title;const span=v.querySelector('span');span.textContent='';
 (verdict.lines||[]).forEach((part,i)=>{if(i)span.append(document.createElement('br'));if(typeof part==='string')span.append(part);else{span.append(part.label||'');const de=document.createElement('bdi');de.dir='ltr';de.lang='de';de.textContent=part.de;span.append(de)}});
}
function showModel(item,session,force=false){
 const show=force||['A1','A2'].includes(session.levelId);const text=force?item.de:(session.levelId==='A1'?item.de:(item.hint||item.de));
 $('#tkModel').hidden=!show;$('#sentenceGerman').textContent=show?text:'';$('#tkModelBtn').hidden=!(force||session.levelId==='A1');
}

/* ---- flow ---- */
function startSentencePlace(index,restart=false){
 stopRecognition();stopSentenceListening();sentencePlaceIndex=index;talkHistory=[];
 const place=SENTENCE_PLACES[index],levelId=state.phrases.level||'A1',record=getPhraseRecord(levelId,place.id),session=dialogueEngine.start({placeId:place.id,levelId,record,restart});
 for(let i=0;i<session.index;i++)talkHistory[i]=true;
 sentenceStep=session.index;sentenceCorrect=session.correct;sentenceAttempts=0;sentenceLocked=false;
 go('phraseGameScreen');
 const screen=$('#phraseGameScreen');screen.classList.remove('done');screen.style.setProperty('--sentence-accent',place.accent);
 $('#sentenceComplete').classList.remove('show');$('#sentencePlaceGerman').textContent=place.de;$('#sentencePlaceName').textContent=place.name;$('#sentenceLevelBadge').textContent=session.profile.id;
 $('#sentenceNpcName').textContent=place.npc;$('#sentenceNpcRole').textContent=place.npcRole;$('#sentenceNpc').setAttribute('aria-label',`${place.npc}، ${place.npcRole}`);
 $('#sentenceStage').className=`tk-stage ${place.sceneClass}`;$('#sentenceNpc').className=`sentence-npc ${place.npcClass} listening`;npcMotion.listen(place.id);talkScene.start(place.accent,place.id);talkScene.focus('both');
 hideBlocker();if(!talk.supported){showSentencePrompt();showBlocker('unsupported');return}
 showSentencePrompt();
}
function resetSentenceTimer(seconds=12){clearInterval(talkTimer);talkTimer=null;sentenceTimerReady=false;sentenceRemaining=seconds;setRing(1,null)}
function beginSentenceTimer(){}
function setSentenceTyping(){}
function requestSentenceMicrophone(){listenTurn()}

function showSentencePrompt(){
 const place=SENTENCE_PLACES[sentencePlaceIndex],session=dialogueEngine.session,item=dialogueEngine.current();if(!item)return completeSentencePlace();
 sentenceStep=session.index;sentenceCorrect=session.correct;preloadSentenceVoice(place,item);clearTimeout(sentenceAdvanceTimer);resetNpcVoiceState();talk.stop();
 $('#sentenceNpc').className=`sentence-npc ${place.npcClass} listening`;npcMotion.listen(place.id);renderSteps();
 $('#sentenceArabic').textContent=item.ar;$('#sentenceSkill').textContent=['A1','A2'].includes(session.levelId)?'':(item.skill||session.profile.support);
 $('#conversationCard').classList.remove('good','bad');showModel(item,session);
 $('#tkMeBubble').hidden=true;$('#sentenceNpcReply').hidden=true;$('#sentenceReplyText').textContent='';
 sentenceAttempts=0;sentenceLocked=false;resetSentenceTimer(session.profile.time);setMic('idle');talkScene.focus('both');if(session.index>0)talkScene.react('idle');
 setTalkStatus(session.index===0?'اضغط على الميكروفون وقل الجملة بالألمانية':'اضغط وتحدث');
 requestAnimationFrame(()=>$('#sentenceMicBtn').focus({preventScroll:true}));
}

async function listenTurn(){
 if(sentenceLocked||talkState!=='idle'||!$('#phraseGameScreen').classList.contains('active'))return;
 const session=dialogueEngine.session;if(!session||!dialogueEngine.current())return;
 resetNpcVoiceState();if('speechSynthesis'in window)speechSynthesis.cancel();
 const token=++talkToken,seconds=session.profile.time;setMic('busy','جارٍ تشغيل الميكروفون');setTalkStatus('جارٍ تشغيل الميكروفون…');
 meBubble({text:'',state:'يستمع…',live:true});
 const started={at:0};
 const result=await talk.listen({
  onStart:()=>{if(token!==talkToken)return;started.at=performance.now();setMic('listening');setTalkStatus('أستمع إليك… تحدّث الآن');talkScene.focus('le');talkScene.leTalking(true);haptic(18);sentenceTimerReady=true;
   talkDeadline=started.at+seconds*1000;clearInterval(talkTimer);talkTimer=setInterval(()=>{const left=Math.max(0,talkDeadline-performance.now());sentenceRemaining=left/1000;setRing(left/(seconds*1000),Math.ceil(left/1000));if(left<=0){clearInterval(talkTimer);talk.rec?.stop()}},100)},
  onInterim:text=>{if(token!==talkToken)return;$('#tkMeText').textContent=text}
 });
 clearInterval(talkTimer);talkScene.leTalking(false);if(token!==talkToken||!$('#phraseGameScreen').classList.contains('active'))return;
 if(result.error){meBubble({hidden:true});$('#tkMeBubble').hidden=true;setMic('idle');setTalkStatus('اضغط وتحدث');showBlocker(result.error);return}
 const alts=result.alternatives||[];
 if(!alts.length){$('#tkMeBubble').hidden=true;setMic('idle');resetSentenceTimer(seconds);setTalkStatus('لم أسمع شيئًا. اضغط وتحدّث بصوت أوضح.',true);return}
 const elapsed=started.at?(performance.now()-started.at)/1000:0;
 handleSentenceAnswer(alts,elapsed);
}
$('#sentenceMicBtn').onclick=()=>{activateExperienceSound();sfx.unlock?.();if(talkState==='listening'){talk.rec?.stop();return}listenTurn()};
$('#tkBlockerRetry').onclick=()=>{hideBlocker();talk.stop();setMic('idle');listenTurn()};
$('#tkBlockerBack').onclick=()=>{hideBlocker();go('phrasesScreen')};
$('#tkModelBtn').onclick=()=>{const item=dialogueEngine.current();if(item)speak(item.de,.8)};

function stopSentenceListening(){talkToken++;talkScene.leTalking(false);talk.stop();clearInterval(talkTimer);clearTimeout(sentenceAdvanceTimer);clearTimeout(sentenceVoiceFallback);talkTimer=null;sentenceTimerReady=false;sentenceAdvanceTimer=null;sentenceVoiceFallback=null;sentenceRemaining=0;if(activeSentenceUtterance&&'speechSynthesis'in window)speechSynthesis.cancel();resetNpcVoiceState();if($('#sentenceMicBtn'))setMic('idle')}

function saveDialogueSession(stars=0,options={}){
 const session=dialogueEngine.session;if(!session)return null;const snapshot=dialogueEngine.snapshot(),key=phraseRecordKey(session.levelId,session.placeId),previous=state.phrases.records[key]||{};
 if(typeof options.completed==='boolean')snapshot.completed=options.completed;
 if(options.reset){snapshot.progress=0;snapshot.correct=0;snapshot.attempts=0;snapshot.accuracyTotal=0;snapshot.vocabularyTotal=0}
 const candidate={...previous,...snapshot,stars:Math.max(Number(previous.stars)||0,stars)};
 const record=previous.completed&&!snapshot.completed?previous:(previous.completed&&snapshot.completed&&(Number(previous.stars)||0)>stars?previous:candidate);state.phrases.records[key]=record;
 if(session.levelId==='A1'){state.phrases.progress[session.placeId]=record.progress;state.phrases.scores[session.placeId]=record.correct;state.phrases.stars[session.placeId]=record.stars;state.phrases.completed[session.placeId]=record.completed}
 save();return record;
}
function advanceSentence(){
 const next=dialogueEngine.advance();sentenceStep=dialogueEngine.session.index;sentenceCorrect=dialogueEngine.session.correct;if(next.complete)completeSentencePlace();else{saveDialogueSession();showSentencePrompt()}
}

function handleSentenceAnswer(alternatives,elapsed=0){
 if(sentenceLocked||!$('#phraseGameScreen').classList.contains('active'))return;
 const place=SENTENCE_PLACES[sentencePlaceIndex],session=dialogueEngine.session,item=dialogueEngine.current(),index=session.index,outcome=dialogueEngine.evaluate(alternatives,elapsed);if(!outcome)return;
 sentenceLocked=true;sentenceAttempts=outcome.attempt;sentenceCorrect=session.correct;clearInterval(talkTimer);setMic('busy');setRing(1,null);
 const said=outcome.transcript||alternatives[0]||'';
 if(outcome.correct){
  talkHistory[index]=true;$('#conversationCard').classList.add('good');
  meBubble({text:said,state:`دقة ${outcome.accuracy}%`,good:true,verdict:{title:outcome.accuracy>=95?'ممتاز!':'صحيح — رد مناسب',lines:outcome.accuracy<95?[{label:'الصياغة الكاملة: ',de:outcome.target}]:[]}});
  setTalkStatus(`${place.npc} يرد عليك…`);haptic([25,25,55]);talkScene.react('good');setTimeout(()=>talkScene.focus('npc'),350);
  $('#sentenceReplyText').textContent=outcome.reply;
  sentenceAdvanceTimer=setTimeout(()=>speakNpc(outcome.reply,place,()=>{if(!$('#phraseGameScreen').classList.contains('active'))return;talkScene.focus('both');setTalkStatus('الموقف التالي…');sentenceAdvanceTimer=setTimeout(advanceSentence,900)},item),450);
  return;
 }
 $('#conversationCard').classList.add('bad');
 if(outcome.retry){
  const support=['A1','A2'].includes(session.levelId)?null:`استخدم: ${(item.keywords||[]).join(' · ')||outcome.hint}`;
  meBubble({text:said,state:said?`دقة ${outcome.accuracy}%`:'',good:false,verdict:{title:'اقتربت — حاول مرة أخرى',lines:[said?'استمع إلى الجملة في الأسفل ثم أعدها.':'لم أفهم ما قلته. استمع إلى الجملة ثم أعدها.',...(support?[support]:[])]}});
  showModel(item,session,true);
  setTalkStatus('استمع إلى الجملة ثم أعد المحاولة');haptic([55,30,55]);talkScene.react('bad');talkScene.focus('both');
  speak(outcome.target,.78);
  sentenceAdvanceTimer=setTimeout(()=>{dialogueEngine.prepareRetry();sentenceLocked=false;setMic('idle');resetSentenceTimer(session.profile.time);setTalkStatus('اضغط وحاول مرة أخرى')},1600);
  return;
 }
 talkHistory[index]=false;
 meBubble({text:said,state:said?`دقة ${outcome.accuracy}%`:'',good:false,verdict:{title:'ننتقل للموقف التالي',lines:[{label:'الجملة الصحيحة: ',de:outcome.target}]}});
 showModel(item,session,true);setTalkStatus('استمع إلى الجملة الصحيحة');haptic([55,30,55]);talkScene.react('bad');talkScene.focus('both');
 speak(outcome.target,.78);
 sentenceAdvanceTimer=setTimeout(advanceSentence,Math.max(3200,1400+outcome.target.split(/\s+/).length*420));
}

function completeSentencePlace(){
 stopSentenceListening();const place=SENTENCE_PLACES[sentencePlaceIndex],summary=dialogueEngine.summary(),key=phraseRecordKey(dialogueEngine.session.levelId,place.id),wasCompleted=Boolean(state.phrases.records[key]?.completed),passed=summary.stars>0;dialogueEngine.session.state='complete';sentenceCorrect=summary.correct;saveDialogueSession(summary.stars,{completed:passed,reset:!passed});if(!wasCompleted&&passed){state.wallet.wordShards+=summary.stars*8;save()}
 renderSteps();$('#phraseGameScreen').classList.add('done');talkScene.react(passed?'good':'bad');
 $('#sentenceCompleteTitle').textContent=passed?`أحسنت في ${place.name}`:`جرّب ${place.name} مرة أخرى`;$('#sentenceCompleteStars').textContent='★ '.repeat(summary.stars)+'☆ '.repeat(3-summary.stars);
 $('#sentenceCompleteText').textContent=passed?`نجحت في ${summary.correct} من ${summary.turns} مواقف — مستوى ${dialogueEngine.session.levelId}`:'لم تنجح في أي موقف هذه المرة، فلم يُحتسب المكان مكتملًا.';
 $('#sentenceCompleteAccuracy').textContent=`${summary.accuracy}%`;$('#sentenceCompleteVocabulary').textContent=`${summary.vocabulary}%`;$('#sentenceComplete').classList.add('show');haptic(passed?[35,30,55,40,90]:[45,30,45]);if(passed)sfx.fanfare?.();
 requestAnimationFrame(()=>$('#sentenceReplayBtn').focus({preventScroll:true}));
}

$('#leaveSentenceBtn').onclick=()=>go('phrasesScreen');
$('#sentencePlacesBtn').onclick=()=>go('phrasesScreen');
$('#sentenceReplayBtn').onclick=()=>startSentencePlace(sentencePlaceIndex,true);
$('#sentenceReplayVoice').onclick=()=>{activateExperienceSound();if(lastNpcReply)speakNpc(lastNpcReply.text,lastNpcReply.place,null,lastNpcReply.item)};

const speech=new LegramSpeech({
 onTranscript:alternatives=>{if(answered||pendingAnswer.length)return;pendingAnswer=alternatives;haptic(18);$('#micText').textContent=`سُجلت: ${pendingAnswer[0]}`;$('#micBtn').classList.remove('listening');handleAnswer(pendingAnswer)},
 onStatus:status=>{if(status==='requesting'){$('#micText').textContent='بانتظار إذن الميكروفون';$('#micBtn').classList.remove('listening')}else if(['unsupported','denied','error'].includes(status)){wordMicUnavailable(status)}else if(['listening','restarting'].includes(status)&&!pendingAnswer.length&&!wordInputMode){setWordLive('on','الميكروفون يعمل — قل الكلمة');$('#micBtn').classList.add('listening');if(status==='listening')startWordEncounterTimer()}},
 shouldRestart:()=>$('#gameScreen').classList.contains('active')&&!paused&&!wordInputMode&&Boolean(encounterStart)&&timeLeft>0
});

function startRecognition(withHaptic=false){if(withHaptic)haptic([18,32,18]);return speech.start()}
function stopRecognition(){speech.stop()}
$('#micBtn').onclick=()=>{if(!answered&&!paused){pendingAnswer=[];requestWordMicrophone({resetTime:true});haptic([18,32,18])}};
$('#wordAnswerControls').addEventListener('click',e=>{if($('#wordAnswerControls').dataset.live==='off'&&e.target.closest('#micBtn')===null&&!answered&&!paused){pendingAnswer=[];requestWordMicrophone({resetTime:true})}});
$('#wordTypeToggle').onclick=()=>{if(!answered&&!paused){pendingAnswer=[];setWordTyping(true,{resetTime:true});haptic(12)}};
$('#wordTypeForm').onsubmit=event=>{event.preventDefault();if(answered||paused)return;const value=$('#wordTypeInput').value.trim();if(!value){$('#wordTypeInput').focus();return}handleAnswer([value])};
/* ---------- Boss duel (word adventure) ---------- */
const LEX=LegramLexicon;
const HERO_MAX_HP=3;
let lastSpoken=null,duel=null,duelToken=0,lastTickSecond=null,feedbackTimer=null;
const shuffle=list=>{const a=[...list];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
function bossFor(wi,li){return MONSTERS[(wi+li)%MONSTERS.length]}
function bossMaxHp(li){return Math.min(10,5+Math.floor(li/2))}
function answerMs(){return (selectedWorld===0?5000:3000)+(state.extraTime?2000:0)}
function syncExtraTimeButton(){const b=$('#extraTimeBtn');if(!b)return;b.textContent=state.extraTime?'وقت إضافي +2 ث: مفعّل':'وقت إضافي +2 ث: معطّل';b.setAttribute('aria-pressed',String(Boolean(state.extraTime)))}

function resetWordEncounterTimer(){encounterStart=0;encounterProgress=0;lastTickSecond=null;timeLeft=Math.ceil(answerMs()/1000);$('#timer').textContent=String(timeLeft);$('.timer-ring').style.setProperty('--timer','100%');$('.timer-ring').classList.remove('urgent');$('#promptCard').style.setProperty('--time-left','1')}
function startWordEncounterTimer(){if(encounterStart||answered||paused||!duel?.ready||!$('#gameScreen').classList.contains('active'))return;encounterStart=performance.now();timeLeft=Math.ceil(answerMs()/1000);combat.countdown(answerMs())}
function setWordTyping(open){wordInputMode=false;if(open)wordMicUnavailable()}
function __legacyWordTyping(open,{resetTime=false,focus=true}={}){wordInputMode=Boolean(open);const form=$('#wordTypeForm'),toggle=$('#wordTypeToggle'),input=$('#wordTypeInput');form.hidden=!wordInputMode;toggle.hidden=wordInputMode;input.disabled=!wordInputMode||answered;if(!wordInputMode)return;stopRecognition();speech.setAccepting(false);$('#micBtn').classList.remove('listening');$('#micText').textContent='اكتب الكلمة بالألمانية';if(resetTime)resetWordEncounterTimer();startWordEncounterTimer();if(focus)requestAnimationFrame(()=>input.focus())}
function setWordLive(kind,text){const c=$('#wordAnswerControls');c.dataset.live=kind;$('#micText').textContent=text}
function wordMicUnavailable(kind){stopRecognition();speech.setAccepting(false);$('#micBtn').classList.remove('listening');clearInterval(timerId);combat.calm?.();encounterStart=0;
 const preview=inClaudePreview();const msg=preview?'الميكروفون محجوب داخل Claude — افتح اللعبة من رابطها على الويب':kind==='unsupported'?'التعرف على الصوت يحتاج متصفح Chrome أو Edge':'اسمح للميكروفون ثم اضغط هنا';
 setWordLive('off',msg)}
function requestWordMicrophone({resetTime=false}={}){$('#wordAnswerControls').dataset.live='wait';wordInputMode=false;$('#wordTypeForm').hidden=true;$('#wordTypeToggle').hidden=false;$('#wordTypeInput').disabled=true;if(resetTime)resetWordEncounterTimer();$('#micText').textContent='جارٍ تجهيز الميكروفون';$('#micBtn').classList.remove('listening');speech.setAccepting(true);if(speech.active){setWordLive('on','الميكروفون يعمل — قل الكلمة');$('#micBtn').classList.add('listening');startWordEncounterTimer()}else startRecognition(false)}

function renderBossHp(){if(!duel)return;const host=$('#monsterHp i');host.innerHTML=Array.from({length:duel.bossMax},(_,i)=>`<b class="seg${i<duel.bossHp?'':' lost'}"></b>`).join('');$('#wordCounter').textContent=`${duel.hits}/${duel.bossMax}`;$('#wordProgressBar').style.width=`${duel.hits/duel.bossMax*100}%`;$('#monsterHp').setAttribute('aria-label',`طاقة ${duel.boss.name}: ${duel.bossHp} من ${duel.bossMax}`)}
function renderLives(){$('#lives').innerHTML=Array.from({length:HERO_MAX_HP},(_,i)=>`<span class="${i<lives?'':'lost'}" aria-hidden="true"></span>`).join('');$('#lives').setAttribute('aria-label',`الأرواح: ${lives} من ${HERO_MAX_HP}`)}
function showFeedback(kind,title,detail,delay=220){clearTimeout(feedbackTimer);const fb=$('#feedback');fb.className='feedback';feedbackTimer=setTimeout(()=>{fb.className=`feedback show ${kind}`;fb.querySelector('strong').textContent=title;const span=fb.querySelector('span');span.textContent='';(Array.isArray(detail)?detail:[detail]).forEach((part,i)=>{if(i)span.append(document.createElement('br'));if(typeof part==='string'){span.append(part);return}span.append(part.label||'');const de=document.createElement('bdi');de.dir='ltr';de.lang='de';de.textContent=part.de;span.append(de)})},delay)}
function hideFeedback(){clearTimeout(feedbackTimer);$('#feedback').className='feedback'}

function startLevel(wi,li){
 stopRecognition();combat.stopAll();hideFeedback();window.gsap?.globalTimeline.resume();
 selectedWorld=wi;currentLevel=li;paused=false;answered=true;wordVoice.warm(catalog.world(wi).id);encounterStart=0;pendingAnswer=[];
 const words=catalog.levelWords(wi,li).map(it=>({...it,...LEX.entry(it.word)}));
 const boss=bossFor(wi,li),max=bossMaxHp(li),token=++duelToken;
 duel={token,words,order:shuffle(words.map((_,i)=>i)),cursor:0,retry:[],since:0,asked:new Set(),boss,bossHp:max,bossMax:max,heroHp:HERO_MAX_HP,hits:0,misses:0,crits:0,current:null,ready:false};
 lives=HERO_MAX_HP;correct=0;streak=0;state.stats.levelsStarted++;save();
 const world=catalog.world(wi),arena=$('#arena');arena.dataset.levelVariant=String(li+1);arena.dataset.world=world.id.toLowerCase();arena.style.setProperty('--level-seed',String(li+1));arena.classList.add('duel');
 $('#gameWorld').textContent=`${world.id} — ${world.name}`;$('#gameLevel').textContent=`المستوى ${li+1}`;
 $('#monster').className=`combat-entity monster boss-sprite ${boss.className}`;$('#monsterHp').style.display='block';$('#monsterHp span').textContent=boss.name;
 $('#gameHero').className='combat-entity le-sprite running';
 $('#promptCard').classList.add('waiting');$('#picture').className='';$('#picture').textContent='';$('#promptAr').textContent='';
 renderBossHp();renderLives();resetWordEncounterTimer();
 go('gameScreen');worldFx.start(world.id.toLowerCase());engine.reset();engine.introRun(1000);
 const begin=()=>{if(!duel||duel.token!==token||!$('#gameScreen').classList.contains('active'))return;duel.ready=true;showQuestion()};
 if(combat.enabled)combat.intro({name:boss.name,hp:max})?.eventCallback('onComplete',begin);
 else setTimeout(()=>{engine.stageDuel();$('#gameHero').className='combat-entity le-sprite idle';begin()},1100);
}
function nextWord(){const d=duel;d.since++;
 const due=d.retry.findIndex(r=>r.due<=d.since);if(due>=0)return d.words[d.retry.splice(due,1)[0].i];
 if(d.cursor>=d.order.length){d.order=shuffle(d.words.map((_,i)=>i));d.cursor=0}
 let item=d.words[d.order[d.cursor++]];
 if(item===d.current&&d.words.length>1){if(d.cursor>=d.order.length){d.order=shuffle(d.words.map((_,i)=>i));d.cursor=0}item=d.words[d.order[d.cursor++]]}
 return item}
function showQuestion(){
 if(!duel||!duel.ready||!$('#gameScreen').classList.contains('active'))return;
 clearInterval(timerId);answered=false;pendingAnswer=[];hideFeedback();resetWordEncounterTimer();
 const item=nextWord();duel.current=item;duel.asked.add(item.word);wordVoice.stop();wordVoice.preload(item);
 const art=WORD_ART[item.word];$('#picture').className=art?`word-art art-${art}`:'';$('#picture').textContent=art?'':item.pic;
 $('#promptAr').textContent=item.ar||'';$('#promptHint').textContent=item.article?'بالألمانية مع der / die / das':'بالألمانية';
 const card=$('#promptCard');card.classList.remove('waiting');if(window.gsap)gsap.fromTo(card,{scale:.86,opacity:0},{scale:1,opacity:1,duration:.28,ease:'back.out(2)',clearProps:'scale,opacity'});
 $('#wordTypeInput').value='';$('#wordTypeInput').disabled=true;$('#micText').textContent=wordInputMode?'اكتب الكلمة بالألمانية':'جارٍ تجهيز الميكروفون';$('#micBtn').classList.remove('listening');
 speech.setAccepting(true);setTimeout(()=>{if(paused||answered||duel?.current!==item)return;if(wordInputMode)setWordTyping(true,{focus:true});else requestWordMicrophone()},120);
}
function judgeAnswer(heard,item){
 let sawWrongArticle=null;
 for(const raw of heard){const value=String(raw||'').trim();if(!value||!isCorrectAnswer(value,item.word))continue;
  const said=value.toLocaleLowerCase('de-DE').match(/^(der|die|das)\s+/);
  if(!item.article||!said)return{ok:true,crit:false};
  if(said[1]===item.article)return{ok:true,crit:true};
  sawWrongArticle=said[1]}
 return sawWrongArticle?{ok:false,wrongArticle:sawWrongArticle}:{ok:false};
}
function handleAnswer(input,timedOut=false){
 if(answered||paused||!duel?.current)return;
 const heard=Array.isArray(input)?input:[input],item=duel.current,verdict=timedOut?{ok:false}:judgeAnswer(heard,item);
 const transcript=heard.map(v=>String(v).trim()).filter(Boolean)[0]||'';
 answered=true;encounterStart=0;clearInterval(timerId);speech.setAccepting(false);$('#wordTypeInput').disabled=true;$('#micBtn').classList.remove('listening');$('.timer-ring').classList.remove('urgent');
 const token=duel.token,alive=()=>duel&&duel.token===token&&$('#gameScreen').classList.contains('active');
 if(verdict.ok){
  correct++;streak++;duel.hits++;if(verdict.crit)duel.crits++;duel.bossHp=Math.max(0,duel.bossHp-1);const lethal=duel.bossHp<=0;
  haptic([24,22,48]);
  showFeedback('correct',verdict.crit?'ضربة حاسمة!':'إجابة صحيحة!',verdict.crit||!item.article?[{label:'',de:item.display}]:[{label:'',de:item.display},'أضف الأداة لضربة حاسمة']);
  let voice=null;lastSpoken=item;
  const onImpact=()=>{renderBossHp();combat.bar($('#monsterHp'));sfx.hpDrain();voice=sayWord(item,300,alive)};
  const after=async()=>{await untilSaid(voice);await wait(220);if(!alive())return;lethal?finishLevel():showQuestion()};
  if(combat.enabled)combat.heroStrike({word:item.display,crit:verdict.crit,lethal,combo:streak,onImpact,onSettled:after});
  else{onImpact();setTimeout(after,900)}
 }else{
  streak=0;duel.misses++;duel.heroHp--;lives=duel.heroHp;const lethal=duel.heroHp<=0;
  duel.retry.push({i:duel.words.indexOf(item),due:duel.since+2});
  state.mistakes[item.word]={pic:item.pic,word:item.display,world:catalog.world(selectedWorld).id};save();
  const title=timedOut?'انتهى الوقت!':verdict.wrongArticle?'الأداة خاطئة':'ليست صحيحة';
  const detail=verdict.wrongArticle?[{label:'كتبت: ',de:verdict.wrongArticle},{label:'الصحيح: ',de:item.display}]:transcript?[{label:'كتبت: ',de:transcript},{label:'الصحيح: ',de:item.display}]:[{label:'الصحيح: ',de:item.display}];
  showFeedback('wrong',title,detail,380);
  let voice=null;lastSpoken=item;
  const onImpact=()=>{renderLives();combat.pulse($$('#lives span')[duel.heroHp]);sfx.heartBreak();haptic([70,35,90]);voice=sayWord(item,620,alive)};
  const after=async()=>{await untilSaid(voice,3200);await wait(lethal?300:420);if(!alive())return;lethal?gameOver():showQuestion()};
  if(combat.enabled)combat.monsterStrike({timedOut,lethal,onImpact,onSettled:after});
  else{onImpact();setTimeout(after,1200)}
 }
}
function gameOver(){clearInterval(timerId);stopRecognition();sfx.defeat();$('#resultTitle').textContent=`هزمك ${duel?.boss?.name||'الزعيم'}`;$('#resultText').textContent='تلقّى Le ثلاث ضربات. راجع الكلمات التي أخطأت فيها ثم حاول مرة أخرى.';setResult(false);go('resultScreen')}
function finishLevel(){
 clearInterval(timerId);stopRecognition();const global=catalog.globalLevel(selectedWorld,currentLevel),taken=HERO_MAX_HP-duel.heroHp,stars=taken===0?3:taken===1?2:1;
 state.stars[global]=Math.max(state.stars[global]||0,stars);state.unlocked=Math.max(state.unlocked,Math.min(catalog.totalLevels,global+1));state.stats.levelsCompleted++;state.wallet.wordShards+=duel.hits*2+duel.crits*3+stars*5;save();
 $('#resultTitle').textContent=`هزمت ${duel.boss.name}!`;$('#resultText').textContent=`أكملت المستوى ${currentLevel+1} من عالم ${catalog.world(selectedWorld).id}${duel.crits?` — ${duel.crits} ضربات حاسمة`:''}`;setResult(true,stars);showVictory(()=>go('resultScreen'))
}
function showVictory(onComplete){const overlay=$('#victoryOverlay'),hero=$('#victoryHero');clearTimeout(victoryTimer);paused=true;stopRecognition();overlay.setAttribute('aria-hidden','false');overlay.classList.remove('show');hero.className='victory-hero';void overlay.offsetWidth;overlay.classList.add('show');hero.classList.add('playing');sfx.fanfare();haptic([35,35,55,45,90]);victoryTimer=setTimeout(()=>{overlay.classList.remove('show');overlay.setAttribute('aria-hidden','true');hero.classList.remove('playing');paused=false;onComplete?.()},4200)}
window.__legramVictory={show:()=>showVictory(),duration:4200};
function setResult(win,stars=0){const hits=duel?.hits||0,misses=duel?.misses||0,total=hits+misses;$('#correctStat').textContent=hits;$('#accuracyStat').textContent=`${total?Math.round(hits/total*100):0}%`;$('#newWordsStat').textContent=duel?.asked?.size||0;$('#resultStars').textContent=win?'★ '.repeat(stars)+'☆ '.repeat(3-stars):'♡ ♡ ♡';$('#resultHomeBtn').style.display=win?'none':'inline-block';$('#nextLevelBtn').textContent=win?'المستوى التالي':'إعادة المحاولة';$('#nextLevelBtn').onclick=()=>{if(win){const global=catalog.globalLevel(selectedWorld,currentLevel);if(global>=catalog.totalLevels)return go('mapScreen');startLevel(Math.floor(global/catalog.levelsPerWorld),global%catalog.levelsPerWorld)}else startLevel(selectedWorld,currentLevel)}}

$('#pauseBtn').onclick=()=>{paused=true;wordVoice.stop();clearInterval(timerId);stopRecognition();window.gsap?.globalTimeline.pause();syncExtraTimeButton();openAccessibleDialog($('#pauseModal'),$('#resumeBtn'))};$('#resumeBtn').onclick=()=>{paused=false;closeAccessibleDialog($('#pauseModal'));window.gsap?.globalTimeline.resume();if(duel?.ready&&!answered){combat.idle();showQuestion()}};$('#extraTimeBtn')&&($('#extraTimeBtn').onclick=()=>{state.extraTime=!state.extraTime;save();syncExtraTimeButton()});$('#quitBtn').onclick=()=>{paused=false;closeAccessibleDialog($('#pauseModal'),{restore:false});go('mapScreen')};
function renderReview(){const entries=Object.entries(state.mistakes),items=entries.map(([k,v])=>({...v,key:k}));$('#reviewEmpty').style.display=items.length?'none':'grid';$('#reviewGrid').innerHTML=items.map(x=>`<div class="review-card"><div class="pic">${x.pic}</div><small>${x.world}</small><b lang="de" dir="ltr">${x.word}</b><button data-speak="${x.key}" aria-label="استمع إلى ${x.word}"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M9 20v8h7l10 8V12l-10 8H9Z"/><path d="M31 18c4 3 4 9 0 12M35 13c7 6 7 16 0 22"/></svg></button></div>`).join('');$$('[data-speak]').forEach(b=>b.onclick=()=>{const key=b.dataset.speak,e=LEX.entry(key);wordVoice.play(e)})}
$('#clearMistakes').onclick=()=>{if(confirm('هل تريد مسح قائمة الأخطاء؟')){state.mistakes={};save();renderReview()}};
if($('#mistakeCount'))$('#mistakeCount').textContent=Object.keys(state.mistakes).length;$('#soundToggle')?.classList.toggle('muted',!state.sound);
$$('.screen').forEach(screen=>{const active=screen.classList.contains('active');screen.setAttribute('aria-hidden',String(!active));screen.inert=!active});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&$('#gameScreen').classList.contains('active'))$('#pauseBtn').click()});

function setCloudStatus(status,payload={}){
 const node=$('#cloudStatus');if(!node)return;node.dataset.state=status;
 const labels={syncing:'جارٍ الحفظ',synced:payload.identityKind==='account'?'متصل بحسابك':'محفوظ سحابيًا',local:'محفوظ على الجهاز'};
 node.querySelector('span').textContent=labels[status]||labels.local;
}
function applyCloudState(next){
 state=next;state.phrases={level:null,records:{},progress:{},scores:{},stars:{},completed:{},...(state.phrases||{})};state.phrases.records=state.phrases.records||{};pendingConversationLevel=state.phrases.level;
 $('#soundToggle')?.classList.toggle('muted',!state.sound);if($('#mistakeCount'))$('#mistakeCount').textContent=Object.keys(state.mistakes||{}).length;
 const screen=activeScreenId();if(screen==='mapScreen')renderMap();else if(screen==='phrasesScreen'&&!activeDialog)renderPhraseHub();else if(screen==='reviewScreen')renderReview();
}
cloudSync=LegramCloudSync.create({store,fetch:LegramBackend.progressFetch,onApplied:applyCloudState,onStatus:setCloudStatus});
cloudSync.start().then(()=>{state.stats.sessions++;save()});window.__legramCloudSync=cloudSync;

$('#feedbackListen')&&($('#feedbackListen').onclick=()=>{if(lastSpoken)wordVoice.play(lastSpoken)});
function renderCredits(){const host=$('#creditsList');if(!host)return;wordVoice.ready.then(()=>{const list=wordVoice.credits();const bySpeaker={};list.forEach(c=>{(bySpeaker[c.artist||'غير معروف']=bySpeaker[c.artist||'غير معروف']||[]).push(c)});host.innerHTML=Object.entries(bySpeaker).sort((a,b)=>b[1].length-a[1].length).map(([who,items])=>`<details><summary><b>${escapeAttribute(who)}</b><span>${items.length} تسجيل</span></summary><ul>${items.map(c=>`<li><a href="${escapeAttribute(c.page)}" target="_blank" rel="noopener" lang="de" dir="ltr">${escapeAttribute(c.title.replace(/^File:/,''))}</a> <small>${escapeAttribute(c.license)}</small></li>`).join('')}</ul></details>`).join('');$('#creditsCount').textContent=String(list.length)})}
$('#creditsBtn')&&($('#creditsBtn').onclick=()=>{renderCredits();openAccessibleDialog($('#creditsModal'),$('#creditsClose'))});
$('#creditsClose')&&($('#creditsClose').onclick=()=>closeAccessibleDialog($('#creditsModal')));
