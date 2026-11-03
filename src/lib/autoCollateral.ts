import { amounts, liquidityFor } from './clmath'

// An LP leg as the collateral sizing sees it: its capital and range, and the
// price it opens at (the On-chain From-day close, or spot in Scenario mode).
export type LpForCollateral = { capital: number; lower: number; upper: number; p0: number }

// ETH the LP holds at price p, in USD: the short a delta hedge needs there.
function exposureUsd(lp: LpForCollateral, p: number) {
  const { capital, lower, upper, p0 } = lp
  if (!(capital > 0 && lower > 0 && upper > lower && p0 > 0)) return 0
  const L = liquidityFor(capital, p0, lower, upper)
  return amounts(p, lower, upper, L).a0 * p
}

// autoCollateral sizes a short's collateral from the LP legs it hedges.
//
//   fixed size:  the LP's ETH exposure at the open ÷ leverage, so the short's
//                notional (collateral × leverage) matches the LP's delta when
//                it opens.
//   delta hedge: the largest notional the hedge can reach ÷ leverage. As price
//                falls the LP buys ETH and the hedge grows; it peaks at the
//                lower edge, where the LP is all ETH (below it the ETH amount
//                stops growing and its USD value falls). Collateral for that
//                peak keeps the hedge at or under `leverage` throughout.
//
// Rounded up to whole dollars. Returns null when there is no LP to size from.
export function autoCollateral(lps: LpForCollateral[], hedge: boolean, leverage: number): number | null {
  const lev = leverage > 0 ? leverage : 1
  let notional = 0
  let any = false
  for (const lp of lps) {
    const e = hedge ? exposureUsd(lp, lp.lower) : exposureUsd(lp, lp.p0)
    if (e > 0) any = true
    notional += e
  }
  if (!any) return null
  return Math.ceil(notional / lev)
}
