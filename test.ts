#!/usr/bin/env node

import { reset, setLine } from './index';
import threadpool from './threadpool';
import 'colors';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

async function main() {
    let inputs = range(50).map(i => i + 1);

    for await (let { index } of threadpool(doSlowAsyncJob, 20, inputs)) {
        // Do nothing
    }

    console.log('First set of jobs completed. Second set starting in 3 seconds.');
    await sleep(3000);
    reset();

    for await (let { index } of threadpool(doSlowAsyncJob, 20, inputs)) {
        // Do nothing
    }

    console.log('All done!');

    async function doSlowAsyncJob(n: number, i: number) {
        setLine(i, `${n}: 0%`);

        let step = 0;

        for (let j = 0; j < 10; j++) {
            await sleep(Math.random() * 1000);
            step++;
            let message = `${step * 10}%`;
            let coloredMessage =
                step < 3 ? message :
                step < 7 ? message.blue :
                step < 10 ? message.yellow :
                message.green;
            setLine(i, `${n}: ${coloredMessage}`);
        }
    }
}

main();
