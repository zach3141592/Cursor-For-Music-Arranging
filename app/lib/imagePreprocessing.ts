/**
 * Image Preprocessing Module for Sheet Music
 * Handles resize, contrast enhancement, and quality assessment
 */

export interface PreprocessOptions {
  maxDimension?: number      // Default: 2048 (optimal for GPT-4o)
  enhanceContrast?: boolean  // Default: true
  contrastFactor?: number    // Default: 1.3 (1.0 = no change)
}

export interface QualityReport {
  width: number
  height: number
  contrastScore: number      // 0-1, higher is better
  sharpnessScore: number     // 0-1, higher is sharper
  isAcceptable: boolean
  warnings: string[]
  suggestions: string[]
}

export interface PreprocessResult {
  processedDataUrl: string
  originalSize: { width: number; height: number }
  processedSize: { width: number; height: number }
  quality: QualityReport
  processingApplied: string[]
}

/**
 * Load an image from a data URL into an HTMLImageElement
 */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = dataUrl
  })
}

/**
 * Clamp a value between 0 and 255
 */
function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

/**
 * Enhance contrast of image data using linear contrast stretch
 */
function enhanceContrastData(imageData: ImageData, factor: number): ImageData {
  const data = imageData.data
  const factor255 = (259 * (factor * 255 + 255)) / (255 * (259 - factor * 255))

  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp(factor255 * (data[i] - 128) + 128)         // R
    data[i + 1] = clamp(factor255 * (data[i + 1] - 128) + 128) // G
    data[i + 2] = clamp(factor255 * (data[i + 2] - 128) + 128) // B
    // Alpha unchanged
  }

  return imageData
}

/**
 * Measure contrast using RMS (Root Mean Square) contrast
 * Returns value between 0-1
 */
function measureContrast(imageData: ImageData): number {
  const data = imageData.data
  let sum = 0
  let sumSq = 0
  const n = data.length / 4

  for (let i = 0; i < data.length; i += 4) {
    const gray = (data[i] + data[i + 1] + data[i + 2]) / 3
    sum += gray
    sumSq += gray * gray
  }

  const mean = sum / n
  const variance = sumSq / n - mean * mean
  const rmsContrast = Math.sqrt(Math.max(0, variance)) / 255

  return Math.min(1, rmsContrast * 2) // Normalize to 0-1 range
}

/**
 * Measure sharpness using Laplacian variance
 * Higher variance = sharper image
 */
function measureSharpness(imageData: ImageData): number {
  const { data, width, height } = imageData

  // Skip edge pixels
  if (width < 3 || height < 3) return 0.5

  let laplacianSum = 0
  const samples = Math.min(10000, (width - 2) * (height - 2)) // Sample for performance
  const step = Math.max(1, Math.floor((width - 2) * (height - 2) / samples))

  let count = 0
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (count++ % step !== 0) continue

      const idx = (y * width + x) * 4
      const center = (data[idx] + data[idx + 1] + data[idx + 2]) / 3

      const neighbors = [
        ((y - 1) * width + x) * 4,
        ((y + 1) * width + x) * 4,
        (y * width + (x - 1)) * 4,
        (y * width + (x + 1)) * 4
      ]

      let sum = 0
      for (const ni of neighbors) {
        sum += (data[ni] + data[ni + 1] + data[ni + 2]) / 3
      }

      const laplacian = 4 * center - sum
      laplacianSum += laplacian * laplacian
    }
  }

  const variance = laplacianSum / (samples || 1)
  return Math.min(1, variance / 500) // Normalize to 0-1 range
}

/**
 * Assess image quality for sheet music recognition
 */
export function assessImageQuality(canvas: HTMLCanvasElement): QualityReport {
  const { width, height } = canvas
  const ctx = canvas.getContext('2d')!
  const imageData = ctx.getImageData(0, 0, width, height)

  const contrastScore = measureContrast(imageData)
  const sharpnessScore = measureSharpness(imageData)

  const warnings: string[] = []
  const suggestions: string[] = []

  // Resolution check
  if (width < 400 || height < 400) {
    warnings.push('Image resolution is low')
    suggestions.push('Use a higher resolution image for better accuracy')
  } else if (width < 800 || height < 800) {
    suggestions.push('Higher resolution may improve accuracy')
  }

  // Contrast check
  if (contrastScore < 0.15) {
    warnings.push('Very low contrast detected')
    suggestions.push('Ensure good lighting and a clear difference between notes and background')
  } else if (contrastScore < 0.25) {
    suggestions.push('Consider using a scanner or improving lighting for better contrast')
  }

  // Sharpness check
  if (sharpnessScore < 0.1) {
    warnings.push('Image appears blurry')
    suggestions.push('Hold camera steady or use a scanner for sharper results')
  } else if (sharpnessScore < 0.2) {
    suggestions.push('Image could be sharper - try holding camera more steady')
  }

  const isAcceptable = contrastScore >= 0.1 && sharpnessScore >= 0.05 && width >= 300 && height >= 200

  return {
    width,
    height,
    contrastScore,
    sharpnessScore,
    isAcceptable,
    warnings,
    suggestions
  }
}

/**
 * Preprocess an image for optimal sheet music recognition
 */
export async function preprocessImage(
  dataUrl: string,
  options: PreprocessOptions = {}
): Promise<PreprocessResult> {
  const {
    maxDimension = 2048,
    enhanceContrast = true,
    contrastFactor = 1.3
  } = options

  const processingApplied: string[] = []

  // Load the image
  const img = await loadImage(dataUrl)
  const originalSize = { width: img.width, height: img.height }

  // Create canvas
  let canvas = document.createElement('canvas')
  let ctx = canvas.getContext('2d')!

  // Calculate new dimensions (scale down if needed)
  let newWidth = img.width
  let newHeight = img.height

  if (img.width > maxDimension || img.height > maxDimension) {
    const scale = maxDimension / Math.max(img.width, img.height)
    newWidth = Math.round(img.width * scale)
    newHeight = Math.round(img.height * scale)
    processingApplied.push(`Resized from ${img.width}x${img.height} to ${newWidth}x${newHeight}`)
  }

  canvas.width = newWidth
  canvas.height = newHeight

  // Draw image with high-quality scaling
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, newWidth, newHeight)

  // Assess quality before contrast enhancement
  const preEnhanceQuality = assessImageQuality(canvas)

  // Apply contrast enhancement if enabled and needed
  if (enhanceContrast && preEnhanceQuality.contrastScore < 0.4) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    enhanceContrastData(imageData, contrastFactor)
    ctx.putImageData(imageData, 0, 0)
    processingApplied.push(`Applied contrast enhancement (factor: ${contrastFactor})`)
  }

  // Assess final quality
  const quality = assessImageQuality(canvas)

  // Convert to data URL (use JPEG for photos, PNG for clean scans)
  const mimeType = preEnhanceQuality.contrastScore > 0.5 ? 'image/png' : 'image/jpeg'
  const processedDataUrl = canvas.toDataURL(mimeType, 0.9)

  return {
    processedDataUrl,
    originalSize,
    processedSize: { width: newWidth, height: newHeight },
    quality,
    processingApplied
  }
}

/**
 * Quick quality check without full preprocessing
 */
export async function quickQualityCheck(dataUrl: string): Promise<QualityReport> {
  const img = await loadImage(dataUrl)

  const canvas = document.createElement('canvas')
  // Use smaller size for quick check
  const scale = Math.min(1, 500 / Math.max(img.width, img.height))
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)

  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  const report = assessImageQuality(canvas)
  // Adjust reported size to actual size
  report.width = img.width
  report.height = img.height

  return report
}
