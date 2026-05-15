// HoopBoard main UI, canvas, tactics, animation, and input logic.
// ─────────────────────────────────────────────
//  SVG 架構說明：
//  - 球場底圖為固定 SVG（viewBox 0 0 3000 1700）
//  - 1m = 100 SVG 單位；場地本體 2800×1500，四邊 100px 邊界
//  - canvas 透明疊加在 SVG 上，尺寸同步
//  - 球員/球/戰術線座標使用 SVG 單位（0~3000, 0~1700）
//  - 場地本體起點：(100, 100)
// ─────────────────────────────────────────────

const CV = document.getElementById('court');
const ct = CV.getContext('2d');
const lerp = window.__hbLerp || function(a,b,t){ return a + (b - a) * t; };

// SVG 座標系常數（對應 viewBox 0 0 3000 1700）
const SVG_W = 3000, SVG_H = 1700;   // 含邊界
const COURT_X = 100, COURT_Y = 100; // 場地原點（SVG 單位）
const COURT_W = 2800, COURT_H = 1500;
const U = 100; // 1m = 100 SVG 單位

// Court Spec Fix：以 FIBA 28m × 15m 為基準，三分線/限制區弧必須朝「場內」凸出。
// 本版已修正 SVG Arc sweep / large-arc 旗標，避免三分弧或限制區弧畫到錯誤方向。
function clampToBoard(p) {
  return {
    x: Math.max(0, Math.min(SVG_W, p.x)),
    y: Math.max(0, Math.min(SVG_H, p.y))
  };
}
function clampToCourt(p) {
  return {
    x: Math.max(COURT_X, Math.min(COURT_X + COURT_W, p.x)),
    y: Math.max(COURT_Y, Math.min(COURT_Y + COURT_H, p.y))
  };
}

let CW, CH;    // canvas 實際像素尺寸
let SC_X, SC_Y; // SVG單位 → canvas pixel 的比例

// SVG 座標 → canvas pixel
function s2c(sx, sy) {
  return { x: sx * SC_X, y: sy * SC_Y };
}
function c2s(cx, cy) {
  return { x: cx / SC_X, y: cy / SC_Y };
}
function px2s(v) { return v / SC_X; }
function mapPtsToCanvas(pts){ return (pts||[]).map(p=>s2c(p.x,p.y)); }

function initCourtDims() {
  const a = document.getElementById('ca');
  // 維持 3000:1700 比例（含邊界）
  let aw = a.clientWidth - 12, ah = a.clientHeight - 12;
  const ratio = SVG_W / SVG_H; // 3000/1700
  let cw = Math.min(aw, ah * ratio);
  let ch = cw / ratio;
  if (ch > ah) { ch = ah; cw = ch * ratio; }
  CW = Math.floor(cw);
  CH = Math.floor(ch);

  // 設定 court-cw 容器尺寸（SVG 會自動填滿）
  const ccw = document.getElementById('court-cw-el');
  ccw.style.width  = CW + 'px';
  ccw.style.height = CH + 'px';

  // canvas 透明疊加，尺寸與容器一致
  CV.width  = CW; CV.height = CH;
  CV.style.width  = CW + 'px'; CV.style.height = CH + 'px';

  // draw-canvas 同步
  const dc = document.getElementById('draw-canvas');
  dc.width = CW; dc.height = CH;
  dc.style.width = CW + 'px'; dc.style.height = CH + 'px';

  // 比例：SVG 單位 → canvas pixel
  SC_X = CW / SVG_W;
  SC_Y = CH / SVG_H;
}

// SC 向下相容（用於跑位線寬度等）
Object.defineProperty(window, 'SC', { get: () => SC_X * U });

const lw = () => Math.max(1, CW / 600);

