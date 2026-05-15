<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<title>HoopBoard Pro</title>
<link rel="stylesheet" href="./style.css"/>
</head>
<body>

<div class="su-ov" id="su-ov">
  <div class="su-box">
    <div class="su-logo">
      <div class="su-icon">🏀</div>
      <div><div class="su-title">HOOP<span>BOARD</span></div><div class="su-sub">Pro Tactics Editor</div></div>
    </div>
    <p class="su-desc">選擇你的身份：<br>• <b>建立新房間</b> — 產生連結分享給隊友<br>• <b>加入房間</b> — 輸入教練的代碼</p>
    <input class="s-inp" id="su-n" placeholder="你的名稱（例：教練、彥）" maxlength="10" autocomplete="off"/>
    <div class="s-row">
      <button class="s-btn s-pri" onclick="createRoom()">🆕 建立房間</button>
      <button class="s-btn s-sec" onclick="showJoin()">🔗 加入</button>
    </div>
    <div id="join-area" style="display:none;margin-bottom:10px">
      <input class="s-inp" id="su-c" placeholder="房間代碼（例：ATK-7X2）" maxlength="10" style="text-transform:uppercase;margin-bottom:8px" autocomplete="off"/>
      <button class="s-btn s-pri" onclick="joinRoom()" style="width:100%">✅ 加入房間</button>
    </div>
    <div class="s-note">🔒 Firebase 即時同步<br><span id="fb-st" style="color:var(--e2)">⏳ 連線中...</span></div>
  </div>
</div>

<div id="app" style="display:none">
<header>
  <div class="logo">
    <div class="logo-icon">🏀</div>
    <div style="display:flex;flex-direction:column;line-height:1">
      <div class="logo-name">HOOP<b>BOARD</b></div>
      <div class="logo-tag">Pro Tactics</div>
    </div>
  </div>
  <div class="room-pill" onclick="document.getElementById('share-modal').classList.add('show')">
    <div style="display:flex;align-items:center;gap:4px"><div class="live-dot"></div><span class="live-label">Live</span></div>
    <span class="room-code" id="rc">------</span>
    <span class="room-users" id="on-n">0人</span>
  </div>
  <div class="h-acts">
    <button class="h-btn" onclick="undoAct()">↩</button>
    <button class="h-btn" onclick="exportImg()">📸</button>
    <button class="h-btn" onclick="document.getElementById('share-modal').classList.add('show')">🔗</button>
    <button class="h-btn energy" onclick="saveTactic()">💾</button>
  </div>
</header>

