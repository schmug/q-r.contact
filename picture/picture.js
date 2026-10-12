// Picture QR: embeds an image in a QR code (technique: andrewt.net/dithered-qr-codes/wtf/).
// Client-side only — no uploads, no fetches. Deps: vendor/qrcode-generator, vendor/jsqr.
const DEFAULT_URL = "";
const SUB = 3, QUIET = 4;
const $ = id => document.getElementById(id);
const S = {
  url: DEFAULT_URL, zoom: 1.3, panx: 0, pany: 0, contrast: 1.3, bright: 1.35,
  invert: false, ecc: 'H', minver: 0, dark: '#12286e', light: '#ffffff'
};
let img = null, last = null;

qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

function alignmentPositions(ver){
  if (ver === 1) return [];
  const size = ver*4+17, n = Math.floor(ver/7)+2;
  const step = ver === 32 ? 26 : Math.floor((ver*4+n*2+1)/(n*2-2))*2;
  const pos = [6];
  for (let i=0;i<n-1;i++) pos.splice(1,0,size-7-i*step);
  return pos;
}
function functionMask(ver){
  const n = ver*4+17, m = Array.from({length:n},()=>new Uint8Array(n));
  const fill=(r0,c0,h,w)=>{for(let r=r0;r<r0+h;r++)for(let c=c0;c<c0+w;c++)if(r>=0&&c>=0&&r<n&&c<n)m[r][c]=1};
  fill(0,0,8,8); fill(0,n-8,8,8); fill(n-8,0,8,8);
  fill(6,0,1,n); fill(0,6,n,1);
  const ap = alignmentPositions(ver);
  for (const r of ap) for (const c of ap){
    if ((r===6&&c===6)||(r===6&&c===n-7)||(r===n-7&&c===6)) continue;
    fill(r-2,c-2,5,5);
  }
  fill(8,0,1,9); fill(0,8,9,1); fill(8,n-8,1,8); fill(n-8,8,8,1);
  if (ver>=7){ fill(0,n-11,6,3); fill(n-11,0,3,6); }
  return m;
}
function makeQR(text, ecc, minver){
  for (let v = Math.max(1,minver); v <= 40; v++){
    try { const q = qrcode(minver ? v : 0, ecc); q.addData(text); q.make(); return q; }
    catch(e){ if (!minver) throw e; }
  }
  throw new Error('Too much data for a QR code');
}

function sourceLuminance(side){
  const c = document.createElement('canvas'); c.width = c.height = side;
  const x = c.getContext('2d', {willReadFrequently:true});
  // background: sample image corner so padding blends in
  let bg = '#ffffff';
  if (img){
    const t = document.createElement('canvas'); t.width=t.height=4;
    const tx = t.getContext('2d'); tx.drawImage(img,0,0,8,8,0,0,4,4);
    const d = tx.getImageData(0,0,1,1).data; bg = `rgb(${d[0]},${d[1]},${d[2]})`;
  }
  x.fillStyle = bg; x.fillRect(0,0,side,side);
  if (img){
    // SVGs without width/height report 0×0; treat them as square instead of scaling by Infinity.
    const w = img.naturalWidth || img.width || side, h = img.naturalHeight || img.height || side;
    const s = side / Math.max(w,h) * S.zoom;
    const dw = w*s, dh = h*s;
    x.imageSmoothingQuality = 'high';
    x.drawImage(img, (side-dw)/2 + S.panx*side, (side-dh)/2 + S.pany*side, dw, dh);
  }
  const d = x.getImageData(0,0,side,side).data, L = new Float32Array(side*side);
  let sum = 0;
  for (let i=0;i<L.length;i++){ const v=(0.299*d[i*4]+0.587*d[i*4+1]+0.114*d[i*4+2])/255; L[i]=S.invert?1-v:v; sum+=L[i]; }
  const mean = sum/L.length;
  for (let i=0;i<L.length;i++){
    let v = (L[i]-mean)*S.contrast + mean; v = Math.min(1,Math.max(0,v));
    v = Math.min(1, v*S.bright); L[i] = v;
  }
  return L;
}