// DATA
let frames=[{name:'Frame 1',players:[],ball:null,arrows:[],screens:[]}];
let curFrame=0,tool='select',col='#FF5E1A',pSize=18;
let sel=null,drawing=false,drawPts=[],drag=null,dox,doy,pctr=1,pendingP=null;
let history=[],animPlaying=false,animRaf=null,animT=0,animStart=null,animSpd=1;
let currentRP='frames',dragSrcIdx=null;
const PR=()=>px2s(pSize);const CF=()=>frames[curFrame];
let selectedPlayers=[];
let boxSelecting=false, boxStart=null, boxEnd=null;
let dragStartPos=null, dragSnapshot=null; // v5：拖曳快移時用起點快照計算，避免累積誤差漂移
function sameSelPlayer(i){return selectedPlayers.includes(i);}
function clampGroupDelta(items,dx,dy){
  if(!items||!items.length)return{dx,dy};
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  items.forEach(it=>{minX=Math.min(minX,it.x);maxX=Math.max(maxX,it.x);minY=Math.min(minY,it.y);maxY=Math.max(maxY,it.y);});
  if(minX+dx<COURT_X)dx=COURT_X-minX;
  if(maxX+dx>COURT_X+COURT_W)dx=COURT_X+COURT_W-maxX;
  if(minY+dy<COURT_Y)dy=COURT_Y-minY;
  if(maxY+dy>COURT_Y+COURT_H)dy=COURT_Y+COURT_H-maxY;
  return{dx,dy};
}
function clearDragState(){drag=null;dragStartPos=null;dragSnapshot=null;}
function drawArrowPath(pts,style,color,isSel){
  if(!pts||pts.length<2)return;
  ct.save();
  const c=isSel?'#FFD600':color||'#fff';
  ct.strokeStyle=c;
  ct.lineWidth=isSel?3:Math.max(1.5,CW/460);
  ct.lineCap='round';ct.lineJoin='round';
  if(style==='pass')ct.setLineDash([18,10]);
  if(style==='drib')ct.lineWidth*=1.4;
  ct.shadowColor=isSel?'#FFD600':c;ct.shadowBlur=isSel?8:3;
  const p0=s2c(pts[0].x,pts[0].y);
  ct.beginPath();ct.moveTo(p0.x,p0.y);
  if(pts.length===2){const p1=s2c(pts[1].x,pts[1].y);ct.lineTo(p1.x,p1.y);}else{
    for(let i=0;i<pts.length-1;i++){
      const a=pts[Math.max(0,i-1)],b=pts[i],cpt=pts[i+1],d=pts[Math.min(pts.length-1,i+2)];
      const b1=s2c(b.x+(cpt.x-a.x)/6,b.y+(cpt.y-a.y)/6);
      const b2=s2c(cpt.x-(d.x-b.x)/6,cpt.y-(d.y-b.y)/6);
      const e=s2c(cpt.x,cpt.y);
      ct.bezierCurveTo(b1.x,b1.y,b2.x,b2.y,e.x,e.y);
    }
  }
  ct.stroke();ct.setLineDash([]);
  const n=pts.length, end=s2c(pts[n-1].x,pts[n-1].y), prev=s2c(pts[n-2].x,pts[n-2].y);
  const ang=Math.atan2(end.y-prev.y,end.x-prev.x),h=Math.max(9,CW/70);
  ct.fillStyle=c;ct.shadowColor=c;ct.shadowBlur=4;
  ct.beginPath();ct.moveTo(end.x,end.y);ct.lineTo(end.x-h*Math.cos(ang-.42),end.y-h*Math.sin(ang-.42));ct.lineTo(end.x-h*Math.cos(ang+.42),end.y-h*Math.sin(ang+.42));ct.closePath();ct.fill();
  if(isSel){ct.shadowBlur=0;pts.forEach((p,i)=>{if(i===0||i===pts.length-1)return;const q=s2c(p.x,p.y);ct.beginPath();ct.arc(q.x,q.y,6,0,Math.PI*2);ct.fillStyle='#FFD600';ct.fill();ct.strokeStyle='rgba(0,0,0,.6)';ct.lineWidth=1.5;ct.stroke();});}
  ct.restore();
}
function drawScreen(s,isSel){
  ct.save();
  const q=s2c(s.x,s.y),sz=pSize*.95;
  if(isSel){ct.shadowColor='#FFD600';ct.shadowBlur=10;}
  ct.strokeStyle=isSel?'#FFD600':s.color;ct.lineWidth=Math.max(2.2,CW/320);
  ct.strokeRect(q.x-sz/2,q.y-sz/2,sz,sz);
  ct.restore();
}
function drawPlayer(p,isSel){
  const q=s2c(p.x,p.y), r=pSize;
  const baseColor=p.color||'#FF5E1A';
  ct.save();
  if(isSel){ct.beginPath();ct.arc(q.x,q.y,r+7,0,Math.PI*2);ct.strokeStyle='#FFD600';ct.lineWidth=2;ct.shadowColor='#FFD600';ct.shadowBlur=10;ct.stroke();ct.shadowBlur=0;}
  // shadow
  ct.beginPath();ct.arc(q.x+2,q.y+3,r,0,Math.PI*2);ct.fillStyle='rgba(0,0,0,.4)';ct.fill();
  // body
  let grad;
  try{grad=ct.createRadialGradient(q.x-r*.3,q.y-r*.3,0,q.x,q.y,r);grad.addColorStop(0,lighten(baseColor,.3));grad.addColorStop(1,baseColor);}catch(e){grad=baseColor;}
  ct.beginPath();ct.arc(q.x,q.y,r,0,Math.PI*2);ct.fillStyle=grad;ct.fill();
  ct.strokeStyle='rgba(255,255,255,.75)';ct.lineWidth=1.5;ct.stroke();
  // jersey badge
  if(p.jersey){const jx=q.x+r*.65,jy=q.y-r*.65,jr=r*.4;ct.beginPath();ct.arc(jx,jy,jr,0,Math.PI*2);ct.fillStyle='rgba(0,0,0,.85)';ct.fill();ct.font='bold '+Math.max(7,jr*.85)+'px Barlow Condensed,sans-serif';ct.fillStyle='#fff';ct.textAlign='center';ct.textBaseline='middle';ct.fillText(p.jersey,jx,jy);}
  const lbl=p.name||String(p.num||'P'),fs=lbl.length>2?Math.max(8,r*.6):Math.max(10,r*.82);
  ct.fillStyle='#fff';ct.font='bold '+fs+'px Barlow Condensed,sans-serif';ct.textAlign='center';ct.textBaseline='middle';ct.fillText(lbl,q.x,q.y);
  if(p.name&&p.name.trim()){
    const tf=Math.max(8,r*.65);ct.font=tf+'px Noto Sans TC,sans-serif';const tw=ct.measureText(p.name).width+10,ty=q.y+r+3;
    ct.fillStyle='rgba(0,0,0,.75)';ct.beginPath();ct.roundRect(q.x-tw/2,ty,tw,tf+5,4);ct.fill();ct.fillStyle='rgba(255,255,255,.9)';ct.fillText(p.name,q.x,ty+tf/2+2.5);
  }
  ct.restore();
}
function drawBall(b,isSel){
  const q=s2c(b.x,b.y),r=Math.max(10,pSize*.58);
  ct.save();
  if(isSel){ct.beginPath();ct.arc(q.x,q.y,r+7,0,Math.PI*2);ct.strokeStyle='#FFD600';ct.lineWidth=2;ct.shadowColor='#FFD600';ct.shadowBlur=10;ct.stroke();ct.shadowBlur=0;}
  ct.beginPath();ct.arc(q.x+2,q.y+3,r,0,Math.PI*2);ct.fillStyle='rgba(0,0,0,.4)';ct.fill();
  const bg=ct.createRadialGradient(q.x-r*.3,q.y-r*.3,0,q.x,q.y,r);bg.addColorStop(0,'#FF8C42');bg.addColorStop(.6,'#FF5E1A');bg.addColorStop(1,'#CC3A00');
  ct.beginPath();ct.arc(q.x,q.y,r,0,Math.PI*2);ct.fillStyle=bg;ct.fill();ct.strokeStyle='rgba(0,0,0,.55)';ct.lineWidth=1;
  ct.beginPath();ct.arc(q.x,q.y,r,.3,Math.PI+.3);ct.stroke();ct.beginPath();ct.moveTo(q.x-r,q.y);ct.lineTo(q.x+r,q.y);ct.stroke();
  ct.restore();
}
function renderFrameData(f){
  if(!f)return;
  (f.screens||[]).forEach((s,i)=>drawScreen(s,!animPlaying&&sel&&sel.type==='scr'&&sel.i===i));
  (f.arrows||[]).forEach((a,i)=>drawArrowPath(a.pts,a.style,a.color,!animPlaying&&sel&&(sel.type==='arr'||sel.type==='ctrl')&&sel.arrI===i));
  (f.players||[]).forEach((p,i)=>drawPlayer(p,(!animPlaying&&sel&&sel.type==='ply'&&sel.i===i)||sameSelPlayer(i)));
  if(f.ball)drawBall(f.ball,!animPlaying&&sel&&sel.type==='bal');
}
function renderBoxOverlay(){
  // v4 改為直接畫在 canvas 上，避免 DOM 疊層被遮住
  if(!boxSelecting||!boxStart||!boxEnd)return;
  const p1=s2c(boxStart.x,boxStart.y),p2=s2c(boxEnd.x,boxEnd.y);
  const x=Math.min(p1.x,p2.x),y=Math.min(p1.y,p2.y),w=Math.abs(p2.x-p1.x),h=Math.abs(p2.y-p1.y);
  ct.save();
  ct.setLineDash([8,6]);
  ct.strokeStyle='#FFD600';
  ct.lineWidth=2;
  ct.fillStyle='rgba(255,214,0,.12)';
  ct.fillRect(x,y,w,h);
  ct.strokeRect(x,y,w,h);
  ct.restore();
}
function render(){
  if(!CW)return;
  ct.setTransform(1,0,0,1,0,0);ct.clearRect(0,0,CW,CH);
  renderFrameData(CF());
  if(drawing&&drawPts.length>1){
    ct.save();
    ct.strokeStyle=col;ct.lineWidth=Math.max(1.5,CW/460);ct.shadowColor=col;ct.shadowBlur=4;ct.lineCap='round';ct.lineJoin='round';
    if(tool==='pass')ct.setLineDash([18,10]);
    if(tool==='drib')ct.lineWidth*=1.4;
    const first=s2c(drawPts[0].x,drawPts[0].y);
    ct.beginPath();ct.moveTo(first.x,first.y);
    for(let i=1;i<drawPts.length;i++){const q=s2c(drawPts[i].x,drawPts[i].y);ct.lineTo(q.x,q.y);}
    ct.stroke();ct.restore();
  }
  renderBoxOverlay();
}
// ANIMATION
function setAnimUI(prog,playing){
  const pct=Math.max(0,Math.min(100,Math.round((prog||0)*100)));
  const apb=document.getElementById('ap-pb'); if(apb)apb.textContent=playing?'⏸ 暫停':'▶ 播放';
  const app=document.getElementById('ap-prog'); if(app)app.textContent=pct+'%';
  const apf=document.getElementById('ap-fill'); if(apf)apf.style.width=pct+'%';
  const cf=document.getElementById('ctl-fill'); if(cf)cf.style.width=pct+'%';
  const cp=document.getElementById('ctl-prog'); if(cp)cp.textContent=pct+'%';
}
function interpolateFrame(t){
  const count=frames.length;
  const p=Math.max(0,Math.min(1,t))*(count-1);
  const fi=Math.min(Math.floor(p),count-2);
  const frac=p-fi;
  const f0=frames[fi],f1=frames[fi+1];
  if(!f0||!f1)return CF();
  const maxP=Math.max((f0.players||[]).length,(f1.players||[]).length);
  const intP=[];
  for(let i=0;i<maxP;i++){
    const p0=(f0.players||[])[i],p1=(f1.players||[])[i];
    if(p0&&p1)intP.push({...p0,x:lerp(p0.x,p1.x,frac),y:lerp(p0.y,p1.y,frac)});
    else if(p0)intP.push({...p0});
    else if(p1)intP.push({...p1});
  }
  const intBall=f0.ball&&f1.ball?{...f0.ball,x:lerp(f0.ball.x,f1.ball.x,frac),y:lerp(f0.ball.y,f1.ball.y,frac)}:(f0.ball||f1.ball||null);
  return {...f0,players:intP,ball:intBall};
}
function drawAnimationAt(t){
  ct.setTransform(1,0,0,1,0,0);
  ct.clearRect(0,0,CW,CH);
  renderFrameData(interpolateFrame(t));
  setAnimUI(t,animPlaying);
  if(window.__pushBcast)window.__pushBcast(t,animPlaying);
}
function playAll(){
  if(!Array.isArray(frames)||frames.length<2){
    alert('至少需要2個幀。請先按「🎬 戰術動畫庫」載入範例，或按「＋複製成新幀」建立第2幀。');
    return;
  }
  stopAnim(false);
  animPlaying=true;animT=0;animStart=Date.now();
  const bar=document.getElementById('anim-bar'); if(bar)bar.classList.add('show');
  setAnimUI(0,true);
  // 使用 setInterval 作為主播放器，比 requestAnimationFrame 更不容易被瀏覽器/事件狀態中斷。
  animRaf=setInterval(runAnim,16);
  runAnim();
}
function runAnim(){
  if(!animPlaying)return;
  const count=frames.length;
  const totalDur=Math.max(700,(count-1)*1200/Math.max(.1,animSpd));
  animT=Math.max(0,Math.min(1,(Date.now()-animStart)/totalDur));
  drawAnimationAt(animT);
  if(animT>=1){
    clearInterval(animRaf);animRaf=null;animPlaying=false;setAnimUI(1,false);
    if(window.__pushBcast)window.__pushBcast(1,false);
  }
}
function stopAnim(notify=true){
  if(animRaf){clearInterval(animRaf);cancelAnimationFrame(animRaf);animRaf=null;}
  animPlaying=false;animT=0;animStart=null;
  setAnimUI(0,false);render();
  if(notify&&window.__pushBcast)window.__pushBcast(0,false);
}
function toggleAnim(){if(animPlaying)stopAnim();else playAll();}
window.HBAnimation={play:playAll,stop:stopAnim,toggle:toggleAnim,draw:drawAnimationAt};
window.playAll=playAll;window.stopAnim=stopAnim;window.toggleAnim=toggleAnim;
function setSpd(s,btn){animSpd=s;document.querySelectorAll('.spd-b').forEach(b=>b.classList.remove('act'));if(btn)btn.classList.add('act');}
window.setSpd=setSpd;
// FRAMES
function addFrame(){snap();frames.push({name:'Frame '+(frames.length+1),players:[],ball:null,arrows:[],screens:[]});curFrame=frames.length-1;render();renderFrameList();if(window.__push)window.__push();}
window.addFrame=addFrame;
function dupFrame(i){snap();const f=JSON.parse(JSON.stringify(frames[i]));f.name=(f.name||'Frame')+'（副本）';frames.splice(i+1,0,f);curFrame=i+1;render();renderFrameList();if(window.__push)window.__push();}
window.dupFrame=dupFrame;
function delFrame(i){if(frames.length<=1){alert('至少需要一個幀！');return;}snap();frames.splice(i,1);curFrame=Math.min(curFrame,frames.length-1);render();renderFrameList();if(window.__push)window.__push();}
window.delFrame=delFrame;
function selectFrame(i){curFrame=i;sel=null;selectedPlayers=[];boxSelecting=false;clearDragState();render();renderFrameList();}
window.selectFrame=selectFrame;
// FRAME PANEL
function renderFrameList(){
  if(currentRP!=='frames')return;
  const body=document.getElementById('rp-body');if(!body)return;
  const isHost=window.__isHost;
  body.innerHTML='<div style="display:flex;flex-direction:column;height:100%"><div class="anim-ctl"><div class="ctl-ttl">幀式動畫</div><div class="ctl-row"><button class="ctl-play" onclick="window.toggleAnim()">▶ 播放全部幀</button><button class="ctl-stop" onclick="window.stopAnim()">■</button><button class="ctl-add" onclick="addFrame()">＋幀</button><span class="ctl-prog" id="ctl-prog">0%</span></div><div class="ctl-track"><div class="ctl-fill" id="ctl-fill"></div></div><div style="display:flex;gap:4px;margin-top:7px;align-items:center"><span style="font-size:9px;color:var(--t4)">速度：</span><div class="spd-g"><button class="spd-b" onclick="setSpd(.5,this)">.5x</button><button class="spd-b act" onclick="setSpd(1,this)">1x</button><button class="spd-b" onclick="setSpd(2,this)">2x</button></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:8px"><button class="ctl-add" onclick="showPresetTactics()">🎬 戰術動畫庫</button><button class="ctl-stop" onclick="clearAnimationFrames()">🧹 清除動畫</button><button class="ctl-add" onclick="saveLocalTactic()">💾 存本機戰術</button><button class="ctl-stop" onclick="showTacticLibrary()">📂 我的戰術</button><button class="ctl-stop" onclick="addFrameFromCurrent()">＋複製成新幀</button></div></div>'+(isHost?'<div class="bcast-ctl"><div class="bcast-ctl-title">協作廣播</div><button class="bcast-main-btn idle" id="bcast-main-btn" onclick="toggleBcast()">📡 開始廣播並播放</button><div class="bcast-desc">✅ 全體同時看到播放動畫<br>✅ 球員可 👍 讚 或 ✋ 暫停<br>✅ 右下角 ✏️ 隨時開關畫圖<br>✅ 標註即時同步給所有人</div></div>':'<div style="padding:8px 12px;background:rgba(0,212,255,.04);border-bottom:1px solid rgba(0,212,255,.1);font-size:9px;color:var(--a1);line-height:1.8">📡 教練廣播時同步播放<br>可按 👍 讚 或 ✋ 暫停<br>右下角 ✏️ 開啟畫圖討論</div>')+'<div class="frame-list" id="frame-list" style="flex:1;overflow-y:auto;padding:8px"></div></div>';
  const list=document.getElementById('frame-list');
  frames.forEach((f,i)=>{
    const item=document.createElement('div');
    item.className='fi'+(i===curFrame?' act':'');item.draggable=true;
    item.innerHTML='<div class="fi-hdr"><span class="fi-drag">⠿</span><span class="fi-num">'+String(i+1).padStart(2,'0')+'</span><span class="fi-name" id="fn-'+i+'">'+(f.name||'Frame '+(i+1))+'</span><input class="fi-name-inp" id="fni-'+i+'" value="'+(f.name||'Frame '+(i+1))+'" maxlength="20"/><div class="fi-acts"><button class="fa-btn" onclick="dupFrame('+i+');event.stopPropagation()">⧉</button><button class="fa-btn del" onclick="delFrame('+i+');event.stopPropagation()">✕</button></div></div><div class="fi-prev"><canvas class="fi-canvas" width="220" height="'+Math.round(220*15/28)+'"></canvas></div>';
    list.appendChild(item);
    setTimeout(()=>{const mc=item.querySelector('.fi-canvas');if(mc)drawMini(mc,f);},10);
    const fn=item.querySelector('#fn-'+i),fni=item.querySelector('#fni-'+i);
    fn.addEventListener('dblclick',e=>{e.stopPropagation();fn.style.display='none';fni.style.display='block';fni.focus();fni.select();});
    fni.addEventListener('blur',()=>{frames[i].name=fni.value.trim()||'Frame '+(i+1);fn.textContent=frames[i].name;fn.style.display='';fni.style.display='none';if(window.__push)window.__push();});
    fni.addEventListener('keydown',e=>{if(e.key==='Enter')fni.blur();if(e.key==='Escape')fni.blur();});
    fni.addEventListener('click',e=>e.stopPropagation());
    item.onclick=()=>selectFrame(i);
    item.addEventListener('dragstart',e=>{dragSrcIdx=i;item.classList.add('dragging');e.dataTransfer.effectAllowed='move';});
    item.addEventListener('dragend',()=>{item.classList.remove('dragging');list.querySelectorAll('.fi').forEach(d=>d.classList.remove('drag-over'));});
    item.addEventListener('dragover',e=>{e.preventDefault();list.querySelectorAll('.fi').forEach(d=>d.classList.remove('drag-over'));if(dragSrcIdx!==i)item.classList.add('drag-over');});
    item.addEventListener('drop',e=>{e.preventDefault();if(dragSrcIdx===null||dragSrcIdx===i)return;snap();const moved=frames.splice(dragSrcIdx,1)[0];frames.splice(i,0,moved);curFrame=i;dragSrcIdx=null;render();renderFrameList();if(window.__push)window.__push();});
  });
}
function drawMini(mc,f){
  if(!CW)return;
  const ctx=mc.getContext('2d'),W=mc.width,H=mc.height;
  // mini canvas 填滿整個 SVG viewBox（3000×1700）的比例，球員座標直接映射
  const msx=W/SVG_W, msy=H/SVG_H;
  function tm(px,py){return{mx:px*msx, my:py*msy};}
  const mSC=W/SVG_W*SC_X/SC_X; // = W/SVG_W，mini 每 SVG 單位的 pixel
  const mU=W/SVG_W; // 1 SVG unit → mini pixel

  ctx.clearRect(0,0,W,H);
  // 背景
  ctx.fillStyle='#07111C';ctx.fillRect(0,0,W,H);
  // 木地板
  ctx.fillStyle='#A0703A';
  ctx.fillRect(COURT_X*mU, COURT_Y*mU, COURT_W*mU, COURT_H*mU);
  // 簡易線條
  ctx.strokeStyle='rgba(255,255,255,.3)';ctx.lineWidth=.8;
  ctx.strokeRect(COURT_X*mU+.5, COURT_Y*mU+.5, COURT_W*mU-1, COURT_H*mU-1);
  // 中線
  ctx.beginPath();ctx.moveTo((COURT_X+COURT_W/2)*mU,(COURT_Y)*mU);ctx.lineTo((COURT_X+COURT_W/2)*mU,(COURT_Y+COURT_H)*mU);ctx.stroke();
  // 中圈
  ctx.beginPath();ctx.arc((COURT_X+COURT_W/2)*mU,(COURT_Y+COURT_H/2)*mU,180*mU,0,Math.PI*2);ctx.stroke();
  // 籃框（SVG 座標：左 257.5, 右 2742.5, y=850）
  ctx.fillStyle='#FF5E1A';
  ctx.beginPath();ctx.arc(257.5*mU,850*mU,22.5*mU,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(2742.5*mU,850*mU,22.5*mU,0,Math.PI*2);ctx.fill();
  // 箭頭（球員座標已是 SVG 單位）
  (f.arrows||[]).forEach(a=>{if(!a.pts||a.pts.length<2)return;const pm=tm(a.pts[0].x,a.pts[0].y);ctx.strokeStyle=a.color||'#fff';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(pm.mx,pm.my);for(let i=1;i<a.pts.length;i++){const q=tm(a.pts[i].x,a.pts[i].y);ctx.lineTo(q.mx,q.my);}ctx.stroke();});
  // 球員
  (f.players||[]).forEach(p=>{const pm=tm(p.x,p.y),r=Math.max(4,pSize*.45*msx/SC_X);ctx.beginPath();ctx.arc(pm.mx,pm.my,r,0,Math.PI*2);ctx.fillStyle=p.color;ctx.fill();ctx.font='bold '+Math.max(5,r*.85)+'px Barlow Condensed,sans-serif';ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(p.name?p.name[0]:p.num,pm.mx,pm.my);});
  // 球
  if(f.ball){const bm=tm(f.ball.x,f.ball.y),r=Math.max(3,pSize*.38*msx/SC_X);ctx.beginPath();ctx.arc(bm.mx,bm.my,r,0,Math.PI*2);ctx.fillStyle='#FF5E1A';ctx.fill();}
}
// TOOLS PANEL
function renderToolsPanel(){
  const body=document.getElementById('rp-body');if(!body)return;
  body.innerHTML='<div class="tp-body"><div class="tp-sec"><div class="tp-ttl">球員顏色</div><div class="c-swatches" id="color-row"></div></div><div class="tp-sec"><div class="tp-ttl">球員大小</div><div class="sz-row"><input type="range" class="sz-slider" id="sz-sl" min="12" max="28" value="'+pSize+'" oninput="setPS(this.value)"/><span class="sz-val" id="sz-val">'+pSize+'</span></div></div><div class="tp-sec"><div class="tp-ttl">⚡ 一鍵靜態戰術</div><div class="tc-grid"><div class="tc-card" onclick="loadT(\'fb\')"><span class="tc-icon">⚡</span><div class="tc-label">快攻反擊</div></div><div class="tc-card" onclick="loadT(\'pr\')"><span class="tc-icon">🔄</span><div class="tc-label">Pick&Roll</div></div><div class="tc-card" onclick="loadT(\'z23\')"><span class="tc-icon">🛡</span><div class="tc-label">2-3 區域</div></div><div class="tc-card" onclick="loadT(\'box\')"><span class="tc-icon">📦</span><div class="tc-label">Box</div></div><div class="tc-card" onclick="loadT(\'press\')"><span class="tc-icon">🔥</span><div class="tc-label">全場緊迫</div></div><div class="tc-card" onclick="loadT(\'iso\')"><span class="tc-icon">⭐</span><div class="tc-label">單打空間</div></div><div class="tc-card" onclick="loadT(\'horns\')"><span class="tc-icon">🐂</span><div class="tc-label">Horns</div></div><div class="tc-card" onclick="clearCurrentFrame()" style="border-color:rgba(255,61,90,.2)"><span class="tc-icon">🗑</span><div class="tc-label danger">清除本幀</div></div></div></div><div class="tp-sec"><div class="tp-ttl">🎬 知名動畫戰術</div><button class="ctl-play" style="width:100%;margin-bottom:8px" onclick="showPresetTactics()">打開 10 套動畫戰術庫</button><div style="font-size:10px;color:var(--t4);line-height:1.8">包含：PnR、快攻、Motion、Horns、Floppy、Spain PnR、2-3、3-2、1-3-1、全場緊迫。</div></div><div class="tp-sec"><div class="tp-ttl">👥 目標使用者評價</div><div style="font-size:10px;color:var(--t3);line-height:1.8;background:rgba(255,255,255,.04);border:1px solid var(--l1);border-radius:8px;padding:10px">教練會在意：①能快速放球員 ②戰術範例可直接播放 ③手機上也能懂 ④不要因多人同步互相覆蓋。<br><br>目前盲點：框選在手機仍不直覺；戰術名稱需再加說明；Firebase 權限仍需正式規則保護。</div></div><div class="tp-sec"><div class="tp-ttl">在線成員</div><div style="font-size:10px;color:var(--t4);line-height:1.8">'+((window.__users||[]).map(u=>'<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px"><div style="width:18px;height:18px;border-radius:50%;background:'+(u.color||'#555')+';display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:#fff">'+u.name[0]+'</div>'+u.name+(u.isHost?'<span style="font-size:8px;color:var(--e2);margin-left:4px">🎙主持</span>':'')+'</div>').join('')||'尚無其他成員')+'</div></div></div>';
  buildColors();
}
function switchRP(tab){currentRP=tab;document.querySelectorAll('.rp-tab').forEach(t=>t.classList.remove('act'));document.getElementById('rt-'+tab).classList.add('act');if(tab==='frames')renderFrameList();else if(tab==='tools')renderToolsPanel();}
window.switchRP=switchRP;
// ★★★ INPUT - hDown 核心修正
// 畫圖模式開啟時 draw-canvas 的 pointer-events:all 優先接收，court 收不到事件
// 因此只需要移除 animPlaying 對「放置球員/球」的阻擋
function getPos(e){const r=CV.getBoundingClientRect();const cx=e.touches?e.touches[0].clientX:e.clientX,cy=e.touches?e.touches[0].clientY:e.clientY;const canvasX=(cx-r.left)*(CV.width/r.width),canvasY=(cy-r.top)*(CV.height/r.height);return c2s(canvasX,canvasY);}
function hitTest(pos){const r=PR(),ctrlR=px2s(9),hitR=px2s(12);const f=CF();if(sel&&sel.type==='arr'){const a=f.arrows[sel.arrI];if(a)for(let i=1;i<a.pts.length-1;i++)if(Math.hypot(pos.x-a.pts[i].x,pos.y-a.pts[i].y)<ctrlR)return{type:'ctrl',arrI:sel.arrI,ptI:i};}for(let i=f.players.length-1;i>=0;i--)if(Math.hypot(pos.x-f.players[i].x,pos.y-f.players[i].y)<r+px2s(7))return{type:'ply',i};if(f.ball&&Math.hypot(pos.x-f.ball.x,pos.y-f.ball.y)<px2s(Math.max(10,pSize*.58)+7))return{type:'bal'};for(let i=(f.screens||[]).length-1;i>=0;i--){const s=f.screens[i];if(Math.abs(pos.x-s.x)<r&&Math.abs(pos.y-s.y)<r)return{type:'scr',i};}for(let i=(f.arrows||[]).length-1;i>=0;i--){const a=f.arrows[i];if(!a.pts||a.pts.length<2)continue;for(let j=0;j<a.pts.length-1;j++){const px=a.pts[j].x,py=a.pts[j].y,qx=a.pts[j+1].x,qy=a.pts[j+1].y,dx=qx-px,dy=qy-py,len=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((pos.x-px)*dx+(pos.y-py)*dy)/len));if(Math.hypot(pos.x-(px+t*dx),pos.y-(py+t*dy))<hitR)return{type:'arr',arrI:i};}}return null;}
function showNP(p){pendingP=p;const np=document.getElementById('npw'),ni=document.getElementById('np-n'),nn=document.getElementById('np-num');const r=CV.getBoundingClientRect(),area=document.getElementById('ca'),ar=area.getBoundingClientRect();const cp=s2c(p.x,p.y);let left=cp.x*(r.width/CV.width)+r.left-ar.left+15,top=cp.y*(r.height/CV.height)+r.top-ar.top+15;if(left+190>ar.width)left-=205;if(top+130>ar.height)top-=140;np.style.left=left+'px';np.style.top=top+'px';np.style.display='block';ni.value=p.name||'';nn.value=p.jersey||'';setTimeout(()=>ni.focus(),80);}
function confirmNP(){const v=document.getElementById('np-n').value.trim(),n=document.getElementById('np-num').value.trim();if(pendingP){pendingP.name=v||'';if(n)pendingP.jersey=parseInt(n);}document.getElementById('npw').style.display='none';pendingP=null;render();if(window.__push)window.__push();}
function cancelNP(){document.getElementById('npw').style.display='none';pendingP=null;}
window.confirmNP=confirmNP;window.cancelNP=cancelNP;
document.getElementById('np-n').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('np-num').focus();if(e.key==='Escape')cancelNP();});
document.getElementById('np-num').addEventListener('keydown',e=>{if(e.key==='Enter')confirmNP();if(e.key==='Escape')cancelNP();});
let lpTimer=null;
function hDown(e){
  // ★ 關鍵修正：不再用 animPlaying 封鎖所有操作
  // 畫路線工具才限制（避免播放中亂畫）
  let pos=getPos(e);
  pos=clampToCourt(pos);
  document.getElementById('npw').style.display='none';
  if(tool==='player'){
    snap();
    const p={x:pos.x,y:pos.y,color:col,num:pctr++,name:'',jersey:null};
    if(!CF().players)CF().players=[];
    CF().players.push(p);
    sel={type:'ply',i:CF().players.length-1};
    render();showNP(p);if(window.__push)window.__push();return;
  }
  if(tool==='ball'){snap();CF().ball={x:pos.x,y:pos.y};sel={type:'bal'};render();if(window.__push)window.__push();return;}
  if(tool==='screen'){snap();if(!CF().screens)CF().screens=[];CF().screens.push({x:pos.x,y:pos.y,color:col});sel={type:'scr',i:CF().screens.length-1};render();if(window.__push)window.__push();return;}
  if(tool==='cut'||tool==='pass'||tool==='drib'){
    if(animPlaying)return;// 畫路線時才不允許（避免混亂）
    drawing=true;drawPts=[{x:pos.x,y:pos.y}];return;
  }
  if(tool==='box'){boxSelecting=true;boxStart=pos;boxEnd=pos;selectedPlayers=[];sel=null;clearDragState();render();return;}
  if(tool==='select'){
    const h=hitTest(pos);
    // v5：選取工具同時支援框選。點空白處拖曳即開始框選，不必切換工具。
    if(!h){sel=null;selectedPlayers=[];boxSelecting=true;boxStart=pos;boxEnd=pos;clearDragState();render();return;}
    sel=h;drag=h;dragStartPos=pos;
    if(h.type==='ply'){
      if(selectedPlayers.includes(h.i)){
        drag={type:'group'};
        dragSnapshot=selectedPlayers.map(i=>{const p=CF().players[i];return p?{i,x:p.x,y:p.y}:null;}).filter(Boolean);
      }else{
        selectedPlayers=[];
        dragSnapshot={type:'ply',i:h.i,x:CF().players[h.i].x,y:CF().players[h.i].y};
      }
      lpTimer=setTimeout(()=>{if(drag&&drag.type!=='group')showNP(CF().players[h.i]);lpTimer=null;},500);
    }else if(h.type==='bal'&&CF().ball){
      selectedPlayers=[];dragSnapshot={type:'bal',x:CF().ball.x,y:CF().ball.y};
    }else if(h.type==='scr'){
      selectedPlayers=[];const sc=CF().screens[h.i];dragSnapshot={type:'scr',i:h.i,x:sc.x,y:sc.y};
    }else if(h.type==='arr'){
      selectedPlayers=[];dragSnapshot={type:'arr',arrI:h.arrI,pts:CF().arrows[h.arrI].pts.map(p=>({x:p.x,y:p.y}))};
    }else if(h.type==='ctrl'){
      selectedPlayers=[];const pt=CF().arrows[h.arrI].pts[h.ptI];dragSnapshot={type:'ctrl',arrI:h.arrI,ptI:h.ptI,x:pt.x,y:pt.y};
    }
    dox=pos.x;doy=pos.y;
    render();
  }
}
function hMove(e){
  if(animPlaying&&tool!=='select')return;
  let pos=getPos(e);pos=clampToBoard(pos);if(lpTimer){clearTimeout(lpTimer);lpTimer=null;}
  if((tool==='box'||tool==='select')&&boxSelecting){boxEnd=pos;render();return;}
  if((tool==='cut'||tool==='pass'||tool==='drib')&&drawing){drawPts.push({x:pos.x,y:pos.y});render();return;}
  if(tool==='select'&&drag&&dragStartPos){
    let dx=pos.x-dragStartPos.x,dy=pos.y-dragStartPos.y;
    if(drag.type==='group'&&Array.isArray(dragSnapshot)){
      const lim=clampGroupDelta(dragSnapshot,dx,dy);dx=lim.dx;dy=lim.dy;
      dragSnapshot.forEach(it=>{const p=CF().players[it.i];if(p){p.x=it.x+dx;p.y=it.y+dy;}});
    }else if(drag.type==='ply'&&dragSnapshot){
      const p=CF().players[drag.i],np=clampToCourt({x:dragSnapshot.x+dx,y:dragSnapshot.y+dy});if(p)Object.assign(p,np);
    }else if(drag.type==='bal'&&dragSnapshot&&CF().ball){
      Object.assign(CF().ball,clampToCourt({x:dragSnapshot.x+dx,y:dragSnapshot.y+dy}));
    }else if(drag.type==='scr'&&dragSnapshot){
      const sc=CF().screens[drag.i],np=clampToCourt({x:dragSnapshot.x+dx,y:dragSnapshot.y+dy});if(sc)Object.assign(sc,np);
    }else if(drag.type==='arr'&&dragSnapshot){
      CF().arrows[drag.arrI].pts.forEach((p,i)=>{const o=dragSnapshot.pts[i];if(o){p.x=o.x+dx;p.y=o.y+dy;}});
    }else if(drag.type==='ctrl'&&dragSnapshot){
      const pt=CF().arrows[drag.arrI].pts[drag.ptI];pt.x=dragSnapshot.x+dx;pt.y=dragSnapshot.y+dy;
    }
    render();if(window.__push)window.__push();
  }
}
function hUp(e){
  if(lpTimer){clearTimeout(lpTimer);lpTimer=null;}
  if((tool==='box'||tool==='select')&&boxSelecting){
    boxSelecting=false;
    const x1=Math.min(boxStart.x,boxEnd.x),x2=Math.max(boxStart.x,boxEnd.x),y1=Math.min(boxStart.y,boxEnd.y),y2=Math.max(boxStart.y,boxEnd.y);
    selectedPlayers=[];(CF().players||[]).forEach((p,i)=>{if(p.x>=x1&&p.x<=x2&&p.y>=y1&&p.y<=y2)selectedPlayers.push(i);});
    sel=null;boxStart=null;boxEnd=null;render();return;
  }
  if((tool==='cut'||tool==='pass'||tool==='drib')&&drawing){if(drawPts.length>1&&Math.hypot(drawPts[drawPts.length-1].x-drawPts[0].x,drawPts[drawPts.length-1].y-drawPts[0].y)>px2s(14)){snap();const pts=simplify(drawPts,px2s(3));if(!CF().arrows)CF().arrows=[];CF().arrows.push({pts,style:tool,color:col});sel={type:'arr',arrI:CF().arrows.length-1};if(window.__push)window.__push();}drawing=false;drawPts=[];render();renderFrameList();return;}
  clearDragState();
}
function hDbl(e){if(animPlaying)return;const pos=getPos(e),h=hitTest(pos);if(h&&h.type==='ply')showNP(CF().players[h.i]);if(h&&h.type==='arr'){const a=CF().arrows[h.arrI];let minD=Infinity,bestJ=0;for(let j=0;j<a.pts.length-1;j++){const px=a.pts[j].x,py=a.pts[j].y,qx=a.pts[j+1].x,qy=a.pts[j+1].y,t=Math.max(0,Math.min(1,((pos.x-px)*(qx-px)+(pos.y-py)*(qy-py))/((qx-px)**2+(qy-py)**2||1)));const d=Math.hypot(pos.x-(px+t*(qx-px)),pos.y-(py+t*(qy-py)));if(d<minD){minD=d;bestJ=j;}}a.pts.splice(bestJ+1,0,{x:pos.x,y:pos.y});sel={type:'arr',arrI:h.arrI};render();if(window.__push)window.__push();}}
// v5：改用 Pointer Events，並啟用 pointer capture。
// 好處：滑鼠移動太快離開 canvas 時，仍能收到 move/up，不會造成框選或拖曳漂移。
CV.addEventListener('pointerdown',e=>{e.preventDefault();CV.setPointerCapture?.(e.pointerId);hDown(e);},{passive:false});
CV.addEventListener('pointermove',e=>{if(e.buttons||boxSelecting||drag||drawing){e.preventDefault();hMove(e);}},{passive:false});
CV.addEventListener('pointerup',e=>{e.preventDefault();try{CV.releasePointerCapture?.(e.pointerId);}catch(_e){}hUp(e);},{passive:false});
CV.addEventListener('pointercancel',e=>{try{CV.releasePointerCapture?.(e.pointerId);}catch(_e){}boxSelecting=false;drawing=false;clearDragState();render();},{passive:false});
CV.addEventListener('dblclick',hDbl);
function setTool(t,btn){tool=t;sel=null;drawing=false;drawPts=[];boxSelecting=false;boxStart=null;boxEnd=null;if(t!=='box'&&t!=='select')selectedPlayers=[];document.querySelectorAll('.tb-btn').forEach(b=>b.classList.remove('act'));if(btn)btn.classList.add('act');CV.className=(t==='select'||t==='box')?'c-sel':'c-def';render();}
window.setTool=setTool;
function setCol(c,el){col=c;document.querySelectorAll('.c-sw').forEach(d=>d.classList.remove('act'));el.classList.add('act');}
window.setCol=setCol;
function setPS(v){pSize=parseInt(v);const sv=document.getElementById('sz-val');if(sv)sv.textContent=v;render();}
window.setPS=setPS;
function buildColors(){const row=document.getElementById('color-row');if(!row)return;row.innerHTML='';['#FF5E1A','#2979FF','#00C853','#FFD600','#AA00FF','#FF1744','#aaa'].forEach((c,i)=>{const el=document.createElement('div');el.className='c-sw'+(i===0?' act':'');el.style.background=c;if(i===0)el.style.boxShadow='0 0 0 3px #fff';el.onclick=()=>setCol(c,el);row.appendChild(el);});}
function buildAnnoColors(){const div=document.getElementById('anno-colors');if(!div)return;div.innerHTML='';['#FF5E1A','#FFD600','#00E676','#00D4FF','#fff'].forEach((c,i)=>{const el=document.createElement('div');el.className='anno-color'+(i===0?' act':'');el.style.background=c;el.onclick=()=>{annoColor=c;document.querySelectorAll('.anno-color').forEach(d=>d.classList.remove('act'));el.classList.add('act');};div.appendChild(el);});}
function delSel(){const f=CF();if(selectedPlayers.length){snap();selectedPlayers.sort((a,b)=>b-a).forEach(i=>f.players.splice(i,1));selectedPlayers=[];sel=null;render();renderFrameList();if(window.__push)window.__push();return;}if(!sel)return;snap();if(sel.type==='ply')f.players.splice(sel.i,1);else if(sel.type==='bal')f.ball=null;else if(sel.type==='arr')f.arrows.splice(sel.arrI,1);else if(sel.type==='scr')f.screens.splice(sel.i,1);sel=null;render();if(window.__push)window.__push();}
window.delSel=delSel;
document.addEventListener('keydown',e=>{if(e.key==='Delete'||e.key==='Backspace'){if(['INPUT','TEXTAREA'].includes(document.activeElement&&document.activeElement.tagName))return;delSel();}if((e.ctrlKey||e.metaKey)&&e.key==='z'&&!['INPUT','TEXTAREA'].includes(document.activeElement&&document.activeElement.tagName)){e.preventDefault();undoAct();}});
function snap(){history.push(JSON.parse(JSON.stringify({frames,curFrame,pctr})));if(history.length>30)history.shift();}
function undoAct(){if(!history.length)return;const p=history.pop();frames=p.frames;curFrame=p.curFrame;pctr=p.pctr;render();renderFrameList();if(window.__push)window.__push();}
window.undoAct=undoAct;
function clearCurrentFrame(){snap();CF().players=[];CF().ball=null;CF().arrows=[];CF().screens=[];sel=null;render();renderFrameList();if(window.__push)window.__push();}
window.clearCurrentFrame=clearCurrentFrame;

