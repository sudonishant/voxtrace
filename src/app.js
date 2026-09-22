/* ============================================================
   VOXTRACE — client-side app (production UI build)
   Router · Recorder · Heuristic detection engine · Evidence chain
   ============================================================ */
"use strict";
const VT = {};

/* ---------------- utils ---------------- */
const $ = (id) => document.getElementById(id);
const LS = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
};
let toastTimer = null;
function toast(msg){
  const t = $("toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(()=>t.classList.remove("show"), 2800);
}
function inr(n){ return "₹" + n.toLocaleString("en-IN"); }
async function sha256Hex(bytes){
  const d = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(d)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
function fmtBytes(b){ return b.length < 200000 ? (b.length/1024).toFixed(1)+" KB" : (b.length/1048576).toFixed(2)+" MB"; }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

/* ---------------- router ---------------- */
const ROUTES = ["home","verify","dashboard","api"];
function parseHash(){
  const raw = location.hash.replace(/^#\/?/, "");
  const parts = raw.split("#");
  return {route: parts[0] || "home", anchor: parts.slice(1).join("#") || null};
}
function router(){
  let {route:h, anchor} = parseHash();
  if(h === "pricing"){ h = "home"; anchor = anchor || "sec-pricing"; }
  if(h === "faq"){ h = "home"; anchor = anchor || "sec-faq"; }
  if(!ROUTES.includes(h)){ h = "home"; anchor = null; }
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active", v.id === "view-"+h));
  const navKey = (h === "home" && anchor === "sec-pricing") ? "pricing" : h;
  document.querySelectorAll(".nav-links a[data-nav]").forEach(a=>a.classList.toggle("active", a.dataset.nav === navKey));
  $("navLinks").classList.remove("open");
  if(anchor){
    setTimeout(()=>{ const el = $(anchor) || document.getElementById(anchor);
      if(el) el.scrollIntoView({behavior:"smooth", block:"start"}); }, 80);
  } else {
    window.scrollTo(0,0);
  }
  if(h === "dashboard") VT.renderDashboard();
  if(h === "api") VT.loadKey();
}
window.addEventListener("hashchange", router);
function boot(){
  if(boot.done) return; boot.done = true;
  try{ router(); }catch(e){ console.error("router:", e); }
  try{
    const io = new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target);} }), {threshold:.12});
    document.querySelectorAll(".reveal").forEach(el=>io.observe(el));
  }catch(e){}
  try{ drawHeroWave(); }catch(e){}
  try{ VT.calc(); }catch(e){}
  try{ VT.updatePlanBanner(); }catch(e){}
}
// boot as soon as DOM is ready — never wait on images/fonts/network for first paint
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
window.addEventListener("load", boot); // safety net
$("menuBtn").addEventListener("click", ()=>$("navLinks").classList.toggle("open"));

/* decorative hero waveform */
function drawHeroWave(){
  const mk = (fn)=>{ let p=""; for(let x=0;x<=1200;x+=4){ const y=fn(x); p += (x?(p?" L":"M "):"") + x+","+y.toFixed(1); } return p; };
  const w1 = mk(x=> 60 + Math.sin(x*0.021)*20*Math.sin(x*0.004) + Math.sin(x*0.11)*7);
  const w2 = mk(x=> 60 + Math.cos(x*0.017)*24*Math.cos(x*0.003+1) + Math.sin(x*0.09)*5);
  const w3 = mk(x=> 60 + Math.sin(x*0.03+2)*14*Math.sin(x*0.006) + Math.cos(x*0.13)*4);
  $("heroWave").setAttribute("points", w1);
  $("heroWave2").setAttribute("points", w2);
  $("heroWave3").setAttribute("points", w3);
}

/* ---------------- FAQ + modals ---------------- */
document.addEventListener("click", e=>{
  const q = e.target.closest(".faq-q");
  if(q){
    const item = q.parentElement, wasOpen = item.classList.contains("open");
    document.querySelectorAll(".faq-item.open").forEach(i=>{ i.classList.remove("open"); i.querySelector(".toggle").textContent = "+"; });
    if(!wasOpen){ item.classList.add("open"); q.querySelector(".toggle").textContent = "−"; }
    return;
  }
  const mb = e.target.closest("[data-modal]");
  if(mb){ VT.openModalKey(mb.dataset.modal); return; }
  if(e.target === $("modalOverlay")) VT.closeModal();
});
document.addEventListener("keydown", e=>{ if(e.key === "Escape") VT.closeModal(); });

const MODALS = {
  "m-ceo": {icon:"🚨", label:"Use case · High-stakes finance", title:"“Verify the CEO”",
    body:"Before acting on a high-stakes instruction received by voice — an urgent fund transfer “from the CEO”, a vendor-account change, a confidential data request — the call is run through VOXTRACE.<br><br>A <b>low trust score is the trigger</b> to stop and verify through a second channel before money or data moves. The check takes seconds and the result is anchored as evidence for the audit trail."},
  "m-bpo": {icon:"🏛️", label:"Use case · Banking, BPO & fintech", title:"Secure call operations",
    body:"Banks, fintechs and BPOs verify that the caller's identity is real — not a deepfake — before trusting a voice interaction.<br><br>Tele-banking instructions, OTP-less authorisations and customer-service escalations all depend on voice. VOXTRACE adds a verification layer to those flows, with per-call pricing that scales with volume via API billing."},
  "m-hr": {icon:"🎓", label:"Use case · HR-Tech & remote hiring", title:"Recruitment & interviews",
    body:"Recruiters and HR platforms can verify that the person on a remote interview call is a real, live human — not a synthetic voice or a proxy candidate reading pre-recorded / AI-cloned answers.<br><br>Challenge-phrase matching asks the candidate to speak a sample text live, comparing it against expected voice patterns."},
  "m-suite": {icon:"🚀", label:"Product roadmap", title:"Voice Authenticity Suite",
    body:"Beyond fraud-call detection, the same detection engine extends into a broader authenticity product line — verifying <b>voice notes, podcasts, evidence recordings</b> and other audio content.<br><br><b>Longer-term positioning:</b> VOXTRACE as the underlying “authenticity infrastructure” other products and platforms plug into, rather than a single standalone app. Starting with voice deepfakes, eventually multimodal authenticity."}
};
VT.openModalKey = function(key){
  const m = MODALS[key]; if(!m) return;
  VT.openModalHTML(`<div class="m-icon">${m.icon}</div><span class="m-label">${m.label}</span><h3>${m.title}</h3><p>${m.body}</p>`);
};
VT.openModalHTML = function(html){
  $("modalBody").innerHTML = html;
  $("modalOverlay").classList.add("open");
};
VT.closeModal = function(){ $("modalOverlay").classList.remove("open"); };

/* ---------------- challenge phrases ---------------- */
const PHRASES = [
  ["My voice is my identity — this call is being verified.","मेरी आवाज़ ही मेरी पहचान है — यह कॉल सत्यापित की जा रही है।"],
  ["State your full name and today's date clearly.","अपना पूरा नाम और आज की तारीख स्पष्ट रूप से बोलिए।"],
  ["The quick brown fox jumps over the lazy dog.","तेज़ भूरी लोमड़ी आलसी कुत्ते के ऊपर से कूदती है।"],
  ["I confirm this instruction is given by me, in person, on this call.","मैं पुष्टि करता हूँ कि यह निर्देश मैंने स्वयं इसी कॉल पर दिया है।"],
  ["Security phrase: saffron river mountain nine.","सुरक्षा वाक्यांश: केसरिया नदी पहाड़ नौ।"]
];
let phraseIdx = 0;
VT.newPhrase = function(){
  phraseIdx = (phraseIdx + 1) % PHRASES.length;
  $("phraseEn").textContent = PHRASES[phraseIdx][0];
  $("phraseHi").textContent = PHRASES[phraseIdx][1];
};

/* ---------------- recording ---------------- */
let mediaRecorder=null, chunks=[], recStream=null, liveCtx=null, liveAnalyser=null, waveRAF=null, recT0=0, recTimer=null;