function render(){
  let q;
  try { q = makeQR(S.url || ' ', S.ecc, S.minver); }
  catch(e){ setStatus([['bad', e.message]]); return; }
  const n = q.getModuleCount(), ver = (n-17)/4, side = n*SUB;
  const fm = functionMask(ver);
  const out = sourceLuminance(side), fixed = new Uint8Array(side*side);
  const at = (y,x)=>y*side+x;

  // function patterns are solid blocks; with no picture yet, every module is (plain QR)
  for (let r=0;r<n;r++) for (let c=0;c<n;c++) if (fm[r][c] || !img){
    const v = q.isDark(r,c)?0:1;
    for (let y=0;y<SUB;y++) for (let x=0;x<SUB;x++){ const i=at(r*SUB+y,c*SUB+x); out[i]=v; fixed[i]=1; }
  }
  // pass 1: data centres fixed, error to the 8 free neighbours
  for (let r=0;r<n;r++) for (let c=0;c<n;c++){
    if (fm[r][c]) continue;
    const y=r*SUB+1, x=c*SUB+1, i=at(y,x), v=q.isDark(r,c)?0:1;
    const err = out[i]-v; out[i]=v; fixed[i]=1;
    const nb=[];
    for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++){ if(!dy&&!dx)continue; const j=at(y+dy,x+dx); if(!fixed[j]) nb.push(j); }
    for (const j of nb) out[j] += err/nb.length;
  }
  // pass 2: Floyd–Steinberg over remaining pixels
  const K=[[0,1,7],[1,-1,3],[1,0,5],[1,1,1]];
  for (let y=0;y<side;y++) for (let x=0;x<side;x++){
    const i=at(y,x); if (fixed[i]) continue;
    const old=out[i], nv=old>=0.5?1:0; out[i]=nv; const e=old-nv;
    for (const [dy,dx,w] of K){ const yy=y+dy, xx=x+dx;
      if (yy<side && xx>=0 && xx<side){ const j=at(yy,xx); if(!fixed[j]) out[j]+=e*w/16; } }
  }
  const total = side + 2*QUIET*SUB, bits = new Uint8Array(total*total).fill(1);
  for (let y=0;y<side;y++) for (let x=0;x<side;x++) bits[(y+QUIET*SUB)*total + x+QUIET*SUB] = out[at(y,x)]>=0.5?1:0;
  last = {bits,total,ver,n};
  paint($('preview'), 1);
  verify(ver, n);
}

function hexRGB(h){ const v=parseInt(h.slice(1),16); return [v>>16&255,v>>8&255,v&255]; }
function paint(canvas, scale){
  const {bits,total} = last, W = total*scale;
  canvas.width = canvas.height = W;
  const x = canvas.getContext('2d'), id = x.createImageData(W,W), d = id.data;
  const D = hexRGB(S.dark), Lc = hexRGB(S.light);
  for (let py=0;py<W;py++){ const sy=(py/scale)|0;
    for (let px=0;px<W;px++){ const b=bits[sy*total+((px/scale)|0)], c=b?Lc:D, k=(py*W+px)*4;
      d[k]=c[0]; d[k+1]=c[1]; d[k+2]=c[2]; d[k+3]=255; } }
  x.putImageData(id,0,0);
  return canvas;
}
function lum(h){ const [r,g,b]=hexRGB(h).map(v=>{v/=255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4}); return 0.2126*r+0.7152*g+0.0722*b; }
function verify(ver,n){
  const c = paint(document.createElement('canvas'), 4);
  const d = c.getContext('2d').getImageData(0,0,c.width,c.height);
  let ok=false; try { const r = jsQR(d.data, d.width, d.height); ok = !!r && r.data === S.url; } catch(e){}
  const cr = (Math.max(lum(S.dark),lum(S.light))+0.05)/(Math.min(lum(S.dark),lum(S.light))+0.05);
  const pills = [!S.url ? ['', 'Enter a link to encode'] :
    [ok?'ok':'bad', ok?'✓ Scans in-browser':'✗ Didn’t decode — try more contrast or a higher version'],
    ['', `Version ${ver} · ${n}×${n} modules`]];
  if (lum(S.dark) > lum(S.light)) pills.push(['bad','Dark colour is lighter than light colour']);
  else if (cr < 4) pills.push(['bad',`Low colour contrast (${cr.toFixed(1)}:1)`]);
  setStatus(pills);
}
function setStatus(list){
  $('status').replaceChildren(...list.map(([cls,t])=>{const s=document.createElement('span'); s.className='pill '+cls; s.textContent=t; return s;}));
}