// LOCAL TACTIC LIBRARY（免費：localStorage，多套自己畫的動畫戰術）
const TACTIC_KEY='hoopboard_local_tactics_v2';
function getLocalTactics(){try{return JSON.parse(localStorage.getItem(TACTIC_KEY)||'[]');}catch(e){return[];}}
function setLocalTactics(list){localStorage.setItem(TACTIC_KEY,JSON.stringify(list));}
function addFrameFromCurrent(){snap();const f=JSON.parse(JSON.stringify(CF()));f.name='Frame '+(frames.length+1)+'（延續）';frames.splice(curFrame+1,0,f);curFrame++;render();renderFrameList();if(window.__push)window.__push();}
window.addFrameFromCurrent=addFrameFromCurrent;
function saveLocalTactic(){const name=prompt('請輸入戰術名稱：','我的動畫戰術 '+new Date().toLocaleDateString('zh-TW'));if(!name)return;const list=getLocalTactics();list.unshift({id:Date.now(),name,frames:JSON.parse(JSON.stringify(frames)),savedAt:new Date().toISOString()});setLocalTactics(list.slice(0,30));alert('已儲存到本機戰術庫：'+name);}
window.saveLocalTactic=saveLocalTactic;
function loadLocalTactic(id){const item=getLocalTactics().find(x=>String(x.id)===String(id));if(!item)return; if(!confirm('載入「'+item.name+'」？目前畫面會被取代。'))return;snap();frames=JSON.parse(JSON.stringify(item.frames));curFrame=0;sel=null;render();renderFrameList();if(window.__push)window.__push();}
window.loadLocalTactic=loadLocalTactic;
function deleteLocalTactic(id){let list=getLocalTactics();const item=list.find(x=>String(x.id)===String(id));if(!item||!confirm('刪除「'+item.name+'」？'))return;list=list.filter(x=>String(x.id)!==String(id));setLocalTactics(list);showTacticLibrary();}
window.deleteLocalTactic=deleteLocalTactic;
function showTacticLibrary(){currentRP='frames';document.querySelectorAll('.rp-tab').forEach(t=>t.classList.remove('act'));document.getElementById('rt-frames').classList.add('act');const body=document.getElementById('rp-body');const list=getLocalTactics();body.innerHTML='<div class="tp-body"><div class="tp-ttl">📂 本機動畫戰術庫</div><div style="font-size:10px;color:var(--t4);line-height:1.7;margin-bottom:10px">免費儲存在此瀏覽器 localStorage；換裝置或清除瀏覽資料後不會保留。</div><div class="tc-grid"><div class="tc-card" onclick="loadAnimT(\'pr_anim\')"><span class="tc-icon">🔄</span><div class="tc-label">Pick&Roll動畫範例</div></div><div class="tc-card" onclick="loadAnimT(\'fastbreak_anim\')"><span class="tc-icon">⚡</span><div class="tc-label">快攻動畫範例</div></div></div><div style="height:10px"></div>'+(list.length?list.map(x=>'<div class="fi" style="padding:9px 10px"><div style="display:flex;align-items:center;gap:8px"><div class="fi-num">'+(x.frames?x.frames.length:0)+'幀</div><div style="flex:1"><div style="font-size:11px;color:var(--t2);font-weight:700">'+esc(x.name)+'</div><div style="font-size:8px;color:var(--t4)">'+new Date(x.savedAt).toLocaleString('zh-TW')+'</div></div><button class="fa-btn" onclick="loadLocalTactic('+x.id+')">載入</button><button class="fa-btn del" onclick="deleteLocalTactic('+x.id+')">✕</button></div></div>').join(''):'<div style="font-size:11px;color:var(--t4);padding:12px;border:1px solid var(--l1);border-radius:8px">尚未儲存戰術。請先畫幾個幀，再按「💾 存本機戰術」。</div>')+'<button class="m-close" style="margin-top:12px" onclick="renderFrameList()">返回幀列表</button></div>';}
window.showTacticLibrary=showTacticLibrary;

