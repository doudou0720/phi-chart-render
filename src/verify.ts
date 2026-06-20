function bool(value: unknown, defaultValue: boolean = false): boolean
{
    return (typeof value === 'boolean') ? !!value : defaultValue;
}

function number(value: unknown, defaultValue: number = 0, min: number = -Infinity, max: number = Infinity): number
{
    return (!isNaN(value as number) && min <= parseFloat(value as string) && parseFloat(value as string) <= max ? parseFloat(value as string) : defaultValue);
}

function text(value: unknown, defaultValue: string = ''): string
{
    return ((typeof value === 'string') && value != '') ? value : defaultValue;
}

export {
    bool,
    number,
    text
}
