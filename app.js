const state = {
  items: [],
  isProcessing: false,
};

const compressorState = {
  files: [],
  results: [],
  estimates: {},
  isEstimating: false,
  estimateRunId: 0,
  isProcessing: false,
};

const els = {
  fileInput: document.querySelector("#fileInput"),
  dropZone: document.querySelector("#dropZone"),
  mainWorkspace: document.querySelector("#mainWorkspace"),
  imageGrid: document.querySelector("#imageGrid"),
  emptyState: document.querySelector("#dropZone"),
  processButton: document.querySelector("#processButton"),
  downloadButton: document.querySelector("#downloadButton"),
  clearButton: document.querySelector("#clearButton"),
  toleranceRange: document.querySelector("#toleranceRange"),
  toleranceOutput: document.querySelector("#toleranceOutput"),
  modelSelect: document.querySelector("#modelSelect"),
  pixianPanel: document.querySelector("#pixianPanel"),
  pixianApiIdInput: document.querySelector("#pixianApiIdInput"),
  pixianApiSecretInput: document.querySelector("#pixianApiSecretInput"),
  pixianCheckCreditsButton: document.querySelector("#pixianCheckCreditsButton"),
  pixianCreditStatus: document.querySelector("#pixianCreditStatus"),
  koukoutuPanel: document.querySelector("#koukoutuPanel"),
  koukoutuApiKeyInput: document.querySelector("#koukoutuApiKeyInput"),
  koukoutuCheckCreditsButton: document.querySelector("#koukoutuCheckCreditsButton"),
  koukoutuCreditStatus: document.querySelector("#koukoutuCreditStatus"),
  scaleSelect: document.querySelector("#scaleSelect"),
  upscaleProviderSelect: document.querySelector("#upscaleProviderSelect"),
  featherSelect: document.querySelector("#featherSelect"),
  shrinkSelect: document.querySelector("#shrinkSelect"),
  trimToggle: document.querySelector("#trimToggle"),
  sharpenToggle: document.querySelector("#sharpenToggle"),
  checkerToggle: document.querySelector("#checkerToggle"),
  queueStatus: document.querySelector("#queueStatus"),
  uploadMoreButton: document.querySelector("#uploadMoreButton"),
  progressText: document.querySelector("#progressText"),
  progressBar: document.querySelector("#progressBar"),
  hintText: document.querySelector("#hintText"),
  compressFileInput: document.querySelector("#compressFileInput"),
  compressQualityRange: document.querySelector("#compressQualityRange"),
  compressQualityOutput: document.querySelector("#compressQualityOutput"),
  compressCustomQuality: document.querySelector("#compressCustomQuality"),
  compressFormatSelect: document.querySelector("#compressFormatSelect"),
  compressButton: document.querySelector("#compressButton"),
  compressDownloadButton: document.querySelector("#compressDownloadButton"),
  compressStatus: document.querySelector("#compressStatus"),
  compressToggleButton: document.querySelector("#compressToggleButton"),
  compressBody: document.querySelector("#compressBody"),
  compressQualitySizes: document.querySelectorAll("[data-quality-size]"),
  compressPreviewCard: document.querySelector("#compressPreviewCard"),
  compressPreviewImage: document.querySelector("#compressPreviewImage"),
  template: document.querySelector("#imageCardTemplate"),
  previewModal: document.querySelector("#previewModal"),
  previewImage: document.querySelector("#previewImage"),
  previewTitle: document.querySelector("#previewTitle"),
  previewMeta: document.querySelector("#previewMeta"),
  previewDownloadButton: document.querySelector("#previewDownloadButton"),
  previewCropActions: document.querySelector("#previewCropActions"),
  previewCropButton: document.querySelector("#previewCropButton"),
  previewApplyCropButton: document.querySelector("#previewApplyCropButton"),
  previewCancelCropButton: document.querySelector("#previewCancelCropButton"),
  previewCropOverlay: document.querySelector("#previewCropOverlay"),
  previewCloseButton: document.querySelector("#previewCloseButton"),
  editModal: document.querySelector("#editModal"),
  editBackgroundCanvas: document.querySelector("#editBackgroundCanvas"),
  editCanvas: document.querySelector("#editCanvas"),
  penOverlayCanvas: document.querySelector("#penOverlayCanvas"),
  eraserBrushPreview: document.querySelector("#eraserBrushPreview"),
  editCanvasStage: document.querySelector(".edit-canvas-stage"),
  editCanvasWrap: document.querySelector(".edit-canvas-wrap"),
  editTitle: document.querySelector("#editTitle"),
  editMeta: document.querySelector("#editMeta"),
  editToleranceRange: document.querySelector("#editToleranceRange"),
  editToleranceOutput: document.querySelector("#editToleranceOutput"),
  editEdgeRange: document.querySelector("#editEdgeRange"),
  editEdgeOutput: document.querySelector("#editEdgeOutput"),
  eraserSizeRange: document.querySelector("#eraserSizeRange"),
  eraserSizeOutput: document.querySelector("#eraserSizeOutput"),
  editFillColorInput: document.querySelector("#editFillColorInput"),
  editFillColorText: document.querySelector("#editFillColorText"),
  fillBackgroundButton: document.querySelector("#fillBackgroundButton"),
  clearBackgroundButton: document.querySelector("#clearBackgroundButton"),
  invertSelectionButton: document.querySelector("#invertSelectionButton"),
  finishPenButton: document.querySelector("#finishPenButton"),
  clearPenButton: document.querySelector("#clearPenButton"),
  editUndoButton: document.querySelector("#editUndoButton"),
  editApplyButton: document.querySelector("#editApplyButton"),
  editCloseButton: document.querySelector("#editCloseButton"),
};

els.modelOption = document.querySelector('[data-option="model"]');
els.scaleOption = document.querySelector('[data-option="scale"]');
els.upscaleProviderOption = document.querySelector('[data-option="upscale-provider"]');
els.edgeFeatherOption = document.querySelector('[data-option="edge-feather"]');
els.edgeShrinkOption = document.querySelector('[data-option="edge-shrink"]');
els.toleranceOption = document.querySelector('[data-option="tolerance"]');
els.autoCropOption = document.querySelector('[data-option="auto-crop"]');
els.sharpenOption = document.querySelector('[data-option="sharpen"]');

const MAX_OUTPUT_PIXELS = 42000000;
const DEFAULT_EDGE_FEATHER = 2;
const DEFAULT_EDGE_SHRINK = 0;
const DEFAULT_AUTO_TRIM = false;
const MODEL_PRESETS = {
  "local-fast": {
    matting: "standard",
    toleranceScale: 0.92,
  },
  "pixian-ai": {
    matting: "pixian",
    toleranceScale: 1,
  },
  koukoutu: {
    matting: "koukoutu",
    toleranceScale: 1,
  },
};
const APP_CONFIG = window.APP_CONFIG || {};
const BUILT_IN_REMOVE_BG_MODELS = [
  {
    id: "local-fast",
    label: "本地极速",
    provider: "local",
    default: false,
  },
  {
    id: "pixian-ai",
    label: "Pixian.ai",
    provider: "pixian",
    default: false,
  },
  {
    id: "koukoutu",
    label: "抠抠图",
    provider: "koukoutu",
    default: false,
  },
];
const UPSCALE_PROXY_URL = APP_CONFIG.UPSCALE_PROXY_URL || "";
const UPSCALE_WORKFLOWS = normalizeUpscaleWorkflows(APP_CONFIG.UPSCALE_WORKFLOWS);
const REMOVE_BG_PROXY_URL = APP_CONFIG.REMOVE_BG_PROXY_URL || "";
const REMOVE_BG_WORKFLOWS = normalizeRemoveBgWorkflows(APP_CONFIG.REMOVE_BG_WORKFLOWS);
const RUNNINGHUB_REMOVEBG_POLL_INTERVAL_MS = 3000;
const RUNNINGHUB_REMOVEBG_MAX_POLLS = 120;
const UPSCALE_PROVIDERS = {
  "canvas-resize": {
    label: "普通放大",
    provider: "resize",
    async process(canvas, options) {
      const safeScale = getSafeScale(canvas, options.scale);
      const output = upscaleCanvas(canvas, safeScale);
      if (options.sharpen) sharpenCanvas(output);
      return output;
    },
  },
  runninghub: {
    label: "RunningHub 高清放大",
    provider: "runninghub",
    async process(canvas, options) {
      return upscaleWithRunningHub(canvas, options);
    },
  },
};
const PIXIAN_API_URL = "https://api.pixian.ai/api/v2/remove-background";
const PIXIAN_ACCOUNT_URL = "https://api.pixian.ai/api/v2/account";
const PIXIAN_CREDENTIALS_KEY = "imageBatchStudio.pixianCredentials.v1";
const KOUKOUTU_API_URL = "https://sync.koukoutu.com/v1/create";
const KOUKOUTU_SCORE_URL = "https://async.koukoutu.com/v1/score";
const KOUKOUTU_PROXY_URL = "https://young-art-be70.ste611003.workers.dev";
const KOUKOUTU_CREDENTIALS_KEY = "imageBatchStudio.koukoutuCredentials.v1";
const GIF_DECODER_MODULE_URL = "https://esm.sh/gifuct-js@2.1.2?bundle";
const GIF_ENCODER_MODULE_URL = "https://unpkg.com/gifenc";
const COMPRESSION_QUALITY_PRESETS = {
  high: 0.6,
  low: 0.9,
};
const COMPRESSION_FALLBACK_MIMES = ["image/jpeg", "image/png"];
let previewUrl = null;
let previewItem = null;
let previewMode = "result";
let isPreviewCropping = false;
let previewCropRect = null;
let previewCropBounds = null;
let previewCropDrag = null;
let editItem = null;
let editUndoStack = [];
let editPickCount = 0;
let editBaseScale = 1;
let editViewScale = 1;
let editViewOffset = { x: 0, y: 0 };
let isEditPanning = false;
let didEditPan = false;
let editPanStart = { x: 0, y: 0, offsetX: 0, offsetY: 0 };
let editTool = "pick";
let penPoints = [];
let penHoverPoint = null;
let isPenPathApplied = false;
let isSelectionInverted = false;
let isErasing = false;
let eraserUndoSnapshot = null;
let eraserRemovedTotal = 0;
let eraserPreviewPointer = null;
let eraserLastPoint = null;
let editPointerId = null;
let editBackgroundColor = null;
let compressionEstimateTimer = null;
let compressionPreviewUrl = null;
let compressionPreviewBlob = null;
let isCompressionPanelExpanded = false;
let gifDecoderModulePromise = null;
let gifEncoderModulePromise = null;

initializeRemoveBgModelOptions();
initializeUpscaleProviderOptions();

els.toleranceRange.addEventListener("input", () => {
  els.toleranceOutput.value = els.toleranceRange.value;
});

els.compressQualityRange.addEventListener("input", () => {
  els.compressQualityOutput.value = els.compressQualityRange.value;
  scheduleCompressionEstimate();
});
document.querySelectorAll('input[name="compressQualityMode"]').forEach((input) => {
  input.addEventListener("change", () => {
    updateCompressionQualityControls();
    scheduleCompressionEstimate();
  });
});
els.compressFileInput.addEventListener("change", (event) => {
  setCompressionFiles([...event.target.files]);
  els.compressFileInput.value = "";
});
els.compressFormatSelect.addEventListener("change", scheduleCompressionEstimate);
els.compressButton.addEventListener("click", compressSelectedFiles);
els.compressDownloadButton.addEventListener("click", downloadCompressedFiles);
els.compressPreviewCard.addEventListener("click", openCompressionPreview);
els.compressToggleButton.addEventListener("click", toggleCompressionPanel);
els.modelSelect.addEventListener("change", () => {
  updateApiControls();
  updateUi();
});
els.upscaleProviderSelect.addEventListener("change", updateUi);
document.querySelectorAll('input[name="mode"]').forEach((input) => {
  input.addEventListener("change", () => {
    updateOptionVisibility();
    updateApiControls();
    updateUi();
  });
});
[els.pixianApiIdInput, els.pixianApiSecretInput].forEach((input) => {
  input.addEventListener("input", () => {
    savePixianCredentials();
    clearPixianCreditStatus();
    updateUi();
  });
});
els.pixianCheckCreditsButton.addEventListener("click", checkPixianCredits);
els.koukoutuApiKeyInput.addEventListener("input", () => {
  saveKoukoutuCredentials();
  clearKoukoutuCreditStatus();
  updateUi();
});
els.koukoutuCheckCreditsButton.addEventListener("click", checkKoukoutuCredits);
loadPixianCredentials();
loadKoukoutuCredentials();
updateOptionVisibility();
updateApiControls();
setCompressionPanelExpanded(false);
updateCompressionQualityControls();

els.fileInput.addEventListener("change", (event) => {
  addFiles([...event.target.files]);
  els.fileInput.value = "";
});
els.uploadMoreButton.addEventListener("click", () => {
  els.fileInput.click();
});

["dragenter", "dragover"].forEach((name) => {
  els.mainWorkspace.addEventListener(name, (event) => {
    event.preventDefault();
    setWorkspaceDragging(true);
  });
});

els.mainWorkspace.addEventListener("dragleave", (event) => {
  event.preventDefault();
  if (!els.mainWorkspace.contains(event.relatedTarget)) setWorkspaceDragging(false);
});

els.mainWorkspace.addEventListener("drop", (event) => {
  event.preventDefault();
  setWorkspaceDragging(false);
  addFiles([...event.dataTransfer.files].filter((file) => file.type.startsWith("image/")));
});

els.processButton.addEventListener("click", processQueue);
els.downloadButton.addEventListener("click", downloadAll);
els.clearButton.addEventListener("click", clearQueue);
els.previewCloseButton.addEventListener("click", () => els.previewModal.close());
els.previewDownloadButton.addEventListener("click", () => {
  if (previewItem?.blob) downloadBlob(previewItem.blob, previewItem.outputName);
});
els.previewCropButton.addEventListener("click", startPreviewCrop);
els.previewCancelCropButton.addEventListener("click", stopPreviewCrop);
els.previewApplyCropButton.addEventListener("click", applyPreviewCrop);
els.previewCropOverlay.addEventListener("pointerdown", startPreviewCropDrag);
document.addEventListener("pointermove", movePreviewCropDrag);
document.addEventListener("pointerup", endPreviewCropDrag);
els.previewModal.addEventListener("click", (event) => {
  if (event.target === els.previewModal) els.previewModal.close();
});
els.previewModal.addEventListener("close", clearPreviewModal);
els.editToleranceRange.addEventListener("input", () => {
  els.editToleranceOutput.value = els.editToleranceRange.value;
});
els.editEdgeRange.addEventListener("input", () => {
  els.editEdgeOutput.value = els.editEdgeRange.value;
});
els.eraserSizeRange.addEventListener("input", () => {
  els.eraserSizeOutput.value = els.eraserSizeRange.value;
  updateEraserBrushPreview();
});
els.editFillColorInput.addEventListener("input", () => {
  els.editFillColorText.textContent = els.editFillColorInput.value;
});
document.querySelectorAll('input[name="editTool"]').forEach((input) => {
  input.addEventListener("change", () => {
    setEditTool(input.value);
  });
});
els.editCloseButton.addEventListener("click", () => els.editModal.close());
els.editUndoButton.addEventListener("click", undoEditStep);
els.editApplyButton.addEventListener("click", applyEditResult);
els.fillBackgroundButton.addEventListener("click", fillEditBackgroundColor);
els.clearBackgroundButton.addEventListener("click", clearEditBackgroundColor);
els.invertSelectionButton.addEventListener("click", toggleSelectionInvert);
els.finishPenButton.addEventListener("click", applyPenErase);
els.clearPenButton.addEventListener("click", clearPenPath);
els.editCanvasWrap.addEventListener("wheel", handleEditWheel, { passive: false });
els.editCanvasWrap.addEventListener("pointerdown", startEditPointer);
els.editCanvasWrap.addEventListener("pointermove", moveEditPointer);
els.editCanvasWrap.addEventListener("pointerup", endEditPointer);
els.editCanvasWrap.addEventListener("pointercancel", cancelEditPointer);
els.editCanvasWrap.addEventListener("pointerenter", updateEraserBrushPreview);
els.editCanvasWrap.addEventListener("pointerleave", handleEditPointerLeave);
els.editCanvasWrap.addEventListener("keydown", handleEditKeydown);
document.addEventListener("keydown", handleEditUndoShortcut);
document.addEventListener("keydown", handleEditorDeleteKeydown, true);
window.addEventListener("resize", () => {
  if (els.editModal.open) fitEditCanvasToView();
});
els.editModal.addEventListener("click", (event) => {
  if (event.target === els.editModal) els.editModal.close();
});
els.editModal.addEventListener("close", clearEditModal);

els.checkerToggle.addEventListener("change", () => {
  state.items.forEach((item) => {
    item.card.querySelector(".processed-figure").classList.toggle("checker", els.checkerToggle.checked);
  });
});

function setCompressionFiles(files) {
  compressorState.files = files.filter((file) => file.type.startsWith("image/") || /\.gif$/i.test(file.name));
  compressorState.results = [];
  compressorState.estimates = {};
  compressorState.estimateRunId += 1;
  if (compressorState.files.some(isGifFile)) els.compressFormatSelect.value = "image/gif";
  clearCompressionPreviewCard();
  updateCompressionUi();
  scheduleCompressionEstimate();
}