// PRESET ANIMATION TACTICS（10套知名/常用戰術動畫）
const PRESET_TACTICS=[
  ['pr_anim','🔄 PnR 擋拆'],['fastbreak_anim','⚡ 快攻反擊'],['motion_anim','♻️ Motion 動態進攻'],['horns_anim','🐂 Horns'],['floppy_anim','🎯 Floppy 射手'],['spain_anim','🇪🇸 Spain PnR'],['zone23_anim','🛡 2-3 區域聯防'],['zone32_anim','🔺 3-2 區域聯防'],['zone131_anim','◇ 1-3-1 區域聯防'],['press_anim','🔥 全場緊迫']
];
function showPresetTactics(){
  currentRP='frames';document.querySelectorAll('.rp-tab').forEach(t=>t.classList.remove('act'));document.getElementById('rt-frames').classList.add('act');
  const body=document.getElementById('rp-body');
  body.innerHTML='<div class="tp-body"><div class="tp-ttl">🎬 10套動畫戰術庫</div><div style="font-size:10px;color:var(--t4);line-height:1.7;margin-bottom:10px">點選後會建立多個幀，可直接按「播放全部幀」。載入會取代目前畫面，建議先儲存自己的戰術。</div><div class="tc-grid">'+PRESET_TACTICS.map(x=>'<div class="tc-card" onclick="loadAnimT(\''+x[0]+'\')"><span class="tc-icon">'+x[1].split(' ')[0]+'</span><div class="tc-label">'+x[1].replace(/^\\S+ /,'')+'</div></div>').join('')+'</div><button class="m-close" style="margin-top:12px" onclick="renderFrameList()">返回幀列表</button></div>';
}
window.showPresetTactics=showPresetTactics;
function clearAnimationFrames(){ if(!confirm('清除所有動畫幀，保留一個空白幀？'))return; snap(); frames=[{name:'Frame 1',players:[],ball:null,arrows:[],screens:[]}];curFrame=0;selectedPlayers=[];sel=null;render();renderFrameList();if(window.__push)window.__push(); }
window.clearAnimationFrames=clearAnimationFrames;

