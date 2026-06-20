import { number as verifyNum } from '@/verify';
// @ts-ignore - Chart is a JS module without declaration file
import Chart from '../index';
import Judgeline from '../judgeline';
import EventLayer from '../eventlayer';
import Note from '../note';
import utils from './utils';
import type { BpmItem, ChartEvent } from './utils';
import { Color } from 'pixi.js';

const calcBetweenTime = 0.125;
const Easing: ((x: number) => number)[] = [
    (x: number) => x,
    (x: number) => Math.sin((x * Math.PI) / 2),
    (x: number) => 1 - Math.cos((x * Math.PI) / 2),
    (x: number) => 1 - (1 - x) * (1 - x),
    (x: number) => x * x,
    (x: number) => -(Math.cos(Math.PI * x) - 1) / 2,
    (x: number) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2,
    (x: number) => 1 - Math.pow(1 - x, 3),
    (x: number) => x * x * x,
    (x: number) => 1 - Math.pow(1 - x, 4),
    (x: number) => x * x * x * x,
    (x: number) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
    (x: number) => x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2,
    (x: number) => 1 - Math.pow(1 - x, 5),
    (x: number) => x * x * x * x * x,
    (x: number) => x === 1 ? 1 : 1 - Math.pow(2, -10 * x),
    (x: number) => x === 0 ? 0 : Math.pow(2, 10 * x - 10),
    (x: number) => Math.sqrt(1 - Math.pow(x - 1, 2)),
    (x: number) => 1 - Math.sqrt(1 - Math.pow(x, 2)),
    (x: number) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2),
    (x: number) => 2.70158 * x * x * x - 1.70158 * x * x,
    (x: number) => x < 0.5 ? (1 - Math.sqrt(1 - Math.pow(2 * x, 2))) / 2 : (Math.sqrt(1 - Math.pow(-2 * x + 2, 2)) + 1) / 2,
    (x: number) => x < 0.5 ? (Math.pow(2 * x, 2) * ((2.594910 + 1) * 2 * x - 2.594910)) / 2 : (Math.pow(2 * x - 2, 2) * ((2.594910 + 1) * (x * 2 - 2) + 2.594910) + 2) / 2,
    (x: number) => x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
    (x: number) => x === 0 ? 0 : x === 1 ? 1 : -Math.pow(2, 10 * x - 10) * Math.sin((x * 10 - 10.75) * ((2 * Math.PI) / 3)),
    (x: number) => x < 1 / 2.75 ? 7.5625 * x * x : x < 2 / 2.75 ? 7.5625 * (x -= 1.5 / 2.75) * x + 0.75 : x < 2.5 / 2.75 ? 7.5625 * (x -= 2.25 / 2.75) * x + 0.9375 : 7.5625 * (x -= 2.625 / 2.75) * x + 0.984375,
    (x: number) => 1 - Easing[25](1 - x),
    (x: number) => x < 0.5 ? (1 - Easing[25](1 - 2 * x)) / 2 : (1 + Easing[25](2 * x - 1)) / 2
];

interface NoteControlItem {
    x: number;
    alpha?: number;
    size?: number;
    pos?: number;
    y?: number;
    easing: number;
    _y?: number;
    value?: number;
}

interface NoteControlResult {
    _y: number;
    y: number;
    value: number;
}

interface RePhiEditNote {
    type: number;
    lineId?: number;
    startTime: number;
    endTime?: number;
    positionX: number;
    isAbove?: boolean;
    isFake?: number;
    above?: number;
    speed?: number;
    alpha?: number;
    size?: number;
    visibleTime?: number;
    visibleBeat?: number;
    yOffset?: number;
    isMulti?: boolean;
    floorPosition?: number;
    holdLength?: number;
    id?: number;
    judgeline?: Judgeline;
}

