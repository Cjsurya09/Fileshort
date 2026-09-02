/* =========================================================
   FILESHORT - APP.JS
   VERSION 3
   Fast Image Compressor + Smart PDF Compressor

   IMPORTANT:
   This file is designed for the current index.html.
   ========================================================= */

"use strict";


/* =========================================================
   SECTION 01 — GLOBAL HELPERS
   Easy to modify
   ========================================================= */

const $ = (id) => document.getElementById(id);

const MB = 1024 * 1024;

function formatBytes(bytes) {

  if (!Number.isFinite(bytes)) {
    return "—";
  }

  if (bytes < 1024) {
    return `${Math.round(bytes)} B`;
  }

  if (bytes < MB) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  if (bytes < MB * 1024) {
    return `${(bytes / MB).toFixed(2)} MB`;
  }

  return `${(bytes / (MB * 1024)).toFixed(2)} GB`;
}


function percentSaved(original, compressed) {

  if (
    !original ||
    compressed >= original
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.round(
      (1 - compressed / original) * 100
    )
  );
}


function show(element) {

  if (element) {
    element.classList.remove("hidden");
  }
}


function hide(element) {

  if (element) {
    element.classList.add("hidden");
  }
}


function sleep(ms = 0) {

  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });

}


function nextFrame() {

  return new Promise(resolve => {

    requestAnimationFrame(() => {
      resolve();
    });

  });

}


/* =========================================================
   SECTION 02 — DOWNLOAD URL MANAGEMENT
   ========================================================= */

function replaceDownloadUrl(link, blob) {

  if (!link) {
    return;
  }

  if (link.dataset.url) {

    try {
      URL.revokeObjectURL(
        link.dataset.url
      );
    } catch (_) {}

  }

  const url =
    URL.createObjectURL(blob);

  link.dataset.url = url;
  link.href = url;

  return url;
}


/* =========================================================
   SECTION 03 — IMAGE COMPRESSOR
   ========================================================= */

let imageFile = null;
let imageDownloadUrl = null;


/* ---------- Elements ---------- */

const imageInput =
  $("imageInput");

const imageDrop =
  $("imageDrop");

const imageControls =
  $("imageControls");

const imageResult =
  $("imageResult");

const imageName =
  $("imageName");

const imageOriginal =
  $("imageOriginal");

const imageReset =
  $("imageReset");

const imageQuality =
  $("quality");

const imageQualityValue =
  $("qualityValue");

const imageFormat =
  $("imageFormat");

const compressImageButton =
  $("compressImage");


/* =========================================================
   IMAGE — QUALITY SLIDER
   ========================================================= */

if (imageQuality) {

  imageQuality.addEventListener(
    "input",
    () => {

      if (imageQualityValue) {

        imageQualityValue.textContent =
          `${imageQuality.value}%`;

      }

    }
  );

}


/* =========================================================
   IMAGE — FILE SELECTION
   ========================================================= */

if (imageInput) {

  imageInput.addEventListener(
    "change",
    (event) => {

      const file =
        event.target.files?.[0];

      if (file) {
        loadImageFile(file);
      }

    }
  );

}


/* =========================================================
   IMAGE — DRAG & DROP
   ========================================================= */

if (imageDrop) {

  ["dragenter", "dragover"]
    .forEach(eventName => {

      imageDrop.addEventListener(
        eventName,
        event => {

          event.preventDefault();
          event.stopPropagation();

          imageDrop.classList.add(
            "dragging"
          );

        }
      );

    });


  ["dragleave", "drop"]
    .forEach(eventName => {

      imageDrop.addEventListener(
        eventName,
        event => {

          event.preventDefault();
          event.stopPropagation();

          imageDrop.classList.remove(
            "dragging"
          );

        }
      );

    });


  imageDrop.addEventListener(
    "drop",
    event => {

      const file =
        event.dataTransfer?.files?.[0];

      if (file) {
        loadImageFile(file);
      }

    }
  );

}


/* =========================================================
   IMAGE — LOAD FILE
   ========================================================= */