function makeFrame(name, arr, ballIndex=null, color='#FF5E1A', arrows=[], screens=[]){
  const px=(fx,fy)=>({x:COURT_X+COURT_W*fx,y:COURT_Y+COURT_H*fy});
  const names=['PG','SG','SF','PF','C'];
  return {name,players:arr.map((a,i)=>({...px(a[0],a[1]),color,num:i+1,name:names[i],jersey:i+1})),ball:ballIndex==null?null:{...px(arr[ballIndex][0],arr[ballIndex][1])},arrows:arrows.map(ar=>({pts:ar.pts.map(p=>px(p[0],p[1])),style:ar.style||'cut',color:ar.color||'#FFD600'})),screens:screens.map(p=>({...px(p[0],p[1]),color}))};
}
// TACTICS

function loadAnimT(n){
  if(!confirm('載入動畫範例會取代目前所有幀，是否繼續？'))return;
  snap();
  const A={
    pr_anim:[
      makeFrame('PnR 01 站位',[[.62,.50],[.22,.16],[.22,.84],[.14,.32],[.48,.50]],0,'#2979FF',[],[[.50,.50]]),
      makeFrame('PnR 02 擋拆啟動',[[.52,.50],[.22,.16],[.22,.84],[.14,.32],[.46,.50]],0,'#2979FF',[{pts:[[.62,.50],[.56,.50],[.52,.50]],style:'drib'}],[[.49,.50]]),
      makeFrame('PnR 03 順下傳球',[[.40,.45],[.18,.14],[.18,.86],[.12,.32],[.24,.34]],4,'#2979FF',[{pts:[[.40,.45],[.32,.40],[.24,.34]],style:'pass'},{pts:[[.46,.50],[.34,.42],[.24,.34]],style:'cut',color:'#2979FF'}],[])
    ],
    fastbreak_anim:[
      makeFrame('快攻 01 發動',[[.82,.50],[.68,.20],[.68,.80],[.55,.35],[.55,.65]],0),
      makeFrame('快攻 02 推進',[[.60,.50],[.42,.16],[.42,.84],[.38,.38],[.38,.62]],0,'#FF5E1A',[{pts:[[.82,.50],[.70,.50],[.60,.50]],style:'drib'}]),
      makeFrame('快攻 03 分球上籃',[[.42,.50],[.18,.18],[.18,.82],[.22,.38],[.22,.62]],1,'#FF5E1A',[{pts:[[.42,.50],[.30,.34],[.18,.18]],style:'pass'}])
    ],
    motion_anim:[
      makeFrame('Motion 01 五外站位',[[.55,.50],[.28,.12],[.28,.88],[.12,.25],[.12,.75]],0,'#00C853'),
      makeFrame('Motion 02 交叉空切',[[.45,.50],[.20,.28],[.20,.72],[.26,.12],[.26,.88]],0,'#00C853',[{pts:[[.28,.12],[.22,.22],[.20,.28]],style:'cut'},{pts:[[.28,.88],[.22,.78],[.20,.72]],style:'cut'}]),
      makeFrame('Motion 03 弱邊補位',[[.36,.50],[.13,.25],[.13,.75],[.30,.18],[.30,.82]],0,'#00C853')
    ],
    horns_anim:[
      makeFrame('Horns 01 牛角站位',[[.56,.50],[.14,.12],[.14,.88],[.36,.34],[.36,.66]],0,'#FF5E1A',[],[[.37,.34],[.37,.66]]),
      makeFrame('Horns 02 使用左擋',[[.46,.42],[.14,.12],[.14,.88],[.30,.30],[.38,.66]],0,'#FF5E1A',[{pts:[[.56,.50],[.50,.45],[.46,.42]],style:'drib'}],[[.35,.34]]),
      makeFrame('Horns 03 高低傳導',[[.36,.38],[.14,.12],[.14,.88],[.22,.24],[.32,.60]],3,'#FF5E1A',[{pts:[[.36,.38],[.28,.30],[.22,.24]],style:'pass'}])
    ],
    floppy_anim:[
      makeFrame('Floppy 01 射手起點',[[.48,.50],[.10,.50],[.18,.32],[.18,.68],[.34,.50]],0,'#AA00FF',[],[[.20,.32],[.20,.68]]),
      makeFrame('Floppy 02 射手繞出',[[.44,.50],[.30,.20],[.18,.32],[.18,.68],[.34,.50]],0,'#AA00FF',[{pts:[[.10,.50],[.18,.36],[.30,.20]],style:'cut',color:'#AA00FF'}],[[.20,.32]]),
      makeFrame('Floppy 03 接球投籃',[[.38,.50],[.18,.12],[.18,.32],[.18,.68],[.34,.50]],1,'#AA00FF',[{pts:[[.38,.50],[.28,.28],[.18,.12]],style:'pass'}])
    ],
    spain_anim:[
      makeFrame('Spain 01 高位擋拆',[[.60,.50],[.26,.18],[.26,.82],[.40,.50],[.48,.50]],0,'#00BCD4',[],[[.49,.50]]),
      makeFrame('Spain 02 後擋掩護',[[.50,.48],[.30,.38],[.26,.82],[.34,.44],[.40,.38]],0,'#00BCD4',[{pts:[[.60,.50],[.54,.50],[.50,.48]],style:'drib'}],[[.39,.42]]),
      makeFrame('Spain 03 中鋒順下',[[.40,.45],[.18,.28],[.24,.82],[.30,.56],[.22,.34]],4,'#00BCD4',[{pts:[[.40,.45],[.30,.38],[.22,.34]],style:'pass'}])
    ],
    zone23_anim:[
      makeFrame('2-3 區域 01 基本站位',[[.46,.40],[.46,.60],[.22,.24],[.16,.50],[.22,.76]],null,'#aaa'),
      makeFrame('2-3 區域 02 球到側翼',[[.40,.30],[.48,.55],[.17,.20],[.14,.50],[.24,.74]],null,'#aaa',[{pts:[[.46,.40],[.40,.30]],style:'cut',color:'#FFD600'}]),
      makeFrame('2-3 區域 03 底角輪轉',[[.38,.35],[.45,.58],[.14,.26],[.12,.48],[.16,.82]],null,'#aaa')
    ],
    zone32_anim:[
      makeFrame('3-2 區域 01 基本站位',[[.48,.50],[.36,.25],[.36,.75],[.16,.34],[.16,.66]],null,'#FFD600'),
      makeFrame('3-2 區域 02 壓外線',[[.44,.50],[.30,.20],[.38,.80],[.14,.34],[.18,.70]],null,'#FFD600'),
      makeFrame('3-2 區域 03 弱邊收縮',[[.40,.48],[.28,.22],[.34,.72],[.12,.42],[.16,.66]],null,'#FFD600')
    ],
    zone131_anim:[
      makeFrame('1-3-1 區域 01 基本站位',[[.50,.50],[.34,.24],[.34,.50],[.34,.76],[.14,.50]],null,'#FF1744'),
      makeFrame('1-3-1 區域 02 夾邊線',[[.42,.35],[.26,.22],[.32,.48],[.36,.72],[.12,.54]],null,'#FF1744'),
      makeFrame('1-3-1 區域 03 底線補防',[[.40,.38],[.24,.24],[.30,.50],[.28,.78],[.10,.66]],null,'#FF1744')
    ],
    press_anim:[
      makeFrame('全場緊迫 01 對位',[[.72,.22],[.72,.78],[.56,.50],[.42,.32],[.42,.68]],null,'#FFD600'),
      makeFrame('全場緊迫 02 邊線夾擊',[[.62,.20],[.66,.36],[.50,.52],[.36,.34],[.40,.70]],null,'#FFD600',[{pts:[[.72,.22],[.62,.20]],style:'cut'}]),
      makeFrame('全場緊迫 03 中線補位',[[.54,.24],[.58,.38],[.44,.52],[.30,.36],[.34,.68]],null,'#FFD600')
    ]
  };
  frames=JSON.parse(JSON.stringify(A[n]||A.pr_anim));curFrame=0;sel=null;selectedPlayers=[];pctr=6;render();renderFrameList();if(window.__push)window.__push();setTimeout(()=>{try{playAll();}catch(e){console.error('playAll error',e);alert('動畫播放錯誤：'+e.message);}},120);
}
window.loadAnimT=loadAnimT;

