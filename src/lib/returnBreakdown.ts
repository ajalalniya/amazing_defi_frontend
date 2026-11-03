import type { BacktestResult } from '@/api/types'

// returnBreakdown walks a backtest from starting capital to final value. The
// steps add up exactly to netPnl, because every leg's net is
// carry + market + il:
//   - LP carry is the fees earned;
//   - LP market + il is its price P/L, which for a rebalancing leg already has
//     the pool swap fees taken out, so those are added back here and shown as
//     their own cost;
//   - perp market is directional P/L and perp carry is funding less trading
//     fees (rebalance reopen fees included).
export function returnBreakdown(r: BacktestResult) {
  let fees = 0, lpPrice = 0, swapCost = 0, perpMarket = 0, perpCarry = 0
  for (const l of r.legs) {
    if (l.kind === 'lp') {
      fees += l.carry
      swapCost += l.rebalanceCost || 0
      lpPrice += l.market + l.il + (l.rebalanceCost || 0)
    } else {
      perpMarket += l.market
      perpCarry += l.carry
    }
  }
  // Fees are collected to the side, never reinvested: the fund is the
  // positions alone, and the total is fund plus fees.
  const finalValue = r.capital + r.netPnl
  const fundValue = finalValue - fees
  const pct = (v: number) => (r.capital ? (v / r.capital) * 100 : 0)
  return {
    capital: r.capital,
    fees,
    lpPrice,
    perpMarket,
    perpCarry,
    swapCost,
    fundValue,
    finalValue,
    returnPct: pct(r.netPnl),
    returnExFeesPct: pct(r.netPnl - fees),
    feesPct: pct(fees),
    hasPerps: r.legs.some((l) => l.kind !== 'lp'),
  }
}