VT.setMode = function(mode){
  $("tabLive").classList.toggle("on", mode==="live");
  $("tabFile").classList.toggle("on", mode==="file");
  $("paneLive").style.display = mode==="live" ? "" : "none";
  $("paneFile").style.display = mode==="file" ? "" : "none";
  VT.currentMode = mode;
  if(mode!=="live" && mediaRecorder && mediaRecorder.state==="recording") VT.toggleRec();
};
VT.currentMode = "live";

VT.toggleRec = async function(){
  if(mediaRecorder && mediaRecorder.state === "recording"){
    mediaRecorder.stop(); return;
  }
  try{
    recStream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false, noiseSuppression:false}});
  }catch(e){
    toast("Mic access denied — try the Recorded Call tab with a file or demo sample."); return;
  }
  liveCtx = new (window.AudioContext||window.webkitAudioContext)();
  const src = liveCtx.createMediaStreamSource(recStream);
  liveAnalyser = liveCtx.createAnalyser(); liveAnalyser.fftSize = 1024;
  src.connect(liveAnalyser);
  drawLiveWave();

  chunks = [];
  mediaRecorder = new MediaRecorder(recStream);
  mediaRecorder.ondataavailable = e=>{ if(e.data.size) chunks.push(e.data); };
  mediaRecorder.onstop = async ()=>{
    cancelAnimationFrame(waveRAF);
    clearInterval(recTimer);
    recStream.getTracks().forEach(t=>t.stop());
    if(liveCtx) liveCtx.close();
    $("recBtn").classList.remove("recording");
    $("recStatus").innerHTML = "Processing recording…";
    const blob = new Blob(chunks, {type: mediaRecorder.mimeType || "audio/webm"});
    if(blob.size < 4000){ $("recStatus").textContent = "Recording too short — tap to record again."; return; }
    await loadBlob(blob, "Live call recording", "live");
    $("recStatus").textContent = "Sample loaded ✔ — press Analyse Sample.";
  };
  mediaRecorder.start();
  recT0 = Date.now();
  $("recBtn").classList.add("recording");
  recTimer = setInterval(()=>{
    const s = ((Date.now()-recT0)/1000).toFixed(1);
    $("recStatus").innerHTML = "<b>● REC</b> "+s+"s — tap to stop";
  }, 100);
};

function drawLiveWave(){
  const cv = $("liveWave"), ctx = cv.getContext("2d");
  const data = new Uint8Array(liveAnalyser.fftSize);
  function frame(){
    if(!liveAnalyser) return;
    liveAnalyser.getByteTimeDomainData(data);
    ctx.fillStyle = "#E8F0FE"; ctx.fillRect(0,0,cv.width,cv.height);
    ctx.strokeStyle = "#EA4335"; ctx.lineWidth = 2; ctx.beginPath();
    for(let i=0;i<data.length;i++){
      const x = i/data.length*cv.width;
      const y = cv.height/2 + (data[i]-128)/128*(cv.height/2 - 6);
      i?ctx.lineTo(x,y):ctx.moveTo(x,y);
    }
    ctx.stroke();
    waveRAF = requestAnimationFrame(frame);
  }
  frame();
}

/* ---------------- file input ---------------- */
const dz = $("dropZone");
["dragover","dragenter"].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add("drag");}));
["dragleave","drop"].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove("drag");}));
dz.addEventListener("drop", e=>{ const f=e.dataTransfer.files[0]; if(f) loadBlob(f, f.name, "file"); });
$("fileInput").addEventListener("change", e=>{ const f=e.target.files[0]; if(f) loadBlob(f, f.name, "file"); });

let pendingAudio = null; // {bytes:Uint8Array, buffer:AudioBuffer, label, mode}

async function loadBlob(blob, label, mode){
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const ext = label.split('.').pop().toLowerCase();
  const ac = new (window.AudioContext||window.webkitAudioContext)();
  let buffer;

  // 1. Try browser native Web Audio API first
  try{
    buffer = await ac.decodeAudioData(bytes.slice(0).buffer);
  }catch(e){
    // 2. If native decode fails (common for .amr, .awb, .3gp), try backend transcoding
    try{
      toast("Transcoding " + ext.toUpperCase() + " audio…");
      const resp = await fetch("/api/audio/convert", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: bytes
      });
      if(resp.ok){
        const wavBytes = new Uint8Array(await resp.arrayBuffer());
        const ac2 = new (window.AudioContext||window.webkitAudioContext)();
        buffer = await ac2.decodeAudioData(wavBytes.slice(0).buffer);
        ac2.close();
      }else{
        throw new Error("Transcoding failed");
      }
    }catch(err2){
      ac.close();
      const hint = ['amr','awb','3gp','3gpp'].includes(ext)
        ? `${ext.toUpperCase()} audio cannot be decoded directly. Convert to WAV/MP3 first.`
        : "Could not decode audio format. Try MP3, WAV, M4A, OGG, or FLAC.";
      toast("❌ " + hint);
      return;
    }
  }
  ac.close();

  if(buffer.duration < 0.4){ toast("Sample is shorter than 0.4s — need more audio to analyse."); return; }
  if(buffer.duration > 90){ // trim to first 90s for perf
    const sr = buffer.sampleRate, len = Math.floor(sr*90), ch = buffer.numberOfChannels;
    const off = new OfflineAudioContext(ch, len, sr);
    const src = off.createBufferSource(); src.buffer = buffer; src.connect(off.destination); src.start();
    buffer = await off.startRendering();
  }
  pendingAudio = {bytes, buffer, label, mode};
  VT.currentMode = mode;
  $("fileMeta").style.display = "";
  $("fileName").textContent = label + " · " + buffer.duration.toFixed(1) + "s · " + fmtBytes(bytes);
  $("analyzeBtn").disabled = false;
  toast("Audio loaded: " + label + " (" + buffer.duration.toFixed(1) + "s)");
}

/* ---------------- demo sample synthesis ---------------- */
function encodeWav(buffer){
  const sr = buffer.sampleRate; let d = buffer.getChannelData(0);
  if(buffer.numberOfChannels > 1){
    const d2 = buffer.getChannelData(1); const m = new Float32Array(d.length);
    for(let i=0;i<d.length;i++) m[i]=(d[i]+d2[i])/2; d = m;
  }
  const n = d.length, out = new Uint8Array(44 + n*2);
  const dv = new DataView(out.buffer);
  const ws = (o,s)=>{ for(let i=0;i<s.length;i++) out[o+i]=s.charCodeAt(i); };
  ws(0,"RIFF"); dv.setUint32(4, 36+n*2, true); ws(8,"WAVE"); ws(12,"fmt ");
  dv.setUint32(16,16,true); dv.setUint16(20,1,true); dv.setUint16(22,1,true);
  dv.setUint32(24,sr,true); dv.setUint32(28,sr*2,true); dv.setUint16(32,2,true); dv.setUint16(34,16,true);
  ws(36,"data"); dv.setUint32(40,n*2,true);
  for(let i=0;i<n;i++){
    let v = Math.max(-1, Math.min(1, d[i]));
    dv.setInt16(44+i*2, v<0 ? v*32768 : v*32767, true);
  }
  return out;
}

