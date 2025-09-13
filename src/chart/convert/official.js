import Chart from '../index';
import Judgeline from '../judgeline';
import EventLayer from '../eventlayer';
import Note from '../note';
import utils from './utils';

/**
 * 官方格式谱面转换器
 * 将官方格式的谱面数据转换为内部使用的谱面对象
 * @param {Object} _chart - 原始谱面数据
 * @returns {Chart} 转换后的谱面对象
 */
export default function OfficialChartConverter(_chart)
{
    let chart = new Chart();
    let rawChart = convertOfficialVersion(_chart);
    let notes = [];
    let sameTimeNoteCount = {};
    let bpmList = [];
    let newBpmList = [];

    chart.offset = rawChart.offset;

    // 处理每条判定线
    rawChart.judgeLineList.forEach((_judgeline, index) =>
    {
        let judgeline = new Judgeline({ id: index });
        let events = new EventLayer();
        let judgelineNotes = [];

        // 处理速度事件
        _judgeline.speedEvents.forEach((e) =>
        {
            events.speed.push({
                startTime     : calcRealTime(e.startTime, _judgeline.bpm),
                endTime       : calcRealTime(e.endTime, _judgeline.bpm),
                value         : e.value
            });
        });
        
        // 处理判定线移动事件
        _judgeline.judgeLineMoveEvents.forEach((e) => 
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
        
        // 处理判定线旋转事件
        _judgeline.judgeLineRotateEvents.forEach((e) => 
        {
            events.rotate.push({
                startTime : calcRealTime(e.startTime, _judgeline.bpm),
                endTime   : calcRealTime(e.endTime, _judgeline.bpm),
                start     : -(Math.PI / 180) * e.start,
                end       : -(Math.PI / 180) * e.end
            });
        });
        
        // 处理判定线消失事件
        _judgeline.judgeLineDisappearEvents.forEach((e) =>
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

        // 整理事件值
        judgeline.eventLayers[0].moveX = utils.arrangeSameValueEvent(judgeline.eventLayers[0].moveX);
        judgeline.eventLayers[0].moveY = utils.arrangeSameValueEvent(judgeline.eventLayers[0].moveY);
        judgeline.eventLayers[0].rotate = utils.arrangeSameValueEvent(judgeline.eventLayers[0].rotate);
        judgeline.eventLayers[0].alpha = utils.arrangeSameValueEvent(judgeline.eventLayers[0].alpha);

        // 计算地板位置
        judgeline.calcFloorPosition();

        // 处理上方音符
        _judgeline.notesAbove.forEach((rawNote, rawNoteIndex) =>
        {
            rawNote.judgeline = judgeline;
            rawNote.id = rawNoteIndex;
            rawNote.bpm = _judgeline.bpm;
            rawNote.isAbove = true;
            // let note = pushNote(rawNote, judgeline, rawNoteIndex, _judgeline.bpm, true);
            judgelineNotes.push(rawNote);
        });
        
        // 处理下方音符
        _judgeline.notesBelow.forEach((rawNote, rawNoteIndex) =>
        {
            rawNote.judgeline = judgeline;
            rawNote.id = rawNoteIndex;
            rawNote.bpm = _judgeline.bpm;
            rawNote.isAbove = false;
            // let note = pushNote(rawNote, judgeline, rawNoteIndex, _judgeline.bpm, false);
            judgelineNotes.push(rawNote);
        });

        // 按时间排序音符并计算同时音符数量
        judgelineNotes.sort((a, b) => a.time - b.time);
        judgelineNotes.forEach((note, noteIndex) =>
        {
            sameTimeNoteCount[note.time] = !sameTimeNoteCount[note.time] ? 1 : sameTimeNoteCount[note.time] + 1;
            note.id = noteIndex;
        });

        notes.push(...judgelineNotes);

        chart.judgelines.push(judgeline);
    });

    // 按时间排序音符并创建Note对象
    notes.sort((a, b) => a.time - b.time);
    notes.forEach((note) =>
    {
        if (sameTimeNoteCount[note.time] > 1) note.isMulti = true;
        chart.notes.push(pushNote(note));      
    });
    chart.notes.sort((a, b) => a.time - b.time);

    // 构建BPM列表
    notes.sort((a, b) => a.time - b.time);
    notes.forEach((note) =>
    {
        if (bpmList.length <= 0)
        {
            bpmList.push({
                startTime   : note.time,
                endTime     : note.time,
                bpm         : note.bpm,
                holdBetween : ((-1.2891 * note.bpm) + 396.71) / 1000
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
                    bpm         : note.bpm,
                    holdBetween : ((-1.2891 * note.bpm) + 396.71) / 1000
                });
            }
        }
    });
    bpmList.sort((a, b) => a.startTime - b.startTime);

    // 设置BPM列表的起始和结束时间
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

    /**
     * 创建音符对象
     * @param {Object} rawNote - 原始音符数据
     * @returns {Note} 创建的音符对象
     */
    function pushNote(rawNote)
    {
        rawNote.time = calcRealTime(rawNote.time, rawNote.bpm);
        rawNote.holdTime = calcRealTime(rawNote.holdTime, rawNote.bpm);
        rawNote.holdEndTime = rawNote.time + rawNote.holdTime;

        {  // 考虑到 js 精度，此处重新计算 Note 的 floorPosition 值
            let noteStartSpeedEvent = rawNote.judgeline.getFloorPosition(rawNote.time);
            rawNote.floorPosition = noteStartSpeedEvent ? noteStartSpeedEvent.floorPosition + noteStartSpeedEvent.value * (rawNote.time - noteStartSpeedEvent.startTime) : 0;

            if (rawNote.type == 3)
            {
                let noteEndSpeedEvent = rawNote.judgeline.getFloorPosition(rawNote.holdEndTime);
                rawNote.holdLength = rawNote.holdTime * rawNote.speed /*(noteEndSpeedEvent ? noteEndSpeedEvent.floorPosition + noteEndSpeedEvent.value * (rawNote.holdEndTime - noteEndSpeedEvent.startTime) : 0) - rawNote.floorPosition */;
            }
            else
            {
                rawNote.holdLength = 0;
            }
        }

        return new Note({
            id               : rawNote.id,
            lineId           : rawNote.lineId,
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
            judgeline        : rawNote.judgeline
        });
    }
};

/**
 * 转换官方版本格式
 * @param {Object} chart - 原始谱面数据
 * @returns {Object} 转换后的谱面数据
 */
function convertOfficialVersion(chart)
{
    let newChart = JSON.parse(JSON.stringify(chart));
    
    switch (newChart.formatVersion)
    {
        case 1:
        {
            newChart.formatVersion = 3;
            for (const i of newChart.judgeLineList)
            {
                let floorPosition = 0;
                
                // 处理速度事件
                for (const x of i.speedEvents)
                {
                    if (x.startTime < 0) x.startTime = 0;
                    x.floorPosition = floorPosition;
                    floorPosition += (x.endTime - x.startTime) * x.value / i.bpm * 1.875;
                }
                
                // 处理消失事件
                for (const x of i.judgeLineDisappearEvents)
                {
                    x.start2 = 0;
                    x.end2   = 0;
                }
                
                // 处理移动事件
                for (const x of i.judgeLineMoveEvents)
                {
                    x.start2 = x.start % 1e3 / 520;
                    x.end2   = x.end % 1e3 / 520;
                    x.start  = parseInt(x.start / 1e3) / 880;
                    x.end    = parseInt(x.end / 1e3) / 880;
                }
                
                // 处理旋转事件
                for (const x of i.judgeLineRotateEvents)
                {
                    x.start2 = 0;
                    x.end2   = 0;
                }
            }
        }
        case 3: {
            break;
        }
        default:
            throw new Error('Unsupported chart version: ' + newChart.formatVersion);
    }
    
    return newChart;
}

/**
 * 计算实际时间
 * @param {number} time - 时间值
 * @param {number} bpm - BPM值
 * @returns {number} 实际时间
 */
function calcRealTime(time, bpm) {
    return time / bpm * 1.875;
}