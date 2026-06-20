import { number as verifyNum } from '@/verify';
import Bezier from 'bezier-easing';

const calcBetweenTime = 0.125; // 1/32

export interface ChartEvent {
    startTime: number;
    endTime: number;
    start: number;
    end: number;
    value?: number;
    bezier?: number;
    bezierPoints?: number[];
    easingType?: number;
    easingLeft?: number;
    easingRight?: number;
    [key: string]: unknown;
}

export interface BpmItem {
    startTime: number;
    endTime: number;
    startBeat?: number;
    endBeat?: number;
    bpm: number;
    beatTime?: number;
    holdBetween: number;
}

type EasingFunction = (pos: number) => number;

/**
 * 将一个事件的拍数数组转换为拍数小数
 */
function calculateEventBeat(event: ChartEvent): ChartEvent
{
    const startArr = event.startTime as unknown as number[];
    const endArr = event.endTime as unknown as number[];
    event.startTime = parseFloat((startArr[0] + (startArr[1] / startArr[2])).toFixed(3));
    event.endTime = parseFloat((endArr[0] + (endArr[1] / endArr[2])).toFixed(3));
    return event;
}

/**
 * 将一组事件的拍数数组转换为拍数小数
 */
function calculateEventsBeat(events: ChartEvent[]): ChartEvent[]
{
    events.forEach((event) =>
    {
        calculateEventBeat(event);
    });
    return events;
}

/**
 * 计算在某时间下某一事件的返回值
 */
function valueCalculator(event: ChartEvent, Easings: EasingFunction[], currentTime: number, easingsOffset: number = 1): number
{
    if (event.start == event.end) return event.start;
    if (event.startTime > currentTime) throw new Error('currentTime must bigger than startTime');
    if (event.endTime < currentTime) throw new Error('currentTime must smaller than endTime');

    let timePercentEnd = (currentTime - event.startTime) / (event.endTime - event.startTime);
    let timePercentStart = 1 - timePercentEnd;

    if (event.bezier === 1)
    {
        let bezier = Bezier(event.bezierPoints![0], event.bezierPoints![1], event.bezierPoints![2], event.bezierPoints![3]);
        return event.start * bezier(timePercentStart) + event.end * bezier(timePercentEnd);
    }
    else
    {
        let easeFunction = Easings[event.easingType! - easingsOffset] ? Easings[event.easingType! - easingsOffset] : Easings[0];
        let easePercent = easeFunction(verifyNum(event.easingLeft, 0, 0, 1) * timePercentStart + verifyNum(event.easingRight, 1, 0, 1) * timePercentEnd);
        let easePercentStart = easeFunction(verifyNum(event.easingLeft, 0, 0, 1));
        let easePercentEnd = easeFunction(verifyNum(event.easingRight, 1, 0, 1));

        easePercent = (easePercent - easePercentStart) / (easePercentEnd - easePercentStart);

        return event.start * (1 - easePercent) + event.end * easePercent;
    }
    
}

/**
 * 计算一组事件/Note的绝对时间
 */
function calculateRealTime(_bpmList: BpmItem[], _events: ChartEvent[]): ChartEvent[]
{
    let bpmList = _bpmList.slice();
    let events = _events.slice();

    events.forEach((event) =>
    {
        for (let bpmIndex = 0, bpmLength = bpmList.length; bpmIndex < bpmLength; bpmIndex++)
        {
            let bpm = bpmList[bpmIndex];

            if (bpm.startBeat! > event.endTime) continue;
            event.endTime = bpm.startTime + ((event.endTime - bpm.startBeat!) * bpm.beatTime!);

            for (let nextBpmIndex = bpmIndex; nextBpmIndex < bpmLength; nextBpmIndex++)
            {
                let nextBpm = bpmList[nextBpmIndex];

                if (nextBpm.startBeat! > event.startTime) continue;
                event.startTime = nextBpm.startTime + ((event.startTime - nextBpm.startBeat!) * nextBpm.beatTime!);
                break;
            }

            break;
        }
    });

    return events.slice();
}

/**
 * 拆分事件缓动
 */
