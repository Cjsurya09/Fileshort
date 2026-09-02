/* =========================================================
   FILESHORT - APP.JS
   Image compressor + PDF target-size compressor
   ========================================================= */

"use strict";

/* ---------------------------------------------------------
   HELPERS
--------------------------------------------------------- */

const $ = (selector) => document.querySelector(selector);

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes)) return "—";

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};


const percentSaved = (original, current) => {
  if (!original || current >= original) {
    return 0;
  }

  return Math.round((1 - current / original) * 100);
};


const show = (element) => {
  if (element) {
    element.classList.remove("hidden");
  }
};


const hide = (element) => {
  if (element) {
    element.classList.add("hidden");
  }
};


/* ---------------------------------------------------------
   IMAGE COMPRESSOR
--------------------------------------------------------- */

let imageFile = null;
let imageObjectUrl = null;


/* Elements */

const imageInput = $("#imageInput");
const imageDrop = $("#imageDrop");
const imageControls = $("#imageControls");
const imageResult = $("#imageResult");

const imageName = $("#imageName");
const imageOriginal = $("#imageOriginal");

const imageReset = $("#imageReset");

const quality = $("#quality");
const qualityValue = $("#qualityValue");

const imageFormat = $("#imageFormat");
const compressImageButton = $("#compressImage");

const imageResultOriginal = $("#imageResultOriginal");
const imageResultNew = $("#imageResultNew");
const imageSaved = $("#imageSaved");

const downloadImage = $("#downloadImage");


/* Quality display */

if (quality) {
  quality.addEventListener("input", () => {
    qualityValue.textContent = `${quality.value}%`;
  });
}


/* Image file selection */

if (imageInput) {
  imageInput.addEventListener("change", () => {
    const file = imageInput.files && imageInput.files[0];

    if (file) {
      loadImage(file);
    }
  });
}


/* Image drag and drop */

if (imageDrop) {

  ["dragenter", "dragover"].forEach((eventName) => {

    imageDrop.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();

      imageDrop.classList.add("dragging");
    });

  });


  ["dragleave", "drop"].forEach((eventName) => {

    imageDrop.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();

      imageDrop.classList.remove("dragging");
    });

  });


  imageDrop.addEventListener("drop", (event) => {

    const file =
      event.dataTransfer &&
      event.dataTransfer.files &&
      event.dataTransfer.files[0];

    if (file) {
      loadImage(file);
    }

  });

}


/* Load image */

function loadImage(file) {

  if (!file.type.startsWith("image/")) {

    alert("Please choose a JPG, PNG or WebP image.");

    return;
  }


  imageFile = file;

  imageName.textContent = file.name;
  imageOriginal.textContent = formatBytes(file.size);


  hide(imageResult);
  show(imageControls);


  imageDrop.classList.add("selected");


  imageObjectUrl = URL.createObjectURL(file);

}


/* Reset image */

if (imageReset) {

  imageReset.addEventListener("click", () => {

    imageFile = null;

    if (imageObjectUrl) {
      URL.revokeObjectURL(imageObjectUrl);
      imageObjectUrl = null;
    }

    if (imageInput) {
      imageInput.value = "";
    }

    hide(imageControls);
    hide(imageResult);

  });

}


/* Compress image */

if (compressImageButton) {

  compressImageButton.addEventListener("click", async () => {

    if (!imageFile) {
      alert("Please choose an image first.");
      return;
    }


    compressImageButton.disabled = true;
    compressImageButton.textContent = "Compressing...";


    try {

      const result = await compressImage(
        imageFile,
        Number(quality.value) / 100,
        imageFormat.value
      );


      const newBlob = result.blob;


      imageResultOriginal.textContent =
        formatBytes(imageFile.size);

      imageResultNew.textContent =
        formatBytes(newBlob.size);


      const saved = percentSaved(
        imageFile.size,
        newBlob.size
      );


      imageSaved.textContent =
        saved > 0
          ? `Saved: ${saved}%`
          : "The compressed file is not smaller than the original.";


      if (downloadImage.dataset.url) {
        URL.revokeObjectURL(downloadImage.dataset.url);
      }


      const url = URL.createObjectURL(newBlob);

      downloadImage.dataset.url = url;

      downloadImage.href = url;

      downloadImage.download =
        getCompressedImageName(
          imageFile.name,
          imageFormat.value
        );


      show(imageResult);

    } catch (error) {

      console.error(error);

      alert(
        "Image compression failed. Please try another image."
      );

    } finally {

      compressImageButton.disabled = false;
      compressImageButton.textContent = "Compress image";

    }

  });

}


/* Image compression engine */

