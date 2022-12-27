type Pair<Result> = {
    index: number;
    result: Result;
};

/**
 * Returns an async iterator for the results of running the given job for each given input, in parallel,
 * but not exceeding maxAtOnce simultaneously.
 *
 * The optional isCandidateAcceptable function has this interface: (indexOfInput, setOfActiveInputs) => boolean.
 * If it gives false, then that input is skipped.
 *
 */
const threadpool = <Input, Result>(
    job: (input: Input, index: number) => Promise<Result>,
    maxAtOnce: number,
    inputs: Input[],
    isCandidateAcceptable?: (index: number, active: Set<number>) => boolean,
): AsyncIterable<Pair<Result>> => {
    let completed = 0;
    let promiseForNext: Promise<IteratorResult<Pair<Result>>> | undefined;
    let produceNext: ((next: Pair<Result>) => void) | undefined;
    let produceError: ((err: Error) => void) | undefined;
    // promiseConsumed will be true iff the iterator has consumed the uncompleted promise.
    let promiseConsumed = false;
    // promiseQueue contains completed promises that have not been consumed by the iterator yet.
    let promiseQueue: Promise<IteratorResult<Pair<Result>>>[] = [];
    // indexes of inputs whose jobs are yet to start
    let yetToStart = range(inputs.length);
    // set of indexes of inputs whose jobs are active right now
    let active = new Set<number>();

    let makeNextPromise = () => {
        if (!promiseConsumed && promiseForNext) promiseQueue.push(promiseForNext);
        promiseForNext = new Promise((resolve, reject) => {
            produceNext = value => resolve({ done: false, value });
            produceError = reject;
        });
        promiseConsumed = false;
    };

    if (inputs.length > 0) makeNextPromise();

    let getUpToSpeed = () => {
        // Start jobs while there are jobs left to run and the number of active jobs is less than the limit.
        for (let i = 0; i < yetToStart.length && active.size < maxAtOnce; i++) {
            let inputIndex = yetToStart[i];
            let acceptable = isCandidateAcceptable ? isCandidateAcceptable(inputIndex, active) : true;

            if (!acceptable) continue;

            yetToStart.splice(i, 1);
            startJob(inputIndex);
            // Start over because acceptance criteria might've changed
            i = -1;
        }

        // If this happens, there are jobs that will never run!
        if (yetToStart.length > 0 && active.size === 0) {
            produceError?.(new Error(
                `The threadpool is stuck. ${yetToStart.length} input${yetToStart.length === 1 ? '' : 's'} will never be processed!` +
                (isCandidateAcceptable ? `\nMake sure your isCandidiateAcceptable predicate is correct!` : '') +
                `\nInput${yetToStart.length === 1 ? '' : 's'} that will not be processed: ${yetToStart.join(', ')}`
            ));
        }
    }

    let startJob = (i: number) => {
        active.add(i);
        job(inputs[i], i).then(
            result => {
                let f = produceNext;
                onPromiseCompleted(i);
                f?.({ index: i, result });
            },
            error => {
                let f = produceError;
                onPromiseCompleted(i);
                f?.(error);
            }
        );
    };

    // When a job is done, set up a new promise for the next job
    let onPromiseCompleted = (i: number) => {
        active.delete(i);
        completed++;
        if (completed < inputs.length) makeNextPromise();
        getUpToSpeed();
    };

    getUpToSpeed();

    return {
        [Symbol.asyncIterator]: () => ({
            next: () => {
                if (completed === inputs.length && promiseQueue.length === 0 && promiseConsumed) return Promise.resolve({ done: true, value: undefined });

                let promiseToReturn: Promise<IteratorResult<Pair<Result>>>;

                if (promiseQueue.length > 0) {
                    promiseToReturn = promiseQueue.shift()!;
                }
                else if (promiseForNext) {
                    promiseToReturn = promiseForNext;
                    promiseConsumed = true;
                }
                else {
                    throw new Error('No next promise somehow?!?');
                }

                getUpToSpeed();

                return promiseToReturn;
            }
        })
    };
};

const range = (n: number) => {
    let r = [];
    for (let i = 0; i < n; i++) r.push(i);
    return r;
};

export default threadpool;
