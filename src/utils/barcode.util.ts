import bwipjs from 'bwip-js';

export interface BarcodeOptions {
  text: string;
  scale?: number;
  height?: number;
  includeText?: boolean;
  fontSize?: number;
}

/**
 * Generate a Code128 barcode image buffer
 * @param options - Barcode generation options
 * @returns Buffer containing PNG image of the barcode
 */
export const generateBarcode = async (options: BarcodeOptions): Promise<Buffer> => {
  const {
    text,
    scale = 3,
    height = 10,
    includeText = true,
    fontSize = 12,
  } = options;

  try {
    const buffer = await bwipjs.toBuffer({
      bcid: 'code128',       // Barcode type
      text: text,            // Text to encode
      scale: scale,          // Scaling factor (1-3)
      height: height,        // Bar height (1-100)
      includetext: includeText, // Show human-readable text
      textxalign: 'center',  // Text alignment
      textfont: 'Inconsolata', // Monospace font for barcode text
      textsize: fontSize,    // Font size
    });

    return buffer as Buffer;
  } catch (error) {
    throw new Error(`Failed to generate barcode: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Generate a barcode for an asset tag
 * @param assetTag - The asset tag (e.g., "LAP-00001")
 * @returns Buffer containing PNG image of the barcode
 */
export const generateAssetBarcode = (assetTag: string): Promise<Buffer> => {
  return generateBarcode({
    text: assetTag,
    scale: 3,
    height: 15,
    includeText: true,
    fontSize: 14,
  });
};
