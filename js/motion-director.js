(function(global){
  'use strict';

  const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
  const PROFILES={
    home:{nod:.52,sway:.28,lift:1.4,shift:1.2,scale:.0034,tempo:1},
    work:{nod:.28,sway:.14,lift:.9,shift:.7,scale:.0022,tempo:.82},
    market:{nod:.72,sway:.42,lift:1.75,shift:1.55,scale:.0042,tempo:1.12}
  };

  function visemeFor(token){
    if(!token||/\s/.test(token))return{open:0,wide:0,round:0,weight:.34};
    if(/[.!?,;:]/.test(token))return{open:0,wide:0,round:0,weight:.58};
    if(/^(m|b|p)$/.test(token))return{open:.025,wide:.08,round:.04,weight:.52};
    if(/^(f|v|w|pf)$/.test(token))return{open:.16,wide:.64,round:.08,weight:.54};
    if(/^(o|ö|u|ü|au|eu|äu)$/.test(token))return{open:.68,wide:.08,round:1,weight:.92};
    if(/^(a|ä)$/.test(token))return{open:1,wide:.48,round:.06,weight:.96};
    if(/^(e|i|ie|ei|y)$/.test(token))return{open:.5,wide:1,round:.03,weight:.82};
    if(/^(sch|ch|tsch|s|z|ß)$/.test(token))return{open:.24,wide:.68,round:.18,weight:.58};
    if(/^(r|l|n)$/.test(token))return{open:.34,wide:.38,round:.12,weight:.56};
    return{open:.29,wide:.26,round:.1,weight:.5};
  }

  function buildVisemeTrack(text){
    const normalized=String(text||'').toLowerCase();
    const raw=normalized.match(/tsch|sch|pf|äu|eu|au|ei|ie|./gu)||[];
    const track=raw.map(visemeFor);
    if(!track.length)track.push(visemeFor(' '));
    const total=track.reduce((sum,item)=>sum+item.weight,0);
    let cursor=0;
    return track.map(item=>{
      const start=cursor/total;cursor+=item.weight;
      return{...item,start,end:cursor/total};
    });
  }

  class LegramNpcMotion{
    constructor(node){
      this.node=node;
      this.focus=node?.parentElement||null;
      this.mode='listen';
      this.profile=PROFILES.home;
      this.started=performance.now();
      this.duration=2400;
      this.track=buildVisemeTrack('');
      this.audio=null;
      this.mouth=0;
      this.wide=0;
      this.round=0;
      this.viseme='closed';
      this.previousViseme='closed';
      this.blend=0;
      this.lastVisemeAt=0;
      this.last=performance.now();
      if(this.node){this.node.dataset.viseme='closed';this.node.dataset.prevViseme='closed';this.node.style.setProperty('--npc-blend','0')}
      this.frame=requestAnimationFrame(time=>this.tick(time));
    }

    useProfile(id){this.profile=PROFILES[id]||PROFILES.home}

    listen(id='home'){
      this.useProfile(id);
      this.mode='listen';
      this.started=performance.now();
    }

    speak(text,duration,id='home',audio=null){
      this.useProfile(id);
      this.mode='speak';
      this.started=performance.now();
      this.duration=Math.max(900,duration||2200);
      this.track=buildVisemeTrack(text);
      this.audio=audio||null;
    }

    respond(id='home'){
      this.useProfile(id);
      this.mode='settle';
      this.started=performance.now();
    }

    stop(){
      this.mode='rest';
      this.started=performance.now();
      this.audio=null;
    }

    speechClock(now){
      let elapsed=now-this.started,duration=this.duration;
      if(this.audio){
        if(Number.isFinite(this.audio.duration)&&this.audio.duration>0)duration=this.audio.duration*1000;
        if(Number.isFinite(this.audio.currentTime))elapsed=this.audio.currentTime*1000;
      }
      return{elapsed,duration};
    }

    speechPose(elapsed,duration){
      const progress=clamp(elapsed/Math.max(1,duration));
      const index=Math.min(this.track.length-1,this.track.findIndex(item=>progress<=item.end));
      const item=this.track[index<0?this.track.length-1:index];
      const span=Math.max(.001,item.end-item.start),local=clamp((progress-item.start)/span);
      const articulation=.62+.38*Math.sin(Math.PI*local);
      const phraseIn=clamp(progress/.035),phraseOut=clamp((1-progress)/.045);
      const envelope=Math.min(phraseIn,phraseOut);
      return{
        open:clamp(item.open*articulation*envelope),
        wide:clamp(item.wide*articulation*envelope),
        round:clamp(item.round*articulation*envelope)
      };
    }

    tick(now){
      if(!this.node)return;
      const dt=Math.min(50,Math.max(0,now-this.last));this.last=now;
      let elapsed=now-this.started,duration=this.duration;
      const t=elapsed/1000,p=this.profile;
      let target=0,targetWide=0,targetRound=0,x=0,y=0,rotation=0,scale=1;

      if(this.mode==='speak'){
        const clock=this.speechClock(now);elapsed=clock.elapsed;duration=clock.duration;
        const pose=this.speechPose(elapsed,duration);target=pose.open;targetWide=pose.wide;targetRound=pose.round;
        const speechTime=elapsed/1000,progress=clamp(elapsed/Math.max(1,duration)),phrase=speechTime*Math.PI*2/(1.7/p.tempo);
        const emphasis=Math.max(target,targetWide*.55,targetRound*.68);
        const phraseEnvelope=Math.sin(Math.PI*progress),gesture=Math.sin(progress*Math.PI*3.2)*phraseEnvelope;
        x=Math.sin(phrase*.38)*p.shift*.34+gesture*p.shift*emphasis;
        y=-p.lift*(.18+.82*Math.pow(emphasis,.7))-Math.sin(phrase)*.2-Math.abs(gesture)*.28;
        rotation=Math.sin(phrase*.42)*p.sway+gesture*p.nod*emphasis;
        scale=1+p.scale*(.35+.65*target);
      }else if(this.mode==='listen'){
        target=0;
        x=Math.sin(t*Math.PI*2/6.2)*p.shift*.18;
        y=-.7-Math.sin(t*Math.PI*2/3.9)*.9;
        rotation=Math.sin(t*Math.PI*2/5.3)*p.sway*.42;
        scale=1+Math.sin(t*Math.PI*2/4.6)*.0018;
      }else if(this.mode==='settle'){
        const settle=clamp(elapsed/620);
        target=0;
        y=-Math.sin(Math.PI*settle)*2.2;
        rotation=Math.sin(Math.PI*settle)*p.nod*.7;
        scale=1+Math.sin(Math.PI*settle)*.004;
        if(settle>=1)this.mode='listen';
      }

      const response=1-Math.exp(-dt/(this.mode==='speak'?72:92));
      this.mouth+=(target-this.mouth)*response;
      this.wide+=(targetWide-this.wide)*response;
      this.round+=(targetRound-this.round)*response;
      if(this.mode!=='speak'&&this.mouth<.004)this.mouth=0;
      this.node.style.setProperty('--npc-mouth',this.mouth.toFixed(4));
      this.node.style.setProperty('--npc-open',this.mouth.toFixed(4));
      this.node.style.setProperty('--npc-wide',this.wide.toFixed(4));
      this.node.style.setProperty('--npc-round',this.round.toFixed(4));
      this.node.style.setProperty('--npc-x',`${x.toFixed(3)}px`);
      this.node.style.setProperty('--npc-y',`${y.toFixed(3)}px`);
      this.node.style.setProperty('--npc-rotate',`${rotation.toFixed(3)}deg`);
      this.node.style.setProperty('--npc-scale',scale.toFixed(5));
      const candidate=this.mode!=='speak'||this.mouth<.08?'closed':this.round>.18&&this.round>this.wide*.8?'round':this.wide>.2&&this.wide>this.round*.8?'wide':'open';
      if(candidate!==this.viseme&&now-this.lastVisemeAt>104){
        this.previousViseme=this.viseme;
        this.node.dataset.prevViseme=this.previousViseme;
        this.viseme=candidate;
        this.lastVisemeAt=now;
        this.blend=1;
      }else if(this.blend>0){
        this.blend*=Math.exp(-dt/118);
        if(this.blend<.012)this.blend=0;
      }
      this.node.dataset.viseme=this.viseme;
      this.node.style.setProperty('--npc-blend',this.blend.toFixed(4));
      if(this.focus){
        this.focus.style.setProperty('--npc-shadow-y',`${Math.max(0,-y*.28).toFixed(3)}px`);
        this.focus.style.setProperty('--npc-shadow-scale',(1-Math.min(.045,Math.abs(y)*.014)).toFixed(4));
      }
      this.node.dataset.motionMode=this.mode;
      this.frame=requestAnimationFrame(time=>this.tick(time));
    }
  }

  global.LegramNpcMotionMath=Object.freeze({PROFILES,visemeFor,buildVisemeTrack});
  global.LegramNpcMotion=LegramNpcMotion;
})(window);
