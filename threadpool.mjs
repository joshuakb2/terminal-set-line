/**
 * Returns an async iterator for the results of running the given job for each given input, in parallel,
 * but not exceeding maxAtOnce simultaneously.
 *
 * The optional isCandidateAcceptable function has this interface: (indexOfInput, setOfActiveInputs) => boolean.
 * If it gives false, then that input is skipped.
 *
 * @param {input => Promise<Output>} job
 * @param {int} maxAtOnce
 * @param {input[]} inputs
 * @param {function?} isCandidateAcceptable
 * @returns {async iterable of Promise<{ i: number, value: Output }>}
 */
const threadpool = (job, maxAtOnce, inputs, isCandidateAcceptable) => {
    let completed = 0;
    let promiseForNext, produceNext, produceError;
    // promiseConsumed will be true iff the iterator has consumed the uncompleted promise.
    let promiseConsumed = false;
    // promiseQueue contains completed promises that have not been consumed by the iterator yet.
    let promiseQueue = [];
    // indexes of inputs whose jobs are yet to start
    let yetToStart = range(inputs.length);
    // set of indexes of inputs whose jobs are active right now
    let active = new Set();

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
            produceError(new Error(
                `The threadpool is stuck. ${yetToStart.length} input${yetToStart.length === 1 ? '' : 's'} will never be processed!` +
                (isCandidateAcceptable ? `\nMake sure your isCandidiateAcceptable predicate is correct!` : '') +
                `\nInput${yetToStart.length === 1 ? '' : 's'} that will not be processed: ${yetToStart.join(', ')}`
            ));
        }
    }

    let startJob = i => {
        active.add(i);
        job(inputs[i], i).then(
            value => {
                let f = produceNext;
                onPromiseCompleted(i);
                f({ i, value });
            },
            error => {
                let f = produceError;
                onPromiseCompleted(i);
                f(error);
            }
        );
    };

    // When a job is done, set up a new promise for the next job
    let onPromiseCompleted = i => {
        active.delete(i);
        completed++;
        if (completed < inputs.length) makeNextPromise();
        getUpToSpeed();
    };

    getUpToSpeed();

    return {
        [Symbol.asyncIterator]: () => ({
            next: () => {
                if (completed === inputs.length && promiseQueue.length === 0 && promiseConsumed) return Promise.resolve({ done: true });

                let promiseToReturn;

                if (promiseQueue.length > 0) {
                    promiseToReturn = promiseQueue.shift();
                }
                else {
                    promiseToReturn = promiseForNext;
                    promiseConsumed = true;
                }

                getUpToSpeed();

                return promiseToReturn;
            }
        })
    };
};

const range = n => {
    let r = [];
    for (let i = 0; i < n; i++) r.push(i);
    return r;
};

export default threadpool;
