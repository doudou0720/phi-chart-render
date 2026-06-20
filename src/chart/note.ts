import * as verify from '@/verify';
import { Sprite, Container, Text, Graphics } from 'pixi.js';
import type Judgeline from './judgeline';

interface NoteParams {
    id?: number;
    type?: number;
    time?: number;
    holdTime?: number;
    speed?: number;
    floorPosition?: number;
    holdLength?: number;
    positionX?: number;
    basicAlpha?: number;
    visibleTime?: number;
    yOffset?: number;
    xScale?: number;
    isAbove?: boolean;
    isFake?: boolean;
    isMulti?: boolean;
    useOfficialSpeed?: boolean;
    texture?: string | null;
    hitsound?: string | null;
    judgeline: Judgeline;
}

interface Size {
    width: number;
    height: number;
    widthPercent: number;
    noteSpeed: number;
    noteScale: number;
}

interface AreaCheck {
    startX: number;
    endX: number;
    startY: number;
    endY: number;
}

declare module 'pixi.js' {
    interface Sprite {
        outScreen?: boolean;
        judgelineX?: number;
        judgelineY?: number;
        baseScale?: number;
    }
}

export default class Note
{
    id: number;
    type: number;
    time: number;
    holdTime: number;
    holdTimeLength: number;
    speed: number;
    floorPosition: number;
    holdLength: number;
    endPosition: number;
    positionX: number;
    basicAlpha: number;
    visibleTime: number;
    yOffset: number;
    xScale: number;
    isAbove: boolean;
    isFake: boolean;
    isMulti: boolean;
    useOfficialSpeed: boolean;
    texture: string | null;
    hitsound: unknown;
    judgeline: Judgeline;

    sprite: (Sprite | Container) & { outScreen?: boolean; judgelineX?: number; judgelineY?: number; baseScale?: number } | undefined;
    debugSprite: Container | undefined;

    isScored!: boolean;
    isScoreAnimated!: boolean;
    isHolding!: boolean;
    lastHoldTime!: number;
    score!: number;
    scoreTime!: number;

    constructor(params: NoteParams)
    {
        this.id               = verify.number(params.id, -1, 0);
        this.type             = verify.number(params.type, 1, 1, 4);
        this.time             = verify.number(params.time, -1); // Note 开始时间
        this.holdTime         = this.type === 3 ? verify.number(params.holdTime, 0) : 0; // Note 按住需要经过的时间，仅 Hold
        this.holdTimeLength   = this.type === 3 ? parseFloat(String(this.time + this.holdTime)) : 0; // Note 按完的时间，自动计算，仅 Hold
        this.speed            = verify.number(params.speed, 1);
        this.floorPosition    = verify.number(params.floorPosition, this.time);
        this.holdLength       = this.type === 3 ? verify.number(params.holdLength, 0) : 0;
        this.endPosition      = parseFloat(String(this.floorPosition + this.holdLength));
        this.positionX        = verify.number(params.positionX, 0);
        this.basicAlpha       = verify.number(params.basicAlpha, 1, 0, 1);
        this.visibleTime      = verify.number(params.visibleTime, NaN, 0, 999998);
        this.yOffset          = verify.number(params.yOffset, 0);
        this.xScale           = verify.number(params.xScale, 1, 0);
        this.isAbove          = verify.bool(params.isAbove, true);
        this.isFake           = verify.bool(params.isFake, false);
        this.isMulti          = verify.bool(params.isMulti, false);
        this.useOfficialSpeed = verify.bool(params.useOfficialSpeed, false);
        this.texture          = (params.texture && params.texture != '') ? params.texture : null;
        this.hitsound         = (params.hitsound && params.hitsound != '') ? params.hitsound : null;
        this.judgeline        = params.judgeline;

        this.sprite = undefined;

        if (!this.judgeline) throw new Error('Note must have a judgeline');

        this.reset();
    }

    reset(): void
    {
        this.isScored        = false;
        this.isScoreAnimated = false;
        this.isHolding       = false;
        this.lastHoldTime    = NaN;
        this.score           = 0;
        this.scoreTime       = 0;

        if (this.sprite) (this.sprite as Sprite).alpha = this.basicAlpha;
    }

