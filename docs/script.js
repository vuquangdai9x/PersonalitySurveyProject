// Floating words canvas with modal rating
const WORD_COUNT = 100;
// defaults (may be overridden by config.json)
let AMPLITUDE = 18; // px
let FREQUENCY = 0.0018; // radians/ms, same for all words
// randomness 0..1 controlling how far from the tile center a word may appear
let X_RANDOMNESS = 1.0; // 0 = always center of tile on x, 1 = anywhere to tile boundary
let Y_RANDOMNESS = 1.0; // 0 = always center of tile on y, 1 = anywhere to tile boundary
// per-word color map loaded from word_colors.txt
let COLORS_MAP = {};
// lightness scaling factor 0..1 (multiplies color L component)
let LIGHTNESS_FACTOR = 1.0;

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

const ctx = canvas.getContext('2d');

let DPR = Math.max(1, window.devicePixelRatio || 1);

function resize(){
  DPR = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * DPR);
  canvas.height = Math.floor(window.innerHeight * DPR);
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
window.addEventListener('resize', resize, {passive:true});
resize();

class FloatingWord{
  constructor(text,x,y,phase){
    this.text = text;
    this.baseX = x;
    this.baseY = y;
    this.phase = phase;
    this.width = 0; this.height = 0;
  }
  measure(font){
    ctx.font = font;
    const m = ctx.measureText(this.text);
    this.width = m.width;
    this.height = parseInt(font,10) || 16;
    this.halfWidth = this.width / 2;
    this.halfHeight = this.height / 2;
  }
  draw(time, font, color){
    ctx.font = font;
    const y = this.baseY + AMPLITUDE * Math.sin(FREQUENCY * time + this.phase);
    ctx.fillStyle = color;
    // center text on (baseX, y)
    const prevAlign = ctx.textAlign;
    const prevBaseline = ctx.textBaseline;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.text, this.baseX, y);
    // store bounding box (top-left)
    this.lastX = this.baseX - (this.width / 2);
    this.lastY = y - (this.height / 2);
    ctx.textAlign = prevAlign;
    ctx.textBaseline = prevBaseline;
  }
  contains(px,py){
    return px >= this.lastX && px <= this.lastX + this.width && py >= this.lastY && py <= this.lastY + this.height;
  }
}

let words = [];

// expose control elements (added in index.html)
const xSlider = document.getElementById('xSlider');
const ySlider = document.getElementById('ySlider');
const lSlider = document.getElementById('lSlider');
const xVal = document.getElementById('xVal');
const yVal = document.getElementById('yVal');
const lVal = document.getElementById('lVal');
const applyBtn = document.getElementById('applyBtn');

function bindControls(){
  if(!xSlider) return;
  xSlider.addEventListener('input', ()=>{ xVal.textContent = Number(xSlider.value).toFixed(2); });
  ySlider.addEventListener('input', ()=>{ yVal.textContent = Number(ySlider.value).toFixed(2); });
  lSlider.addEventListener('input', ()=>{ lVal.textContent = Number(lSlider.value).toFixed(2); });
  applyBtn.addEventListener('click', ()=>{
    X_RANDOMNESS = Number(xSlider.value);
    Y_RANDOMNESS = Number(ySlider.value);
    LIGHTNESS_FACTOR = Number(lSlider.value);
    // recompute positions with new randomness
    loadConfigAndWords();
  });
}
bindControls();


