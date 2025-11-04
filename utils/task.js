const os = require('os')

/**
 * @description 根據cpu 和空閒記憶體等去計算約莫的task 數量
 */
const taskNumberCreater = () => {
  const cpus = os.cpus()
  const cpusAmount = cpus.length
  const cpuSpec =
    cpus.reduce(function (cardinalNumber, cpu) {
      let total = 0
      for (const item in cpu.times) {
        total += cpu.times[item]
      }
      return cardinalNumber + (cpu.times.idle * 100) / total
    }, 0) / cpusAmount

  const memory = os.freemem() / Math.pow(1024, 3) // GB

  const taskNumber = (memory * cpuSpec) / 10

  return Math.round(taskNumber)
}

module.exports = { taskNumberCreater }
