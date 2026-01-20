/**
 * Prices Store
 * Manages analysis state and orchestrates the portfolio analysis flow.
 * Handles price fetching from NSE via Edge Function proxy.
 *
 * This store coordinates the multi-step analysis process:
 * 1. Processing tradebook files
 * 2. Calculating holdings via FIFO
 * 3. Fetching current prices from NSE
 * 4. Identifying tax loss harvesting opportunities
 *
 * Requirements:
 * - 4.1: Show progress during analysis with step updates
 * - 4.2: Fetch prices from NSE API via Edge Function proxy
 * - 4.3: Handle price fetching errors gracefully
 * - 4.4: Update holdings with current prices and P&L
 */

import { writable, get } from 'svelte/store';
import { allTrades } from '$lib/stores/tradebook';
import { holdings, updateHoldingsFromTrades } from '$lib/stores/holdings';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';

/**
 * Analysis step type representing each stage of portfolio analysis
 * - idle: Initial state, no analysis in progress
 * - processing: Parsing and merging tradebook files
 * - trades_found: Tradebook parsing complete, displaying trade count
 * - calculating: Computing holdings using FIFO logic
 * - stocks_found: Holdings calculation complete, displaying stock count
 * - fetching_prices: Retrieving current prices from NSE
 * - checking_opportunities: Analyzing P&L to find harvesting opportunities
 * - complete: Analysis finished successfully
 * - error: An error occurred during analysis
 */
export type AnalysisStep =
	| 'idle'
	| 'processing'
	| 'trades_found'
	| 'calculating'
	| 'stocks_found'
	| 'fetching_prices'
	| 'checking_opportunities'
	| 'complete'
	| 'error';

/**
 * Analysis state containing current step and statistics
 */
export interface AnalysisState {
	/** Current step in the analysis process */
	step: AnalysisStep;
	/** Number of trades found across all tradebook files */
	tradesCount: number;
	/** Number of unique stocks/holdings identified */
	stocksCount: number;
	/** Error message if step is 'error' */
	error?: string;
}

/**
 * Quote data structure from NSE API
 */
export interface NseQuote {
	/** Last traded price */
	lastPrice: number;
	/** Price change from previous close */
	change: number;
	/** Percentage change from previous close */
	pChange: number;
}

/**
 * Response structure from nse-quotes Edge Function
 */
interface NseQuotesResponse {
	/** Successfully fetched quotes keyed by symbol */
	quotes: Record<string, NseQuote>;
	/** Symbols that failed to fetch */
	errors: string[];
}

/**
 * Store for the current analysis state
 * Tracks progress through the analysis pipeline
 */
export const analysisState = writable<AnalysisState>({
	step: 'idle',
	tradesCount: 0,
	stocksCount: 0
});

/**
 * Store indicating whether prices have been successfully loaded
 * Used to determine if P&L data is available for display
 */
export const pricesLoaded = writable<boolean>(false);

/**
 * Internal cache of fetched symbols for refreshing
 */
let lastFetchedSymbols: string[] = [];

/**
 * Updates the analysis state with a new step
 *
 * @param step - The new analysis step
 * @param updates - Optional partial state updates
 */
function setStep(step: AnalysisStep, updates?: Partial<AnalysisState>): void {
	analysisState.update((state) => ({
		...state,
		step,
		...updates
	}));
}

/**
 * Sets the analysis state to error with a message
 *
 * @param errorMessage - Human-readable error message
 */
function setError(errorMessage: string): void {
	analysisState.update((state) => ({
		...state,
		step: 'error',
		error: errorMessage
	}));
}

/**
 * Resets the analysis state to idle
 */
export function resetAnalysis(): void {
	analysisState.set({
		step: 'idle',
		tradesCount: 0,
		stocksCount: 0
	});
	pricesLoaded.set(false);
	lastFetchedSymbols = [];
}

/** Maximum symbols per request to the edge function */
const BATCH_SIZE = 10;

/**
 * Fetches quotes for a single batch of symbols
 */
async function fetchQuotesBatch(symbols: string[]): Promise<NseQuotesResponse> {
	const edgeFunctionUrl = `${PUBLIC_SUPABASE_URL}/functions/v1/nse-quotes`;

	const response = await fetch(edgeFunctionUrl, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ symbols })
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.message || `Failed to fetch quotes: ${response.status}`);
	}

	return response.json();
}