async function compressSelectedFiles() {
  if (!compressorState.files.length || compressorState.isProcessing) return;
  compressorState.isProcessing = true;
  compressorState.results = [];
  updateCompressionUi("压缩中...");

  for (const file of compressorState.files) {
    try {
      const result = await compressImageFile(file);
      compressorState.results.push(result);
    } catch (error) {
      compressorState.results.push({
        file,
        error: error?.message || "压缩失败",
      });
    }
    updateCompressionUi("压缩中...");
  }

  compressorState.isProcessing = false;
  updateCompressionUi();
}

async function compressImageFile(file) {
  const quality = getSelectedCompressionQuality();
  const mimeType = getCompressionMime(file, els.compressFormatSelect.value);
  const compressed = await compressFileToMime(file, mimeType, quality);
  const outputName = `${fileBaseName(file.name)}-compressed.${extensionForMime(compressed.mimeType, file.name)}`;

  return {
    file,
    blob: compressed.blob,
    outputName,
    width: compressed.width,
    height: compressed.height,
  };
}

async function compressFileToMime(file, mimeType, quality) {
  if (mimeType === "image/gif" && isGifFile(file)) return compressAnimatedGifFile(file, quality);

  const canvas = await fileToCanvas(file);
  const compressed =
    mimeType === "image/gif"
      ? canvasToGifResult(canvas)
      : await getSmallestCompressionResult(canvas, file, mimeType, quality);

  return {
    blob: compressed.blob,
    mimeType: compressed.mimeType,
    width: canvas.width,
    height: canvas.height,
  };
}

async function fileToCanvas(file) {
  try {
    return bitmapToCanvas(await createImageBitmap(file));
  } catch (error) {
    return imageElementToCanvas(file);
  }
}

function bitmapToCanvas(bitmap) {
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return canvas;
}

function imageElementToCanvas(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext("2d").drawImage(image, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片读取失败"));
    };
    image.src = url;
  });
}

function resizeCanvasToMaxEdge(canvas, maxEdge) {
  if (!maxEdge || Math.max(canvas.width, canvas.height) <= maxEdge) return canvas;
  const scale = maxEdge / Math.max(canvas.width, canvas.height);
  const output = document.createElement("canvas");
  output.width = Math.max(1, Math.round(canvas.width * scale));
  output.height = Math.max(1, Math.round(canvas.height * scale));
  const ctx = output.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, output.width, output.height);
  return output;
}

function getCompressionMime(file, selectedFormat) {
  if (isGifFile(file)) return "image/gif";
  return selectedFormat || "image/png";
}

function isGifFile(file) {
  return file.type === "image/gif" || /\.gif$/i.test(file.name);
}

function extensionForMime(mimeType) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/gif") return "gif";
  return "webp";
}

function fileBaseName(name) {
  return name.replace(/\.[^.]+$/, "") || "image";
}

function getSelectedCompressionQualityMode() {
  return document.querySelector('input[name="compressQualityMode"]:checked')?.value || "high";
}

function getSelectedCompressionQuality() {
  const mode = getSelectedCompressionQualityMode();
  return getCompressionQualityForMode(mode);
}

function getCompressionQualityForMode(mode) {
  if (mode === "custom") return Number(els.compressQualityRange.value) / 100;
  return COMPRESSION_QUALITY_PRESETS[mode] ?? COMPRESSION_QUALITY_PRESETS.high;
}

function updateCompressionQualityControls() {
  const isCustom = getSelectedCompressionQualityMode() === "custom";
  els.compressCustomQuality.hidden = !isCustom;
  els.compressQualityRange.disabled = !isCustom;
  els.compressQualityOutput.value = els.compressQualityRange.value;
}

function scheduleCompressionEstimate() {
  clearTimeout(compressionEstimateTimer);
  compressorState.estimates = {};
  updateCompressionQualitySizeLabels();
  compressionEstimateTimer = setTimeout(estimateCompressionSizes, 180);
}

async function estimateCompressionSizes() {
  const files = [...compressorState.files];
  const runId = ++compressorState.estimateRunId;

  if (!files.length) {
    compressorState.isEstimating = false;
    compressorState.estimates = {};
    updateCompressionQualitySizeLabels();
    return;
  }

  compressorState.isEstimating = true;
  updateCompressionQualitySizeLabels();

  const modes = ["high", "low", "custom"];
  const totals = Object.fromEntries(modes.map((mode) => [mode, 0]));

  try {
    for (const file of files) {
      const mimeType = getCompressionMime(file, els.compressFormatSelect.value);
      const canvas = mimeType === "image/gif" && isGifFile(file) ? null : await fileToCanvas(file);

      for (const mode of modes) {
        if (mimeType === "image/gif" && isGifFile(file)) {
          totals[mode] += estimateAnimatedGifSize(file, getCompressionQualityForMode(mode));
        } else {
          const compressed =
            mimeType === "image/gif"
              ? canvasToGifResult(canvas)
              : await getSmallestCompressionResult(canvas, file, mimeType, getCompressionQualityForMode(mode));
          totals[mode] += compressed.blob.size;
        }
      }

      if (runId !== compressorState.estimateRunId) return;
    }

    if (runId !== compressorState.estimateRunId) return;
    compressorState.estimates = totals;
  } catch (error) {
    if (runId === compressorState.estimateRunId) compressorState.estimates = {};
  } finally {
    if (runId === compressorState.estimateRunId) {
      compressorState.isEstimating = false;
      updateCompressionQualitySizeLabels();
    }
  }
}

async function getSmallestCompressionResult(canvas, file, preferredMimeType, quality) {
  const hasTransparency = canvasHasTransparency(canvas);
  const candidates = [...new Set([preferredMimeType, ...COMPRESSION_FALLBACK_MIMES])].filter(
    (mimeType) => mimeType !== "image/jpeg" || !hasTransparency,
  );
  const encoded = [];

  for (const mimeType of candidates) {
    try {
      const blob = await canvasToBlob(canvas, mimeType, quality);
      encoded.push({ blob, mimeType: blob.type || mimeType });
    } catch (error) {
      // Some browsers may not support every export format.
    }
  }

  const smallerResults = encoded.filter((result) => result.blob.size < file.size);
  const bestEncoded = getSmallestBlobResult(smallerResults.length ? smallerResults : encoded);
  if (bestEncoded && bestEncoded.blob.size < file.size) return bestEncoded;

  return {
    blob: file,
    mimeType: getOriginalMime(file),
  };
}

function getSmallestBlobResult(results) {
  return results.reduce((best, result) => {
    if (!best || result.blob.size < best.blob.size) return result;
    return best;
  }, null);
}

function getOriginalMime(file) {
  return file.type?.startsWith("image/") ? file.type : "image/png";
}

async function compressAnimatedGifFile(file, quality) {
  const timing = await readGifTiming(file);

  if (timing.frameCount <= 1) {
    const canvas = await fileToCanvas(file);
    const result = canvasToGifResult(canvas);
    return {
      blob: result.blob.size < file.size ? result.blob : file,
      mimeType: "image/gif",
      width: canvas.width,
      height: canvas.height,
    };
  }

  let best = null;
  const attempts = getGifCompressionAttempts(quality, timing);

  for (const options of attempts) {
    try {
      const rendered = await renderGifFrames(file, null, quality, options);
      const blob = await encodeGifFrames(rendered, options.colors);
      const result = {
        blob,
        mimeType: "image/gif",
        width: rendered.width,
        height: rendered.height,
      };

      if (!best || blob.size < best.blob.size) best = result;
      if (blob.size < file.size) return result;
    } catch (error) {
      console.warn(error);
    }
  }

  return (
    best || {
      blob: file,
      mimeType: "image/gif",
      width: timing.width || 0,
      height: timing.height || 0,
    }
  );
}

function estimateAnimatedGifSize(file, quality) {
  const ratio = clampNumber(0.32 + quality * 0.4, 0.48, 0.86);
  return Math.max(1024, Math.round(file.size * ratio));
}

async function readGifTiming(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length < 13 || asciiFromBytes(bytes, 0, 3) !== "GIF") {
    return { frameCount: 1, totalDurationMs: 100 };
  }

  const width = bytes[6] | (bytes[7] << 8);
  const height = bytes[8] | (bytes[9] << 8);
  let offset = 13;
  const globalColorTableSize = bytes[10] & 0x80 ? 3 * (1 << ((bytes[10] & 0x07) + 1)) : 0;
  offset += globalColorTableSize;

  let frameCount = 0;
  let totalDelayCs = 0;
  let pendingDelayCs = 10;

  while (offset < bytes.length) {
    const marker = bytes[offset];
    offset += 1;

    if (marker === 0x3b) break;

    if (marker === 0x21) {
      const label = bytes[offset];
      offset += 1;

      if (label === 0xf9 && bytes[offset] === 0x04) {
        pendingDelayCs = bytes[offset + 2] | (bytes[offset + 3] << 8);
        if (!pendingDelayCs) pendingDelayCs = 10;
        offset += 6;
      } else {
        offset = skipGifSubBlocks(bytes, offset);
      }
      continue;
    }

    if (marker === 0x2c) {
      if (offset + 9 > bytes.length) break;
      const packed = bytes[offset + 8];
      offset += 9;
      if (packed & 0x80) offset += 3 * (1 << ((packed & 0x07) + 1));
      offset += 1;
      offset = skipGifSubBlocks(bytes, offset);
      frameCount += 1;
      totalDelayCs += pendingDelayCs || 10;
      pendingDelayCs = 10;
      continue;
    }

    break;
  }

  return {
    frameCount: Math.max(1, frameCount),
    totalDurationMs: Math.max(100, totalDelayCs * 10),
    width,
    height,
  };
}

function skipGifSubBlocks(bytes, offset) {
  while (offset < bytes.length) {
    const length = bytes[offset];
    offset += 1;
    if (!length) break;
    offset += length;
  }
  return offset;
}

function asciiFromBytes(bytes, offset, length) {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function getGifCompressionAttempts(quality, timing = {}) {
  const baseScale = quality >= 0.85 ? 1 : quality >= 0.7 ? 0.92 : 0.84;
  const baseColors = quality >= 0.85 ? 128 : quality >= 0.7 ? 96 : 64;
  const frameCount = timing.frameCount || 1;

  return [
    { colors: baseColors, maxFrames: quality >= 0.85 ? 100 : 76, scale: baseScale },
    { colors: Math.min(baseColors, 80), maxFrames: 64, scale: Math.min(baseScale, 0.86) },
    { colors: 48, maxFrames: 48, scale: 0.78 },
    { colors: 32, maxFrames: 36, scale: 0.68 },
  ].map((attempt) => ({
    ...attempt,
    step: Math.max(1, Math.ceil(frameCount / attempt.maxFrames)),
  }));
}

async function renderGifFrames(file, cropRect = null, quality = getSelectedCompressionQuality(), options = {}) {
  const { parseGIF, decompressFrames } = await loadGifDecoderModule();
  const bytes = await file.arrayBuffer();
  const gif = parseGIF(bytes);
  const decodedFrames = decompressFrames(gif, true);
  if (!decodedFrames.length) throw new Error("GIF 动图帧读取失败");

  const timing = await readGifTiming(file);
  const sourceWidth =
    gif?.lsd?.width || timing.width || Math.max(...decodedFrames.map((frame) => frame.dims.left + frame.dims.width));
  const sourceHeight =
    gif?.lsd?.height || timing.height || Math.max(...decodedFrames.map((frame) => frame.dims.top + frame.dims.height));

  const crop = cropRect ? clampCropRect(cropRect, sourceWidth, sourceHeight) : { x: 0, y: 0, width: sourceWidth, height: sourceHeight };
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = sourceWidth;
  sourceCanvas.height = sourceHeight;
  const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  const outputCanvas = document.createElement("canvas");
  const scale = options.scale || 1;
  outputCanvas.width = Math.max(1, Math.round(crop.width * scale));
  outputCanvas.height = Math.max(1, Math.round(crop.height * scale));
  const outputCtx = outputCanvas.getContext("2d", { willReadFrequently: true });
  const patchCanvas = document.createElement("canvas");
  const patchCtx = patchCanvas.getContext("2d", { willReadFrequently: true });
  const step = options.step || getDecodedGifFramePlan(decodedFrames.length, quality).step;
  const frames = [];
  const delays = [];
  let restoreSnapshot = null;

  decodedFrames.forEach((frame, index) => {
    if (frame.disposalType === 3) {
      restoreSnapshot = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    }

    patchCanvas.width = frame.dims.width;
    patchCanvas.height = frame.dims.height;
    const patch = new ImageData(frame.patch, frame.dims.width, frame.dims.height);
    patchCtx.putImageData(patch, 0, 0);
    sourceCtx.drawImage(patchCanvas, frame.dims.left, frame.dims.top);

    if (index % step === 0 || index === decodedFrames.length - 1) {
      outputCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
      outputCtx.drawImage(sourceCanvas, crop.x, crop.y, crop.width, crop.height, 0, 0, outputCanvas.width, outputCanvas.height);
      frames.push(canvasToRgbaFrame(outputCanvas));
      delays.push(Math.max(2, Math.round((frame.delay || 100) / 10)));
    } else if (delays.length) {
      delays[delays.length - 1] += Math.max(2, Math.round((frame.delay || 100) / 10));
    }

    if (frame.disposalType === 2) {
      sourceCtx.clearRect(frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height);
    } else if (frame.disposalType === 3 && restoreSnapshot) {
      sourceCtx.putImageData(restoreSnapshot, 0, 0);
      restoreSnapshot = null;
    }
  });

  return {
    width: outputCanvas.width,
    height: outputCanvas.height,
    frames,
    delays,
  };
}

function canvasToRgbaFrame(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  return new Uint8Array(data);
}

async function encodeGifFrames(rendered, colorCount) {
  const { GIFEncoder, quantize, applyPalette } = await loadGifEncoderModule();
  const encoder = GIFEncoder();

  rendered.frames.forEach((rgba, index) => {
    const palette = quantize(rgba, colorCount, {
      format: "rgba4444",
      clearAlpha: true,
      clearAlphaThreshold: 96,
      oneBitAlpha: 127,
    });
    const indexed = applyPalette(rgba, palette, "rgba4444");
    const transparentIndex = palette.findIndex((color) => color[3] === 0);

    encoder.writeFrame(indexed, rendered.width, rendered.height, {
      palette,
      delay: Math.max(20, (rendered.delays[index] || 10) * 10),
      repeat: 0,
      dispose: 2,
      transparent: transparentIndex >= 0,
      transparentIndex: transparentIndex >= 0 ? transparentIndex : 0,
    });
  });

  encoder.finish();
  return new Blob([encoder.bytes()], { type: "image/gif" });
}

async function loadGifDecoderModule() {
  if (!gifDecoderModulePromise) gifDecoderModulePromise = import(GIF_DECODER_MODULE_URL);
  return gifDecoderModulePromise;
}

async function loadGifEncoderModule() {
  if (!gifEncoderModulePromise) {
    gifEncoderModulePromise = import(GIF_ENCODER_MODULE_URL).then((module) => {
      const lib = module.default || module;
      return {
        GIFEncoder: lib.GIFEncoder || module.GIFEncoder,
        quantize: lib.quantize || module.quantize,
        applyPalette: lib.applyPalette || module.applyPalette,
      };
    });
  }
  return gifEncoderModulePromise;
}

function getDecodedGifFramePlan(frameCount, quality) {
  if (frameCount <= 2) return { step: 1 };
  const maxFrames = Math.round(18 + quality * 60);
  return {
    step: Math.max(1, Math.ceil(frameCount / maxFrames)),
  };
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      image.release = () => URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("GIF 动图读取失败"));
    };
    image.src = url;
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function canvasToGifResult(canvas) {
  return {
    blob: canvasToGifBlob(canvas),
    mimeType: "image/gif",
  };
}

function canvasToGifBlob(canvas) {
  const { width, height } = canvas;
  const frame = canvasToGifFrame(canvas);
  return animatedGifBlob(width, height, [frame], 0);
}

function canvasToGifFrame(canvas) {
  const { width, height } = canvas;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const rgba = ctx.getImageData(0, 0, width, height).data;
  const indexedPixels = new Uint8Array(width * height);
  let hasTransparency = false;

  for (let source = 0, target = 0; source < rgba.length; source += 4, target += 1) {
    const alpha = rgba[source + 3];
    if (alpha < 128) {
      indexedPixels[target] = 0;
      hasTransparency = true;
      continue;
    }

    indexedPixels[target] = quantizeGifColor(rgba[source], rgba[source + 1], rgba[source + 2]);
  }

  return { indexedPixels, hasTransparency };
}

function animatedGifBlob(width, height, frames, delayCs) {
  const palette = buildGifPalette();
  const parts = [
    asciiBytes("GIF89a"),
    wordBytes(width),
    wordBytes(height),
    new Uint8Array([0xf7, 0x00, 0x00]),
    palette,
  ];

  if (frames.length > 1) {
    parts.push(
      new Uint8Array([0x21, 0xff, 0x0b]),
      asciiBytes("NETSCAPE2.0"),
      new Uint8Array([0x03, 0x01, 0x00, 0x00, 0x00]),
    );
  }

  frames.forEach((frame, index) => {
    const lzwData = encodeGifLzw(frame.indexedPixels, 8);
    const frameDelay = Array.isArray(delayCs) ? delayCs[index] ?? delayCs[delayCs.length - 1] ?? 10 : delayCs;
    parts.push(
      new Uint8Array([0x21, 0xf9, 0x04, frame.hasTransparency ? 0x01 : 0x00]),
      wordBytes(frameDelay),
      new Uint8Array([0x00, 0x00]),
      new Uint8Array([0x2c]),
      wordBytes(0),
      wordBytes(0),
      wordBytes(width),
      wordBytes(height),
      new Uint8Array([0x00, 0x08]),
      gifSubBlocks(lzwData),
    );
  });

  parts.push(new Uint8Array([0x3b]));

  return new Blob(parts, { type: "image/gif" });
}