function loadImageFile(file) {

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  const valid =
    allowedTypes.includes(file.type) ||
    /\.(jpg|jpeg|png|webp)$/i.test(
      file.name
    );

  if (!valid) {

    alert(
      "Please choose a JPG, PNG or WebP image."
    );

    return;
  }


  imageFile = file;


  if (imageName) {
    imageName.textContent =
      file.name;
  }


  if (imageOriginal) {
    imageOriginal.textContent =
      formatBytes(file.size);
  }


  hide(imageResult);
  show(imageControls);


  if (imageDrop) {
    imageDrop.classList.add(
      "selected"
    );
  }

}


/* =========================================================
   IMAGE — RESET
   ========================================================= */

if (imageReset) {

  imageReset.addEventListener(
    "click",
    () => {

      imageFile = null;

      if (imageInput) {
        imageInput.value = "";
      }

      hide(imageControls);
      hide(imageResult);

    }
  );

}


/* =========================================================
   IMAGE — COMPRESS BUTTON
   ========================================================= */

if (compressImageButton) {

  compressImageButton.addEventListener(
    "click",
    async () => {

      if (!imageFile) {

        alert(
          "Please choose an image first."
        );

        return;
      }


      compressImageButton.disabled =
        true;

      compressImageButton.textContent =
        "⏳ Compressing image...";


      try {

        const quality =
          Number(
            imageQuality?.value || 70
          ) / 100;


        const outputType =
          imageFormat?.value ||
          "image/jpeg";


        const result =
          await compressImageSmart(
            imageFile,
            quality,
            outputType
          );


        showImageResult(
          imageFile,
          result.blob,
          result.width,
          result.height
        );


      } catch (error) {

        console.error(
          "Image compression error:",
          error
        );


        alert(
          "Image compression failed. Please try another image."
        );

      } finally {

        compressImageButton.disabled =
          false;

        compressImageButton.textContent =
          "Compress Image";

      }

    }
  );

}


/* =========================================================
   IMAGE — SMART COMPRESSION ENGINE
   ========================================================= */

async function compressImageSmart(
  file,
  requestedQuality,
  outputType
) {

  const source =
    await loadImageBitmapSafe(file);


  let width =
    source.width;

  let height =
    source.height;


  /*
   Maximum dimension.

   Lower values = faster + smaller files.
   Increase to 5000 if you want higher resolution.
  */

  const MAX_DIMENSION =
    4000;


  if (
    width > MAX_DIMENSION ||
    height > MAX_DIMENSION
  ) {

    const ratio =
      Math.min(
        MAX_DIMENSION / width,
        MAX_DIMENSION / height
      );

    width =
      Math.max(
        1,
        Math.round(width * ratio)
      );

    height =
      Math.max(
        1,
        Math.round(height * ratio)
      );

  }


  /*
   First attempt uses requested quality.
  */

  let blob =
    await renderImageToBlob(
      source,
      width,
      height,
      outputType,
      requestedQuality
    );


  /*
   If the output is still bigger than the
   original, automatically try stronger compression.

   This fixes the common situation where
   "compressed" image becomes larger.
  */

  if (
    blob.size >= file.size
  ) {

    const fallbackQualities = [
      0.65,
      0.55,
      0.45,
      0.35
    ];


    for (
      const quality of fallbackQualities
    ) {

      blob =
        await renderImageToBlob(
          source,
          width,
          height,
          outputType,
          quality
        );


      if (
        blob.size < file.size
      ) {
        break;
      }

    }

  }


  /*
   If still larger, reduce dimensions.
  */

  if (
    blob.size >= file.size &&
    Math.max(width, height) > 1600
  ) {

    const ratio =
      1600 /
      Math.max(width, height);


    width =
      Math.max(
        1,
        Math.round(width * ratio)
      );


    height =
      Math.max(
        1,
        Math.round(height * ratio)
      );


    blob =
      await renderImageToBlob(
        source,
        width,
        height,
        outputType,
        0.55
      );

  }


  if (
    typeof source.close === "function"
  ) {

    source.close();

  }


  return {
    blob,
    width,
    height
  };

}


/* =========================================================
   IMAGE — LOAD BITMAP WITH FALLBACK
   ========================================================= */

