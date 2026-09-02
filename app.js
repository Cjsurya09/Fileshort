const $ = (selector) => document.querySelector(selector);

let imageFile = null;
let pdfFile = null;
let pdfTargetMB = 1;


// -----------------------------
// FILE SIZE
// -----------------------------

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";

  if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(1) + " KB";
  }

  if (bytes < 1024 * 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }

  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
}


// -----------------------------
// IMAGE COMPRESSOR
// -----------------------------

function setupInput(inputSelector, dropSelector, onFile) {
  const input = document.querySelector(inputSelector);
  const drop = document.querySelector(dropSelector);

  if (!input) {
    console.error("File input not found:", inputSelector);
    return;
  }

  // FILE PICKER
  input.addEventListener("change", function () {
    const file = this.files && this.files[0];

    console.log("FILE SELECTED:", file);

    if (file) {
      onFile(file);
    }
  });

  // DROPZONE
  if (!drop) {
    console.warn("Dropzone not found:", dropSelector);
    return;
  }

  ["dragenter", "dragover"].forEach(eventName => {
    drop.addEventListener(eventName, e => {
      e.preventDefault();
      e.stopPropagation();
      drop.classList.add("drag");
    });
  });

  ["dragleave", "drop"].forEach(eventName => {
    drop.addEventListener(eventName, e => {
      e.preventDefault();
      e.stopPropagation();
      drop.classList.remove("drag");
    });
  });

  drop.addEventListener("drop", e => {
    const file = e.dataTransfer.files?.[0];

    console.log("FILE DROPPED:", file);

    if (file) {
      onFile(file);
    }
  });
}


function showImage(file) {

  if (!file.type.startsWith("image/")) {
    alert("Please choose an image file.");
    return;
  }

  imageFile = file;

  $("#imageName").textContent = file.name;
  $("#imageOriginal").textContent = formatBytes(file.size);

  $("#imageControls").classList.remove("hidden");
  $("#imageResult").classList.add("hidden");
}


setupInput(
  "#imageInput",
  "#imageDrop",
  showImage
);


$("#quality")?.addEventListener("input", e => {
  $("#qualityValue").textContent = e.target.value + "%";
});


$("#imageReset")?.addEventListener("click", () => {

  imageFile = null;

  $("#imageInput").value = "";

  $("#imageControls").classList.add("hidden");
  $("#imageResult").classList.add("hidden");
});


$("#compressImage")?.addEventListener("click", async () => {

  if (!imageFile) return;

  const quality = Number($("#quality").value) / 100;
  const format = $("#imageFormat").value;

  const img = new Image();

  img.src = URL.createObjectURL(imageFile);

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  const maxSide = 5000;

  const scale = Math.min(
    1,
    maxSide / Math.max(img.naturalWidth, img.naturalHeight)
  );

  const canvas = document.createElement("canvas");

  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);

  const ctx = canvas.getContext("2d");

  ctx.drawImage(
    img,
    0,
    0,
    canvas.width,
    canvas.height
  );

  const blob = await new Promise(resolve => {
    canvas.toBlob(
      resolve,
      format,
      quality
    );
  });

  const url = URL.createObjectURL(blob);

  $("#imageResult").innerHTML = `
    <strong>Done!</strong>
    <br>
    Original: ${formatBytes(imageFile.size)}
    <br>
    Compressed: ${formatBytes(blob.size)}
    <br><br>
    <a class="btn primary" href="${url}" download="fileshort-compressed.${format === "image/webp" ? "webp" : "jpg"}">
      Download Image →
    </a>
  `;

  $("#imageResult").classList.remove("hidden");

  URL.revokeObjectURL(img.src);
});


// -----------------------------
// PDF COMPRESSOR
// -----------------------------

setupInput(
  "#pdfInput",
  "#pdfDrop",
  file => {

    const isPDF =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!isPDF) {
      alert("Please choose a PDF file.");
      return;
    }

    pdfFile = file;

    console.log("PDF READY:", file.name, file.size);

    const nameElement = document.querySelector("#pdfName");
    const sizeElement = document.querySelector("#pdfOriginal");
    const controlsElement = document.querySelector("#pdfControls");
    const resultElement = document.querySelector("#pdfResult");

    if (nameElement) {
      nameElement.textContent = file.name;
    }

    if (sizeElement) {
      sizeElement.textContent = formatBytes(file.size);
    }

    if (controlsElement) {
      controlsElement.classList.remove("hidden");
    }

    if (resultElement) {
      resultElement.classList.add("hidden");
    }
  }
);
// -----------------------------
// PDF TARGET BUTTONS
// -----------------------------