function loadT(n){snap();const f=CF();
// px(fx,fy): 分數座標 → SVG pixel
// fx/fy 是場地本體（2800×1500）的比例，原點 (100,100)
const px=(fx,fy)=>({x: COURT_X + COURT_W*fx, y: COURT_Y + COURT_H*fy});
if(n==='fb'){f.players=[{...px(.09,.5),color:'#FF5E1A',num:pctr++,name:'PG',jersey:1},{...px(.39,.18),color:'#FF5E1A',num:pctr++,name:'SF',jersey:3},{...px(.39,.82),color:'#FF5E1A',num:pctr++,name:'SG',jersey:2},{...px(.59,.28),color:'#FF5E1A',num:pctr++,name:'PF',jersey:4},{...px(.59,.72),color:'#FF5E1A',num:pctr++,name:'C',jersey:5}];f.ball={...px(.09,.5)};f.arrows=[{pts:[px(.09,.5),px(.24,.34),px(.39,.18)],style:'pass',color:'#FFD600'},{pts:[px(.39,.18),px(.28,.12),px(.18,.08)],style:'cut',color:'#FF5E1A'},{pts:[px(.39,.82),px(.28,.88),px(.18,.92)],style:'cut',color:'#FF5E1A'}];f.screens=[];}
else if(n==='pr'){f.players=[{...px(.50,.5),color:'#2979FF',num:pctr++,name:'PG',jersey:1},{...px(.38,.5),color:'#2979FF',num:pctr++,name:'C',jersey:5},{...px(.26,.14),color:'#2979FF',num:pctr++,name:'SF',jersey:3},{...px(.26,.86),color:'#2979FF',num:pctr++,name:'SG',jersey:2},{...px(.14,.3),color:'#2979FF',num:pctr++,name:'PF',jersey:4}];f.ball={...px(.50,.5)};f.arrows=[{pts:[px(.50,.5),px(.44,.5),px(.40,.5)],style:'drib',color:'#FFD600'},{pts:[px(.38,.5),px(.32,.35),px(.27,.22)],style:'cut',color:'#2979FF'},{pts:[px(.40,.5),px(.34,.44),px(.20,.38)],style:'cut',color:'#2979FF'}];f.screens=[{...px(.37,.5),color:'#2979FF'}];}
else if(n==='z23'){f.players=[{...px(.44,.5),color:'#aaa',num:pctr++,name:'PG'},{...px(.27,.25),color:'#aaa',num:pctr++,name:'SF'},{...px(.27,.75),color:'#aaa',num:pctr++,name:'SG'},{...px(.12,.12),color:'#aaa',num:pctr++,name:'PF'},{...px(.12,.88),color:'#aaa',num:pctr++,name:'C'}];f.ball=null;f.arrows=[];f.screens=[];}
else if(n==='box'){f.players=[{...px(.39,.5),color:'#00C853',num:pctr++,name:'PG',jersey:1},{...px(.20,.22),color:'#00C853',num:pctr++,name:'SG',jersey:2},{...px(.20,.78),color:'#00C853',num:pctr++,name:'SF',jersey:3},{...px(.10,.22),color:'#00C853',num:pctr++,name:'PF',jersey:4},{...px(.10,.78),color:'#00C853',num:pctr++,name:'C',jersey:5}];f.ball={...px(.39,.5)};f.arrows=[];f.screens=[];}
else if(n==='press'){f.players=[{...px(.61,.22),color:'#FFD600',num:pctr++,name:'',jersey:1},{...px(.61,.78),color:'#FFD600',num:pctr++,name:'',jersey:2},{...px(.43,.5),color:'#FFD600',num:pctr++,name:'',jersey:3},{...px(.29,.33),color:'#FFD600',num:pctr++,name:'',jersey:4},{...px(.29,.67),color:'#FFD600',num:pctr++,name:'',jersey:5}];f.ball=null;f.arrows=[];f.screens=[];}
else if(n==='iso'){f.players=[{...px(.43,.5),color:'#AA00FF',num:pctr++,name:'PG',jersey:1},{...px(.18,.1),color:'#AA00FF',num:pctr++,name:'',jersey:2},{...px(.18,.9),color:'#AA00FF',num:pctr++,name:'',jersey:3},{...px(.08,.2),color:'#AA00FF',num:pctr++,name:'',jersey:4},{...px(.08,.8),color:'#AA00FF',num:pctr++,name:'',jersey:5}];f.ball={...px(.43,.5)};f.arrows=[];f.screens=[];}
else if(n==='horns'){f.players=[{...px(.47,.5),color:'#FF5E1A',num:pctr++,name:'PG',jersey:1},{...px(.30,.3),color:'#FF5E1A',num:pctr++,name:'PF',jersey:4},{...px(.30,.7),color:'#FF5E1A',num:pctr++,name:'C',jersey:5},{...px(.14,.12),color:'#FF5E1A',num:pctr++,name:'SF',jersey:2},{...px(.14,.88),color:'#FF5E1A',num:pctr++,name:'SG',jersey:3}];f.ball={...px(.47,.5)};f.arrows=[];f.screens=[];}
render();renderFrameList();if(window.__push)window.__push();}
window.loadT=loadT;
async function exportImg(){
  // 匯出時要合成 SVG 球場 + Canvas 球員戰術 + 標註層；舊版只匯出 canvas，會缺少球場底圖。
  try{
    const svgEl=document.getElementById('court-svg');
    const svgText=new XMLSerializer().serializeToString(svgEl);
    const svgBlob=new Blob([svgText],{type:'image/svg+xml;charset=utf-8'});
    const url=URL.createObjectURL(svgBlob);
    const img=new Image();
    img.onload=()=>{
      const out=document.createElement('canvas');out.width=CW;out.height=CH;
      const ctx=out.getContext('2d');
      ctx.drawImage(img,0,0,CW,CH);
      ctx.drawImage(CV,0,0,CW,CH);
      const dc=document.getElementById('draw-canvas');
      ctx.drawImage(dc,0,0,CW,CH);
      URL.revokeObjectURL(url);
      const a=document.createElement('a');a.download='hoopboard.png';a.href=out.toDataURL('image/png');a.click();
    };
    img.onerror=()=>{URL.revokeObjectURL(url);throw new Error('SVG 匯出失敗');};
    img.src=url;
  }catch(e){
    console.error(e);
    const a=document.createElement('a');a.download='hoopboard-canvas-only.png';a.href=CV.toDataURL('image/png');a.click();
  }
}
window.exportImg=exportImg;
function buildStickers(){const strip=document.getElementById('stk-strip');if(!strip)return;['🏀','🔥','👍','❤️','😂','🎯','⚡','💪','🏆','✅'].forEach(s=>{const b=document.createElement('button');b.className='stk-btn';b.textContent=s;b.onclick=()=>window.sendStk&&window.sendStk(s);strip.appendChild(b);});}
function initUI(){switchRP('frames');document.querySelectorAll('.tb-btn').forEach(b=>b.classList.remove('act'));document.getElementById('tb-sel').classList.add('act');buildAnnoColors();}
window.addEventListener('resize',()=>{clearTimeout(window._rt);window._rt=setTimeout(()=>{initCourtDims();render();renderFrameList();redrawAnno(annoStrokes);},100);});
window.addEventListener('load',()=>{initCourtDims();initUI();buildStickers();render();});