async function loadImageBitmapSafe(file) {

  /*
   Fast path
  */

  if (
    "createImageBitmap" in window
  ) {

    try {

      return await createImageBitmap(
        file
      );

    } catch (error) {

      console.warn(
        "createImageBitmap failed. Using fallback.",
        error
      );

    }

  }


  /*
   Android/browser fallback
  */

  const url =
    URL.createObjectURL(file);


  try {

    const image =
      new Image();

    image.decoding =
      "async";

    image.src =
      url;


    await new Promise(
      (resolve, reject) => {

        image.onload =
          resolve;

        image.onerror =
          reject;

      }
    );


    return {

      width: image.naturalWidth,
      height: image.naturalHeight,

      close() {}

    };

  } finally {

    URL.revokeObjectURL(url);

  }

}


/* =========================================================
   IMAGE — CANVAS ENGINE
   ========================================================= */

function renderImageToBlob(
  source,
  width,
  height,
  type,
  quality
) {

  return new Promise(
    (resolve, reject) => {

      const canvas =
        document.createElement(
          "canvas"
        );


      canvas.width =
        width;

      canvas.height =
        height;


      const context =
        canvas.getContext(
          "2d",
          {
            alpha:
              type !== "image/jpeg"
          }
        );


      if (!context) {

        reject(
          new Error(
            "Canvas is not supported."
          )
        );

        return;

      }


      /*
       White background for JPG.
      */

      if (
        type === "image/jpeg"
      ) {

        context.fillStyle =
          "#ffffff";

        context.fillRect(
          0,
          0,
          width,
          height
        );

      }


      context.imageSmoothingEnabled =
        true;

      context.imageSmoothingQuality =
        "high";


      context.drawImage(
        source,
        0,
        0,
        width,
        height
      );


      canvas.toBlob(
        blob => {

          canvas.width = 1;
          canvas.height = 1;


          if (!blob) {

            reject(
              new Error(
                "Could not create compressed image."
              )
            );

            return;

          }


          resolve(blob);

        },
        type,
        quality
      );

    }
  );

}


/* =========================================================
   IMAGE — RESULT
   ========================================================= */

function showImageResult(
  originalFile,
  blob,
  width,
  height
) {

  if (!imageResult) {
    return;
  }


  const saved =
    percentSaved(
      originalFile.size,
      blob.size
    );


  const reductionText =
    saved > 0
      ? `Saved ${saved}%`
      : "Try a lower quality for a smaller file.";


  if (imageDownloadUrl) {

    try {
      URL.revokeObjectURL(
        imageDownloadUrl
      );
    } catch (_) {}

  }


  imageDownloadUrl =
    URL.createObjectURL(blob);


  const extension =
    imageFormat?.value ===
    "image/webp"
      ? "webp"
      : "jpg";


  const baseName =
    originalFile.name
      .replace(/\.[^/.]+$/, "");


  const downloadName =
    `${baseName}-compressed.${extension}`;


  imageResult.innerHTML = `
    <div class="result-success">

      <div class="result-icon">
        ✓
      </div>

      <div class="result-content">

        <h3>Compression complete</h3>

        <div class="result-stats">

          <div>
            <span>Original</span>
            <strong>
              ${formatBytes(originalFile.size)}
            </strong>
          </div>

          <div>
            <span>New size</span>
            <strong>
              ${formatBytes(blob.size)}
            </strong>
          </div>

          <div>
            <span>Reduction</span>
            <strong>
              ${reductionText}
            </strong>
          </div>

        </div>

        <p>
          ${width} × ${height}px
        </p>

        <a
          class="download"
          href="${imageDownloadUrl}"
          download="${downloadName}">
          ↓ Download compressed image
        </a>

      </div>

    </div>
  `;


  show(imageResult);

}


/* =========================================================
   SECTION 04 — PDF COMPRESSOR
   ========================================================= */

let pdfFile = null;
let pdfDownloadUrl = null;


/* ---------- Elements ---------- */

const pdfInput =
  $("pdfInput");

const pdfDrop =
  $("pdfDrop");

const pdfControls =
  $("pdfControls");

const pdfResult =
  $("pdfResult");

const pdfName =
  $("pdfName");

const pdfOriginal =
  $("pdfOriginal");

const pdfReset =
  $("pdfReset");

const pdfTarget =
  $("targetSize");

const pdfQuality =
  $("pdfQuality");

const pdfQualityValue =
  $("pdfQualityValue");

