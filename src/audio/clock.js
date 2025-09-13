import unmuteAudio from './unmute';

/**
 * 音频时钟类，用于同步音频播放时间
 * 参考: https://github.com/bemusic/bemuse/blob/68e0d5213b56502b3f5812f1d28c8d7075762717/bemuse/src/game/clock.js#L14
 */
export default class Clock
{
    /**
     * 构造函数
     * @param {AudioContext} AudioContext - Web Audio API的AudioContext对象
     */
    constructor(AudioContext)
    {
        unmuteAudio(AudioContext);

        this.time = 0;

        this._audioCtx = AudioContext;
        this._offsets = [];
        this._sum = 0;

        this.update();
    }

    /**
     * 更新时钟时间，计算音频上下文时间和实际时间的偏移量
     */
    update()
    {
        const realTime = performance.now() / 1000;
        const delta = realTime - this._audioCtx.currentTime;

        this._offsets.push(delta);
        this._sum += delta;

        while (this._offsets.length > 60)
        {
            this._sum -= this._offsets.shift();
        }

        this.time = realTime - this._sum / this._offsets.length;
    }
}