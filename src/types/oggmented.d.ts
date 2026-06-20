declare module 'oggmented' {
  export function oggmented(
    canvas: HTMLCanvasElement,
    options?: {
      width?: number;
      height?: number;
      quality?: number;
      format?: 'jpeg' | 'png';
    }
  ): string;
}
