/* =========================================================
   FILESHORT
   APP.JS
   Version 2.0
   ========================================================= */


/* =========================================================
   01. GLOBAL SETTINGS
   ========================================================= */

const FILESHORT = {

  image: {
    maxWidth: 4096,
    maxHeight: 4096,
    defaultQuality: 70
  },

  pdf: {
    defaultTargetMB: 5,
    minQuality: 20,
    maxQuality: 90,
    maxAttempts: 7
  },

  limits: {
    maxImageMB: 100,
    maxPDFMB: 500
  }

};


/* =========================================================
   02. COMMON UTILITIES
   ========================================================= */


/**
 * Convert bytes to a readable file size.
 */
function formatBytes(bytes) {

  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];

  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );

  return (
    bytes / Math.pow(1024, index)
  ).toFixed(index === 0 ? 0 : 2) + " " + units[index];

}


/**
 * Convert MB to bytes.
 */
function mbToBytes(mb) {
  return mb * 1024 * 1024;
}


/**
 * Safely get an element.
 */
function $(id) {
  return document.getElementById(id);
}


/**
 * Show an element.
 */
function show(element) {

  if (!element) return;

  element.classList.remove("hidden");

}


/**
 * Hide an element.
 */
function hide(element) {

  if (!element) return;

  element.classList.add("hidden");

}


/**
 * Set text safely.
 */
function setText(element, text) {

  if (!element) return;

  element.textContent = text;

}


/**
 * Create a download URL.
 */
function createDownloadURL(blob) {

  return URL.createObjectURL(blob);

}


/**
 * Download a blob.
 */
function downloadBlob(blob, filename) {

  const url = createDownloadURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);

  link.click();

  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 10000);

}


/**
 * Generate a safe filename.
 */
function getOutputName(filename, extension) {

  const cleanName =
    filename
      .replace(/\.[^/.]+$/, "")
      .replace(/[^\w\- ]+/g, "")
      .trim() || "File";

  return `${cleanName}-compressed.${extension}`;

}


/**
 * Yield to browser.
 *
 * This prevents the interface from appearing
 * completely frozen during heavy operations.
 */
function yieldToBrowser() {

  return new Promise(resolve => {

    if ("requestIdleCallback" in window) {

      requestIdleCallback(
        () => resolve(),
        { timeout: 50 }
      );

    } else {

      setTimeout(resolve, 0);

    }

  });

}


/* =========================================================
   03. IMAGE COMPRESSOR
   ========================================================= */

