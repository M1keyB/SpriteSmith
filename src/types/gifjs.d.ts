declare module "gif.js" {
  interface GifOptions {
    workers?: number;
    quality?: number;
    width?: number;
    height?: number;
    workerScript?: string;
    transparent?: number;
  }

  interface AddFrameOptions {
    delay?: number;
    copy?: boolean;
  }

  export default class GIF {
    constructor(options?: GifOptions);
    addFrame(image: CanvasImageSource, options?: AddFrameOptions): void;
    on(event: "finished", handler: (blob: Blob) => void): void;
    render(): void;
  }
}

declare module "*.js?url" {
  const value: string;
  export default value;
}
