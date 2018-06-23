export function runPromises(promises, count=2) {
  return new Promise((resolve) => {
    let nextPromise = 0;
    let fullfildPromises = 0;

    const responses = new Array(promises.length);

    const runSinglePromise = (currentIndex) => {
      nextPromise++;
      // if (promises.length>1){
      //   console.log(`activating ${currentIndex+1}/${promises.length}`);
      // }

      function handleFullfiled(res){
        fullfildPromises++;
        // if (promises.length>1){
        //   console.log(`done ${fullfildPromises}/${promises.length}`);
        // }
        responses[currentIndex] = res;
        if (fullfildPromises === promises.length){
          resolve(responses);
        }

        if (nextPromise < promises.length){
          runSinglePromise(nextPromise);
        }
      }
      promises[currentIndex]().then(handleFullfiled, handleFullfiled);
    };

    for (let i = 0; i < Math.min(promises.length, count); i++) {
      runSinglePromise(i);
    }
  });
}