    createSprite(texture: Record<string, unknown>, zipFiles: Record<string, unknown>, multiHL: boolean = true, debug: boolean = false): Sprite | Container
    {
        if (this.sprite) return this.sprite;

        switch (this.type)
        {
            case 1:
            {
                this.sprite = new Sprite(
                    (this.texture && this.texture != '' ?
                    zipFiles[this.texture] :
                    texture['tap' + (this.isMulti && multiHL ? 'HL' : '')]) as import('pixi.js').Texture
                );
                break;
            }
            case 2:
            {
                this.sprite = new Sprite(
                    (this.texture && this.texture != '' ?
                    zipFiles[this.texture] :
                    texture['drag' + (this.isMulti && multiHL ? 'HL' : '')]) as import('pixi.js').Texture
                );
                break;
            }
            case 3:
            {
                if (this.texture && this.texture != '')
                {
                    this.sprite = new Sprite(zipFiles[this.texture] as import('pixi.js').Texture);
                    (this.sprite as Sprite).anchor.set(0.5, 1);
                    (this.sprite as Sprite).height = this.holdLength;
                }
                else
                {
                    this.sprite = new Container();

                    let head = new Sprite(texture['holdHead' + (this.isMulti && multiHL ? 'HL' : '')] as import('pixi.js').Texture);
                    let body = new Sprite(texture['holdBody' + (this.isMulti && multiHL ? 'HL' : '')] as import('pixi.js').Texture);
                    let end = new Sprite(texture['holdEnd'] as import('pixi.js').Texture);

                    head.anchor.set(0.5);
                    body.anchor.set(0.5, 1);
                    end.anchor.set(0.5, 1);

                    body.height = this.holdLength;

                    head.position.set(0, head.height / 2);
                    body.position.set(0, 0);
                    end.position.set(0, -body.height);

                    this.sprite.addChild(head);
                    this.sprite.addChild(body);
                    this.sprite.addChild(end);
                }
                break;
            }
            case 4:
            {
                this.sprite = new Sprite(
                    (this.texture && this.texture != '' ?
                    zipFiles[this.texture] :
                    texture['flick' + (this.isMulti && multiHL ? 'HL' : '')]) as import('pixi.js').Texture
                );
                break;
            }
            default :
            {
                throw new Error('Unsupported note type: ' + this.type);
            }
        }

        if (this.type !== 3) (this.sprite as Sprite).anchor.set(0.5);
        if (!this.isAbove) (this.sprite as Sprite).angle = 180;
        (this.sprite as Sprite).alpha = this.basicAlpha;
        (this.sprite as Sprite).visible = false;
        (this.sprite as Sprite).outScreen = true;

        if (this.hitsound)
        {
            this.hitsound = zipFiles[this.hitsound as string];
        }

        // For debug propose
        if (debug)
        {
            let noteInfoContainer = new Container();
            let noteId = new Text(this.judgeline.id + (this.isAbove ? '+' : '-') + this.id, {
                fontSize: 48,
                fill: 0x00E6FF
            });
            let notePosBlock = new Graphics()
                .beginFill(0x00E6FF)
                .drawRect(-22, -22, 44, 44)
                .endFill();
            
            noteId.anchor.set(0.5);
            noteId.position.set(0, -36 - noteId.height / 2);
            noteId.angle = this.isAbove ? 0 : 180;

            noteInfoContainer.addChild(noteId);
            noteInfoContainer.addChild(notePosBlock);

            this.debugSprite = noteInfoContainer;
        }

        return this.sprite;
    }

