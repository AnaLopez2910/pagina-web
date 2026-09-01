export type QrMatrix = boolean[][];

const QR_VERSION = 9;
const QR_SIZE = QR_VERSION * 4 + 17;
const DATA_CODEWORDS_PER_BLOCK = 116;
const BLOCK_COUNT = 2;
const ECC_CODEWORDS_PER_BLOCK = 30;
const TOTAL_DATA_CODEWORDS = DATA_CODEWORDS_PER_BLOCK * BLOCK_COUNT;
const FORMAT_BITS_LOW_MASK_0 = 0x77c4;
const ALIGNMENT_POSITIONS = [6, 26, 46];

type QrPdfInput = {
  url: string;
  name: string;
  address: string;
  logoUrl?: string;
};

function getBit(value: number, index: number) {
  return ((value >>> index) & 1) !== 0;
}

function appendBits(bits: number[], value: number, length: number) {
  for (let index = length - 1; index >= 0; index -= 1) {
    bits.push((value >>> index) & 1);
  }
}

function bitsToCodewords(bits: number[]) {
  const codewords: number[] = [];
  for (let offset = 0; offset < bits.length; offset += 8) {
    let value = 0;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value << 1) | (bits[offset + bit] ?? 0);
    }
    codewords.push(value);
  }
  return codewords;
}

function encodeDataCodewords(text: string) {
  const bytes = Array.from(new TextEncoder().encode(text));
  if (bytes.length > 230) {
    throw new Error("La URL pública es demasiado larga para generar este QR.");
  }

  const bits: number[] = [];
  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, 8);
  for (const byte of bytes) {
    appendBits(bits, byte, 8);
  }

  const capacityBits = TOTAL_DATA_CODEWORDS * 8;
  appendBits(bits, 0, Math.min(4, capacityBits - bits.length));
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const codewords = bitsToCodewords(bits);
  const padding = [0xec, 0x11];
  for (let index = 0; codewords.length < TOTAL_DATA_CODEWORDS; index += 1) {
    codewords.push(padding[index % 2]);
  }

  return codewords;
}

function finiteFieldMultiply(left: number, right: number) {
  let product = 0;
  for (let index = 7; index >= 0; index -= 1) {
    product = (product << 1) ^ (((product >>> 7) & 1) * 0x11d);
    product ^= ((right >>> index) & 1) * left;
  }
  return product & 0xff;
}

function reedSolomonDivisor(degree: number) {
  const result = Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let index = 0; index < degree; index += 1) {
    for (let item = 0; item < degree; item += 1) {
      result[item] = finiteFieldMultiply(result[item], root);
      if (item + 1 < degree) {
        result[item] ^= result[item + 1];
      }
    }
    root = finiteFieldMultiply(root, 0x02);
  }
  return result;
}

function reedSolomonRemainder(data: number[], divisor: number[]) {
  const result = Array<number>(divisor.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ result.shift()!;
    result.push(0);
    for (let index = 0; index < result.length; index += 1) {
      result[index] ^= finiteFieldMultiply(divisor[index], factor);
    }
  }
  return result;
}

function addErrorCorrection(dataCodewords: number[]) {
  const divisor = reedSolomonDivisor(ECC_CODEWORDS_PER_BLOCK);
  const blocks = Array.from({ length: BLOCK_COUNT }, (_, index) =>
    dataCodewords.slice(index * DATA_CODEWORDS_PER_BLOCK, (index + 1) * DATA_CODEWORDS_PER_BLOCK)
  );
  const eccBlocks = blocks.map((block) => reedSolomonRemainder(block, divisor));
  const result: number[] = [];

  for (let index = 0; index < DATA_CODEWORDS_PER_BLOCK; index += 1) {
    for (const block of blocks) {
      result.push(block[index]);
    }
  }
  for (let index = 0; index < ECC_CODEWORDS_PER_BLOCK; index += 1) {
    for (const block of eccBlocks) {
      result.push(block[index]);
    }
  }

  return result;
}

function createEmptyMatrix() {
  return {
    modules: Array.from({ length: QR_SIZE }, () => Array<boolean>(QR_SIZE).fill(false)),
    reserved: Array.from({ length: QR_SIZE }, () => Array<boolean>(QR_SIZE).fill(false))
  };
}

function setModule(input: ReturnType<typeof createEmptyMatrix>, x: number, y: number, dark: boolean, reserved = true) {
  if (x < 0 || y < 0 || x >= QR_SIZE || y >= QR_SIZE) {
    return;
  }
  input.modules[y][x] = dark;
  input.reserved[y][x] = reserved;
}