async function loadConfigAndWords(){
  // Try to load config.json to override amplitude and frequency
  try{
    const cfgResp = await fetch('config.json');
    if(cfgResp.ok){
      const cfg = await cfgResp.json();
      if(typeof cfg.amplitude === 'number') AMPLITUDE = cfg.amplitude;
      if(typeof cfg.frequency === 'number') FREQUENCY = cfg.frequency;
      if(typeof cfg.xRandomness === 'number') X_RANDOMNESS = cfg.xRandomness;
      if(typeof cfg.yRandomness === 'number') Y_RANDOMNESS = cfg.yRandomness;
      if(typeof cfg.lightness === 'number') LIGHTNESS_FACTOR = cfg.lightness;
      console.log('Loaded config.json', cfg);
    }
  }catch(e){
    console.warn('config.json not loaded, using defaults', e);
  }

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
  const fontSize = Math.max(12, Math.min(28, Math.round(window.innerWidth / 40)));
  const font = `${fontSize}px system-ui,Segoe UI,Roboto,Arial`;

  // clamp randomness to 0..1
  X_RANDOMNESS = Math.min(1, Math.max(0, Number(X_RANDOMNESS) || 0));
  Y_RANDOMNESS = Math.min(1, Math.max(0, Number(Y_RANDOMNESS) || 0));

  // determine grid size
  const cols = Math.ceil(Math.sqrt(WORD_COUNT));
  const rows = Math.ceil(WORD_COUNT / cols);
  const availableW = Math.max(0, window.innerWidth - margin*2);
  const availableH = Math.max(0, window.innerHeight - margin*2);
  const tileW = availableW / cols;
  const tileH = availableH / rows;

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

    const phase = Math.random() * Math.PI * 2;
    const w = new FloatingWord(text, x, y, phase);
    w.measure(font);
    words.push(w);
  }
}

let start = performance.now();

function drawFrame(now){
  const t = now - start;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // background subtle gradient
  const g = ctx.createLinearGradient(0,0,0,canvas.height/DPR);
  g.addColorStop(0, 'rgba(255,255,255,0.02)');
  g.addColorStop(1, 'rgba(0,0,0,0.02)');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,canvas.width/DPR,canvas.height/DPR);

  const fontSize = Math.max(12, Math.min(28, Math.round(window.innerWidth / 40)));
  const font = `${fontSize}px system-ui,Segoe UI,Roboto,Arial`;

  // draw words, using AMPLITUDE & FREQUENCY loaded from config
  for(const w of words){
    // determine color for this word (match by lowercased text)
    const key = (w.text || '').toLowerCase();
    let colorStr = '#e6eef8';
    const entry = COLORS_MAP[key];
    if(entry){
      if(entry.h !== undefined){
        const s = Number(LIGHTNESS_FACTOR);
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
        const s = Number(LIGHTNESS_FACTOR);
        if (s === 1) colorStr = '#ffffff';
        else if (s === 0) colorStr = '#000000';
        else colorStr = entry.raw;
      }
    }
    w.draw(now, font, colorStr);
  }

  requestAnimationFrame(drawFrame);
}

// load before starting animation
loadConfigAndWords().then(()=>{
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

function openModalFor(word){
  // show the question and include the word to rate
  modalWord.textContent = `Theo bạn, từ "${word.text}" phù hợp với bạn tới mức nào?`;
  modal.classList.remove('hidden');
  modal.scrollTop = 0;
  // store current word on form
  ratingForm.dataset.word = word.text;
  // initialize selection to default (if present) so user can reselect freely
  // clear any previous selection first
  clearRatingSelection();
  const def = ratingForm.querySelector('.rating-btn[data-default]');
  if(def && def.getAttribute('data-value')){
    setRatingSelection(def.getAttribute('data-value'));
  }
}

function submitRatingValue(value){
  const rating = Number(value);
  const word = ratingForm.dataset.word || '';
  ratings.push({word, rating: Number(rating), ts: Date.now()});
  console.log('rating saved', ratings[ratings.length-1]);
  modal.classList.add('hidden');
  // clear selection after submit to reset UI for next time
  clearRatingSelection();
}

canvas.addEventListener('click', (ev)=>{
  const pos = getCanvasPos(ev);
  for(let i=words.length-1;i>=0;i--){
    if(words[i].contains(pos.x, pos.y)){
      openModalFor(words[i]);
      break;
    }
  }
});

// touch support
canvas.addEventListener('touchstart', (ev)=>{
  const pos = getCanvasPos(ev);
  for(let i=words.length-1;i>=0;i--){
    if(words[i].contains(pos.x, pos.y)){
      openModalFor(words[i]);
      ev.preventDefault();
      break;
    }
  }
}, {passive:false});

cancelBtn.addEventListener('click', ()=>{
  // hide modal and clear any temporary selection
  modal.classList.add('hidden');
  clearRatingSelection();
});

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
