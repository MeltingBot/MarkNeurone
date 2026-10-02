// Image preprocessing off the main thread (about one second per A4 page at
// 300 dpi): denoise, deskew, adaptive binarization. Settings from the bench.

import { DEFAULT_PREPROCESS, grayToRgba, preprocess, rgbaToGray } from '../core/image/preprocess.ts';

interface Request {
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
}

self.onmessage = (e: MessageEvent<Request>) => {
  const { rgba, width, height } = e.data;
  const { image, skewDeg } = preprocess(rgbaToGray(rgba, width, height), DEFAULT_PREPROCESS);
  const out = grayToRgba(image);
  (self as unknown as Worker).postMessage({ rgba: out, width: image.width, height: image.height, skewDeg }, [out.buffer]);
};