const compressPdfButton =
  $("compressPdf");

const pdfProgress =
  $("pdfProgress");

const pdfProgressBar =
  $("progressFill");

const pdfProgressText =
  $("progressText");


/* =========================================================
   PDF — PDF.JS LOADER
   ========================================================= */

let pdfjsLib = null;
let pdfJsPromise = null;


async function loadPDFJS() {

  if (pdfjsLib) {
    return pdfjsLib;
  }


  if (!pdfJsPromise) {

    pdfJsPromise =
      import(
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs"
      );

  }


  const module =
    await pdfJsPromise;


  pdfjsLib =
    module;


  if (
    pdfjsLib.GlobalWorkerOptions
  ) {

    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";

  }


  return pdfjsLib;

}


/* =========================================================
   PDF — FILE SELECTION
   ========================================================= */

if (pdfInput) {

  pdfInput.addEventListener(
    "change",
    event => {

      const file =
        event.target.files?.[0];

      if (file) {
        loadPdfFile(file);
      }

    }
  );

}


/* =========================================================
   PDF — DRAG & DROP
   ========================================================= */

if (pdfDrop) {

  ["dragenter", "dragover"]
    .forEach(eventName => {

      pdfDrop.addEventListener(
        eventName,
        event => {

          event.preventDefault();
          event.stopPropagation();

          pdfDrop.classList.add(
            "dragging"
          );

        }
      );

    });


  ["dragleave", "drop"]
    .forEach(eventName => {

      pdfDrop.addEventListener(
        eventName,
        event => {

          event.preventDefault();
          event.stopPropagation();

          pdfDrop.classList.remove(
            "dragging"
          );

        }
      );

    });


  pdfDrop.addEventListener(
    "drop",
    event => {

      const file =
        event.dataTransfer?.files?.[0];

      if (file) {
        loadPdfFile(file);
      }

    }
  );

}


/* =========================================================
   PDF — LOAD FILE
   ========================================================= */

function loadPdfFile(file) {

  const isPdf =
    file.type === "application/pdf" ||
    /\.pdf$/i.test(file.name);


  if (!isPdf) {

    alert(
      "Please choose a PDF file."
    );

    return;

  }


  pdfFile =
    file;


  if (pdfName) {
    pdfName.textContent =
      file.name;
  }


  if (pdfOriginal) {
    pdfOriginal.textContent =
      formatBytes(file.size);
  }


  hide(pdfResult);

  show(pdfControls);


  if (pdfDrop) {

    pdfDrop.classList.add(
      "selected"
    );

  }

}


/* =========================================================
   PDF — QUALITY SLIDER
   ========================================================= */

if (pdfQuality) {

  pdfQuality.addEventListener(
    "input",
    () => {

      if (pdfQualityValue) {

        pdfQualityValue.textContent =
          `${pdfQuality.value}%`;

      }

    }
  );

}


/* =========================================================
   PDF — RESET
   ========================================================= */

if (pdfReset) {

  pdfReset.addEventListener(
    "click",
    () => {

      pdfFile = null;


      if (pdfInput) {
        pdfInput.value = "";
      }


      hide(pdfControls);
      hide(pdfResult);
      hide(pdfProgress);


      if (pdfProgressBar) {
        pdfProgressBar.style.width =
          "0%";
      }

    }
  );

}


/* =========================================================
   PDF — TARGET SIZE
   ========================================================= */

function getPdfTargetBytes() {

  const value =
    Number(
      pdfTarget?.value
    );


  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {

    throw new Error(
      "Please enter a valid target size."
    );

  }


  return value * MB;

}


/* =========================================================
   PDF — PROGRESS
   ========================================================= */

function updatePdfProgress(
  percent,
  message
) {

  const value =
    Math.max(
      0,
      Math.min(
        100,
        Math.round(percent)
      )
    );


  if (pdfProgressBar) {

    pdfProgressBar.style.width =
      `${value}%`;

  }


  if (pdfProgressText) {

    pdfProgressText.textContent =
      `${message} ${value}%`;

  }

}


/* =========================================================
   PDF — COMPRESS BUTTON
   ========================================================= */

