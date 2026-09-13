export interface Point2D {
  x: number;
  y: number;
}

export interface CalibrationCalculation {
  measuredPixels: number;
  actualFeet: number;
  currentPixelsPerFoot: number;
  apexPixelsPerFoot: number; // exactly 9.60
  scaleRatio: number;
  originalWidth: number;
  originalHeight: number;
  calibratedWidth: number;
  calibratedHeight: number;
}

export interface BlueprintAdjustments {
  contrast: number; // 100% is normal, 100-250
  brightness: number; // 100% is normal
  invert: boolean;
  grayscale: boolean;
  rotation: number; // 0, 90, 180, 270
}

export interface CropArea {
  active: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfPageInfo {
  pageNumber: number;
  numPages: number;
  renderScale: number; // 1.5x, 2x, 3x for crisp text
}
