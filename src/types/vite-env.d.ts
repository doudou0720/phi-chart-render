/// <reference types="vite/client" />

declare module 'git-rev-sync' {
  export function short(): string;
  export function long(): string;
  export function branch(): string;
  export function tag(): string;
  export function isDirty(): boolean;
  export function commit(): string;
  export function firstCommit(): string;
  export function lastCommitMessage(): string;
}

declare module '*.glsl' {
  const content: string;
  export default content;
}

declare module 'md5-js' {
  export function md5(string: string): string;
}

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

declare module 'unify-mp3-timing' {
  export function unifyMP3Timing(
    audioBuffer: AudioBuffer,
    options?: {
      sampleRate?: number;
      offset?: number;
    }
  ): AudioBuffer;
}