if (compressPdfButton) {

  compressPdfButton.addEventListener(
    "click",
    async () => {

      if (!pdfFile) {

        alert(
          "Please choose a PDF first."
        );

        return;

      }


      let targetBytes;


      try {

        targetBytes =
          getPdfTargetBytes();

      } catch (error) {

        alert(
          error.message
        );

        return;

      }


      hide(pdfResult);
      show(pdfProgress);


      compressPdfButton.disabled =
        true;

      compressPdfButton.textContent =
        "⏳ Compressing PDF...";


      try {

        const result =
          await compressPdfSmart(
            pdfFile,
            targetBytes
          );


        showPdfResult(
          pdfFile,
          result.blob,
          result.pageCount
        );


      } catch (error) {

        console.error(
          "PDF compression error:",
          error
        );


        showPdfError(
          error.message ||
          "PDF compression failed."
        );

      } finally {

        compressPdfButton.disabled =
          false;

        compressPdfButton.textContent =
          "Compress PDF";

      }

    }
  );

}


/* =========================================================
   PDF — SMART COMPRESSION
   ========================================================= */

async function compressPdfSmart(
  file,
  targetBytes
) {

  updatePdfProgress(
    3,
    "Loading PDF..."
  );


  const PDFLib =
    window.PDFLib;


  if (!PDFLib) {

    throw new Error(
      "PDF engine is not available. Refresh the page and try again."
    );

  }


  const pdfjs =
    await loadPDFJS();


  updatePdfProgress(
    6,
    "Reading PDF..."
  );


  const sourceBytes =
    new Uint8Array(
      await file.arrayBuffer()
    );


  const sourcePdf =
    await pdfjs.getDocument({
      data: sourceBytes
    }).promise;


  const pageCount =
    sourcePdf.numPages;


  if (!pageCount) {

    throw new Error(
      "This PDF does not contain any pages."
    );

  }


  /*
   FAST PATH

   First try PDF-LIB structural optimization.
   This is almost instant for PDFs that don't
   contain huge images.
  */

  updatePdfProgress(
    10,
    "Checking PDF structure..."
  );


  try {

    const originalDocument =
      await PDFLib.PDFDocument.load(
        sourceBytes,
        {
          ignoreEncryption: true,
          updateMetadata: false
        }
      );


    const optimizedBytes =
      await originalDocument.save({
        useObjectStreams: true,
        addDefaultPage: false,
        updateFieldAppearances: false
      });


    if (
      optimizedBytes.length <=
      targetBytes
    ) {

      updatePdfProgress(
        100,
        "Compression complete."
      );


      return {
        blob: new Blob(
          [optimizedBytes],
          {
            type:
              "application/pdf"
          }
        ),
        pageCount
      };

    }

  } catch (error) {

    console.warn(
      "Structural PDF optimization skipped:",
      error
    );

  }


  /*
   IMAGE-BASED COMPRESSION

   Instead of 7 passes, we intelligently
   choose a starting resolution and use
   a maximum of 3 attempts.

   This is MUCH faster on mobile.
  */

  const requestedQuality =
    Number(
      pdfQuality?.value || 60
    ) / 100;


  const estimatedPages =
    Math.max(
      1,
      pageCount
    );


  /*
   Estimate a sensible starting scale
   based on target size.

   More pages = lower resolution.
  */

  let scale;

  if (estimatedPages > 200) {
    scale = 0.70;
  } else if (estimatedPages > 100) {
    scale = 0.80;
  } else if (estimatedPages > 50) {
    scale = 0.95;
  } else {
    scale = 1.10;
  }


  /*
   If target is extremely aggressive,
   start lower.
  */

  const targetMB =
    targetBytes / MB;


  if (
    targetMB <= 2 &&
    pageCount > 50
  ) {

    scale *= 0.65;

  }


  if (
    targetMB <= 1 &&
    pageCount > 100
  ) {

    scale *= 0.75;

  }


  scale =
    Math.max(
      0.45,
      Math.min(
        1.25,
        scale
      )
    );


  /*
   Maximum of THREE passes.

   Old version:
   7 complete renders.

   New version:
   normally 1–3 renders.
  */

  const attempts = [
    {
      scale,
      quality:
        requestedQuality
    },
    {
      scale:
        Math.max(
          0.45,
          scale * 0.72
        ),
      quality:
        Math.max(
          0.40,
          requestedQuality * 0.78
        )
    },
    {
      scale:
        Math.max(
          0.35,
          scale * 0.52
        ),
      quality:
        Math.max(
          0.25,
          requestedQuality * 0.58
        )
    }
  ];


  let bestBlob =
    null;


  for (
    let attempt = 0;
    attempt < attempts.length;
    attempt++
  ) {

    const settings =
      attempts[attempt];


    updatePdfProgress(
      12 + attempt * 5,
      `Compression pass ${attempt + 1} of 3...`
    );


    await sleep(20);


    const blob =
      await renderPdfPages(
        sourcePdf,
        PDFLib,
        settings.scale,
        settings.quality,
        (page, total) => {

          const start =
            18 +
            attempt * 25;


          const progress =
            start +
            (page / total) * 22;


          updatePdfProgress(
            progress,
            `Processing page ${page} of ${total}...`
          );

        }
      );


    if (
      !bestBlob ||
      blob.size < bestBlob.size
    ) {

      bestBlob =
        blob;

    }


    /*
     Target reached.
     Stop immediately.
    */

    if (
      blob.size <= targetBytes
    ) {

      updatePdfProgress(
        100,
        "Target size reached."
      );


      return {
        blob,
        pageCount
      };

    }

  }


  /*
   We could not reach the requested target.

   Return the smallest valid PDF rather than
   throwing away the result.
  */

  if (bestBlob) {

    updatePdfProgress(
      100,
      "Best possible compression created."
    );


    return {
      blob: bestBlob,
      pageCount
    };

  }


  throw new Error(
    "Could not create a compressed PDF."
  );

}


