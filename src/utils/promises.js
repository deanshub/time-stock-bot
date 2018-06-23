export function runPromises (promises, count=2) {
  return new Promise((resolve) => {
    let nextPromise = 0;
    let fullfildPromises = 0;

    const responses = new Array(promises.length);

    const runSinglePromise = (currentIndex) => {
      nextPromise++;
      promises[currentIndex]().then((res) => {
        fullfildPromises++;
        responses[currentIndex] = res;
        if (fullfildPromises === promises.length){
          resolve(responses);
        }

        if (nextPromise < promises.length){
          runSinglePromise(nextPromise);
        }
      });
    };

    for (let i = 0; i < Math.min(promises.length, count); i++) {
      runSinglePromise(i);
    }
  });
}
