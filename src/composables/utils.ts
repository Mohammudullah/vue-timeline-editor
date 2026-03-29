const useUtils = () => {

    const secondsToDayTimeString = (
        seconds: number,
        is24: boolean,
        showEmptySeconds: boolean,
        showEmptyMinutes: boolean
    ): string => {
        const date = new Date(seconds * 1000);

        const hours = date.getUTCHours();
        const minutes = date.getUTCMinutes();
        const secondsPart = date.getUTCSeconds();

        const ampm = hours >= 12 ? 'PM' : 'AM';
        const hours12 = hours % 12 || 12;

        const h = is24
            ? hours.toString().padStart(2, '0')
            : hours12.toString();

        const m = minutes.toString().padStart(2, '0');
        const s = secondsPart.toString().padStart(2, '0');

        let result = h;

        // Minutes
        if (showEmptyMinutes || minutes !== 0 || secondsPart !== 0) {
            result += `:${m}`;
        }

        // Seconds
        if (showEmptySeconds || secondsPart !== 0) {
            result += `:${s}`;
        }

        if (!is24) {
            result += ` ${ampm}`;
        }

        return result;
    };


    const secondsToTimeString = (seconds: number): string => {
        const date = new Date(seconds * 1000);
        const hours = date.getUTCHours();
        const minutes = date.getUTCMinutes();
        const secondsPart = date.getUTCSeconds();
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secondsPart.toString().padStart(2, '0')}`;
    }

    return {
        secondsToTimeString,
        secondsToDayTimeString
    }
}

export default useUtils;