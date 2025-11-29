// Floating words canvas with modal rating
const WORD_COUNT = 100;
// defaults (may be overridden by config.json)
let AMPLITUDE_X = 18; // px horizontal movement
let AMPLITUDE_Y = 18; // px vertical movement
let FREQUENCY_X = 0.0018; // radians/ms for X axis
let FREQUENCY_Y = 0.0018; // radians/ms for Y axis
// randomness 0..1 controlling how far from the tile center a word may appear
let X_RANDOMNESS = 1.0; // 0 = always center of tile on x, 1 = anywhere to tile boundary
let Y_RANDOMNESS = 1.0; // 0 = always center of tile on y, 1 = anywhere to tile boundary
// per-word color map loaded from word_colors.txt
let COLORS_MAP = {};
// lightness scaling factor 0..1 (multiplies color L component)
let LIGHTNESS_FACTOR = 0.5;
let LIGHTNESS_DARK = 0.8;
let LIGHTNESS_LIGHT = 0.2;
// configurable background colors
let DARK_BG_COLOR = '#0f1724';
let LIGHT_BG_COLOR = '#f7fafc';
// glow effect settings
let GLOW_FREQ = 0.001; // frequency of lightness oscillation
let GLOW_AMP = 0.15; // amplitude of lightness change (0-1)
// font and rated word styling
let FONT_SIZE = 24; // base font size in pixels
let RATED_SIZE_MULTIPLIER_MIN = 1.2; // size multiplier for rating=1
let RATED_SIZE_MULTIPLIER_MAX = 2.5; // size multiplier for rating=5
let RATED_LIGHTNESS_BOOST_MIN = 0.05; // additional lightness for rating=1
let RATED_LIGHTNESS_BOOST_MAX = 0.3; // additional lightness for rating=5

// Camera transform for zoom and pan
let camera = {
  x: 0,
  y: 0,
  zoom: 1
};

// Mobile detection and configuration
let isMobile = false;
let MOBILE_FONT_SIZE = 18;
let MOBILE_COLS = 4;
let MOBILE_ROWS = 25;

const wordsList = [
  "time","person","year","way","day","thing","man","world","life","hand",
  "part","child","eye","woman","place","work","week","case","point","government",
  "company","number","group","problem","fact","be","have","do","say","get",
  "make","go","know","take","see","come","think","look","want","give",
  "use","find","tell","ask","work","seem","feel","try","leave","call",
  "good","new","first","last","long","great","little","own","other","old",
  "right","big","high","different","small","large","next","early","young","important",
  "few","public","bad","same","able","to","of","in","for","on",
  "with","at","by","from","up","about","into","over","after","beneath",
  "under","above","often","always","never","however","during","within","through","across",
  "example","group","system","program","question","number","process","result","service","policy"
];

const canvas = document.getElementById('stage');
const modal = document.getElementById('modal');
const modalWord = document.getElementById('modal-word');
const ratingForm = document.getElementById('rating-form');
const cancelBtn = document.getElementById('cancel');
const themeToggle = document.getElementById('themeToggle');

const ctx = canvas.getContext('2d');

let DPR = Math.max(1, window.devicePixelRatio || 1);

function resize(){
  DPR = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * DPR);
  canvas.height = Math.floor(window.innerHeight * DPR);
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(DPR,0,0,DPR,0,0);
  
  // Detect mobile device
  isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
    || (window.innerWidth <= 768);
}
window.addEventListener('resize', resize, {passive:true});
resize();

class FloatingWord{
  constructor(text,x,y,phaseX,phaseY){
    this.text = text;
    this.baseX = x;
    this.baseY = y;
    this.phaseX = phaseX;
    this.phaseY = phaseY;
    this.glowPhase = Math.random() * Math.PI * 2; // random glow offset
    this.width = 0; this.height = 0;
    this.rating = null; // store rating after submission
  }
  measure(font){
    ctx.font = font;
    const m = ctx.measureText(this.text);
    this.width = m.width;
    this.height = parseInt(font,10) || 16;
    this.halfWidth = this.width / 2;
    this.halfHeight = this.height / 2;
  }
  draw(time, font, color, fontSize){
    ctx.font = font;
    const x = this.baseX + AMPLITUDE_X * Math.sin(FREQUENCY_X * time + this.phaseX);
    const y = this.baseY + AMPLITUDE_Y * Math.sin(FREQUENCY_Y * time + this.phaseY);
    ctx.fillStyle = color;
    // center text on (x, y)
    const prevAlign = ctx.textAlign;
    const prevBaseline = ctx.textBaseline;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.text, x, y);
    // store bounding box (top-left) and current position (in world coordinates)
    this.lastX = x - (this.width / 2);
    this.lastY = y - (this.height / 2);
    this.currentX = x;
    this.currentY = y;
    