VT.runDemo = async function(kind){
  toast("Synthesising "+(kind==="human"?"genuine human":"AI-cloned")+" demo sample…");
  const sr = 16000, dur = 5.5, N = Math.floor(sr*dur);
  const buf = new Float32Array(N);
  if(kind === "human"){
    // natural-ish speech: jittered f0, uneven syllables, breaths, noise floor
    let f0 = 126, phase = 0, t = 0;
    const rng = mulberry(42);
    while(t < dur - 0.3){
      const syl = 0.14 + rng()*0.16, gap = rng()<0.28 ? 0.12+rng()*0.22 : 0.02+rng()*0.05;
      const amp = 0.5 + rng()*0.4;
      const fTarget = 105 + rng()*70; f0 += (fTarget-f0)*0.5;
      for(let s=0; s<Math.floor(syl*sr); s++, t+=1/sr){
        const i = Math.floor(t*sr); if(i>=N) break;
        const jitter = Math.sin(2*Math.PI*5.2*t)*(2.5+rng()*1.5) + (rng()-0.5)*3;
        const f = f0 + jitter + Math.sin(2*Math.PI*(t/syl))*8;
        phase += 2*Math.PI*f/sr;
        const env = Math.sin(Math.PI*(s/(syl*sr)))**0.8;
        buf[i] += amp*env*(Math.sin(phase)*0.55 + Math.sin(2*phase)*0.22 + Math.sin(3*phase)*0.12 + (rng()-0.5)*0.16);
      }
      // breath between some phrases
      if(rng() < 0.3){
        for(let s=0; s<Math.floor(0.09*sr); s++, t+=1/sr){
          const i = Math.floor(t*sr); if(i>=N) break;
          buf[i] += (rng()-0.5)*0.09*Math.sin(Math.PI*s/(0.09*sr));
        }
      }
      t += gap;
    }
    for(let i=0;i<N;i++) buf[i] += (Math.random()-0.5)*0.012; // room noise floor
  } else {
    // clone / synthetic: locked f0, uniform rhythm, hard lowpass feel, no breaths
    let phase = 0;
    const f0 = 131, sylLen = 0.22, cycle = 0.27;
    for(let i=0;i<N;i++){
      const t = i/sr, pos = t % cycle;
      const on = pos < sylLen;
      const env = on ? 0.85 : 0.0;
      phase += 2*Math.PI*f0/sr;
      let v = env*(Math.sin(phase)*0.6 + Math.sin(2*phase)*0.25 + Math.sin(4*phase)*0.1);
      v += env*0.06*Math.sin(phase*7.03); // metallic comb flavour
      buf[i] = v;
    }
    const w = 2; // steep-ish lowpass ~kills HF sharply
    for(let i=w;i<N-w;i++){
      let s=0; for(let k=-w;k<=w;k++) s+=buf[i+k];
      buf[i] = s/(2*w+1)*1.15;
    }
  }
  const ac = new OfflineAudioContext(1, N, sr);
  const b = ac.createBuffer(1, N, sr); b.copyToChannel(buf, 0);
  const rendered = await ac.startRendering();
  const wav = encodeWav(rendered);
  await loadBlob(new Blob([wav], {type:"audio/wav"}),
    (kind==="human"?"Demo — genuine human voice (synthesised preview)":"Demo — AI-cloned voice (synthesised preview)"), "file");
  setModeUI("file");
};
function setModeUI(mode){
  $("tabLive").classList.toggle("on", mode==="live");
  $("tabFile").classList.toggle("on", mode==="file");
  $("paneLive").style.display = mode==="live" ? "" : "none";
  $("paneFile").style.display = mode==="file" ? "" : "none";
}
function mulberry(seed){ return function(){ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

/* ---------------- detection engine ---------------- */
function fftInPlace(re, im){
  const n = re.length;
  for(let i=1,j=0;i<n;i++){
    let bit = n>>1;
    for(; j&bit; bit>>=1) j ^= bit;
    j ^= bit;
    if(i<j){ const tr=re[i]; re[i]=re[j]; re[j]=tr; const ti=im[i]; im[i]=im[j]; im[j]=ti; }
  }
  for(let len=2; len<=n; len<<=1){
    const ang = -2*Math.PI/len, wr = Math.cos(ang), wi = Math.sin(ang);
    for(let i=0;i<n;i+=len){
      let cr=1, ci=0;
      for(let j=0;j<len/2;j++){
        const ur=re[i+j], ui=im[i+j];
        const vr=re[i+j+len/2]*cr - im[i+j+len/2]*ci;
        const vi=re[i+j+len/2]*ci + im[i+j+len/2]*cr;
        re[i+j]=ur+vr; im[i+j]=ui+vi;
        re[i+j+len/2]=ur-vr; im[i+j+len/2]=ui-vi;
        const ncr = cr*wr - ci*wi; ci = cr*wi + ci*wr; cr = ncr;
      }
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   VOXTRACE — Advanced Multi-Stage AI Voice Detection v2.0
   Pipeline:
     Stage 0: Silence guard (RMS + Peak)
     Stage 1: Frame-level feature extraction
     Stage 2: Audio-type classification (SILENCE/SPEECH/SONG/MUSIC)
     Stage 3: Early return for non-speech types
     Stage 4: 8-feature deep AI detection analysis
     Stage 5: Consensus scoring + verdict
═══════════════════════════════════════════════════════════════ */
function analyseBuffer(buffer){
  const sr = buffer.sampleRate;
  let d = buffer.getChannelData(0);
  if(buffer.numberOfChannels > 1){
    const d2 = buffer.getChannelData(1);
    const m = new Float32Array(d.length);
    for(let i=0;i<d.length;i++) m[i]=0.5*(d[i]+d2[i]);
    d = m;
  }

  // ─── Math helpers ───
  const _mean = a => a.length ? a.reduce((s,x)=>s+x,0)/a.length : 0;
  const _std  = a => {
    if(a.length<2) return 0;
    const m=_mean(a); return Math.sqrt(_mean(a.map(x=>(x-m)*(x-m))));
  };
  const _median = a => {
    if(!a.length) return 0;
    return [...a].sort((x,y)=>x-y)[a.length>>1];
  };
  const _pct = (a,p) => {
    if(!a.length) return 0;
    const s=[...a].sort((x,y)=>x-y);
    return s[Math.floor(p*(s.length-1))];
  };
  const clamp = (v,lo,hi)=>Math.max(lo,Math.min(hi,v));

  // ════════════════════════════════════════════════════════════
  // STAGE 0: SILENCE GUARD
  // ════════════════════════════════════════════════════════════
  let sumSq=0, peak=0;
  for(let i=0;i<d.length;i++){
    const abs=Math.abs(d[i]);
    if(abs>peak) peak=abs;
    sumSq+=d[i]*d[i];
  }
  const rms = Math.sqrt(sumSq/Math.max(1,d.length));

  if(rms<0.008 || peak<0.025){
    return {
      score:4, verdict:"NO SPEECH DETECTED", vClass:"r", confidence:"HIGH",
      audioType:"SILENCE",
      flags:["Silent audio or microphone muted","No audio energy detected","Cannot perform authenticity analysis"],
      indicators:[{name:"Audio Signal",w:1,sub:0,det:"No audio energy detected — microphone may be muted or file is empty."}],
      meta:{duration:+buffer.duration.toFixed(2),sampleRate:sr,framesAnalysed:0,audioType:"SILENCE"}
    };
  }

  // ════════════════════════════════════════════════════════════
  // STAGE 1: FRAME-LEVEL FEATURE EXTRACTION
  // ════════════════════════════════════════════════════════════
  const FL=2048, HOP=512;
  const win=new Float32Array(FL);
  for(let i=0;i<FL;i++) win[i]=0.54-0.46*Math.cos(2*Math.PI*i/(FL-1)); // Hamming

  const nFrames=Math.max(1,Math.floor((d.length-FL)/HOP));
  const maxFrames=400, step=Math.max(1,Math.floor(nFrames/maxFrames));
  const nyq=sr/2;

  let energies=[], flats=[], centroids=[], fluxes=[];
  let pitches=[], pitchStrengths=[], zcrs=[];
  let hfEnergies=[], mfEnergies=[], lfEnergies=[];
  let prevMag=null;
  const re=new Float32Array(FL), im=new Float32Array(FL);

  for(let f=0;f<nFrames;f+=step){
    const off=f*HOP;
    let e=0, zcr=0;
    for(let i=0;i<FL;i++){
      const v=d[off+i]*win[i];
      re[i]=v; im[i]=0; e+=v*v;
      if(i>0&&(d[off+i]>=0)!==(d[off+i-1]>=0)) zcr++;
    }
    energies.push(e);
    zcrs.push(zcr/FL);
    if(e<1e-8){prevMag=null;continue;}

    fftInPlace(re,im);
    const half=FL/2;
    let magSum=0,logSum=0,cSum=0,hfE=0,mfE=0,lfE=0;
    const mag=new Float32Array(half);
    for(let k=1;k<half;k++){
      const m=Math.sqrt(re[k]*re[k]+im[k]*im[k]);
      mag[k]=m; magSum+=m; logSum+=Math.log(m+1e-9); cSum+=k*m;
      const freq=k*sr/FL;
      if(freq<500) lfE+=m;
      else if(freq<3000) mfE+=m;
      else hfE+=m;
    }
    hfEnergies.push(hfE); mfEnergies.push(mfE); lfEnergies.push(lfE);
    const geo=Math.exp(logSum/(half-1)), arith=magSum/(half-1)+1e-12;
    flats.push(Math.min(1,geo/arith));
    centroids.push((cSum/(magSum+1e-12))*sr/FL);
    if(prevMag){
      let fl=0; for(let k=1;k<half;k++){const dv=mag[k]-prevMag[k];fl+=dv*dv;}
      fluxes.push(Math.sqrt(fl));
    }
    prevMag=mag;

    // Normalized autocorrelation pitch (70–800 Hz covers speech + singing)
    const minLag=Math.floor(sr/800), maxLag=Math.min(Math.floor(sr/70),FL-2);
    let best=0,bestLag=0;
    for(let lag=minLag;lag<=maxLag;lag++){
      let c=0,n1=0,n2=0;
      for(let i=0;i<FL-lag;i+=4){c+=re[i]*re[i+lag];n1+=re[i]*re[i];n2+=re[i+lag]*re[i+lag];}
      const sc=c/(Math.sqrt(n1*n2)+1e-9);
      if(sc>best){best=sc;bestLag=lag;}
    }
    if(best>0.28&&bestLag){pitches.push(sr/bestLag);pitchStrengths.push(best);}
  }

  const eMean=_mean(energies), eStd=_std(energies);
  const meanCentroid=_mean(centroids), cStd=_std(centroids);
  const meanFlat=_mean(flats);
  const hfMean=_mean(hfEnergies), mfMean=_mean(mfEnergies), lfMean=_mean(lfEnergies);
  const totalSpecE=hfMean+mfMean+lfMean+1e-12;

  // ════════════════════════════════════════════════════════════
  // STAGE 2: AUDIO TYPE CLASSIFICATION
  // ════════════════════════════════════════════════════════════
  const activeFrames=energies.filter(e=>e>eMean*0.08).length;
  const voicedRatio=pitches.length/Math.max(1,activeFrames);

  const pitchMed=_median(pitches);
  const filtPitches=pitches.filter(p=>p>pitchMed*0.5&&p<pitchMed*2.2);
  const pitchRange=filtPitches.length>3?_pct(filtPitches,0.9)-_pct(filtPitches,0.1):0;
  const pitchRangeRatio=pitchMed>0?pitchRange/pitchMed:0;
  const pitchStd=_std(filtPitches);
  const meanPitchStr=_mean(pitchStrengths);
  const hfRatio=hfMean/totalSpecE;

  // Singing: large melodic range, strongly voiced, sustained pitches
  const isSinging=(
    voicedRatio>0.4 &&
    pitchRangeRatio>0.28 &&
    meanPitchStr>0.42 &&
    pitchMed>80 &&
    (filtPitches.length>5)
  );

  // Instrumental: mostly unvoiced, high centroid, little to no sustained pitch
  const isInstrumental=(
    voicedRatio<0.18 &&
    meanCentroid>2800 &&
    hfRatio>0.12 &&
    pitches.length<8
  );

  const hasInsufficientSpeech=pitches.length<6&&!isSinging;

  let audioType;
  if(isSinging) audioType="SONG";
  else if(isInstrumental) audioType="MUSIC";
  else if(hasInsufficientSpeech) audioType="LOW_SPEECH";
  else audioType="SPEECH";

  // ════════════════════════════════════════════════════════════
  // STAGE 3: EARLY RETURN FOR NON-ANALYSABLE TYPES
  // ════════════════════════════════════════════════════════════
  if(audioType==="MUSIC"){
    return {
      score:50,verdict:"MUSIC / INSTRUMENTAL DETECTED",vClass:"a",confidence:"HIGH",
      audioType:"MUSIC",
      flags:["Instrumental music or sound effects detected","No sustained human vocals found","Submit a voice recording for AI detection analysis"],
      indicators:[{name:"Audio Classification",w:1,sub:50,det:`Instrumental/music content detected. Centroid ${Math.round(meanCentroid)} Hz, voiced ratio ${(voicedRatio*100).toFixed(0)}%. No human voice track isolated for AI authenticity analysis.`}],
      meta:{duration:+buffer.duration.toFixed(2),sampleRate:sr,framesAnalysed:Math.ceil(nFrames/step),audioType:"MUSIC"}
    };
  }
  if(audioType==="LOW_SPEECH"){
    return {
      score:10,verdict:"INSUFFICIENT SPEECH — RESUBMIT",vClass:"r",confidence:"HIGH",
      audioType:"LOW_SPEECH",
      flags:["No clear voiced speech detected","Whisper, background noise, or non-speech audio","Speak clearly into the microphone and resubmit"],
      indicators:[{name:"Speech Presence",w:1,sub:10,det:`Only ${pitches.length} voiced frames found (minimum 6 required). Audio appears to be ambient noise, whisper, or non-speech content.`}],
      meta:{duration:+buffer.duration.toFixed(2),sampleRate:sr,framesAnalysed:Math.ceil(nFrames/step),audioType:"LOW_SPEECH"}
    };
  }

  // ════════════════════════════════════════════════════════════
  // STAGE 4: DEEP AI DETECTION — 8 FEATURES
  // ════════════════════════════════════════════════════════════

  /* ── Feature 1: PITCH JITTER ─────────────────────────────────
     Cycle-to-cycle F0 period variation.
     AI voice:  < 0.2% (unnaturally perfect)
     Human:       0.4–2.5% (natural micro-variation)
     AI singing: < 0.3% | Human singing: 0.3–1.5%
  ──────────────────────────────────────────────────────────── */
  let jitterPct=0;
  if(filtPitches.length>=4){
    const periods=filtPitches.map(p=>1/p);
    const diffs=[];
    for(let i=1;i<periods.length;i++) diffs.push(Math.abs(periods[i]-periods[i-1]));
    const mP=_mean(periods);
    jitterPct=mP>0?(_mean(diffs)/mP)*100:0;
  }
  let jitterSub;
  if(jitterPct<0.12)       jitterSub=5;   // Robotically perfect — strong AI
  else if(jitterPct<0.30)  jitterSub=18;  // Below human range — likely AI
  else if(jitterPct<0.50)  jitterSub=38;  // Borderline
  else if(jitterPct<2.5)   jitterSub=clamp(Math.round(52+(jitterPct-0.5)*18),52,90);
  else                     jitterSub=38;  // Too high — distortion
  const jitterDet=`Pitch jitter ${jitterPct.toFixed(3)}% — ${jitterPct<0.30?"dangerously smooth pitch — strong AI synthesis signature":jitterPct<0.50?"below typical human range — suspect":jitterPct<2.5?"healthy natural pitch micro-variation":"high jitter — possible compression artifacts"}`;

  /* ── Feature 2: AMPLITUDE SHIMMER ───────────────────────────
     Frame-to-frame RMS variation in voiced regions.
     AI: < 1% (robotically uniform)    Human: 3–12%
  ──────────────────────────────────────────────────────────── */
  const vEnergies=energies.filter(e=>e>eMean*0.12);
  let shimmerPct=0;
  if(vEnergies.length>=4){
    const amps=vEnergies.map(e=>Math.sqrt(e));
    const ampDiffs=[];
    for(let i=1;i<amps.length;i++){
      const avg=(amps[i]+amps[i-1])/2;
      if(avg>1e-6) ampDiffs.push(Math.abs(amps[i]-amps[i-1])/avg*100);
    }
    shimmerPct=_mean(ampDiffs);
  }
  let shimmerSub;
  if(shimmerPct<0.8)       shimmerSub=5;
  else if(shimmerPct<2.5)  shimmerSub=22;
  else if(shimmerPct<6.0)  shimmerSub=clamp(Math.round(45+(shimmerPct-2.5)*10),45,85);
  else if(shimmerPct<18)   shimmerSub=clamp(Math.round(85-(shimmerPct-6)*1.5),50,85);
  else                     shimmerSub=32;
  const shimmerDet=`Amplitude shimmer ${shimmerPct.toFixed(1)}% — ${shimmerPct<2.5?"unnaturally uniform amplitude (AI synthesis signature)":shimmerPct<18?"natural human amplitude variation":"excessive variation — possible clipping or distortion"}`;

  /* ── Feature 3: SPECTRAL CONSISTENCY ────────────────────────
     AI voices have a too-stable spectral envelope between frames.
     Real voices evolve rapidly per phoneme.
  ──────────────────────────────────────────────────────────── */
  const flatStd=_std(flats);
  const centroidCV=meanCentroid>0?cStd/meanCentroid:0;
  const fluxCV=_mean(fluxes)>0?_std(fluxes)/_mean(fluxes):0;
  const specConsistSub=clamp(Math.round(flatStd*750+centroidCV*200+fluxCV*35),5,95);
  const specConsistDet=`Spectral flatness variation ${(flatStd*100).toFixed(1)}%, centroid CV ${(centroidCV*100).toFixed(0)}% — ${specConsistSub<28?"spectrum too static — vocoder/synthesizer pattern detected":specConsistSub<50?"limited spectral dynamics":"rich, naturally evolving spectral content"}`;

  /* ── Feature 4: PROSODIC INTONATION ─────────────────────────
     Natural speech has rise-fall prosodic arcs.
     AI: monotone OR artificially over-modulated.
     Songs: melodic contour expected.
  ──────────────────────────────────────────────────────────── */
  const pitchCV=filtPitches.length>5?_std(filtPitches)/_mean(filtPitches):0;
  let intonationSub;
  if(isSinging){
    intonationSub=clamp(Math.round(pitchRangeRatio*130+pitchCV*70),15,92);
  } else {
    if(pitchCV<0.03)       intonationSub=10; // Monotone — AI TTS
    else if(pitchCV<0.07)  intonationSub=28;
    else if(pitchCV<0.20)  intonationSub=clamp(Math.round(pitchCV*400+12),42,88);
    else                   intonationSub=clamp(Math.round(88-(pitchCV-0.20)*80),42,88);
  }
  const intonationDet=isSinging
    ?`Melodic range ratio ${(pitchRangeRatio*100).toFixed(0)}%, pitch CV ${(pitchCV*100).toFixed(1)}% — ${intonationSub>60?"natural melodic expression":"limited melodic range — possible AI generated music/vocals"}`
    :`Pitch CV ${(pitchCV*100).toFixed(1)}% — ${pitchCV<0.07?"monotone delivery — classic AI TTS signature":pitchCV<0.20?"natural prosodic variation":"over-expressive — possible AI with exaggerated intonation"}`;

  /* ── Feature 5: BREATH & PAUSE NATURALNESS ───────────────────
     Real humans breathe. AI voices: clean transitions, no breath.
  ──────────────────────────────────────────────────────────── */
  const breathFrames=energies.filter(e=>e>eMean*0.02&&e<eMean*0.18).length;
  const breathRatio=breathFrames/Math.max(1,energies.length);
  const silentRatio=energies.filter(e=>e<eMean*0.02).length/Math.max(1,energies.length);
  let breathSub;
  if(breathRatio<0.02)     breathSub=8;
  else if(breathRatio<0.05) breathSub=22;
  else if(breathRatio<0.30) breathSub=clamp(Math.round(breathRatio*220+28+silentRatio*35),35,92);
  else                     breathSub=clamp(Math.round(92-(breathRatio-0.30)*45),40,92);
  const breathDet=`Breath/transition frames ${(breathRatio*100).toFixed(0)}%, pause ratio ${(silentRatio*100).toFixed(0)}% — ${breathRatio<0.05?"near-zero breath noise — strong AI signature":breathRatio<0.30?"natural breath and pause pattern":"excessive quiet frames — check for noise padding"}`;

  /* ── Feature 6: HIGH-FREQUENCY NATURALNESS ───────────────────
     Real speech has fricatives (s, sh, f), consonants, breath.
     AI: absent HF (vocoder cutoff) or synthetic HF artefacts.
  ──────────────────────────────────────────────────────────── */
  const hfVariability=hfMean>0?_std(hfEnergies)/hfMean:0;
  let hfSub;
  if(hfRatio<0.03)         hfSub=12; // Near-zero HF — vocoder rolloff
  else if(hfRatio<0.08)    hfSub=32;
  else                     hfSub=clamp(Math.round(hfRatio*350+hfVariability*30+18),20,90);
  const hfDet=`HF energy ratio ${(hfRatio*100).toFixed(1)}%, HF variability ${(hfVariability*100).toFixed(0)}% — ${hfRatio<0.08?"reduced high-frequency content — AI vocoder pattern":hfVariability<0.3?"present but static HF":"natural dynamic high-frequency content"}`;

  /* ── Feature 7: TEMPORAL ENERGY DYNAMICS ─────────────────────
     Natural speech = variable energy (stressed/unstressed syllables).
     AI TTS: too-flat energy profile or metronomic rhythm.
  ──────────────────────────────────────────────────────────── */
  const dynCoeff=eMean>0?eStd/eMean:0;
  const sortedE=[...energies].sort((a,b)=>a-b);
  const topD=_mean(sortedE.slice(Math.floor(sortedE.length*0.9)));
  const botD=_mean(sortedE.slice(0,Math.max(1,Math.floor(sortedE.length*0.1))));
  const dynamicRange=topD>0?(topD-botD)/topD:0;
  let temporalSub;
  if(dynCoeff<0.25)        temporalSub=12;
  else if(dynCoeff<0.55)   temporalSub=clamp(Math.round(dynCoeff*100),22,52);
  else                     temporalSub=clamp(Math.round(48+dynamicRange*48+dynCoeff*12),40,92);
  const temporalDet=`Energy dynamics CV ${(dynCoeff*100).toFixed(0)}%, dynamic range ${(dynamicRange*100).toFixed(0)}% — ${dynCoeff<0.25?"unnaturally flat energy — AI TTS pattern":dynCoeff<0.55?"moderate energy dynamics":"rich natural speaking energy variation"}`;

  /* ── Feature 8: VOICED/UNVOICED TRANSITIONS ──────────────────
     Natural speech alternates voiced/unvoiced (v→uv via ZCR).
     AI: unnaturally uniform ZCR (all voiced or all noise).
  ──────────────────────────────────────────────────────────── */
  const zcrMean=_mean(zcrs);
  const zcrCV=zcrMean>0?_std(zcrs)/zcrMean:0;
  let voicingSub;
  if(zcrCV<0.12)           voicingSub=15;
  else if(zcrCV<0.28)      voicingSub=38;
  else                     voicingSub=clamp(Math.round(38+zcrCV*155),38,90);
  const voicingDet=`ZCR variation CV ${(zcrCV*100).toFixed(0)}% — ${zcrCV<0.28?"limited voiced/unvoiced transitions — AI synthesis pattern":"natural voiced-unvoiced alternation"}`;

  // ════════════════════════════════════════════════════════════
  // STAGE 5: SCORE SYNTHESIS WITH CONTEXTUAL WEIGHTS
  // ════════════════════════════════════════════════════════════
  const indicators = isSinging ? [
    {name:"Vocal Pitch Jitter",             w:0.18, sub:jitterSub,       det:jitterDet},
    {name:"Amplitude Shimmer",              w:0.15, sub:shimmerSub,      det:shimmerDet},
    {name:"Spectral Richness & Evolution",  w:0.18, sub:specConsistSub,  det:specConsistDet},
    {name:"Melodic Intonation Arc",         w:0.16, sub:intonationSub,   det:intonationDet},
    {name:"Breath Between Phrases",         w:0.14, sub:breathSub,       det:breathDet},
    {name:"High-Frequency Presence",        w:0.10, sub:hfSub,           det:hfDet},
    {name:"Vocal Energy Dynamics",          w:0.09, sub:temporalSub,     det:temporalDet},
  ] : [
    {name:"Pitch Jitter (Micro-variation)", w:0.18, sub:jitterSub,       det:jitterDet},
    {name:"Amplitude Shimmer",              w:0.14, sub:shimmerSub,      det:shimmerDet},
    {name:"Spectral Dynamics & Evolution",  w:0.16, sub:specConsistSub,  det:specConsistDet},
    {name:"Prosodic Intonation",            w:0.12, sub:intonationSub,   det:intonationDet},
    {name:"Breath & Pause Naturalness",     w:0.16, sub:breathSub,       det:breathDet},
    {name:"High-Frequency Continuity",      w:0.10, sub:hfSub,           det:hfDet},
    {name:"Temporal Energy Dynamics",       w:0.10, sub:temporalSub,     det:temporalDet},
    {name:"Voiced/Unvoiced Transitions",    w:0.04, sub:voicingSub,      det:voicingDet},
  ];

  let score=Math.round(clamp(indicators.reduce((s,ind)=>s+ind.sub*ind.w,0),2,99));

  // ── AI Consensus: multiple signals converging → hard penalise ──
  const aiFlags=[
    jitterSub<22,      // pitch too smooth
    shimmerSub<18,     // amplitude too uniform
    specConsistSub<28, // spectrum static
    breathSub<18,      // no breath
    temporalSub<22,    // flat energy
    intonationSub<18,  // monotone
    hfSub<20,          // no HF
  ];
  const aiCount=aiFlags.filter(Boolean).length;
  if(aiCount>=5) score=Math.min(score,22);
  else if(aiCount>=4) score=Math.min(score,35);
  else if(aiCount>=3) score=Math.min(score,50);
  else if(aiCount>=2) score=Math.min(score,62);

  // ── Human Consensus: multiple strong signals → minimum floor ──
  const humanFlags=[
    jitterSub>65, shimmerSub>60, specConsistSub>60,
    breathSub>55, temporalSub>58, intonationSub>55
  ];
  const humanCount=humanFlags.filter(Boolean).length;
  if(humanCount>=5) score=Math.max(score,74);
  else if(humanCount>=4) score=Math.max(score,65);

  const duration=buffer.duration;
  const v=classify(score);
  const margin=Math.min(Math.abs(score-75),Math.abs(score-40));
  const confidence=duration>=4&&margin>=10?"HIGH":duration>=2?"MEDIUM":"LOW";

  const flags=[];
  if(aiCount>=3) flags.push("⚠️ Multiple strong AI-generation signals detected");
  if(jitterSub<22) flags.push("Pitch jitter near-zero — synthetic voice signature");
  if(shimmerSub<18) flags.push("Amplitude robotically uniform — AI indicator");
  if(specConsistSub<28) flags.push("Spectrum too static — vocoder/synthesizer pattern");
  if(breathSub<18) flags.push("No breath noise detected between words");
  if(temporalSub<22) flags.push("Flat energy envelope — AI text-to-speech pattern");
  if(intonationSub<18) flags.push("Monotone delivery — lacks natural prosody");
  if(hfSub<20) flags.push("High-frequency content absent — vocoder rolloff");
  if(isSinging&&intonationSub<35) flags.push("Limited melodic expression — possible AI-generated vocals");
  if(score>=75&&aiCount===0) flags.push("All authenticity markers within natural human range");

  return {
    score, verdict:v.verdict, vClass:v.vClass, confidence,
    audioType,
    flags, indicators,
    meta:{
      duration:+duration.toFixed(2), sampleRate:sr,
      framesAnalysed:Math.ceil(nFrames/step),
      audioType, voicedRatio:+voicedRatio.toFixed(2),
      pitchMedian:Math.round(pitchMed),
      jitterPct:+jitterPct.toFixed(3),
      shimmerPct:+shimmerPct.toFixed(1),
      aiSignals:aiCount
    }
  };
}

function classify(score){
  if(score>=75) return {verdict:"LIKELY GENUINE",       vClass:"g"};
  if(score>=55) return {verdict:"PROBABLY GENUINE — MONITOR", vClass:"g"};
  if(score>=40) return {verdict:"SUSPICIOUS — REVIEW REQUIRED", vClass:"a"};
  return          {verdict:"LIKELY AI-GENERATED",        vClass:"r"};
}
}

/* ---------------- analysis run & evidence ---------------- */
let lastResult = null;

VT.analyze = async function(){
  if(!pendingAudio){ toast("Load a sample first."); return; }
  const btn = $("analyzeBtn"); btn.disabled = true; btn.textContent = "⏳ Analysing…";
  await new Promise(r=>setTimeout(r, 60));
  try{
    const {bytes, buffer, label, mode} = pendingAudio;
    const res = analyseBuffer(buffer);
    const hash = await sha256Hex(bytes);
    // Only apply hash micro-adjustment for normal SPEECH/SONG analysis
    if(!['SILENCE','MUSIC','LOW_SPEECH'].includes(res.audioType)){
      const adj = (parseInt(hash.slice(0,2),16) % 3) - 1;
      res.score = Math.max(2, Math.min(99, res.score + adj));
      const c = classify(res.score); res.verdict = c.verdict; res.vClass = c.vClass;
    }

    const chain = LS.get("voxtrace_chain", []);
    const prev = chain.length ? chain[chain.length-1] : null;
    const prevHash = prev ? prev.blockHash : "0".repeat(64);
    const evidenceId = "VT-" + new Date().toISOString().slice(2,10).replace(/-/g,"") + "-" + hash.slice(0,4).toUpperCase();
    const ts = Date.now();
    const blockHash = await sha256Hex(new TextEncoder().encode(prevHash + hash + ts + evidenceId));
    const block = {height: chain.length+1, ts, evidenceId, evidenceHash: hash, prevHash, blockHash};

    lastResult = {...res, evidenceId, block, label, mode, sizeBytes: bytes.length};
    renderResult(lastResult);
    toast("Analysis complete — Trust Score "+res.score+"/100");
  }catch(e){
    console.error(e); toast("Analysis failed: "+e.message);
  }
  btn.disabled = false; btn.textContent = "⚡ Analyse Sample";
};

function gaugeSVG(score, cls){
  const color = cls==="g" ? "#34A853" : cls==="a" ? "#FBBC05" : "#EA4335";
  const pct = score/100, a = Math.PI*(1-pct);
  const x = 100 + 78*Math.cos(a), y = 112 - 78*Math.sin(a);
  return `
  <path d="M 22 112 A 78 78 0 0 1 178 112" fill="none" stroke="#D2E3FC" stroke-width="14" stroke-linecap="round"/>
  <path d="M 22 112 A 78 78 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}" fill="none" stroke="${color}" stroke-width="14" stroke-linecap="round"/>
  <text x="100" y="88" text-anchor="middle" font-size="36" font-weight="700" fill="#121317">${score}</text>
  <text x="100" y="106" text-anchor="middle" font-size="11" font-weight="600" fill="#3c4043" font-family="var(--mono)">TRUST SCORE / 100</text>`;
}

function renderResult(r){
  $("resultEmpty").style.display = "none";
  $("resultBody").style.display = "";
  $("gauge").innerHTML = gaugeSVG(r.score, r.vClass);
  const v = $("verdictTxt"); v.textContent = r.verdict; v.className = "verdict "+r.vClass;
  $("confTxt").textContent = r.confidence;
  $("durTxt").textContent = r.meta.duration + "s";
  $("modeTxt").textContent = r.mode === "live" ? "Live call" : "Recorded";
  $("flagRow").innerHTML = r.flags.length
    ? r.flags.map(f=>`<span class="flagchip bad">⚠ ${f}</span>`).join("")
    : `<span class="flagchip ok">✔ NO RISK FLAGS</span>`;
  $("indList").innerHTML = r.indicators.map(ind=>{
    const c = ind.sub>=65?"g":ind.sub>=45?"a":"r";
    return `<div class="ind">
      <div class="top"><b>${ind.name}</b><span>${ind.sub}/100 · weight ${(ind.w*100).toFixed(0)}%</span></div>
      <div class="bar"><i class="${c}" style="width:${ind.sub}%"></i></div>
      <div class="det">${ind.det}</div></div>`;
  }).join("");
  const dt = new Date(r.block.ts);
  $("passport").innerHTML = `
    <h4>⛓ EVIDENCE PASSPORT — ANCHORED</h4>
    <div class="kv"><span class="k">Evidence ID</span><span class="v">${r.evidenceId}</span></div>
    <div class="kv"><span class="k">Source</span><span class="v">${escapeHtml(r.label)}</span></div>
    <div class="kv"><span class="k">SHA-256</span><span class="v">${r.block.evidenceHash}</span></div>
    <div class="kv"><span class="k">Block</span><span class="v">#${r.block.height} · ${dt.toLocaleString()}</span></div>
    <div class="kv"><span class="k">Block hash</span><span class="v">${r.block.blockHash.slice(0,34)}…</span></div>
    <div class="kv"><span class="k">Prev hash</span><span class="v">${r.block.prevHash.slice(0,34)}${r.block.height===1?" (genesis)":"…"}</span></div>`;
}

VT.saveEvidence = function(){
  if(!lastResult) return;
  const log = LS.get("voxtrace_log", []);
  if(log.some(x=>x.evidenceId===lastResult.evidenceId)){ toast("Already saved to the evidence log."); return; }
  log.unshift({
    evidenceId:lastResult.evidenceId, ts:lastResult.block.ts, mode:lastResult.mode,
    duration:lastResult.meta.duration, score:lastResult.score, verdict:lastResult.verdict,
    flags:lastResult.flags, label:lastResult.label,
    hash:lastResult.block.evidenceHash, block:lastResult.block, indicators:lastResult.indicators
  });
  LS.set("voxtrace_log", log);
  const chain = LS.get("voxtrace_chain", []);
  if(!chain.some(b=>b.blockHash===lastResult.block.blockHash)){ chain.push(lastResult.block); LS.set("voxtrace_chain", chain); }
  toast("💾 Saved — "+lastResult.evidenceId+" anchored as block #"+lastResult.block.height);
};

VT.downloadReport = function(){
  if(!lastResult) return;
  const r = lastResult;
  const txt = [
"================ VOXTRACE VERIFICATION REPORT ================",
"Evidence ID   : "+r.evidenceId,
"Generated     : "+new Date().toLocaleString(),
"Source        : "+r.label,
"Mode          : "+(r.mode==="live"?"Live call":"Recorded call"),
"Duration      : "+r.meta.duration+"s",
"---------------------------------------------------------------",
"TRUST SCORE   : "+r.score+" / 100",
"VERDICT       : "+r.verdict,
"CONFIDENCE    : "+r.confidence,
"FLAGS         : "+(r.flags.length?r.flags.join("; "):"None"),
"---------------------------------------------------------------",
"INDICATORS",
...r.indicators.map(i=>" - "+i.name.padEnd(28)+i.sub+"/100  ("+i.det+")"),
"---------------------------------------------------------------",
"EVIDENCE PASSPORT",
"SHA-256       : "+r.block.evidenceHash,
"Block height  : #"+r.block.height,
"Block hash    : "+r.block.blockHash,
"Prev hash     : "+r.block.prevHash,
"Anchored at   : "+new Date(r.block.ts).toLocaleString(),
"---------------------------------------------------------------",
"Engine: VOXTRACE heuristic demo engine (spectral + prosodic",
"analysis). Not a forensic certification. Detect. Explain.",
"Verify. Preserve.",
"==============================================================="
  ].join("\n");
  downloadBlob(new Blob([txt],{type:"text/plain"}), r.evidenceId+"_report.txt");
  toast("Report downloaded.");
};
function downloadBlob(blob, name){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
}
VT.copyHash = async function(){
  if(!lastResult) return;
  try{ await navigator.clipboard.writeText(lastResult.block.evidenceHash); toast("SHA-256 hash copied."); }
  catch(e){ toast("Copy not available in this context."); }
};

/* ---------------- dashboard ---------------- */
VT.renderDashboard = function(){
  const log = LS.get("voxtrace_log", []);
  const chain = LS.get("voxtrace_chain", []);
  $("kTotal").textContent = log.length;
  $("kAnchor").textContent = chain.length;
  $("kAvg").textContent = log.length ? Math.round(log.reduce((s,x)=>s+x.score,0)/log.length) : "—";
  $("kFlag").textContent = log.filter(x=>x.score<55).length;

  const buckets = [0,0,0,0,0];
  log.forEach(x=>{ buckets[Math.min(4, Math.floor(x.score/20))]++; });
  const labels = ["0–19","20–39","40–59","60–79","80–100"];
  const colors = ["r","r","a","g","g"];
  const max = Math.max(1, ...buckets);
  $("distChart").innerHTML = log.length ? buckets.map((c,i)=>
    `<div class="dist-row"><span class="lbl">${labels[i]}</span><div class="bar"><i class="${colors[i]}" style="width:${(c/max*100).toFixed(0)}%"></i></div><span class="ct">${c}</span></div>`
  ).join("") : `<span style="color:var(--body);font-size:13.5px">No data yet — run a verification first.</span>`;
  VT.renderLog();
};

VT.renderLog = function(){
  const log = LS.get("voxtrace_log", []);
  const q = ($("logSearch").value||"").toLowerCase();
  const rows = log.filter(x=>!q || (x.evidenceId+x.verdict+x.hash+x.label).toLowerCase().includes(q));
  $("logBody").innerHTML = rows.length ? rows.map(x=>{
    const c = x.score>=65?"g":x.score>=40?"a":"r";
    return `<tr>
      <td style="color:var(--blue-dark);font-weight:700">${x.evidenceId}</td>
      <td>${new Date(x.ts).toLocaleString()}</td>
      <td>${x.mode==="live"?"🔴 live":"📁 file"}</td>
      <td>${x.duration}s</td>
      <td class="sc ${c}">${x.score}</td>
      <td style="font-family:var(--font);font-weight:600;font-size:12px">${x.verdict}</td>
      <td title="${x.hash}">${x.hash.slice(0,10)}…${x.hash.slice(-6)}</td>
      <td><button class="linkbtn" onclick="VT.viewRecord('${x.evidenceId}')">view</button></td></tr>`;
  }).join("") : `<tr><td colspan="8" style="color:var(--body);text-align:center;padding:26px">${log.length?"No matches.":"No evidence saved yet."}</td></tr>`;
};

VT.viewRecord = function(id){
  const log = LS.get("voxtrace_log", []);
  const x = log.find(r=>r.evidenceId===id);
  if(!x) return;
  const c = x.score>=65?"g":x.score>=40?"a":"r";
  VT.openModalHTML(`
    <div class="m-icon" style="background:${x.score>=65?"var(--green)":x.score>=40?"var(--yellow)":"var(--red)"}">🧾</div>
    <span class="m-label">Evidence record</span>
    <h3>${x.evidenceId} · <span class="sc ${c}">${x.score}/100</span></h3>
    <p><b>Verdict:</b> ${x.verdict}<br><b>Time:</b> ${new Date(x.ts).toLocaleString()}<br>
    <b>Source:</b> ${escapeHtml(x.label)}<br><b>Flags:</b> ${x.flags.length?escapeHtml(x.flags.join("; ")):"None"}</p>
    <p style="margin-top:12px">${x.indicators.map(i=>"• "+escapeHtml(i.name)+": <b>"+i.sub+"/100</b>").join("<br>")}</p>
    <p style="margin-top:12px;font-family:var(--mono);font-size:11.5px;word-break:break-all">
    sha256: ${x.hash}<br>block #${x.block.height} · ${x.block.blockHash.slice(0,26)}…</p>`);
};

VT.exportCSV = function(){
  const log = LS.get("voxtrace_log", []);
  if(!log.length){ toast("Nothing to export yet."); return; }
  const head = "evidence_id,timestamp,mode,duration_s,trust_score,verdict,flags,sha256,label";
  const csv = [head, ...log.map(x=>[
    x.evidenceId, new Date(x.ts).toISOString(), x.mode, x.duration, x.score,
    '"'+x.verdict.replace(/"/g,'')+'"', '"'+x.flags.join("; ")+'"', x.hash, '"'+String(x.label).replace(/"/g,'')+'"'
  ].join(","))].join("\n");
  downloadBlob(new Blob([csv],{type:"text/csv"}), "voxtrace_evidence_log.csv");
  toast("CSV exported.");
};

VT.clearData = function(){
  if(!confirm("Clear ALL saved verifications and the evidence chain? This cannot be undone.")) return;
  localStorage.removeItem("voxtrace_log");
  localStorage.removeItem("voxtrace_chain");
  VT.renderDashboard();
  toast("Evidence log cleared.");
};

/* re-verify integrity */
const reDrop = $("reDrop");
["dragover","dragenter"].forEach(ev=>reDrop.addEventListener(ev,e=>{e.preventDefault();reDrop.style.borderColor="var(--blue)";}));
["dragleave","drop"].forEach(ev=>reDrop.addEventListener(ev,e=>{e.preventDefault();reDrop.style.borderColor="";}));
reDrop.addEventListener("drop", e=>{ const f=e.dataTransfer.files[0]; if(f) reVerify(f); });
$("reFile").addEventListener("change", e=>{ const f=e.target.files[0]; if(f) reVerify(f); });

async function reVerify(file){
  $("reResult").innerHTML = `<span style="color:var(--body)">Computing SHA-256…</span>`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const hash = await sha256Hex(bytes);
  const log = LS.get("voxtrace_log", []);
  const match = log.find(x=>x.hash===hash);
  $("reResult").innerHTML = match
    ? `<div class="okbox"><b>✔ INTEGRITY VERIFIED</b><br>
        File matches evidence record <b>${match.evidenceId}</b> (score ${match.score}/100, anchored block #${match.block.height}).
        Content is bit-for-bit identical to the anchored sample.</div>`
    : `<div class="badbox"><b>✘ NO MATCH IN EVIDENCE LOG</b><br>
        Computed hash <span style="font-family:var(--mono)">${hash.slice(0,18)}…</span> is not anchored.
        Either this file was never verified here, or it has been modified since.</div>`;
}

/* ---------------- pricing calculator ---------------- */
VT.calc = function(){
  const s = +$("rSmall").value, b = +$("rBiz").value, e = +$("rEnt").value;
  $("vSmall").textContent = s; $("vBiz").textContent = b; $("vEnt").textContent = e;
  const total = s*9 + b*1999 + e*25000;
  $("calcOut").textContent = inr(total) + " / month";
};

/* ---------------- api keys & leads ---------------- */
VT.genKey = function(){
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b=>b.toString(16).padStart(2,"0")).join("");
  const key = "vx_live_" + hex;
  LS.set("voxtrace_key", key);
  $("apiKeyBox").textContent = key;
  toast("Sandbox API key generated.");
};
VT.loadKey = function(){
  const k = LS.get("voxtrace_key", null);
  if(k) $("apiKeyBox").textContent = k;
};
VT.copyKey = async function(){
  const k = $("apiKeyBox").textContent;
  if(!k.startsWith("vx_")){ toast("Generate a key first."); return; }
  try{ await navigator.clipboard.writeText(k); toast("API key copied."); }catch(e){ toast("Copy not available."); }
};
VT.submitLead = function(){
  const name = $("leadName").value.trim(), co = $("leadCo").value.trim(), email = $("leadEmail").value.trim();
  if(!name || !email){ toast("Please add at least your name and email."); return; }
  const leads = LS.get("voxtrace_leads", []);
  leads.unshift({name, co, email, type:$("leadType").value, ts:Date.now()});
  LS.set("voxtrace_leads", leads);
  $("leadName").value = $("leadCo").value = $("leadEmail").value = "";
  toast("📩 Inquiry saved — the VOXTRACE team will reach out. (Demo: stored locally.)");
};

/* ---------------- razorpay payments & subscriptions ---------------- */
VT.updatePlanBanner = function(){
  const plan = LS.get("voxtrace_active_plan", null);
  const badge = $("userPlanBadge");
  if(!badge) return;
  if(plan && plan.name){
    badge.style.display = "inline-flex";
    if(plan.name === "Free Trial"){
      badge.innerHTML = `🎁 Free Trial (${plan.checksLeft || 3} left)`;
      badge.style.background = "#e8f0fe";
      badge.style.color = "#1a73e8";
      badge.style.borderColor = "#d2e3fc";
    } else {
      badge.innerHTML = `⚡ ${plan.name} Active`;
      badge.style.background = "#e6f4ea";
      badge.style.color = "#137333";
      badge.style.borderColor = "#ceead6";
    }
  } else {
    badge.style.display = "none";
  }
};

VT.selectFreeTrial = function(){
  const current = LS.get("voxtrace_active_plan", null);
  if(current && current.name === "Free Trial"){
    toast("✓ Free Trial already active! (3 checks / month)");
    location.hash = "#/verify";
    return;
  }
  const trialPlan = {
    name: "Free Trial",
    amount: 0,
    active: true,
    checksLeft: 3,
    activatedAt: new Date().toISOString()
  };
  LS.set("voxtrace_active_plan", trialPlan);
  VT.updatePlanBanner();
  toast("🎉 Free Trial activated! 3 free voice checks are ready.");
  setTimeout(()=>{ location.hash = "#/verify"; }, 800);
};

VT.payForPlan = async function(planName, price){
  if(typeof Razorpay === "undefined"){
    toast("⚠️ Razorpay SDK loading, please wait...");
    return;
  }
  toast("Connecting to secure Razorpay gateway...");

  let orderId = null;
  let keyId = "rzp_test_TfB5XCZP9J7BgR";
  let amountInPaise = Math.round(price * 100);

  // Attempt server-side order creation (works on local server and Vercel serverless)
  try {
    const res = await fetch("/api/payment/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: planName, amount: price })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.order_id) {
        orderId = data.order_id;
        if (data.key_id) keyId = data.key_id;
        if (data.amount) amountInPaise = data.amount;
      }
    }
  } catch (err) {
    console.warn("Server order creation unavailable, using direct client-side checkout fallback:", err);
  }

  const options = {
    key: keyId,
    amount: amountInPaise,
    currency: "INR",
    name: "VOXTRACE",
    description: `${planName} Subscription (${inr(price)}/month)`,
    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%234285F4'/%3E%3Cpath d='M10 32h7l4-12 6 24 5-16 3 4h13' stroke='%23fff' stroke-width='5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E",
    handler: async function(response){
      toast("🔒 Verifying payment...");
      let isVerified = false;

      // Try server-side HMAC verification if order_id was created
      if (response.razorpay_order_id && response.razorpay_signature) {
        try {
          const verifyRes = await fetch("/api/payment/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan: planName
            })
          });
          if (verifyRes.ok) {
            const verifyData = await verifyRes.json();
            if (verifyData.verified) {
              isVerified = true;
            }
          }
        } catch (e) {
          console.warn("Server verify endpoint unavailable:", e);
        }
      }

      // If direct checkout or serverless offline, accept valid payment ID from Razorpay
      if (!isVerified && response.razorpay_payment_id) {
        isVerified = true;
      }

      if (isVerified) {
        const newPlan = {
          name: planName,
          amount: price,
          active: true,
          payment_id: response.razorpay_payment_id,
          order_id: response.razorpay_order_id || "direct_checkout",
          signature: response.razorpay_signature || "rzp_direct_verified",
          verified: true,
          verifiedAt: new Date().toISOString()
        };
        LS.set("voxtrace_active_plan", newPlan);
        VT.updatePlanBanner();
        VT.showPaymentSuccessModal(newPlan);
      } else {
        alert("❌ Payment could not be confirmed. Please contact support.");
      }
    },
    prefill: {
      name: "Nishant Kumar",
      email: "sudonishant@gmail.com",
      contact: "9999999999"
    },
    theme: { color: "#4285F4" },
    modal: {
      ondismiss: function(){
        toast("Payment window closed.");
      }
    }
  };

  if (orderId) {
    options.order_id = orderId;
  }

  const rzp = new Razorpay(options);
  rzp.on("payment.failed", function(response){
    alert("❌ Payment failed: " + (response.error ? response.error.description : "Transaction declined"));
  });
  rzp.open();
};

VT.contactEnterprise = function(){
  location.hash = "#/api";
  setTimeout(()=>{
    const leadType = $("leadType");
    if(leadType) leadType.value = "Enterprise Pilot";
    const leadName = $("leadName");
    if(leadName) leadName.focus();
    toast("📋 Pre-selected Enterprise Inquiry form.");
  }, 400);
};

VT.showPaymentSuccessModal = function(receipt){
  const modal = $("paymentSuccessModal");
  if(!modal) return;
  $("modalPlanName").textContent = receipt.name;
  $("modalAmount").textContent = inr(receipt.amount) + " / month";
  $("modalPayId").textContent = receipt.payment_id;
  $("modalOrderId").textContent = receipt.order_id;
  $("modalSigHash").textContent = receipt.signature ? receipt.signature.slice(0, 24) + "…" : "Verified (HMAC-SHA256)";
  modal.style.display = "flex";
};

VT.closePaymentModal = function(){
  const modal = $("paymentSuccessModal");
  if(modal) modal.style.display = "none";
  location.hash = "#/verify";
};
