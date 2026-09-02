const $ = s => document.querySelector(s);
let imageFile = null, pdfFile = null;

function fmt(bytes){if(bytes<1024)return bytes+" B";if(bytes<1048576)return (bytes/1024).toFixed(1)+" KB";return (bytes/1048576).toFixed(2)+" MB"}
function pct(a,b){return b ? Math.max(0,Math.round((1-a/b)*100)) : 0}
function setupInput(input, drop, onFile){
  input.addEventListener("change",()=>{if(input.files[0]) onFile(input.files[0])});
  ["dragover"].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.add("drag")}));
  ["dragleave","drop"].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.remove("drag")}));
  drop.addEventListener("drop",ev=>{if(ev.dataTransfer.files[0]) onFile(ev.dataTransfer.files[0])});
}
function showImage(file){
  if(!file.type.startsWith("image/")) return alert("Please choose an image file.");
  imageFile=file; $("#imageName").textContent=file.name; $("#imageOriginal").textContent=fmt(file.size);
  $("#imageControls").classList.remove("hidden"); $("#imageResult").classList.add("hidden");
}
function showPdf(file){
  if(file.type!=="application/pdf") return alert("Please choose a PDF file.");
  pdfFile=file; $("#pdfName").textContent=file.name; $("#pdfOriginal").textContent=fmt(file.size);
  $("#pdfControls").classList.remove("hidden"); $("#pdfResult").classList.add("hidden");
}
setupInput($("#imageInput"),$("#imageDrop"),showImage);
setupInput($("#pdfInput"),$("#pdfDrop"),showPdf);
$("#quality").addEventListener("input",e=>$("#qualityValue").textContent=e.target.value+"%");
$("#imageReset").onclick=()=>{$("#imageInput").value="";$("#imageControls").classList.add("hidden");imageFile=null};
$("#pdfReset").onclick=()=>{$("#pdfInput").value="";$("#pdfControls").classList.add("hidden");pdfFile=null};

$("#compressImage").onclick=async()=>{
  if(!imageFile)return;
  const q=Number($("#quality").value)/100, format=$("#imageFormat").value;
  const img=new Image(); img.src=URL.createObjectURL(imageFile);
  await new Promise((res,rej)=>{img.onload=res;img.onerror=rej});
  const maxSide=5000, scale=Math.min(1,maxSide/Math.max(img.naturalWidth,img.naturalHeight));
  const canvas=document.createElement("canvas"); canvas.width=Math.round(img.naturalWidth*scale); canvas.height=Math.round(img.naturalHeight*scale);
  canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
  const blob=await new Promise(r=>canvas.toBlob(r,format,q));
  const ext=format==="image/webp"?"webp":"jpg";
  const url=URL.createObjectURL(blob);
  $("#imageResult").innerHTML=`<strong>Done!</strong><br>Original: ${fmt(imageFile.size)}<br>Compressed: ${fmt(blob.size)}<br>Saved: ${pct(blob.size,imageFile.size)}% <a href="${url}" download="${imageFile.name.replace(/\.[^.]+$/,"")+"."+ext}">Download compressed image →</a>`;
  $("#imageResult").classList.remove("hidden");
  URL.revokeObjectURL(img.src);
};

$("#compressPdf").onclick=async()=>{
  if(!pdfFile)return;
  const result=$("#pdfResult"); result.classList.remove("hidden"); result.textContent="Optimizing PDF…";
  try{
    const bytes=new Uint8Array(await pdfFile.arrayBuffer());
    const pdfDoc=await PDFLib.PDFDocument.load(bytes,{ignoreEncryption:true,updateMetadata:false});
    const out=await pdfDoc.save({useObjectStreams:true,addDefaultPage:false});
    const blob=new Blob([out],{type:"application/pdf"}), url=URL.createObjectURL(blob);
    result.innerHTML=`<strong>Done!</strong><br>Original: ${fmt(pdfFile.size)}<br>New: ${fmt(blob.size)}<br>Saved: ${pct(blob.size,pdfFile.size)}% <a href="${url}" download="${pdfFile.name.replace(/\.pdf$/i,"")}-compressed.pdf">Download PDF →</a>`;
  }catch(e){result.textContent="This PDF could not be optimized in the browser. Try another PDF."}
};