    // Draw rating circles if rated (scale with font size)
    if(this.rating !== null && this.rating > 0){
      const scale = fontSize / FONT_SIZE; // scale factor relative to base font size
      const circleRadius = 3 * scale;
      const circleSpacing = 8 * scale;
      const padding = 8 * scale;
      const startX = x - (this.width / 2);
      const circleY = y + (this.height / 2) + padding;
      ctx.fillStyle = color;
      for(let i = 0; i < this.rating; i++){
        ctx.beginPath();
        ctx.arc(startX + i * circleSpacing, circleY, circleRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    ctx.textAlign = prevAlign;
    ctx.textBaseline = prevBaseline;
  }
  contains(px,py){
    return px >= this.lastX && px <= this.lastX + this.width && py >= this.lastY && py <= this.lastY + this.height;
  }
}

let words = [];

// Control panel elements
const panel = document.getElementById('control-panel');
const panelToggle = document.getElementById('panelToggle');
const panelBody = document.getElementById('panel-body');
const ampXInput = document.getElementById('ampXInput');
const ampYInput = document.getElementById('ampYInput');
const freqXInput = document.getElementById('freqXInput');
const freqYInput = document.getElementById('freqYInput');
const xInput = document.getElementById('xInput');
const yInput = document.getElementById('yInput');
const glowFreqInput = document.getElementById('glowFreqInput');
const glowAmpInput = document.getElementById('glowAmpInput');
const fontSizeInput = document.getElementById('fontSizeInput');
const ratedSizeMinInput = document.getElementById('ratedSizeMinInput');
const ratedSizeMaxInput = document.getElementById('ratedSizeMaxInput');
const ratedLightMinInput = document.getElementById('ratedLightMinInput');
const ratedLightMaxInput = document.getElementById('ratedLightMaxInput');
const lSlider = document.getElementById('lSlider');
const lVal = document.getElementById('lVal');
const applyBtn = document.getElementById('applyBtn');

// Theme toggle button
const themeToggleBtn = document.getElementById('themeToggle');

// Bind control panel handlers
function bindControls(){
  // Lightness slider live display
  if(lSlider && lVal){
    lSlider.addEventListener('input', ()=>{
      lVal.textContent = Number(lSlider.value).toFixed(2);
    });
  }
  
  // Apply button
  if(applyBtn){
    applyBtn.addEventListener('click', ()=>{
      // Save current ratings before regenerating
      const savedRatings = words.map(w => ({text: w.text, rating: w.rating})).filter(r => r.rating !== null);
      
      if(ampXInput) AMPLITUDE_X = Number(ampXInput.value);
      if(ampYInput) AMPLITUDE_Y = Number(ampYInput.value);
      if(freqXInput) FREQUENCY_X = Number(freqXInput.value);
      if(freqYInput) FREQUENCY_Y = Number(freqYInput.value);
      if(xInput) X_RANDOMNESS = Number(xInput.value);
      if(yInput) Y_RANDOMNESS = Number(yInput.value);
      if(glowFreqInput) GLOW_FREQ = Number(glowFreqInput.value);
      if(glowAmpInput) GLOW_AMP = Number(glowAmpInput.value);
      if(fontSizeInput) FONT_SIZE = Number(fontSizeInput.value);
      if(ratedSizeMinInput) RATED_SIZE_MULTIPLIER_MIN = Number(ratedSizeMinInput.value);
      if(ratedSizeMaxInput) RATED_SIZE_MULTIPLIER_MAX = Number(ratedSizeMaxInput.value);
      if(ratedLightMinInput) RATED_LIGHTNESS_BOOST_MIN = Number(ratedLightMinInput.value);
      if(ratedLightMaxInput) RATED_LIGHTNESS_BOOST_MAX = Number(ratedLightMaxInput.value);
      if(lSlider) {
        const isLight = document.body.classList.contains('light');
        if(isLight) {
          LIGHTNESS_LIGHT = Number(lSlider.value);
          LIGHTNESS_FACTOR = LIGHTNESS_LIGHT;
        } else {
          LIGHTNESS_DARK = Number(lSlider.value);
          LIGHTNESS_FACTOR = LIGHTNESS_DARK;
        }
      }
      // Recompute positions with new settings
      loadConfigAndWords().then(() => {
        // Restore ratings after regenerating
        savedRatings.forEach(saved => {
          const word = words.find(w => w.text === saved.text);
          if(word) word.rating = saved.rating;
        });
      });
    });
  }
  
  // Panel toggle
  if(panelToggle && panel){
    panelToggle.addEventListener('click', ()=>{
      const isMin = panel.classList.toggle('minimized');
      panelToggle.setAttribute('aria-expanded', String(!isMin));
    });
  }
}

// Theme toggle handler
// Theme toggle handler
if(themeToggleBtn){
  themeToggleBtn.addEventListener('click', ()=>{
    const isLight = document.body.classList.toggle('light');
    // switch between lightnessDark and lightnessLight
    LIGHTNESS_FACTOR = isLight ? LIGHTNESS_LIGHT : LIGHTNESS_DARK;
    // Update slider to show current lightness
    if(lSlider) lSlider.value = LIGHTNESS_FACTOR;
    if(lVal) lVal.textContent = Number(LIGHTNESS_FACTOR).toFixed(2);
  });
}

bindControls();

// Load config once at startup
async function loadConfig(){
  try{
    const cfgResp = await fetch('config.json');
    if(cfgResp.ok){
      const cfg = await cfgResp.json();
      if(typeof cfg.amplitudeX === 'number') AMPLITUDE_X = cfg.amplitudeX;
      if(typeof cfg.amplitudeY === 'number') AMPLITUDE_Y = cfg.amplitudeY;
      if(typeof cfg.frequencyX === 'number') FREQUENCY_X = cfg.frequencyX;
      if(typeof cfg.frequencyY === 'number') FREQUENCY_Y = cfg.frequencyY;
      if(typeof cfg.xRandomness === 'number') X_RANDOMNESS = cfg.xRandomness;
      if(typeof cfg.yRandomness === 'number') Y_RANDOMNESS = cfg.yRandomness;
      if(typeof cfg.lightnessDark === 'number') LIGHTNESS_DARK = cfg.lightnessDark;
      if(typeof cfg.lightnessLight === 'number') LIGHTNESS_LIGHT = cfg.lightnessLight;
      // Set initial lightness based on current theme
      const isLight = document.body.classList.contains('light');
      LIGHTNESS_FACTOR = isLight ? LIGHTNESS_LIGHT : LIGHTNESS_DARK;
      // Sync UI controls
      if(ampXInput) ampXInput.value = AMPLITUDE_X;
      if(ampYInput) ampYInput.value = AMPLITUDE_Y;
      if(freqXInput) freqXInput.value = FREQUENCY_X;
      if(freqYInput) freqYInput.value = FREQUENCY_Y;
      if(xInput) xInput.value = X_RANDOMNESS;
      if(yInput) yInput.value = Y_RANDOMNESS;
      if(glowFreqInput) glowFreqInput.value = GLOW_FREQ;
      if(glowAmpInput) glowAmpInput.value = GLOW_AMP;
      if(fontSizeInput) fontSizeInput.value = FONT_SIZE;
      if(ratedSizeMinInput) ratedSizeMinInput.value = RATED_SIZE_MULTIPLIER_MIN;
      if(ratedSizeMaxInput) ratedSizeMaxInput.value = RATED_SIZE_MULTIPLIER_MAX;
      if(ratedLightMinInput) ratedLightMinInput.value = RATED_LIGHTNESS_BOOST_MIN;
      if(ratedLightMaxInput) ratedLightMaxInput.value = RATED_LIGHTNESS_BOOST_MAX;
      if(lSlider) lSlider.value = LIGHTNESS_FACTOR;
      if(lVal) lVal.textContent = Number(LIGHTNESS_FACTOR).toFixed(2);
      if(typeof cfg.darkBgColor === 'string') {
        DARK_BG_COLOR = cfg.darkBgColor;
        document.documentElement.style.setProperty('--bg-dark', DARK_BG_COLOR);
      }
      if(typeof cfg.lightBgColor === 'string') {
        LIGHT_BG_COLOR = cfg.lightBgColor;
        document.documentElement.style.setProperty('--bg-light', LIGHT_BG_COLOR);
      }
      if(typeof cfg.glowFreq === 'number') GLOW_FREQ = cfg.glowFreq;
      if(typeof cfg.glowAmp === 'number') GLOW_AMP = cfg.glowAmp;
      if(typeof cfg.fontSize === 'number') FONT_SIZE = cfg.fontSize;
      if(typeof cfg.ratedSizeMultiplierMin === 'number') RATED_SIZE_MULTIPLIER_MIN = cfg.ratedSizeMultiplierMin;
      if(typeof cfg.ratedSizeMultiplierMax === 'number') RATED_SIZE_MULTIPLIER_MAX = cfg.ratedSizeMultiplierMax;
      if(typeof cfg.ratedLightnessBoostMin === 'number') RATED_LIGHTNESS_BOOST_MIN = cfg.ratedLightnessBoostMin;
      if(typeof cfg.ratedLightnessBoostMax === 'number') RATED_LIGHTNESS_BOOST_MAX = cfg.ratedLightnessBoostMax;
      console.log('Loaded config.json', cfg);
    }
  }catch(e){
    console.warn('config.json not loaded, using defaults', e);
  }
  loadConfigAndWords();
}

async function loadConfigAndWords(){
  // Don't reload config, just use current UI/variable values

  // Try to load vietnamese words list (comma-separated)
  let sourceWords = null;
  try{
    const txtResp = await fetch('vietnamese_words.txt');
    if(txtResp.ok){
      const body = await txtResp.text();
      sourceWords = body.split(',').map(s=>s.trim()).filter(Boolean);
      console.log('Loaded vietnamese_words.txt', sourceWords.length, 'words');
    }
  }catch(e){
    console.warn('vietnamese_words.txt not loaded, using fallback', e);
  }

  // Try to load per-word colors
  try{
    const cResp = await fetch('word_colors.txt');
    if(cResp.ok){
      const txt = await cResp.text();
      const lines = txt.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
      for(const line of lines){
        const idx = line.indexOf(':');
        if(idx<=0) continue;
        const key = line.slice(0,idx).trim().toLowerCase();
        const val = line.slice(idx+1).trim();
        // parse hsl(h,s%,l%)
        const m = /hsl\(\s*([\d.\-]+)\s*,\s*([\d.\-]+)%\s*,\s*([\d.\-]+)%\s*\)/i.exec(val);
        if(m){
          COLORS_MAP[key] = { h: Number(m[1]), s: Number(m[2]), l: Number(m[3]) };
        } else {
          // store raw value as fallback
          COLORS_MAP[key] = { raw: val };
        }
      }
      console.log('Loaded word_colors.txt', Object.keys(COLORS_MAP).length, 'entries');
    }
  }catch(e){
    console.warn('word_colors.txt not loaded', e);
  }

  // Build the source array
  const source = [];
  if(sourceWords && sourceWords.length>0){
    while(source.length < WORD_COUNT){ source.push(...sourceWords); }
  } else {
    while(source.length < WORD_COUNT){ source.push(...wordsList); }
  }

  // tiled positions with configurable randomness
  const margin = 18;
  
  // clamp randomness to 0..20 (slider ranges 0..20)
  X_RANDOMNESS = Math.min(20, Math.max(0, Number(X_RANDOMNESS) || 0));
  Y_RANDOMNESS = Math.min(20, Math.max(0, Number(Y_RANDOMNESS) || 0));

  // determine grid size (use mobile-specific layout if on mobile)
  let cols, rows;
  if(isMobile){
    cols = MOBILE_COLS;
    rows = MOBILE_ROWS;
  } else {
    cols = Math.ceil(Math.sqrt(WORD_COUNT));
    rows = Math.ceil(WORD_COUNT / cols);
  }
  const availableW = Math.max(0, window.innerWidth - margin*2);
  const availableH = Math.max(0, window.innerHeight - margin*2);
  const tileW = availableW / cols;
  const tileH = availableH / rows;
  
  // Calculate optimal font size to prevent overlaps
  // Find the longest word to use for sizing calculation
  let longestWord = '';
  let maxLength = 0;
  for(let i = 0; i < Math.min(WORD_COUNT, source.length); i++){
    const word = source[i % source.length] || '';
    if(word.length > maxLength){
      maxLength = word.length;
      longestWord = word;
    }
  }
  
  // Start with a test font size and measure
  let testFontSize = isMobile ? 20 : 28;
  let testFont = `${testFontSize}px system-ui,Segoe UI,Roboto,Arial`;
  ctx.font = testFont;
  let testWidth = ctx.measureText(longestWord).width;
  
  // Calculate font size that fits within tile with some padding
  // Account for randomness - words can move within their tile
  const effectiveTileW = tileW * (1 - X_RANDOMNESS * 0.5);
  const effectiveTileH = tileH * (1 - Y_RANDOMNESS * 0.5);
  
  // Scale font size to fit width with 20% padding
  const targetWidth = effectiveTileW * 0.8;
  const targetHeight = effectiveTileH * 0.6;
  
  let calculatedFontSize = (testFontSize * targetWidth) / testWidth;
  
  // Also limit by height (font size should be smaller than tile height)
  calculatedFontSize = Math.min(calculatedFontSize, targetHeight);
  
  // Apply reasonable bounds and account for rated word multipliers
  const minSize = isMobile ? 10 : 12;
  const maxSize = isMobile ? 24 : 32;
  calculatedFontSize = Math.max(minSize, Math.min(maxSize, calculatedFontSize));
  
  // Update FONT_SIZE if we're auto-calculating (don't override user config)
  if(isMobile || FONT_SIZE === 24){
    FONT_SIZE = Math.floor(calculatedFontSize);
  }
  
  const fontSize = FONT_SIZE;
  const font = `${fontSize}px system-ui,Segoe UI,Roboto,Arial`;

  words = [];
  for(let i=0;i<WORD_COUNT;i++){
    const raw = source[i % source.length] || '';
    const text = raw.length ? (raw.charAt(0).toUpperCase() + raw.slice(1)) : raw;

    const col = i % cols;
    const row = Math.floor(i / cols);
    const centerX = margin + (col + 0.5) * tileW;
    const centerY = margin + (row + 0.5) * tileH;

    const maxOffsetX = (tileW / 2) * X_RANDOMNESS;
    const maxOffsetY = (tileH / 2) * Y_RANDOMNESS;
    const dx = (Math.random() * 2 - 1) * maxOffsetX;
    const dy = (Math.random() * 2 - 1) * maxOffsetY;

    const x = Math.min(Math.max(centerX + dx, margin + 4), window.innerWidth - margin - 4);
    const y = Math.min(Math.max(centerY + dy, margin + 14), window.innerHeight - margin - 4);

    const phaseX = Math.random() * Math.PI * 2;
    const phaseY = Math.random() * Math.PI * 2;
    const w = new FloatingWord(text, x, y, phaseX, phaseY);
    w.measure(font);
    words.push(w);
  }
}

let start = performance.now();

function drawFrame(now){
  const t = now - start;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  
  // Apply camera transform
  ctx.save();
  ctx.translate(camera.x, camera.y);
  ctx.scale(camera.zoom, camera.zoom);

  const baseFontSize = FONT_SIZE;

  // draw words, using AMPLITUDE & FREQUENCY loaded from config
  for(const w of words){
    // Determine font size and lightness boost based on rating (linear interpolation)
    let sizeMultiplier = 1;
    let lightnessBoost = 0;
    if(w.rating !== null){
      // Map rating 1-5 to min-max range
      const t = (w.rating - 1) / 4; // normalize to 0-1
      sizeMultiplier = RATED_SIZE_MULTIPLIER_MIN + t * (RATED_SIZE_MULTIPLIER_MAX - RATED_SIZE_MULTIPLIER_MIN);
      lightnessBoost = RATED_LIGHTNESS_BOOST_MIN + t * (RATED_LIGHTNESS_BOOST_MAX - RATED_LIGHTNESS_BOOST_MIN);
    }
    const fontSize = baseFontSize * sizeMultiplier;
    const font = `${fontSize}px system-ui,Segoe UI,Roboto,Arial`;
    
    // calculate glow effect (sine wave modulating lightness)
    const glowOffset = Math.sin(GLOW_FREQ * now + w.glowPhase) * GLOW_AMP;
    let effectiveLightness = Math.max(0, Math.min(1, LIGHTNESS_FACTOR + glowOffset));
    
    // Add lightness boost for rated words
    effectiveLightness = Math.min(1, effectiveLightness + lightnessBoost);
    
    // determine color for this word (match by lowercased text)
    const key = (w.text || '').toLowerCase();
    let colorStr = '#e6eef8';
    const entry = COLORS_MAP[key];
    if(entry){
      if(entry.h !== undefined){
        const s = Number(effectiveLightness);
        let L;
        if (s === 0.5 || isNaN(s)) {
          L = entry.l;
        } else if (s > 0.5) {
          // interpolate from original L to white (100%) as s goes from 0.5 -> 1
          L = entry.l + (100 - entry.l) * ((s - 0.5) / 0.5);
        } else {
          // s < 0.5: interpolate from black (0%) to original L as s goes from 0 -> 0.5
          L = entry.l * (s / 0.5);
        }
        L = Math.max(0, Math.min(100, L));
        colorStr = `hsl(${entry.h},${entry.s}%,${L}%)`;
      } else if(entry.raw){
        // for non-HSL raw values: if lightness is extreme use black/white, if 0.5 keep original
        const s = Number(effectiveLightness);
        if (s === 1) colorStr = '#ffffff';
        else if (s === 0) colorStr = '#000000';
        else colorStr = entry.raw;
      }
    }
    w.draw(now, font, colorStr, fontSize);
  }
  
  ctx.restore();

  requestAnimationFrame(drawFrame);
}

// Mouse cursor handling for hover
canvas.addEventListener('mousemove', (ev)=>{
  const pos = getCanvasPos(ev);
  const worldPos = screenToWorld(pos.x, pos.y);
  let isHovering = false;
  for(let i=words.length-1;i>=0;i--){
    if(words[i].contains(worldPos.x, worldPos.y)){
      isHovering = true;
      break;
    }
  }
  canvas.style.cursor = isHovering ? 'pointer' : 'default';
});

// Load config, then load words and start animation
loadConfig().then(()=>{
  return loadConfigAndWords();
}).then(()=>{
  requestAnimationFrame(drawFrame);
}).catch((e)=>{
  console.error('Failed to load config/words', e);
  requestAnimationFrame(drawFrame);
});

// click / touch handler
function getCanvasPos(evt){
  const rect = canvas.getBoundingClientRect();
  const clientX = (evt.touches ? evt.touches[0].clientX : evt.clientX);
  const clientY = (evt.touches ? evt.touches[0].clientY : evt.clientY);
  const x = (clientX - rect.left);
  const y = (clientY - rect.top);
  return {x, y};
}

// Transform screen coordinates to world coordinates (accounting for camera)
function screenToWorld(screenX, screenY){
  return {
    x: (screenX - camera.x) / camera.zoom,
    y: (screenY - camera.y) / camera.zoom
  };
}

function openModalFor(word){
  // show the question and include the word to rate
  modalWord.textContent = `Theo bạn, từ "${word.text}" phù hợp với bạn tới mức nào?`;
  modal.classList.remove('hidden');
  modal.scrollTop = 0;
  // store current word on form
  ratingForm.dataset.word = word.text;
  // initialize selection - show previous rating if exists, otherwise default
  clearRatingSelection();
  if(word.rating !== null && word.rating > 0){
    // Show previous rating
    setRatingSelection(String(word.rating));
  } else {
    // Show default selection
    const def = ratingForm.querySelector('.rating-btn[data-default]');
    if(def && def.getAttribute('data-value')){
      setRatingSelection(def.getAttribute('data-value'));
    }
  }
}

function submitRatingValue(value){
  const rating = Number(value);
  const word = ratingForm.dataset.word || '';
  ratings.push({word, rating: Number(rating), ts: Date.now()});
  // Find the word object and store the rating
  const wordObj = words.find(w => w.text === word);
  if(wordObj) wordObj.rating = rating;
  console.log('rating saved', ratings[ratings.length-1]);
  modal.classList.add('hidden');
  // clear selection after submit to reset UI for next time
  clearRatingSelection();
}

canvas.addEventListener('click', (ev)=>{
  // Prevent click if it's within 500ms of a touch tap (prevents double-trigger on mobile)
  if(Date.now() - lastTapTime < 500){
    ev.preventDefault();
    ev.stopPropagation();
    return;
  }
  
  const pos = getCanvasPos(ev);
  const worldPos = screenToWorld(pos.x, pos.y);
  for(let i=words.length-1;i>=0;i--){
    if(words[i].contains(worldPos.x, worldPos.y)){
      openModalFor(words[i]);
      break;
    }
  }
});

cancelBtn.addEventListener('click', ()=>{
  // hide modal and clear any temporary selection
  modal.classList.add('hidden');
  clearRatingSelection();
});

// Clear rating button
const clearRatingBtn = document.getElementById('clear-rating');
if(clearRatingBtn){
  clearRatingBtn.addEventListener('click', ()=>{
    const word = ratingForm.dataset.word || '';
    const wordObj = words.find(w => w.text === word);
    if(wordObj){
      wordObj.rating = null; // Clear the rating
      console.log('Rating cleared for:', word);
    }
    modal.classList.add('hidden');
    clearRatingSelection();
  });
}

// clicking on overlay (outside modal-inner) should act like Cancel
modal.addEventListener('click', (ev)=>{
  if(ev.target === modal){
    modal.classList.add('hidden');
    clearRatingSelection();
  }
});

const ratings = [];

// handle form submit (fallback if using Submit button)
ratingForm.addEventListener('submit', (ev)=>{
  ev.preventDefault();
  // try data-rating attribute on form (set by buttons), otherwise ignore
  const rating = ratingForm.dataset.rating;
  if(rating) submitRatingValue(rating);
});

// rating buttons: click to select (do NOT submit immediately)
function clearRatingSelection(){
  ratingForm.dataset.rating = '';
  const sel = ratingForm.querySelectorAll('.rating-btn.selected');
  sel.forEach(b=>b.classList.remove('selected'));
}

function setRatingSelection(value){
  clearRatingSelection();
  ratingForm.dataset.rating = String(value);
  const btn = ratingForm.querySelector(`.rating-btn[data-value="${value}"]`);
  if(btn) btn.classList.add('selected');
}

// attach button handlers (delegated)
const ratingRadios = document.querySelector('.rating-radios');
if(ratingRadios){
  ratingRadios.addEventListener('click', (ev)=>{
    const btn = ev.target.closest && ev.target.closest('.rating-btn');
    if(!btn) return;
    const v = btn.getAttribute('data-value');
    if(!v) return;
    // select/deselect
    setRatingSelection(v);
  });
}

// handle orientation/size change re-init measurements
window.addEventListener('orientationchange', ()=>{ resize(); loadConfigAndWords(); });

// ===== PAN AND ZOOM FUNCTIONALITY =====

// Mouse wheel zoom
canvas.addEventListener('wheel', (ev)=>{
  ev.preventDefault();
  const pos = getCanvasPos(ev);
  const worldPosBefore = screenToWorld(pos.x, pos.y);
  
  const zoomFactor = ev.deltaY > 0 ? 0.9 : 1.1;
  camera.zoom = Math.max(0.1, Math.min(5, camera.zoom * zoomFactor));
  
  // Adjust camera position to zoom toward mouse position
  const worldPosAfter = screenToWorld(pos.x, pos.y);
  camera.x += (worldPosAfter.x - worldPosBefore.x) * camera.zoom;
  camera.y += (worldPosAfter.y - worldPosBefore.y) * camera.zoom;
}, {passive: false});

// Mouse pan
let isPanning = false;
let panStart = {x: 0, y: 0};

canvas.addEventListener('mousedown', (ev)=>{
  // Right click or middle click to pan
  if(ev.button === 2 || ev.button === 1){
    ev.preventDefault();
    isPanning = true;
    panStart = {x: ev.clientX, y: ev.clientY};
    canvas.style.cursor = 'grabbing';
  }
});

canvas.addEventListener('mousemove', (ev)=>{
  if(isPanning){
    const dx = ev.clientX - panStart.x;
    const dy = ev.clientY - panStart.y;
    camera.x += dx;
    camera.y += dy;
    panStart = {x: ev.clientX, y: ev.clientY};
  }
});

canvas.addEventListener('mouseup', (ev)=>{
  if(isPanning){
    isPanning = false;
    canvas.style.cursor = 'default';
  }
});

canvas.addEventListener('mouseleave', ()=>{
  if(isPanning){
    isPanning = false;
    canvas.style.cursor = 'default';
  }
});

// Prevent context menu on right-click
canvas.addEventListener('contextmenu', (ev)=>{
  ev.preventDefault();
});

// Touch gestures for pan and zoom
let touchState = {
  touching: false,
  lastTouches: [],
  initialDistance: 0
};

let lastTapTime = 0; // Track last tap to prevent click event after touch

canvas.addEventListener('touchstart', (ev)=>{
  if(ev.touches.length === 1){
    // Single touch - could be tap or pan
    touchState.touching = true;
    touchState.lastTouches = Array.from(ev.touches).map(t => ({x: t.clientX, y: t.clientY}));
    touchState.startTime = Date.now();
    touchState.startPos = {x: ev.touches[0].clientX, y: ev.touches[0].clientY};
  } else if(ev.touches.length === 2){
    // Two-finger gesture - zoom/pan
    ev.preventDefault();
    touchState.touching = true;
    touchState.lastTouches = Array.from(ev.touches).map(t => ({x: t.clientX, y: t.clientY}));
    const dx = ev.touches[1].clientX - ev.touches[0].clientX;
    const dy = ev.touches[1].clientY - ev.touches[0].clientY;
    touchState.initialDistance = Math.sqrt(dx*dx + dy*dy);
  }
}, {passive: false});

canvas.addEventListener('touchmove', (ev)=>{
  if(!touchState.touching) return;
  
  if(ev.touches.length === 1 && touchState.lastTouches.length === 1){
    // Single finger pan - check if moved enough to be a pan
    const moveDistance = Math.sqrt(
      Math.pow(ev.touches[0].clientX - touchState.startPos.x, 2) +
      Math.pow(ev.touches[0].clientY - touchState.startPos.y, 2)
    );
    
    if(moveDistance > 10){
      // It's a pan
      ev.preventDefault();
      const dx = ev.touches[0].clientX - touchState.lastTouches[0].x;
      const dy = ev.touches[0].clientY - touchState.lastTouches[0].y;
      camera.x += dx;
      camera.y += dy;
      touchState.lastTouches = [{x: ev.touches[0].clientX, y: ev.touches[0].clientY}];
    }
  } else if(ev.touches.length === 2 && touchState.lastTouches.length === 2){
    // Two-finger pinch zoom and pan
    ev.preventDefault();
    
    // Calculate center point
    const centerX = (ev.touches[0].clientX + ev.touches[1].clientX) / 2;
    const centerY = (ev.touches[0].clientY + ev.touches[1].clientY) / 2;
    const lastCenterX = (touchState.lastTouches[0].x + touchState.lastTouches[1].x) / 2;
    const lastCenterY = (touchState.lastTouches[0].y + touchState.lastTouches[1].y) / 2;
    
    // Pan based on center movement
    const dx = centerX - lastCenterX;
    const dy = centerY - lastCenterY;
    camera.x += dx;
    camera.y += dy;
    
    // Zoom based on distance change
    const dx2 = ev.touches[1].clientX - ev.touches[0].clientX;
    const dy2 = ev.touches[1].clientY - ev.touches[0].clientY;
    const distance = Math.sqrt(dx2*dx2 + dy2*dy2);
    
    if(touchState.initialDistance > 0){
      const rect = canvas.getBoundingClientRect();
      const canvasX = centerX - rect.left;
      const canvasY = centerY - rect.top;
      const worldPosBefore = screenToWorld(canvasX, canvasY);
      
      const zoomFactor = distance / touchState.initialDistance;
      camera.zoom = Math.max(0.1, Math.min(5, camera.zoom * zoomFactor));
      
      const worldPosAfter = screenToWorld(canvasX, canvasY);
      camera.x += (worldPosAfter.x - worldPosBefore.x) * camera.zoom;
      camera.y += (worldPosAfter.y - worldPosBefore.y) * camera.zoom;
    }
    
    touchState.initialDistance = distance;
    touchState.lastTouches = Array.from(ev.touches).map(t => ({x: t.clientX, y: t.clientY}));
  }
}, {passive: false});

canvas.addEventListener('touchend', (ev)=>{
  if(ev.touches.length === 0){
    // Check if it was a quick tap (not a pan)
    if(touchState.startTime && (Date.now() - touchState.startTime) < 300){
      const moveDistance = Math.sqrt(
        Math.pow(touchState.lastTouches[0].x - touchState.startPos.x, 2) +
        Math.pow(touchState.lastTouches[0].y - touchState.startPos.y, 2)
      );
      
      if(moveDistance < 10){
        // It's a tap - check for word click
        lastTapTime = Date.now(); // Mark tap time to prevent click event
        const rect = canvas.getBoundingClientRect();
        const canvasX = touchState.startPos.x - rect.left;
        const canvasY = touchState.startPos.y - rect.top;
        const worldPos = screenToWorld(canvasX, canvasY);
        
        for(let i=words.length-1;i>=0;i--){
          if(words[i].contains(worldPos.x, worldPos.y)){
            openModalFor(words[i]);
            break;
          }
        }
      }
    }
    
    touchState.touching = false;
    touchState.lastTouches = [];
  } else if(ev.touches.length === 1){
    // One finger lifted, reset for potential single-touch pan
    touchState.lastTouches = [{x: ev.touches[0].clientX, y: ev.touches[0].clientY}];
    touchState.initialDistance = 0;
  }
}, {passive: false});
