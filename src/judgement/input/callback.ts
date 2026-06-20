import type Input from './index';

function touchStart(this: Input, e: TouchEvent): void
{
    e.preventDefault();
    for (const i of e.changedTouches)
    {
        const { clientX, clientY, identifier } = i;
        this.addInput('touch', identifier, clientX - this.renderSize.widthOffset, clientY);
    }
}

function touchMove(this: Input, e: TouchEvent): void
{
    e.preventDefault();
    for (const i of e.changedTouches)
    {
        const { clientX, clientY, identifier } = i;
        this.moveInput('touch', identifier, clientX - this.renderSize.widthOffset, clientY);
    }
}

function touchEnd(this: Input, e: TouchEvent): void
{
    e.preventDefault();
    for (const i of e.changedTouches)
    {
        this.removeInput('touch', i.identifier);
    }
}

function mouseStart(this: Input, e: MouseEvent): void
{
    e.preventDefault();
    const { clientX, clientY, button } = e;
    this.addInput('mouse', button, clientX - this.renderSize.widthOffset, clientY);
}

function mouseMove(this: Input, e: MouseEvent): void
{
    const { clientX, clientY, button } = e;
    this.moveInput('mouse', button, clientX - this.renderSize.widthOffset, clientY);
}

function mouseEnd(this: Input, e: MouseEvent): void
{
    this.removeInput('mouse', e.button);
}

export default {
    touchStart,
    touchMove,
    touchEnd,
    mouseStart,
    mouseMove,
    mouseEnd
}
