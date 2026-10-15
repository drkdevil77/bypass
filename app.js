const $ = (id) => document.getElementById(id);
let introBuffer = null, musicBuffer = null, resultUrl = null;
let previewSource = null, previewNodes = [], previewToken = 0;
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function fmt(seconds){if(!Number.isFinite(seconds))return "--:--";const m=Math.floor(seconds/60),s=Math.floor(seconds%60);return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;}
function selectedBuffer(){return $("activeTrack").value === "intro" ? introBuffer : musicBuffer;}
function selectedName(){return $("activeTrack").value === "intro" ? "intro" : "music";}
function updateReady(){const ready=!!selectedBuffer();$("processBtn").disabled=!ready;$("livePreviewBtn").disabled=!ready;$("previewStatus").textContent=ready?"Ready for live preview":"Upload the selected track";}
async function loadFile(inputId, kind){
  const input = $(inputId), file = input.files?.[0]; if(!file)return;
  const name = kind === "intro" ? "introName":"musicName", meta = kind === "intro" ? "introMeta":"musicMeta", bar = kind === "intro" ? "introBar":"musicBar", duration = kind === "intro" ? "introDuration":"musicDuration";
  $(name).textContent = file.name; $(meta).textContent = "Loading audio…"; $(bar).style.width = "35%";
  try{
    const decoded = await audioCtx.decodeAudioData(await file.arrayBuffer());
    if(kind === "intro") introBuffer = decoded; else musicBuffer = decoded;
    $(meta).textContent = `${(file.size/1024/1024).toFixed(2)} MB · ${decoded.numberOfChannels} channel${decoded.numberOfChannels===1?"":"s"}`;
    $(duration).textContent = fmt(decoded.duration); $(bar).style.width = "100%"; updateReady();
  }catch(e){$(meta).textContent = "Couldn't read this file. Try WAV or MP3.";$(bar).style.width="0%";if(kind==="intro")introBuffer=null;else musicBuffer=null;updateReady();}
}
$("introFile").addEventListener("change",()=>loadFile("introFile","intro"));
$("musicFile").addEventListener("change",()=>loadFile("musicFile","music"));
function setupDrop(id,inputId){const el=$(id);["dragenter","dragover"].forEach(ev=>el.addEventListener(ev,e=>{e.preventDefault();el.style.background="#65e7f50d";el.style.outline="1px dashed #65e7f5";}));["dragleave","drop"].forEach(ev=>el.addEventListener(ev,e=>{e.preventDefault();el.style.background="";el.style.outline="";}));el.addEventListener("drop",e=>{const f=e.dataTransfer.files?.[0];if(!f||!f.type.startsWith("audio/"))return;const dt=new DataTransfer();dt.items.add(f);$(inputId).files=dt.files;$(inputId).dispatchEvent(new Event("change"));});}
setupDrop("introDrop","introFile");setupDrop("musicDrop","musicFile");
function updateLabels(){
  const gain=Number($("gain").value), reverb=Number($("reverb").value), space=Number($("space").value), speed=Number($("speed").value), pitch=Number($("pitch").value), filter=Number($("filter").value), echo=Number($("echo").value), echoTime=Number($("echoTime").value);
  $("gainValue").textContent=`${gain>0?"+":""}${gain.toFixed(1)} dB`;$("reverbValue").textContent=`${reverb}%`;$("spaceValue").textContent=`${space.toFixed(1)} s`;$("speedValue").textContent=`${speed.toFixed(2)}×`;$("pitchValue").textContent=`${pitch>0?"+":""}${pitch} semitones`;$("filterValue").textContent=filter>=1000?`${(filter/1000).toFixed(filter%1000?1:0)} kHz`:`${filter} Hz`;$("echoValue").textContent=`${echo}%`;$("echoTimeValue").textContent=`${echoTime} ms`;
}
["gain","reverb","space","speed","pitch","filter","echo","echoTime"].forEach(id=>$(id).addEventListener("input",()=>{updateLabels();if(previewSource)restartPreviewAtCurrentPosition();}));
$("activeTrack").addEventListener("change",()=>{stopPreview();updateReady();});
function makeImpulse(ctx, seconds, decay=2.2){const length=Math.max(1,Math.floor(ctx.sampleRate*seconds)), impulse=ctx.createBuffer(2,length,ctx.sampleRate);for(let ch=0;ch<2;ch++){const d=impulse.getChannelData(ch);for(let i=0;i<length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/length,decay);}return impulse;}
function effectSettings(){return {gain:Math.pow(10,Number($("gain").value)/20),wet:Number($("reverb").value)/100,space:Number($("space").value),speed:Number($("speed").value),pitch:Number($("pitch").value),filter:Number($("filter").value),echo:Number($("echo").value)/100,echoTime:Number($("echoTime").value)/1000};}
function effectiveRate(s){return s.speed*Math.pow(2,s.pitch/12);}
function connectEffects(ctx, source, destination, s){
  const filter=ctx.createBiquadFilter();filter.type="lowpass";filter.frequency.value=s.filter;filter.Q.value=.7;source.connect(filter);
  const inputGain=ctx.createGain();inputGain.gain.value=1;filter.connect(inputGain);
  const dry=ctx.createGain(), wet=ctx.createGain(), convolver=ctx.createConvolver();dry.gain.value=1-s.wet;wet.gain.value=s.wet;convolver.buffer=makeImpulse(ctx,s.space);
  inputGain.connect(dry);dry.connect(destination);inputGain.connect(convolver);convolver.connect(wet);wet.connect(destination);
  if(s.echo>0){const delay=ctx.createDelay(1);delay.delayTime.value=s.echoTime;const feedback=ctx.createGain();feedback.gain.value=Math.min(.72,s.echo*.72);const echoWet=ctx.createGain();echoWet.gain.value=s.echo;inputGain.connect(delay);delay.connect(feedback);feedback.connect(delay);delay.connect(echoWet);echoWet.connect(destination);}
  source.playbackRate.value=effectiveRate(s);
  return [filter,inputGain,dry,wet,convolver];
}
function stopPreview(){previewToken++;if(previewSource){try{previewSource.stop();}catch{}previewSource.disconnect();}previewSource=null;previewNodes.forEach(n=>{try{n.disconnect();}catch{}});previewNodes=[];$("stopPreviewBtn").disabled=true;$("livePreviewBtn").disabled=!selectedBuffer();$("previewStatus").textContent=selectedBuffer()?"Preview stopped":"Upload the selected track";}
async function startPreview(offset=0){const buffer=selectedBuffer();if(!buffer)return;stopPreview();const token=++previewToken;await audioCtx.resume();const s=effectSettings(),source=audioCtx.createBufferSource(),master=audioCtx.createGain();source.buffer=buffer;master.gain.value=s.gain;const nodes=connectEffects(audioCtx,source,master,s);master.connect(audioCtx.destination);previewSource=source;previewNodes=[...nodes,master];$("livePreviewBtn").disabled=true;$("stopPreviewBtn").disabled=false;$("previewStatus").textContent="Playing live effects…";source.onended=()=>{if(token===previewToken){previewSource=null;previewNodes=[];$("livePreviewBtn").disabled=!selectedBuffer();$("stopPreviewBtn").disabled=true;$("previewStatus").textContent="Preview finished";}};source.start(0,Math.min(offset,Math.max(0,buffer.duration-.01)));}
function restartPreviewAtCurrentPosition(){if(!previewSource)return;const buffer=selectedBuffer();const elapsed=Math.max(0,audioCtx.currentTime-previewSourceStartTime);const offset=previewOffset+elapsed*effectiveRate(previewSettings);if(offset>=(buffer?.duration||0)){stopPreview();return;}startPreview(offset);}
let previewSourceStartTime=0,previewOffset=0,previewSettings=effectSettings();
const originalStartPreview=startPreview;
startPreview=async function(offset=0){previewOffset=offset;previewSettings=effectSettings();await originalStartPreview(offset);if(previewSource)previewSourceStartTime=audioCtx.currentTime;};
$("livePreviewBtn").addEventListener("click",()=>startPreview(0));$("stopPreviewBtn").addEventListener("click",stopPreview);
async function processAudio(){const buffer=selectedBuffer();if(!buffer)return;stopPreview();const btn=$("processBtn");btn.disabled=true;$("result").hidden=true;$("progressWrap").hidden=false;$("progressText").textContent="Preparing selected track…";$("progressPct").textContent="10%";$("progressFill").style.width="10%";
 try{const s=effectSettings(),rate=effectiveRate(s),sr=44100,renderDuration=buffer.duration/rate+s.space+Math.max(.1,s.echoTime*3*s.echo),frames=Math.ceil(renderDuration*sr),offline=new OfflineAudioContext(2,frames,sr);const source=offline.createBufferSource();source.buffer=buffer;source.playbackRate.value=rate;const master=offline.createGain();master.gain.value=s.gain;const limiter=offline.createDynamicsCompressor();limiter.threshold.value=-1;limiter.knee.value=4;limiter.ratio.value=8;limiter.attack.value=.003;limiter.release.value=.15;master.connect(limiter);limiter.connect(offline.destination);connectEffects(offline,source,master,s);source.start(0);$("progressText").textContent="Rendering effects…";$("progressPct").textContent="35%";$("progressFill").style.width="35%";const rendered=await offline.startRendering();$("progressText").textContent="Encoding WAV…";$("progressPct").textContent="85%";$("progressFill").style.width="85%";const wav=encodeWav(rendered);if(resultUrl)URL.revokeObjectURL(resultUrl);resultUrl=URL.createObjectURL(wav);$("preview").src=resultUrl;$("downloadBtn").href=resultUrl;$("downloadBtn").download=`wraiths-${selectedName()}-processed.wav`;$("resultMeta").textContent=`WAV · stereo · 44.1 kHz · ${fmt(rendered.duration)} · ${rate.toFixed(2)}× playback rate`;$("progressText").textContent="Done. Your track is ready.";$("progressPct").textContent="100%";$("progressFill").style.width="100%";$("result").hidden=false;
 }catch(err){console.error(err);$("progressText").textContent="Processing failed. Try a shorter or different audio file.";$("progressPct").textContent="ERROR";}finally{btn.disabled=!selectedBuffer();}}
