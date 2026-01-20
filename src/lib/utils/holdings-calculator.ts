/**
 * Holdings Calculator with FIFO (First-In-First-Out) Logic
 * Processes trade records to calculate current holdings with accurate lot tracking
 */

import { differenceInDays } from 'date-fns';
import type { TradeRecord, Holding, HoldingLot, Classification, RealizedGainEntry, RealizedGainsSummary } from '$lib/types';

/**
 * Internal structure for tracking holdings during calculation
 */
interface HoldingAccumulator {
	symbol: string;
	isin: string;
	exchange: string;
	lots: HoldingLot[];
}

/**
 * Creates a unique key for grouping trades by symbol and exchange
 * NSE and BSE trades for the same stock are treated as separate holdings (req 2.5)
 */
function createHoldingKey(symbol: string, exchange: string): string {
	return `${symbol}:${exchange}`;
}

/**
 * Sorts trades chronologically by trade date
 * Earlier trades are processed first to maintain FIFO order
 */
function sortTradesChronologically(trades: TradeRecord[]): TradeRecord[] {
	return [...trades].sort((a, b) => a.tradeDate.getTime() - b.tradeDate.getTime());
}

/**
 * Groups trades by symbol+exchange combination
 * Each group will be processed independently
 */
function groupTradesByHolding(trades: TradeRecord[]): Map<string, TradeRecord[]> {
	const groups = new Map<string, TradeRecord[]>();

	for (const trade of trades) {
		const key = createHoldingKey(trade.symbol, trade.exchange);
		const existing = groups.get(key) || [];
		existing.push(trade);
		groups.set(key, existing);
	}

	return groups;
}

/**
 * Result of applying FIFO sell - includes consumed lot info for gain calculation
 */
interface FifoSellResult {
	/** Lots consumed with their quantities and prices */
	consumedLots: { quantity: number; purchaseDate: Date; purchasePrice: number }[];
	/** Weighted average purchase price of consumed shares */
	avgPurchasePrice: number;
	/** Oldest purchase date among consumed lots */
	oldestPurchaseDate: Date;
}

/**
 * Applies FIFO logic to process a sell trade against existing lots
 * Consumes oldest lots first, reducing their quantity
 * Returns info about consumed lots for gain/loss calculation
 *
 * @param lots - Array of existing lots (will be mutated)
 * @param sellQuantity - Number of shares to sell
 * @returns Info about consumed lots for realized gain calculation
 */
function applyFifoSell(lots: HoldingLot[], sellQuantity: number): FifoSellResult {
	let remainingToSell = sellQuantity;
	const consumedLots: { quantity: number; purchaseDate: Date; purchasePrice: number }[] = [];

	// Process lots in order (oldest first - they should already be sorted by purchaseDate)
	for (let i = 0; i < lots.length && remainingToSell > 0; i++) {
		const lot = lots[i];

		if (lot.quantity <= remainingToSell) {
			// Consume entire lot
			consumedLots.push({
				quantity: lot.quantity,
				purchaseDate: lot.purchaseDate,
				purchasePrice: lot.purchasePrice
			});
			remainingToSell -= lot.quantity;
			lot.quantity = 0;
		} else {
			// Partial consumption of this lot
			consumedLots.push({
				quantity: remainingToSell,
				purchaseDate: lot.purchaseDate,
				purchasePrice: lot.purchasePrice
			});
			lot.quantity -= remainingToSell;
			remainingToSell = 0;
		}
	}

	// Note: If remainingToSell > 0, this indicates selling more than owned
	if (remainingToSell > 0) {
		console.warn(`FIFO sell warning: ${remainingToSell} shares could not be matched to existing lots`);
	}

	// Calculate weighted average purchase price
	let totalValue = 0;
	let totalQty = 0;
	let oldestDate = consumedLots.length > 0 ? consumedLots[0].purchaseDate : new Date();

	for (const consumed of consumedLots) {
		totalValue += consumed.quantity * consumed.purchasePrice;
		totalQty += consumed.quantity;
		if (consumed.purchaseDate < oldestDate) {
			oldestDate = consumed.purchaseDate;
		}
	}

	return {
		consumedLots,
		avgPurchasePrice: totalQty > 0 ? totalValue / totalQty : 0,
		oldestPurchaseDate: oldestDate
	};
}

/**
 * Removes lots with zero quantity from the array
 */
function removeEmptyLots(lots: HoldingLot[]): HoldingLot[] {
	return lots.filter((lot) => lot.quantity > 0);
}

/**
 * Calculates the volume-weighted average purchase price from lots
 */
function calculateAvgPurchasePrice(lots: HoldingLot[]): number {
	if (lots.length === 0) {
		return 0;
	}

	let totalValue = 0;
	let totalQuantity = 0;

	for (const lot of lots) {
		totalValue += lot.quantity * lot.purchasePrice;
		totalQuantity += lot.quantity;
	}

	return totalQuantity > 0 ? totalValue / totalQuantity : 0;
}