function calculateEventEase(event: ChartEvent, Easings: EasingFunction[], easingsOffset: number = 1, forceLinear: boolean = false): ChartEvent[]
{
    let result: ChartEvent[] = [];
    let timeBetween = event.endTime - event.startTime;

    if (!event) return [];

    if (
        (
            event.bezier == 1 ||
            (
                event.easingType && Easings[event.easingType - easingsOffset] && (event.easingType - easingsOffset !== 0 || forceLinear) &&
                event.easingType <= Easings.length
            )
        ) &&
        event.start != event.end
    ) {
        for (let timeIndex = 0, timeCount = Math.ceil(timeBetween / calcBetweenTime); timeIndex < timeCount; timeIndex++)
        {
            let currentTime = event.startTime + (timeIndex * calcBetweenTime);
            let nextTime = event.startTime + ((timeIndex + 1) * calcBetweenTime) <= event.endTime ? event.startTime + ((timeIndex + 1) * calcBetweenTime) : event.endTime;

            result.push({
                startTime : currentTime,
                endTime   : nextTime,
                start     : valueCalculator(event, Easings, currentTime, easingsOffset),
                end       : valueCalculator(event, Easings, nextTime, easingsOffset)
            });
        }
    }
    else
    {
        result.push({
            startTime: event.startTime,
            endTime: event.endTime,
            start: event.start,
            end: event.end
        });
    }

    return result;
}

/**
 * 计算一组 BPM 的 HoldBetween 值
 */
function calculateHoldBetween(_bpmList: BpmItem[]): BpmItem[]
{
    let bpmList = _bpmList.slice();
    let result: BpmItem[] = [];

    bpmList.sort((a, b) => a.startTime - b.startTime);
    bpmList.forEach((bpm) =>
    {
        if (result.length <= 0)
        {
            result.push({
                startTime   : bpm.startTime,
                endTime     : bpm.startTime,
                bpm         : bpm.bpm,
                holdBetween : ((-1.2891 * bpm.bpm) + 396.71) / 1000
            });
        }
        else
        {
            result[result.length - 1].endTime = bpm.startTime;

            if (result[result.length - 1].bpm != bpm.bpm)
            {
                result.push({
                    startTime   : bpm.startTime,
                    endTime     : bpm.startTime,
                    bpm         : bpm.bpm,
                    holdBetween : ((-1.2891 * bpm.bpm) + 396.71) / 1000
                });
            }
        }
    });

    result.sort((a, b) => a.startTime - b.startTime);

    if (result.length > 0)
    {
        result[0].startTime = 1 - 1000;
        result[result.length - 1].endTime = 1e4;
    }
    else
    {
        result.push({
            startTime   : 1 - 1000,
            endTime     : 1e4,
            bpm         : 120,
            holdBetween : 0.242018
        });
    }

    return result;
}

/**
 * 合并一组事件中值相同的事件
 */
function arrangeSameValueEvent(_events: ChartEvent[]): ChartEvent[]
{
    if (!_events || _events.length <= 0) return [];

    let events = _events.slice();
    let result: ChartEvent[] = [ events.shift()! ];

    for (const event of events)
    {
        if (
            result[result.length - 1].start == result[result.length - 1].end &&
            event.start == event.end &&
            result[result.length - 1].start == event.start
        ) {
            result[result.length - 1].endTime = event.endTime;
        }
        else
        {
            result.push(event);
        }
    }
    
    return result.slice();
}

/**
 * 合并一组速度事件中值相同的事件
 */
function arrangeSameSingleValueEvent(events: { startTime: number; endTime: number; value: number; [key: string]: unknown }[]): { startTime: number; endTime: number; value: number; [key: string]: unknown }[]
{
    if (!events || events.length <= 0) return [];

    let newEvents: { startTime: number; endTime: number; value: number; [key: string]: unknown }[] = [];
    for (let i of events) {
        let lastEvent = newEvents[newEvents.length - 1];
        
        if (!lastEvent || lastEvent.value != i.value) {
            newEvents.push(i);
        } else {
            lastEvent.endTime = i.endTime;
        }
    }
    
    return newEvents.slice();
}

export default {
    CalcBetweenTime: calcBetweenTime,

    calculateEventBeat,
    calculateEventsBeat,
    
    valueCalculator,
    calculateRealTime,

    calculateEventEase,
    calculateHoldBetween,

    arrangeSameValueEvent,
    arrangeSameSingleValueEvent
}
