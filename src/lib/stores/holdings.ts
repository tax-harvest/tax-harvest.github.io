/**
 * Holdings Store
 * Manages calculated holdings from trade records with derived stores
 * for filtering by classification and identifying tax loss harvesting opportunities
 */

import { writable, derived } from 'svelte/store';
import type { Holding, TradeRecord, RealizedGainsSummary } from '$lib/types';
import { analyzePortfolio } from '$lib/utils/holdings-calculator';

/**
 * Primary store for all calculated holdings
 * Holdings are calculated from trade records using FIFO logic
 */
export const holdings = writable<Holding[]>([]);

/**
 * Store for realized gains/losses from the current financial year
 */
export const realizedGains = writable<RealizedGainsSummary>({
	stcg: 0,
	stcl: 0,
	ltcg: 0,
	ltcl: 0,
	netShortTerm: 0,
	netLongTerm: 0,
	entries: []
});

/**
 * Derived store for short-term holdings only
 * Short-term: held for 365 days or less (req 3.4)
 */
export const shortTermHoldings = derived(holdings, ($holdings) =>
	$holdings.filter((holding) => holding.classification === 'SHORT_TERM')
);

/**
 * Derived store for long-term holdings only
 * Long-term: held for more than 365 days (req 3.4)
 */
export const longTermHoldings = derived(holdings, ($holdings) =>
	$holdings.filter((holding) => holding.classification === 'LONG_TERM')
);

/**
 * Derived store for Short-Term Capital Loss (STCL) opportunities
 * Holdings with short-term lots (<=365 days) that are currently at a loss
 *
 * A holding appears here if it has ANY short-term lots in loss (stPnl < 0)
 * This is more accurate than classifying entire holdings by oldest lot
 */
export const stclOpportunities = derived(holdings, ($holdings) =>
	$holdings.filter((holding) => {
		// Must have ST lots and they must be at a loss
		return holding.stQuantity !== undefined && holding.stQuantity > 0 && holding.stPnl !== undefined && holding.stPnl < 0;
	})
);

/**
 * Derived store for Long-Term Capital Loss (LTCL) opportunities
 * Holdings with long-term lots (>365 days) that are currently at a loss
 *
 * A holding appears here if it has ANY long-term lots in loss (ltPnl < 0)
 * This is more accurate than classifying entire holdings by oldest lot
 */
export const ltclOpportunities = derived(holdings, ($holdings) =>
	$holdings.filter((holding) => {
		// Must have LT lots and they must be at a loss
		return holding.ltQuantity !== undefined && holding.ltQuantity > 0 && holding.ltPnl !== undefined && holding.ltPnl < 0;
	})
);

/**
 * Updates the holdings store by recalculating holdings from trade records
 * Uses the FIFO-based holdings calculator
 * Also calculates realized gains for the current financial year
 *
 * @param trades - Array of TradeRecord objects from parsed tradebooks
 */
export function updateHoldingsFromTrades(trades: TradeRecord[]): void {
	const analysis = analyzePortfolio(trades);
	holdings.set(analysis.holdings);
	realizedGains.set(analysis.realizedGains);
}

/**
 * Clears all holdings data and resets the store to empty state
 */
export function clearHoldings(): void {
	holdings.set([]);
	realizedGains.set({
		stcg: 0,
		stcl: 0,
		ltcg: 0,
		ltcl: 0,
		netShortTerm: 0,
		netLongTerm: 0,
		entries: []
	});
}