/* =========================================================
   PDF — RENDER PAGES
   ========================================================= */

async function renderPdfPages(
  sourcePdf,
  PDFLib,
  scale,
  jpegQuality,
  onProgress
) {

  const {
    PDFDocument
  } = PDFLib;


  const newPdf =
    await PDFDocument.create();


  for (
    let pageNumber = 1;
    pageNumber <= sourcePdf.numPages;
    pageNumber++
  ) {

    const page =
      await sourcePdf.getPage(
        pageNumber
      );


    /*
     Calculate viewport.
    */

    const viewport =
      page.getViewport({
        scale
      });


    let width =
      Math.max(
        1,
        Math.floor(
          viewport.width
        )
      );


    let height =
      Math.max(
        1,
        Math.floor(
          viewport.height
        )
      );


    /*
     Prevent huge canvases on mobile.

     This is important for large PDF pages.
    */

    const MAX_CANVAS =
      2400;


    if (
      width > MAX_CANVAS ||
      height > MAX_CANVAS
    ) {

      const ratio =
        Math.min(
          MAX_CANVAS / width,
          MAX_CANVAS / height
        );


      width =
        Math.max(
          1,
          Math.floor(
            width * ratio
          )
        );


      height =
        Math.max(
          1,
          Math.floor(
            height * ratio
          )
        );

    }


    const renderScale =
      width / viewport.width;


    const renderViewport =
      page.getViewport({
        scale:
          scale * renderScale
      });


    const canvas =
      document.createElement(
        "canvas"
      );


    canvas.width =
      width;

    canvas.height =
      height;


    const context =
      canvas.getContext(
        "2d",
        {
          alpha: false
        }
      );


    if (!context) {

      throw new Error(
        "Browser canvas is not available."
      );

    }


    /*
     White background.
     */

    context.fillStyle =
      "#ffffff";


    context.fillRect(
      0,
      0,
      width,
      height
    );


    /*
     Render page.
     */

    await page.render({
      canvasContext:
        context,

      viewport:
        renderViewport,

      intent:
        "print"
    }).promise;


    /*
     Convert to JPEG.
     */

    const jpegBlob =
      await canvasToJpeg(
        canvas,
        jpegQuality
      );


    /*
     Embed image.
     */

    const jpegBytes =
      new Uint8Array(
        await jpegBlob.arrayBuffer()
      );


    const image =
      await newPdf.embedJpg(
        jpegBytes
      );


    /*
     Preserve page aspect ratio.
     */

    const outputPage =
      newPdf.addPage([
        width,
        height
      ]);


    outputPage.drawImage(
      image,
      {
        x: 0,
        y: 0,
        width,
        height
      }
    );


    /*
     Release memory immediately.
    */

    canvas.width = 1;
    canvas.height = 1;


    if (
      typeof onProgress ===
      "function"
    ) {

      onProgress(
        pageNumber,
        sourcePdf.numPages
      );

    }


    /*
     Let mobile browser breathe.
     Only yield every few pages instead
     of every single page.
    */

    if (
      pageNumber % 4 === 0
    ) {

      await nextFrame();

    }

  }


  /*
   Save final PDF.
  */

  const bytes =
    await newPdf.save({
      useObjectStreams:
        true,

      addDefaultPage:
        false
    });


  return new Blob(
    [bytes],
    {
      type:
        "application/pdf"
    }
  );

}


