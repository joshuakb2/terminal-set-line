import './augmentations';
import { sync as getCursorPosition } from 'get-cursor-position';

// This is the greatest virtual line number that has been set.
// Greatest == highest number, lowest location on the screen.
// The cursor will live on the empty line below this one between writes.
let lowestPrintedLine: number | null = null;

const getWindowHeight = () => process.stdout.getWindowSize()[1];
const write = (s: string) => process.stdout.write(s);
const down = (n: number) => process.stdout.moveCursor(0, n);
const up = (n: number) => process.stdout.moveCursor(0, -n);
const eraseLine = () => process.stdout.clearLine(0);

export const setLine = (i: number, msg: string) => {
    // dy is the downward offset from the cursor's current virtual
    // position to where it needs to be.
    let dy = i - (lowestPrintedLine == null ? 0 : lowestPrintedLine + 1);

    // y is the cursor's actual position in the terminal window
    let { row: y } = getCursorPosition();

    // This line is already off the screen, can't write to it
    if (y + dy < 1) return;

    let height = getWindowHeight();

    // This line is below the screen, so we need to add
    // new lines to the buffer
    if (y + dy >= height) {
        for (let i = 0; i < dy; i++) write('\n');
    }
    // This line is on the screen, but below us
    else if (dy > 0) down(dy);
    // This line is on the screen, but above us
    else if (dy < 0) up(-dy);
    // Otherwise, we are already on the correct line

    eraseLine();
    write(`${msg}\n`);

    // That final newline took us down 1 row
    lowestPrintedLine = Math.max(lowestPrintedLine ?? -Infinity, i);

    // Put the cursor on the line after the lowest printed line
    if (i < lowestPrintedLine) {
        down(lowestPrintedLine - i);
    }
};

// Restart the virtual line numbering at 0 again
export const reset = () => {
    lowestPrintedLine = null;
};
