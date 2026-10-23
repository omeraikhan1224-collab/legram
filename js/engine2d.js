(function(global){
  'use strict';

  const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
  const ease=value=>1-Math.pow(1-clamp(value),2.2);
  // A nearly constant travel curve keeps the character's stride, camera and
  // ground speed believable. The last 16% of the distance is still reserved
  // for the final second so silhouettes never collide before the timer ends.
  const approachEase=value=>{
    const p=clamp(value,0,1);
    return p*(.84+.16*p);
  };

  const encounterGeometry=({viewport,heroWidth,monsterWidth,heroWorldX=0,lead,edgePadding,desiredGap})=>{
    const cameraX=heroWorldX-lead;
    const monsterWorldX=cameraX+viewport-monsterWidth-edgePadding;
    const heroTarget=monsterWorldX-heroWidth-desiredGap;
    return Object.freeze({cameraX,monsterWorldX,heroTarget,desiredGap});
  };

  class LegramEngine2D{
    constructor({arena,hero,monster,heroShadow,monsterShadow,fxLayer}){
      this.arena=arena;
      this.hero=hero;
      this.monster=monster;
      this.heroShadow=heroShadow;
      this.monsterShadow=monsterShadow;
      this.fxLayer=fxLayer;
      this.enemyProfiles=[
        {id:'crystal',pace:.94},
        {id:'boar',pace:1.08},
        {id:'tanuki',pace:1.02}
      ];
      this.reset();
    }

    viewport(){return Math.max(320,this.arena?.clientWidth||global.innerWidth||320)}
    lead(){return clamp(this.viewport()*.1,28,82)}
    entityWidth(entity,fallback){return entity?.offsetWidth||fallback}
    snap(value){
      const ratio=Math.max(1,global.devicePixelRatio||1);
      return Math.round(value*ratio)/ratio;
    }

    reset(){
      const width=this.viewport();
      this.heroX=0;
      this.monsterX=width*.62;
      this.cameraX=this.heroX-this.lead();
      this.cameraVelocity=0;
      this.state='idle';
      this.progress=0;
      this.passElapsed=0;
      this.passDuration=900;
      this.profile=this.enemyProfiles[0];
      this.metrics={heroWidth:0,monsterWidth:0,desiredGap:0};
      this.render();
    }

    beginEncounter(index,duration){
      const width=this.viewport();
      this.profile=this.enemyProfiles[index%this.enemyProfiles.length];
      this.duration=duration;
      this.progress=0;
      this.state='approach';
      this.startHeroX=this.heroX;
      // Spawn the complete enemy inside the camera frustum. Both actors use
      // world coordinates; the camera never supplies a second movement path.
      const monsterWidth=this.entityWidth(this.monster,clamp(width*.34,132,220));
      const edgePadding=clamp(width*.025,8,22);
      const heroWidth=this.entityWidth(this.hero,clamp(width*.3,112,190));
      const desiredGap=clamp(width*.018,6,14);
      const geometry=encounterGeometry({
        viewport:width,
        heroWidth,
        monsterWidth,
        heroWorldX:this.startHeroX,
        lead:this.lead(),
        edgePadding,
        desiredGap
      });
      this.cameraX=geometry.cameraX;
      this.startMonsterX=geometry.monsterWorldX;
      this.monsterX=this.startMonsterX;
      // The monster owns one fixed world coordinate and waits. Le covers the
      // complete runway while the camera follows him from the same coordinate
      // system. This removes the old two-actor "sliding together" illusion.
      this.heroTarget=Math.max(this.startHeroX,geometry.heroTarget);
      this.monsterTarget=this.startMonsterX;
      this.metrics={heroWidth,monsterWidth,desiredGap,edgePadding};
      this.arena.dataset.aiState='hunt';
      this.arena.dataset.enemy=this.profile.id;
      this.render();
    }

    setApproachProgress(progress){
      if(this.state!=='approach')return;
      this.progress=clamp(progress,0,1);
      const movement=approachEase(this.progress);
      this.heroX=this.startHeroX+(this.heroTarget-this.startHeroX)*movement;
      this.monsterX=this.startMonsterX;
    }

    resolve(outcome){
      this.state=outcome;
      this.arena.dataset.aiState=outcome==='defeated'?'defeated':'attack';
    }

    // Duel staging: Le holds the left third, the boss owns the right edge.
    stageDuel(){
      const width=this.viewport();
      const monsterWidth=this.entityWidth(this.monster,clamp(width*.4,140,240));
      const edgePadding=clamp(width*.035,10,34);
      const heroWidth=this.entityWidth(this.hero,clamp(width*.33,118,200));
      const gap=clamp(width*.16,48,240);
      const span=heroWidth+gap+monsterWidth;
      // On wide screens the duel is centred instead of stretched edge to edge.
      this.duelLead=Math.max(this.lead(),(width-span)/2);
      this.state='duel';
      this.cameraX=this.heroX-this.duelLead;
      this.monsterX=Math.min(this.cameraX+width-monsterWidth-edgePadding,this.heroX+heroWidth+gap);
      this.progress=0;
      this.arena.dataset.aiState='duel';
      this.render();
    }

    introRun(duration=1100){
      this.state='passing';
      this.passElapsed=0;
      this.passDuration=duration;
      this.passStart=this.heroX;
      this.passTarget=this.heroX+this.viewport()*.85;
      this.monsterX=this.passTarget-this.lead()+this.viewport()*2;
      this.arena.dataset.aiState='travel';
    }

    startPassing(duration=900){
      this.state='passing';
      this.passElapsed=0;
      this.passDuration=duration;
      this.passStart=this.heroX;
      this.passTarget=Math.max(this.heroX+this.viewport()*.34,this.monsterX+this.viewport()*.18);
      this.arena.dataset.aiState='cleared';
    }

    finishPassing(){
      if(this.state==='passing')this.heroX=this.passTarget;
      this.state='waiting';
      this.render();
    }

    tick(deltaMs,{active=true,paused=false}={}){
      const dt=clamp(deltaMs,0,34);
      if(active&&!paused&&this.state==='passing'){
        this.passElapsed+=dt;
        const p=clamp(this.passElapsed/this.passDuration,0,1);
        this.heroX=this.passStart+(this.passTarget-this.passStart)*ease(p);
      }
      const cameraTarget=this.heroX-(this.state==='duel'&&this.duelLead?this.duelLead:this.lead());
      if(this.state==='approach'||this.state==='duel'){
        // A hard camera lock prevents the fighter, floor, and shadow from
        // drifting against one another during the timed six-second run.
        this.cameraX=cameraTarget;
      }else{
        const stiffness=1-Math.pow(.00008,dt/1000);
        this.cameraX+=(cameraTarget-this.cameraX)*stiffness;
      }
      this.render();
    }

    render(){
      if(!this.arena||!this.hero||!this.monster)return;
      const heroScreen=this.snap(this.heroX-this.cameraX);
      const monsterScreen=this.snap(this.monsterX-this.cameraX);
      this.hero.style.setProperty('--entity-x',`${heroScreen}px`);
      this.monster.style.setProperty('--entity-x',`${monsterScreen}px`);
      this.arena.style.setProperty('--camera-x',`${this.snap(-this.cameraX)}px`);
      this.arena.style.setProperty('--camera-far',`${this.snap(-this.cameraX*.18)}px`);
      this.arena.style.setProperty('--camera-mid',`${this.snap(-this.cameraX*.48)}px`);
      this.arena.style.setProperty('--camera-ground',`${this.snap(-this.cameraX)}px`);
      this.arena.style.setProperty('--journey',`${this.heroX}px`);
      this.arena.style.setProperty('--encounter-progress',String(this.progress));
      this.arena.dataset.engineState=this.state;
    }

    gap(){
      return this.monsterX-(this.heroX+(this.metrics.heroWidth||0));
    }

    burst(kind,target=this.monster,count=kind==='death'?22:14){
      if(!this.fxLayer||!target)return;
      const arenaRect=this.arena.getBoundingClientRect(),rect=target.getBoundingClientRect();
      const x=rect.left-arenaRect.left+rect.width*.5,y=rect.top-arenaRect.top+rect.height*.48;
      for(let i=0;i<count;i++){
        const particle=document.createElement('i');
        const angle=(Math.PI*2*i/count)+(Math.random()-.5)*.35;
        const distance=(kind==='death'?90:62)*(0.65+Math.random()*.7);
        particle.className=`fx-particle fx-${kind}`;
        particle.style.cssText=`--x:${x}px;--y:${y}px;--dx:${Math.cos(angle)*distance}px;--dy:${Math.sin(angle)*distance}px;--delay:${Math.random()*80}ms;--size:${4+Math.random()*8}px`;
        this.fxLayer.appendChild(particle);
        global.setTimeout(()=>particle.remove(),1100);
      }
    }

    snapshot(){
      return{
        state:this.state,
        heroX:this.heroX,
        monsterX:this.monsterX,
        cameraX:this.cameraX,
        heroScreen:this.heroX-this.cameraX,
        monsterScreen:this.monsterX-this.cameraX,
        gap:this.gap(),
        desiredGap:this.metrics.desiredGap,
        progress:this.progress,
        enemy:this.profile.id
      };
    }
  }

  global.LegramEngineMath=Object.freeze({clamp,ease,approachEase,encounterGeometry});
  global.LegramEngine2D=LegramEngine2D;
})(window);