function drawFinder(input: ReturnType<typeof createEmptyMatrix>, x: number, y: number) {
  for (let dy = -1; dy <= 7; dy += 1) {
    for (let dx = -1; dx <= 7; dx += 1) {
      const xx = x + dx;
      const yy = y + dy;
      const inFinder = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
      const dark = inFinder && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
      setModule(input, xx, yy, dark);
    }
  }
}

function drawAlignment(input: ReturnType<typeof createEmptyMatrix>, x: number, y: number) {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      setModule(input, x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
}

function drawFunctionPatterns(input: ReturnType<typeof createEmptyMatrix>) {
  drawFinder(input, 0, 0);
  drawFinder(input, QR_SIZE - 7, 0);
  drawFinder(input, 0, QR_SIZE - 7);

  for (let index = 0; index < QR_SIZE; index += 1) {
    if (!input.reserved[index][6]) {
      setModule(input, 6, index, index % 2 === 0);
    }
    if (!input.reserved[6][index]) {
      setModule(input, index, 6, index % 2 === 0);
    }
  }

  for (const x of ALIGNMENT_POSITIONS) {
    for (const y of ALIGNMENT_POSITIONS) {
      const overlapsFinder =
        (x === 6 && y === 6) ||
        (x === 6 && y === QR_SIZE - 7) ||
        (x === QR_SIZE - 7 && y === 6);
      if (!overlapsFinder) {
        drawAlignment(input, x, y);
      }
    }
  }

  setModule(input, 8, QR_VERSION * 4 + 9, true);
  drawFormatBits(input);
  drawVersionBits(input);
}

function drawFormatBits(input: ReturnType<typeof createEmptyMatrix>) {
  for (let index = 0; index <= 5; index += 1) {
    setModule(input, 8, index, getBit(FORMAT_BITS_LOW_MASK_0, index));
  }
  setModule(input, 8, 7, getBit(FORMAT_BITS_LOW_MASK_0, 6));
  setModule(input, 8, 8, getBit(FORMAT_BITS_LOW_MASK_0, 7));
  setModule(input, 7, 8, getBit(FORMAT_BITS_LOW_MASK_0, 8));
  for (let index = 9; index < 15; index += 1) {
    setModule(input, 14 - index, 8, getBit(FORMAT_BITS_LOW_MASK_0, index));
  }

  for (let index = 0; index < 8; index += 1) {
    setModule(input, QR_SIZE - 1 - index, 8, getBit(FORMAT_BITS_LOW_MASK_0, index));
  }
  for (let index = 8; index < 15; index += 1) {
    setModule(input, 8, QR_SIZE - 15 + index, getBit(FORMAT_BITS_LOW_MASK_0, index));
  }
  setModule(input, 8, QR_SIZE - 8, true);
}

function getVersionBits() {
  let remainder = QR_VERSION;
  for (let index = 0; index < 12; index += 1) {
    remainder = (remainder << 1) ^ (((remainder >>> 11) & 1) * 0x1f25);
  }
  return (QR_VERSION << 12) | remainder;
}

function drawVersionBits(input: ReturnType<typeof createEmptyMatrix>) {
  const bits = getVersionBits();
  for (let index = 0; index < 18; index += 1) {
    const bit = getBit(bits, index);
    const a = QR_SIZE - 11 + (index % 3);
    const b = Math.floor(index / 3);
    setModule(input, a, b, bit);
    setModule(input, b, a, bit);
  }
}

function mask(x: number, y: number) {
  return (x + y) % 2 === 0;
}

function drawData(input: ReturnType<typeof createEmptyMatrix>, codewords: number[]) {
  let bitIndex = 0;
  for (let right = QR_SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) {
      right = 5;
    }
    for (let vertical = 0; vertical < QR_SIZE; vertical += 1) {
      for (let column = 0; column < 2; column += 1) {
        const x = right - column;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? QR_SIZE - 1 - vertical : vertical;
        if (!input.reserved[y][x]) {
          const byte = codewords[bitIndex >>> 3] ?? 0;
          const dark = getBit(byte, 7 - (bitIndex & 7)) !== mask(x, y);
          setModule(input, x, y, dark, false);
          bitIndex += 1;
        }
      }
    }
  }
}

export function generateQrMatrix(text: string): QrMatrix {
  const matrix = createEmptyMatrix();
  drawFunctionPatterns(matrix);
  drawData(matrix, addErrorCorrection(encodeDataCodewords(text)));
  return matrix.modules;
}

function stringToBytes(value: string) {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index);
  }
  return bytes;
}