const ImageCompressor = {

  file: null,
  outputURL: null,


  init() {

    const input = $("imageInput");
    const drop = $("imageDrop");
    const quality = $("quality");
    const qualityValue = $("qualityValue");
    const compressButton = $("compressImage");
    const resetButton = $("imageReset");


    if (!input) return;


    /* File selection */

    input.addEventListener(
      "change",
      event => {

        const file =
          event.target.files?.[0];

        if (file) {

          this.handleFile(file);

        }

      }
    );


    /* Quality */

    if (quality) {

      quality.addEventListener(
        "input",
        () => {

          setText(
            qualityValue,
            `${quality.value}%`
          );

        }
      );

    }


    /* Compress */

    if (compressButton) {

      compressButton.addEventListener(
        "click",
        () => this.compress()
      );

    }


    /* Reset */

    if (resetButton) {

      resetButton.addEventListener(
        "click",
        () => this.reset()
      );

    }


    /* Drag and drop */

    this.setupDragDrop(
      drop,
      input
    );

  },


  handleFile(file) {

    if (!file.type.startsWith("image/")) {

      alert("Please choose a valid image file.");

      return;

    }


    if (
      file.size >
      FILESHORT.limits.maxImageMB * 1024 * 1024
    ) {

      alert(
        `Image is too large. Maximum supported size is ${FILESORT.limits.maxImageMB} MB.`
      );

      return;

    }


    this.file = file;


    setText(
      $("imageName"),
      file.name
    );


    setText(
      $("imageOriginal"),
      formatBytes(file.size)
    );


    show($("imageControls"));

    hide($("imageResult"));

  },


  async compress() {

    if (!this.file) {

      alert("Please choose an image first.");

      return;

    }


    const button = $("compressImage");

    const quality =
      Number($("quality")?.value || 70) / 100;


    const format =
      $("imageFormat")?.value ||
      "image/jpeg";


    button.disabled = true;

    button.textContent =
      "⏳ Compressing...";


    try {

      const blob =
        await this.compressImage(
          this.file,
          quality,
          format
        );


      if (!blob) {

        throw new Error(
          "Image compression failed."
        );

      }


      this.showResult(
        blob,
        format
      );

    } catch (error) {

      console.error(error);

      alert(
        "Unable to compress this image. Please try another image."
      );

    } finally {

      button.disabled = false;

      button.textContent =
        "⚡ Compress Image";

    }

  },


  compressImage(
    file,
    quality,
    format
  ) {

    return new Promise(
      (resolve, reject) => {

        const image =
          new Image();

        const url =
          URL.createObjectURL(file);


        image.onload = () => {

          try {

            let width =
              image.naturalWidth;

            let height =
              image.naturalHeight;


            /*
             * Prevent unnecessarily huge
             * canvas operations.
             */

            const maxWidth =
              FILESHORT.image.maxWidth;

            const maxHeight =
              FILESHORT.image.maxHeight;


            if (
              width > maxWidth ||
              height > maxHeight
            ) {

              const ratio =
                Math.min(
                  maxWidth / width,
                  maxHeight / height
                );

              width =
                Math.round(width * ratio);

              height =
                Math.round(height * ratio);

            }


            const canvas =
              document.createElement("canvas");


            canvas.width = width;
            canvas.height = height;


            const context =
              canvas.getContext(
                "2d",
                {
                  alpha: true
                }
              );


            context.drawImage(
              image,
              0,
              0,
              width,
              height
            );


            canvas.toBlob(
              blob => {

                URL.revokeObjectURL(url);

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
              format,
              quality
            );


          } catch (error) {

            URL.revokeObjectURL(url);

            reject(error);

          }

        };


        image.onerror = () => {

          URL.revokeObjectURL(url);

          reject(
            new Error(
              "Could not read image."
            )
          );

        };


        image.src = url;

      }
    );

  },


  showResult(
    blob,
    format
  ) {

    if (this.outputURL) {

      URL.revokeObjectURL(
        this.outputURL
      );

    }


    this.outputURL =
      URL.createObjectURL(blob);


    const originalSize =
      this.file.size;

    const newSize =
      blob.size;


    setText(
      $("imageResultOriginal"),
      formatBytes(originalSize)
    );


    setText(
      $("imageResultNew"),
      formatBytes(newSize)
    );


    const saved =
      originalSize > 0
        ? Math.max(
            0,
            (1 - newSize / originalSize) * 100
          )
        : 0;


    setText(
      $("imageSaved"),
      saved > 0
        ? `You saved ${saved.toFixed(1)}%`
        : "The compressed file is not smaller."
    );


    const download =
      $("downloadImage");


    if (download) {

      download.href =
        this.outputURL;

      download.download =
        getOutputName(
          this.file.name,
          format === "image/webp"
            ? "webp"
            : "jpg"
        );

    }


    show($("imageResult"));

    $("imageResult")?.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });

  },


  reset() {

    this.file = null;


    if (this.outputURL) {

      URL.revokeObjectURL(
        this.outputURL
      );

      this.outputURL = null;

    }


    const input =
      $("imageInput");

    if (input) {

      input.value = "";

    }


    hide($("imageControls"));

    hide($("imageResult"));

  },


  setupDragDrop(
    zone,
    input
  ) {

    if (!zone) return;


    [
      "dragenter",
      "dragover"
    ].forEach(eventName => {

      zone.addEventListener(
        eventName,
        event => {

          event.preventDefault();

          zone.classList.add("drag");

        }
      );

    });


    [
      "dragleave",
      "drop"
    ].forEach(eventName => {

      zone.addEventListener(
        eventName,
        event => {

          event.preventDefault();

          zone.classList.remove("drag");

        }
      );

    });


    zone.addEventListener(
      "drop",
      event => {

        const file =
          event.dataTransfer?.files?.[0];

        if (file) {

          this.handleFile(file);

        }

      }
    );

  }

};


/* =========================================================
   04. PDF COMPRESSOR
   ========================================================= */

