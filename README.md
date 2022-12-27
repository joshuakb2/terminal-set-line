# terminal-set-line

This library is meant to solve exactly 1 problem: how to efficiently display the status of multiple simultaneous processes on the terminal.

For doing complex things with the terminal, especially interactively, a more powerful library like terminal-kit should be used, but if you just want to easily print a line of text and rewrite that line even after other things have been printed below it, this library makes it simple.

```js
import { setLine, reset } from 'terminal-set-line';

// This is the same as console.log('First line'), initially.
setLine(0, 'First line');

// After the first setLine, virtual line numbers stay
// consistent with each other.

setLine(1, 'Second line');
setLine(5, 'Skipped 3 lines');

// If line 0 is no longer visible, this will do nothing.
// Otherwise, the first line we printed will be overwritten.
setLine(0, 'Rewrote first line');

// The cursor will always rest below the lowest printed line,
// so right now the cursor is at the start of virtual line 6.

reset();
setLine(0, 'Starting again');

// Virtual line 6 has become the new virtual line 0.
```
