const MasterHouse = require('MasterHouse')
const masterHouse = new MasterHouse({
  workerNumber: 1,
  basicDelay: 1000,
  randomDelay: 500,
})

module.exports = { masterHouse }