function encodeWav(buffer){const channels=2,rate=buffer.sampleRate,frames=buffer.length,bytes=2,ab=new ArrayBuffer(44+frames*channels*bytes),view=new DataView(ab);const write=(offset,str)=>{for(let i=0;i<str.length;i++)view.setUint8(offset+i,str.charCodeAt(i));};write(0,"RIFF");view.setUint32(4,36+frames*channels*bytes,true);write(8,"WAVE");write(12,"fmt ");view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,rate,true);view.setUint32(28,rate*channels*bytes,true);view.setUint16(32,channels*bytes,true);view.setUint16(34,16,true);write(36,"data");view.setUint32(40,frames*channels*bytes,true);const left=buffer.getChannelData(0),right=buffer.getChannelData(1);let offset=44;for(let i=0;i<frames;i++){for(const sample of [left[i],right[i]]){const v=Math.max(-1,Math.min(1,sample));view.setInt16(offset,v<0?v*32768:v*32767,true);offset+=2;}}return new Blob([ab],{type:"audio/wav"});}
$("processBtn").addEventListener("click",processAudio);
$("resetBtn").addEventListener("click",()=>{stopPreview();introBuffer=null;musicBuffer=null;for(const id of ["introFile","musicFile"])$(id).value="";for(const id of ["introName","musicName"])$(id).textContent="Drop an audio file here";for(const id of ["introMeta","musicMeta"])$(id).textContent="or click to browse your device";for(const id of ["introBar","musicBar"])$(id).style.width="0%";for(const id of ["introDuration","musicDuration"])$(id).textContent="--:--";$("result").hidden=true;$("progressWrap").hidden=true;updateReady();window.scrollTo({top:document.querySelector(".workspace").offsetTop-20,behavior:"smooth"});});
updateLabels();updateReady();
