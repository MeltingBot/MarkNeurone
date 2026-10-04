// Image preprocessing off the main thread (about one second per A4 page at
// 300 dpi): denoise, deskew, adaptive binarization. Settings from the bench.

import { DEFAULT_PREPROCESS, grayToRgba, preprocess, rgbaToGray, type PreprocessOptions } from '../core/image/preprocess.ts';

interface Request {
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
  options?: Partial<PreprocessOptions>;
}

self.onmessage = (e: MessageEvent<Request>) => {
  const { rgba, width, height, options } = e.data;
  const settings = { ...DEFAULT_PREPROCESS, ...options };
  const { image, skewDeg } = preprocess(rgbaToGray(rgba, width, height, settings.dropColor ? 'max' : 'luma'), settings);
  const out = grayToRgba(image);
  (self as unknown as Worker).postMessage({ rgba: out, width: image.width, height: image.height, skewDeg }, [out.buffer]);
};