    calcTime(currentTime: number, size: Size): void
    {
        let _yOffset = size.height * this.yOffset,
            yOffset = _yOffset * (this.isAbove ? -1 : 1),
            originX = size.widthPercent * this.positionX,
            _originY = (this.floorPosition - this.judgeline.floorPosition) * (this.type === 3 && this.useOfficialSpeed ? 1 : this.speed) * size.noteSpeed + _yOffset,
            originY = _originY * (this.isAbove ? -1 : 1),

            realX = originY * this.judgeline.sinr * -1,
            realY = originY * this.judgeline.cosr,

            _holdLength = this.type === 3 ? (this.useOfficialSpeed ? (this.holdTimeLength - currentTime) : (this.endPosition - this.judgeline.floorPosition)) * this.speed * size.noteSpeed : _originY,
            holdLength = this.type === 3 ? _holdLength * (this.isAbove ? -1 : 1) : originY;
        
        if (!isNaN(this.judgeline.inclineSinr) && this.type !== 3)
        {
            let inclineValue = 1 - ((this.judgeline.inclineSinr * _originY) / 360);
            this.sprite!.scale.set(inclineValue * this.sprite!.baseScale! * this.xScale, inclineValue * this.sprite!.baseScale!);
            originX *= inclineValue;
        }

        if (this.type !== 3)
        {
            originX *= this.judgeline.calcNoteControl(_originY, 'x', 1);
        }

        if (this.type === 3) // Hold 长度计算
        {
            if (this.time <= currentTime && this.holdTimeLength > currentTime)
            {
                realX = realY = 0;

                (this.sprite as Container).children[0].visible = false;
                ((this.sprite as Container).children[1] as Sprite).height = _holdLength / size.noteScale;
                (this.sprite as Container).children[2].position.y = ((this.sprite as Container).children[1] as Sprite).height * -1;
            }
            else
            {
                (this.sprite as Container).children[0].visible = true;
            }
        }
        
        // Note 落在判定线时的绝对位置计算
        this.sprite!.judgelineX = originX * this.judgeline.cosr + this.judgeline.sprite!.position.x;
        this.sprite!.judgelineY = originX * this.judgeline.sinr + this.judgeline.sprite!.position.y;

        // Note 的绝对位置计算
        realX += this.sprite!.judgelineX!;
        realY += this.sprite!.judgelineY!;

        // Note 落在判定线时的绝对位置计算（补 y 轴偏移）
        this.sprite!.judgelineX += yOffset * this.judgeline.sinr * -1;
        this.sprite!.judgelineY += yOffset * this.judgeline.cosr;

        // Note 是否在舞台可视范围内
        this.sprite!.outScreen = !isInArea({
            startX : realX,
            endX   : originX * this.judgeline.cosr - holdLength * this.judgeline.sinr + this.judgeline.sprite!.position.x,
            startY : realY,
            endY   : holdLength * this.judgeline.cosr + originX * this.judgeline.sinr + this.judgeline.sprite!.position.y
        }, size);

        // 推送计算结果到精灵
        (this.sprite as Sprite).visible = !this.sprite!.outScreen;
        if (this.debugSprite) this.debugSprite.visible = !this.sprite!.outScreen;

        (this.sprite as Sprite).position.x = realX;
        (this.sprite as Sprite).position.y = realY;
        
        (this.sprite as Sprite).angle = this.judgeline.sprite!.angle + (this.isAbove ? 0 : 180);

        // Note 在舞台可视范围之内时做进一步计算
        if (!this.sprite!.outScreen)
        {
            if (this.type !== 3)
            {
                let noteCtrlScale = this.judgeline.calcNoteControl(_originY, 'scale', 1);
                this.sprite!.scale.set(this.sprite!.baseScale! * this.xScale * noteCtrlScale, this.sprite!.baseScale! * noteCtrlScale);
                (this.sprite as Sprite).alpha = this.isScoreAnimated ? 0 : this.basicAlpha * this.judgeline.calcNoteControl(_originY, 'alpha', 1);
            }
            else
            {
                (this.sprite as Sprite).alpha = this.isScored && this.score <= 1 ? 0.5 : this.basicAlpha * this.judgeline.calcNoteControl(_originY, 'alpha', 1);
            }

            (this.sprite as Sprite).visible = ((this.sprite as Sprite).alpha > 0);

            // Note 特殊位置是否可视控制
            if (this.type !== 3 && this.time > currentTime && _originY < 0 && this.judgeline.isCover) (this.sprite as Sprite).visible = false;
            if (this.type !== 3 && this.isFake && this.time <= currentTime) (this.sprite as Sprite).visible = false;
            if (
                this.type === 3 &&
                (
                    (this.time > currentTime && _originY < 0 && this.judgeline.isCover) || // 时间未开始时 Hold 在判定线对面
                    (this.holdTimeLength <= currentTime) // Hold 已经被按完
                )
            ) (this.sprite as Sprite).visible = false;
            
            if (!isNaN(this.visibleTime) && this.time - currentTime > this.visibleTime) (this.sprite as Sprite).visible = false;

            if (this.judgeline.alpha < 0)
            {
                if (this.judgeline.alpha >= -1) (this.sprite as Sprite).visible = false;
                else if (this.judgeline.alpha >= -2)
                {
                    if (originY > 0) (this.sprite as Sprite).visible = false;
                    else if (originY < 0) (this.sprite as Sprite).visible = true;
                }
            }

            if (this.debugSprite)
            {
                this.debugSprite.position = (this.sprite as Sprite).position;
                this.debugSprite.angle = (this.sprite as Sprite).angle;
                this.debugSprite.alpha = 0.2 + ((this.sprite as Sprite).visible ? ((this.sprite as Sprite).alpha * 0.8) : 0);

                if (this.time > currentTime)
                {
                    if (!(this.sprite as Sprite).visible)
                    {
                        (this.sprite as Sprite).visible = true;
                        (this.sprite as Sprite).alpha = 0.2;
                    }
                    else
                    {
                        (this.sprite as Sprite).alpha = this.basicAlpha;
                    }
                }
            }
        }
    }
}


function isInArea(sprite: AreaCheck, area: Size): boolean
{
    let startX = sprite.startX <= sprite.endX ? sprite.startX : sprite.endX,
        endX = sprite.startX <= sprite.endX ? sprite.endX : sprite.startX,
        startY = sprite.startY <= sprite.endY ? sprite.startY : sprite.endY,
        endY = sprite.startY <= sprite.endY ? sprite.endY : sprite.startY;
    
    if (
        (
            startX >= area.width * 0 && startY >= area.height * 0 &&
            endX <= area.width && endY <= area.height
        ) ||
        (
            endX >= area.width * 0 && endY >= area.height * 0 &&
            startX <= area.width && startY <= area.height
        )
    ) {
        return true;
    }
    else
    {
        return false;
    }
}
