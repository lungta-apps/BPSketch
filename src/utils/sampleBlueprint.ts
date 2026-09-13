/**
 * Generates a realistic sample blueprint on an offscreen canvas.
 * Useful for instant demonstration and testing of calibration workflows.
 */

export function generateSampleBlueprint(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  // High resolution blueprint canvas
  const w = 2400;
  const h = 1800;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Blueprint background (classic blueprint dark blue or clean appraisal white with blueprint title)
  // Let's create a blueprint style: soft blueprint grid, blueprint border, rooms, dimension lines
  ctx.fillStyle = '#0f2942'; // deep architectural blueprint blue
  ctx.fillRect(0, 0, w, h);

  // Subtle grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  const gridSize = 40;
  for (let x = 0; x < w; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Border & Title block
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 4;
  ctx.strokeRect(60, 60, w - 120, h - 120);
  ctx.strokeRect(68, 68, w - 136, h - 136);

  // Title block at bottom right
  const tbX = w - 650;
  const tbY = h - 260;
  ctx.fillStyle = 'rgba(15, 41, 66, 0.9)';
  ctx.fillRect(tbX, tbY, 510, 180);
  ctx.strokeRect(tbX, tbY, 510, 180);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px monospace';
  ctx.fillText('CITY RESIDENTIAL PLAN - ARCHITECTURAL', tbX + 20, tbY + 40);
  ctx.font = '16px monospace';
  ctx.fillStyle = '#93c5fd';
  ctx.fillText('PROJECT: SINGLE FAMILY RESIDENCE (2,450 SQ FT)', tbX + 20, tbY + 75);
  ctx.fillText('ORIGINAL SCALE: 1/4" = 1\'-0" (NOT CALIBRATED FOR APEX)', tbX + 20, tbY + 105);
  ctx.fillText('NOTE: CALIBRATE WITH APEX 1:1 SCALER FOR TRACING', tbX + 20, tbY + 135);
  ctx.fillText('SHEET A-1.1 | MAIN LEVEL FLOOR PLAN', tbX + 20, tbY + 165);

  // North Arrow
  const naX = 180;
  const naY = 180;
  ctx.strokeStyle = '#60a5fa';
  ctx.fillStyle = '#60a5fa';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(naX, naY, 40, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(naX, naY - 35);
  ctx.lineTo(naX - 12, naY + 15);
  ctx.lineTo(naX, naY);
  ctx.lineTo(naX + 12, naY + 15);
  ctx.closePath();
  ctx.fill();
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('N', naX - 7, naY - 45);

  // Main House Floor Plan Layout
  // Outer walls origin (ox, oy)
  const ox = 400;
  const oy = 350;

  // Real world dimensions:
  // Main North Wall: 48'-0" (width = 1152px, so here ~24 px/ft)
  // East Wall: 36'-0"
  // South-East inset: 16'-0"
  // South Wall: 32'-0"
  // West Wall: 20'-0" & 16'-0"
  const pxPerFt = 25; // in this uncalibrated drawing, 1 ft = 25 pixels

  const wallW1 = 48 * pxPerFt; // 1200 px (48'-0")
  const wallH1 = 36 * pxPerFt; // 900 px (36'-0")
  const garageW = 22 * pxPerFt; // 550 px (22'-0")
  const garageH = 24 * pxPerFt; // 600 px (24'-0")

  // Draw Wall Cavity (thick walls)
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 10;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';

  // Main House Box
  ctx.beginPath();
  // North wall
  ctx.moveTo(ox, oy);
  ctx.lineTo(ox + wallW1, oy);
  // East wall
  ctx.lineTo(ox + wallW1, oy + wallH1);
  // South wall
  ctx.lineTo(ox + garageW, oy + wallH1);
  // Garage drop
  ctx.lineTo(ox + garageW, oy + wallH1 + (garageH - (wallH1 - 12 * pxPerFt)));
  ctx.lineTo(ox, oy + wallH1 + (garageH - (wallH1 - 12 * pxPerFt)));
  ctx.lineTo(ox, oy);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Interior Partitions
  ctx.lineWidth = 6;
  ctx.beginPath();
  // Living Room / Kitchen dividing line
  ctx.moveTo(ox + 18 * pxPerFt, oy);
  ctx.lineTo(ox + 18 * pxPerFt, oy + 22 * pxPerFt);
  // Master Bed partition
  ctx.moveTo(ox + 30 * pxPerFt, oy);
  ctx.lineTo(ox + 30 * pxPerFt, oy + 20 * pxPerFt);
  ctx.moveTo(ox + 30 * pxPerFt, oy + 20 * pxPerFt);
  ctx.lineTo(ox + wallW1, oy + 20 * pxPerFt);
  // Garage wall separation
  ctx.moveTo(ox + garageW, oy + 18 * pxPerFt);
  ctx.lineTo(ox + garageW, oy + wallH1);
  ctx.stroke();

  // Room Labels
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('GREAT ROOM / LIVING', ox + 9 * pxPerFt, oy + 10 * pxPerFt);
  ctx.font = '16px monospace';
  ctx.fillStyle = '#93c5fd';
  ctx.fillText('18\'-0" x 22\'-0"', ox + 9 * pxPerFt, oy + 12 * pxPerFt);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('KITCHEN & DINING', ox + 24 * pxPerFt, oy + 8 * pxPerFt);
  ctx.font = '16px monospace';
  ctx.fillStyle = '#93c5fd';
  ctx.fillText('12\'-0" x 16\'-0"', ox + 24 * pxPerFt, oy + 10 * pxPerFt);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('PRIMARY SUITE', ox + 39 * pxPerFt, oy + 10 * pxPerFt);
  ctx.font = '16px monospace';
  ctx.fillStyle = '#93c5fd';
  ctx.fillText('18\'-0" x 20\'-0"', ox + 39 * pxPerFt, oy + 12 * pxPerFt);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('2-CAR GARAGE', ox + 11 * pxPerFt, oy + wallH1 + 6 * pxPerFt);
  ctx.font = '16px monospace';
  ctx.fillStyle = '#93c5fd';
  ctx.fillText('22\'-0" x 24\'-0"', ox + 11 * pxPerFt, oy + wallH1 + 8 * pxPerFt);

  // Dimension Lines with architectural ticks and clear text
  const drawDimension = (x1: number, y1: number, x2: number, y2: number, offset: number, label: string, isHoriz = true) => {
    ctx.strokeStyle = '#38bdf8';
    ctx.fillStyle = '#38bdf8';
    ctx.lineWidth = 2;

    const tickSize = 12;

    if (isHoriz) {
      const dimY = y1 + offset;
      // Extension lines
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1, dimY + (offset > 0 ? 8 : -8));
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2, dimY + (offset > 0 ? 8 : -8));
      ctx.stroke();

      // Main dimension line
      ctx.beginPath();
      ctx.moveTo(x1, dimY);
      ctx.lineTo(x2, dimY);
      ctx.stroke();

      // 45 degree architectural tick marks at exact endpoints
      ctx.beginPath();
      ctx.moveTo(x1 - tickSize, dimY + tickSize);
      ctx.lineTo(x1 + tickSize, dimY - tickSize);
      ctx.moveTo(x2 - tickSize, dimY + tickSize);
      ctx.lineTo(x2 + tickSize, dimY - tickSize);
      ctx.stroke();

      // Label with background badge
      const midX = (x1 + x2) / 2;
      ctx.font = 'bold 24px monospace';
      const textMetrics = ctx.measureText(label);
      const textW = textMetrics.width;

      ctx.fillStyle = '#0f2942';
      ctx.fillRect(midX - textW / 2 - 8, dimY - 16, textW + 16, 32);

      ctx.fillStyle = '#fef08a'; // bright yellow for high visibility
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, midX, dimY);
    } else {
      const dimX = x1 + offset;
      // Extension lines
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(dimX + (offset > 0 ? 8 : -8), y1);
      ctx.moveTo(x2, y2);
      ctx.lineTo(dimX + (offset > 0 ? 8 : -8), y2);
      ctx.stroke();

      // Main dimension line
      ctx.beginPath();
      ctx.moveTo(dimX, y1);
      ctx.lineTo(dimX, y2);
      ctx.stroke();

      // 45 degree architectural tick marks
      ctx.beginPath();
      ctx.moveTo(dimX - tickSize, y1 + tickSize);
      ctx.lineTo(dimX + tickSize, y1 - tickSize);
      ctx.moveTo(dimX - tickSize, y2 + tickSize);
      ctx.lineTo(dimX + tickSize, y2 - tickSize);
      ctx.stroke();

      // Label
      const midY = (y1 + y2) / 2;
      ctx.font = 'bold 24px monospace';
      const textMetrics = ctx.measureText(label);
      const textW = textMetrics.width;

      ctx.fillStyle = '#0f2942';
      ctx.fillRect(dimX - textW / 2 - 8, midY - 16, textW + 16, 32);

      ctx.fillStyle = '#fef08a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, dimX, midY);
    }
  };

  // Dimension 1: North Wall - 48'-0" (Primary Wall)
  drawDimension(ox, oy, ox + wallW1, oy, -60, "48'-0\"", true);

  // Dimension 2: East Wall - 36'-0"
  drawDimension(ox + wallW1, oy, ox + wallW1, oy + wallH1, 60, "36'-0\"", false);

  // Dimension 3: Living Room Width - 18'-0"
  drawDimension(ox, oy, ox + 18 * pxPerFt, oy, -120, "18'-0\"", true);

  // Dimension 4: Garage Width - 22'-0"
  drawDimension(ox, oy + wallH1 + 10 * pxPerFt, ox + garageW, oy + wallH1 + 10 * pxPerFt, 60, "22'-0\"", true);

  // Helpful Calibration Hint on Canvas
  ctx.textAlign = 'left';
  ctx.fillStyle = '#38bdf8';
  ctx.font = '16px sans-serif';
  ctx.fillText('💡 Tip: Click the left tick and right tick of the 48\'-0" wall to calibrate!', ox, oy - 160);

  return canvas;
}