/**
 * Calculates the total quantity across all lots
 */
function calculateTotalQuantity(lots: HoldingLot[]): number {
	return lots.reduce((sum, lot) => sum + lot.quantity, 0);
}

/**
 * Finds the oldest purchase date from lots
 */
function findOldestPurchaseDate(lots: HoldingLot[]): Date {
	if (lots.length === 0) {
		return new Date();
	}

	return lots.reduce(
		(oldest, lot) => (lot.purchaseDate < oldest ? lot.purchaseDate : oldest),
		lots[0].purchaseDate
	);
}

/**
 * Finds the newest purchase date from lots
 */
function findNewestPurchaseDate(lots: HoldingLot[]): Date {
	if (lots.length === 0) {
		return new Date();
	}

	return lots.reduce(
		(newest, lot) => (lot.purchaseDate > newest ? lot.purchaseDate : newest),
		lots[0].purchaseDate
	);
}

/**
 * Classifies a holding as SHORT_TERM or LONG_TERM based on the oldest purchase date
 *
 * Per Indian tax law:
 * - SHORT_TERM: Held for 365 days or less (STCL can offset both STCG and LTCG)
 * - LONG_TERM: Held for more than 365 days (LTCL can only offset LTCG)
 *
 * Classification is based on the oldest lot's purchase date (req 3.1)
 *
 * @param oldestPurchaseDate - The purchase date of the oldest lot in the holding
 * @returns Classification - 'SHORT_TERM' if held <= 365 days, 'LONG_TERM' if > 365 days
 */
export function classifyHolding(oldestPurchaseDate: Date): Classification {
	const holdingDays = differenceInDays(new Date(), oldestPurchaseDate);
	return holdingDays <= 365 ? 'SHORT_TERM' : 'LONG_TERM';
}

/**
 * Extended accumulator that also tracks realized gains
 */
interface HoldingWithGains {
	accumulator: HoldingAccumulator | null;
	realizedGains: RealizedGainEntry[];
}

/**
 * Processes trades for a single symbol+exchange combination
 * Applies FIFO logic: buys create new lots, sells consume oldest lots first
 * Also tracks realized gains/losses from each sell
 *
 * IMPORTANT: Each consumed lot creates a SEPARATE realized gain entry
 * because different lots may have different holding periods (ST vs LT)
 */
function processTradesForHolding(trades: TradeRecord[]): HoldingWithGains {
	const realizedGains: RealizedGainEntry[] = [];

	if (trades.length === 0) {
		return { accumulator: null, realizedGains };
	}

	// Sort trades chronologically within this group
	const sortedTrades = sortTradesChronologically(trades);

	// Initialize accumulator with first trade's metadata
	const firstTrade = sortedTrades[0];
	const accumulator: HoldingAccumulator = {
		symbol: firstTrade.symbol,
		isin: firstTrade.isin,
		exchange: firstTrade.exchange,
		lots: []
	};

	// Process each trade
	for (const trade of sortedTrades) {
		// Update ISIN if we get a better value (non-empty)
		if (trade.isin && !accumulator.isin) {
			accumulator.isin = trade.isin;
		}

		if (trade.tradeType === 'buy') {
			// Add new lot for buy trades
			accumulator.lots.push({
				quantity: trade.quantity,
				purchaseDate: trade.tradeDate,
				purchasePrice: trade.price
			});
		} else if (trade.tradeType === 'sell') {
			// Apply FIFO for sell trades and capture consumed lot info
			const fifoResult = applyFifoSell(accumulator.lots, trade.quantity);

			// Create SEPARATE realized gain entries for each consumed lot
			// This is crucial because different lots may have different holding periods
			for (const consumedLot of fifoResult.consumedLots) {
				const sellValue = consumedLot.quantity * trade.price;
				const costBasis = consumedLot.quantity * consumedLot.purchasePrice;
				const gainLoss = sellValue - costBasis;

				// Classify based on THIS LOT's holding period at time of sale
				const holdingDays = differenceInDays(trade.tradeDate, consumedLot.purchaseDate);
				const classification: Classification = holdingDays <= 365 ? 'SHORT_TERM' : 'LONG_TERM';

				realizedGains.push({
					symbol: trade.symbol,
					exchange: trade.exchange,
					quantity: consumedLot.quantity,
					sellDate: trade.tradeDate,
					sellPrice: trade.price,
					purchasePrice: consumedLot.purchasePrice,
					purchaseDate: consumedLot.purchaseDate,
					gainLoss,
					classification
				});
			}

			// Remove fully consumed lots
			accumulator.lots = removeEmptyLots(accumulator.lots);
		}
	}

	// Return null accumulator if no remaining lots (fully sold position)
	if (accumulator.lots.length === 0) {
		return { accumulator: null, realizedGains };
	}

	return { accumulator, realizedGains };
}

