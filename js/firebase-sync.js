// HoopBoard Firebase / collaboration layer.
import{initializeApp}from'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import{getDatabase,ref,set,push,onValue,onChildAdded,onDisconnect,serverTimestamp,query,limitToLast,get,remove}from'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
const lerp = window.__hbLerp || function(a,b,t){ return a + (b - a) * t; };
const FC={apiKey:"AIzaSyAd5oCNcMUiY3G1tV8djs03Ig83DeRKrqk",authDomain:"basketball-tactics.firebaseapp.com",databaseURL:"https://basketball-tactics-default-rtdb.firebaseio.com",projectId:"basketball-tactics",storageBucket:"basketball-tactics.firebasestorage.app",messagingSenderId:"342499390591",appId:"1:342499390591:web:055c4443ca8400283efb4a"};
const AVC=['#FF5E1A','#2979FF','#00C853','#FFD600','#AA00FF','#FF1744','#00BCD4'];
let db,roomId,myName,myId,remoteUpd=false,unreadN=0;
window.__isHost=false;
try{const app=initializeApp(FC);db=getDatabase(app);document.getElementById('fb-st').textContent='✅ Firebase 連線成功';document.getElementById('fb-st').style.color='var(--gn)';}
catch(e){document.getElementById('fb-st').textContent='❌ '+e.message;document.getElementById('fb-st').style.color='var(--rd)';}
function genId(){const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<3;i++)s+=c[~~(Math.random()*c.length)];s+='-';for(let i=0;i<3;i++)s+=c[~~(Math.random()*c.length)];return s;}
window.createRoom=()=>{const n=document.getElementById('su-n').value.trim();if(!n){alert('請輸入名稱！');return;}roomId=genId();myName=n;myId=Date.now().toString(36)+Math.random().toString(36).slice(2,5);window.__isHost=true;go();};
window.showJoin=()=>document.getElementById('join-area').style.display='block';
window.joinRoom=()=>{const n=document.getElementById('su-n').value.trim(),c=document.getElementById('su-c').value.trim().toUpperCase();if(!n||!c){alert('請輸入名稱和代碼！');return;}roomId=c;myName=n;myId=Date.now().toString(36)+Math.random().toString(36).slice(2,5);window.__isHost=false;go();};
const urlRoom=new URLSearchParams(location.search).get('room');
if(urlRoom){document.getElementById('su-c').value=urlRoom;document.getElementById('join-area').style.display='block';}
function go(){
  document.getElementById('su-ov').style.display='none';
  document.getElementById('app').style.display='flex';
  document.getElementById('rc').textContent=roomId;
  document.getElementById('share-link').value=location.origin+location.pathname+'?room='+roomId;
  initCourtDims();initUI();buildStickers();render();
  if(!db){document.getElementById('sync-txt').textContent='⚠️ 單機模式';document.getElementById('sync-pill').classList.add('off');return;}
  const myColor=AVC[~~(Math.random()*AVC.length)];
  const presRef=ref(db,'rooms/'+roomId+'/presence/'+myId);
  set(presRef,{name:myName,color:myColor,isHost:window.__isHost,ts:serverTimestamp()});
  onDisconnect(presRef).remove();
  onValue(ref(db,'rooms/'+roomId+'/presence'),snap=>{const users=Object.values(snap.val()||{});document.getElementById('on-n').textContent=users.length+'人';window.__users=users;});
  onValue(ref(db,'rooms/'+roomId+'/state'),snap=>{const d=snap.val();if(!d)return;remoteUpd=true;if(Array.isArray(d.frames))frames=d.frames;curFrame=Math.min(curFrame,frames.length-1);remoteUpd=false;render();renderFrameList();});
  onValue(ref(db,'rooms/'+roomId+'/broadcast'),snap=>{const d=snap.val();if(!d){hideBcast();return;}handleBcast(d);});
  onValue(ref(db,'rooms/'+roomId+'/anno'),snap=>{const d=snap.val();if(!d||!d.strokes){clearDC();return;}redrawAnno(d.strokes);});
  let fl=true;
  onChildAdded(query(ref(db,'rooms/'+roomId+'/chat'),limitToLast(80)),snap=>{const m=snap.val();if(!m)return;appendMsg(m,snap.key,fl);if(fl)return;if(m.uid!==myId){unreadN++;const b=document.getElementById('chat-unread');if(b){b.textContent=unreadN;b.style.display='inline-block';}}});
  setTimeout(()=>fl=false,1500);
  document.getElementById('chat-inp').addEventListener('focus',()=>{unreadN=0;const b=document.getElementById('chat-unread');if(b)b.style.display='none';});
  onValue(ref(db,'rooms/'+roomId+'/likes'),snap=>{const data=snap.val()||{};document.querySelectorAll('.like-btn').forEach(btn=>{const mk=btn.dataset.mk,em=btn.dataset.em;if(!mk||!em)return;const cnt=data[mk]?data[mk][em]?Object.keys(data[mk][em]).length:0:0;btn.textContent=em+(cnt>0?' '+cnt:'');btn.classList.toggle('liked',!!(data[mk]&&data[mk][em]&&data[mk][em][myId]));});});
  document.getElementById('sync-txt').textContent='即時同步中';
  sysMsg(myName+' 加入了房間 🏀');
}
// BROADCAST
window.__bcastOn=false;
window.startBcast=()=>{if(!db||!window.__isHost)return;window.__bcastOn=true;const bb=document.getElementById('bcast-main-btn');if(bb){bb.className='bcast-main-btn live';bb.textContent='📡 廣播中（點擊結束）';}set(ref(db,'rooms/'+roomId+'/broadcast'),{on:true,animT:0,playing:false,frameCount:frames.length,hostId:myId,startedAt:Date.now()});document.getElementById('anim-bar').classList.add('show');sysMsg(myName+' 開始廣播 📡');setTimeout(()=>{if(window.__bcastOn&&window.playAll)window.playAll();},80);};
window.stopBcast=()=>{if(!db||!window.__isHost)return;window.__bcastOn=false;stopAnim(false);set(ref(db,'rooms/'+roomId+'/broadcast'),null);set(ref(db,'rooms/'+roomId+'/anno'),null);const bb=document.getElementById('bcast-main-btn');if(bb){bb.className='bcast-main-btn idle';bb.textContent='📡 開始廣播並播放';}document.getElementById('anim-bar').classList.remove('show');hideBcast();clearDC();sysMsg(myName+' 結束廣播');};
window.toggleBcast=()=>{if(window.__bcastOn)window.stopBcast();else window.startBcast();};
window.__pushBcast=(t,playing)=>{if(!db||!window.__isHost||!window.__bcastOn)return;set(ref(db,'rooms/'+roomId+'/broadcast'),{on:true,animT:t,playing,frameCount:frames.length,hostId:myId,curFrame});};
function handleBcast(d){if(!d||!d.on){hideBcast();return;}showBcast();const prog=Math.round((d.animT||0)*100);document.getElementById('bcast-fill').style.width=prog+'%';const fi=Math.min(Math.floor((d.animT||0)*(d.frameCount-1)),d.frameCount-2);document.getElementById('bcast-frame-info').textContent='幀'+(fi+1)+'/'+d.frameCount;document.getElementById('bcast-label').textContent=d.playing?'▶ 播放中':'⏸ 暫停中';if(!window.__isHost&&d.playing)renderBcastFrame(d.animT||0,d.frameCount);}
function renderBcastFrame(t,fc){const total=Math.min(fc,frames.length);if(total<2)return;const p=t*(total-1),fi=Math.min(Math.floor(p),total-2),frac=p-fi;const f0=frames[fi],f1=frames[fi+1];if(!f0||!f1)return;const maxP=Math.max(f0.players.length,f1.players.length);const intP=[];for(let i=0;i<maxP;i++){const p0=f0.players[i],p1=f1.players[i];if(p0&&p1)intP.push({...p0,x:lerp(p0.x,p1.x,frac),y:lerp(p0.y,p1.y,frac)});else if(p0)intP.push({...p0});else if(p1)intP.push({...p1});}const intBall=f0.ball&&f1.ball?{...f0.ball,x:lerp(f0.ball.x,f1.ball.x,frac),y:lerp(f0.ball.y,f1.ball.y,frac)}:f0.ball;ct.clearRect(0,0,CW,CH);renderFrameData({...f0,players:intP,ball:intBall});}
function showBcast(){document.getElementById('bcast-pill').classList.add('show');}
function hideBcast(){document.getElementById('bcast-pill').classList.remove('show');}
window.sendReaction=(e)=>{if(!db)return;push(ref(db,'rooms/'+roomId+'/chat'),{uid:myId,name:myName,text:e+' '+myName,type:'react',ts:Date.now()});};
window.sendPauseRequest=()=>{if(!db)return;push(ref(db,'rooms/'+roomId+'/chat'),{uid:myId,name:myName,text:'✋ '+myName+' 要求暫停',type:'pause',ts:Date.now()});};
// ANNOTATION
let annoStrokes=[],annoDrawing=false,annoCurPts=[];
let annoColor='#FF5E1A',annoTool='pen',annoOn=false;
// ★★★ toggleAnno: 任何時候都可呼叫，與 animPlaying 完全無關
window.toggleAnno=()=>{
  annoOn=!annoOn;
  const fab=document.getElementById('anno-fab'),dc=document.getElementById('draw-canvas'),bar=document.getElementById('anno-bar');
  if(annoOn){fab.classList.add('on');fab.title='關閉畫圖（再按一次）';dc.classList.add('draw-on');bar.classList.add('show');}
  else{fab.classList.remove('on');fab.title='開啟畫圖討論';dc.classList.remove('draw-on');bar.classList.remove('show');}
};
window.setAnnoTool=(t,btn)=>{annoTool=t;document.querySelectorAll('.anno-btn').forEach(b=>b.classList.remove('act'));btn.classList.add('act');};
window.clearAnno=()=>{annoStrokes=[];clearDC();if(db)set(ref(db,'rooms/'+roomId+'/anno'),{strokes:[]});};
function pushAnno(){if(!db||!window.__isHost)return;set(ref(db,'rooms/'+roomId+'/anno'),{strokes:annoStrokes,ts:Date.now()});}
function clearDC(){const dc=document.getElementById('draw-canvas');dc.getContext('2d').clearRect(0,0,dc.width,dc.height);}
function redrawAnno(strokes){const dc=document.getElementById('draw-canvas');const ctx=dc.getContext('2d');ctx.clearRect(0,0,dc.width,dc.height);(strokes||[]).forEach(s=>{if(!s.pts||s.pts.length<2)return;ctx.save();ctx.strokeStyle=s.color||'#FF5E1A';ctx.lineWidth=s.width||3;ctx.lineCap='round';ctx.lineJoin='round';ctx.shadowColor=s.color;ctx.shadowBlur=4;ctx.beginPath();ctx.moveTo(s.pts[0].x,s.pts[0].y);for(let i=1;i<s.pts.length;i++)ctx.lineTo(s.pts[i].x,s.pts[i].y);ctx.stroke();if(s.arrow&&s.pts.length>=2){const n=s.pts.length,ex=s.pts[n-1].x,ey=s.pts[n-1].y,px=s.pts[n-2].x,py=s.pts[n-2].y;const ang=Math.atan2(ey-py,ex-px),h=14;ctx.fillStyle=s.color;ctx.beginPath();ctx.moveTo(ex,ey);ctx.lineTo(ex-h*Math.cos(ang-.42),ey-h*Math.sin(ang-.42));ctx.lineTo(ex-h*Math.cos(ang+.42),ey-h*Math.sin(ang+.42));ctx.closePath();ctx.fill();}ctx.restore();});}
const DC=document.getElementById('draw-canvas');
function getDCPos(e){const r=DC.getBoundingClientRect();const cx=e.touches?e.touches[0].clientX:e.clientX,cy=e.touches?e.touches[0].clientY:e.clientY;return{x:(cx-r.left)*(DC.width/r.width),y:(cy-r.top)*(DC.height/r.height)};}
DC.addEventListener('mousedown',e=>{if(!annoOn)return;annoDrawing=true;const pos=getDCPos(e);annoCurPts=[{x:pos.x,y:pos.y}];});
DC.addEventListener('mousemove',e=>{if(!annoDrawing||!annoOn)return;const pos=getDCPos(e);annoCurPts.push({x:pos.x,y:pos.y});redrawAnno([...annoStrokes,{color:annoColor,width:3,pts:annoCurPts,arrow:annoTool==='arrow'}]);});
DC.addEventListener('mouseup',e=>{if(!annoDrawing||!annoOn)return;annoDrawing=false;if(annoCurPts.length>1){annoStrokes.push({color:annoColor,width:3,pts:[...annoCurPts],arrow:annoTool==='arrow'});pushAnno();}annoCurPts=[];});
DC.addEventListener('touchstart',e=>{e.preventDefault();if(!annoOn)return;annoDrawing=true;const pos=getDCPos(e);annoCurPts=[{x:pos.x,y:pos.y}];},{passive:false});
DC.addEventListener('touchmove',e=>{e.preventDefault();if(!annoDrawing||!annoOn)return;const pos=getDCPos(e);annoCurPts.push({x:pos.x,y:pos.y});redrawAnno([...annoStrokes,{color:annoColor,width:3,pts:annoCurPts,arrow:annoTool==='arrow'}]);},{passive:false});
DC.addEventListener('touchend',e=>{e.preventDefault();if(!annoDrawing||!annoOn)return;annoDrawing=false;if(annoCurPts.length>1){annoStrokes.push({color:annoColor,width:3,pts:[...annoCurPts],arrow:annoTool==='arrow'});pushAnno();}annoCurPts=[];},{passive:false});
// CHAT
window.sendMsg=()=>{const inp=document.getElementById('chat-inp'),t=inp.value.trim();if(!t||!db)return;inp.value='';push(ref(db,'rooms/'+roomId+'/chat'),{uid:myId,name:myName,text:t,type:'text',ts:Date.now()});};
window.sendStk=s=>{if(!db)return;push(ref(db,'rooms/'+roomId+'/chat'),{uid:myId,name:myName,text:s,type:'stk',ts:Date.now()});};
window.toggleLike=(mk,em)=>{if(!db)return;const lr=ref(db,'rooms/'+roomId+'/likes/'+mk+'/'+em+'/'+myId);get(lr).then(s=>{s.exists()?remove(lr):set(lr,true);});};
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&document.getElementById('chat-inp')===document.activeElement)window.sendMsg();});
function sysMsg(t){if(!db)return;push(ref(db,'rooms/'+roomId+'/chat'),{uid:'__sys__',text:t,type:'sys',ts:Date.now()});}
const AVC2=['#FF5E1A','#2979FF','#00C853','#FFD600','#AA00FF','#FF1744','#00BCD4'];
function appendMsg(m,key,silent){const box=document.getElementById('chat-msgs');if(!box)return;const el=document.createElement('div');if(m.type==='sys'||m.uid==='__sys__'){el.className='msg-sys';el.textContent=m.text;}else if(m.type==='react'){el.className='msg-react';el.textContent=m.text;}else if(m.type==='pause'){el.className='msg-pause';el.textContent=m.text;}else{const me=m.uid===myId,t=new Date(m.ts).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'});const body=m.type==='stk'?'<div class="msg-stk">'+m.text+'</div>':'<div class="msg-body'+(me?' mine':'')+'">'+esc(m.text)+'</div>';const lks=['👍','❤️','😂'].map(e=>'<button class="like-btn" data-mk="'+key+'" data-em="'+e+'" onclick="toggleLike(\''+key+'\',\''+e+'\')">'+e+'</button>').join('');el.className='msg';el.innerHTML='<div class="msg-top"><div class="msg-av" style="background:'+AVC2[m.name?m.name.charCodeAt(0)%AVC2.length:0]+'">'+((m.name||'?')[0])+'</div><span class="msg-who'+(me?' me':'')+'">'+( m.name||'?')+'</span><span class="msg-when">'+t+'</span></div>'+body+'<div class="msg-likes">'+lks+'</div>';}box.appendChild(el);if(!silent)box.scrollTop=box.scrollHeight;}
function esc(t){return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
let pushT=null;
window.__push=()=>{if(remoteUpd||!db)return;clearTimeout(pushT);pushT=setTimeout(()=>set(ref(db,'rooms/'+roomId+'/state'),{frames,by:myName,ts:serverTimestamp()}),80);};
window.saveTactic=()=>{if(!db){alert('單機模式無法儲存');return;}const n=prompt('戰術名稱：','新戰術')||'新戰術';set(ref(db,'rooms/'+roomId+'/tactics/'+Date.now()),{name:n,frames,savedBy:myName});alert('✅「'+n+'」已儲存！');};
window.copyLink=()=>{navigator.clipboard?.writeText(document.getElementById('share-link').value).catch(()=>{});const b=document.querySelector('.m-copy');if(b){b.textContent='✓ 已複製';setTimeout(()=>b.textContent='複製',2000);}};
window.shareLine=()=>window.open('https://line.me/R/msg/text/?'+encodeURIComponent(document.getElementById('share-link').value));
