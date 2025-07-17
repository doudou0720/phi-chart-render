import oggmentedAudioContext from 'oggmented';
import Mp3Parser from 'unify-mp3-timing';
import unmuteAudio from './unmute';
import AudioTimer from './timer';
import { number as verifyNum } from '@/verify';

const GlobalAudioCtxConfig = { latencyHint: 'interactive' };
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const GlobalAudioCtx = (new Audio().canPlayType('audio/ogg') == '') ? new oggmentedAudioContext(GlobalAudioCtxConfig) : new AudioCtx(GlobalAudioCtxConfig);
GlobalAudioCtx.addEventListener('statechange', () =>
{
    if (GlobalAudioCtx.state === 'running')
    {
        console.log('[WAudio] Resume AudioContext success');
        
        window.removeEventListener('mousedown', ResumeGlobalAudioContext);
        window.removeEventListener('touchstart', ResumeGlobalAudioContext);
    }
});


export default class WAudio
{
    constructor(src, loop = false, offset = 0, volume = 1, speed = 1, onend = undefined)
    {
        this.source = src;
        this.loop = loop;
        this.onend = onend;
        this._offset = verifyNum(offset, 0);
        this._volume = verifyNum(volume, 1);
        this._speed = verifyNum(speed, 1);
        this._gain = GlobalAudioCtx.createGain();

        this._gain.gain.value = this._volume;
        this._gain.connect(GlobalAudioCtx.destination);
    }

    static from(src, loop)
    {
        return new Promise(async (res, rej) =>
        {
            try {
                let { startOffset, buffer } = parseAudio(src); // Reference: https://github.com/111116/webosu/blob/b4c0ba419a6ba33d5b2e35d1d977b656befcac25/scripts/osu-audio.js#L107
                let track = await GlobalAudioCtx.decodeAudioData(buffer || src);
                if (!track) rej('Unsupported source type');
                let audio = new WAudio(track, loop, startOffset);
                res(audio);
            } catch (e) {
                rej(e);
            }
        });
    }

    reset()
    {
        if (this._buffer)
        {
            this._buffer.onended = undefined;
            this._buffer.stop();
            this._buffer.disconnect();
            this._buffer = null;
        }

        if (this._timer)
        {
            this._timer.stop();
            this._timer = null;
        }
    }

    play(withTimer = false)
    {
        if (withTimer && !this._timer) this._timer = new AudioTimer(GlobalAudioCtx, this._offset, this._speed);
        this._buffer = GlobalAudioCtx.createBufferSource();
        this._buffer.buffer = this.source;
        this._buffer.loop = this.loop;
        this._buffer.connect(this._gain);

        this._gain.gain.value = this._volume;
        this._buffer.playbackRate.value = this._speed;

        if (this._timer)
        {
            this._timer.speed = this._speed;
            this._buffer.start(0, (this._timer.status !== 3 && this._timer.time > 0 ? this._timer.time : 0));
            this._timer.start(GlobalAudioCtx.currentTime);
        }
        else
        {
            this._buffer.start(0, 0);
        }

        this._buffer.onended = () =>
        {
            if (this._timer) this._timer.stop();
            if (this.onend instanceof Function) this.onend();
        };
    }

    pause()
    {
        if (this._timer) this._timer.pause();
        if (!this._buffer) return;

        this._buffer.onended = undefined;
        this._buffer.stop();
    }

    stop()
    {
        this.pause();
        if (this._timer) this._timer.stop();
    }

    seek(duration)
    {
        if (!this._timer) return;

        let playedBeforeSeek = false;

        if (this._timer.status === 3) return;
        if (this._timer.status === 1)
        {
            playedBeforeSeek = true;
            this._buffer.onended = undefined;
            this._buffer.stop();
        }

        this._timer.seek(duration);
        if (playedBeforeSeek) this.play();
    }

    get isPaused()
    {
        return this._timer.status === 2;
    }

    get isStoped()
    {
        return this._timer.status === 3;
    }

    get duration()
    {
        return this.source.duration;
    }

    get currentTime()
    {
        return this._timer ? this._timer.time : NaN;
    }

    get progress()
    {
        return this.currentTime / this.source.duration;
    }