<div class="main">
  <div class="court-wrap" id="ca">
    <div id="court-preset-panel" class="court-preset-panel">
      <span class="court-preset-title">場地</span>
      <select id="court-spec-select" aria-label="球場規格">
        <option value="fiba">FIBA 28×15m</option>
        <option value="nba">NBA 94×50ft</option>
        <option value="ncaa">NCAA 94×50ft</option>
        <option value="half">半場訓練</option>
      </select>
      <select id="court-theme-select" aria-label="球場風格">
        <option value="wood">經典木地板</option>
        <option value="proDark">NBA 暗色風</option>
        <option value="purpleGold">紫金風</option>
        <option value="blueGold">藍金風</option>
        <option value="street">街頭水泥</option>
      </select>
      <button id="court-check-btn" type="button">檢查</button>
    </div>
    <div class="court-cw" id="court-cw-el">
      <!-- ★ SVG 球場底圖（viewBox 0 0 3000 1700，含 1m=100px 邊界）-->
      <!-- 球場本體 2800×1500，四邊各 100px 邊界 -->
      <svg id="court-svg" viewBox="0 0 3000 1700" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <!-- 木地板漸層 -->
          <linearGradient id="floor-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stop-color="#8B5E2A"/>
            <stop offset="35%"  stop-color="#A0703A"/>
            <stop offset="50%"  stop-color="#B07840"/>
            <stop offset="65%"  stop-color="#A0703A"/>
            <stop offset="100%" stop-color="#8B5E2A"/>
          </linearGradient>
          <!-- 中央光暈 -->
          <radialGradient id="court-glow" cx="50%" cy="50%" r="40%">
            <stop offset="0%"   stop-color="rgba(255,200,100,0.07)"/>
            <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
          </radialGradient>
          <!-- 橘色籃框光暈 -->
          <filter id="basket-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <!-- 用於 clipPath 確保線條不超出球場 -->
          <clipPath id="court-clip">
            <rect x="100" y="100" width="2800" height="1500" rx="0"/>
          </clipPath>
        </defs>

        <!-- 場外暗色背景 -->
        <rect x="0" y="0" width="3000" height="1700" fill="#07111C"/>

        <!-- 木地板 -->
        <rect x="100" y="100" width="2800" height="1500" fill="url(#floor-grad)"/>

        <!-- 木紋（水平細線）-->
        <g opacity="0.06" stroke="#3D1A00" stroke-width="0.5" clip-path="url(#court-clip)">
          <!-- 每 38px 一條（約 0.38m）-->
          <line x1="100" y1="138" x2="2900" y2="138"/>
          <line x1="100" y1="176" x2="2900" y2="176"/>
          <line x1="100" y1="214" x2="2900" y2="214"/>
          <line x1="100" y1="252" x2="2900" y2="252"/>
          <line x1="100" y1="290" x2="2900" y2="290"/>
          <line x1="100" y1="328" x2="2900" y2="328"/>
          <line x1="100" y1="366" x2="2900" y2="366"/>
          <line x1="100" y1="404" x2="2900" y2="404"/>
          <line x1="100" y1="442" x2="2900" y2="442"/>
          <line x1="100" y1="480" x2="2900" y2="480"/>
          <line x1="100" y1="518" x2="2900" y2="518"/>
          <line x1="100" y1="556" x2="2900" y2="556"/>
          <line x1="100" y1="594" x2="2900" y2="594"/>
          <line x1="100" y1="632" x2="2900" y2="632"/>
          <line x1="100" y1="670" x2="2900" y2="670"/>
          <line x1="100" y1="708" x2="2900" y2="708"/>
          <line x1="100" y1="746" x2="2900" y2="746"/>
          <line x1="100" y1="784" x2="2900" y2="784"/>
          <line x1="100" y1="822" x2="2900" y2="822"/>
          <line x1="100" y1="860" x2="2900" y2="860"/>
          <line x1="100" y1="898" x2="2900" y2="898"/>
          <line x1="100" y1="936" x2="2900" y2="936"/>
          <line x1="100" y1="974" x2="2900" y2="974"/>
          <line x1="100" y1="1012" x2="2900" y2="1012"/>
          <line x1="100" y1="1050" x2="2900" y2="1050"/>
          <line x1="100" y1="1088" x2="2900" y2="1088"/>
          <line x1="100" y1="1126" x2="2900" y2="1126"/>
          <line x1="100" y1="1164" x2="2900" y2="1164"/>
          <line x1="100" y1="1202" x2="2900" y2="1202"/>
          <line x1="100" y1="1240" x2="2900" y2="1240"/>
          <line x1="100" y1="1278" x2="2900" y2="1278"/>
          <line x1="100" y1="1316" x2="2900" y2="1316"/>
          <line x1="100" y1="1354" x2="2900" y2="1354"/>
          <line x1="100" y1="1392" x2="2900" y2="1392"/>
          <line x1="100" y1="1430" x2="2900" y2="1430"/>
          <line x1="100" y1="1468" x2="2900" y2="1468"/>
          <line x1="100" y1="1506" x2="2900" y2="1506"/>
          <line x1="100" y1="1544" x2="2900" y2="1544"/>
          <line x1="100" y1="1582" x2="2900" y2="1582"/>
        </g>

        <!-- 中央光暈 overlay -->
        <rect x="100" y="100" width="2800" height="1500" fill="url(#court-glow)"/>

        <!-- ══ 球場線條（1m=100px，場地原點 x=100, y=100）══ -->
        <g clip-path="url(#court-clip)" fill="none" stroke="rgba(255,255,255,0.88)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">

          <!-- 禁區底色（左）：x=100~680, y=355~1145 (5.8m×4.9m) -->
          <rect x="100" y="605" width="580" height="490" fill="rgba(28,60,130,0.28)" stroke="none"/>
          <!-- 禁區底色（右）：x=2320~2900, y=355~1145 -->
          <rect x="2320" y="605" width="580" height="490" fill="rgba(28,60,130,0.28)" stroke="none"/>

          <!-- 場地外框 -->
          <rect x="100" y="100" width="2800" height="1500" stroke="rgba(255,255,255,0.88)" stroke-width="3"/>

          <!-- 中線 -->
          <line x1="1500" y1="100" x2="1500" y2="1600"/>

          <!-- 中圈（半徑 1.8m = 180px）-->
          <circle cx="1500" cy="850" r="180"/>

          <!-- 中心點 -->
          <circle cx="1500" cy="850" r="6" fill="rgba(255,255,255,0.88)" stroke="none"/>

          <!-- ══ 左半場 ══ -->
          <!-- 禁區邊線 -->
          <line x1="100"  y1="605"  x2="680"  y2="605"/>   <!-- 禁區上邊：FIBA 4.9m 寬 -->
          <line x1="100"  y1="1095" x2="680"  y2="1095"/>  <!-- 禁區下邊 -->
          <line x1="680"  y1="605"  x2="680"  y2="1095"/>  <!-- 罰球線 -->

          <!-- 禁區刻度（距底線 175, 275, 375px = 1.75m, 2.75m, 3.75m）-->
          <line x1="275" y1="605"  x2="275" y2="585"/>
          <line x1="275" y1="1095" x2="275" y2="1115"/>
          <line x1="375" y1="605"  x2="375" y2="585"/>
          <line x1="375" y1="1095" x2="375" y2="1115"/>
          <line x1="475" y1="605"  x2="475" y2="585"/>
          <line x1="475" y1="1095" x2="475" y2="1115"/>

          <!-- 罰球圈（圓心 (680,850)，半徑 180px；朝籃框側實線，朝場中虛線）-->
          <!-- 朝籃框實線半圓：從 top (680,670) 到 bot (680,1030)，往左 -->
          <path d="M 680 670 A 180 180 0 0 0 680 1030"/>
          <!-- 朝場中虛線半圓 -->
          <path d="M 680 670 A 180 180 0 0 1 680 1030" stroke-dasharray="28 18"/>

          <!-- 限制區弧（圓心籃框 (257.5,850)，半徑 125px）-->
          <path d="M 257.5 725 A 125 125 0 0 1 257.5 975"/>

          <!-- 三分線：底角直線 -->
          <!-- 上方：(100,190) → (400,190)，即 y=0.9m=90px → y=100+90=190 -->
          <line x1="100"  y1="190"  x2="400"  y2="190"/>
          <!-- 下方：(100,1510) → (400,1510)，即 y=14.1m → y=100+1410=1510 -->
          <line x1="100"  y1="1510" x2="400"  y2="1510"/>
          <!-- 三分弧：圓心籃框(257.5,850)，從上端點到下端點 -->
          <!-- 上端點(400,190) 角度：atan2(190-850, 400-257.5) = atan2(-660, 142.5) -->
          <!-- 下端點(400,1510) 角度：atan2(1510-850, 400-257.5) = atan2(660, 142.5) -->
          <!-- 半徑 = sqrt(142.5²+660²) ≈ 675px = 6.75m ✓ -->
          <path d="M 400 190 A 675 675 0 0 1 400 1510"/>

          <!-- 籃板（面距底線 142.5px=1.425m，半寬 91.5px=0.915m）-->
          <line x1="242.5" y1="758.5" x2="242.5" y2="941.5" stroke-width="5"/>

          <!-- 籃框（圓心距底線 157.5px=1.575m）-->
          <circle cx="257.5" cy="850" r="22.5" stroke="#FF5E1A" stroke-width="5" filter="url(#basket-glow)"/>

          <!-- ══ 右半場（左右鏡像）══ -->
          <!-- 禁區邊線 -->
          <line x1="2900" y1="605"  x2="2320" y2="605"/>
          <line x1="2900" y1="1095" x2="2320" y2="1095"/>
          <line x1="2320" y1="605"  x2="2320" y2="1095"/>

          <!-- 禁區刻度 -->
          <line x1="2725" y1="605"  x2="2725" y2="585"/>
          <line x1="2725" y1="1095" x2="2725" y2="1115"/>
          <line x1="2625" y1="605"  x2="2625" y2="585"/>
          <line x1="2625" y1="1095" x2="2625" y2="1115"/>
          <line x1="2525" y1="605"  x2="2525" y2="585"/>
          <line x1="2525" y1="1095" x2="2525" y2="1115"/>

          <!-- 罰球圈（圓心 (2320,850)）-->
          <path d="M 2320 670 A 180 180 0 0 1 2320 1030"/>
          <path d="M 2320 670 A 180 180 0 0 0 2320 1030" stroke-dasharray="28 18"/>

          <!-- 限制區弧（圓心籃框 (2742.5,850)）-->
          <path d="M 2742.5 725 A 125 125 0 0 0 2742.5 975"/>

          <!-- 三分線：底角直線 -->
          <line x1="2900" y1="190"  x2="2600" y2="190"/>
          <line x1="2900" y1="1510" x2="2600" y2="1510"/>
          <!-- 三分弧：圓心 (2742.5,850) 右側 -->
          <path d="M 2600 190 A 675 675 0 0 0 2600 1510"/>

          <!-- 籃板（右側）-->
          <line x1="2757.5" y1="758.5" x2="2757.5" y2="941.5" stroke-width="5"/>

          <!-- 籃框（右側）-->
          <circle cx="2742.5" cy="850" r="22.5" stroke="#FF5E1A" stroke-width="5" filter="url(#basket-glow)"/>

        </g>
      </svg>
      <!-- ★ canvas 疊加：背景透明，只畫球員/球/戰術線 -->
      <canvas id="court" class="c-def" style="position:absolute;top:0;left:0;z-index:2;background:transparent;"></canvas>
      <!-- draw-canvas 疊在最上方，畫圖標註用 -->
      <canvas id="draw-canvas"></canvas>
    </div>
    <div id="box-select-rect" class="box-select-rect"></div>
    <!-- 廣播 pill（全體可見） -->
    <div class="bcast-pill" id="bcast-pill">
      <span class="bcast-label" id="bcast-label">▶ 播放中</span>
      <div class="bcast-prog-wrap"><div class="bcast-prog-fill" id="bcast-fill" style="width:0%"></div></div>
      <span class="bcast-frame-info" id="bcast-frame-info"></span>
      <div class="bcast-btns">
        <button class="bcast-react bcast-like" onclick="sendReaction('👍')">👍 讚</button>
        <button class="bcast-react bcast-pause-req" onclick="sendPauseRequest()">✋ 暫停</button>
      </div>
    </div>
    <!-- 標註工具列（畫圖模式時） -->
    <div class="anno-bar" id="anno-bar">
      <button class="anno-btn act" id="anno-pen-btn" onclick="setAnnoTool('pen',this)" title="畫筆">✏️</button>
      <button class="anno-btn" id="anno-arr-btn" onclick="setAnnoTool('arrow',this)" title="箭頭">→</button>
      <button class="anno-btn" onclick="clearAnno()" title="清除">🗑</button>
      <div class="anno-sep"></div>
      <div id="anno-colors"></div>
    </div>
    <!-- ★ 永遠顯示的畫圖開關 FAB -->
    <button class="anno-fab" id="anno-fab" onclick="toggleAnno()" title="開啟/關閉畫圖討論">✏️</button>
    <!-- 播放控制條（主持人） -->
    <div class="anim-bar" id="anim-bar">
      <span style="font-size:10px;color:var(--t3)">動畫</span>
      <div class="ap-track"><div class="ap-fill" id="ap-fill"></div></div>
      <span class="ap-prog" id="ap-prog">0%</span>
      <div class="spd-g">
        <button class="spd-b" onclick="setSpd(.5,this)">.5x</button>
        <button class="spd-b act" onclick="setSpd(1,this)">1x</button>
        <button class="spd-b" onclick="setSpd(2,this)">2x</button>
      </div>
      <button class="ap-play" id="ap-pb" onclick="window.toggleAnim()">▶ 播放</button>
      <button class="ap-stop" onclick="window.stopAnim()">■ 停止</button>
    </div>
    <div class="ov-pill sync-pill" id="sync-pill"><div class="live-dot"></div><span id="sync-txt">連線中...</span></div>
    <div class="npw" id="npw">
      <span class="npw-lbl">球員資訊</span>
      <div class="npw-row">
        <input class="npw-inp" id="np-n" placeholder="名稱" maxlength="6" autocomplete="off"/>
        <input class="npw-inp npw-num" id="np-num" placeholder="#" type="number" min="1" max="99"/>
      </div>
      <div class="npw-btns">
        <button class="npw-skip" onclick="cancelNP()">略過</button>
        <button class="npw-ok" onclick="confirmNP()">確定</button>
      </div>
    </div>
  </div>

  <div class="right-panel">
    <div class="rp-tabs">
      <div class="rp-tab act" id="rt-frames" onclick="switchRP('frames')">🎬 幀動畫</div>
      <div class="rp-tab" id="rt-tools" onclick="switchRP('tools')">⚙️ 工具</div>
    </div>
    <div class="rp-body" id="rp-body"></div>
  </div>

  <div class="chat-panel">
    <div class="chat-msgs-wrap" style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
      <div class="chat-hdr"><div class="chat-title">聊天室</div><span class="chat-unread" id="chat-unread">0</span></div>
      <div class="chat-msgs" id="chat-msgs"><div class="msg-sys">歡迎使用 HoopBoard Pro 🏀</div></div>
    </div>
    <div class="chat-inp-wrap" style="flex-shrink:0;border-top:1px solid var(--l1);">
      <div class="chat-ia">
        <div class="stk-strip" id="stk-strip"></div>
        <div class="chat-row">
          <input class="chat-inp" id="chat-inp" placeholder="訊息…" maxlength="100" autocomplete="off"/>
          <button class="chat-send" onclick="sendMsg()">送</button>
        </div>
      </div>
    </div>
  </div>
