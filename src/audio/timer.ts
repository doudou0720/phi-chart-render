import Clock from './clock';
import { number as verifyNum } from '@/verify';

type TimerStatus = 1 | 2 | 3; // 1=playing, 2=paused, 3=stopped

export default class AudioTimer
{
    startTime: number;
    pausedTime: number;
    status: TimerStatus;

    private _clock: Clock;
    private _offset: number;
    private _speed: number;
    private _lastSpeedChangedProgress: number;

    constructor(AudioContext: AudioContext, offset: number = 0, speed: number = 1)
    {
        this.startTime = NaN;
        this.pausedTime = NaN;
        this.status = 3;

        this._clock = new Clock(AudioContext);
        this._offset = verifyNum(offset) / 1000;
        this._speed = verifyNum(speed);
        this._lastSpeedChangedProgress = 0;
    }

    now(): number
    {
        return this._clock.time - this._offset;
    }

    start(): void
    {
        if (this.status === 2) this.startTime = this.now() - (this.pausedTime - this.startTime);
        else this.startTime = this.now();
        
        this.status = 1;
        this.pausedTime = NaN;
    }

    pause(): void
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

    stop(): void
    {
        if (this.status === 3) return;

        this.startTime = NaN;
        this.pausedTime = NaN;
        this._lastSpeedChangedProgress = 0;

        this.status = 3;
    }

    seek(duration: number): void
    {
        if (this.status === 3) return;
        this.startTime -= duration;
        if (isNaN(this.pausedTime) && this.now() - (this.startTime - this._lastSpeedChangedProgress) < 0) this.startTime = this.now();
        else if (!isNaN(this.pausedTime) && this.startTime > this.pausedTime) this.startTime = this.pausedTime;
    }

    get speed(): number
    {
        return this._speed;
    }

    set speed(value: number)
    {
        if (this.status !== 3) this._lastSpeedChangedProgress += ((this.status === 1 ? this.now() : this.pausedTime) - this.startTime) * this._speed;
        this.startTime = this.now();
        if (this.status === 2) this.pausedTime = this.now();
        this._speed = verifyNum(value);
    }

    get time(): number
    {
        this._clock.update();
        return ((isNaN(this.pausedTime) ? this.now() - this.startTime : this.pausedTime - this.startTime) * this._speed + this._lastSpeedChangedProgress);
    }

    static get TimerDiff(): unknown
    {
        return AudioContextTimerDiff;
    }
}

declare const AudioContextTimerDiff: unknown;