export default function RePhiEditChartConverter(_chart: any): Chart | null
{
    let notes: RePhiEditNote[] = [];
    let sameTimeNoteCount: Record<number, number> = {};
    let rawChart = convertChartFormat(_chart);
    let chart = new Chart({
        name      : rawChart.META.name,
        artist    : rawChart.META.composer,
        author    : rawChart.META.charter,
        difficult : rawChart.META.level,
        offset    : rawChart.META.offset / 1000
    });

    { // 将 Beat 计算为对应的时间（秒）
        let currentBeatRealTime = 0.5; // 当前每个 Beat 的实际时长（秒）
        let bpmChangedBeat = 0; // 当前 BPM 是在什么时候被更改的（Beat）
        let bpmChangedTime = 0; // 当前 BPM 是在什么时候被更改的（秒）

        rawChart.BPMList.forEach((bpm: any, index: number) =>
        {
            bpm.endTime = rawChart.BPMList[index + 1] ? rawChart.BPMList[index + 1].startTime : [ 1e4, 0, 1 ];

            bpm.startBeat = bpm.startTime[0] + bpm.startTime[1] / bpm.startTime[2];
            bpm.endBeat = bpm.endTime[0] + bpm.endTime[1] / bpm.endTime[2];

            bpmChangedTime += currentBeatRealTime * (bpm.startBeat - bpmChangedBeat);
            bpm.startTime = bpmChangedTime;
            bpm.endTime = currentBeatRealTime * (bpm.endBeat - bpmChangedBeat);

            bpmChangedBeat += (bpm.startBeat - bpmChangedBeat);
            
            currentBeatRealTime = 60 / bpm.bpm;
            bpm.beatTime = 60 / bpm.bpm;
        });

        rawChart.BPMList.sort((a: any, b: any) => b.startBeat - a.startBeat);
    }

    rawChart.judgeLineList.forEach((_judgeline: any, judgelineIndex: number) =>
    {
        let judgeline = new Judgeline({
            id         : judgelineIndex,
            texture    : _judgeline.Texture != 'line.png' ? _judgeline.Texture : null,
            parentLine : _judgeline.father >= 0 ? _judgeline.father as unknown as Judgeline : NaN as unknown as Judgeline,
            zIndex     : _judgeline.zOrder != 0 ? _judgeline.zOrder : NaN,
            isCover    : _judgeline.isCover == 1
        });

        if (_judgeline.attachUI && _judgeline.attachUI != '')
        {
            console.warn('Line ' + judgelineIndex + ' is using \'attachUI\' feature, ignored this line.\nPlease note that all notes on this line will also be ignored.');
            return;
        }

        // 处理 EventLayer
        _judgeline.eventLayers.forEach((_eventLayer: any) =>
        {
            let eventLayer = new EventLayer();

            for (const eventName in _eventLayer)
            {
                // 拍数数组转小数
                _eventLayer[eventName] = utils.calculateEventsBeat(_eventLayer[eventName] ? _eventLayer[eventName] : []);

                // 拆分缓动并将结果直接 push 进新的 eventLayer 中
                if (eventName != 'speedEvents')
                {
                    _eventLayer[eventName].forEach((event: ChartEvent) =>
                    {
                        utils.calculateEventEase(event, Easing)
                            .forEach((newEvent: ChartEvent) =>
                            {
                                switch (eventName)
                                {
                                    case 'moveXEvents':
                                    {
                                        eventLayer.moveX.push(newEvent);
                                        break;
                                    }
                                    case 'moveYEvents':
                                    {
                                        eventLayer.moveY.push(newEvent);
                                        break;
                                    }
                                    case 'alphaEvents':
                                    {
                                        eventLayer.alpha.push(newEvent);
                                        break;
                                    }
                                    case 'rotateEvents':
                                    {
                                        eventLayer.rotate.push(newEvent);
                                        break;
                                    }
                                    default :
                                    {
                                        console.warn('Unsupported event name \'' + eventName + '\', ignoring');
                                    }
                                }
                            }
                        );
                    });
                }
                else
                {
                    // 拆分 speedEvent
                    _eventLayer.speedEvents.forEach((event: ChartEvent) =>
                    {
                        separateSpeedEvent(event)
                            .forEach((_event: ChartEvent) =>
                            {
                                eventLayer.speed.push(_event as any);
                            }
                        );
                    });
                }
            }
            eventLayer.sort();

            if (
                eventLayer.speed.length <= 0 &&
                eventLayer.moveX.length <= 0 &&
                eventLayer.moveY.length <= 0 &&
                eventLayer.alpha.length <= 0 &&
                eventLayer.rotate.length <= 0
            ) {
                return;
            }

            // 计算事件的真实时间
            for (const name in eventLayer)
            {
                if (!Array.isArray((eventLayer as any)[name])) continue;
                (eventLayer as any)[name] = utils.calculateRealTime(rawChart.BPMList, (eventLayer as any)[name]);
            }

            // 计算事件规范值
            eventLayer.speed.forEach((event: any) =>
            {
                event.value = event.value / (0.6 / (120 / 900));
            });
            eventLayer.moveX.forEach((event: any) =>
            {
                event.start = event.start / 1350;
                event.end = event.end / 1350;
            });
            eventLayer.moveY.forEach((event: any) =>
            {
                event.start = event.start / 900;
                event.end = event.end / 900;
            });
            eventLayer.alpha.forEach((event: any) =>
            {
                event.start = event.start / 255;
                event.end = event.end / 255;

                event.start = event.start > 1 ? 1 : event.start;
                event.end = event.end > 1 ? 1 : event.end;

                event.start = event.start < -1 ? -1 : event.start;
                event.end = event.end < -1 ? -1 : event.end;
            });
            eventLayer.rotate.forEach((event: any) =>
            {
                event.start = (Math.PI / 180) * event.start;
                event.end = (Math.PI / 180) * event.end;
            });

            eventLayer.sort();
            judgeline.eventLayers.push(eventLayer);
        });

        // 处理 extendEvents
        if (_judgeline.extended)
        {
            // 流程跟上边都是一样的，没啥好看的
            if (_judgeline.extended.textEvents && _judgeline.extended.textEvents.length > 0)
            {
                judgeline.isText = true;

                utils.calculateEventsBeat(_judgeline.extended.textEvents)
                    .forEach((event: ChartEvent) =>
                    {
                        calculateTextEventEase(event)
                            .forEach((newEvent: any) =>
                            {
                                judgeline.extendEvent.text.push(newEvent);
                            }
                        );
                    }
                );

                judgeline.extendEvent.text.forEach((event: any, eventIndex: number) =>
                {
                    if (isNaN(event.endTime))
                    {
                        event.endTime = judgeline.extendEvent.text[eventIndex + 1] ? judgeline.extendEvent.text[eventIndex + 1].startTime : 100;
                    }
                });
                judgeline.extendEvent.text = utils.calculateRealTime(rawChart.BPMList, judgeline.extendEvent.text as ChartEvent[]);
            }

            if (_judgeline.extended.scaleXEvents && _judgeline.extended.scaleXEvents.length > 0)
            {
                utils.calculateEventsBeat(_judgeline.extended.scaleXEvents)
                    .forEach((event: ChartEvent) =>
                    {
                        utils.calculateEventEase(event, Easing)
                            .forEach((newEvent: ChartEvent) =>
                            {
                                judgeline.extendEvent.scaleX.push(newEvent);
                            }
                        );
                    }
                );
                judgeline.extendEvent.scaleX = utils.calculateRealTime(rawChart.BPMList, judgeline.extendEvent.scaleX as ChartEvent[]);
            }

            if (_judgeline.extended.scaleYEvents && _judgeline.extended.scaleYEvents.length > 0)
            {
                utils.calculateEventsBeat(_judgeline.extended.scaleYEvents)
                    .forEach((event: ChartEvent) =>
                    {
                        utils.calculateEventEase(event, Easing)
                            .forEach((newEvent: ChartEvent) =>
                            {
                                /*
                                if (!judgeline.texture && !judgeline.isText)
                                {
                                    newEvent.start = newEvent.start * 0.664285;
                                    newEvent.end   = newEvent.end * 0.664285;
                                }
                                */

                                judgeline.extendEvent.scaleY.push(newEvent);
                            }
                        );
                    }
                );
                judgeline.extendEvent.scaleY = utils.calculateRealTime(rawChart.BPMList, judgeline.extendEvent.scaleY as ChartEvent[]);
            }

            if (_judgeline.extended.colorEvents && _judgeline.extended.colorEvents.length > 0)
            {
                utils.calculateEventsBeat(_judgeline.extended.colorEvents)
                    .forEach((event: ChartEvent) =>
                    {
                        calculateColorEventEase(event)
                            .forEach((newEvent: any) =>
                            {
                                judgeline.extendEvent.color.push(newEvent);
                            }
                        );
                    }
                );
                judgeline.extendEvent.color = utils.calculateRealTime(rawChart.BPMList, judgeline.extendEvent.color as ChartEvent[]);
            }

            if (_judgeline.extended.inclineEvents && _judgeline.extended.inclineEvents.length > 0)
            {
                let inclineEvents = utils.calculateEventsBeat(_judgeline.extended.inclineEvents);

                if (inclineEvents.length == 1 &&
                    (inclineEvents[0].startTime == 0 && inclineEvents[0].endTime == 1) &&
                    (inclineEvents[0].start == 0 && inclineEvents[0].end == 0)
                ) { /* Do nothing */ }
                else {
                    inclineEvents.forEach((event: ChartEvent) =>
                    {
                        utils.calculateEventEase(event, Easing)
                            .forEach((newEvent: ChartEvent) =>
                            {
                                newEvent.start = (Math.PI / 180) * newEvent.start!;
                                newEvent.end = (Math.PI / 180) * newEvent.end!;

                                judgeline.extendEvent.incline.push(newEvent);
                            }
                        );
                    });
                    judgeline.extendEvent.incline = utils.calculateRealTime(rawChart.BPMList, judgeline.extendEvent.incline as ChartEvent[]);
                }
            }
        }

        judgeline.noteControls.alpha = calculateNoteControls(_judgeline.alphaControl, 'alpha', 1);
        judgeline.noteControls.scale = calculateNoteControls(_judgeline.sizeControl, 'size', 1);
        judgeline.noteControls.x = calculateNoteControls(_judgeline.posControl, 'pos', 1);
        // judgeline.noteControls.y = calculateNoteControls(_judgeline.yControl, 'y', 1);

        // 事件排序并计算 floorPosition
        judgeline.sortEvent();
        judgeline.calcFloorPosition();

        // 计算 Note 真实时间
        _judgeline.notes = utils.calculateEventsBeat(_judgeline.notes ? _judgeline.notes : []);
        _judgeline.notes.sort((a: any, b: any) => a.startTime - b.startTime);
        _judgeline.notes.forEach((note: any, noteIndex: number) =>
        {
            sameTimeNoteCount[note.startTime] = !sameTimeNoteCount[note.startTime] ? 1 : sameTimeNoteCount[note.startTime] + 1;

            note.id = noteIndex;
            note.judgeline = judgeline;

            notes.push(note);
        });;
        // _judgeline.notes = utils.calculateRealTime(rawChart.BPMList, _judgeline.notes);
        
        /*
        _judgeline.notes.forEach((_note, noteIndex) =>
        {
            
        });
        */

        chart.judgelines.push(judgeline);
    });

    // 计算 Note 高亮
    notes.forEach((note: RePhiEditNote) =>
    {
        if (sameTimeNoteCount[note.startTime] > 1) note.isMulti = true;
    });

    notes = utils.calculateRealTime(rawChart.BPMList, notes as unknown as ChartEvent[]) as unknown as RePhiEditNote[];
    notes.forEach((note: RePhiEditNote) =>
    {
        // 计算 Note 的 floorPosition
        let noteStartSpeedEvent = note.judgeline!.getFloorPosition(note.startTime);
        note.floorPosition = noteStartSpeedEvent ? noteStartSpeedEvent.floorPosition + noteStartSpeedEvent.value! * (note.startTime - noteStartSpeedEvent.startTime) : 0;

        if (note.type == 2)
        {
            let noteEndSpeedEvent = note.judgeline!.getFloorPosition(note.endTime!);
            note.holdLength = (noteEndSpeedEvent ? noteEndSpeedEvent.floorPosition + noteEndSpeedEvent.value! * (note.endTime! - noteEndSpeedEvent.startTime) : 0) - note.floorPosition;
        }
        else
        {
            note.holdLength = 0;
        }

        // 推送 Note
        chart.notes.push(new Note({
            id            : note.id!,
            type          : (
                note.type == 1 ? 1 :
                note.type == 2 ? 3 :
                note.type == 3 ? 4 :
                note.type == 4 ? 2 : 1
            ),
            time          : note.startTime,
            holdTime      : note.endTime! - note.startTime,
            speed         : note.speed!,
            floorPosition : note.floorPosition!,
            holdLength    : note.holdLength!,
            positionX     : (note.positionX / (670 * (9 / 80))),
            basicAlpha    : note.alpha! / 255,
            visibleTime   : note.visibleTime! < 999999 ? note.visibleTime! : NaN,
            yOffset       : (note.yOffset! / 900),
            xScale        : note.size,
            isAbove       : note.above == 1 ? true : false,
            isMulti       : note.isMulti,
            isFake        : note.isFake == 1 ? true : false,
            judgeline     : note.judgeline!
        }));
    });

    chart.judgelines.sort((a: Judgeline, b: Judgeline) => a.id - b.id);
    chart.notes.sort((a: Note, b: Note) => a.time - b.time);

    chart.judgelines.forEach((judgeline: Judgeline, judgelineIndex: number, judgelines: Judgeline[]) =>
    {
        if (!isNaN(judgeline.parentLine as unknown as number) && (judgeline.parentLine as unknown as number) >= 0)
        {
            let parentLineId = judgeline.parentLine as unknown as number;
            judgeline.parentLine = null;

            for (const parentLine of judgelines)
            {
                if (parentLine.id == parentLineId)
                {
                    judgeline.parentLine = parentLine;
                    break;
                }
            }
        }
        else judgeline.parentLine = null;
    });

    chart.bpmList = utils.calculateHoldBetween(rawChart.BPMList);

    return chart;
}