function concatBytes(chunks: Uint8Array[]) {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function bytesFromBase64(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function makePdfFromJpeg(jpeg: Uint8Array, imageWidth: number, imageHeight: number) {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const content = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im1 Do\nQ`;
  const objects: Uint8Array[] = [
    stringToBytes("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"),
    stringToBytes("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"),
    stringToBytes(
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n`
    ),
    stringToBytes(`4 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`),
    concatBytes([
      stringToBytes(
        `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
      ),
      jpeg,
      stringToBytes("\nendstream\nendobj\n")
    ])
  ];

  const chunks: Uint8Array[] = [stringToBytes("%PDF-1.4\n")];
  const offsets = [0];
  let cursor = chunks[0].length;
  for (const object of objects) {
    offsets.push(cursor);
    chunks.push(object);
    cursor += object.length;
  }

  const xrefOffset = cursor;
  const xref = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefOffset),
    "%%EOF"
  ].join("\n");
  chunks.push(stringToBytes(xref));

  return new Blob([concatBytes(chunks)], { type: "application/pdf" });
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function drawCenteredText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const nextLine = line ? `${line} ${word}` : word;
    if (context.measureText(nextLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = nextLine;
    }
  }
  if (line) {
    lines.push(line);
  }
  lines.slice(0, 2).forEach((item, index) => context.fillText(item, x, y + index * lineHeight));
  return y + Math.min(lines.length, 2) * lineHeight;
}

function initialsFromName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo cargar el logo."));
    image.src = src;
  });
}

async function drawQrPoster(input: QrPdfInput, includeLogo: boolean) {
  const width = 1240;
  const height = 1754;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("No se pudo preparar el PDF.");
  }

  context.fillStyle = "#f8fafc";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#ffffff";
  roundedRect(context, 110, 100, width - 220, height - 200, 46);
  context.fill();
  context.strokeStyle = "#e5e7eb";
  context.lineWidth = 2;
  context.stroke();

  const logoSize = 168;
  const logoX = width / 2 - logoSize / 2;
  const logoY = 184;
  context.save();
  context.beginPath();
  context.arc(width / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
  context.clip();
  context.fillStyle = "#ecfdf5";
  context.fillRect(logoX, logoY, logoSize, logoSize);

  if (includeLogo && input.logoUrl) {
    const image = await loadImage(input.logoUrl);
    const ratio = Math.max(logoSize / image.width, logoSize / image.height);
    const drawWidth = image.width * ratio;
    const drawHeight = image.height * ratio;
    context.drawImage(image, width / 2 - drawWidth / 2, logoY + logoSize / 2 - drawHeight / 2, drawWidth, drawHeight);
  } else {
    context.fillStyle = "#16a34a";
    context.font = "700 64px Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(initialsFromName(input.name) || "QR", width / 2, logoY + logoSize / 2);
  }
  context.restore();

  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.fillStyle = "#111827";
  context.font = "800 66px Arial, sans-serif";
  let nextY = drawCenteredText(context, input.name, width / 2, 455, 840, 74);

  if (input.address.trim()) {
    context.fillStyle = "#4b5563";
    context.font = "400 34px Arial, sans-serif";
    nextY = drawCenteredText(context, input.address.trim(), width / 2, nextY + 14, 760, 44);
  }

  context.fillStyle = "#6b7280";
  context.font = "400 30px Arial, sans-serif";
  context.fillText(input.url, width / 2, nextY + 36);

  const qr = generateQrMatrix(input.url);
  const quietModules = 4;
  const qrModules = qr.length + quietModules * 2;
  const qrSize = 620;
  const cell = qrSize / qrModules;
  const qrX = width / 2 - qrSize / 2;
  const qrY = 710;

  context.fillStyle = "#ffffff";
  roundedRect(context, qrX - 32, qrY - 32, qrSize + 64, qrSize + 64, 36);
  context.fill();
  context.strokeStyle = "#e5e7eb";
  context.lineWidth = 2;
  context.stroke();

  context.fillStyle = "#111827";
  qr.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) {
        context.fillRect(qrX + (x + quietModules) * cell, qrY + (y + quietModules) * cell, Math.ceil(cell), Math.ceil(cell));
      }
    });
  });

  context.fillStyle = "#111827";
  context.font = "700 34px Arial, sans-serif";
  context.fillText("Escaneá para ver el catálogo", width / 2, 1440);
  context.fillStyle = "#6b7280";
  context.font = "400 26px Arial, sans-serif";

  const dataUrl = canvas.toDataURL("image/jpeg", 0.96);
  return makePdfFromJpeg(bytesFromBase64(dataUrl.split(",")[1]), width, height);
}

export async function createStoreQrPdfBlob(input: QrPdfInput) {
  try {
    return await drawQrPoster(input, true);
  } catch (error) {
    if (input.logoUrl) {
      return drawQrPoster(input, false);
    }
    throw error;
  }
}