async function compressImage(file, imageQuality, outputType) {

  const bitmap = await createImageBitmap(file);


  const maxDimension = 4000;

  let width = bitmap.width;
  let height = bitmap.height;


  if (width > maxDimension || height > maxDimension) {

    const ratio =
      Math.min(
        maxDimension / width,
        maxDimension / height
      );

    width = Math.round(width * ratio);
    height = Math.round(height * ratio);

  }


  const canvas = document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;


  const ctx = canvas.getContext("2d", {
    alpha: true
  });


  ctx.drawImage(
    bitmap,
    0,
    0,
    width,
    height
  );


  bitmap.close();


  const blob = await new Promise((resolve, reject) => {

    canvas.toBlob(
      (result) => {

        if (result) {
          resolve(result);
        } else {
          reject(
            new Error("Could not create image.")
          );
        }

      },
      outputType,
      imageQuality
    );

  });


  return {
    blob,
    width,
    height
  };

}


/* Image download name */

function getCompressedImageName(filename, type) {

  const base =
    filename.replace(/\.[^/.]+$/, "");


  if (type === "image/webp") {
    return `${base}-compressed.webp`;
  }


  return `${base}-compressed.jpg`;

}


/* ---------------------------------------------------------
   PDF COMPRESSOR
--------------------------------------------------------- */

let pdfFile = null;


/* Elements */

const pdfInput = $("#pdfInput");
const pdfDrop = $("#pdfDrop");

const pdfControls = $("#pdfControls");
const pdfResult = $("#pdfResult");
const pdfError = $("#pdfError");

const pdfName = $("#pdfName");
const pdfOriginal = $("#pdfOriginal");

const pdfReset = $("#pdfReset");

const pdfTarget = $("#pdfTarget");
const customTargetBox = $("#customTargetBox");
const customTarget = $("#customTarget");

const compressPdfButton = $("#compressPdf");

const pdfProgress = $("#pdfProgress");
const pdfProgressBar = $("#pdfProgressBar");
const pdfProgressText = $("#pdfProgressText");

const pdfResultOriginal = $("#pdfResultOriginal");
const pdfResultNew = $("#pdfResultNew");
const pdfSaved = $("#pdfSaved");

const downloadPdf = $("#downloadPdf");


/* PDF.js */

let pdfjs = null;
let pdfJsLoading = null;


/* Load PDF.js only when needed */

async function loadPdfJs() {

  if (pdfjs) {
    return pdfjs;
  }


  if (!pdfJsLoading) {

    pdfJsLoading = import(
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs"
    );

  }


  pdfjs = await pdfJsLoading;


  if (
    pdfjs.GlobalWorkerOptions &&
    !pdfjs.GlobalWorkerOptions.workerSrc
  ) {

    pdfjs.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";

  }


  return pdfjs;

}


/* PDF file selection */

if (pdfInput) {

  pdfInput.addEventListener("change", () => {

    const file =
      pdfInput.files &&
      pdfInput.files[0];

    if (file) {
      loadPdf(file);
    }

  });

}


/* PDF drag and drop */

if (pdfDrop) {

  ["dragenter", "dragover"].forEach((eventName) => {

    pdfDrop.addEventListener(eventName, (event) => {

      event.preventDefault();
      event.stopPropagation();

      pdfDrop.classList.add("dragging");

    });

  });


  ["dragleave", "drop"].forEach((eventName) => {

    pdfDrop.addEventListener(eventName, (event) => {

      event.preventDefault();
      event.stopPropagation();

      pdfDrop.classList.remove("dragging");

    });

  });


  pdfDrop.addEventListener("drop", (event) => {

    const file =
      event.dataTransfer &&
      event.dataTransfer.files &&
      event.dataTransfer.files[0];

    if (file) {
      loadPdf(file);
    }

  });

}


/* Load PDF */

function loadPdf(file) {

  const isPdf =
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf");


  if (!isPdf) {

    showPdfError(
      "Please choose a PDF file."
    );

    return;

  }


  pdfFile = file;


  pdfName.textContent = file.name;

  pdfOriginal.textContent =
    formatBytes(file.size);


  hide(pdfResult);
  hide(pdfError);

  show(pdfControls);

  pdfDrop.classList.add("selected");

}


/* PDF target selection */

if (pdfTarget) {

  pdfTarget.addEventListener("change", () => {

    if (pdfTarget.value === "custom") {

      show(customTargetBox);

    } else {

      hide(customTargetBox);

    }

  });

}


/* Reset PDF */

if (pdfReset) {

  pdfReset.addEventListener("click", () => {

    pdfFile = null;

    if (pdfInput) {
      pdfInput.value = "";
    }

    hide(pdfControls);
    hide(pdfResult);
    hide(pdfError);
    hide(pdfProgress);

  });

}