    get volume()
    {
        return this._volume;
    }

    set volume(value)
    {
        this._volume = verifyNum(value, 1);
        if (this._buffer) this._gain.gain.value = this._volume;
    }

    get speed()
    {
        return this._speed;
    }

    set speed(value)
    {
        this._speed = verifyNum(value, 1);
        if (this._timer) this._timer.speed = this._speed;
        if (this._buffer) this._buffer.playbackRate.value = this._speed;
    }

    static get AudioContext()
    {
        return GlobalAudioCtx;
    }

    static get globalLatency()
    {
        return (!isNaN(GlobalAudioCtx.baseLatency) ? GlobalAudioCtx.baseLatency : 0) + (!isNaN(GlobalAudioCtx.outputLatency) ? GlobalAudioCtx.outputLatency : 0);
    }
}



function parseAudio(arrayBuffer)
{
    if (!detectIfIsMp3(arrayBuffer)) return { startOffset: 19 };

    let mp3Tags = Mp3Parser.readTags(new DataView(arrayBuffer));

    if (mp3Tags.length === 3 && mp3Tags[1]._section.type === 'Xing')
    {
        let uintArray = new Uint8Array(arrayBuffer.byteLength - mp3Tags[1]._section.byteLength);
        let offsetAfterTag = mp3Tags[1]._section.offset + mp3Tags[1]._section.byteLength;

        uintArray.set(new Uint8Array(arrayBuffer, 0, mp3Tags[1]._section.offset), 0);
        uintArray.set(new Uint8Array(arrayBuffer, offsetAfterTag, arrayBuffer.byteLength - offsetAfterTag), mp3Tags[0]._section.offset);

        return { startOffset: predictMp3Offset(mp3Tags), buffer: uintArray.buffer };
    }

    return { startOffset: predictMp3Offset(mp3Tags) };
}

function detectIfIsMp3(arrayBuffer)
{
    const Mp3FileHeads = [ [ 0x49, 0x44, 0x33 ], [ 0xFF, 0xFB, 0x50 ] ];
    let uintArray = new Uint8Array(arrayBuffer);

    for (const Mp3FileHead of Mp3FileHeads)
    {
        if (
            uintArray[0] === Mp3FileHead[0] &&
            uintArray[1] === Mp3FileHead[1] &&
            uintArray[2] === Mp3FileHead[2]
        ) {
            return true;
        }
    }

    return false;
}

function predictMp3Offset(tags)
{
    const printWarn = (msg) => console.warn('Cannot predict MP3 offset:', msg);
    const defaultOffset = 22;

    if (!tags || !tags.length)
    {
        printWarn('MP3 tags not found');
        return defaultOffset;
    }

    const frameTag = tags[tags.length-1];
    let vbrTag;
    let sampleRate;
    
    if (frameTag._section.sampleLength != 1152)
    {
        printWarn('Unexpected sample length');
        return defaultOffset;
    }

    for (const tag of tags)
    {
        if (tag._section.type === 'Xing') vbrTag = tag;
    }

    if (!vbrTag) return defaultOffset;

    if (!vbrTag.identifier)
    {
        printWarn('vbr tag identifier missing');
        return defaultOffset;
    }

    if (!vbrTag.vbrinfo || vbrTag.vbrinfo.ENC_DELAY !== 576)
    {
        printWarn('vbr ENC_DELAY value unexpected');
        return defaultOffset;
    }

    sampleRate = vbrTag.header.samplingRate;
    if (sampleRate === 32000) return 89 - 1152000 / sampleRate;
    if (sampleRate === 44100) return 68 - 1152000 / sampleRate;
    if (sampleRate === 48000) return 68 - 1152000 / sampleRate;

    printWarn('sampleRate unexpected');
    return defaultOffset;
}


window.addEventListener('load', () =>
{
    if (GlobalAudioCtx.state !== 'running')
    {
        window.addEventListener('mousedown', ResumeGlobalAudioContext);
        window.addEventListener('touchstart', ResumeGlobalAudioContext);
    }

    //ResumeGlobalAudioContext();
});

function ResumeGlobalAudioContext()
{
    console.log('[WAudio] Trying resume AudioContext...');
    unmuteAudio(GlobalAudioCtx);
}