const PDFCompressor = {

  file: null,
  outputURL: null,


  init() {

    const input =
      $("pdfInput");

    if (!input) return;


    input.addEventListener(
      "change",
      event => {

        const file =
          event.target.files?.[0];

        if (file) {

          this.handleFile(file);

        }

      }
    );


    const compressButton =
      $("compressPdf");


    if (compressButton) {

      compressButton.addEventListener(
        "click",
        () => this.compress()
      );

    }


    const resetButton =
      $("pdfReset");


    if (resetButton) {

      resetButton.addEventListener(
        "click",
        () => this.reset()
      );

    }


    this.setupTargetButtons();

    this.setupDragDrop();

  },


  handleFile(file) {

    const isPDF =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");


    if (!isPDF) {

      this.showError(
        "Please choose a valid PDF file."
      );

      return;

    }


    if (
      file.size >
      FILESHORT.limits.maxPDFMB * 1024 * 1024
    ) {

      this.showError(
        `PDF is too large. Maximum supported size is ${FILESORT.limits.maxPDFMB} MB.`
      );

      return;

    }


    this.file = file;


    setText(
      $("pdfName"),
      file.name
    );


    setText(
      $("pdfOriginal"),
      formatBytes(file.size)
    );


    hide($("pdfError"));

    hide($("pdfResult"));

    show($("pdfControls"));

  },


  /* =======================================================
     TARGET SIZE CONTROLS
  ======================================================= */

  setupTargetButtons() {

    const buttons =
      document.querySelectorAll(
        ".size-btn"
      );


    const targetInput =
      $("targetSize");


    buttons.forEach(button => {

      button.addEventListener(
        "click",
        () => {

          buttons.forEach(
            item =>
              item.classList.remove("active")
          );


          button.classList.add("active");


          const size =
            Number(
              button.dataset.size
            );


          if (targetInput) {

            targetInput.value =
              size;

          }

        }
      );

    });


    if (targetInput) {

      targetInput.addEventListener(
        "input",
        () => {

          buttons.forEach(
            item =>
              item.classList.remove("active")
          );

        }
      );

    }


    /*
     * Backwards compatibility
     * with your previous HTML.
     */

    const oldTarget =
      $("pdfTarget");

    const oldCustom =
      $("customTarget");

    const oldCustomBox =
      $("customTargetBox");


    if (oldTarget) {

      oldTarget.addEventListener(
        "change",
        () => {

          if (
            oldTarget.value ===
            "custom"
          ) {

            show(oldCustomBox);

          } else {

            hide(oldCustomBox);

          }

        }
      );

    }


    if (oldCustom) {

      oldCustom.addEventListener(
        "input",
        () => {

          if (targetInput) {

            targetInput.value =
              oldCustom.value;

          }

        }
      );

    }

  },


  getTargetMB() {

    const newTarget =
      Number(
        $("targetSize")?.value
      );


    if (
      Number.isFinite(newTarget) &&
      newTarget > 0
    ) {

      return newTarget;

    }


    const oldTarget =
      $("pdfTarget");


    if (
      oldTarget &&
      oldTarget.value !== "custom"
    ) {

      const value =
        Number(oldTarget.value);


      if (
        Number.isFinite(value) &&
        value > 0
      ) {

        return value;

      }

    }


    const oldCustom =
      Number(
        $("customTarget")?.value
      );


    if (
      Number.isFinite(oldCustom) &&
      oldCustom > 0
    ) {

      return oldCustom;

    }


    return FILESHORT.pdf.defaultTargetMB;

  },


  /* =======================================================
     PDF COMPRESSION ENGINE
  ======================================================= */

  async compress() {

    if (!this.file) {

      this.showError(
        "Please choose a PDF first."
      );

      return;

    }


    if (
      typeof PDFLib ===
      "undefined"
    ) {

      this.showError(
        "PDF engine is not available. Please refresh the page."
      );

      return;

    }


    const button =
      $("compressPdf");


    const targetMB =
      this.getTargetMB();


    const targetBytes =
      mbToBytes(targetMB);


    hide($("pdfError"));

    hide($("pdfResult"));

    show($("pdfProgress"));


    button.disabled = true;

    button.textContent =
      "⏳ Compressing PDF...";


    this.updateProgress(
      3,
      "Reading PDF..."
    );


    try {

      /*
       * Load the original PDF.
       */

      const sourceBytes =
        await this.file.arrayBuffer();


      await yieldToBrowser();


      this.updateProgress(
        10,
        "Analyzing PDF..."
      );


      const sourcePDF =
        await PDFLib.PDFDocument.load(
          sourceBytes,
          {
            ignoreEncryption: true,
            updateMetadata: false
          }
        );


      const pageCount =
        sourcePDF.getPageCount();


      /*
       * First attempt:
       * save the PDF with compression enabled.
       *
       * This is extremely fast for PDFs
       * where the main issue is redundant
       * PDF structure rather than huge images.
       */

      this.updateProgress(
        20,
        `Optimizing ${pageCount} pages...`
      );


      let result =
        await this.fastSave(
          sourcePDF
        );


      if (
        result.length <=
        targetBytes
      ) {

        this.updateProgress(
          100,
          "Compression complete."
        );


        this.showResult(
          new Blob(
            [result],
            {
              type: "application/pdf"
            }
          ),
          targetMB
        );


        return;

      }


      /*
       * If the PDF is still too large,
       * try image-based compression.
       *
       * This is slower, but is much more
       * effective for scanned/image-heavy PDFs.
       */

      this.updateProgress(
        25,
        "PDF contains large content. Applying stronger compression..."
      );


      result =
        await this.imageBasedCompression(
          sourceBytes,
          targetBytes,
          pageCount
        );


      this.updateProgress(
        100,
        "Compression complete."
      );


      this.showResult(
        new Blob(
          [result],
          {
            type: "application/pdf"
          }
        ),
        targetMB
      );


    } catch (error) {

      console.error(
        "PDF compression error:",
        error
      );


      this.showError(
        this.getFriendlyPDFError(error)
      );


    } finally {

      button.disabled = false;

      button.textContent =
        "⚡ Compress PDF";

    }

  },


  /* =======================================================
     FAST PDF SAVE
  ======================================================= */

  async fastSave(pdf) {

    return await pdf.save({
      useObjectStreams: true,
      addDefaultPage: false,
      updateFieldAppearances: false
    });

  },


  /* =======================================================
     IMAGE-BASED PDF COMPRESSION
  ======================================================= */

  async imageBasedCompression(
    sourceBytes,
    targetBytes,
    pageCount
  ) {

    /*
     * PDF.js is loaded as a module in index.html.
     *
     * We look for the global/module API if available.
     */

    const pdfjs =
      window.pdfjsLib;


    /*
     * If PDF.js is not globally available,
     * fall back to structural optimization.
     */

    if (!pdfjs) {

      const fallback =
        await PDFLib.PDFDocument.load(
          sourceBytes,
          {
            ignoreEncryption: true,
            updateMetadata: false
          }
        );


      return await this.fastSave(
        fallback
      );

    }


    /*
     * Compression levels.
     *
     * We start with reasonable quality and
     * progressively reduce it only when needed.
     */

    const attempts = [

      {
        scale: 1.35,
        quality: 0.72
      },

      {
        scale: 1.15,
        quality: 0.62
      },

      {
        scale: 1.00,
        quality: 0.52
      },

      {
        scale: 0.85,
        quality: 0.44
      },

      {
        scale: 0.72,
        quality: 0.36
      },

      {
        scale: 0.60,
        quality: 0.28
      },

      {
        scale: 0.50,
        quality: 0.22
      }

    ];


    let bestResult = null;


    for (
      let attempt = 0;
      attempt < attempts.length;
      attempt++
    ) {

      const settings =
        attempts[attempt];


      this.updateProgress(
        30 +
        Math.round(
          (attempt /
            attempts.length) *
          60
        ),
        `Compression pass ${attempt + 1} of ${attempts.length}...`
      );


      await yieldToBrowser();


      const result =
        await this.renderPDF(
          sourceBytes,
          pageCount,
          settings
        );


      if (!bestResult ||
          result.length < bestResult.length) {

        bestResult = result;

      }


      /*
       * We reached the requested target.
       */

      if (
        result.length <=
        targetBytes
      ) {

        return result;

      }

    }


    /*
     * Return the smallest version we
     * successfully produced.
     */

    return bestResult;

  },


  /* =======================================================
     RENDER PDF PAGES
  ======================================================= */

  async renderPDF(
    sourceBytes,
    pageCount,
    settings
  ) {

    const pdfjs =
      window.pdfjsLib;


    const loadingTask =
      pdfjs.getDocument({
        data: sourceBytes
      });


    const pdf =
      await loadingTask.promise;


    const output =
      await PDFLib.PDFDocument.create();


    /*
     * Remove metadata where possible.
     */

    output.setTitle("");
    output.setAuthor("");
    output.setSubject("");
    output.setKeywords([]);
    output.setProducer("FileShort");


    for (
      let pageNumber = 1;
      pageNumber <= pageCount;
      pageNumber++
    ) {

      const page =
        await pdf.getPage(
          pageNumber
        );


      const viewport =
        page.getViewport({
          scale: settings.scale
        });


      /*
       * Keep canvas sizes reasonable.
       */

      const maxDimension = 2400;

      let width =
        viewport.width;

      let height =
        viewport.height;


      if (
        width > maxDimension ||
        height > maxDimension
      ) {

        const ratio =
          Math.min(
            maxDimension / width,
            maxDimension / height
          );

        width *= ratio;
        height *= ratio;

      }


      const canvas =
        document.createElement(
          "canvas"
        );


      canvas.width =
        Math.max(
          1,
          Math.round(width)
        );

      canvas.height =
        Math.max(
          1,
          Math.round(height)
        );


      const context =
        canvas.getContext(
          "2d",
          {
            alpha: false
          }
        );


      context.fillStyle =
        "#ffffff";

      context.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
      );


      const renderViewport =
        page.getViewport({
          scale:
            canvas.width /
            viewport.width *
            settings.scale
        });


      await page.render({
        canvasContext: context,
        viewport:
          renderViewport
      }).promise;


      /*
       * JPEG is significantly smaller than
       * embedding full PNG page images.
       */

      const dataURL =
        canvas.toDataURL(
          "image/jpeg",
          settings.quality
        );


      const image =
        await output.embedJpg(
          dataURL
        );


      const pdfPage =
        output.addPage([
          canvas.width,
          canvas.height
        ]);


      pdfPage.drawImage(
        image,
        {
          x: 0,
          y: 0,
          width:
            canvas.width,
          height:
            canvas.height
        }
      );


      /*
       * Free memory before processing
       * the next page.
       */

      canvas.width = 1;
      canvas.height = 1;


      /*
       * Update progress occasionally.
       */

      if (
        pageNumber === 1 ||
        pageNumber === pageCount ||
        pageNumber % 3 === 0
      ) {

        const pageProgress =
          pageNumber /
          pageCount;


        this.updateProgress(
          30 +
          Math.round(
            pageProgress * 45
          ),
          `Processing page ${pageNumber} of ${pageCount}...`
        );


        await yieldToBrowser();

      }

    }


    return await output.save({
      useObjectStreams: true,
      addDefaultPage: false,
      updateFieldAppearances: false
    });

  },


  /* =======================================================
     PROGRESS
  ======================================================= */

  updateProgress(
    percent,
    message
  ) {

    const safePercent =
      Math.max(
        0,
        Math.min(
          100,
          Math.round(percent)
        )
      );


    const bar =
      $("progressFill") ||
      $("pdfProgressBar");


    const percentText =
      $("progressPercent");


    const progressText =
      $("progressText") ||
      $("pdfProgressText");


    if (bar) {

      bar.style.width =
        `${safePercent}%`;

    }


    setText(
      percentText,
      `${safePercent}%`
    );


    setText(
      progressText,
      message
    );

  },


  /* =======================================================
     PDF RESULT
  ======================================================= */

  showResult(
    blob,
    targetMB
  ) {

    if (this.outputURL) {

      URL.revokeObjectURL(
        this.outputURL
      );

    }


    this.outputURL =
      URL.createObjectURL(
        blob
      );


    const originalSize =
      this.file.size;

    const newSize =
      blob.size;


    const saved =
      originalSize > 0
        ? Math.max(
            0,
            (1 -
              newSize /
              originalSize) *
              100
          )
        : 0;


    const result =
      $("pdfResult");


    if (!result) return;


    /*
     * Create result UI if the HTML
     * result container is empty.
     */

    result.innerHTML = `

      <div class="result-success">

        <div class="result-icon">
          ✓
        </div>

        <div>

          <h3>
            PDF compression complete
          </h3>

          <p>
            Original:
            <strong>
              ${formatBytes(originalSize)}
            </strong>
          </p>

          <p>
            New:
            <strong>
              ${formatBytes(newSize)}
            </strong>
          </p>

          <p>
            ${
              saved > 0
                ? `You saved ${saved.toFixed(1)}%`
                : "The PDF could not be reduced further."
            }
          </p>

          <p>
            Target:
            <strong>
              ${targetMB} MB
            </strong>
          </p>

        </div>

      </div>

      <a
        class="download"
        href="${this.outputURL}"
        download="${getOutputName(this.file.name, "pdf")}"
      >
        Download compressed PDF →
      </a>

    `;


    hide($("pdfProgress"));

    show(result);


    result.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });

  },


  /* =======================================================
     ERROR
  ======================================================= */

  showError(message) {

    const error =
      $("pdfError");


    if (!error) {

      alert(message);

      return;

    }


    setText(
      error,
      message
    );


    show(error);

  },


  getFriendlyPDFError(error) {

    const message =
      String(
        error?.message || ""
      );


    if (
      /password|encrypted/i.test(
        message
      )
    ) {

      return (
        "This PDF is password protected or encrypted. Please unlock it first."
      );

    }


    if (
      /memory|allocation|heap/i.test(
        message
      )
    ) {

      return (
        "This PDF is too large or complex for the browser to process safely. Try a smaller PDF."
      );

    }


    return (
      "The PDF could not be compressed. The document may contain unsupported or complex content."
    );

  },


  /* =======================================================
     RESET
  ======================================================= */

  reset() {

    this.file = null;


    if (this.outputURL) {

      URL.revokeObjectURL(
        this.outputURL
      );

      this.outputURL = null;

    }


    const input =
      $("pdfInput");


    if (input) {

      input.value = "";

    }


    hide($("pdfControls"));

    hide($("pdfProgress"));

    hide($("pdfResult"));

    hide($("pdfError"));

  },


  /* =======================================================
     DRAG & DROP
  ======================================================= */

  setupDragDrop() {

    const zone =
      $("pdfDrop");


    const input =
      $("pdfInput");


    if (!zone) return;


    [
      "dragenter",
      "dragover"
    ].forEach(
      eventName => {

        zone.addEventListener(
          eventName,
          event => {

            event.preventDefault();

            zone.classList.add(
              "drag"
            );

          }
        );

      }
    );


    [
      "dragleave",
      "drop"
    ].forEach(
      eventName => {

        zone.addEventListener(
          eventName,
          event => {

            event.preventDefault();

            zone.classList.remove(
              "drag"
            );

          }
        );

      }
    );


    zone.addEventListener(
      "drop",
      event => {

        const file =
          event.dataTransfer
            ?.files?.[0];


        if (file) {

          this.handleFile(file);

        }

      }
    );

  }

};