function download(blob, name){ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),2000); }
$('download').onclick = ()=>{ if(!last)return; paint(document.createElement('canvas'), +$('scale').value).toBlob(b=>download(b,'picture-qr.png'),'image/png'); };
$('downloadSvg').onclick = ()=>{
  if(!last)return; const {bits,total}=last; let p='';
  for (let y=0;y<total;y++){ let x=0; while(x<total){ if(bits[y*total+x]){x++;continue;} let s=x; while(x<total&&!bits[y*total+x])x++; p+=`M${s} ${y}h${x-s}v1h${s-x}z`; } }
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="${S.light}"/><path fill="${S.dark}" d="${p}"/></svg>`;
  download(new Blob([svg],{type:'image/svg+xml'}),'picture-qr.svg');
};

function loadImage(src){
  const i = new Image();
  i.onload = ()=>{ img=i; $('thumb').src=src; render(); };
  i.onerror = ()=> setStatus([['bad','Couldn’t read that image']]);
  i.src = src;
}
function loadFile(f){ if(!f||!f.type.startsWith('image/'))return; const r=new FileReader(); r.onload=()=>{ S.zoom=1; S.panx=S.pany=0; syncInputs(); loadImage(r.result); }; r.readAsDataURL(f); }
$('file').onchange = e=>loadFile(e.target.files[0]);
const drop=$('drop');
['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over')}));
['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over')}));
drop.addEventListener('drop',e=>loadFile(e.dataTransfer.files[0]));
window.addEventListener('paste',e=>{ for(const it of e.clipboardData.items) if(it.type.startsWith('image/')){ loadFile(it.getAsFile()); e.preventDefault(); break; } });

const fmt = { zoom:v=>(+v).toFixed(2)+'×', panx:v=>(+v*100).toFixed(0)+'%', pany:v=>(+v*100).toFixed(0)+'%', contrast:v=>(+v).toFixed(2), bright:v=>(+v).toFixed(2) };
function syncInputs(){
  for (const k of ['zoom','panx','pany','contrast']) { $(k).value=S[k]; $(k+'V').textContent=fmt[k](S[k]); }
  $('bright').value=S.bright; $('brightV').textContent=fmt.bright(S.bright);
  $('invert').checked=S.invert; $('ecc').value=S.ecc; $('minver').value=S.minver; $('dark').value=S.dark; $('light').value=S.light;
  $('url').value=S.url; $('charcount').textContent=`${new TextEncoder().encode(S.url).length} bytes`;
}
const minv=$('minver'); minv.add(new Option('Auto',0)); for(let v=1;v<=40;v++) minv.add(new Option(`${v} (${v*4+17}×${v*4+17})`,v));
let raf=0; const schedule=()=>{cancelAnimationFrame(raf); raf=requestAnimationFrame(render);};
for (const k of ['zoom','panx','pany','contrast','bright']) $(k).addEventListener('input',e=>{ S[k]=+e.target.value; $(k+'V').textContent=fmt[k](S[k]); schedule(); });
$('invert').onchange=e=>{S.invert=e.target.checked;schedule();};
$('ecc').onchange=e=>{S.ecc=e.target.value;schedule();};
$('minver').onchange=e=>{S.minver=+e.target.value;schedule();};
$('dark').oninput=e=>{S.dark=e.target.value;schedule();};
$('light').oninput=e=>{S.light=e.target.value;schedule();};
$('url').addEventListener('input',e=>{S.url=e.target.value.trim(); $('charcount').textContent=`${new TextEncoder().encode(S.url).length} bytes`; schedule();});

syncInputs();
render();
