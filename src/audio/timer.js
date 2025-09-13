import Clock from './clock';
import { number as verifyNum } from '@/verify';

/**
 * 音频计时器类
 * 用于管理音频播放的时间控制，包括播放、暂停、停止、跳转等功能
 */
export default class AudioTimer
{
    /**
     * 构造函数
     * @param {AudioContext} AudioContext - Web Audio API的AudioContext对象
     * @param {number} offset - 时间偏移量，默认为0
     * @param {number} speed - 播放速度，默认为1
     */
    constructor(AudioContext, offset = 0, speed = 1)
    {
        this.startTime = NaN;           // 开始时间
        this.pausedTime = NaN;          // 暂停时间
        this.status = 3;                // 状态：1-播放中，2-暂停，3-停止

        this._clock = new Clock(AudioContext);     // 音频时钟实例
        this._offset = verifyNum(offset) / 1000;   // 时间偏移量（转换为秒）
        this._speed = verifyNum(speed);            // 播放速度
        this._lastSpeedChangedProgress = 0;        // 上次速度改变时的进度
    }

    /**
     * 获取当前时间（相对于偏移量）
     * @returns {number} 当前时间
     */
    now()
    {
        return this._clock.time - this._offset;
    }

    /**
     * 开始播放
     */
    start()
    {
        if (this.status === 2) this.startTime = this.now() - (this.pausedTime - this.startTime);
        else this.startTime = this.now();
        
        this.status = 1;
        this.pausedTime = NaN;
    }

    /**
     * 暂停/继续播放
     */
    pause()
    {
        if (this.status === 1)
        {
            this.pausedTime = this.now();
            this.status = 2;
        }
        else if (this.status === 2)
        {
            this.startTime = this.now() - (this.pausedTime - this.startTime);
            this.pausedTime = NaN;
            this.status = 1;
        }
    }

    /**
     * 停止播放
     */
    stop()
    {
        if (this.status === 3) return;

        this.startTime = NaN;
        this.pausedTime = NaN;
        this._lastSpeedChangedProgress = 0;

        this.status = 3;
    }

    /**
     * 跳转到指定时间位置
     * @param {number} duration - 跳转的时间偏移量
     */
    seek(duration)
    {
        if (this.status === 3) return;
        this.startTime -= duration;
        if (isNaN(this.pausedTime) && this.now() - (this.startTime - this._lastSpeedChangedProgress) < 0) this.startTime = this.now();
        else if (!isNaN(this.pausedTime) && this.startTime > this.pausedTime) this.startTime = this.pausedTime;
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
        if (this.status !== 3) this._lastSpeedChangedProgress += ((this.status === 1 ? this.now() : this.pausedTime) - this.startTime) * this._speed;
        this.startTime = this.now();
        if (this.status === 2) this.pausedTime = this.now();
        this._speed = verifyNum(value);
    }

    /**
     * 获取当前播放时间
     * @returns {number} 当前播放时间（考虑播放速度）
     */
    get time()
    {
        this._clock.update();
        return ((isNaN(this.pausedTime) ? this.now() - this.startTime : this.pausedTime - this.startTime) * this._speed + this._lastSpeedChangedProgress);
    }

    /**
     * 获取音频上下文时间差的静态属性
     * @returns {Function} 音频上下文时间差函数
     */
    static get TimerDiff()
    {
        return AudioContextTimerDiff;
    }
}