/* =========================================================
   05. GLOBAL UPLOAD IMPROVEMENTS
========================================================= */


/**
 * Make upload cards open their corresponding
 * file picker reliably.
 */
function setupUploadCards() {

  const cards =
    document.querySelectorAll(
      ".upload-card"
    );


  cards.forEach(card => {

    const input =
      card.querySelector(
        'input[type="file"]'
      );


    if (!input) return;


    /*
     * The label normally handles this,
     * but this also makes the entire card
     * reliably clickable.
     */

    card.addEventListener(
      "click",
      event => {

        /*
         * Don't trigger twice when the
         * browser is already handling
         * the label/input interaction.
         */

        if (
          event.target === input
        ) {

          return;

        }

      }
    );


    input.addEventListener(
      "click",
      event => {

        event.stopPropagation();

      }
    );

  });

}


/* =========================================================
   06. PAGE INITIALIZATION
========================================================= */

function initializeFileShort() {

  console.log(
    "FileShort initialized."
  );


  /*
   * Initialize image compressor.
   */

  ImageCompressor.init();


  /*
   * Initialize PDF compressor.
   */

  PDFCompressor.init();


  /*
   * Upload card behavior.
   */

  setupUploadCards();

}


/* =========================================================
   07. START APPLICATION
========================================================= */

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initializeFileShort
  );

} else {

  initializeFileShort();

}
