/**
 * Utility for injecting 96 DPI metadata into PNG files.
 * Apex Sketch expects 96 DPI (9.6 pixels per foot at 1" = 10' scale).
 * In the PNG specification, physical pixel dimensions are stored in the 'pHYs' chunk.
 * 96 DPI = 96 / 0.0254 meters ≈ 3780 pixels per meter.
 */

// Precomputed CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c;
}

function calculateCrc(buf: Uint8Array, offset: number, length: number): number {
  let c = 0xffffffff;
  for (let i = 0; i < length; i++) {
    c = crcTable[(c ^ buf[offset + i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Injects or updates a pHYs chunk with 96 DPI (3780 pixels/meter) in a PNG ArrayBuffer.
 */
export function inject96DpiIntoPng(pngBuffer: ArrayBuffer, dpi = 96): ArrayBuffer {
  const bytes = new Uint8Array(pngBuffer);

  // Check PNG signature: 137 80 78 71 13 10 26 10
  if (
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47 ||
    bytes[4] !== 0x0d ||
    bytes[5] !== 0x0a ||
    bytes[6] !== 0x1a ||
    bytes[7] !== 0x0a
  ) {
    console.warn('Not a valid PNG file, returning original buffer');
    return pngBuffer;
  }

  // 1 meter = 39.37007874 inches.
  // pixels per meter = Math.round(dpi / 0.0254)
  const ppm = Math.round(dpi / 0.0254); // For 96 DPI -> 3780 ppm

  // Build the 9-byte pHYs chunk data:
  // 4 bytes: X pixels per unit
  // 4 bytes: Y pixels per unit
  // 1 byte:  Unit specifier (1 = meter)
  const physChunkData = new Uint8Array(9);
  const dataView = new DataView(physChunkData.buffer);
  dataView.setUint32(0, ppm, false); // big-endian
  dataView.setUint32(4, ppm, false); // big-endian
  physChunkData[8] = 1; // 1 = meter

  // Build full pHYs chunk: Length (4 bytes) + Type "pHYs" (4 bytes) + Data (9 bytes) + CRC (4 bytes) = 21 bytes
  const physChunk = new Uint8Array(21);
  const physView = new DataView(physChunk.buffer);
  physView.setUint32(0, 9, false); // length = 9

  physChunk[4] = 0x70; // 'p'
  physChunk[5] = 0x48; // 'H'
  physChunk[6] = 0x79; // 'y'
  physChunk[7] = 0x53; // 'S'

  physChunk.set(physChunkData, 8);

  // CRC is computed over type (4 bytes) + data (9 bytes) = 13 bytes
  const crcVal = calculateCrc(physChunk, 4, 13);
  physView.setUint32(17, crcVal, false);

  // Now inspect existing chunks. We want to place pHYs immediately after IHDR chunk
  let pos = 8; // skip signature
  let ihdrEnd = -1;
  let existingPhysStart = -1;
  let existingPhysEnd = -1;

  while (pos < bytes.length) {
    const chunkView = new DataView(bytes.buffer, bytes.byteOffset + pos, 8);
    const chunkLength = chunkView.getUint32(0, false);
    const typeStr = String.fromCharCode(
      bytes[pos + 4],
      bytes[pos + 5],
      bytes[pos + 6],
      bytes[pos + 7]
    );

    if (typeStr === 'IHDR') {
      ihdrEnd = pos + 8 + chunkLength + 4;
    } else if (typeStr === 'pHYs') {
      existingPhysStart = pos;
      existingPhysEnd = pos + 8 + chunkLength + 4;
    }

    pos += 8 + chunkLength + 4;
    if (typeStr === 'IEND') break;
  }

  if (existingPhysStart !== -1) {
    // Replace existing pHYs chunk
    const newLength = bytes.length - (existingPhysEnd - existingPhysStart) + physChunk.length;
    const output = new Uint8Array(newLength);
    output.set(bytes.subarray(0, existingPhysStart), 0);
    output.set(physChunk, existingPhysStart);
    output.set(bytes.subarray(existingPhysEnd), existingPhysStart + physChunk.length);
    return output.buffer;
  }

  if (ihdrEnd !== -1) {
    // Insert pHYs right after IHDR
    const newLength = bytes.length + physChunk.length;
    const output = new Uint8Array(newLength);
    output.set(bytes.subarray(0, ihdrEnd), 0);
    output.set(physChunk, ihdrEnd);
    output.set(bytes.subarray(ihdrEnd), ihdrEnd + physChunk.length);
    return output.buffer;
  }

  return pngBuffer;
}

/**
 * Converts a Canvas to a PNG Blob with 96 DPI metadata embedded.
 */
export async function canvasTo96DpiBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const initialBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png');
  });

  if (!initialBlob) {
    throw new Error('Failed to generate PNG blob from canvas');
  }

  const arrayBuffer = await initialBlob.arrayBuffer();
  const calibratedBuffer = inject96DpiIntoPng(arrayBuffer, 96);
  return new Blob([calibratedBuffer], { type: 'image/png' });
}
