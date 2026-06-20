declare module 'unify-mp3-timing' {
  export function unifyMP3Timing(
    audioBuffer: AudioBuffer,
    options?: {
      sampleRate?: number;
      offset?: number;
    }
  ): AudioBuffer;

  interface TagSection {
    type: string;
    byteLength: number;
    offset: number;
    sampleLength?: number;
    sampleRate?: number;
  }

  interface Tag {
    _section: TagSection;
    identifier?: string;
    vbrinfo?: { ENC_DELAY: number };
    header?: { samplingRate: number };
  }

  export function readTags(dataView: DataView): Tag[];
}