/**
 * Fetches current market quotes for the specified symbols from NSE
 * via the nse-quotes Edge Function proxy
 *
 * The Edge Function handles:
 * - NSE session/cookie management
 * - Rate limiting and retries
 * - CORS proxy for browser requests
 *
 * Batches requests in parallel chunks of 10 symbols each.
 *
 * Requirements:
 * - 4.2: Proxy NSE API via Edge Function to avoid CORS
 * - 4.3: Handle rate limiting and fetch errors
 *
 * @param symbols - Array of trading symbols to fetch quotes for
 * @returns Record of symbol to quote data
 * @throws Error if all quotes fail to fetch
 */
export async function fetchQuotes(symbols: string[]): Promise<Record<string, NseQuote>> {
	if (symbols.length === 0) {
		return {};
	}

	// Store symbols for potential refresh
	lastFetchedSymbols = [...symbols];

	// Split symbols into chunks of BATCH_SIZE
	const chunks: string[][] = [];
	for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
		chunks.push(symbols.slice(i, i + BATCH_SIZE));
	}

	console.log(`Fetching quotes for ${symbols.length} symbols in ${chunks.length} parallel batches`);

	// Fetch all chunks in parallel
	const batchResults = await Promise.all(
		chunks.map((chunk) => fetchQuotesBatch(chunk).catch((error) => {
			console.error('Batch fetch failed:', error);
			return { quotes: {}, errors: [error.message] } as NseQuotesResponse;
		}))
	);

	// Merge all results
	const mergedQuotes: Record<string, NseQuote> = {};
	const allErrors: string[] = [];

	for (const result of batchResults) {
		Object.assign(mergedQuotes, result.quotes || {});
		if (result.errors) {
			allErrors.push(...result.errors);
		}
	}

	// Log any errors for debugging but don't fail entirely
	if (allErrors.length > 0) {
		console.warn('Failed to fetch quotes for some symbols:', allErrors);
	}

	// Check if we got any quotes at all
	const quotesReceived = Object.keys(mergedQuotes).length;
	if (quotesReceived === 0 && symbols.length > 0) {
		throw new Error('Could not fetch prices for any symbols. Please try again.');
	}

	return mergedQuotes;
}

/**
 * Classifies lots into ST (<=365 days) and LT (>365 days) portions
 * and calculates separate P&L for each
 */
import { differenceInDays } from 'date-fns';
import type { HoldingLot } from '$lib/types';

interface LotClassification {
	stQuantity: number;
	ltQuantity: number;
	stAvgPrice: number;
	ltAvgPrice: number;
	stPnl: number;
	ltPnl: number;
}

function classifyLotsByHoldingPeriod(lots: HoldingLot[], currentPrice: number): LotClassification {
	const now = new Date();
	let stQuantity = 0;
	let ltQuantity = 0;
	let stTotalCost = 0;
	let ltTotalCost = 0;

	for (const lot of lots) {
		const holdingDays = differenceInDays(now, lot.purchaseDate);
		const lotCost = lot.quantity * lot.purchasePrice;

		if (holdingDays <= 365) {
			// Short-term: held for 365 days or less
			stQuantity += lot.quantity;
			stTotalCost += lotCost;
		} else {
			// Long-term: held for more than 365 days
			ltQuantity += lot.quantity;
			ltTotalCost += lotCost;
		}
	}

	const stAvgPrice = stQuantity > 0 ? stTotalCost / stQuantity : 0;
	const ltAvgPrice = ltQuantity > 0 ? ltTotalCost / ltQuantity : 0;

	const stCurrentValue = stQuantity * currentPrice;
	const ltCurrentValue = ltQuantity * currentPrice;

	const stPnl = stCurrentValue - stTotalCost;
	const ltPnl = ltCurrentValue - ltTotalCost;

	return {
		stQuantity,
		ltQuantity,
		stAvgPrice,
		ltAvgPrice,
		stPnl,
		ltPnl
	};
}

/**
 * Updates holdings with price data and calculates P&L
 * Also calculates per-lot ST/LT breakdown for accurate opportunity display
 *
 * @param quotes - Record of symbol to quote data
 */
function updateHoldingsWithPrices(quotes: Record<string, NseQuote>): void {
	holdings.update((currentHoldings) =>
		currentHoldings.map((holding) => {
			const quote = quotes[holding.symbol];

			if (!quote) {
				// No quote available for this symbol - keep existing data
				return holding;
			}

			const currentPrice = quote.lastPrice;
			const totalCost = holding.avgPurchasePrice * holding.totalQuantity;
			const currentValue = currentPrice * holding.totalQuantity;
			const pnl = currentValue - totalCost;
			const pnlPercent = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
			const isLoss = pnl < 0;

			// Calculate ST/LT breakdown for accurate opportunity classification
			const lotClassification = classifyLotsByHoldingPeriod(holding.lots, currentPrice);

			return {
				...holding,
				currentPrice,
				pnl,
				pnlPercent,
				isLoss,
				// Per-lot classification
				stQuantity: lotClassification.stQuantity,
				ltQuantity: lotClassification.ltQuantity,
				stAvgPrice: lotClassification.stAvgPrice,
				ltAvgPrice: lotClassification.ltAvgPrice,
				stPnl: lotClassification.stPnl,
				ltPnl: lotClassification.ltPnl
			};
		})
	);
}

