import oggmentedAudioContext from 'oggmented';
import Mp3Parser from 'unify-mp3-timing';
import unmuteAudio from './unmute';
import AudioTimer from './timer';
import { number as verifyNum } from '@/verify';

// 全局音频上下文配置
const GlobalAudioCtxConfig = { latencyHint: 'interactive' };
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const GlobalAudioCtx = (new Audio().canPlayType('audio/ogg') == '') ? new oggmentedAudioContext(GlobalAudioCtxConfig) : new AudioCtx(GlobalAudioCtxConfig);

// 监听音频上下文状态变化
GlobalAudioCtx.addEventListener('statechange', () =>
{
    if (GlobalAudioCtx.state === 'running')
    {
        console.log('[WAudio] Resume AudioContext success');
        
        window.removeEventListener('mousedown', ResumeGlobalAudioContext);
        window.removeEventListener('touchstart', ResumeGlobalAudioContext);
    }
});

/**
 * Web Audio类
 * 用于处理音频播放、控制和管理
 */
export default class WAudio
{
    /**
     * 构造函数
     * @param {AudioBuffer} src - 音频源
     * @param {boolean} loop - 是否循环播放，默认为false
     * @param {number} offset - 时间偏移量，默认为0
     * @param {number} volume - 音量，默认为1
     * @param {number} speed - 播放速度，默认为1
     * @param {Function} onend - 播放结束回调函数
     */
    constructor(src, loop = false, offset = 0, volume = 1, speed = 1, onend = undefined)
    {
        this.source = src;              // 音频源
        this.loop = loop;               // 是否循环播放
        this.onend = onend;             // 播放结束回调函数
        this._offset = verifyNum(offset, 0);   // 时间偏移量
        this._volume = verifyNum(volume, 1);   // 音量
        this._speed = verifyNum(speed, 1);     // 播放速度
        this._gain = GlobalAudioCtx.createGain(); // 增益节点

        this._gain.gain.value = this._volume;
        this._gain.connect(GlobalAudioCtx.destination);
    }

    /**
     * 从音频源创建WAudio实例
     * @param {ArrayBuffer|Blob} src - 音频源
     * @param {boolean} loop - 是否循环播放
     * @returns {Promise<WAudio>} 返回Promise，resolve时返回WAudio实例
     */
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

    /**
     * 重置音频播放器
     */
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

    /**
     * 播放音频
     * @param {boolean} withTimer - 是否使用计时器，默认为false
     */
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

    /**
     * 暂停音频播放
     */
    pause()
    {
        if (this._timer) this._timer.pause();
        if (!this._buffer) return;

        this._buffer.onended = undefined;
        this._buffer.stop();
    }

    /**
     * 停止音频播放
     */
    stop()
    {
        this.pause();
        if (this._timer) this._timer.stop();
    }

    /**
     * 跳转到指定时间位置
     * @param {number} duration - 跳转的时间偏移量
     */
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

    /**
     * 获取是否处于暂停状态
     * @returns {boolean} 是否处于暂停状态
     */
    get isPaused()
    {
        return this._timer.status === 2;
    }

    /**
     * 获取是否处于停止状态
     * @returns {boolean} 是否处于停止状态
     */
    get isStoped()
    {
        return this._timer.status === 3;
    }

    /**
     * 获取音频总时长
     * @returns {number} 音频总时长（秒）
     */
    get duration()
    {
        return this.source.duration;
    }

    /**
     * 获取当前播放时间
     * @returns {number} 当前播放时间（秒）
     */
    get currentTime()
    {
        return this._timer ? this._timer.time : NaN;
    }

    /**
     * 获取播放进度（0-1）
     * @returns {number} 播放进度
     */
    get progress()
    {
        return this.currentTime / this.source.duration;
    }

    /**
     * 获取音量
     * @returns {number} 当前音量
     */
    get volume()
    {
        return this._volume;
    }

    /**
     * 设置音量
     * @param {number} value - 新的音量值
     */
    set volume(value)
    {
        this._volume = verifyNum(value, 1);
        if (this._buffer) this._gain.gain.value = this._volume;
    }

    /**
     * 获取播放速度
     * @returns {number} 当前播放速度
     */
    get speed()
    {
        return this._speed;
    }

    /**
     * 设置播放速度
     * @param {number} value - 新的播放速度
     */
    set speed(value)
    {
        this._speed = verifyNum(value, 1);
        if (this._timer) this._timer.speed = this._speed;
        if (this._buffer) this._buffer.playbackRate.value = this._speed;
    }

    /**
     * 获取音频上下文的静态属性
     * @returns {AudioContext} 全局音频上下文
     */
    static get AudioContext()
    {
        return GlobalAudioCtx;
    }

    /**
     * 获取全局音频延迟
     * @returns {number} 音频延迟时间
     */
    static get globalLatency()
    {
        return (!isNaN(GlobalAudioCtx.baseLatency) ? GlobalAudioCtx.baseLatency : 0) + (!isNaN(GlobalAudioCtx.outputLatency) ? GlobalAudioCtx.outputLatency : 0);
    }
}

/**
 * 解析音频文件，处理MP3偏移量
 * @param {ArrayBuffer} arrayBuffer - 音频文件的ArrayBuffer
 * @returns {Object} 包含起始偏移量和处理后缓冲区的对象
 */
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

/**
 * 检测是否为MP3文件
 * @param {ArrayBuffer} arrayBuffer - 文件的ArrayBuffer
 * @returns {boolean} 是否为MP3文件
 */
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

/**
 * 预测MP3偏移量
 * @param {Array} tags - MP3标签数组
 * @returns {number} 预测的偏移量
 */
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

// 页面加载完成后检查音频上下文状态
window.addEventListener('load', () =>
{
    if (GlobalAudioCtx.state !== 'running')
    {
        window.addEventListener('mousedown', ResumeGlobalAudioContext);
        window.addEventListener('touchstart', ResumeGlobalAudioContext);
    }

    //ResumeGlobalAudioContext();
});

/**
 * 恢复全局音频上下文
 */
function ResumeGlobalAudioContext()
{
    console.log('[WAudio] Trying resume AudioContext...');
    unmuteAudio(GlobalAudioCtx);
}