function buildGifPalette() {
  const palette = new Uint8Array(256 * 3);
  let offset = 3;

  for (let r = 0; r < 6; r += 1) {
    for (let g = 0; g < 7; g += 1) {
      for (let b = 0; b < 6; b += 1) {
        palette[offset] = Math.round((r / 5) * 255);
        palette[offset + 1] = Math.round((g / 6) * 255);
        palette[offset + 2] = Math.round((b / 5) * 255);
        offset += 3;
      }
    }
  }

  return palette;
}

function quantizeGifColor(red, green, blue) {
  const r = Math.round((red / 255) * 5);
  const g = Math.round((green / 255) * 6);
  const b = Math.round((blue / 255) * 5);
  return 1 + r * 42 + g * 6 + b;
}

function encodeGifLzw(indices, minCodeSize) {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  let nextCode = endCode + 1;
  let codeSize = minCodeSize + 1;
  let prefix = "";
  const dictionary = new Map();
  const bytes = [];
  let bitBuffer = 0;
  let bitCount = 0;

  const resetDictionary = () => {
    dictionary.clear();
    for (let i = 0; i < clearCode; i += 1) dictionary.set(String(i), i);
    nextCode = endCode + 1;
    codeSize = minCodeSize + 1;
  };
  const writeCode = (code) => {
    bitBuffer |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      bytes.push(bitBuffer & 0xff);
      bitBuffer >>= 8;
      bitCount -= 8;
    }
  };

  resetDictionary();
  writeCode(clearCode);

  for (const value of indices) {
    const current = String(value);
    const combined = prefix ? `${prefix},${current}` : current;

    if (dictionary.has(combined)) {
      prefix = combined;
      continue;
    }

    writeCode(dictionary.get(prefix));

    if (nextCode < 4096) {
      dictionary.set(combined, nextCode);
      nextCode += 1;
      if (nextCode === 1 << codeSize && codeSize < 12) codeSize += 1;
    } else {
      writeCode(clearCode);
      resetDictionary();
    }

    prefix = current;
  }

  if (prefix) writeCode(dictionary.get(prefix));
  writeCode(endCode);
  if (bitCount > 0) bytes.push(bitBuffer & 0xff);
  return new Uint8Array(bytes);
}

function gifSubBlocks(bytes) {
  const blocks = [];

  for (let offset = 0; offset < bytes.length; offset += 255) {
    const chunk = bytes.slice(offset, offset + 255);
    blocks.push(chunk.length, ...chunk);
  }

  blocks.push(0);
  return new Uint8Array(blocks);
}

function asciiBytes(text) {
  return new Uint8Array([...text].map((char) => char.charCodeAt(0)));
}

function wordBytes(value) {
  return new Uint8Array([value & 0xff, (value >> 8) & 0xff]);
}

function canvasHasTransparency(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const stride = Math.max(1, Math.ceil(Math.sqrt((canvas.width * canvas.height) / 60000)));

  try {
    for (let y = 0; y < canvas.height; y += stride) {
      const row = ctx.getImageData(0, y, canvas.width, 1).data;
      for (let x = 3; x < row.length; x += stride * 4) {
        if (row[x] < 255) return true;
      }
    }
  } catch (error) {
    return true;
  }

  return false;
}

function updateCompressionQualitySizeLabels() {
  els.compressQualitySizes.forEach((label) => {
    const mode = label.dataset.qualitySize;
    const estimate = compressorState.estimates[mode];

    if (!compressorState.files.length) {
      label.textContent = "-- KB";
    } else if (compressorState.isEstimating) {
      label.textContent = "估算中";
    } else if (estimate) {
      label.textContent = `约 ${formatBytes(estimate)}`;
    } else {
      label.textContent = "-- KB";
    }
  });
}

function toggleCompressionPanel() {
  if (isCompressionPanelExpanded && compressorState.isProcessing) return;
  setCompressionPanelExpanded(!isCompressionPanelExpanded);
}

function setCompressionPanelExpanded(expanded) {
  isCompressionPanelExpanded = expanded;
  const panel = els.compressToggleButton.closest(".compress-panel");
  panel.classList.toggle("is-collapsed", !expanded);
  panel.classList.toggle("is-expanded", expanded);
  els.compressBody.hidden = !expanded;
  els.compressToggleButton.setAttribute("aria-expanded", String(expanded));
}

function updateCompressionUi(statusText = "") {
  const successful = compressorState.results.filter((result) => result.blob);
  const failed = compressorState.results.filter((result) => result.error);
  const selectedText = compressorState.files.length ? `${compressorState.files.length} 个文件` : "待选择";

  els.compressStatus.textContent =
    statusText ||
    (compressorState.results.length
      ? `${successful.length} 个完成${failed.length ? `，${failed.length} 个失败` : ""}`
      : selectedText);
  els.compressButton.disabled = !compressorState.files.length || compressorState.isProcessing;
  els.compressDownloadButton.disabled = !successful.length || compressorState.isProcessing;

  updateCompressionPreviewCard(successful);
  updateCompressionQualitySizeLabels();
}

function updateCompressionPreviewCard(successfulResults) {
  const result = successfulResults[0];
  if (!result) {
    clearCompressionPreviewUrl();
    return;
  }

  if (compressionPreviewBlob !== result.blob) {
    if (compressionPreviewUrl) URL.revokeObjectURL(compressionPreviewUrl);
    compressionPreviewUrl = URL.createObjectURL(result.blob);
    compressionPreviewBlob = result.blob;
    els.compressPreviewImage.src = compressionPreviewUrl;
  }
}

function clearCompressionPreviewCard() {
  clearCompressionPreviewUrl();
  els.compressPreviewImage.removeAttribute("src");
}

function clearCompressionPreviewUrl() {
  if (compressionPreviewUrl) {
    URL.revokeObjectURL(compressionPreviewUrl);
    compressionPreviewUrl = null;
  }
  compressionPreviewBlob = null;
  els.compressPreviewImage.removeAttribute("src");
}

function openCompressionPreview() {
  const result = compressorState.results.find((item) => item.blob);
  if (result) openPreview(result, { mode: "compress" });
}

async function downloadCompressedFiles() {
  const ready = compressorState.results.filter((result) => result.blob);
  if (!ready.length) return;
  if (ready.length === 1) {
    downloadBlob(ready[0].blob, ready[0].outputName);
    return;
  }
  const zipBlob = await createZip(
    ready.map((result) => ({
      name: result.outputName,
      blob: result.blob,
    })),
  );
  downloadBlob(zipBlob, `compressed-images-${dateStamp()}.zip`);
}

async function addFiles(files) {
  const imageFiles = files.filter((file) => file.type.startsWith("image/"));
  for (const file of imageFiles) {
    try {
      const url = URL.createObjectURL(file);
      const bitmap = await createImageBitmap(file);
      const item = createItem(file, url, bitmap);
      state.items.push(item);
      els.imageGrid.append(item.card);
    } catch (error) {
      console.error(error);
    }
  }
  updateUi();
}

function createItem(file, url, bitmap) {
  const fragment = els.template.content.cloneNode(true);
  const card = fragment.querySelector(".image-card");
  const original = fragment.querySelector(".original-preview");
  const resultCanvas = fragment.querySelector(".result-canvas");
  const status = fragment.querySelector(".card-status");
  const deleteButton = fragment.querySelector(".delete-button");
  const editButton = fragment.querySelector(".edit-button");
  const downloadButton = fragment.querySelector(".download-button");

  original.src = url;
  original.alt = file.name;
  resultCanvas.width = 1;
  resultCanvas.height = 1;
  resultCanvas.title = "处理完成后点击放大预览";
  fragment.querySelector(".file-name").textContent = file.name;
  fragment.querySelector(".file-meta").textContent = `${bitmap.width} x ${bitmap.height} · ${formatBytes(file.size)}`;
  fragment.querySelector(".processed-figure").classList.toggle("checker", els.checkerToggle.checked);

  const item = {
    id: crypto.randomUUID(),
    file,
    url,
    bitmap,
    card,
    original,
    resultCanvas,
    status,
    deleteButton,
    editButton,
    downloadButton,
    blob: null,
    editorSubjectCanvas: null,
    editorBackgroundColor: null,
    outputName: makeOutputName(file.name),
  };

  deleteButton.addEventListener("click", () => removeQueueItem(item));
  downloadButton.addEventListener("click", () => {
    if (item.blob) downloadBlob(item.blob, item.outputName);
  });
  editButton.addEventListener("click", () => openEditor(item));
  resultCanvas.addEventListener("click", () => openPreview(item, { mode: "result" }));
  resultCanvas.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPreview(item, { mode: "result" });
    }
  });

  return item;
}

async function processQueue() {
  if (!state.items.length || state.isProcessing) return;
  if (els.previewModal.open) els.previewModal.close();
  if (els.editModal.open) els.editModal.close();
  state.isProcessing = true;
  for (const item of state.items) {
    item.blob = null;
    item.editorSubjectCanvas = null;
    item.editorBackgroundColor = null;
    item.deleteButton.disabled = true;
    item.editButton.disabled = true;
    item.downloadButton.disabled = true;
    resetResultCanvas(item);
    setCardStatus(item, "等待处理", "");
  }
  updateUi();

  const options = readOptions();
  let done = 0;
  for (const item of state.items) {
    setCardStatus(item, getTaskWorkingStatusText(options), "is-working");
    try {
      await nextFrame();
      const outputCanvas = await processItem(item, options);
      copyCanvas(outputCanvas, item.resultCanvas);
      item.blob = await canvasToBlob(outputCanvas);
      item.deleteButton.disabled = false;
      item.editButton.disabled = false;
      item.downloadButton.disabled = false;
      item.resultCanvas.classList.add("is-previewable");
      setCardStatus(item, getTaskDoneStatusText(options), "is-done");
    } catch (error) {
      if (isExpectedProcessingError(error)) {
        console.warn(error.message);
      } else {
        console.error(error);
      }
      resetResultCanvas(item);
      setCardStatus(item, getTaskFailureStatusText(options, error), "is-error");
    }
    done += 1;
    updateProgress(done, state.items.length);
  }

  state.isProcessing = false;
  updateUi();
}

function openPreview(item, { mode = item.resultCanvas ? "result" : "compress" } = {}) {
  if (!item.blob) return;
  clearPreviewModal();
  previewItem = item;
  previewMode = mode;
  previewUrl = URL.createObjectURL(item.blob);
  const width = item.resultCanvas?.width ?? item.width ?? 0;
  const height = item.resultCanvas?.height ?? item.height ?? 0;
  const isCompressionPreview = mode === "compress";
  els.previewImage.src = previewUrl;
  els.previewTitle.textContent = item.outputName;
  els.previewMeta.textContent = isCompressionPreview
    ? `压缩后大小：${formatBytes(item.blob.size)}`
    : `${width} x ${height} · ${formatBytes(item.blob.size)}`;
  setPreviewCropControls(isCompressionPreview);
  if (typeof els.previewModal.showModal === "function") {
    els.previewModal.showModal();
  } else {
    els.previewModal.setAttribute("open", "");
  }
}

function clearPreviewModal() {
  stopPreviewCrop();
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }
  previewItem = null;
  previewMode = "result";
  setPreviewCropControls(false);
  els.previewImage.removeAttribute("src");
}

function setPreviewCropControls(canCrop) {
  els.previewCropActions.hidden = !canCrop;
  els.previewCropButton.hidden = !canCrop;
  els.previewApplyCropButton.hidden = true;
  els.previewCancelCropButton.hidden = true;
  els.previewCropOverlay.hidden = true;
  isPreviewCropping = false;
  previewCropRect = null;
  previewCropBounds = null;
  previewCropDrag = null;
}

async function startPreviewCrop() {
  if (!previewItem || previewMode !== "compress") return;
  await waitForPreviewImage();
  updatePreviewCropBounds();
  if (!previewCropBounds?.width || !previewCropBounds?.height) return;

  const marginX = Math.round(previewCropBounds.width * 0.08);
  const marginY = Math.round(previewCropBounds.height * 0.08);
  previewCropRect = {
    x: marginX,
    y: marginY,
    width: Math.max(40, previewCropBounds.width - marginX * 2),
    height: Math.max(40, previewCropBounds.height - marginY * 2),
  };
  isPreviewCropping = true;
  els.previewCropButton.hidden = true;
  els.previewApplyCropButton.hidden = false;
  els.previewCancelCropButton.hidden = false;
  els.previewCropOverlay.hidden = false;
  renderPreviewCropOverlay();
}

function stopPreviewCrop() {
  isPreviewCropping = false;
  previewCropRect = null;
  previewCropBounds = null;
  previewCropDrag = null;
  els.previewCropOverlay.hidden = true;
  const canCrop = previewMode === "compress" && Boolean(previewItem);
  els.previewCropActions.hidden = !canCrop;
  els.previewCropButton.hidden = !canCrop;
  els.previewApplyCropButton.hidden = true;
  els.previewCancelCropButton.hidden = true;
}

function waitForPreviewImage() {
  if (els.previewImage.complete && els.previewImage.naturalWidth) return Promise.resolve();
  return new Promise((resolve, reject) => {
    els.previewImage.onload = () => resolve();
    els.previewImage.onerror = () => reject(new Error("预览图片读取失败"));
  });
}

function updatePreviewCropBounds() {
  const image = els.previewImage;
  previewCropBounds = {
    x: image.offsetLeft,
    y: image.offsetTop,
    width: image.clientWidth,
    height: image.clientHeight,
  };
}

function renderPreviewCropOverlay() {
  if (!previewCropRect || !previewCropBounds) return;
  els.previewCropOverlay.style.left = `${previewCropBounds.x + previewCropRect.x}px`;
  els.previewCropOverlay.style.top = `${previewCropBounds.y + previewCropRect.y}px`;
  els.previewCropOverlay.style.width = `${previewCropRect.width}px`;
  els.previewCropOverlay.style.height = `${previewCropRect.height}px`;
}

function startPreviewCropDrag(event) {
  if (!isPreviewCropping || !previewCropRect) return;
  event.preventDefault();
  event.stopPropagation();
  updatePreviewCropBounds();
  previewCropDrag = {
    handle: event.target.dataset.cropHandle || "move",
    startX: event.clientX,
    startY: event.clientY,
    rect: { ...previewCropRect },
  };
  els.previewCropOverlay.setPointerCapture?.(event.pointerId);
}

function movePreviewCropDrag(event) {
  if (!previewCropDrag || !previewCropBounds) return;
  event.preventDefault();
  const dx = event.clientX - previewCropDrag.startX;
  const dy = event.clientY - previewCropDrag.startY;
  previewCropRect = resizePreviewCropRect(previewCropDrag.rect, previewCropDrag.handle, dx, dy, previewCropBounds);
  renderPreviewCropOverlay();
}

function endPreviewCropDrag() {
  previewCropDrag = null;
}

function resizePreviewCropRect(startRect, handle, dx, dy, bounds) {
  const minSize = 32;
  const rect = { ...startRect };

  if (handle === "move") {
    rect.x += dx;
    rect.y += dy;
  } else {
    if (handle.includes("e")) rect.width += dx;
    if (handle.includes("s")) rect.height += dy;
    if (handle.includes("w")) {
      rect.x += dx;
      rect.width -= dx;
    }
    if (handle.includes("n")) {
      rect.y += dy;
      rect.height -= dy;
    }
  }

  if (rect.width < minSize) {
    if (handle.includes("w")) rect.x = startRect.x + startRect.width - minSize;
    rect.width = minSize;
  }
  if (rect.height < minSize) {
    if (handle.includes("n")) rect.y = startRect.y + startRect.height - minSize;
    rect.height = minSize;
  }

  rect.x = clampNumber(rect.x, 0, bounds.width - rect.width);
  rect.y = clampNumber(rect.y, 0, bounds.height - rect.height);
  rect.width = Math.min(rect.width, bounds.width - rect.x);
  rect.height = Math.min(rect.height, bounds.height - rect.y);
  return rect;
}

async function applyPreviewCrop() {
  if (previewMode !== "compress" || !previewItem || !previewCropRect || !previewCropBounds) return;
  const cropRect = getPreviewCropPixelRect();
  if (!cropRect.width || !cropRect.height) return;

  const originalText = els.previewApplyCropButton.textContent;
  els.previewApplyCropButton.disabled = true;
  els.previewApplyCropButton.textContent = "裁剪中...";

  try {
    const cropped = isGifPreviewItem(previewItem)
      ? await cropGifBlob(previewItem.blob, cropRect)
      : await cropImageBlob(previewItem.blob, cropRect);

    previewItem.blob = cropped.blob;
    previewItem.width = cropped.width;
    previewItem.height = cropped.height;
    if (cropped.mimeType) previewItem.outputName = replaceOutputExtension(previewItem.outputName, cropped.mimeType);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(previewItem.blob);
    els.previewImage.src = previewUrl;
    els.previewTitle.textContent = previewItem.outputName;
    els.previewMeta.textContent = `压缩后大小：${formatBytes(previewItem.blob.size)}`;
    updateCompressionUi();
    stopPreviewCrop();
  } catch (error) {
    console.error(error);
    els.previewMeta.textContent = "裁剪失败，请重新打开图片再试。";
  } finally {
    els.previewApplyCropButton.disabled = false;
    els.previewApplyCropButton.textContent = originalText;
  }
}