/**
 * Orchestrates the full portfolio analysis flow with step updates
 *
 * Analysis Pipeline:
 * 1. processing - Parse and validate tradebook data
 * 2. trades_found - Report trade count
 * 3. calculating - Compute holdings using FIFO
 * 4. stocks_found - Report holdings count
 * 5. fetching_prices - Get current prices from NSE
 * 6. checking_opportunities - Calculate P&L and identify losses
 * 7. complete - Analysis finished
 *
 * Requirements:
 * - 4.1: Show progress during portfolio analysis
 * - 4.4: Display current prices, P&L, and loss opportunities
 *
 * @throws Error if analysis fails at any step
 */
export async function analyzePortfolio(): Promise<void> {
	try {
		// Step 1: Processing tradebook files
		setStep('processing');

		// Small delay to allow UI to update
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Get all parsed trades from the tradebook store
		const trades = get(allTrades);

		if (trades.length === 0) {
			setError('No trades found. Please upload valid tradebook CSV files.');
			return;
		}

		// Step 2: Trades found
		setStep('trades_found', { tradesCount: trades.length });
		await new Promise((resolve) => setTimeout(resolve, 500));

		// Step 3: Calculating holdings via FIFO
		setStep('calculating');
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Calculate holdings from trades
		updateHoldingsFromTrades(trades);

		// Get calculated holdings
		const currentHoldings = get(holdings);

		if (currentHoldings.length === 0) {
			setError('No current holdings found. All positions may have been closed.');
			return;
		}

		// Step 4: Stocks found
		setStep('stocks_found', { stocksCount: currentHoldings.length });
		await new Promise((resolve) => setTimeout(resolve, 500));

		// Step 5: Fetching prices from NSE
		setStep('fetching_prices');

		// Extract unique symbols for price fetching
		const symbols = currentHoldings.map((h) => h.symbol);

		try {
			const quotes = await fetchQuotes(symbols);

			// Step 6: Checking opportunities
			setStep('checking_opportunities');
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Update holdings with price data
			updateHoldingsWithPrices(quotes);

			// Mark prices as loaded
			pricesLoaded.set(true);

			// Step 7: Complete
			setStep('complete');
		} catch (priceError) {
			// Price fetching failed - still show holdings but with error
			const errorMessage =
				priceError instanceof Error ? priceError.message : 'Failed to fetch prices';

			// Log the error but don't fail completely if we have some data
			console.error('Price fetch error:', errorMessage);

			// Check if we should still proceed (partial success scenario)
			// For now, treat price fetch failure as a hard error
			setError(`Price fetch failed: ${errorMessage}`);
		}
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : 'An unexpected error occurred during analysis';
		setError(errorMessage);
	}
}

/**
 * Re-fetches current prices for all holdings
 * Uses the last set of symbols that were fetched
 *
 * This is useful for:
 * - Refreshing stale price data
 * - Retrying after a partial fetch failure
 *
 * Requirements:
 * - 4.4: Allow refreshing of current prices
 *
 * @throws Error if price fetching fails
 */
export async function refreshPrices(): Promise<void> {
	const currentHoldings = get(holdings);

	if (currentHoldings.length === 0) {
		return;
	}

	// Get symbols from current holdings (in case holdings were updated)
	const symbols = currentHoldings.map((h) => h.symbol);

	// Update analysis state to show fetching
	const previousState = get(analysisState);
	setStep('fetching_prices');

	try {
		const quotes = await fetchQuotes(symbols);

		setStep('checking_opportunities');
		await new Promise((resolve) => setTimeout(resolve, 100));

		updateHoldingsWithPrices(quotes);
		pricesLoaded.set(true);

		// Restore to complete state
		setStep('complete');
	} catch (error) {
		// Restore previous state on error
		analysisState.set(previousState);

		const errorMessage = error instanceof Error ? error.message : 'Failed to refresh prices';
		throw new Error(errorMessage);
	}
}

/**
 * Clears price data from all holdings
 * Resets currentPrice, pnl, pnlPercent, and isLoss fields
 */
export function clearPrices(): void {
	holdings.update((currentHoldings) =>
		currentHoldings.map((holding) => ({
			...holding,
			currentPrice: undefined,
			pnl: undefined,
			pnlPercent: undefined,
			isLoss: undefined
		}))
	);
	pricesLoaded.set(false);
}
