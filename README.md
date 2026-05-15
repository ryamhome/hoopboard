/*
  HoopBoard Court Presets Module
  目的：把「球場規格」與「場地風格」從主程式中獨立出來。
  - 規格層：FIBA / NBA / NCAA / HALF COURT
  - 風格層：Classic Wood / NBA Dark / Purple Gold / Blue Gold / Street
  注意：本模組只重畫 SVG 球場底圖，不改球員、動畫、Firebase、聊天室邏輯。
*/
(function(){
  'use strict';

  const BOARD = { w: 3000, h: 1700, x: 100, y: 100, courtW: 2800, courtH: 1500 };

  const SPECS = {
    fiba: {
      id: 'fiba', label: 'FIBA 標準 28×15m',
      length: 28.0, width: 15.0,
      laneDepth: 5.8, laneWidth: 4.9,
      centerCircleR: 1.8, freeThrowCircleR: 1.8,
      rimFromEnd: 1.575, backboardFromEnd: 1.2, backboardWidth: 1.8,
      rimR: 0.225, restrictedR: 1.25,
      threeRadius: 6.75, cornerOffsetY: 0.90,
      notes: '適合 FIBA / 國際賽 / 台灣常見標準場。'
    },
    nba: {
      id: 'nba', label: 'NBA 94×50ft',
      length: 28.6512, width: 15.24,
      laneDepth: 5.7912, laneWidth: 4.8768,
      centerCircleR: 1.8288, freeThrowCircleR: 1.8288,
      rimFromEnd: 1.575, backboardFromEnd: 1.2192, backboardWidth: 1.8288,
      rimR: 0.2286, restrictedR: 1.2192,
      threeRadius: 7.239, cornerOffsetY: 0.9144,
      notes: 'NBA 風格比例，適合做職業比賽戰術展示。'
    },
    ncaa: {
      id: 'ncaa', label: 'NCAA 94×50ft',
      length: 28.6512, width: 15.24,
      laneDepth: 5.7912, laneWidth: 3.6576,
      centerCircleR: 1.8288, freeThrowCircleR: 1.8288,
      rimFromEnd: 1.575, backboardFromEnd: 1.2192, backboardWidth: 1.8288,
      rimR: 0.2286, restrictedR: 1.2192,
      threeRadius: 6.75, cornerOffsetY: 1.02,
      notes: 'NCAA 參考比例，供教學與比較用。'
    },
    half: {
      id: 'half', label: '半場訓練模式',
      length: 14.0, width: 15.0,
      laneDepth: 5.8, laneWidth: 4.9,
      centerCircleR: 1.8, freeThrowCircleR: 1.8,
      rimFromEnd: 1.575, backboardFromEnd: 1.2, backboardWidth: 1.8,
      rimR: 0.225, restrictedR: 1.25,
      threeRadius: 6.75, cornerOffsetY: 0.90,
      halfCourt: true,
      notes: '半場戰術練習用，適合 3v3、半場進攻、防守站位。'
    }
  };

  const THEMES = {
    wood: {
      id:'wood', label:'經典木地板',
      bg:'#07111C', floorA:'#8B5E2A', floorB:'#B07840', paint:'rgba(28,60,130,0.28)',
      line:'rgba(255,255,255,0.88)', muted:'rgba(255,255,255,0.72)', hoop:'#FF5E1A', glow:'rgba(255,200,100,0.07)', wood:'#3D1A00'
    },
    nbaDark: {
      id:'nbaDark', label:'NBA 暗色風',
      bg:'#05070D', floorA:'#1E293B', floorB:'#334155', paint:'rgba(15,23,42,0.62)',
      line:'rgba(255,255,255,0.92)', muted:'rgba(255,255,255,0.70)', hoop:'#FF6B1A', glow:'rgba(0,212,255,0.07)', wood:'#0F172A'
    },
    purpleGold: {
      id:'purpleGold', label:'紫金職業風',
      bg:'#12091F', floorA:'#6D4A1F', floorB:'#B8872B', paint:'rgba(85,42,140,0.42)',
      line:'rgba(255,237,150,0.92)', muted:'rgba(255,237,150,0.70)', hoop:'#FF5E1A', glow:'rgba(255,214,0,0.08)', wood:'#2B1648'
    },
    blueGold: {
      id:'blueGold', label:'藍金職業風',
      bg:'#061326', floorA:'#9A6A2D', floorB:'#D19B42', paint:'rgba(0,77,180,0.35)',
      line:'rgba(255,255,255,0.94)', muted:'rgba(255,255,255,0.68)', hoop:'#FFB000', glow:'rgba(0,123,255,0.08)', wood:'#11335F'
    },
    street: {
      id:'street', label:'街頭水泥風',
      bg:'#0B0D10', floorA:'#454A50', floorB:'#626A73', paint:'rgba(255,255,255,0.08)',
      line:'rgba(245,245,245,0.82)', muted:'rgba(245,245,245,0.55)', hoop:'#FF4D1A', glow:'rgba(255,255,255,0.03)', wood:'#20242A'
    }
  };

  let currentSpec = localStorage.getItem('hb_court_spec') || 'fiba';
  let currentTheme = localStorage.getItem('hb_court_theme') || 'wood';

  function esc(s){ return String(s).replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); }
  function y(spec, meterFromTop){ return BOARD.y + (meterFromTop / spec.width) * BOARD.courtH; }
  function x(spec, meterFromLeft){ return BOARD.x + (meterFromLeft / spec.length) * BOARD.courtW; }
  function fmt(n){ return Number(n).toFixed(2).replace(/\.00$/,''); }

  function arcPath(cx, cy, r, startDeg, endDeg, sweep){
    const rad = d => d * Math.PI / 180;
    const sx = cx + r * Math.cos(rad(startDeg));
    const sy = cy + r * Math.sin(rad(startDeg));
    const ex = cx + r * Math.cos(rad(endDeg));
    const ey = cy + r * Math.sin(rad(endDeg));
    const diff = Math.abs(endDeg - startDeg);
    const large = diff > 180 ? 1 : 0;
    return `M ${fmt(sx)} ${fmt(sy)} A ${fmt(r)} ${fmt(r)} 0 ${large} ${sweep ? 1 : 0} ${fmt(ex)} ${fmt(ey)}`;
  }

  function sideGeometry(spec, side){
    const left = side === 'left';
    const len = spec.length, wid = spec.width;
    const endX = left ? 0 : len;
    const dir = left ? 1 : -1;
    const rimX = endX + dir * spec.rimFromEnd;
    const rimY = wid / 2;
    const ftX = endX + dir * spec.laneDepth;
    const laneTop = (wid - spec.laneWidth) / 2;
    const laneBot = (wid + spec.laneWidth) / 2;
    const bX = endX + dir * spec.backboardFromEnd;
    const bTop = (wid - spec.backboardWidth) / 2;
    const bBot = (wid + spec.backboardWidth) / 2;
    const cornerTopY = spec.cornerOffsetY;
    const cornerBotY = wid - spec.cornerOffsetY;
    const dy = (wid / 2) - spec.cornerOffsetY;
    const cornerLen = Math.sqrt(Math.max(0, spec.threeRadius * spec.threeRadius - dy * dy));
    const cornerX = endX + dir * cornerLen;
    return {
      left, dir,
      endX: x(spec,endX), rimX: x(spec,rimX), rimY: y(spec,rimY),
      ftX: x(spec,ftX), ftY: y(spec,rimY),
      laneTop: y(spec,laneTop), laneBot: y(spec,laneBot),
      bX: x(spec,bX), bTop: y(spec,bTop), bBot: y(spec,bBot),
      cornerX: x(spec,cornerX), cornerTopY: y(spec,cornerTopY), cornerBotY: y(spec,cornerBotY),
      threeR: (spec.threeRadius / spec.length) * BOARD.courtW,
      restrictedR: (spec.restrictedR / spec.length) * BOARD.courtW,
      ftR: (spec.freeThrowCircleR / spec.length) * BOARD.courtW,
      rimR: (spec.rimR / spec.length) * BOARD.courtW
    };
  }

  function drawSide(spec, theme, side){
    const g = sideGeometry(spec, side);
    const laneEndX = g.ftX;
    const endX = g.endX;
    const laneRectX = Math.min(endX, laneEndX);
    const laneW = Math.abs(laneEndX - endX);
    const marks = [1.75, 2.75, 3.75].map(d => x(spec, g.left ? d : spec.length - d));
    const tickOutTop = g.laneTop - 20;
    const tickOutBot = g.laneBot + 20;
    const ftArcSolid = g.left
      ? arcPath(g.ftX, g.ftY, g.ftR, -90, 90, false)
      : arcPath(g.ftX, g.ftY, g.ftR, 90, 270, false);
    const ftArcDash = g.left
      ? arcPath(g.ftX, g.ftY, g.ftR, -90, 90, true)
      : arcPath(g.ftX, g.ftY, g.ftR, 90, 270, true);
    const resArc = g.left
      ? arcPath(g.rimX, g.rimY, g.restrictedR, -90, 90, true)
      : arcPath(g.rimX, g.rimY, g.restrictedR, 90, 270, true);
    const threeArc = g.left
      ? `M ${fmt(g.cornerX)} ${fmt(g.cornerTopY)} A ${fmt(g.threeR)} ${fmt(g.threeR)} 0 0 1 ${fmt(g.cornerX)} ${fmt(g.cornerBotY)}`
      : `M ${fmt(g.cornerX)} ${fmt(g.cornerTopY)} A ${fmt(g.threeR)} ${fmt(g.threeR)} 0 0 0 ${fmt(g.cornerX)} ${fmt(g.cornerBotY)}`;
    const c1x = g.left ? BOARD.x : BOARD.x + BOARD.courtW;
    return `
      <rect x="${fmt(laneRectX)}" y="${fmt(g.laneTop)}" width="${fmt(laneW)}" height="${fmt(g.laneBot-g.laneTop)}" fill="${theme.paint}" stroke="none"/>
      <line x1="${fmt(endX)}" y1="${fmt(g.laneTop)}" x2="${fmt(laneEndX)}" y2="${fmt(g.laneTop)}"/>
      <line x1="${fmt(endX)}" y1="${fmt(g.laneBot)}" x2="${fmt(laneEndX)}" y2="${fmt(g.laneBot)}"/>
      <line x1="${fmt(laneEndX)}" y1="${fmt(g.laneTop)}" x2="${fmt(laneEndX)}" y2="${fmt(g.laneBot)}"/>
      ${marks.map(mx=>`<line x1="${fmt(mx)}" y1="${fmt(g.laneTop)}" x2="${fmt(mx)}" y2="${fmt(tickOutTop)}"/><line x1="${fmt(mx)}" y1="${fmt(g.laneBot)}" x2="${fmt(mx)}" y2="${fmt(tickOutBot)}"/>`).join('')}
      <path d="${ftArcSolid}"/>
      <path d="${ftArcDash}" stroke-dasharray="28 18"/>
      <path d="${resArc}"/>
      <line x1="${fmt(c1x)}" y1="${fmt(g.cornerTopY)}" x2="${fmt(g.cornerX)}" y2="${fmt(g.cornerTopY)}"/>
      <line x1="${fmt(c1x)}" y1="${fmt(g.cornerBotY)}" x2="${fmt(g.cornerX)}" y2="${fmt(g.cornerBotY)}"/>
      <path d="${threeArc}"/>
      <line x1="${fmt(g.bX)}" y1="${fmt(g.bTop)}" x2="${fmt(g.bX)}" y2="${fmt(g.bBot)}" stroke-width="5"/>
      <circle cx="${fmt(g.rimX)}" cy="${fmt(g.rimY)}" r="${fmt(g.rimR)}" stroke="${theme.hoop}" stroke-width="5" filter="url(#basket-glow)"/>
    `;
  }

  function generateCourtSvg(spec, theme){
    const midX = x(spec, spec.length / 2);
    const midY = y(spec, spec.width / 2);
    const centerR = (spec.centerCircleR / spec.length) * BOARD.courtW;
    const woodLines = Array.from({length: 39}, (_,i)=> BOARD.y + 38 * (i+1)).map(yy=>`<line x1="${BOARD.x}" y1="${yy}" x2="${BOARD.x+BOARD.courtW}" y2="${yy}"/>`).join('');
    const rightSide = spec.halfCourt ? '' : drawSide(spec, theme, 'right');
    const centerLine = spec.halfCourt ? '' : `<line x1="${fmt(midX)}" y1="${BOARD.y}" x2="${fmt(midX)}" y2="${BOARD.y+BOARD.courtH}"/><circle cx="${fmt(midX)}" cy="${fmt(midY)}" r="${fmt(centerR)}"/><circle cx="${fmt(midX)}" cy="${fmt(midY)}" r="6" fill="${theme.line}" stroke="none"/>`;
    return `
      <defs>
        <linearGradient id="floor-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${theme.floorA}"/>
          <stop offset="50%" stop-color="${theme.floorB}"/>
          <stop offset="100%" stop-color="${theme.floorA}"/>
        </linearGradient>
        <radialGradient id="court-glow" cx="50%" cy="50%" r="44%">
          <stop offset="0%" stop-color="${theme.glow}"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/>
        </radialGradient>
        <filter id="basket-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <clipPath id="court-clip"><rect x="${BOARD.x}" y="${BOARD.y}" width="${BOARD.courtW}" height="${BOARD.courtH}"/></clipPath>
      </defs>
      <rect x="0" y="0" width="${BOARD.w}" height="${BOARD.h}" fill="${theme.bg}"/>
      <rect x="${BOARD.x}" y="${BOARD.y}" width="${BOARD.courtW}" height="${BOARD.courtH}" fill="url(#floor-grad)"/>
      <g opacity="0.06" stroke="${theme.wood}" stroke-width="0.5" clip-path="url(#court-clip)">${woodLines}</g>
      <rect x="${BOARD.x}" y="${BOARD.y}" width="${BOARD.courtW}" height="${BOARD.courtH}" fill="url(#court-glow)"/>
      <g clip-path="url(#court-clip)" fill="none" stroke="${theme.line}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <rect x="${BOARD.x}" y="${BOARD.y}" width="${BOARD.courtW}" height="${BOARD.courtH}" stroke="${theme.line}" stroke-width="3"/>
        ${centerLine}
        ${drawSide(spec, theme, 'left')}
        ${rightSide}
      </g>
      <text x="${BOARD.x+24}" y="${BOARD.y+44}" fill="${theme.muted}" font-family="Barlow Condensed, sans-serif" font-size="34" font-weight="900" letter-spacing="2">${esc(spec.label)}</text>
    `;
  }

  function applyCourtPreset(specId=currentSpec, themeId=currentTheme){
    const spec = SPECS[specId] || SPECS.fiba;
    const theme = THEMES[themeId] || THEMES.wood;
    currentSpec = spec.id;
    currentTheme = theme.id;
    localStorage.setItem('hb_court_spec', currentSpec);
    localStorage.setItem('hb_court_theme', currentTheme);
    const svg = document.getElementById('court-svg');
    if(!svg) return;
    svg.setAttribute('viewBox', `0 0 ${BOARD.w} ${BOARD.h}`);
    svg.innerHTML = generateCourtSvg(spec, theme);
    const label = document.getElementById('court-spec-note');
    if(label) label.textContent = spec.notes;
    if(window.render) window.render();
  }

  function injectPanelStyle(){
    if(document.getElementById('court-preset-style')) return;
    const style = document.createElement('style');
    style.id = 'court-preset-style';
    style.textContent = `
      .court-preset-panel{position:absolute;left:12px;top:12px;z-index:18;background:rgba(10,21,32,.92);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:8px;backdrop-filter:blur(10px);display:flex;gap:6px;align-items:center;box-shadow:0 8px 24px rgba(0,0,0,.25)}
      .court-preset-panel select{height:30px;max-width:150px;border-radius:7px;border:1px solid rgba(255,255,255,.14);background:#0A1520;color:#fff;font-size:11px;padding:0 8px;outline:none}
      .court-preset-panel .mini-label{font-family:Barlow Condensed,sans-serif;font-size:9px;color:rgba(255,255,255,.55);letter-spacing:1.5px;text-transform:uppercase;margin-right:2px}
      @media(max-width:720px){.court-preset-panel{left:8px;top:8px;gap:4px;padding:6px}.court-preset-panel select{max-width:112px;font-size:10px}}
    `;
    document.head.appendChild(style);
  }

  function buildSelect(id, options, value){
    return `<select id="${id}">${Object.values(options).map(o=>`<option value="${o.id}" ${o.id===value?'selected':''}>${esc(o.label)}</option>`).join('')}</select>`;
  }

  function mountCourtPresetPanel(){
    const wrap = document.getElementById('ca');
    if(!wrap || document.getElementById('court-preset-panel')) return;
    injectPanelStyle();
    const panel = document.createElement('div');
    panel.className = 'court-preset-panel';
    panel.id = 'court-preset-panel';
    panel.innerHTML = `<span class="mini-label">Court</span>${buildSelect('court-spec-select', SPECS, currentSpec)}${buildSelect('court-theme-select', THEMES, currentTheme)}`;
    wrap.appendChild(panel);
    const specSel = document.getElementById('court-spec-select');
    const themeSel = document.getElementById('court-theme-select');
    specSel.addEventListener('change', ()=>applyCourtPreset(specSel.value, themeSel.value));
    themeSel.addEventListener('change', ()=>applyCourtPreset(specSel.value, themeSel.value));
  }

  window.HoopCourtPresets = { SPECS, THEMES, apply: applyCourtPreset, mount: mountCourtPresetPanel };
  window.applyCourtPreset = applyCourtPreset;

  window.addEventListener('DOMContentLoaded', () => {
    mountCourtPresetPanel();
    applyCourtPreset(currentSpec, currentTheme);
  });
  window.addEventListener('load', () => {
    mountCourtPresetPanel();
    applyCourtPreset(currentSpec, currentTheme);
  });
})();