function getPreviewCropPixelRect() {
  const scaleX = (els.previewImage.naturalWidth || previewItem.width) / previewCropBounds.width;
  const scaleY = (els.previewImage.naturalHeight || previewItem.height) / previewCropBounds.height;

  return {
    x: Math.max(0, Math.round(previewCropRect.x * scaleX)),
    y: Math.max(0, Math.round(previewCropRect.y * scaleY)),
    width: Math.max(1, Math.round(previewCropRect.width * scaleX)),
    height: Math.max(1, Math.round(previewCropRect.height * scaleY)),
  };
}

function isGifPreviewItem(item) {
  return item?.blob?.type === "image/gif" || /\.gif$/i.test(item?.outputName || "");
}

async function cropImageBlob(blob, cropRect) {
  const source = await fileToCanvas(blob);
  const rect = clampCropRect(cropRect, source.width, source.height);
  const output = document.createElement("canvas");
  output.width = rect.width;
  output.height = rect.height;
  output.getContext("2d").drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
  const mimeType = blob.type === "image/jpeg" ? "image/jpeg" : "image/png";
  const croppedBlob = await canvasToBlob(output, mimeType, getSelectedCompressionQuality());

  return {
    blob: croppedBlob,
    mimeType: croppedBlob.type || mimeType,
    width: output.width,
    height: output.height,
  };
}

async function cropGifBlob(blob, cropRect) {
  const timing = await readGifTiming(blob);

  if (timing.frameCount <= 1) {
    const image = await loadImageElement(blob);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const rect = clampCropRect(cropRect, sourceWidth, sourceHeight);
    const canvas = document.createElement("canvas");
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
    image.release();
    const result = canvasToGifResult(canvas);
    return { blob: result.blob, mimeType: result.mimeType, width: canvas.width, height: canvas.height };
  }

  const rendered = await renderGifFrames(blob, cropRect, getSelectedCompressionQuality());
  return {
    blob: await encodeGifFrames(rendered, 96),
    mimeType: "image/gif",
    width: rendered.width,
    height: rendered.height,
  };
}

function replaceOutputExtension(name, mimeType) {
  return `${fileBaseName(name)}.${extensionForMime(mimeType)}`;
}

function clampCropRect(rect, width, height) {
  const x = clampNumber(rect.x, 0, Math.max(0, width - 1));
  const y = clampNumber(rect.y, 0, Math.max(0, height - 1));
  return {
    x,
    y,
    width: Math.max(1, Math.min(rect.width, width - x)),
    height: Math.max(1, Math.min(rect.height, height - y)),
  };
}

function openEditor(item) {
  if (!item.blob) return;
  if (els.previewModal.open) els.previewModal.close();

  editItem = item;
  editUndoStack = [];
  editPickCount = 0;
  penPoints = [];
  penHoverPoint = null;
  isPenPathApplied = false;
  isSelectionInverted = false;
  isErasing = false;
  eraserUndoSnapshot = null;
  eraserRemovedTotal = 0;
  eraserPreviewPointer = null;
  eraserLastPoint = null;
  editBackgroundColor = item.editorBackgroundColor || null;
  setEditTool("pick");
  els.editBackgroundCanvas.width = item.resultCanvas.width;
  els.editBackgroundCanvas.height = item.resultCanvas.height;
  els.editCanvas.width = item.resultCanvas.width;
  els.editCanvas.height = item.resultCanvas.height;
  els.editBackgroundCanvas.style.width = "";
  els.editBackgroundCanvas.style.height = "";
  els.editBackgroundCanvas.style.transform = "";
  els.editCanvas.style.width = "";
  els.editCanvas.style.height = "";
  els.editCanvas.style.transform = "";
  els.penOverlayCanvas.style.width = "";
  els.penOverlayCanvas.style.height = "";
  els.penOverlayCanvas.style.transform = "";
  const sourceCanvas = item.editorSubjectCanvas || item.resultCanvas;
  els.editCanvas.getContext("2d").drawImage(sourceCanvas, 0, 0);
  drawEditBackground();
  clearPenOverlay();
  els.editTitle.textContent = item.outputName;
  updateEditMeta();
  updateEditUndoButton();
  updatePenButtons();

  if (typeof els.editModal.showModal === "function") {
    els.editModal.showModal();
  } else {
    els.editModal.setAttribute("open", "");
  }
  requestAnimationFrame(fitEditCanvasToView);
  requestAnimationFrame(() => {
    syncPenOverlayCanvasSize();
    drawPenOverlay();
    els.editCanvasWrap.focus();
  });
}

function performEditPickAt(point) {
  if (!editItem || !point?.isInsideImage || editTool !== "pick") return;
  const x = Math.floor(point.x);
  const y = Math.floor(point.y);
  const ctx = els.editCanvas.getContext("2d", { willReadFrequently: true });
  const before = ctx.getImageData(0, 0, els.editCanvas.width, els.editCanvas.height);
  const removed = smartEraseAt(
    els.editCanvas,
    x,
    y,
    Number(els.editToleranceRange.value),
    Number(els.editEdgeRange.value),
  );
  if (!removed) return;

  editUndoStack.push(before);
  editPickCount += 1;
  updateEditMeta(removed);
  updateEditUndoButton();
}

function undoEditPick() {
  if (!editUndoStack.length) return;
  const image = editUndoStack.pop();
  const ctx = els.editCanvas.getContext("2d");
  ctx.putImageData(image, 0, 0);
  editPickCount = Math.max(0, editPickCount - 1);
  updateEditMeta();
  updateEditUndoButton();
}

function undoEditStep() {
  if (undoPenPathPoint()) return;
  undoEditPick();
}

async function applyEditResult() {
  if (!editItem) return;
  const outputCanvas = composeEditResultCanvas();
  copyCanvas(outputCanvas, editItem.resultCanvas);
  editItem.editorSubjectCanvas = cloneCanvas(els.editCanvas);
  editItem.editorBackgroundColor = editBackgroundColor;
  editItem.blob = await canvasToBlob(editItem.resultCanvas);
  editItem.resultCanvas.classList.add("is-previewable");
  editItem.downloadButton.disabled = false;
  editItem.editButton.disabled = false;
  setCardStatus(editItem, "已编辑", "is-done");
  els.editModal.close();
}

function clearEditModal() {
  editItem = null;
  editUndoStack = [];
  editPickCount = 0;
  penPoints = [];
  penHoverPoint = null;
  isPenPathApplied = false;
  isSelectionInverted = false;
  isErasing = false;
  eraserUndoSnapshot = null;
  eraserRemovedTotal = 0;
  eraserPreviewPointer = null;
  eraserLastPoint = null;
  editPointerId = null;
  editBackgroundColor = null;
  hideEraserBrushPreview();
  clearPenOverlay();
  els.editBackgroundCanvas.style.width = "";
  els.editBackgroundCanvas.style.height = "";
  els.editBackgroundCanvas.style.transform = "";
  els.editCanvasStage.style.width = "";
  els.editCanvasStage.style.height = "";
  editViewOffset = { x: 0, y: 0 };
  applyEditCanvasTransform();
  updateEditUndoButton();
  updatePenButtons();
  const bgCtx = els.editBackgroundCanvas.getContext("2d");
  bgCtx.clearRect(0, 0, els.editBackgroundCanvas.width, els.editBackgroundCanvas.height);
  const ctx = els.editCanvas.getContext("2d");
  ctx.clearRect(0, 0, els.editCanvas.width, els.editCanvas.height);
}

function updateEditMeta(removed = 0, detailText = "") {
  const sizeText = editItem?.blob ? formatBytes(editItem.blob.size) : "";
  const actionText = removed ? ` · 本次 ${removed} px` : detailText;
  els.editMeta.textContent = `${els.editCanvas.width} x ${els.editCanvas.height}${sizeText ? ` · ${sizeText}` : ""} · ${editPickCount} 次编辑${actionText}`;
}

function updateEditUndoButton() {
  const hasPenPathUndo = penPoints.length > 0 && !isPenPathApplied;
  els.editUndoButton.disabled = editUndoStack.length === 0 && !hasPenPathUndo;
  els.clearBackgroundButton.disabled = !editBackgroundColor;
}

function setEditTool(tool) {
  editTool = tool;
  els.editCanvasWrap.dataset.tool = tool;
  document.querySelectorAll('input[name="editTool"]').forEach((input) => {
    input.checked = input.value === tool;
  });
  if (tool !== "eraser") {
    hideEraserBrushPreview();
  } else {
    updateEraserBrushPreview();
  }
  updatePenButtons();
}

function addPenPoint(x, y) {
  if (isPenPathApplied) {
    penPoints = [];
    penHoverPoint = null;
    isSelectionInverted = false;
    isPenPathApplied = false;
  }
  penPoints.push({ x, y });
  drawPenOverlay();
  updatePenButtons();
  updateEditUndoButton();
}

function clearPenPath() {
  clearCurrentPenPath();
}

function clearCurrentPenPath() {
  penPoints = [];
  penHoverPoint = null;
  isPenPathApplied = false;
  isSelectionInverted = false;
  clearPenOverlay();
  updatePenButtons();
  updateEditUndoButton();
}

function undoPenPathPoint() {
  if (!penPoints.length || isPenPathApplied) return false;
  penPoints.pop();
  if (penPoints.length < 3) isSelectionInverted = false;
  drawPenOverlay();
  updatePenButtons();
  updateEditUndoButton();
  return true;
}

function updatePenButtons() {
  const isPen = editTool === "pen";
  els.invertSelectionButton.disabled = !isPen || isPenPathApplied || penPoints.length < 3;
  els.invertSelectionButton.classList.toggle("is-active", isPen && isSelectionInverted);
  els.invertSelectionButton.textContent = isSelectionInverted ? "已反转" : "反转选区";
  els.finishPenButton.disabled = !isPen || isPenPathApplied || penPoints.length < 3;
  els.clearPenButton.disabled = !isPen || penPoints.length === 0;
  updateEditUndoButton();
}

function toggleSelectionInvert() {
  if (editTool !== "pen" || isPenPathApplied || penPoints.length < 3) return;
  isSelectionInverted = !isSelectionInverted;
  drawPenOverlay();
  updatePenButtons();
}

function clearPenOverlay() {
  syncPenOverlayCanvasSize();
  const ctx = els.penOverlayCanvas.getContext("2d");
  ctx.clearRect(0, 0, els.penOverlayCanvas.width, els.penOverlayCanvas.height);
}

function drawPenOverlay() {
  syncPenOverlayCanvasSize();
  const ctx = els.penOverlayCanvas.getContext("2d");
  clearPenOverlay();
  if (!penPoints.length) return;

  const stagePoints = penPoints.map((point) => imagePointToEditStagePoint(point));
  const hoverStagePoint =
    penHoverPoint && !isPenPathApplied ? imagePointToEditStagePoint(penHoverPoint) : null;
  const fixedLineWidth = isPenPathApplied ? 2 : 2.4;
  const fixedDash = 9;
  const fixedGap = 7;
  const fixedPointRadius = isPenPathApplied ? 3 : 3.5;
  const fixedPointLineWidth = 1;

  ctx.save();
  ctx.lineWidth = fixedLineWidth;
  ctx.strokeStyle = "#0f7b68";
  ctx.fillStyle = "rgba(15, 123, 104, 0.14)";

  if (isSelectionInverted && penPoints.length >= 3) {
    ctx.beginPath();
    ctx.rect(0, 0, els.penOverlayCanvas.width, els.penOverlayCanvas.height);
    ctx.moveTo(stagePoints[0].x, stagePoints[0].y);
    for (const point of stagePoints.slice(1)) {
      ctx.lineTo(point.x, point.y);
    }
    ctx.closePath();
    ctx.fill("evenodd");
  }

  ctx.setLineDash([fixedDash, fixedGap]);
  ctx.beginPath();
  ctx.moveTo(stagePoints[0].x, stagePoints[0].y);
  for (const point of stagePoints.slice(1)) {
    ctx.lineTo(point.x, point.y);
  }
  if (penPoints.length >= 3) {
    ctx.closePath();
    if (!isSelectionInverted) ctx.fill();
  }
  ctx.stroke();
  ctx.setLineDash([]);

  if (hoverStagePoint && penPoints.length > 0) {
    const lastPoint = stagePoints[stagePoints.length - 1];
    ctx.save();
    ctx.strokeStyle = "rgba(15, 123, 104, 0.72)";
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(hoverStagePoint.x, hoverStagePoint.y);
    ctx.stroke();
    ctx.restore();
  }

  for (const point of stagePoints) {
    ctx.beginPath();
    ctx.fillStyle = "#ffffff";
    ctx.arc(point.x, point.y, fixedPointRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#0f7b68";
    ctx.lineWidth = fixedPointLineWidth;
    ctx.stroke();
  }
  ctx.restore();
}

function getEditDisplayScale() {
  const rect = els.editCanvas.getBoundingClientRect();
  return Math.max(0.01, rect.width / Math.max(1, els.editCanvas.width));
}

function syncPenOverlayCanvasSize() {
  const rect = els.editCanvasWrap.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  if (els.penOverlayCanvas.width !== width) els.penOverlayCanvas.width = width;
  if (els.penOverlayCanvas.height !== height) els.penOverlayCanvas.height = height;
}

function imagePointToEditStagePoint(point) {
  const wrapRect = els.editCanvasWrap.getBoundingClientRect();
  const imageRect = els.editCanvas.getBoundingClientRect();
  return {
    x: imageRect.left - wrapRect.left + (point.x / Math.max(1, els.editCanvas.width)) * imageRect.width,
    y: imageRect.top - wrapRect.top + (point.y / Math.max(1, els.editCanvas.height)) * imageRect.height,
  };
}

function applyPenErase() {
  if (!editItem || penPoints.length < 3) return;
  const ctx = els.editCanvas.getContext("2d", { willReadFrequently: true });
  const before = ctx.getImageData(0, 0, els.editCanvas.width, els.editCanvas.height);
  const removed = erasePolygonArea(els.editCanvas, penPoints, Number(els.editEdgeRange.value), isSelectionInverted);
  if (!removed) return;

  editUndoStack.push(before);
  editPickCount += 1;
  isPenPathApplied = true;
  drawPenOverlay();
  updateEditMeta(removed);
  updatePenButtons();
  updateEditUndoButton();
}

function erasePolygonArea(canvas, points, edgeStrength, inverted = false) {
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = canvas.width;
  maskCanvas.height = canvas.height;
  const maskCtx = maskCanvas.getContext("2d");
  maskCtx.fillStyle = "#fff";
  maskCtx.beginPath();
  if (inverted) {
    maskCtx.rect(0, 0, canvas.width, canvas.height);
  }
  maskCtx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) {
    maskCtx.lineTo(point.x, point.y);
  }
  maskCtx.closePath();
  maskCtx.fill(inverted ? "evenodd" : "nonzero");

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  const maskData = maskCtx.getImageData(0, 0, canvas.width, canvas.height).data;
  const mask = new Uint8Array(canvas.width * canvas.height);
  let removed = 0;

  for (let i = 0; i < mask.length; i += 1) {
    if (maskData[i * 4 + 3] > 0 && data[i * 4 + 3] > 0) {
      data[i * 4 + 3] = 0;
      mask[i] = 1;
      removed += 1;
    }
  }

  if (!removed) return 0;
  refineEditedEdges(data, mask, canvas.width, canvas.height, edgeStrength);
  ctx.putImageData(image, 0, 0);
  return removed;
}

function fitEditCanvasToView() {
  if (!els.editCanvas.width || !els.editCanvas.height) return;
  const wrap = els.editCanvasWrap;
  const padding = 36;
  const availableWidth = Math.max(160, wrap.clientWidth - padding);
  const availableHeight = Math.max(160, wrap.clientHeight - padding);
  editBaseScale = Math.min(1, availableWidth / els.editCanvas.width, availableHeight / els.editCanvas.height);
  editViewScale = 1;
  editViewOffset = { x: 0, y: 0 };
  applyEditViewScale();
}

function applyEditViewScale(anchor = null) {
  const wrap = els.editCanvasWrap;
  const beforeWidth = els.editCanvas.getBoundingClientRect().width || els.editCanvas.width * editBaseScale;
  const beforeHeight = els.editCanvas.getBoundingClientRect().height || els.editCanvas.height * editBaseScale;
  const centerX = wrap.clientWidth / 2 + editViewOffset.x;
  const centerY = wrap.clientHeight / 2 + editViewOffset.y;
  const ratioX = anchor ? (anchor.x - centerX + beforeWidth / 2) / Math.max(1, beforeWidth) : 0.5;
  const ratioY = anchor ? (anchor.y - centerY + beforeHeight / 2) / Math.max(1, beforeHeight) : 0.5;
  const displayScale = editBaseScale * editViewScale;
  const newWidth = Math.max(1, Math.round(els.editCanvas.width * displayScale));
  const newHeight = Math.max(1, Math.round(els.editCanvas.height * displayScale));

  els.editBackgroundCanvas.style.width = `${newWidth}px`;
  els.editBackgroundCanvas.style.height = `${newHeight}px`;
  els.editCanvas.style.width = `${newWidth}px`;
  els.editCanvas.style.height = `${newHeight}px`;

  if (anchor) {
    editViewOffset = {
      x: anchor.x - wrap.clientWidth / 2 - (ratioX - 0.5) * newWidth,
      y: anchor.y - wrap.clientHeight / 2 - (ratioY - 0.5) * newHeight,
    };
  }
  clampEditViewOffset(newWidth, newHeight);
  applyEditCanvasTransform();
  updateEraserBrushPreview();
}