/* =========================================================
   PDF — JPEG CONVERTER
   ========================================================= */

function canvasToJpeg(
  canvas,
  quality
) {

  return new Promise(
    (resolve, reject) => {

      canvas.toBlob(
        blob => {

          if (!blob) {

            reject(
              new Error(
                "Could not create JPEG page."
              )
            );

            return;

          }


          resolve(blob);

        },
        "image/jpeg",
        quality
      );

    }
  );

}


/* =========================================================
   PDF — RESULT
   ========================================================= */

function showPdfResult(
  originalFile,
  blob,
  pageCount
) {

  if (!pdfResult) {
    return;
  }


  const saved =
    percentSaved(
      originalFile.size,
      blob.size
    );


  const target =
    getPdfTargetBytes();


  const reachedTarget =
    blob.size <= target;


  if (pdfDownloadUrl) {

    try {

      URL.revokeObjectURL(
        pdfDownloadUrl
      );

    } catch (_) {}

  }


  pdfDownloadUrl =
    URL.createObjectURL(blob);


  const baseName =
    originalFile.name
      .replace(
        /\.pdf$/i,
        ""
      );


  const downloadName =
    `${baseName}-compressed.pdf`;


  let statusText;


  if (reachedTarget) {

    statusText =
      `✓ Target reached — ${saved}% smaller`;

  } else if (saved > 0) {

    statusText =
      `✓ Reduced by ${saved}% — target could not be reached without excessive quality loss`;

  } else {

    statusText =
      "The PDF could not be reduced further.";

  }


  pdfResult.innerHTML = `

    <div class="result-success">

      <div class="result-icon">
        ✓
      </div>

      <div class="result-content">

        <h3>
          PDF compression complete
        </h3>

        <p class="result-status">
          ${statusText}
        </p>

        <div class="result-stats">

          <div>
            <span>Original</span>
            <strong>
              ${formatBytes(
                originalFile.size
              )}
            </strong>
          </div>

          <div>
            <span>New size</span>
            <strong>
              ${formatBytes(
                blob.size
              )}
            </strong>
          </div>

          <div>
            <span>Pages</span>
            <strong>
              ${pageCount}
            </strong>
          </div>

        </div>

        <a
          class="download"
          href="${pdfDownloadUrl}"
          download="${downloadName}">
          ↓ Download compressed PDF
        </a>

      </div>

    </div>

  `;


  show(pdfResult);

}


/* =========================================================
   PDF — ERROR
   ========================================================= */

function showPdfError(
  message
) {

  hide(pdfProgress);


  /*
   Use the existing error element if
   index.html has one.
  */

  const existingError =
    $("pdfError");


  if (existingError) {

    existingError.textContent =
      message;

    show(existingError);

    return;

  }


  /*
   Fallback.
  */

  alert(message);

}


/* =========================================================
   SECTION 05 — CLEANUP
   ========================================================= */

window.addEventListener(
  "beforeunload",
  () => {

    if (imageDownloadUrl) {

      try {

        URL.revokeObjectURL(
          imageDownloadUrl
        );

      } catch (_) {}

    }


    if (pdfDownloadUrl) {

      try {

        URL.revokeObjectURL(
          pdfDownloadUrl
        );

      } catch (_) {}

    }

  }
);


/* =========================================================
   SECTION 06 — STARTUP
   ========================================================= */

console.log(
  "FileShort v3 app.js loaded successfully."
);
