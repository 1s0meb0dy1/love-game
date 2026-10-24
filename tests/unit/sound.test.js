const src=require('../src-loader.js')();
const m=src.match(/const SoundFX = \{[\s\S]*?\n        \};\n/)[0];
const calls=[]; const mkNode=(n)=>new Proxy({},{get:(t,k)=>{ if(k==='connect') return (x)=>{calls.push(n+'.connect'); return x;}; if(['start','stop'].includes(k)) return (...a)=>calls.push(n+'.'+k+'('+a.map(v=>(+v).toFixed(2)).join(',')+')'); if(['frequency','gain','Q'].includes(k)) return new Proxy({},{get:(t2,k2)=>(...a)=>{calls.push(n+'.'+k+'.'+String(k2)+'('+a.map(v=>(+v).toFixed(4)).join(',')+')'); if(k2.includes('exponential')&&!(a[0]>0)) throw new Error('exponentialRamp to <=0');}, set:()=>true}); return undefined; }, set:()=>true});
class AC{constructor(){this.currentTime=0;this.sampleRate=44100;this.state='running';this.destination=mkNode('dest');} createOscillator(){return mkNode('osc');} createGain(){return mkNode('gain');} createBiquadFilter(){return mkNode('filt');} createBufferSource(){return mkNode('src');} createBuffer(c,l,r){return {getChannelData:()=>new Float32Array(l)};} resume(){return Promise.resolve();}}
const win={AudioContext:AC}; const timers=[]; 
const f=new Function('window','navigator','document','setTimeout',m+'return SoundFX;')(win,{vibrate:()=>true},{getElementById:()=>null},(fn,ms)=>{timers.push([fn,ms]);});
const out=[]; const t=(n,c)=>out.push((c?'PASS ':'FAIL ')+n);
let thrown=false; try{ f.click(); f.flip('right'); f.flip('left'); timers.forEach(([fn])=>fn()); }catch(e){thrown=e.message;} t('click() и flip() выполняются без ошибок (в т.ч. нет exponentialRamp к нулю)',!thrown);
t('flip: шум проходит через полосовой фильтр с разверткой частоты',calls.some(c=>/filt\.frequency\.exponentialRampToValueAtTime/.test(c))&&calls.some(c=>/src\.start/.test(c)));
const n1=calls.length; f.muted=true; f.click(); f.flip('right'); t('при выключенном звуке ничего не воспроизводится',calls.length===n1);
f.muted=false; f.skipNextFlip=true; const n2=calls.length; f.flip('right'); t('skipNextFlip: первый flip пропускается (нет двойного звука при свайпе)',calls.length===n2&&f.skipNextFlip===false);
f.flip('right'); t('следующий flip снова звучит',calls.length>n2);
const hap=[]; const f2=new Function('window','navigator','document','setTimeout',m+'return SoundFX;')({AudioContext:AC},{vibrate:(p)=>{hap.push(p);}},{getElementById:()=>null},(fn)=>{}); f2.click(); f2.lastHaptic=0; f2.flip('left'); t('тактильный отклик лёгкий (8 мс) для нажатия и перелистывания',hap.length===2&&hap.every(p=>p===8));
console.log(out.join('\n'));