function convertChartFormat(rawChart: any): any
{
    let chart = JSON.parse(JSON.stringify(rawChart));
    
    if (chart.META.RPEVersion <= 100)
    {
        chart.judgeLineList.forEach((judgeline: any) =>
        {
            judgeline.bpmfactor = 1;
            judgeline.father = -1;
            judgeline.zOrder = 0;

            judgeline.eventLayers.forEach((eventLayer: any) =>
            {
                for (const name in eventLayer)
                {
                    eventLayer[name].forEach((event: any) =>
                    {
                        event.easingLeft = 0;
                        event.easingRight = 1;
                    });
                }
            });
        });
    }
    if (chart.META.RPEVersion <= 105)
    {

    }
    if (chart.META.RPEVersion <= 113)
    {

    }
    if (chart.META.RPEVersion <= 123)
    {
        
    }

    if (chart.META.RPEVersion > 123)
    {
        console.warn('Unsupported chart version: ' + chart.META.RPEVersion + ', some features may not supported');
    }

    return chart;
}

function calculateTextEventEase(event: ChartEvent): any[]
{
    const _calcBetweenTime = calcBetweenTime / 2;
    const NumberReg = /(.+)%P%/;
    const isNumberRequired = NumberReg.test(event.start as unknown as string) && NumberReg.test(event.end as unknown as string);
    const timeBetween = event.endTime - event.startTime;
    let result: any[] = [];

    if (!event) return [];

    if (isNumberRequired)
    {
        const startNum = Number((event.start as unknown as string).match(NumberReg)![1]) || 0;
        const endNum = Number((event.end as unknown as string).match(NumberReg)![1]) || 0;
        const NotFloatNum = Math.round(startNum) === startNum && Math.round(endNum) === endNum;

        for (let timeIndex = 0, timeCount = Math.ceil(timeBetween / _calcBetweenTime); timeIndex < timeCount; timeIndex++)
        {
            let currentTime = event.startTime + (timeIndex * _calcBetweenTime);
            let nextTime = (event.startTime + ((timeIndex + 1) * _calcBetweenTime)) <= event.endTime ? event.startTime + ((timeIndex + 1) * _calcBetweenTime) : event.endTime;
            let nextTimePercent = (nextTime - event.startTime) / timeBetween;
            let currentNum = startNum * (1 - nextTimePercent) + endNum * nextTimePercent;

            if (NotFloatNum)
            {
                currentNum = Math.round(currentNum);
            }

            if (result[result.length - 1] && result[result.length - 1].value == currentNum)
            {
                result[result.length - 1].endTime = nextTime;
                continue;
            }

            result.push({
                startTime : currentTime,
                endTime   : nextTime,
                value     : currentNum + '',
            });
        }
    }
    else if (event.start != event.end)
    {
        const startText = (event.start as unknown as string).length <= (event.end as unknown as string).length ? event.start as unknown as string : event.end as unknown as string;
        const endText = (event.start as unknown as string).length <= (event.end as unknown as string).length ? event.end as unknown as string : event.start as unknown as string;
        const isProgressive = startText == '' || endText.indexOf(startText) === 0;

        if (isProgressive)
        {
            let currentText: string[] = [];
            let lastTextIndex = -1;

            for (let timeIndex = 0, timeCount = Math.ceil(timeBetween / _calcBetweenTime); timeIndex < timeCount; timeIndex++)
            {
                let currentTime = event.startTime + (timeIndex * _calcBetweenTime);
                let nextTime = (event.startTime + ((timeIndex + 1) * _calcBetweenTime)) <= event.endTime ? event.startTime + ((timeIndex + 1) * _calcBetweenTime) : event.endTime;
                let currentTextIndex = Math.floor(_valueCalculator(event, nextTime, startText.length, endText.length - 1));

                if (lastTextIndex + 1 < currentTextIndex)
                {
                    for (let extraTextIndex = lastTextIndex + 1; extraTextIndex < currentTextIndex; extraTextIndex++)
                    {
                        currentText.push(endText[extraTextIndex]);
                    }
                }
                else if (lastTextIndex + 1 > currentTextIndex)
                {
                    currentText.length = currentTextIndex;
                }

                if (endText[currentTextIndex]) currentText.push(endText[currentTextIndex]);
                if (result[result.length - 1] && result[result.length - 1].value == currentText.join(''))
                {
                    result[result.length - 1].endTime = nextTime;
                    continue;
                }

                if (nextTime == event.endTime)
                {
                    result.push({
                        startTime : currentTime,
                        endTime   : nextTime,
                        value     : event.end
                    });

                    break;
                }

                result.push({
                    startTime : currentTime,
                    endTime   : nextTime,
                    value     : currentText.join(''),
                });

                lastTextIndex = currentTextIndex;
            }
        }
        else
        {
            result.push({
                startTime : event.startTime,
                endTime   : event.endTime,
                value     : event.start
            });
            result.push({
                startTime : event.endTime,
                endTime   : NaN,
                value     : event.end
            });
        }
    }
    else
    {
        result.push({
            startTime : event.startTime,
            endTime   : event.endTime,
            value     : event.start
        });
    }

    return result;
}

