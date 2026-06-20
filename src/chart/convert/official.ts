// @ts-ignore - Chart is a JS module without declaration file
import Chart from '../index';
import Judgeline from '../judgeline';
import EventLayer from '../eventlayer';
import Note from '../note';
import utils from './utils';
import type { BpmItem, ChartEvent } from './utils';

function calcRealTime(beatTime: number, bpm: number): number
{
    return beatTime / (bpm / 60);
}

function convertOfficialVersion(chart: any): any
{
    return chart;
}

interface RawOfficialNote {
    id?: number;
    lineId?: number;
    type?: number;
    time: number;
    holdTime: number;
    positionX: number;
    speed: number;
    floorPosition?: number;
    isAbove?: boolean;
    isMulti?: boolean;
    bpm?: number;
    judgeline?: Judgeline;
    holdEndTime?: number;
    holdLength?: number;
}

export default function OfficialChartConverter(_chart: any): Chart | null
{
    let chart = new Chart();
    let rawChart = convertOfficialVersion(_chart);
    let notes: RawOfficialNote[] = [];
    let sameTimeNoteCount: Record<number, number> = {};
    let bpmList: BpmItem[] = [];
    let newBpmList: BpmItem[] = [];

    chart.offset = rawChart.offset;

    rawChart.judgeLineList.forEach((_judgeline: any, index: number) =>
    {
        let judgeline = new Judgeline({ id: index });
        let events = new EventLayer();
        let judgelineNotes: RawOfficialNote[] = [];

        _judgeline.speedEvents.forEach((e: any) =>
        {
            events.speed.push({
                startTime     : calcRealTime(e.startTime, _judgeline.bpm),
                endTime       : calcRealTime(e.endTime, _judgeline.bpm),
                value         : e.value
            });
        });
        _judgeline.judgeLineMoveEvents.forEach((e: any) => 
        {
            events.moveX.push({
                startTime     : calcRealTime(e.startTime, _judgeline.bpm),
                endTime       : calcRealTime(e.endTime, _judgeline.bpm),
                start         : e.start - 0.5,
                end           : e.end - 0.5
            });
            events.moveY.push({
                startTime : calcRealTime(e.startTime, _judgeline.bpm),
                endTime   : calcRealTime(e.endTime, _judgeline.bpm),
                start     : e.start2 - 0.5,
                end       : e.end2 - 0.5
            });
        });
        _judgeline.judgeLineRotateEvents.forEach((e: any) => 
        {
            events.rotate.push({
                startTime : calcRealTime(e.startTime, _judgeline.bpm),
                endTime   : calcRealTime(e.endTime, _judgeline.bpm),
                start     : -(Math.PI / 180) * e.start,
                end       : -(Math.PI / 180) * e.end
            });
        });
        _judgeline.judgeLineDisappearEvents.forEach((e: any) =>
        {
            events.alpha.push({
                startTime : calcRealTime(e.startTime, _judgeline.bpm),
                endTime   : calcRealTime(e.endTime, _judgeline.bpm),
                start     : e.start,
                end       : e.end
            });
        });

        judgeline.eventLayers.push(events);
        judgeline.sortEvent();

        judgeline.eventLayers[0].moveX = utils.arrangeSameValueEvent(judgeline.eventLayers[0].moveX as ChartEvent[]);
        judgeline.eventLayers[0].moveY = utils.arrangeSameValueEvent(judgeline.eventLayers[0].moveY as ChartEvent[]);
        judgeline.eventLayers[0].rotate = utils.arrangeSameValueEvent(judgeline.eventLayers[0].rotate as ChartEvent[]);
        judgeline.eventLayers[0].alpha = utils.arrangeSameValueEvent(judgeline.eventLayers[0].alpha as ChartEvent[]);

        judgeline.calcFloorPosition();

        _judgeline.notesAbove.forEach((rawNote: any, rawNoteIndex: number) =>
        {
            rawNote.judgeline = judgeline;
            rawNote.id = rawNoteIndex;
            rawNote.bpm = _judgeline.bpm;
            rawNote.isAbove = true;
            judgelineNotes.push(rawNote);
        });
        _judgeline.notesBelow.forEach((rawNote: any, rawNoteIndex: number) =>
        {
            rawNote.judgeline = judgeline;
            rawNote.id = rawNoteIndex;
            rawNote.bpm = _judgeline.bpm;
            rawNote.isAbove = false;
            judgelineNotes.push(rawNote);
        });

        judgelineNotes.sort((a: RawOfficialNote, b: RawOfficialNote) => a.time - b.time);
        judgelineNotes.forEach((note: RawOfficialNote, noteIndex: number) =>
        {
            sameTimeNoteCount[note.time] = !sameTimeNoteCount[note.time] ? 1 : sameTimeNoteCount[note.time] + 1;
            note.id = noteIndex;
        });

        notes.push(...judgelineNotes);

        chart.judgelines.push(judgeline);
    });

    notes.sort((a: RawOfficialNote, b: RawOfficialNote) => a.time - b.time);
    notes.forEach((note: RawOfficialNote) =>
    {
        if (sameTimeNoteCount[note.time] > 1) note.isMulti = true;
        chart.notes.push(pushNote(note));      
    });
    chart.notes.sort((a: Note, b: Note) => a.time - b.time);

    notes.sort((a: RawOfficialNote, b: RawOfficialNote) => a.time - b.time);
    notes.forEach((note: RawOfficialNote) =>
    {
        if (bpmList.length <= 0)
        {
            bpmList.push({
                startTime   : note.time,
                endTime     : note.time,
                bpm         : note.bpm!,
                holdBetween : ((-1.2891 * note.bpm!) + 396.71) / 1000
            });
        }
        else
        {
            bpmList[bpmList.length - 1].endTime = note.time;

            if (bpmList[bpmList.length - 1].bpm != note.bpm)
            {
                bpmList.push({
                    startTime   : note.time,
                    endTime     : note.time,
                    bpm         : note.bpm!,
                    holdBetween : ((-1.2891 * note.bpm!) + 396.71) / 1000
                });
            }
        }
    });
    bpmList.sort((a: BpmItem, b: BpmItem) => a.startTime - b.startTime);

    if (bpmList.length > 0)
    {
        bpmList[0].startTime = 1 - 1000;
        bpmList[bpmList.length - 1].endTime = 1e4;
    }
    else
    {
        bpmList.push({
            startTime   : 1 - 1000,
            endTime     : 1e4,
            bpm         : 120,
            holdBetween : 0.242018
        });
    }

    chart.bpmList = bpmList.slice();

    return chart;

    function pushNote(rawNote: RawOfficialNote): Note
    {
        rawNote.time = calcRealTime(rawNote.time, rawNote.bpm!);
        rawNote.holdTime = calcRealTime(rawNote.holdTime, rawNote.bpm!);
        rawNote.holdEndTime = rawNote.time + rawNote.holdTime;

        {  // 考虑到 js 精度，此处重新计算 Note 的 floorPosition 值
            let noteStartSpeedEvent = rawNote.judgeline!.getFloorPosition(rawNote.time);
            rawNote.floorPosition = noteStartSpeedEvent ? noteStartSpeedEvent.floorPosition + noteStartSpeedEvent.value! * (rawNote.time - noteStartSpeedEvent.startTime) : 0;

            if (rawNote.type == 3)
            {
                let noteEndSpeedEvent = rawNote.judgeline!.getFloorPosition(rawNote.holdEndTime!);
                rawNote.holdLength = rawNote.holdTime * rawNote.speed /*(noteEndSpeedEvent ? noteEndSpeedEvent.floorPosition + noteEndSpeedEvent.value * (rawNote.holdEndTime - noteEndSpeedEvent.startTime) : 0) - rawNote.floorPosition */;
            }
            else
            {
                rawNote.holdLength = 0;
            }
        }

        return new Note({
            id               : rawNote.id,
            type             : rawNote.type,
            time             : rawNote.time,
            holdTime         : rawNote.holdTime,
            holdLength       : rawNote.holdLength,
            positionX        : rawNote.positionX,
            floorPosition    : rawNote.floorPosition,
            speed            : rawNote.speed,
            isAbove          : rawNote.isAbove,
            isMulti          : rawNote.isMulti,
            useOfficialSpeed : true,
            judgeline        : rawNote.judgeline!
        });
    }
}