function applyEditCanvasTransform() {
  const transform = `translate(-50%, -50%) translate(${Math.round(editViewOffset.x)}px, ${Math.round(editViewOffset.y)}px)`;
  els.editBackgroundCanvas.style.transform = transform;
  els.editCanvas.style.transform = transform;
  drawPenOverlay();
}

function clampEditViewOffset(displayWidth = els.editCanvas.getBoundingClientRect().width, displayHeight = els.editCanvas.getBoundingClientRect().height) {
  const wrap = els.editCanvasWrap;
  const visibleEdge = 48;
  const limitX = Math.max(0, (displayWidth + wrap.clientWidth) / 2 - visibleEdge);
  const limitY = Math.max(0, (displayHeight + wrap.clientHeight) / 2 - visibleEdge);
  editViewOffset.x = Math.max(-limitX, Math.min(limitX, editViewOffset.x));
  editViewOffset.y = Math.max(-limitY, Math.min(limitY, editViewOffset.y));
}

function setEditViewScale(nextScale, anchor = null) {
  editViewScale = Math.max(0.5, Math.min(8, nextScale));
  applyEditViewScale(anchor);
}

function handleEditWheel(event) {
  if (!editItem) return;
  event.preventDefault();
  const rect = els.editCanvasWrap.getBoundingClientRect();
  const anchor = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
  const factor = event.deltaY < 0 ? 1.12 : 0.89;
  setEditViewScale(editViewScale * factor, anchor);
}

function getEditorPointerPosition(event) {
  const wrapRect = els.editCanvasWrap.getBoundingClientRect();
  const rect = els.editCanvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const stageX = event.clientX - wrapRect.left;
  const stageY = event.clientY - wrapRect.top;
  const x = ((event.clientX - rect.left) / rect.width) * els.editCanvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * els.editCanvas.height;
  const isInsideImage = x >= 0 && y >= 0 && x < els.editCanvas.width && y < els.editCanvas.height;
  const isInsideStage = stageX >= 0 && stageY >= 0 && stageX <= wrapRect.width && stageY <= wrapRect.height;
  return { x, y, stageX, stageY, isInsideImage, isInsideStage };
}

function startEditPointer(event) {
  if (!editItem || event.button !== 0) return;
  els.editCanvasWrap.focus();
  editPointerId = event.pointerId;
  els.editCanvasWrap.setPointerCapture?.(event.pointerId);
  updateEraserBrushPreview(event);

  if (editTool === "eraser") {
    event.preventDefault();
    startEraserStroke(event);
    return;
  }

  if (editTool === "pen") {
    event.preventDefault();
    const point = getEditorPointerPosition(event);
    if (point) {
      penHoverPoint = { x: point.x, y: point.y };
      addPenPoint(point.x, point.y);
    }
    return;
  }

  isEditPanning = true;
  didEditPan = false;
  editPanStart = {
    x: event.clientX,
    y: event.clientY,
    offsetX: editViewOffset.x,
    offsetY: editViewOffset.y,
  };
  els.editCanvasWrap.classList.add("is-panning");
}

function moveEditPointer(event) {
  if (!editItem) return;
  updateEraserBrushPreview(event);

  if (isErasing) {
    moveEraserStroke(event);
    return;
  }

  if (editTool === "pen") {
    const point = getEditorPointerPosition(event);
    penHoverPoint = point ? { x: point.x, y: point.y } : null;
    drawPenOverlay();
    return;
  }

  if (!isEditPanning) return;
  const dx = event.clientX - editPanStart.x;
  const dy = event.clientY - editPanStart.y;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didEditPan = true;
  editViewOffset = {
    x: editPanStart.offsetX + dx,
    y: editPanStart.offsetY + dy,
  };
  clampEditViewOffset();
  applyEditCanvasTransform();
}

function endEditPointer(event) {
  if (editPointerId !== null) {
    try {
      els.editCanvasWrap.releasePointerCapture?.(editPointerId);
    } catch {
      // Pointer capture can already be released by the browser.
    }
  }
  editPointerId = null;

  if (isErasing) {
    endEraserStroke();
    return;
  }

  if (!isEditPanning) return;
  const wasPanning = didEditPan;
  isEditPanning = false;
  els.editCanvasWrap.classList.remove("is-panning");
  if (!wasPanning) performEditPickAt(getEditorPointerPosition(event));
  if (wasPanning) {
    setTimeout(() => {
      didEditPan = false;
    }, 0);
  } else {
    didEditPan = false;
  }
}

function cancelEditPointer() {
  editPointerId = null;
  if (isErasing) endEraserStroke();
  if (isEditPanning) {
    isEditPanning = false;
    els.editCanvasWrap.classList.remove("is-panning");
  }
  didEditPan = false;
}

function handleEditPointerLeave() {
  if (editTool === "pen") {
    penHoverPoint = null;
    drawPenOverlay();
  }
  if (!isErasing) hideEraserBrushPreview();
}

function startEraserStroke(event) {
  const point = getEditorPointerPosition(event);
  if (!point) return;
  const ctx = els.editCanvas.getContext("2d", { willReadFrequently: true });
  eraserUndoSnapshot = ctx.getImageData(0, 0, els.editCanvas.width, els.editCanvas.height);
  eraserRemovedTotal = 0;
  eraserLastPoint = point;
  isErasing = true;
  didEditPan = true;
  els.editCanvasWrap.classList.add("is-erasing");
  eraseAtPoint(point);
}

function moveEraserStroke(event) {
  const point = getEditorPointerPosition(event);
  if (!point) return;
  eraseStrokeToPoint(point);
}

function endEraserStroke() {
  if (!isErasing) return;
  isErasing = false;
  els.editCanvasWrap.classList.remove("is-erasing");
  if (eraserRemovedTotal && eraserUndoSnapshot) {
    editUndoStack.push(eraserUndoSnapshot);
    editPickCount += 1;
    updateEditMeta(eraserRemovedTotal);
    updateEditUndoButton();
  }
  eraserUndoSnapshot = null;
  eraserRemovedTotal = 0;
  eraserLastPoint = null;
  updateEraserBrushPreview();
  setTimeout(() => {
    didEditPan = false;
  }, 0);
}

function eraseAtPoint(point) {
  const removed = eraseBrushArea(
    els.editCanvas,
    point.x,
    point.y,
    Number(els.eraserSizeRange.value),
    Number(els.editEdgeRange.value),
  );
  eraserRemovedTotal += removed;
}

function eraseStrokeToPoint(point) {
  if (!eraserLastPoint) {
    eraserLastPoint = point;
    eraseAtPoint(point);
    return;
  }

  const radius = Number(els.eraserSizeRange.value);
  const dx = point.x - eraserLastPoint.x;
  const dy = point.y - eraserLastPoint.y;
  const distance = Math.hypot(dx, dy);
  if (distance < Math.max(1, radius * 0.18)) return;

  const spacing = Math.max(1, radius * 0.32);
  const steps = Math.max(1, Math.ceil(distance / spacing));
  for (let step = 1; step <= steps; step += 1) {
    const ratio = step / steps;
    eraseAtPoint({
      x: eraserLastPoint.x + dx * ratio,
      y: eraserLastPoint.y + dy * ratio,
    });
  }
  eraserLastPoint = point;
}

function fillEditBackgroundColor() {
  if (!editItem) return;
  const rgb = parseHexColor(els.editFillColorInput.value);
  if (!rgb) return;

  editBackgroundColor = els.editFillColorInput.value;
  drawEditBackground();
  updateEditMeta(0, ` · 背景 ${els.editFillColorInput.value}`);
  updateEditUndoButton();
}

function clearEditBackgroundColor() {
  if (!editItem || !editBackgroundColor) return;
  editBackgroundColor = null;
  drawEditBackground();
  updateEditMeta(0, " · 已取消背景");
  updateEditUndoButton();
}

function drawEditBackground() {
  const ctx = els.editBackgroundCanvas.getContext("2d");
  ctx.clearRect(0, 0, els.editBackgroundCanvas.width, els.editBackgroundCanvas.height);
  if (!editBackgroundColor) return;
  ctx.fillStyle = editBackgroundColor;
  ctx.fillRect(0, 0, els.editBackgroundCanvas.width, els.editBackgroundCanvas.height);
}

function composeEditResultCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = els.editCanvas.width;
  canvas.height = els.editCanvas.height;
  const ctx = canvas.getContext("2d");
  if (editBackgroundColor) {
    ctx.fillStyle = editBackgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(els.editCanvas, 0, 0);
  return canvas;
}

function parseHexColor(color) {
  const normalized = color.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function eraseBrushArea(canvas, centerX, centerY, radius, edgeStrength) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const margin = Math.ceil(radius + 2);
  const minX = Math.max(0, Math.floor(centerX - margin));
  const maxX = Math.min(canvas.width - 1, Math.ceil(centerX + margin));
  const minY = Math.max(0, Math.floor(centerY - margin));
  const maxY = Math.min(canvas.height - 1, Math.ceil(centerY + margin));
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  if (width <= 0 || height <= 0) return 0;

  const image = ctx.getImageData(minX, minY, width, height);
  const data = image.data;
  const softness = Math.max(0, Math.min(1, edgeStrength / 100));
  const featherWidth = Math.max(1, radius * (0.04 + softness * 0.72));
  const hardRadius = Math.max(0, radius - featherWidth);
  const transparentCutoff = Math.round(6 + softness * 20);
  const haloCutoff = Math.round(86 + softness * 44);
  let removed = 0;

  const brushMinX = Math.max(0, Math.floor(centerX - radius) - minX);
  const brushMaxX = Math.min(width - 1, Math.ceil(centerX + radius) - minX);
  const brushMinY = Math.max(0, Math.floor(centerY - radius) - minY);
  const brushMaxY = Math.min(height - 1, Math.ceil(centerY + radius) - minY);
  const localCenterX = centerX - minX;
  const localCenterY = centerY - minY;

  for (let y = brushMinY; y <= brushMaxY; y += 1) {
    for (let x = brushMinX; x <= brushMaxX; x += 1) {
      const dx = x - localCenterX;
      const dy = y - localCenterY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > radius) continue;
      const pixel = y * width + x;
      const alphaIndex = pixel * 4 + 3;
      const alpha = data[alphaIndex];
      if (!alpha) continue;

      const edgeProgress = distance <= hardRadius ? 0 : (distance - hardRadius) / featherWidth;
      const erasePower = 1 - smoothStep(0, 1, Math.max(0, Math.min(1, edgeProgress)));
      let nextAlpha = Math.max(0, Math.round(alpha * (1 - erasePower)));
      const whiteish = data[alphaIndex - 3] > 235 && data[alphaIndex - 2] > 235 && data[alphaIndex - 1] > 235;
      if (nextAlpha <= transparentCutoff || (whiteish && nextAlpha <= haloCutoff)) nextAlpha = 0;
      if (nextAlpha < alpha) {
        data[alphaIndex] = nextAlpha;
        if (!nextAlpha) {
          data[alphaIndex - 3] = 0;
          data[alphaIndex - 2] = 0;
          data[alphaIndex - 1] = 0;
        }
        removed += 1;
      }
    }
  }

  if (!removed) return 0;
  ctx.putImageData(image, minX, minY);
  return removed;
}

