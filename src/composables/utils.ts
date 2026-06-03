export type TimeStringTimeFormatOptions = 'HH:mm:ss' | 'HH:mm' | 'hh:mm:ss a' | 'hh:mm a'; 

const useUtils = () => {


    const secondsToTimeString = ({
        seconds = 0, 
        format = 'HH:mm:ss', 
        hideEmptySeconds = true, 
        hideEmptyMinutes = true,
        ignoreLeadingZeroHours = true
    }: {
        seconds?: number,
        format?: TimeStringTimeFormatOptions,
        hideEmptySeconds?: boolean,
        hideEmptyMinutes?: boolean,
        ignoreLeadingZeroHours?: boolean
    }): string => {
        const date = new Date(seconds * 1000);

        const hours = date.getUTCHours();
        const minutes = date.getUTCMinutes();
        const secondsPart = date.getUTCSeconds();

        const ampm = hours >= 12 ? 'PM' : 'AM';
        const hours12 = hours % 12 || 12;   

        const h = ignoreLeadingZeroHours ? hours12.toString() : hours12.toString().padStart(2, '0');

        const m = minutes.toString().padStart(2, '0');
        const s = secondsPart.toString().padStart(2, '0');

        let result = h;

        if (format.includes('mm') && (!hideEmptyMinutes || minutes > 0)) {
            result += `:${m}`;
        }

        if (format.includes('ss') && (!hideEmptySeconds || secondsPart > 0)) {
            result += `:${s}`;
        }

        if (format.includes('a')) {
            result += ` ${ampm}`;
        }

        console.log({ result, hours, minutes, secondsPart, format, hideEmptySeconds, hideEmptyMinutes, ignoreLeadingZeroHours });

        return result;
    }

    const calculateFrameWidth = (frameStart: number, frameEnd: number, pixelsPerSecond: number): number => {
        const duration = frameEnd - frameStart;
        return duration * pixelsPerSecond;
    }

    // Converts an absolute ms time to its left-edge pixel offset inside the
    // editor area. `range.start_seconds` is a HARD viewport: time `rangeStartMs`
    // maps to `paddingLeft`; times before that produce negative offsets and
    // clip off-screen left. Use this everywhere a placeholder, ghost, snap
    // guide, or grid line needs to be positioned by ms.
    const msToEditorLeft = (
        ms: number,
        rangeStartMs: number,
        pixelPerMs: number,
        paddingLeft: number,
    ): number => ((ms - rangeStartMs) * pixelPerMs) + paddingLeft;

    return {
        secondsToTimeString,
        calculateFrameWidth,
        msToEditorLeft,
    }
}

export default useUtils;