/**
 * Result of portfolio analysis containing both holdings and realized gains
 */
export interface PortfolioAnalysis {
	holdings: Holding[];
	realizedGains: RealizedGainsSummary;
}

/**
 * Gets the current financial year start date
 * Indian FY runs from April 1 to March 31
 */
function getCurrentFyStartDate(): Date {
	const now = new Date();
	const month = now.getMonth(); // 0-indexed
	const year = now.getFullYear();

	// If Jan-Mar, FY started previous year April
	// If Apr-Dec, FY started this year April
	const fyStartYear = month < 3 ? year - 1 : year;
	return new Date(fyStartYear, 3, 1); // April 1
}

/**
 * Summarizes realized gains into STCG/STCL/LTCG/LTCL buckets
 * Only includes gains from current financial year
 */
function summarizeRealizedGains(entries: RealizedGainEntry[]): RealizedGainsSummary {
	const fyStart = getCurrentFyStartDate();

	// Filter to current FY only
	const fyEntries = entries.filter((e) => e.sellDate >= fyStart);

	let stcg = 0;
	let stcl = 0;
	let ltcg = 0;
	let ltcl = 0;

	for (const entry of fyEntries) {
		if (entry.classification === 'SHORT_TERM') {
			if (entry.gainLoss >= 0) {
				stcg += entry.gainLoss;
			} else {
				stcl += Math.abs(entry.gainLoss);
			}
		} else {
			if (entry.gainLoss >= 0) {
				ltcg += entry.gainLoss;
			} else {
				ltcl += Math.abs(entry.gainLoss);
			}
		}
	}

	return {
		stcg,
		stcl,
		ltcg,
		ltcl,
		netShortTerm: stcg - stcl,
		netLongTerm: ltcg - ltcl,
		entries: fyEntries
	};
}

/**
 * Calculates holdings from trade records using FIFO (First-In-First-Out) logic
 *
 * This function:
 * - Groups trades by symbol+exchange (req 2.1, 2.5)
 * - Applies FIFO for sells: oldest lots are consumed first (req 2.2)
 * - Tracks individual lots with purchaseDate and purchasePrice (req 2.3)
 * - Excludes symbols with zero net quantity (req 2.4)
 * - Classifies holdings as SHORT_TERM or LONG_TERM based on oldest lot (req 3.1, 3.2, 3.3)
 *
 * @param trades - Array of TradeRecord objects from parsed tradebooks
 * @returns Array of Holding objects representing current positions
 */
export function calculateHoldings(trades: TradeRecord[]): Holding[] {
	return analyzePortfolio(trades).holdings;
}

/**
 * Calculates both holdings and realized gains from trade records
 *
 * @param trades - Array of TradeRecord objects from parsed tradebooks
 * @returns Holdings and realized gains summary
 */
export function analyzePortfolio(trades: TradeRecord[]): PortfolioAnalysis {
	if (!trades || trades.length === 0) {
		return {
			holdings: [],
			realizedGains: { stcg: 0, stcl: 0, ltcg: 0, ltcl: 0, netShortTerm: 0, netLongTerm: 0, entries: [] }
		};
	}

	// Group trades by symbol+exchange
	const tradeGroups = groupTradesByHolding(trades);

	const holdings: Holding[] = [];
	const allRealizedGains: RealizedGainEntry[] = [];

	// Process each group independently
	for (const groupTrades of tradeGroups.values()) {
		const { accumulator, realizedGains } = processTradesForHolding(groupTrades);

		// Collect realized gains from all groups
		allRealizedGains.push(...realizedGains);

		// Skip if fully sold (accumulator is null)
		if (!accumulator) {
			continue;
		}

		// Calculate derived values
		const totalQuantity = calculateTotalQuantity(accumulator.lots);
		const avgPurchasePrice = calculateAvgPurchasePrice(accumulator.lots);
		const oldestPurchaseDate = findOldestPurchaseDate(accumulator.lots);
		const newestPurchaseDate = findNewestPurchaseDate(accumulator.lots);

		// Classify based on oldest purchase date (req 3.1, 3.2, 3.3)
		const classification = classifyHolding(oldestPurchaseDate);

		holdings.push({
			symbol: accumulator.symbol,
			isin: accumulator.isin,
			exchange: accumulator.exchange,
			lots: accumulator.lots,
			totalQuantity,
			avgPurchasePrice,
			oldestPurchaseDate,
			newestPurchaseDate,
			classification
		});
	}

	// Sort holdings alphabetically by symbol for consistent output
	holdings.sort((a, b) => a.symbol.localeCompare(b.symbol));

	return {
		holdings,
		realizedGains: summarizeRealizedGains(allRealizedGains)
	};
}