function calculateColorEventEase(event: ChartEvent): any[]
{
    let timeBetween = event.endTime - event.startTime;
    let result: any[] = [];

    if (!event) return [];

    if (
        (event.start as unknown as number[])[0] != (event.end as unknown as number[])[0] ||
        (event.start as unknown as number[])[1] != (event.end as unknown as number[])[1] ||
        (event.start as unknown as number[])[2] != (event.end as unknown as number[])[2]
    ) {
        for (let timeIndex = 0, timeCount = Math.ceil(timeBetween / calcBetweenTime); timeIndex < timeCount; timeIndex++)
        {
            let currentTime = event.startTime + (timeIndex * calcBetweenTime);
            let nextTime = (event.startTime + ((timeIndex + 1) * calcBetweenTime)) <= event.endTime ? event.startTime + ((timeIndex + 1) * calcBetweenTime) : event.endTime;

            result.push({
                startTime : currentTime,
                endTime   : nextTime,
                value     : (new Color([
                    Math.round(_valueCalculator(event, nextTime, (event.start as unknown as number[])[0], (event.end as unknown as number[])[0])) / 255,
                    Math.round(_valueCalculator(event, nextTime, (event.start as unknown as number[])[1], (event.end as unknown as number[])[1])) / 255,
                    Math.round(_valueCalculator(event, nextTime, (event.start as unknown as number[])[2], (event.end as unknown as number[])[2])) / 255
                ]).toArray())
            });
        }
    }
    else
    {
        result.push({
            startTime : event.startTime,
            endTime   : event.endTime,
            value     : (new Color([
                (event.start as unknown as number[])[0] / 255,
                (event.start as unknown as number[])[1] / 255,
                (event.start as unknown as number[])[2] / 255
            ]).toArray())
        });
    }

    return result;
}

