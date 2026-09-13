/**
 * Robust parser for architectural and appraisal dimensions.
 * Handles decimal feet (e.g. 24.5), feet and inches (e.g. 24' 6", 24-6, 24'6-1/2"),
 * and fraction formats.
 */

export interface ParsedDimension {
  feet: number;
  formatted: string;
  isValid: boolean;
  error?: string;
}

export function parseDimension(input: string | number): ParsedDimension {
  if (typeof input === 'number') {
    if (isNaN(input) || input <= 0) {
      return { feet: 0, formatted: '0 ft', isValid: false, error: 'Dimension must be greater than 0' };
    }
    return { feet: input, formatted: `${input} ft`, isValid: true };
  }

  const raw = String(input).trim();
  if (!raw) {
    return { feet: 0, formatted: '', isValid: false, error: 'Please enter a wall dimension' };
  }

  // Pure decimal number (e.g. "24.5", "52")
  const numericOnly = Number(raw.replace(/[^\d.-]/g, ''));
  if (/^[\d.]+$/.test(raw)) {
    const val = parseFloat(raw);
    if (!isNaN(val) && val > 0) {
      return { feet: val, formatted: `${val} ft`, isValid: true };
    }
  }

  // Handle architectural feet-inches formats like:
  // 24' 6" | 24'-6" | 24'6 | 24 - 6 | 24 6
  // Check for feet mark ' or -
  const ftInMatch = raw.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft|feet|-)\s*(\d+(?:\.\d+)?|\d+\/\d+|\d+\s+\d+\/\d+)?\s*(?:"|in|inch|inches)?$/i);
  if (ftInMatch) {
    const feetPart = parseFloat(ftInMatch[1]);
    let inchesPart = 0;

    if (ftInMatch[2]) {
      const inRaw = ftInMatch[2].trim();
      // check if fraction like 1/2 or 6 1/2
      if (inRaw.includes('/')) {
        const parts = inRaw.split(/\s+/);
        if (parts.length === 2) {
          const whole = parseFloat(parts[0]);
          const fracParts = parts[1].split('/');
          inchesPart = whole + parseFloat(fracParts[0]) / parseFloat(fracParts[1]);
        } else {
          const fracParts = inRaw.split('/');
          inchesPart = parseFloat(fracParts[0]) / parseFloat(fracParts[1]);
        }
      } else {
        inchesPart = parseFloat(inRaw);
      }
    }

    if (!isNaN(feetPart) && feetPart >= 0 && !isNaN(inchesPart) && inchesPart >= 0) {
      const totalFeet = feetPart + inchesPart / 12;
      if (totalFeet > 0) {
        return {
          feet: Number(totalFeet.toFixed(4)),
          formatted: `${feetPart}' ${inchesPart > 0 ? inchesPart.toFixed(1) + '"' : '0"'} (${totalFeet.toFixed(2)} ft)`,
          isValid: true,
        };
      }
    }
  }

  // Fallback to numeric extraction if reasonable
  if (!isNaN(numericOnly) && numericOnly > 0) {
    return {
      feet: numericOnly,
      formatted: `${numericOnly} ft`,
      isValid: true,
    };
  }

  return {
    feet: 0,
    formatted: raw,
    isValid: false,
    error: 'Unrecognized dimension format (try e.g. 24.5 or 24\' 6")',
  };
}