function smoothStep(edge0, edge1, value) {
  const t = Math.max(0, Math.min(1, (value - edge0) / Math.max(0.0001, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function handleEditKeydown(event) {
  if (!editItem) return;
  if (isUndoShortcut(event)) {
    event.preventDefault();
    event.stopPropagation();
    undoEditStep();
    return;
  }
  if (event.target === els.editToleranceRange || event.target === els.editEdgeRange || event.target === els.eraserSizeRange) return;
  const step = event.shiftKey ? 96 : 42;
  if (event.key === "+" || event.key === "=") {
    event.preventDefault();
    setEditViewScale(editViewScale * 1.16, { x: els.editCanvasWrap.clientWidth / 2, y: els.editCanvasWrap.clientHeight / 2 });
  } else if (event.key === "-" || event.key === "_") {
    event.preventDefault();
    setEditViewScale(editViewScale / 1.16, { x: els.editCanvasWrap.clientWidth / 2, y: els.editCanvasWrap.clientHeight / 2 });
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    moveEditCanvasImage(-step, 0);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    moveEditCanvasImage(step, 0);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    moveEditCanvasImage(0, -step);
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    moveEditCanvasImage(0, step);
  } else if (event.key === "0") {
    event.preventDefault();
    fitEditCanvasToView();
  }
}

function handleEditorDeleteKeydown(event) {
  if (!editItem || !els.editModal.open || editTool !== "pen") return;
  if (event.key !== "Delete" && event.key !== "Backspace") return;
  if (isEditableInputTarget(event.target)) return;
  if (!penPoints.length) return;
  event.preventDefault();
  event.stopPropagation();
  clearCurrentPenPath();
}

function handleEditUndoShortcut(event) {
  if (!editItem || !els.editModal.open || !isUndoShortcut(event)) return;
  event.preventDefault();
  event.stopPropagation();
  undoEditStep();
}

function isUndoShortcut(event) {
  return (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "z";
}

function isEditableInputTarget(target) {
  if (!(target instanceof Element)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.closest("[contenteditable='true']")
  );
}

function moveEditCanvasImage(dx, dy) {
  editViewOffset = {
    x: editViewOffset.x + dx,
    y: editViewOffset.y + dy,
  };
  clampEditViewOffset();
  applyEditCanvasTransform();
  updateEraserBrushPreview();
}

function updateEraserBrushPreview(event = null) {
  if (event?.clientX !== undefined && event?.clientY !== undefined) {
    eraserPreviewPointer = getEditorPointerPosition(event);
  }
  if (!editItem || editTool !== "eraser" || !eraserPreviewPointer) {
    hideEraserBrushPreview();
    return;
  }

  const canvasRect = els.editCanvas.getBoundingClientRect();
  const pointer = eraserPreviewPointer;

  if (!canvasRect.width || !canvasRect.height || (!pointer.isInsideStage && !isErasing)) {
    hideEraserBrushPreview();
    return;
  }

  const displayScale = canvasRect.width / Math.max(1, els.editCanvas.width);
  const diameter = Math.max(8, Number(els.eraserSizeRange.value) * 2 * displayScale);
  els.eraserBrushPreview.hidden = false;
  els.eraserBrushPreview.style.width = `${diameter}px`;
  els.eraserBrushPreview.style.height = `${diameter}px`;
  els.eraserBrushPreview.style.transform = `translate(${pointer.stageX}px, ${pointer.stageY}px) translate(-50%, -50%)`;
}

function hideEraserBrushPreview() {
  els.eraserBrushPreview.hidden = true;
}

async function processItem(item, options) {
  let canvas = canvasFromBitmap(item.bitmap);

  if (options.mode !== "upscale") {
    canvas = await removeBackgroundWithProvider(item.file, canvas, options, item);
  }

  if (options.mode !== "upscale" && options.trim) canvas = trimTransparent(canvas);

  if (options.mode !== "cutout") {
    canvas = await upscaleWithProvider(canvas, options);
  }

  canvas = applyOutputBackground(canvas, options.backgroundColor);
  return canvas;
}

function readOptions() {
  const removeBgChoice = getSelectedRemoveBgChoice();
  const model = removeBgChoice.id;
  const preset = MODEL_PRESETS[model] ?? MODEL_PRESETS["local-fast"];
  const mode = getSelectedMode();
  const upscaleChoice = getSelectedUpscaleChoice();

  return {
    mode,
    model,
    removeBgProvider: removeBgChoice.provider,
    removeBgChoice,
    removeBgLabel: removeBgChoice.label,
    matting: preset.matting,
    scale: Number(els.scaleSelect.value),
    upscaleProvider: upscaleChoice.id,
    upscaleChoice,
    upscaleLabel: upscaleChoice.label,
    tolerance: Number(els.toleranceRange.value) * preset.toleranceScale,
    feather: DEFAULT_EDGE_FEATHER,
    shrink: DEFAULT_EDGE_SHRINK,
    backgroundColor: null,
    trim: DEFAULT_AUTO_TRIM,
    sharpen: mode !== "cutout" && els.sharpenToggle.checked,
    pixianApiId: els.pixianApiIdInput.value.trim(),
    pixianApiSecret: els.pixianApiSecretInput.value.trim(),
    koukoutuProxyUrl: KOUKOUTU_PROXY_URL,
    koukoutuApiKey: els.koukoutuApiKeyInput.value.trim(),
  };
}

function normalizeRemoveBgWorkflows(workflows) {
  if (!Array.isArray(workflows)) return [];

  const seen = new Set(BUILT_IN_REMOVE_BG_MODELS.map((model) => model.id));
  return workflows
    .map((workflow) => {
      const id = String(workflow?.id || "").trim();
      const label = String(workflow?.label || "").trim();
      const provider = String(workflow?.provider || "runninghub").trim();
      if (!id || !label || !["runninghub"].includes(provider) || seen.has(id)) return null;
      seen.add(id);
      return {
        id,
        label,
        provider,
        default: workflow?.default === true,
      };
    })
    .filter(Boolean);
}

function initializeRemoveBgModelOptions() {
  els.modelSelect.innerHTML = "";

  getRemoveBgChoices().forEach((choice) => {
    const option = document.createElement("option");
    option.value = choice.id;
    option.textContent = choice.label;
    els.modelSelect.append(option);
  });

  els.modelSelect.value = getDefaultRemoveBgChoice().id;
}

function getRemoveBgChoices() {
  return [...REMOVE_BG_WORKFLOWS, ...BUILT_IN_REMOVE_BG_MODELS];
}

function getDefaultRemoveBgChoice() {
  return REMOVE_BG_WORKFLOWS.find((workflow) => workflow.default) || getRemoveBgChoice("local-fast");
}

function getSelectedRemoveBgChoice() {
  return getRemoveBgChoice(els.modelSelect.value);
}

function getRemoveBgChoice(value) {
  const requested = String(value || "").trim();
  return getRemoveBgChoices().find((choice) => choice.id === requested) || getRemoveBgChoice("local-fast");
}

function normalizeUpscaleWorkflows(workflows) {
  if (!Array.isArray(workflows)) return [];

  const seen = new Set(["canvas-resize"]);
  return workflows
    .map((workflow) => {
      const id = String(workflow?.id || "").trim();
      const label = String(workflow?.label || "").trim();
      const provider = String(workflow?.provider || "runninghub").trim();
      if (!id || !label || !["runninghub"].includes(provider) || seen.has(id)) return null;
      seen.add(id);
      return {
        id,
        label,
        provider,
        default: workflow?.default === true,
      };
    })
    .filter(Boolean);
}

function initializeUpscaleProviderOptions() {
  els.upscaleProviderSelect.innerHTML = "";

  getUpscaleChoices().forEach((choice) => {
    const option = document.createElement("option");
    option.value = choice.id;
    option.textContent = choice.label;
    els.upscaleProviderSelect.append(option);
  });

  const defaultChoice = getDefaultUpscaleChoice();
  els.upscaleProviderSelect.value = defaultChoice.id;
}

function getUpscaleChoices() {
  return [getResizeUpscaleChoice(), ...UPSCALE_WORKFLOWS];
}

function getResizeUpscaleChoice() {
  return {
    id: "canvas-resize",
    label: UPSCALE_PROVIDERS["canvas-resize"].label,
    provider: "resize",
    default: false,
  };
}

function getDefaultUpscaleChoice() {
  return UPSCALE_WORKFLOWS.find((workflow) => workflow.default) || getResizeUpscaleChoice();
}

function getSelectedUpscaleChoice() {
  return getUpscaleChoice(els.upscaleProviderSelect.value);
}

function getUpscaleChoice(value) {
  const requested = String(value || "").trim();
  const configuredChoice = getUpscaleChoices().find((choice) => choice.id === requested);
  if (configuredChoice) return configuredChoice;

  if (requested === "runninghub" || requested === "ai-enhance") {
    return UPSCALE_WORKFLOWS[0] || {
      id: "runninghub",
      label: UPSCALE_PROVIDERS.runninghub.label,
      provider: "runninghub",
      default: false,
    };
  }

  return getResizeUpscaleChoice();
}

function shouldUseRemoteMatting(options) {
  return ["pixian", "koukoutu", "runninghub"].includes(options.removeBgProvider) && options.mode !== "upscale";
}

async function removeBackgroundWithProvider(file, canvas, options, item = null) {
  if (options.mode === "upscale") return canvas;
  if (options.removeBgProvider === "local") return removeBackground(canvas, options);
  if (options.removeBgProvider === "pixian") return processWithPixian(file, options);
  if (options.removeBgProvider === "koukoutu") return processWithKoukoutu(file, options);
  if (options.removeBgProvider === "runninghub") return removeBackgroundWithRunningHub(file, options, item);
  throw new Error("未选择可用的云端抠图模型。");
}

function shouldUsePixian(options) {
  return options.removeBgProvider === "pixian" && options.mode !== "upscale";
}

function shouldUseKoukoutu(options) {
  return options.removeBgProvider === "koukoutu" && options.mode !== "upscale";
}

function updateApiControls() {
  updatePixianControls();
  updateKoukoutuControls();
}

function updatePixianControls() {
  const isPixian = getSelectedRemoveBgChoice().provider === "pixian" && getSelectedMode() !== "upscale";
  els.pixianPanel.hidden = !isPixian;
  els.pixianApiIdInput.disabled = !isPixian;
  els.pixianApiSecretInput.disabled = !isPixian;
  els.pixianCheckCreditsButton.disabled = !isPixian || !hasPixianCredentials();
  if (!isPixian) clearPixianCreditStatus();
}

function updateKoukoutuControls() {
  const isKoukoutu = getSelectedRemoveBgChoice().provider === "koukoutu" && getSelectedMode() !== "upscale";
  els.koukoutuPanel.hidden = !isKoukoutu;
  els.koukoutuApiKeyInput.disabled = !isKoukoutu;
  els.koukoutuCheckCreditsButton.disabled = !isKoukoutu || !hasKoukoutuCredentials();
  if (!isKoukoutu) clearKoukoutuCreditStatus();
}

function updateOptionVisibility() {
  const mode = getSelectedMode();
  const needsCutoutOptions = mode !== "upscale";
  const needsUpscaleOptions = mode !== "cutout";

  setElementHidden(els.edgeFeatherOption, true);
  setElementHidden(els.edgeShrinkOption, true);
  setElementHidden(els.autoCropOption, true);

  setElementHidden(els.modelOption, !needsCutoutOptions);
  setElementHidden(els.toleranceOption, !needsCutoutOptions);

  setElementHidden(els.scaleOption, !needsUpscaleOptions);
  setElementHidden(els.upscaleProviderOption, !needsUpscaleOptions);
  setElementHidden(els.sharpenOption, !needsUpscaleOptions);
}

function setElementHidden(element, hidden) {
  if (element) element.hidden = hidden;
}

function getSelectedMode() {
  return document.querySelector('input[name="mode"]:checked').value;
}

function needsPixianCredentials() {
  return getSelectedRemoveBgChoice().provider === "pixian" && getSelectedMode() !== "upscale";
}

function needsKoukoutuCredentials() {
  return getSelectedRemoveBgChoice().provider === "koukoutu" && getSelectedMode() !== "upscale";
}

function hasPixianCredentials() {
  return Boolean(els.pixianApiIdInput.value.trim() && els.pixianApiSecretInput.value.trim());
}

function hasKoukoutuCredentials() {
  return Boolean(els.koukoutuApiKeyInput.value.trim());
}

function getPixianCredentialsFromInputs() {
  return {
    pixianApiId: els.pixianApiIdInput.value.trim(),
    pixianApiSecret: els.pixianApiSecretInput.value.trim(),
  };
}

function getKoukoutuCredentialsFromInputs() {
  return {
    koukoutuProxyUrl: KOUKOUTU_PROXY_URL,
    koukoutuApiKey: els.koukoutuApiKeyInput.value.trim(),
  };
}

function loadPixianCredentials() {
  try {
    const saved = JSON.parse(localStorage.getItem(PIXIAN_CREDENTIALS_KEY) || "{}");
    els.pixianApiIdInput.value = saved.apiId || "";
    els.pixianApiSecretInput.value = saved.apiSecret || "";
  } catch (error) {
    els.pixianApiIdInput.value = "";
    els.pixianApiSecretInput.value = "";
  }
}

function savePixianCredentials() {
  const credentials = {
    apiId: els.pixianApiIdInput.value.trim(),
    apiSecret: els.pixianApiSecretInput.value.trim(),
  };
  localStorage.setItem(PIXIAN_CREDENTIALS_KEY, JSON.stringify(credentials));
}

function loadKoukoutuCredentials() {
  try {
    const saved = JSON.parse(localStorage.getItem(KOUKOUTU_CREDENTIALS_KEY) || "{}");
    els.koukoutuApiKeyInput.value = saved.apiKey || "";
  } catch (error) {
    els.koukoutuApiKeyInput.value = "";
  }
}

function saveKoukoutuCredentials() {
  const credentials = {
    apiKey: els.koukoutuApiKeyInput.value.trim(),
  };
  localStorage.setItem(KOUKOUTU_CREDENTIALS_KEY, JSON.stringify(credentials));
}

async function removeBackgroundWithPixian(file, options) {
  if (!options.pixianApiId || !options.pixianApiSecret) {
    throw new Error("Pixian API credentials are missing");
  }

  const formData = new FormData();
  formData.append("image", file, file.name);
  formData.append("result.crop_to_foreground", options.trim ? "true" : "false");

  const response = await fetch(PIXIAN_API_URL, {
    method: "POST",
    headers: {
      Authorization: getPixianAuthHeader(options),
    },
    body: formData,
  });

  if (!response.ok) {
    const message = await readPixianError(response);
    throw new Error(message || `Pixian request failed: ${response.status}`);
  }

  return blobToCanvas(await response.blob());
}

async function processWithPixian(file, options) {
  const account = await getPixianAccountStatus(options);
  updatePixianCreditStatus(account);
  ensurePixianCreditsAvailable(account);
  return removeBackgroundWithPixian(file, options);
}

async function checkPixianCredits() {
  if (!hasPixianCredentials()) {
    setPixianCreditStatus("先填写 Pixian API Id 和 Secret。", "is-error");
    updateUi();
    return;
  }

  els.pixianCheckCreditsButton.disabled = true;
  setPixianCreditStatus("正在检查 Pixian 额度...", "");
  try {
    const account = await getPixianAccountStatus(getPixianCredentialsFromInputs());
    updatePixianCreditStatus(account);
  } catch (error) {
    setPixianCreditStatus(getProcessingErrorText(error), "is-error");
  } finally {
    updateUi();
  }
}

async function removeBackgroundWithKoukoutu(file, options) {
  if (!options.koukoutuApiKey) {
    throw new Error("Koukoutu API key is missing");
  }

  const proxyUrl = normalizeKoukoutuProxyUrl(options.koukoutuProxyUrl);
  const requestUrl = proxyUrl ? `${proxyUrl}/remove-background` : KOUKOUTU_API_URL;
  const formData = createKoukoutuFormData(file, options);

  const response = await fetch(requestUrl, {
    method: "POST",
    headers: {
      "X-API-Key": options.koukoutuApiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const message = await readKoukoutuError(response);
    throw new Error(message || `Koukoutu request failed: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (/json/i.test(contentType)) {
    const data = await response.json();
    const imageUrl = data?.data?.url || data?.data?.image_url || data?.url;
    if (!imageUrl) throw new Error(data?.message || "抠抠图没有返回图片结果。");
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) throw new Error("抠抠图结果图片下载失败。");
    return blobToCanvas(await imageResponse.blob());
  }

  return blobToCanvas(await response.blob());
}

async function processWithKoukoutu(file, options) {
  const account = await getKoukoutuAccountStatus(options);
  updateKoukoutuCreditStatus(account);
  ensureKoukoutuCreditsAvailable(account);
  return removeBackgroundWithKoukoutu(file, options);
}

async function checkKoukoutuCredits() {
  if (!hasKoukoutuCredentials()) {
    setKoukoutuCreditStatus("先填写抠抠图 API Key。", "is-error");
    updateUi();
    return;
  }

  els.koukoutuCheckCreditsButton.disabled = true;
  setKoukoutuCreditStatus("正在检查抠抠图积分...", "");
  try {
    const account = await getKoukoutuAccountStatus(getKoukoutuCredentialsFromInputs());
    updateKoukoutuCreditStatus(account);
  } catch (error) {
    setKoukoutuCreditStatus(getProcessingErrorText(error), "is-error");
  } finally {
    updateUi();
  }
}

async function getPixianAccountStatus(options) {
  const response = await fetch(PIXIAN_ACCOUNT_URL, {
    method: "GET",
    headers: {
      Authorization: getPixianAuthHeader(options),
    },
  });

  if (!response.ok) {
    const message = await readPixianError(response);
    throw new Error(message || `Pixian account request failed: ${response.status}`);
  }

  return response.json();
}

async function getKoukoutuAccountStatus(options) {
  const proxyUrl = normalizeKoukoutuProxyUrl(options.koukoutuProxyUrl);
  const requestUrl = proxyUrl ? `${proxyUrl}/score` : KOUKOUTU_SCORE_URL;
  const response = await fetch(requestUrl, {
    method: "GET",
    headers: {
      "X-API-Key": options.koukoutuApiKey,
    },
  });

  if (!response.ok) {
    const message = await readKoukoutuError(response);
    throw new Error(message || `Koukoutu account request failed: ${response.status}`);
  }

  return response.json();
}

function ensurePixianCreditsAvailable(account) {
  const credits = Number(account?.credits ?? 0);
  if (account?.state === "dormant") {
    throw new Error("Pixian 账户休眠，请购买新的额度包。");
  }
  if (!Number.isFinite(credits) || credits <= 0) {
    throw new Error("Pixian 额度不足，请购买 Pixian 额度。");
  }
}

function ensureKoukoutuCreditsAvailable(account) {
  const data = account?.data || account;
  const credits = Number(data?.credits ?? 0);
  const vipCredits = Number(data?.vip_credits ?? 0);
  const total = (Number.isFinite(credits) ? credits : 0) + (Number.isFinite(vipCredits) ? vipCredits : 0);
  if (account?.code && Number(account.code) !== 200) {
    throw new Error(account.message || "抠抠图积分查询失败。");
  }
  if (total <= 0) {
    throw new Error("抠抠图积分不足，请购买积分。");
  }
}

function updatePixianCreditStatus(account) {
  const credits = Number(account?.credits ?? 0);
  const creditsText = Number.isFinite(credits) ? credits.toFixed(3).replace(/\\.0+$/, "") : "--";
  const stateText = account?.state === "active" ? "可用" : "不可用";
  const className = account?.state === "active" && credits > 0 ? "is-ok" : "is-error";
  setPixianCreditStatus(`Pixian 额度：${creditsText}，状态：${stateText}`, className);
}

function updateKoukoutuCreditStatus(account) {
  const data = account?.data || account;
  const credits = Number(data?.credits ?? 0);
  const vipCredits = Number(data?.vip_credits ?? 0);
  const total = (Number.isFinite(credits) ? credits : 0) + (Number.isFinite(vipCredits) ? vipCredits : 0);
  const creditsText = Number.isFinite(total) ? total.toFixed(2).replace(/\.0+$/, "") : "--";
  const className = total > 0 ? "is-ok" : "is-error";
  setKoukoutuCreditStatus(`抠抠图积分：${creditsText}`, className);
}

function setPixianCreditStatus(text, className) {
  els.pixianCreditStatus.textContent = text;
  els.pixianCreditStatus.className = `api-status ${className}`;
}

function setKoukoutuCreditStatus(text, className) {
  els.koukoutuCreditStatus.textContent = text;
  els.koukoutuCreditStatus.className = `api-status ${className}`;
}

function clearPixianCreditStatus() {
  setPixianCreditStatus("", "");
}

function clearKoukoutuCreditStatus() {
  setKoukoutuCreditStatus("", "");
}

function getPixianAuthHeader(options) {
  return `Basic ${btoa(`${options.pixianApiId}:${options.pixianApiSecret}`)}`;
}

function getKoukoutuBorderLevel(options) {
  if (options.feather >= 4 || options.shrink >= 2) return "2";
  if (options.feather >= 2 || options.shrink >= 1) return "1";
  return "0";
}

function createKoukoutuFormData(file, options) {
  const formData = new FormData();
  formData.append("model_key", "background-removal");
  formData.append("image_file", file, file.name);
  formData.append("output_format", "png");
  formData.append("crop", options.trim ? "1" : "0");
  formData.append("border", getKoukoutuBorderLevel(options));
  formData.append("stamp_crop", "0");
  formData.append("response", "bytes");
  return formData;
}

function normalizeKoukoutuProxyUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function isExpectedProcessingError(error) {
  const message = String(error?.message || error || "");
  return Boolean(error?.isRunningHubProviderError) || /AI 高清增强(?:服务)?未配置|UPSCALE_PROXY_URL/.test(message);
}

function getProcessingErrorText(error) {
  const message = String(error?.message || error || "处理失败").trim();
  if (error?.isRunningHubProviderError || /RunningHub|UPSCALE_PROXY_URL|Worker/.test(message)) return message;
  if (/failed to fetch|networkerror|load failed/i.test(message) && els.modelSelect.value === "koukoutu") {
    return "抠抠图接口暂不支持网页直连，需要配置中转服务。";
  }
  if (/credit|credits|quota|dormant|payment|purchase/i.test(message)) {
    if (/Koukoutu|抠抠图/i.test(message)) return message.replace(/Koukoutu/g, "抠抠图");
    return message.includes("Pixian") ? message : `Pixian 额度不足：${message}`;
  }
  if (/auth|credential|secret|password|unauthorized|forbidden|401|403/i.test(message)) {
    if (/Koukoutu|抠抠图|api key/i.test(message)) return "抠抠图认证失败，请检查 API Key。";
    return "Pixian 认证失败，请检查 API Id 和 Secret。";
  }
  if (/Koukoutu/i.test(message)) return message.replace(/Koukoutu/g, "抠抠图");
  if (/Pixian/i.test(message)) return message;
  return message || "处理失败";
}

async function readPixianError(response) {
  const text = await response.text();
  try {
    const data = JSON.parse(text);
    return data?.error?.message || text;
  } catch (error) {
    return text;
  }
}

async function readKoukoutuError(response) {
  const text = await response.text();
  try {
    const data = JSON.parse(text);
    return data?.message || data?.error?.message || text;
  } catch (error) {
    return text;
  }
}

function canvasFromBitmap(bitmap) {
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  return canvas;
}

async function blobToCanvas(blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = canvasFromBitmap(bitmap);
  if (typeof bitmap.close === "function") bitmap.close();
  return canvas;
}

function removeBackground(canvas, options) {
  const { alphaMask, width, height } = generateMask(canvas, options);
  const output = applyMaskToRGBA(canvas, alphaMask);
  const ctx = output.getContext("2d", { willReadFrequently: true });
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;

  if (options.shrink > 0) shrinkEdges(data, alphaMask, width, height, options.shrink);
  if (options.feather > 0) softenEdges(data, alphaMask, width, height, options.feather);

  ctx.putImageData(image, 0, 0);
  return output;
}

function generateMask(canvas, options) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  const { width, height } = image;
  const bg = estimateBackground(data, width, height);
  const alphaMask =
    options.matting === "standard"
      ? floodFillBackground(data, width, height, bg, options.tolerance)
      : floodFillBackgroundSmart(data, width, height, bg, options);

  return { alphaMask, width, height, background: bg };
}

function applyMaskToRGBA(canvas, alphaMask) {
  const output = document.createElement("canvas");
  output.width = canvas.width;
  output.height = canvas.height;
  const ctx = output.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(canvas, 0, 0);
  const image = ctx.getImageData(0, 0, output.width, output.height);
  const data = image.data;

  if (alphaMask.length !== output.width * output.height) {
    throw new Error("Mask size does not match image size");
  }

  for (let i = 0; i < alphaMask.length; i += 1) {
    if (alphaMask[i]) data[i * 4 + 3] = 0;
  }

  ctx.putImageData(image, 0, 0);
  return output;
}

function estimateBackground(data, width, height) {
  const points = [];
  const patch = Math.max(6, Math.min(24, Math.floor(Math.min(width, height) * 0.045)));
  const corners = [
    [0, 0],
    [width - patch, 0],
    [0, height - patch],
    [width - patch, height - patch],
  ];

  for (const [sx, sy] of corners) {
    for (let y = sy; y < sy + patch; y += 2) {
      for (let x = sx; x < sx + patch; x += 2) {
        const index = (y * width + x) * 4;
        points.push([data[index], data[index + 1], data[index + 2]]);
      }
    }
  }

  return medianColor(points);
}

function medianColor(points) {
  const channels = [0, 1, 2].map((channel) =>
    points.map((point) => point[channel]).sort((a, b) => a - b),
  );
  const middle = Math.floor(points.length / 2);
  return [channels[0][middle], channels[1][middle], channels[2][middle]];
}

function floodFillBackground(data, width, height, bg, tolerance) {
  const mask = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);
  const stack = [];
  const toleranceSq = tolerance * tolerance;

  const pushIfBg = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const pixel = y * width + x;
    if (visited[pixel]) return;
    visited[pixel] = 1;
    const index = pixel * 4;
    if (data[index + 3] < 12 || colorDistanceSq(data, index, bg) <= toleranceSq) {
      mask[pixel] = 1;
      stack.push(pixel);
    }
  };

  for (let x = 0; x < width; x += 1) {
    pushIfBg(x, 0);
    pushIfBg(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    pushIfBg(0, y);
    pushIfBg(width - 1, y);
  }

  while (stack.length) {
    const pixel = stack.pop();
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    pushIfBg(x + 1, y);
    pushIfBg(x - 1, y);
    pushIfBg(x, y + 1);
    pushIfBg(x, y - 1);
  }

  return mask;
}

function floodFillBackgroundSmart(data, width, height, bg, options) {
  const mask = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);
  const stack = [];
  const bgPalette = buildBackgroundPalette(data, width, height, bg);
  const fgPalette = buildForegroundPalette(data, width, height, bgPalette, options.tolerance);
  const labLimit = Math.max(7, options.tolerance * (options.matting === "similar-strong" ? 0.78 : 0.62));
  const softLimit = labLimit * (options.matting === "similar-strong" ? 2.35 : 1.78);
  const stepLimit = labLimit * (options.matting === "similar-strong" ? 1.95 : 1.42);
  const protectMargin = options.matting === "similar-strong" ? 2.5 : 6;

  const shouldProtect = (lab, bgDistance) => {
    if (!fgPalette.length) return false;
    return nearestLabDistance(lab, fgPalette) + protectMargin < bgDistance;
  };

  const pushIfBg = (x, y, previousLab = null) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const pixel = y * width + x;
    if (visited[pixel]) return;
    visited[pixel] = 1;

    const index = pixel * 4;
    if (data[index + 3] < 12) {
      mask[pixel] = 1;
      stack.push(pixel);
      return;
    }

    const lab = pixelLabAt(data, index);
    const bgDistance = nearestLabDistance(lab, bgPalette);
    const stepDistance = previousLab ? labDistance(lab, previousLab) : 0;
    const directBackground = bgDistance <= labLimit;
    const continuousBackground = bgDistance <= softLimit && stepDistance <= stepLimit;

    if ((directBackground || continuousBackground) && !shouldProtect(lab, bgDistance)) {
      mask[pixel] = 1;
      stack.push(pixel);
    }
  };

  for (let x = 0; x < width; x += 1) {
    pushIfBg(x, 0);
    pushIfBg(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    pushIfBg(0, y);
    pushIfBg(width - 1, y);
  }

  while (stack.length) {
    const pixel = stack.pop();
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    const lab = pixelLabAt(data, pixel * 4);
    pushIfBg(x + 1, y, lab);
    pushIfBg(x - 1, y, lab);
    pushIfBg(x, y + 1, lab);
    pushIfBg(x, y - 1, lab);
  }

  return mask;
}

function colorDistanceSq(data, index, bg) {
  const dr = data[index] - bg[0];
  const dg = data[index + 1] - bg[1];
  const db = data[index + 2] - bg[2];
  return dr * dr + dg * dg + db * db;
}

function buildBackgroundPalette(data, width, height, bg) {
  const palette = [rgbToLab(bg[0], bg[1], bg[2])];
  const step = Math.max(2, Math.floor(Math.min(width, height) / 90));
  const border = Math.max(3, Math.floor(Math.min(width, height) * 0.055));

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (x > border && x < width - border && y > border && y < height - border) continue;
      addPaletteSample(palette, pixelLabAt(data, (y * width + x) * 4), 9, 8);
    }
  }

  return palette;
}

function buildForegroundPalette(data, width, height, bgPalette, tolerance) {
  const palette = [];
  const step = Math.max(2, Math.floor(Math.min(width, height) / 70));
  const minX = Math.floor(width * 0.24);
  const maxX = Math.ceil(width * 0.76);
  const minY = Math.floor(height * 0.2);
  const maxY = Math.ceil(height * 0.8);
  const minDistance = Math.max(9, tolerance * 0.42);

  for (let y = minY; y < maxY; y += step) {
    for (let x = minX; x < maxX; x += step) {
      const lab = pixelLabAt(data, (y * width + x) * 4);
      if (nearestLabDistance(lab, bgPalette) >= minDistance) {
        addPaletteSample(palette, lab, 8, 10);
      }
    }
  }

  return palette;
}

function addPaletteSample(palette, lab, minDistance, maxSize) {
  if (palette.length >= maxSize) return;
  if (!palette.length || nearestLabDistance(lab, palette) >= minDistance) {
    palette.push(lab);
  }
}

function pixelLabAt(data, index) {
  return rgbToLab(data[index], data[index + 1], data[index + 2]);
}

function nearestLabDistance(lab, palette) {
  let best = Infinity;
  for (const color of palette) {
    best = Math.min(best, labDistance(lab, color));
  }
  return best;
}

function labDistance(a, b) {
  const dl = a[0] - b[0];
  const da = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dl * dl + da * da + db * db);
}

function rgbToLab(r, g, b) {
  let sr = r / 255;
  let sg = g / 255;
  let sb = b / 255;
  sr = sr > 0.04045 ? ((sr + 0.055) / 1.055) ** 2.4 : sr / 12.92;
  sg = sg > 0.04045 ? ((sg + 0.055) / 1.055) ** 2.4 : sg / 12.92;
  sb = sb > 0.04045 ? ((sb + 0.055) / 1.055) ** 2.4 : sb / 12.92;

  let x = (sr * 0.4124 + sg * 0.3576 + sb * 0.1805) / 0.95047;
  let y = (sr * 0.2126 + sg * 0.7152 + sb * 0.0722) / 1.0;
  let z = (sr * 0.0193 + sg * 0.1192 + sb * 0.9505) / 1.08883;

  x = x > 0.008856 ? Math.cbrt(x) : 7.787 * x + 16 / 116;
  y = y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116;
  z = z > 0.008856 ? Math.cbrt(z) : 7.787 * z + 16 / 116;

  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

function smartEraseAt(canvas, startX, startY, tolerance, edgeStrength) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  const { width, height } = image;
  const startPixel = startY * width + startX;
  const startIndex = startPixel * 4;
  if (data[startIndex + 3] < 12) return 0;

  const mask = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);
  const targetLab = pixelLabAt(data, startIndex);
  const hardLimit = Math.max(4, tolerance * 0.72);
  const softLimit = hardLimit * 1.62;
  const stepLimit = hardLimit * 1.2;
  const stack = [{ pixel: startPixel, lab: targetLab }];
  let removed = 0;

  visited[startPixel] = 1;

  const pushNeighbor = (x, y, previousLab) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const pixel = y * width + x;
    if (visited[pixel]) return;
    visited[pixel] = 1;

    const index = pixel * 4;
    if (data[index + 3] < 12) {
      mask[pixel] = 1;
      return;
    }

    const lab = pixelLabAt(data, index);
    const directDistance = labDistance(lab, targetLab);
    const stepDistance = labDistance(lab, previousLab);
    if (directDistance <= hardLimit || (directDistance <= softLimit && stepDistance <= stepLimit)) {
      stack.push({ pixel, lab });
    }
  };

  while (stack.length) {
    const { pixel, lab } = stack.pop();
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    const alphaIndex = pixel * 4 + 3;
    if (data[alphaIndex] >= 12) {
      data[alphaIndex] = 0;
      mask[pixel] = 1;
      removed += 1;
    }

    pushNeighbor(x + 1, y, lab);
    pushNeighbor(x - 1, y, lab);
    pushNeighbor(x, y + 1, lab);
    pushNeighbor(x, y - 1, lab);
  }

  if (!removed) return 0;
  refineEditedEdges(data, mask, width, height, edgeStrength);
  ctx.putImageData(image, 0, 0);
  return removed;
}

function refineEditedEdges(data, mask, width, height, strength) {
  const amount = Math.max(0, Math.min(1, strength / 100));
  if (!amount) return;

  const radius = strength >= 72 ? 2 : 1;
  const originalAlpha = new Uint8ClampedArray(width * height);
  for (let i = 0; i < originalAlpha.length; i += 1) {
    originalAlpha[i] = data[i * 4 + 3];
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      if (mask[pixel]) continue;

      let erasedNeighbors = 0;
      let checked = 0;
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          checked += 1;
          if (mask[ny * width + nx]) erasedNeighbors += 1;
        }
      }

      if (erasedNeighbors > 0) {
        const edgeRatio = erasedNeighbors / Math.max(1, checked);
        data[pixel * 4 + 3] = Math.max(0, Math.round(originalAlpha[pixel] * (1 - edgeRatio * amount * 0.92)));
      }
    }
  }
}

function shrinkEdges(data, mask, width, height, amount) {
  const neighbors = [
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
  ];

  for (let step = 0; step < amount; step += 1) {
    const remove = [];

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const pixel = y * width + x;
        if (mask[pixel]) continue;

        for (const [dx, dy] of neighbors) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (mask[ny * width + nx]) {
            remove.push(pixel);
            break;
          }
        }
      }
    }

    for (const pixel of remove) {
      mask[pixel] = 1;
      data[pixel * 4 + 3] = 0;
    }
  }
}

function softenEdges(data, mask, width, height, radius) {
  const originalAlpha = new Uint8ClampedArray(width * height);
  for (let i = 0; i < originalAlpha.length; i += 1) {
    originalAlpha[i] = data[i * 4 + 3];
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      if (mask[pixel]) continue;

      let backgroundNeighbors = 0;
      let checked = 0;
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          checked += 1;
          if (mask[ny * width + nx]) backgroundNeighbors += 1;
        }
      }

      if (backgroundNeighbors > 0) {
        const edgeRatio = backgroundNeighbors / Math.max(1, checked);
        data[pixel * 4 + 3] = Math.max(42, Math.round(originalAlpha[pixel] * (1 - edgeRatio * 0.68)));
      }
    }
  }
}

function trimTransparent(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const alpha = data[(y * canvas.width + x) * 4 + 3];
      if (alpha > 8) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) return canvas;

  const padding = Math.ceil(Math.min(canvas.width, canvas.height) * 0.025);
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(canvas.width - 1, maxX + padding);
  maxY = Math.min(canvas.height - 1, maxY + padding);

  const trimmed = document.createElement("canvas");
  trimmed.width = maxX - minX + 1;
  trimmed.height = maxY - minY + 1;
  trimmed.getContext("2d").drawImage(canvas, minX, minY, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height);
  return trimmed;
}

function getSafeScale(canvas, requestedScale) {
  const requestedPixels = canvas.width * requestedScale * canvas.height * requestedScale;
  if (requestedPixels <= MAX_OUTPUT_PIXELS) return requestedScale;
  return Math.max(1, Math.floor(Math.sqrt(MAX_OUTPUT_PIXELS / (canvas.width * canvas.height))));
}

async function removeBackgroundWithRunningHub(file, options, item = null) {
  const label = getRemoveBgStatusLabel(options);
  if (!REMOVE_BG_PROXY_URL) {
    console.log(`[${label}] request_skipped`, {
      provider: "runninghub",
      workflow: options.model,
      hasProxyUrl: false,
      fileSize: file.size,
      fileType: file.type || "unknown",
    });
    throw createRunningHubProviderError("RunningHub 抠图服务未配置", {
      stage: "config",
      detail: "请先部署 runninghub-removebg-worker.js，并把 Worker 地址填入 config.js 的 REMOVE_BG_PROXY_URL。",
    });
  }

  console.log(`[${label}] request`, {
    provider: "runninghub",
    workflow: options.model,
    hasProxyUrl: Boolean(REMOVE_BG_PROXY_URL),
    fileSize: file.size,
    fileType: file.type || "unknown",
  });

  const outputBlob = await requestRunningHubRemoveBg(file, {
    label,
    workflowId: options.model,
    onPoll: (pollCount, message) => {
      if (!item) return;
      const suffix = pollCount > 0 ? `... 第 ${pollCount} 次检查` : "...";
      setCardStatus(item, `${message}${suffix}`, "is-working");
    },
  });
  return blobToCanvas(outputBlob);
}

async function requestRunningHubRemoveBg(file, { label, workflowId, onPoll = null }) {
  const body = new FormData();
  body.set("action", "create");
  body.set("file", file, file.name || "input.png");

  let response;
  try {
    response = await fetch(REMOVE_BG_PROXY_URL, {
      method: "POST",
      body,
    });
  } catch (error) {
    throw createRunningHubProviderError("Worker 请求失败", {
      stage: "worker_request",
      detail: error?.message || String(error),
    });
  }

  console.log(`[${label}] worker_response`, {
    provider: "runninghub",
    workflow: workflowId,
    action: "create",
    status: response.status,
    ok: response.ok,
  });

  if (isImageResponse(response)) return response.blob();

  if (!response.ok) {
    const errorInfo = await readRunningHubWorkerError(response);
    throw createRunningHubProviderError(errorInfo.message || "Worker 返回非 200", {
      stage: errorInfo.stage || "worker_response",
      status: response.status,
      detail: errorInfo.detail,
    });
  }

  const task = await readWorkerJson(response);
  if (!task?.ok || !task?.taskId) {
    throw createRunningHubProviderError(task?.message || "Worker 没有返回 RunningHub taskId", {
      stage: task?.stage || "create_task",
      status: response.status,
      detail: task?.detail || JSON.stringify(task),
    });
  }

  console.log(`[${label}] create removebg task`, {
    provider: "runninghub",
    workflow: workflowId,
    taskId: task.taskId,
    status: task.status,
  });
  onPoll?.(0, task.message || "RMBG-2.0 高质量抠图处理中");

  for (let pollCount = 1; pollCount <= RUNNINGHUB_REMOVEBG_MAX_POLLS; pollCount += 1) {
    await delay(RUNNINGHUB_REMOVEBG_POLL_INTERVAL_MS);
    const statusResponse = await requestRunningHubRemoveBgStatus(task.taskId);

    console.log(`[${label}] removebg poll`, {
      provider: "runninghub",
      workflow: workflowId,
      taskId: task.taskId,
      pollCount,
      status: statusResponse.headers.get("X-RemoveBG-Status") || statusResponse.status,
    });

    if (isImageResponse(statusResponse)) {
      console.log(`[${label}] removebg done`, {
        provider: "runninghub",
        workflow: workflowId,
        taskId: task.taskId,
        pollCount,
      });
      return statusResponse.blob();
    }

    const data = await readWorkerJson(statusResponse);
    if (!statusResponse.ok || data?.ok === false || data?.status === "failed") {
      throw createRunningHubProviderError(data?.message || "RunningHub 抠图任务失败", {
        stage: data?.stage || "poll_task",
        status: statusResponse.status,
        detail: data?.detail || JSON.stringify(data),
      });
    }

    onPoll?.(pollCount, data?.message || "RMBG-2.0 高质量抠图处理中");
  }

  throw createRunningHubProviderError("RMBG-2.0 高质量抠图超时，请稍后重试。", {
    stage: "poll_task",
    detail: `前端轮询 ${RUNNINGHUB_REMOVEBG_MAX_POLLS} 次仍未拿到透明抠图输出。`,
  });
}

async function requestRunningHubRemoveBgStatus(taskId) {
  try {
    return await fetch(REMOVE_BG_PROXY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "status",
        taskId,
      }),
    });
  } catch (error) {
    throw createRunningHubProviderError("Worker 状态查询失败", {
      stage: "worker_status_request",
      detail: error?.message || String(error),
    });
  }
}

function isImageResponse(response) {
  const contentType = response.headers.get("Content-Type") || "";
  return /^image\//i.test(contentType) || response.headers.get("X-RemoveBG-Status") === "done";
}

async function readWorkerJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      status: "failed",
      stage: "worker_response",
      message: `Worker 返回非 JSON：HTTP ${response.status}`,
      detail: text,
    };
  }
}

async function upscaleWithProvider(canvas, options) {
  const upscaleChoice = options.upscaleChoice || getUpscaleChoice(options.upscaleProvider);
  const providerKey = resolveUpscaleProvider({ ...options, upscaleChoice });
  const provider = providerKey === "runninghub" ? UPSCALE_PROVIDERS.runninghub : UPSCALE_PROVIDERS["canvas-resize"];
  return provider.process(canvas, {
    ...options,
    upscaleChoice,
    upscaleLabel: upscaleChoice.label,
  });
}

function resolveUpscaleProvider(options) {
  const requested = options.provider || options.upscaleProvider;
  const choice = options.upscaleChoice || getUpscaleChoice(requested);
  return choice.provider === "runninghub" ? "runninghub" : "resize";
}

async function upscaleWithRunningHub(canvas, options) {
  const scale = Number(options.scale);
  const preserveAlpha = options.preserveAlpha !== false;
  const upscaleLabel = getUpscaleStatusLabel(options);
  if (!UPSCALE_PROXY_URL) {
    console.log(`[${upscaleLabel}] request_skipped`, {
      provider: "runninghub",
      workflow: options.upscaleProvider,
      scale,
      hasProxyUrl: false,
      inputWidth: canvas.width,
      inputHeight: canvas.height,
    });
    throw createRunningHubProviderError("UPSCALE_PROXY_URL 为空：AI 高清增强服务未配置", {
      stage: "config",
      detail: "请先部署 runninghub-upscale-worker.js，并把 Worker 地址填入 config.js 的 UPSCALE_PROXY_URL。",
    });
  }
  if (![2, 4].includes(scale)) throw new Error(`${upscaleLabel}仅支持 2x 或 4x`);

  const hasAlpha = preserveAlpha && canvasHasAnyTransparency(canvas);
  console.log(`[${upscaleLabel}] request`, {
    provider: "runninghub",
    workflow: options.upscaleProvider,
    scale,
    hasProxyUrl: Boolean(UPSCALE_PROXY_URL),
    inputWidth: canvas.width,
    inputHeight: canvas.height,
    transparent: hasAlpha,
  });
  const sourceForAi = hasAlpha ? createOpaqueRgbCanvas(canvas) : canvas;
  const sourceBlob = await canvasToBlob(sourceForAi, "image/png");
  const enhancedRgb = await requestRunningHubUpscale(sourceBlob, {
    scale,
    preserveAlpha: hasAlpha,
    inputWidth: canvas.width,
    inputHeight: canvas.height,
    upscaleLabel,
    workflowId: options.upscaleProvider,
  });

  if (!hasAlpha) return enhancedRgb;

  const alphaMask = createAlphaCanvas(canvas);
  const resizedAlpha = resizeCanvasTo(alphaMask, Math.round(canvas.width * scale), Math.round(canvas.height * scale));
  return composeRgbWithAlpha(enhancedRgb, resizedAlpha);
}

async function requestRunningHubUpscale(blob, { scale, preserveAlpha, inputWidth, inputHeight, upscaleLabel, workflowId }) {
  const body = new FormData();
  body.set("image", blob, "input.png");
  body.set("scale", String(scale));
  body.set("preserveAlpha", preserveAlpha ? "1" : "0");

  let response;
  try {
    response = await fetch(UPSCALE_PROXY_URL, {
      method: "POST",
      body,
    });
  } catch (error) {
    throw createRunningHubProviderError("Worker 请求失败", {
      stage: "worker_request",
      detail: error?.message || String(error),
    });
  }

  console.log(`[${upscaleLabel}] worker_response`, {
    provider: "runninghub",
    workflow: workflowId,
    scale,
    inputWidth,
    inputHeight,
    transparent: preserveAlpha,
    status: response.status,
    ok: response.ok,
  });

  if (!response.ok) {
    const errorInfo = await readRunningHubWorkerError(response);
    throw createRunningHubProviderError(errorInfo.message || "Worker 返回非 200", {
      stage: errorInfo.stage || "worker_response",
      status: response.status,
      detail: errorInfo.detail,
    });
  }

  return blobToCanvas(await response.blob());
}

async function readRunningHubWorkerError(response) {
  const text = await response.text();
  try {
    const data = JSON.parse(text);
    if (data && typeof data === "object") {
      return {
        stage: data.stage,
        message: data.message || `Worker 返回非 200：HTTP ${response.status}`,
        detail: data.detail || data.error || text,
      };
    }
  } catch (error) {
    // Non-JSON errors are still useful in full for debugging.
  }

  return {
    stage: "worker_response",
    message: `Worker 返回非 200：HTTP ${response.status}`,
    detail: text,
  };
}

function createRunningHubProviderError(message, { stage, status, detail } = {}) {
  const parts = [message];
  if (stage) parts.push(`stage=${stage}`);
  if (status) parts.push(`status=${status}`);
  if (detail) parts.push(`detail=${detail}`);
  const error = new Error(parts.join(" | "));
  error.isRunningHubProviderError = true;
  error.stage = stage;
  error.status = status;
  error.detail = detail;
  return error;
}

function canvasHasAnyTransparency(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] < 255) return true;
  }
  return false;
}

function createOpaqueRgbCanvas(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  const fill = getAverageOpaqueColor(data);

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3];
    if (alpha === 0) {
      data[index] = fill.r;
      data[index + 1] = fill.g;
      data[index + 2] = fill.b;
    }
    data[index + 3] = 255;
  }

  const output = document.createElement("canvas");
  output.width = canvas.width;
  output.height = canvas.height;
  output.getContext("2d").putImageData(image, 0, 0);
  return output;
}

function getAverageOpaqueColor(data) {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3];
    if (alpha < 32) continue;
    r += data[index];
    g += data[index + 1];
    b += data[index + 2];
    count += 1;
  }

  if (!count) return { r: 255, g: 255, b: 255 };
  return {
    r: Math.round(r / count),
    g: Math.round(g / count),
    b: Math.round(b / count),
  };
}

function createAlphaCanvas(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const source = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = source.data;
  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3];
    data[index] = alpha;
    data[index + 1] = alpha;
    data[index + 2] = alpha;
    data[index + 3] = 255;
  }

  const output = document.createElement("canvas");
  output.width = canvas.width;
  output.height = canvas.height;
  output.getContext("2d").putImageData(source, 0, 0);
  return output;
}

function resizeCanvasTo(canvas, width, height) {
  const output = document.createElement("canvas");
  output.width = Math.max(1, Math.round(width));
  output.height = Math.max(1, Math.round(height));
  const ctx = output.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, output.width, output.height);
  return output;
}

function composeRgbWithAlpha(rgbCanvas, alphaCanvas) {
  const output = resizeCanvasTo(rgbCanvas, alphaCanvas.width, alphaCanvas.height);
  const outCtx = output.getContext("2d", { willReadFrequently: true });
  const alphaCtx = alphaCanvas.getContext("2d", { willReadFrequently: true });
  const rgbImage = outCtx.getImageData(0, 0, output.width, output.height);
  const alphaImage = alphaCtx.getImageData(0, 0, alphaCanvas.width, alphaCanvas.height);
  const rgbData = rgbImage.data;
  const alphaData = alphaImage.data;

  for (let index = 0; index < rgbData.length; index += 4) {
    const alpha = alphaData[index];
    rgbData[index + 3] = alpha;
    if (alpha === 0) {
      rgbData[index] = 0;
      rgbData[index + 1] = 0;
      rgbData[index + 2] = 0;
    }
  }

  outCtx.putImageData(rgbImage, 0, 0);
  return output;
}

function upscaleCanvas(canvas, scale) {
  if (scale <= 1) return canvas;
  const output = document.createElement("canvas");
  output.width = Math.round(canvas.width * scale);
  output.height = Math.round(canvas.height * scale);
  const ctx = output.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, output.width, output.height);
  return output;
}

function applyOutputBackground(canvas, color) {
  if (!color) return canvas;

  const output = document.createElement("canvas");
  output.width = canvas.width;
  output.height = canvas.height;
  const ctx = output.getContext("2d");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, output.width, output.height);
  ctx.drawImage(canvas, 0, 0);
  return output;
}

function sharpenCanvas(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const source = new Uint8ClampedArray(image.data);
  const data = image.data;
  const { width, height } = image;
  const amount = 0.22;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const center = source[index + channel];
        const blur =
          (source[index - width * 4 + channel] +
            source[index - 4 + channel] +
            source[index + 4 + channel] +
            source[index + width * 4 + channel]) /
          4;
        data[index + channel] = clamp(center + (center - blur) * amount);
      }
    }
  }

  ctx.putImageData(image, 0, 0);
}

function copyCanvas(source, target) {
  target.width = source.width;
  target.height = source.height;
  const ctx = target.getContext("2d");
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.drawImage(source, 0, 0);
}

function cloneCanvas(source) {
  const canvas = document.createElement("canvas");
  copyCanvas(source, canvas);
  return canvas;
}

function setCardStatus(item, text, className) {
  item.status.className = `card-status ${className}`;
  item.status.textContent = text;
  item.status.title = text;
}

function getTaskWorkingStatusText(options) {
  if (usesNamedRunningHubRemoveBg(options)) return `${getRemoveBgStatusLabel(options)}处理中...`;
  if (usesNamedRunningHubUpscale(options)) return `${getUpscaleStatusLabel(options)}处理中...`;
  return "处理中";
}

function getTaskDoneStatusText(options) {
  if (usesNamedRunningHubRemoveBg(options)) return `${getRemoveBgStatusLabel(options)}完成`;
  if (usesNamedRunningHubUpscale(options)) return `${getUpscaleStatusLabel(options)}完成`;
  return "已完成";
}

function getTaskFailureStatusText(options, error) {
  const errorText = getProcessingErrorText(error);
  if (usesNamedRunningHubRemoveBg(options)) return `${getRemoveBgStatusLabel(options)}失败：${errorText}`;
  if (usesNamedRunningHubUpscale(options)) return `${getUpscaleStatusLabel(options)}失败：${errorText}`;
  return errorText;
}

function usesNamedRunningHubRemoveBg(options) {
  return options.mode !== "upscale" && options.removeBgProvider === "runninghub";
}

function usesNamedRunningHubUpscale(options) {
  return options.mode !== "cutout" && resolveUpscaleProvider(options) === "runninghub";
}

function getRemoveBgStatusLabel(options) {
  return options.removeBgLabel || options.removeBgChoice?.label || getRemoveBgChoice(options.model).label;
}

function getUpscaleStatusLabel(options) {
  return options.upscaleLabel || options.upscaleChoice?.label || getUpscaleChoice(options.upscaleProvider).label;
}

function resetResultCanvas(item) {
  item.resultCanvas.classList.remove("is-previewable");
  item.resultCanvas.width = 1;
  item.resultCanvas.height = 1;
  const ctx = item.resultCanvas.getContext("2d");
  ctx.clearRect(0, 0, item.resultCanvas.width, item.resultCanvas.height);
}

function updateUi() {
  const total = state.items.length;
  const completed = state.items.filter((item) => item.blob).length;
  state.items.forEach((item) => {
    item.deleteButton.disabled = state.isProcessing;
  });
  els.emptyState.classList.toggle("is-hidden", total > 0);
  els.mainWorkspace.classList.toggle("has-items", total > 0);
  const missingPixianCredentials = total > 0 && needsPixianCredentials() && !hasPixianCredentials();
  const missingKoukoutuCredentials = total > 0 && needsKoukoutuCredentials() && !hasKoukoutuCredentials();
  const missingApiCredentials = missingPixianCredentials || missingKoukoutuCredentials;
  els.processButton.disabled = total === 0 || state.isProcessing || missingApiCredentials;
  const removeBgProvider = getSelectedRemoveBgChoice().provider;
  els.pixianCheckCreditsButton.disabled =
    removeBgProvider !== "pixian" || state.isProcessing || !hasPixianCredentials();
  els.koukoutuCheckCreditsButton.disabled =
    removeBgProvider !== "koukoutu" || state.isProcessing || !hasKoukoutuCredentials();
  els.downloadButton.disabled = completed === 0 || state.isProcessing;
  els.clearButton.disabled = total === 0 || state.isProcessing;
  els.uploadMoreButton.disabled = state.isProcessing;
  els.queueStatus.textContent = total ? `${total} 张图片` : "待上传";
  els.hintText.textContent = missingApiCredentials
    ? missingKoukoutuCredentials
      ? "抠抠图需要 API Key；可在左侧入口获取并填入。"
      : "Pixian 需要 API Id 和 Secret；可在左侧入口获取并填入。"
    : total
      ? "调整左侧参数后可以重新处理，结果会覆盖当前预览。"
      : "上传图片后会在这里显示原图与处理结果。";
  updateProgress(completed, total);
}

function updateProgress(done, total) {
  els.progressText.textContent = `${done} / ${total}`;
  els.progressBar.style.width = total ? `${Math.round((done / total) * 100)}%` : "0%";
}

function setWorkspaceDragging(isDragging) {
  els.mainWorkspace.classList.toggle("is-dragging", isDragging);
  els.dropZone.classList.toggle("is-dragging", isDragging && !state.items.length);
}

function clearQueue() {
  if (els.previewModal.open) els.previewModal.close();
  if (els.editModal.open) els.editModal.close();
  for (const item of state.items) cleanupQueueItem(item);
  state.items = [];
  els.imageGrid.replaceChildren();
  updateUi();
}

function removeQueueItem(item) {
  if (state.isProcessing) return;
  if (previewItem === item && els.previewModal.open) els.previewModal.close();
  if (editItem === item && els.editModal.open) els.editModal.close();
  cleanupQueueItem(item);
  state.items = state.items.filter((candidate) => candidate !== item);
  item.card.remove();
  updateUi();
}

function cleanupQueueItem(item) {
  if (!item) return;
  if (item.url) {
    URL.revokeObjectURL(item.url);
    item.url = null;
  }
  if (item.bitmap && typeof item.bitmap.close === "function") item.bitmap.close();
  item.bitmap = null;
  item.file = null;
  item.blob = null;
  item.editorSubjectCanvas = null;
  item.editorBackgroundColor = null;
  if (item.original) item.original.removeAttribute("src");
  if (item.resultCanvas) {
    const ctx = item.resultCanvas.getContext("2d");
    ctx?.clearRect(0, 0, item.resultCanvas.width, item.resultCanvas.height);
    item.resultCanvas.width = 0;
    item.resultCanvas.height = 0;
  }
}

async function downloadAll() {
  const ready = state.items.filter((item) => item.blob);
  if (!ready.length) return;
  if (ready.length === 1) {
    downloadBlob(ready[0].blob, ready[0].outputName);
    return;
  }
  const zipBlob = await createZip(
    ready.map((item) => ({
      name: item.outputName,
      blob: item.blob,
    })),
  );
  downloadBlob(zipBlob, `batch-cutout-upscale-${dateStamp()}.zip`);
}

function canvasToBlob(canvas, type = "image/png", quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas export failed"));
    }, type, quality);
  });
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function createZip(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const bytes = new Uint8Array(await file.blob.arrayBuffer());
    const crc = crc32(bytes);
    const localHeader = zipLocalHeader(nameBytes, bytes.length, crc);
    localParts.push(localHeader, bytes);
    centralParts.push(zipCentralHeader(nameBytes, bytes.length, crc, offset));
    offset += localHeader.length + bytes.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = zipEndRecord(files.length, centralSize, offset);
  return new Blob([...localParts, ...centralParts, end], { type: "application/zip" });
}

function zipLocalHeader(nameBytes, size, crc) {
  const header = new Uint8Array(30 + nameBytes.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0x0800, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, size, true);
  view.setUint32(22, size, true);
  view.setUint16(26, nameBytes.length, true);
  header.set(nameBytes, 30);
  return header;
}

function zipCentralHeader(nameBytes, size, crc, offset) {
  const header = new Uint8Array(46 + nameBytes.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0x0800, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint16(14, 0, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, size, true);
  view.setUint32(24, size, true);
  view.setUint16(28, nameBytes.length, true);
  view.setUint32(42, offset, true);
  header.set(nameBytes, 46);
  return header;
}

function zipEndRecord(fileCount, centralSize, centralOffset) {
  const header = new Uint8Array(22);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, fileCount, true);
  view.setUint16(10, fileCount, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, centralOffset, true);
  return header;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function makeOutputName(name) {
  const dot = name.lastIndexOf(".");
  const base = dot > -1 ? name.slice(0, dot) : name;
  return `${sanitizeName(base)}-processed.png`;
}

function sanitizeName(name) {
  return name.replace(/[\\/:*?"<>|]+/g, "-").trim() || "image";
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function dateStamp() {
  const date = new Date();
  const part = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${part(date.getMonth() + 1)}${part(date.getDate())}-${part(date.getHours())}${part(date.getMinutes())}`;
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