function calculateNoteControls(_noteControls: NoteControlItem[] | undefined, valueName: string = 'alpha', defaultValue: number = 1): NoteControlResult[]
{
    if (!_noteControls || !(_noteControls instanceof Array) || _noteControls.length <= 0) return [];
    if (
        _noteControls.length == 2 &&
        (_noteControls[0].x == 0 && _noteControls[1].x >= 10000) &&
        (_noteControls[0][valueName as keyof NoteControlItem] == defaultValue && _noteControls[1][valueName as keyof NoteControlItem] == defaultValue)
    ) { return [] };

    let noteControls: NoteControlItem[] = _noteControls.slice().sort((a: NoteControlItem, b: NoteControlItem) => b.x - a.x);
    let result: NoteControlResult[] = [];

    for (let controlIndex = 0; controlIndex < noteControls.length; controlIndex++)
    {
        const control = noteControls[controlIndex];
        const nextControl = noteControls[controlIndex + 1];

        result = [ ...result, ...separateNoteControl(control, nextControl, valueName) ];
    }

    result = arrangeSameValueControls(result);
    if (result[0].y < 10000) result.unshift({ _y: 9999999 / 900, y: 9999999, value: result[0].value });

    return result;

    function arrangeSameValueControls(controls: NoteControlResult[]): NoteControlResult[]
    {
        let result: NoteControlResult[] = [];

        for (const control of controls)
        {
            if (result.length > 0 && result[result.length - 1].value == control.value)
            {
                continue;
            }

            result.push(control);
        }

        return result.slice();
    }

    function separateNoteControl(control: NoteControlItem, nextControl: NoteControlItem | undefined, valueName: string): NoteControlResult[]
    {
        let result: NoteControlResult[] = [];
        let xBetween = control.x - (nextControl ? nextControl.x : 0);
        let valueBetween = (control as any)[valueName] - (nextControl ? (nextControl as any)[valueName] : (control as any)[valueName]);
        let easingFunc = Easing[control.easing - 1];
        let currentX = control.x;

        if ((control as any)[valueName] == (nextControl ? (nextControl as any)[valueName] : (control as any)[valueName]))
        {
            return [ { _y: control.x / 900, y: control.x, value: (control as any)[valueName] } ];
        }

        while (currentX > (nextControl ? nextControl.x : 0))
        {
            let currentPercent = (control.x - currentX) / xBetween;
            let currentValue = parseFloat(((control as any)[valueName] - valueBetween * easingFunc(currentPercent)).toFixed(2));

            if (result.length > 0 && parseFloat((result[result.length - 1].value).toFixed(2)) == currentValue)
            {
                result[result.length - 1]._y = currentX / 900;
                result[result.length - 1].y = currentX;
            }
            else
            {
                result.push({
                    _y    : currentX / 900,
                    y     : currentX,
                    value : currentValue
                });
            }

            currentX -= 2;
        }

        if (result[result.length - 1].value != (nextControl ? (nextControl as any)[valueName] : (control as any)[valueName]))
        {
            result.push({
                _y    : (nextControl ? nextControl.x : 0) / 900,
                y     : (nextControl ? nextControl.x : 0),
                value : (nextControl ? (nextControl as any)[valueName] : (control as any)[valueName])
            });
        }

        return result;
    }
}

