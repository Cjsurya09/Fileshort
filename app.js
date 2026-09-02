/* =========================================================
   FILESHORT
   APP.JS — VERSION 4
   ---------------------------------------------------------
   FEATURES
   1. Image compression
   2. PDF compression
   3. PDF target-size buttons
   4. Custom PDF target size
   5. Compression quality
   6. Progress indicator
   7. Download handling
   8. Drag & drop
   9. Mobile-friendly file handling

   IMPORTANT:
   This file works with the current FileShort index.html.
   ========================================================= */

"use strict";


/* =========================================================
   SECTION 01 — GLOBAL SETTINGS
   ---------------------------------------------------------
   Change these values if you want to tune performance.
   ========================================================= */

const FILESHORT_CONFIG = {

  image: {
    maxDimension: 4000,
    fallbackDimension: 1600
  },

  pdf: {
    maxCanvasDimension: 2400,

    // Starting resolution based on page count
    largeDocumentScale: 0.70,
    mediumDocumentScale: 0.80,
    normalDocumentScale: 0.95,
    smallDocumentScale: 1.10,

    // Maximum compression attempts
    maxAttempts: 3
  }

};


/* =========================================================
   SECTION 02 — GLOBAL VARIABLES
   ========================================================= */

const MB = 1024 * 1024;

let imageFile = null;
let imageDownloadUrl = null;

let pdfFile = null;
let pdfDownloadUrl = null;

let pdfTargetMB = 1;

let pdfjsLib = null;
let pdfJsPromise = null;


/* =========================================================
   SECTION 03 — DOM HELPER
   ========================================================= */

function $(id) {
  return document.getElementById(id);
}


/* =========================================================
   SECTION 04 — GENERAL HELPERS
   ========================================================= */

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