/* Get target size */

function getTargetBytes() {

  if (pdfTarget.value === "custom") {

    const value =
      Number(customTarget.value);


    if (
      !Number.isFinite(value) ||
      value <= 0
    ) {

      throw new Error(
        "Please enter a valid target size."
      );

    }


    return value * 1024 * 1024;

  }


  return (
    Number(pdfTarget.value) *
    1024 *
    1024
  );

}


/* ---------------------------------------------------------
   PDF COMPRESSION BUTTON
--------------------------------------------------------- */

if (compressPdfButton) {

  compressPdfButton.addEventListener("click", async () => {

    if (!pdfFile) {

      showPdfError(
        "Please choose a PDF first."
      );

      return;

    }


    let targetBytes;


    try {

      targetBytes = getTargetBytes();

    } catch (error) {

      showPdfError(error.message);

      return;

    }


    hide(pdfError);
    hide(pdfResult);

    show(pdfProgress);


    compressPdfButton.disabled = true;
    compressPdfButton.textContent = "Compressing...";


    try {

      const result =
        await compressPdfToTarget(
          pdfFile,
          targetBytes
        );


      const blob = result.blob;


      pdfResultOriginal.textContent =
        formatBytes(pdfFile.size);


      pdfResultNew.textContent =
        formatBytes(blob.size);


      const saved =
        percentSaved(
          pdfFile.size,
          blob.size
        );


      if (saved > 0) {

        pdfSaved.textContent =
          `Saved: ${saved}%`;

      } else {

        pdfSaved.textContent =
          "The PDF could not be reduced further at this target.";

      }


      if (downloadPdf.dataset.url) {
        URL.revokeObjectURL(
          downloadPdf.dataset.url
        );
      }


      const url =
        URL.createObjectURL(blob);


      downloadPdf.dataset.url = url;

      downloadPdf.href = url;

      downloadPdf.download =
        getCompressedPdfName(
          pdfFile.name
        );


      show(pdfResult);


    } catch (error) {

      console.error(error);

      showPdfError(
        error.message ||
        "PDF compression failed."
      );

    } finally {

      compressPdfButton.disabled = false;

      compressPdfButton.textContent =
        "Optimize PDF";

      setPdfProgress(
        100,
        "Finished"
      );

    }

  });

}


/* ---------------------------------------------------------
   PDF TARGET-SIZE ENGINE
--------------------------------------------------------- */