function separateSpeedEvent(event: ChartEvent): ChartEvent[]
{
    let result: ChartEvent[] = [];
    let timeBetween = event.endTime - event.startTime;

    if (event.start != event.end)
    {
        for (let timeIndex = 0, timeCount = Math.ceil(timeBetween / calcBetweenTime); timeIndex < timeCount; timeIndex++)
        {
            let currentTime = event.startTime + (timeIndex * calcBetweenTime);
            let nextTime = (event.startTime + ((timeIndex + 1) * calcBetweenTime)) <= event.endTime ? event.startTime + ((timeIndex + 1) * calcBetweenTime) : event.endTime;

            result.push({
                startTime : currentTime,
                endTime   : nextTime,
                start     : 0,
                end       : 0,
                value     : utils.valueCalculator(event, Easing, nextTime)
            });
        }
    }
    else
    {
        result.push({
            startTime : event.startTime,
            endTime   : event.endTime,
            start     : event.start,
            end       : event.end
        });
    }

    return result;
}

function _valueCalculator(event: ChartEvent, currentTime: number, startValue: number = 0, endValue: number = 1): number
{
    if (startValue == endValue) return startValue;
    if (event.startTime > currentTime) throw new Error('currentTime must bigger than startTime');
    if (event.endTime < currentTime) throw new Error('currentTime must smaller than endTime');

    let timePercentStart = (currentTime - event.startTime) / (event.endTime - event.startTime);
    let timePercentEnd = 1 - timePercentStart;
    let easeFunction = Easing[event.easingType! - 1] ? Easing[event.easingType! - 1] : Easing[0];
    let easePercent = easeFunction(verifyNum(event.easingLeft, 0, 0, 1) * timePercentEnd + verifyNum(event.easingRight, 1, 0, 1) * timePercentStart);
    let easePercentStart = easeFunction(verifyNum(event.easingLeft, 0, 0, 1));
    let easePercentEnd = easeFunction(verifyNum(event.easingRight, 1, 0, 1));

    easePercent = (easePercent - easePercentStart) / (easePercentEnd - easePercentStart);

    return startValue * (1 - easePercent) + endValue * easePercent;
}