function percentSaved(original, current) {

  if (
    !original ||
    current >= original
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.round(
      (1 - current / original) * 100
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


function revokeUrl(url) {

  if (!url) {
    return;
  }

  try {
    URL.revokeObjectURL(url);
  } catch (_) {}

}


/* =========================================================
   SECTION 05 — IMAGE ELEMENTS
   ========================================================= */

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
   SECTION 06 — IMAGE QUALITY DISPLAY
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
   SECTION 07 — IMAGE FILE INPUT
   ========================================================= */

if (imageInput) {

  imageInput.addEventListener(
    "change",
    event => {

      const file =
        event.target.files?.[0];

      if (file) {
        loadImageFile(file);
      }

    }
  );

}


/* =========================================================
   SECTION 08 — IMAGE DRAG & DROP
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
   SECTION 09 — LOAD IMAGE
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


  imageFile =
    file;


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
   SECTION 10 — IMAGE RESET
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

      if (imageDrop) {
        imageDrop.classList.remove(
          "selected"
        );
      }

      revokeUrl(
        imageDownloadUrl
      );

      imageDownloadUrl = null;

    }
  );

}


/* =========================================================
   SECTION 11 — IMAGE COMPRESSION BUTTON
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

      const originalText =
        compressImageButton.textContent;


      compressImageButton.textContent =
        "⏳ Compressing image...";


      try {

        const requestedQuality =
          Number(
            imageQuality?.value || 70
          ) / 100;


        const outputType =
          imageFormat?.value ||
          "image/jpeg";


        const result =
          await compressImageSmart(
            imageFile,
            requestedQuality,
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
          originalText ||
          "Compress Image";

      }

    }
  );

}


/* =========================================================
   SECTION 12 — IMAGE COMPRESSION ENGINE
   ========================================================= */

async function compressImageSmart(
  file,
  requestedQuality,
  outputType
) {

  const source =
    await loadImageSource(file);


  let width =
    source.width;

  let height =
    source.height;


  const maxDimension =
    FILESHORT_CONFIG.image.maxDimension;


  if (
    width > maxDimension ||
    height > maxDimension
  ) {

    const ratio =
      Math.min(
        maxDimension / width,
        maxDimension / height
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


  let blob =
    await renderImageToBlob(
      source,
      width,
      height,
      outputType,
      requestedQuality
    );


  /*
   If compression makes the file larger,
   try stronger settings.
  */

  if (
    blob.size >= file.size
  ) {

    const qualities = [
      0.65,
      0.55,
      0.45,
      0.35
    ];


    for (
      const quality of qualities
    ) {

      const testBlob =
        await renderImageToBlob(
          source,
          width,
          height,
          outputType,
          quality
        );


      if (
        testBlob.size < blob.size
      ) {

        blob =
          testBlob;

      }


      if (
        blob.size < file.size
      ) {
        break;
      }

    }

  }


  /*
   Still larger?
   Reduce resolution.
  */

  if (
    blob.size >= file.size &&
    Math.max(width, height) >
      FILESHORT_CONFIG.image.fallbackDimension
  ) {

    const newMax =
      FILESHORT_CONFIG.image.fallbackDimension;


    const ratio =
      newMax /
      Math.max(
        width,
        height
      );


    width =
      Math.max(
        1,
        Math.round(
          width * ratio
        )
      );


    height =
      Math.max(
        1,
        Math.round(
          height * ratio
        )
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
    typeof source.close ===
    "function"
  ) {

    try {
      source.close();
    } catch (_) {}

  }


  return {
    blob,
    width,
    height
  };

}


/* =========================================================
   SECTION 13 — IMAGE SOURCE LOADER
   ========================================================= */

async function loadImageSource(file) {

  /*
   Fast browser path
  */

  if (
    typeof createImageBitmap ===
    "function"
  ) {

    try {

      return await createImageBitmap(
        file
      );

    } catch (error) {

      console.warn(
        "createImageBitmap unavailable:",
        error
      );

    }

  }


  /*
   Standard browser fallback
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
      width:
        image.naturalWidth,

      height:
        image.naturalHeight,

      element:
        image,

      close() {}
    };


  } finally {

    URL.revokeObjectURL(
      url
    );

  }

}


/* =========================================================
   SECTION 14 — IMAGE CANVAS
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
              type !==
              "image/jpeg"
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
       JPG requires a solid background.
      */

      if (
        type ===
        "image/jpeg"
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


      const drawable =
        source.element ||
        source;


      context.drawImage(
        drawable,
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
   SECTION 15 — IMAGE RESULT
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


  revokeUrl(
    imageDownloadUrl
  );


  imageDownloadUrl =
    URL.createObjectURL(
      blob
    );


  const saved =
    percentSaved(
      originalFile.size,
      blob.size
    );


  const extension =
    imageFormat?.value ===
    "image/webp"
      ? "webp"
      : "jpg";


  const baseName =
    originalFile.name
      .replace(
        /\.[^/.]+$/,
        ""
      );


  const downloadName =
    `${baseName}-compressed.${extension}`;


  const savedText =
    saved > 0
      ? `Saved ${saved}%`
      : "No size reduction";


  imageResult.innerHTML = `

    <div class="result-success">

      <div class="result-icon">
        ✓
      </div>

      <div class="result-content">

        <h3>
          Image compression complete
        </h3>

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
            <span>Reduction</span>
            <strong>
              ${savedText}
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
   SECTION 16 — PDF ELEMENTS
   ========================================================= */

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

const pdfTargetInput =
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

const pdfError =
  $("pdfError");


/* =========================================================
   SECTION 17 — PDF TARGET BUTTONS
   ---------------------------------------------------------
   THIS IS THE IMPORTANT FIX.
   The previous app.js had NO working listener for
   the .size-btn elements.
   ========================================================= */

function setupPdfTargetButtons() {

  const container =
    document.querySelector(
      ".size-options"
    );


  if (!container) {

    console.warn(
      "FileShort: .size-options not found."
    );

    return;

  }


  /*
   Event delegation.

   This is more reliable than attaching listeners
   individually and also works if the buttons are
   recreated later.
  */

  container.addEventListener(
    "click",
    event => {

      const button =
        event.target.closest(
          ".size-btn"
        );


      if (!button) {
        return;
      }


      event.preventDefault();
      event.stopPropagation();


      const size =
        Number(
          button.dataset.size
        );


      if (
        !Number.isFinite(size) ||
        size <= 0
      ) {

        return;

      }


      /*
       Update internal target.
      */

      pdfTargetMB =
        size;


      /*
       Update custom target input.
      */

      if (pdfTargetInput) {

        pdfTargetInput.value =
          size;

      }


      /*
       Remove active state.
      */

      container
        .querySelectorAll(
          ".size-btn"
        )
        .forEach(btn => {

          btn.classList.remove(
            "active"
          );

          btn.classList.remove(
            "selected"
          );

          btn.setAttribute(
            "aria-pressed",
            "false"
          );

        });


      /*
       Activate selected button.
      */

      button.classList.add(
        "active"
      );

      button.classList.add(
        "selected"
      );


      button.setAttribute(
        "aria-pressed",
        "true"
      );


      console.log(
        `FileShort: PDF target set to ${size} MB`
      );

    }
  );


  /*
   Mobile touch support.

   Prevents some mobile browsers from treating
   the button as a label/dropzone interaction.
  */

  container.addEventListener(
    "touchend",
    event => {

      const button =
        event.target.closest(
          ".size-btn"
        );


      if (!button) {
        return;
      }


      event.preventDefault();


      const size =
        Number(
          button.dataset.size
        );


      if (
        !Number.isFinite(size) ||
        size <= 0
      ) {

        return;

      }


      pdfTargetMB =
        size;


      if (pdfTargetInput) {
        pdfTargetInput.value =
          size;
      }


      container
        .querySelectorAll(
          ".size-btn"
        )
        .forEach(btn => {

          btn.classList.remove(
            "active"
          );

          btn.classList.remove(
            "selected"
          );

          btn.setAttribute(
            "aria-pressed",
            "false"
          );

        });


      button.classList.add(
        "active"
      );

      button.classList.add(
        "selected"
      );

      button.setAttribute(
        "aria-pressed",
        "true"
      );

    },
    {
      passive: false
    }
  );


  /*
   Set initial button.

   If HTML says value="1", 1 MB becomes selected.
  */

  const initialButton =
    container.querySelector(
      `.size-btn[data-size="${pdfTargetMB}"]`
    );


  if (initialButton) {

    initialButton.classList.add(
      "active"
    );

    initialButton.classList.add(
      "selected"
    );

    initialButton.setAttribute(
      "aria-pressed",
      "true"
    );

  }

}


/*
 Start button system.
*/

setupPdfTargetButtons();


/* =========================================================
   SECTION 18 — CUSTOM PDF TARGET INPUT
   ========================================================= */

if (pdfTargetInput) {

  pdfTargetInput.addEventListener(
    "input",
    () => {

      const value =
        Number(
          pdfTargetInput.value
        );


      if (
        !Number.isFinite(value) ||
        value <= 0
      ) {

        return;

      }


      pdfTargetMB =
        value;


      /*
       If user manually changes the size,
       remove preset button selection.
      */

      const buttons =
        document.querySelectorAll(
          ".size-btn"
        );


      buttons.forEach(button => {

        const buttonSize =
          Number(
            button.dataset.size
          );


        if (
          buttonSize !== value
        ) {

          button.classList.remove(
            "active"
          );

          button.classList.remove(
            "selected"
          );

          button.setAttribute(
            "aria-pressed",
            "false"
          );

        }

      });


      const matchingButton =
        Array.from(buttons).find(
          button =>
            Number(
              button.dataset.size
            ) === value
        );


      if (matchingButton) {

        matchingButton.classList.add(
          "active"
        );

        matchingButton.classList.add(
          "selected"
        );

        matchingButton.setAttribute(
          "aria-pressed",
          "true"
        );

      }

    }
  );

}


/* =========================================================
   SECTION 19 — PDF QUALITY
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
   SECTION 20 — PDF FILE INPUT
   ========================================================= */

if (pdfInput) {

  pdfInput.addEventListener(
    "change",
    event => {

      const file =
        event.target.files?.[0];


      if (file) {

        loadPdfFile(
          file
        );

      }

    }
  );

}


/* =========================================================
   SECTION 21 — PDF DRAG & DROP
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

        loadPdfFile(
          file
        );

      }

    }
  );

}


/* =========================================================
   SECTION 22 — LOAD PDF
   ========================================================= */

function loadPdfFile(file) {

  const isPdf =
    file.type ===
      "application/pdf" ||
    /\.pdf$/i.test(
      file.name
    );


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
      formatBytes(
        file.size
      );

  }


  hide(pdfResult);
  hide(pdfError);

  show(pdfControls);


  if (pdfDrop) {

    pdfDrop.classList.add(
      "selected"
    );

  }

}


/* =========================================================
   SECTION 23 — PDF RESET
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
      hide(pdfError);


      if (pdfProgressBar) {

        pdfProgressBar.style.width =
          "0%";

      }


      if (pdfProgressText) {

        pdfProgressText.textContent =
          "Preparing PDF...";

      }


      if (pdfDrop) {

        pdfDrop.classList.remove(
          "selected"
        );

      }


      revokeUrl(
        pdfDownloadUrl
      );


      pdfDownloadUrl =
        null;

    }
  );

}


/* =========================================================
   SECTION 24 — PDF.JS LOADER
   ========================================================= */

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
   SECTION 25 — GET PDF TARGET
   ========================================================= */

function getPdfTargetBytes() {

  /*
   Always read the input first.

   This guarantees the button-selected MB
   value is actually used.
  */

  let value =
    Number(
      pdfTargetInput?.value
    );


  /*
   Fallback to internal value.
  */

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {

    value =
      pdfTargetMB;

  }


  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {

    throw new Error(
      "Please select a valid PDF target size."
    );

  }


  pdfTargetMB =
    value;


  return value * MB;

}


/* =========================================================
   SECTION 26 — PDF PROGRESS
   ========================================================= */

function updatePdfProgress(
  percent,
  message
) {

  const safePercent =
    Math.max(
      0,
      Math.min(
        100,
        Math.round(
          percent
        )
      )
    );


  show(pdfProgress);


  if (pdfProgressBar) {

    pdfProgressBar.style.width =
      `${safePercent}%`;

  }


  if (pdfProgressText) {

    pdfProgressText.textContent =
      `${message} ${safePercent}%`;

  }

}


/* =========================================================
   SECTION 27 — PDF COMPRESS BUTTON
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
      hide(pdfError);

      show(pdfProgress);


      compressPdfButton.disabled =
        true;


      const originalText =
        compressPdfButton.textContent;


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
          originalText ||
          "Compress PDF";

      }

    }
  );

}


/* =========================================================
   SECTION 28 — SMART PDF COMPRESSION
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
      "PDF engine is not available. Please refresh the page."
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
   Fast structural optimization.
  */

  updatePdfProgress(
    9,
    "Checking PDF..."
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
        "Target size reached."
      );


      return {

        blob:
          new Blob(
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
      "Structural optimization skipped:",
      error
    );

  }


  /*
   Image-based compression.
  */

  const quality =
    Math.max(
      0.20,
      Math.min(
        0.90,
        Number(
          pdfQuality?.value || 60
        ) / 100
      )
    );


  /*
   Choose starting scale based on
   document size.
  */

  let scale;


  if (pageCount > 200) {

    scale =
      FILESHORT_CONFIG.pdf.largeDocumentScale;

  } else if (pageCount > 100) {

    scale =
      FILESHORT_CONFIG.pdf.mediumDocumentScale;

  } else if (pageCount > 50) {

    scale =
      FILESHORT_CONFIG.pdf.normalDocumentScale;

  } else {

    scale =
      FILESHORT_CONFIG.pdf.smallDocumentScale;

  }


  /*
   Aggressive targets.
  */

  const targetMB =
    targetBytes / MB;


  if (
    targetMB <= 2 &&
    pageCount > 50
  ) {

    scale *=
      0.65;

  }


  if (
    targetMB <= 1 &&
    pageCount > 100
  ) {

    scale *=
      0.75;

  }


  scale =
    Math.max(
      0.35,
      Math.min(
        1.25,
        scale
      )
    );


  /*
   Three carefully chosen attempts.

   This is much faster than repeatedly
   rendering the same PDF.
  */

  const attempts = [

    {
      scale,
      quality
    },

    {
      scale:
        Math.max(
          0.45,
          scale * 0.72
        ),

      quality:
        Math.max(
          0.35,
          quality * 0.78
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
          0.22,
          quality * 0.58
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
      12 + attempt * 3,
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

          const base =
            15 +
            attempt * 27;


          const progress =
            base +
            (page / total) * 25;


          updatePdfProgress(
            progress,
            `Processing page ${page} of ${total}...`
          );

        }
      );


    if (
      !bestBlob ||
      blob.size <
        bestBlob.size
    ) {

      bestBlob =
        blob;

    }


    /*
     Target reached — stop immediately.
    */

    if (
      blob.size <=
      targetBytes
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
   If exact target is impossible without
   destroying quality, return best result.
  */

  if (bestBlob) {

    updatePdfProgress(
      100,
      "Best possible compression created."
    );


    return {
      blob:
        bestBlob,

      pageCount
    };

  }


  throw new Error(
    "Could not create a compressed PDF."
  );

}


/* =========================================================
   SECTION 29 — RENDER PDF PAGES
   ========================================================= */

async function renderPdfPages(
  sourcePdf,
  PDFLib,
  scale,
  jpegQuality,
  onProgress
) {

  const PDFDocument =
    PDFLib.PDFDocument;


  const newPdf =
    await PDFDocument.create();


  for (
    let pageNumber = 1;
    pageNumber <=
      sourcePdf.numPages;
    pageNumber++
  ) {

    const page =
      await sourcePdf.getPage(
        pageNumber
      );


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
     Protect memory on phones.
    */

    const maxCanvas =
      FILESHORT_CONFIG.pdf
        .maxCanvasDimension;


    if (
      width > maxCanvas ||
      height > maxCanvas
    ) {

      const ratio =
        Math.min(
          maxCanvas / width,
          maxCanvas / height
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
      width /
      viewport.width;


    const renderViewport =
      page.getViewport({
        scale:
          scale *
          renderScale
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


    const jpegBytes =
      new Uint8Array(
        await jpegBlob.arrayBuffer()
      );


    const image =
      await newPdf.embedJpg(
        jpegBytes
      );


    /*
     Create same-size PDF page.
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
     Release canvas memory.
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
     Give mobile browser time
     to release memory.
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
   SECTION 30 — CANVAS → JPEG
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


          resolve(
            blob
          );

        },
        "image/jpeg",
        quality
      );

    }
  );

}


/* =========================================================
   SECTION 31 — PDF RESULT
   ========================================================= */

function showPdfResult(
  originalFile,
  blob,
  pageCount
) {

  if (!pdfResult) {
    return;
  }


  revokeUrl(
    pdfDownloadUrl
  );


  pdfDownloadUrl =
    URL.createObjectURL(
      blob
    );


  const targetBytes =
    getPdfTargetBytes();


  const reachedTarget =
    blob.size <=
    targetBytes;


  const saved =
    percentSaved(
      originalFile.size,
      blob.size
    );


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
      `✓ Target of ${pdfTargetMB} MB reached — ${saved}% smaller`;

  } else if (saved > 0) {

    statusText =
      `✓ Reduced by ${saved}% — best quality/size result`;

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


  show(
    pdfResult
  );

}


/* =========================================================
   SECTION 32 — PDF ERROR
   ========================================================= */

function showPdfError(
  message
) {

  hide(
    pdfProgress
  );


  if (pdfError) {

    pdfError.textContent =
      message;

    show(
      pdfError
    );

    return;

  }


  alert(
    message
  );

}


/* =========================================================
   SECTION 33 — CLEANUP
   ========================================================= */

window.addEventListener(
  "beforeunload",
  () => {

    revokeUrl(
      imageDownloadUrl
    );

    revokeUrl(
      pdfDownloadUrl
    );

  }
);


/* =========================================================
   SECTION 34 — STARTUP
   ========================================================= */

console.log(
  "FileShort — app.js VERSION 4 loaded."
);

console.log(
  "PDF target buttons:",
  document.querySelectorAll(
    ".size-btn"
  ).length
);

console.log(
  "Current PDF target:",
  pdfTargetMB,
  "MB"
);