document.querySelectorAll(".size-btn").forEach(button => {

  button.addEventListener("click", () => {

    document
      .querySelectorAll(".size-btn")
      .forEach(btn => btn.classList.remove("selected"));

    button.classList.add("selected");

    pdfTargetMB = Number(button.dataset.size);

    $("#targetSize").value = pdfTargetMB;
  });

});


$("#targetSize")?.addEventListener("input", e => {

  const value = Number(e.target.value);

  if (value > 0) {
    pdfTargetMB = value;
  }

});


$("#pdfQuality")?.addEventListener("input", e => {

  $("#pdfQualityValue").textContent =
    e.target.value + "%";

});


$("#pdfReset")?.addEventListener("click", () => {

  pdfFile = null;

  $("#pdfInput").value = "";

  $("#pdfControls").classList.add("hidden");
  $("#pdfResult").classList.add("hidden");

});


// -----------------------------
// LOAD PDF.JS
// -----------------------------

let pdfjsPromise = null;

async function getPDFJS() {

  if (!pdfjsPromise) {

    pdfjsPromise = import(
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs"
    );

  }

  return await pdfjsPromise;
}


// -----------------------------
// UPDATE PROGRESS
// -----------------------------

function updateProgress(percent, text) {

  $("#pdfProgress").classList.remove("hidden");

  $("#progressText").textContent = text;

  $("#progressFill").style.width =
    Math.max(0, Math.min(100, percent)) + "%";
}


// -----------------------------
// CREATE COMPRESSED PDF
// -----------------------------

async function createCompressedPDF(
  pdf,
  pages,
  scale,
  quality
) {

  const newPdf = await PDFLib.PDFDocument.create();

  for (let i = 0; i < pages.length; i++) {

    const pageInfo = pages[i];

    updateProgress(
      10 + Math.round((i / pages.length) * 70),
      `Compressing page ${i + 1} of ${pages.length}...`
    );

    const page = await pdf.getPage(i + 1);

    const viewport = page.getViewport({
      scale: scale
    });

    const canvas = document.createElement("canvas");

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    const context = canvas.getContext("2d", {
      alpha: false
    });

    context.fillStyle = "#ffffff";
    context.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

    const jpegBlob = await new Promise(resolve => {

      canvas.toBlob(
        resolve,
        "image/jpeg",
        quality
      );

    });

    if (!jpegBlob) {
      throw new Error("Could not create compressed image.");
    }

    const jpegBytes =
      new Uint8Array(
        await jpegBlob.arrayBuffer()
      );

    const jpg =
      await newPdf.embedJpg(jpegBytes);

    const newPage =
      newPdf.addPage([
        viewport.width,
        viewport.height
      ]);

    newPage.drawImage(jpg, {
      x: 0,
      y: 0,
      width: viewport.width,
      height: viewport.height
    });

    canvas.width = 1;
    canvas.height = 1;
  }

  updateProgress(90, "Creating final PDF...");

  const bytes = await newPdf.save({
    useObjectStreams: true,
    addDefaultPage: false
  });

  return new Blob(
    [bytes],
    {
      type: "application/pdf"
    }
  );
}


// -----------------------------
// TARGET SIZE ALGORITHM
// -----------------------------

async function compressPDFToTarget(file, targetBytes) {

  const pdfjsLib = await getPDFJS();

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";

  const arrayBuffer =
    await file.arrayBuffer();

  const pdf =
    await pdfjsLib.getDocument({
      data: arrayBuffer
    }).promise;

  const pageCount = pdf.numPages;


  /*
   * We try progressively smaller render sizes.
   *
   * This is important for aggressive compression such as:
   *
   * 100 MB → 1 MB
   */

  const scales = [
    1.0,
    0.8,
    0.65,
    0.5,
    0.4,
    0.32,
    0.25,
    0.20
  ];


  const qualityStart =
    Number($("#pdfQuality").value) / 100;


  let bestBlob = null;


  for (let s = 0; s < scales.length; s++) {

    const scale = scales[s];

    updateProgress(
      5 + s * 3,
      `Trying compression level ${s + 1}...`
    );


    /*
     * Try several JPEG qualities.
     */

    const qualities = [
      qualityStart,
      0.50,
      0.40,
      0.30,
      