</div>

<div class="btb">
  <button class="tb-btn act" id="tb-sel" onclick="setTool('select',this)" title="選取；拖曳空白處可框選">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3l14 9-7 1-4 7z"/></svg><span>選取</span>
  </button>
  <button class="tb-btn" id="tb-box" onclick="setTool('box',this)">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="5" width="16" height="14" rx="2" stroke-dasharray="4 2"/></svg><span>框選</span>
  </button>
  <button class="tb-btn" id="tb-ply" onclick="setTool('player',this)">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M6 20c0-4 2.7-7 6-7s6 3 6 7"/></svg><span>球員</span>
  </button>
  <button class="tb-btn" id="tb-bal" onclick="setTool('ball',this)">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3.6 9h16.8M3.6 15h16.8M12 3a9 9 0 0 0 0 18M12 3a9 9 0 0 1 0 18"/></svg><span>球</span>
  </button>
  <div class="tb-sep"></div>
  <button class="tb-btn" id="tb-cut" onclick="setTool('cut',this)">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M14 7l5 5-5 5"/></svg><span>跑位</span>
  </button>
  <button class="tb-btn" id="tb-pass" onclick="setTool('pass',this)">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="5 3"><path d="M5 12h14M14 7l5 5-5 5"/></svg><span>傳球</span>
  </button>
  <button class="tb-btn" id="tb-drib" onclick="setTool('drib',this)">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12 Q8 6 12 12 Q16 18 20 12"/></svg><span>運球</span>
  </button>
  <button class="tb-btn" id="tb-scr" onclick="setTool('screen',this)">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="7" width="6" height="10" rx="1"/><path d="M5 12h4M15 12h4"/></svg><span>掩護</span>
  </button>
  <div class="tb-sep"></div>
  <button class="tb-btn" onclick="delSel()" style="color:var(--rd)">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg><span>刪除</span>
  </button>
  <button class="tb-btn" onclick="addFrame()" style="color:var(--gn)">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg><span>新幀</span>
  </button>
</div>
</div>

<div class="modal-ov" id="share-modal" onclick="if(event.target===this)this.classList.remove('show')">
  <div class="modal-box">
    <div class="modal-title">🔗 分享戰術板</div>
    <div class="modal-sub">傳連結給球員，進入後即時同步</div>
    <div class="m-link-row"><input class="m-link-inp" id="share-link" readonly/><button class="m-copy" onclick="copyLink()">複製</button></div>
    <div class="m-share-row">
      <button class="m-share-opt" onclick="shareLine()"><span>💬</span>LINE</button>
      <button class="m-share-opt" onclick="copyLink()"><span>📋</span>複製</button>
    </div>
    <button class="m-close" onclick="document.getElementById('share-modal').classList.remove('show')">關閉</button>
  </div>
</div>


<script src="./js/helper.js"></script>
<script src="./js/court-engine.js"></script>
<script type="module" src="./js/firebase-sync.js"></script>
<script src="./js/main.js"></script>
</body>
</html>
