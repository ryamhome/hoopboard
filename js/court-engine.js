/*
  HoopBoard Court Engine v2
  目的：建立「真實比例球場規格引擎」＋「可切換場地風格」。
  設計原則：
  1. 不改球員、動畫、Firebase、聊天室邏輯。
  2. 只控制 #court-svg 的底圖與左上角 UI。
  3. 所有線條位置用實際規格換算，不再目測硬畫。
*/
(function(){
  'use strict';

  const BOARD = { w: 3000, h: 1700, x: 100, y: 100, courtW: 2800, courtH: 1500 };

  const SPECS = {
    fiba: {
      id:'fiba', label:'FIBA 28×15m', short:'FIBA',
      length:28.0, width:15.0,
      laneDepth:5.8, laneWidth:4.9,
      centerCircleR:1.8, freeThrowCircleR:1.8,
      rimFromEnd:1.575, backboardFromEnd:1.2, backboardWidth:1.8,
      rimR:0.225, restrictedR:1.25,
      threeRadius:6.75, cornerOffsetY:0.90,
      source:'FIBA 2024：28m × 15m；籃圈中心距端線 1.575m；三分線 6.75m。'
    },
    nba: {
      id:'nba', label:'NBA 94×50ft', short:'NBA',
      length:28.6512, width:15.24,
      laneDepth:5.7912, laneWidth:4.8768,
      centerCircleR:1.8288, freeThrowCircleR:1.8288,
      rimFromEnd:1.6002, backboardFromEnd:1.2192, backboardWidth:1.8288,
      rimR:0.2286, restrictedR:1.2192,
      threeRadius:7.239, cornerOffsetY:0.9144,
      source:'NBA：94ft × 50ft；限制區弧 4ft；三分線 23ft 9in / 底角 22ft。'
    },
    ncaa: {
      id:'ncaa', label:'NCAA 94×50ft', short:'NCAA',
      length:28.6512, width:15.24,
      laneDepth:5.7912, laneWidth:3.6576,
      centerCircleR:1.8288, freeThrowCircleR:1.8288,
      rimFromEnd:1.6002, backboardFromEnd:1.2192, backboardWidth:1.8288,
      rimR:0.2286, restrictedR:1.2192,
      threeRadius:6.75, cornerOffsetY:1.015,
      source:'NCAA 參考：場地同 94×50ft，禁區較窄，適合教學比較。'
    },
    half: {
      id:'half', label:'半場訓練', short:'HALF',
      length:14.0, width:15.0,
      laneDepth:5.8, laneWidth:4.9,
      centerCircleR:1.8, freeThrowCircleR:1.8,
      rimFromEnd:1.575, backboardFromEnd:1.2, backboardWidth:1.8,
      rimR:0.225, restrictedR:1.25,
      threeRadius:6.75, cornerOffsetY:0.90,
      halfCourt:true,
      source:'半場模式：用於半場戰術、3v3、區域站位訓練。'
    }
  };

  const THEMES = {
    wood:{id:'wood',label:'經典木地板',bg:'#07111C',floorA:'#8B5E2A',floorB:'#B07840',paint:'rgba(28,60,130,.28)',line:'rgba(255,255,255,.90)',muted:'rgba(255,255,255,.72)',hoop:'#FF5E1A',glow:'rgba(255,200,100,.07)',grain:'#3D1A00'},
    proDark:{id:'proDark',label:'NBA 暗色風',bg:'#05070D',floorA:'#1E293B',floorB:'#334155',paint:'rgba(15,23,42,.62)',line:'rgba(255,255,255,.94)',muted:'rgba(255,255,255,.72)',hoop:'#FF6B1A',glow:'rgba(0,212,255,.07)',grain:'#0F172A'},
    purpleGold:{id:'purpleGold',label:'紫金風',bg:'#12091F',floorA:'#6D4A1F',floorB:'#B8872B',paint:'rgba(85,42,140,.42)',line:'rgba(255,237,150,.94)',muted:'rgba(255,237,150,.75)',hoop:'#FF5E1A',glow:'rgba(255,214,0,.08)',grain:'#2B1648'},
    blueGold:{id:'blueGold',label:'藍金風',bg:'#061326',floorA:'#9A6A2D',floorB:'#D19B42',paint:'rgba(0,77,180,.35)',line:'rgba(255,255,255,.95)',muted:'rgba(255,255,255,.70)',hoop:'#FFB000',glow:'rgba(0,123,255,.08)',grain:'#11335F'},
    street:{id:'street',label:'街頭水泥',bg:'#0B0D10',floorA:'#454A50',floorB:'#626A73',paint:'rgba(255,255,255,.08)',line:'rgba(245,245,245,.82)',muted:'rgba(245,245,245,.58)',hoop:'#FF4D1A',glow:'rgba(255,255,255,.035)',grain:'#20242A'}
  };

  let currentSpec = localStorage.getItem('hb_court_spec') || 'fiba';
  let currentTheme = localStorage.getItem('hb_court_theme') || 'wood';

  function esc(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
  function fmt(n){ return Number(n).toFixed(2).replace(/\.00$/,''); }
  function sx(spec,meterFromLeft){ return BOARD.x + (meterFromLeft / spec.length) * BOARD.courtW; }
  function sy(spec,meterFromTop){ return BOARD.y + (meterFromTop / spec.width) * BOARD.courtH; }
  function pxLenX(spec,m){ return (m / spec.length) * BOARD.courtW; }

  function arc(cx,cy,r,startDeg,endDeg,sweep){
    const rad=d=>d*Math.PI/180;
    const x1=cx+r*Math.cos(rad(startDeg)), y1=cy+r*Math.sin(rad(startDeg));
    const x2=cx+r*Math.cos(rad(endDeg)), y2=cy+r*Math.sin(rad(endDeg));
    const large=Math.abs(endDeg-startDeg)>180?1:0;
    return `M ${fmt(x1)} ${fmt(y1)} A ${fmt(r)} ${fmt(r)} 0 ${large} ${sweep?1:0} ${fmt(x2)} ${fmt(y2)}`;
  }

  function geom(spec,side){
    const left=side==='left';
    const dir=left?1:-1;
    const endM=left?0:spec.length;
    const rimM=endM+dir*spec.rimFromEnd;
    const ftM=endM+dir*spec.laneDepth;
    const bM=endM+dir*spec.backboardFromEnd;
    const laneTopM=(spec.width-spec.laneWidth)/2;
    const laneBotM=(spec.width+spec.laneWidth)/2;
    const backTopM=(spec.width-spec.backboardWidth)/2;
    const backBotM=(spec.width+spec.backboardWidth)/2;
    const dy=(spec.width/2)-spec.cornerOffsetY;
    const cornerRun=Math.sqrt(Math.max(0, spec.threeRadius*spec.threeRadius-dy*dy));
    const cornerM=endM+dir*cornerRun;
    return {
      left,dir,endX:sx(spec,endM),rimX:sx(spec,rimM),rimY:sy(spec,spec.width/2),ftX:sx(spec,ftM),ftY:sy(spec,spec.width/2),
      laneTop:sy(spec,laneTopM),laneBot:sy(spec,laneBotM),backX:sx(spec,bM),backTop:sy(spec,backTopM),backBot:sy(spec,backBotM),
      cornerX:sx(spec,cornerM),cornerTopY:sy(spec,spec.cornerOffsetY),cornerBotY:sy(spec,spec.width-spec.cornerOffsetY),
      threeR:pxLenX(spec,spec.threeRadius),restrictedR:pxLenX(spec,spec.restrictedR),ftR:pxLenX(spec,spec.freeThrowCircleR),rimR:pxLenX(spec,spec.rimR)
    };
  }

  function drawSide(spec,theme,side){
    const g=geom(spec,side);
    const laneX=Math.min(g.endX,g.ftX), laneW=Math.abs(g.ftX-g.endX);
    const baselineX=g.left?BOARD.x:BOARD.x+BOARD.courtW;
    const marks=[1.75,2.75,3.75].map(d=>sx(spec,g.left?d:spec.length-d));
    const ftSolid=g.left?arc(g.ftX,g.ftY,g.ftR,-90,90,false):arc(g.ftX,g.ftY,g.ftR,90,270,false);
    const ftDash=g.left?arc(g.ftX,g.ftY,g.ftR,-90,90,true):arc(g.ftX,g.ftY,g.ftR,90,270,true);
    const restricted=g.left?arc(g.rimX,g.rimY,g.restrictedR,-90,90,true):arc(g.rimX,g.rimY,g.restrictedR,90,270,true);
    const three=g.left
      ? `M ${fmt(g.cornerX)} ${fmt(g.cornerTopY)} A ${fmt(g.threeR)} ${fmt(g.threeR)} 0 0 1 ${fmt(g.cornerX)} ${fmt(g.cornerBotY)}`
      : `M ${fmt(g.cornerX)} ${fmt(g.cornerTopY)} A ${fmt(g.threeR)} ${fmt(g.threeR)} 0 0 0 ${fmt(g.cornerX)} ${fmt(g.cornerBotY)}`;

    return `
      <rect x="${fmt(laneX)}" y="${fmt(g.laneTop)}" width="${fmt(laneW)}" height="${fmt(g.laneBot-g.laneTop)}" fill="${theme.paint}" stroke="none"/>
      <line x1="${fmt(g.endX)}" y1="${fmt(g.laneTop)}" x2="${fmt(g.ftX)}" y2="${fmt(g.laneTop)}"/>
      <line x1="${fmt(g.endX)}" y1="${fmt(g.laneBot)}" x2="${fmt(g.ftX)}" y2="${fmt(g.laneBot)}"/>
      <line x1="${fmt(g.ftX)}" y1="${fmt(g.laneTop)}" x2="${fmt(g.ftX)}" y2="${fmt(g.laneBot)}"/>
      ${marks.map(mx=>`<line x1="${fmt(mx)}" y1="${fmt(g.laneTop)}" x2="${fmt(mx)}" y2="${fmt(g.laneTop-20)}"/><line x1="${fmt(mx)}" y1="${fmt(g.laneBot)}" x2="${fmt(mx)}" y2="${fmt(g.laneBot+20)}"/>`).join('')}
      <path d="${ftSolid}"/>
      <path d="${ftDash}" stroke-dasharray="28 18"/>
      <path d="${restricted}"/>
      <line x1="${fmt(baselineX)}" y1="${fmt(g.cornerTopY)}" x2="${fmt(g.cornerX)}" y2="${fmt(g.cornerTopY)}"/>
      <line x1="${fmt(baselineX)}" y1="${fmt(g.cornerBotY)}" x2="${fmt(g.cornerX)}" y2="${fmt(g.cornerBotY)}"/>
      <path d="${three}"/>
      <line x1="${fmt(g.backX)}" y1="${fmt(g.backTop)}" x2="${fmt(g.backX)}" y2="${fmt(g.backBot)}" stroke-width="5"/>
      <circle cx="${fmt(g.rimX)}" cy="${fmt(g.rimY)}" r="${fmt(g.rimR)}" stroke="${theme.hoop}" stroke-width="5" filter="url(#basket-glow)"/>
    `;
  }

  function makeSvg(spec,theme){
    const midX=sx(spec,spec.length/2), midY=sy(spec,spec.width/2), centerR=pxLenX(spec,spec.centerCircleR);
    const grain=Array.from({length:39},(_,i)=>BOARD.y+38*(i+1)).map(y=>`<line x1="${BOARD.x}" y1="${y}" x2="${BOARD.x+BOARD.courtW}" y2="${y}"/>`).join('');
    const center=spec.halfCourt?'':`<line x1="${fmt(midX)}" y1="${BOARD.y}" x2="${fmt(midX)}" y2="${BOARD.y+BOARD.courtH}"/><circle cx="${fmt(midX)}" cy="${fmt(midY)}" r="${fmt(centerR)}"/><circle cx="${fmt(midX)}" cy="${fmt(midY)}" r="6" fill="${theme.line}" stroke="none"/>`;
    const right=spec.halfCourt?'':drawSide(spec,theme,'right');
    return `
      <defs>
        <linearGradient id="floor-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${theme.floorA}"/><stop offset="50%" stop-color="${theme.floorB}"/><stop offset="100%" stop-color="${theme.floorA}"/></linearGradient>
        <radialGradient id="court-glow" cx="50%" cy="50%" r="44%"><stop offset="0%" stop-color="${theme.glow}"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/></radialGradient>
        <filter id="basket-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <clipPath id="court-clip"><rect x="${BOARD.x}" y="${BOARD.y}" width="${BOARD.courtW}" height="${BOARD.courtH}"/></clipPath>
      </defs>
      <rect x="0" y="0" width="${BOARD.w}" height="${BOARD.h}" fill="${theme.bg}"/>
      <rect x="${BOARD.x}" y="${BOARD.y}" width="${BOARD.courtW}" height="${BOARD.courtH}" fill="url(#floor-grad)"/>
      <g opacity=".06" stroke="${theme.grain}" stroke-width=".5" clip-path="url(#court-clip)">${grain}</g>
      <rect x="${BOARD.x}" y="${BOARD.y}" width="${BOARD.courtW}" height="${BOARD.courtH}" fill="url(#court-glow)"/>
      <g clip-path="url(#court-clip)" fill="none" stroke="${theme.line}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <rect x="${BOARD.x}" y="${BOARD.y}" width="${BOARD.courtW}" height="${BOARD.courtH}"/>
        ${center}
        ${drawSide(spec,theme,'left')}
        ${right}
      </g>
      <text x="${BOARD.x+24}" y="${BOARD.y+44}" fill="${theme.muted}" font-family="Barlow Condensed, sans-serif" font-size="34" font-weight="900" letter-spacing="2">${esc(spec.short)}</text>
    `;
  }

  function ensurePanel(){
    const host=document.getElementById('ca') || document.querySelector('.court-wrap');
    if(!host) return;
    let panel=document.getElementById('court-preset-panel');
    if(!panel){
      panel=document.createElement('div');
      panel.id='court-preset-panel';
      panel.className='court-preset-panel';
      panel.innerHTML=`
        <span class="court-preset-title">場地</span>
        <select id="court-spec-select" aria-label="球場規格">${Object.values(SPECS).map(s=>`<option value="${s.id}">${esc(s.label)}</option>`).join('')}</select>
        <select id="court-theme-select" aria-label="球場風格">${Object.values(THEMES).map(t=>`<option value="${t.id}">${esc(t.label)}</option>`).join('')}</select>
        <button id="court-check-btn" type="button">檢查</button>
      `;
      host.appendChild(panel);
    }
    const ss=document.getElementById('court-spec-select');
    const ts=document.getElementById('court-theme-select');
    if(ss){ ss.value=currentSpec; ss.onchange=()=>apply(ss.value, ts ? ts.value : currentTheme); }
    if(ts){ ts.value=currentTheme; ts.onchange=()=>apply(ss ? ss.value : currentSpec, ts.value); }
    const chk=document.getElementById('court-check-btn');
    if(chk){ chk.onclick=()=>showCheck(); }
  }

  function apply(specId=currentSpec, themeId=currentTheme){
    currentSpec=SPECS[specId]?specId:'fiba';
    currentTheme=THEMES[themeId]?themeId:'wood';
    localStorage.setItem('hb_court_spec',currentSpec);
    localStorage.setItem('hb_court_theme',currentTheme);
    const svg=document.getElementById('court-svg');
    if(!svg) return;
    const spec=SPECS[currentSpec], theme=THEMES[currentTheme];
    svg.setAttribute('viewBox',`0 0 ${BOARD.w} ${BOARD.h}`);
    svg.innerHTML=makeSvg(spec,theme);
    const note=document.getElementById('court-spec-note');
    if(note) note.textContent=spec.source;
    if(typeof window.render==='function') window.render();
  }

  function showCheck(){
    const s=SPECS[currentSpec];
    const msg=[
      `目前規格：${s.label}`,
      `場地：${s.length}m × ${s.width}m`,
      `禁區深度/罰球線：${s.laneDepth}m`,
      `禁區寬度：${s.laneWidth}m`,
      `籃框中心距底線：${s.rimFromEnd}m`,
      `三分弧半徑：${s.threeRadius}m`,
      `底角線距邊線：${s.cornerOffsetY}m`,
      `限制區弧：${s.restrictedR}m`,
      s.source
    ].join('\n');
    alert(msg);
  }

  window.HoopCourtEngine={SPECS,THEMES,apply,mount:ensurePanel,check:showCheck};
  window.applyCourtPreset=apply;

  function boot(){ ensurePanel(); apply(currentSpec,currentTheme); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
  window.addEventListener('load',boot);
})();
