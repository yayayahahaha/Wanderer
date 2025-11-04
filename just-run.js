function simulateProbability(probability = 0.1, expected = 0.9) {
  const results = []

  let i = 1
  while (true) {
    // 計算至少命中一次的機率
    const hitProbability = 1 - Math.pow(1 - probability, i)

    const 花費GP = 5000 * (i - Math.floor(i / 6))
    const 課金單數 = Math.ceil(花費GP / 13700)
    results.push({
      嘗試次數: i,
      抽中機率: `${(hitProbability * 100).toFixed(2)}%`,
      沒中機率: `${((1 - hitProbability) * 100).toFixed(2)}%`,
      花費GP,
      課金單數,
      '預期台幣(匯率0.25)': 課金單數 * 2500,
    })

    i++
    if (hitProbability >= expected) break
  }

  i++
  return results
}

// 範例使用
const probability = 0.1 // 30%的機率

console.log(simulateProbability(probability))