async function compressPdfToTarget(
  file,
  targetBytes
) {

  setPdfProgress(
    2,
    "Loading PDF..."
  );


  const pdfLibrary = window.PDFLib;


  if (!pdfLibrary) {

    throw new Error(
      "PDF compression library could not be loaded. Please refresh the page and try again."
    );

  }


  const pdfjsLib =
    await loadPdfJs();


  const arrayBuffer =
    await file.arrayBuffer();


  const sourcePdf =
    await pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer)
    }).promise;


  const pageCount =
    sourcePdf.numPages;


  if (!pageCount) {

    throw new Error(
      "This PDF does not contain any pages."
    );

  }


  /*
     First attempt:
     Render pages at a reasonable resolution
     and progressively reduce JPEG quality.
  */

  const attempts = [

    {
      scale: 1.35,
      quality: 0.82
    },

    {
      scale: 1.20,
      quality: 0.72
    },

    {
      scale: 1.05,
      quality: 0.62
    },

    {
      scale: 0.90,
      quality: 0.52
    },

    {
      scale: 0.78,
      quality: 0.43
    },

    {
      scale: 0.65,
      quality: 0.34
    },

    {
      scale: 0.55,
      quality: 0.25
    }

  ];


  let bestBlob = null;


  for (
    let attemptIndex = 0;
    attemptIndex < attempts.length;
    attemptIndex++
  ) {

    const attempt =
      attempts[attemptIndex];


    setPdfProgress(
      Math.round(
        5 +
        (attemptIndex / attempts.length) * 20
      ),
      `Trying compression level ${attemptIndex + 1}...`
    );


    const blob =
      await renderPdfAsImages(
        sourcePdf,
        pdfLibrary,
        attempt.scale,
        attempt.quality,
        (page, total) => {

          const base =
            10 +
            (attemptIndex / attempts.length) * 20;

          const progress =
            base +
            (page / total) *
            (25 / attempts.length);

          setPdfProgress(
            Math.min(95, Math.round(progress)),
            `Processing page ${page} of ${total}...`
          );

        }
      );


    if (!bestBlob || blob.size < bestBlob.size) {
      bestBlob = blob;
    }


    /*
       If we are already under the target,
       stop immediately.
    */

    if (blob.size <= targetBytes) {

      setPdfProgress(
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
     If the requested target is extremely small,
     the PDF may not be able to reach it while
     keeping all pages.
  */

  if (bestBlob) {

    const targetMB =
      targetBytes / (1024 * 1024);


    throw new Error(
      `The smallest safe result was ${formatBytes(bestBlob.size)}, which is larger than your ${targetMB.toFixed(1)} MB target. Try a larger target size.`
    );

  }


  throw new Error(
    "Could not create a compressed PDF."
  );

}


/* ---------------------------------------------------------
   RENDER PDF PAGES INTO A NEW PDF
--------------------------------------------------------- */

async function renderPdfAsImages(
  sourcePdf,
  pdfLibrary,
  scale,
  jpegQuality,
  onPageProgress
) {

  const {
    PDFDocument
  } = pdfLibrary;


  const newPdf =
    await PDFDocument.create();


  /*
     Process one page at a time.

     This is important for mobile devices because
     keeping every canvas in memory at once can
     crash the browser on large PDFs.
  */

  for (
    let pageNumber = 1;
    pageNumber <= sourcePdf.numPages;
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


    const canvas =
      document.createElement("canvas");


    canvas.width =
      Math.max(
        1,
        Math.floor(viewport.width)
      );


    canvas.height =
      Math.max(
        1,
        Math.floor(viewport.height)
      );


    const context =
      canvas.getContext("2d", {
        alpha: false
      });


    /*
       White background prevents transparent
       areas from becoming black in JPEG.
    */

    context.fillStyle = "#ffffff";

    context.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );


    await page.render({
      canvasContext: context,
      viewport
    }).promise;


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


    const outputPage =
      newPdf.addPage([
        viewport.width,
        viewport.height
      ]);


    outputPage.drawImage(
      image,
      {
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height
      }
    );


    /*
       Release canvas memory immediately.
    */

    canvas.width = 1;
    canvas.height = 1;


    if (typeof onPageProgress === "function") {

      onPageProgress(
        pageNumber,
        sourcePdf.numPages
      );

    }


    /*
       Allow Android/browser UI to breathe
       between pages.
    */

    await nextFrame();

  }


  const bytes =
    await newPdf.save({
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


/* ---------------------------------------------------------
   CANVAS → JPEG
--------------------------------------------------------- */

function canvasToJpeg(
  canvas,
  quality
) {

  return new Promise(
    (resolve, reject) => {

      canvas.toBlob(
        (blob) => {

          if (blob) {
            resolve(blob);
          } else {
            reject(
              new Error(
                "Could not create JPEG image."
              )
            );
          }

        },
        "image/jpeg",
        quality
      );

    }
  );

}


/* ---------------------------------------------------------
   PROGRESS
--------------------------------------------------------- */

function setPdfProgress(
  percentage,
  text
) {

  const value =
    Math.max(
      0,
      Math.min(
        100,
        percentage
      )
    );


  if (pdfProgressBar) {

    pdfProgressBar.style.width =
      `${value}%`;

  }


  if (pdfProgressText) {

    pdfProgressText.textContent =
      text;

  }

}


/* ---------------------------------------------------------
   PDF ERROR
--------------------------------------------------------- */

function showPdfError(message) {

  if (!pdfError) {

    alert(message);

    return;

  }


  pdfError.textContent =
    message;

  show(pdfError);

}


/* ---------------------------------------------------------
   PDF FILE NAME
--------------------------------------------------------- */

function getCompressedPdfName(
  filename
) {

  const base =
    filename.replace(
      /\.pdf$/i,
      ""
    );


  return `${base}-compressed.pdf`;

}


/* ---------------------------------------------------------
   NEXT FRAME
--------------------------------------------------------- */

function nextFrame() {

  return new Promise(
    (resolve) => {

      requestAnimationFrame(
        () => resolve()
      );

    }
  );

}


/* ---------------------------------------------------------
   CLEANUP
--------------------------------------------------------- */

window.addEventListener(
  "beforeunload",
  () => {

    if (imageObjectUrl) {
      URL.revokeObjectURL(
        imageObjectUrl
      );
    }


    if (downloadImage?.dataset.url) {

      URL.revokeObjectURL(
        downloadImage.dataset.url
      );

    }


    if (downloadPdf?.dataset.url) {

      URL.revokeObjectURL(
        downloadPdf.dataset.url
      );

    }

  }
);


/* ---------------------------------------------------------
   STARTUP TEST
--------------------------------------------------------- */

console.log(
  "FileShort app.js loaded successfully."
);
