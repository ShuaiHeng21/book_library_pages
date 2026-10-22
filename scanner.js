import {canonicalISBN} from './isbn.js';
let loading;
export function loadZXing(){if(globalThis.ZXing)return Promise.resolve(globalThis.ZXing);if(!loading)loading=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL('./zxing.min.js',import.meta.url).href;script.onload=()=>globalThis.ZXing?resolve(globalThis.ZXing):reject(Error('扫码组件加载失败'));script.onerror=()=>reject(Error('扫码组件加载失败，请刷新后重试或输入 ISBN'));document.head.append(script);}).catch(e=>{loading=null;throw e;});return loading;}
async function fallbackDecoder(){const zxing=await loadZXing(),hints=new Map();hints.set(zxing.DecodeHintType.POSSIBLE_FORMATS,[zxing.BarcodeFormat.EAN_13]);hints.set(zxing.DecodeHintType.TRY_HARDER,true);const reader=new zxing.BrowserMultiFormatReader(hints);return {read:async element=>{try{return reader.decode(element).getText();}catch{return null;}},close:()=>reader.reset()};}
// Decode the visible centre at camera resolution, then the whole frame. Avoid
// BrowserMultiFormatReader's cached capture dimensions when switching crops.
export function scanRegion(width,height,boxWidth,boxHeight){
 const scale=Math.max(boxWidth/width,boxHeight/height);
 const w=Math.min(width,boxWidth/scale),h=Math.min(height,boxHeight/scale*.65);
 return {x:(width-w)/2,y:(height-h)/2,width:w,height:h};
}
async function createDecoder(){
 let detector;
 try{if(globalThis.BarcodeDetector&&(await BarcodeDetector.getSupportedFormats()).includes('ean_13'))detector=new BarcodeDetector({formats:['ean_13']});}catch{}
 let software;try{software=await loadZXing();}catch(error){if(!detector)throw error;}
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
 let reader;
 if(software){const hints=new Map([[software.DecodeHintType.POSSIBLE_FORMATS,[software.BarcodeFormat.EAN_13]],[software.DecodeHintType.TRY_HARDER,true]]);reader=new software.MultiFormatReader();reader.setHints(hints);}
 let attempt=0;
 return {read:async video=>{
  if(detector){try{const results=await detector.detect(video);const isbn=results.map(result=>canonicalISBN(result.rawValue)).find(Boolean);if(isbn)return isbn;}catch{detector=null;}}
  // Native detection can silently return no results forever on some Android
  // devices. Run the same software engine used for photos on every miss.
  if(!reader||!video.videoWidth||!video.videoHeight)return null;
  const width=video.videoWidth,height=video.videoHeight;
  const region=attempt++%2===0?scanRegion(width,height,video.clientWidth||width,video.clientHeight||height):{x:0,y:0,width,height};
  const scale=Math.min(1,1600/region.width);
  canvas.width=Math.round(region.width*scale);canvas.height=Math.round(region.height*scale);
  ctx.drawImage(video,region.x,region.y,region.width,region.height,0,0,canvas.width,canvas.height);
  try{return reader.decodeWithState(new software.BinaryBitmap(new software.HybridBinarizer(new software.HTMLCanvasElementLuminanceSource(canvas)))).getText();}catch{return null;}
 },close:()=>reader?.reset()};
}
export async function configureFocus(track){
 try{if(track?.getCapabilities?.().focusMode?.includes('continuous'))await track.applyConstraints({...track.getConstraints?.(),advanced:[{focusMode:'continuous'}]});}catch{/* Optional camera settings must never prevent scanning. */}
}
export function cameraError(error){return error?.name==='NotAllowedError'?'摄像头权限被拒绝。请在浏览器的网站权限中允许摄像头，或改用拍照 / 输入 ISBN。':error?.name==='NotFoundError'?'未找到可用摄像头，请使用拍照或手动输入 ISBN。':error?.name==='NotReadableError'?'摄像头正被其他应用占用，请关闭后重试。':'无法开启摄像头，请使用安卓 Chrome 或 Edge 打开 HTTPS 网页，或改用拍照 / 输入 ISBN。';}
export class BookScanner{
 constructor(video,onISBN,onStatus){this.video=video;this.onISBN=onISBN;this.onStatus=onStatus;this.run=0;}
 stop(){this.run++;clearTimeout(this.timer);this.stream?.getTracks().forEach(track=>track.stop());this.stream=null;this.decoder?.close();this.decoder=null;this.video.pause();this.video.srcObject=null;}
 async start(){this.stop();const run=this.run;try{if(!globalThis.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw Error('Camera unavailable');this.onStatus('正在请求摄像头权限…');const decoder=await createDecoder();if(run!==this.run){decoder.close();return;}this.decoder=decoder;const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}}});if(run!==this.run){stream.getTracks().forEach(t=>t.stop());return;}this.stream=stream;this.video.srcObject=stream;await this.video.play();if(run!==this.run)return;await configureFocus(stream.getVideoTracks?.()[0]);if(run!==this.run)return;this.onStatus('将整段条形码横向放入框内，左右留白；距离约 15–25 厘米，等画面清晰后保持不动。');
 const scan=async()=>{if(run!==this.run)return;try{if(this.video.readyState>=2){const raw=await this.decoder.read(this.video);if(run!==this.run)return;const isbn=canonicalISBN(raw);if(isbn){this.stop();this.onISBN(isbn);return;}if(raw)this.onStatus('这不是有效的书籍 ISBN，请扫描书背面的主条形码。');}}catch{if(run!==this.run)return;}if(run===this.run)this.timer=setTimeout(scan,150);};scan();
 }catch(error){if(run!==this.run)return;this.stop();this.onStatus(cameraError(error));}}
 async photo(file){this.stop();const run=this.run;if(!file||!file.type.startsWith('image/'))throw Error('请选择照片或图片文件。');if(file.size>15*1024*1024)throw Error('图片太大，请选择 15 MB 以内的条形码照片。');const url=URL.createObjectURL(file);let decoder;
 try{const image=new Image();image.src=url;await image.decode();if(run!==this.run)return null;decoder=await fallbackDecoder();if(run!==this.run)return null;const isbn=canonicalISBN(await decoder.read(image));if(!isbn)throw Error('未识别到有效 ISBN。请拍清楚整段条形码、避免反光，或手动输入下方数字。');return isbn;}finally{decoder?.close();URL.revokeObjectURL(url);}
 }
}
