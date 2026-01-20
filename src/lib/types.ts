/**
 * Core type definitions for the India Tax Harvesting Tool
 * These types define the data structures used throughout the application
 * for managing trade records, holdings, and tax loss harvesting operations.
 */

/**
 * Classification for holdings based on holding period
 * SHORT_TERM: Held for less than 12 months (subject to STCG tax)
 * LONG_TERM: Held for 12 months or more (subject to LTCG tax)
 */
export type Classification = 'SHORT_TERM' | 'LONG_TERM';

/**
 * Trade type enum for buy/sell transactions
 */
export type TradeType = 'buy' | 'sell';

/**
 * Trade record parsed from Zerodha Tradebook CSV
 */
export interface TradeRecord {
	/** Unique trade identifier for deduplication */
	tradeId: string;
	/** Trading symbol (e.g., RELIANCE, TCS) */
	symbol: string;
	/** International Securities Identification Number */
	isin: string;
	/** Date when the trade was executed */
	tradeDate: Date;
	/** Exchange where trade was executed (NSE/BSE) */
	exchange: string;
	/** Type of trade - buy or sell */
	tradeType: TradeType;
	/** Number of shares traded */
	quantity: number;
	/** Price per share at which trade was executed */
	price: number;
}

/**
 * Metadata for an uploaded tradebook CSV file
 */
export interface UploadedFile {
	/** Unique identifier for the uploaded file */
	id: string;
	/** Original filename */
	name: string;
	/** Financial year range (e.g., "FY 2023-24") */
	fyRange: string;
	/** Total number of trades in the file */
	tradeCount: number;
	/** Date range of trades in the file */
	dateRange: {
		from: Date;
		to: Date;
	};
}

/**
 * Individual purchase lot for FIFO (First-In-First-Out) tracking
 */
export interface HoldingLot {
	/** Number of shares in this lot */
	quantity: number;
	/** Date when this lot was purchased */
	purchaseDate: Date;
	/** Price per share at purchase */
	purchasePrice: number;
}

/**
 * Aggregated holding calculated from trade records
 * Represents current position in a stock with all purchase lots
 */
export interface Holding {
	/** Trading symbol */
	symbol: string;
	/** International Securities Identification Number */
	isin: string;
	/** Primary exchange for the holding */
	exchange: string;
	/** Individual purchase lots maintained for FIFO calculations */
	lots: HoldingLot[];
	/** Total quantity across all lots */
	totalQuantity: number;
	/** Volume-weighted average purchase price */
	avgPurchasePrice: number;
	/** Date of the oldest purchase lot */
	oldestPurchaseDate: Date;
	/** Date of the newest purchase lot */
	newestPurchaseDate: Date;
	/** Tax classification based on holding period (legacy - based on oldest lot) */
	classification: Classification;
	/** Current market price (populated after Kite connection) */
	currentPrice?: number;
	/** Profit/Loss amount (populated after Kite connection) */
	pnl?: number;
	/** Profit/Loss percentage (populated after Kite connection) */
	pnlPercent?: number;
	/** Whether the position is currently at a loss */
	isLoss?: boolean;

	// Per-lot classification breakdown (calculated when prices are fetched)
	/** Quantity of shares in short-term lots (held <= 365 days) */
	stQuantity?: number;
	/** Quantity of shares in long-term lots (held > 365 days) */
	ltQuantity?: number;
	/** Average purchase price of short-term lots */
	stAvgPrice?: number;
	/** Average purchase price of long-term lots */
	ltAvgPrice?: number;
	/** P&L from short-term portion */
	stPnl?: number;
	/** P&L from long-term portion */
	ltPnl?: number;
}

/**
 * Sell order details for tax loss harvesting execution
 */
export interface SellOrder {
	/** Trading symbol */
	symbol: string;
	/** Exchange for order execution */
	exchange: string;
	/** Quantity to sell */
	quantity: number;
	/** Original purchase price from tradebook */
	purchasePrice: number;
	/** Original purchase date from tradebook */
	purchaseDate: Date;
	/** Current market price from Kite quotes */
	currentPrice: number;
	/** Expected loss amount for tax harvesting */
	expectedLoss: number;
}

/**
 * Status of an order execution
 */
export type OrderStatus = 'SUCCESS' | 'FAILED';

/**
 * Result of a sell order execution attempt
 */
export interface OrderResult {
	/** Trading symbol */
	symbol: string;
	/** Kite order ID if successful, null if failed */
	orderId: string | null;
	/** Whether the order was successful or failed */
	status: OrderStatus;
	/** Human-readable message about the order result */
	message: string;
}

/**
 * Status of a buyback record
 */
export type BuybackStatus = 'PENDING' | 'COMPLETED';

/**
 * Record for tracking buyback opportunities after selling
 * Used to remind users to repurchase stocks after the wash sale period
 */
export interface BuybackRecord {
	/** Unique identifier for the buyback record */
	id: string;
	/** Trading symbol */
	symbol: string;
	/** Exchange where the stock was sold */
	exchange: string;
	/** Quantity that was sold and may be repurchased */
	quantity: number;
	/** Date when the stock was sold */
	sellDate: Date;
	/** Price at which shares were sold */
	sellPrice?: number;
	/** Original purchase price of the sold shares */
	purchasePrice?: number;
	/** Original purchase date of the sold shares */
	purchaseDate?: Date;
	/** Expected loss amount from the harvest */
	expectedLoss?: number;
	/** Current status of the buyback */
	status: BuybackStatus;
	/** Date when buyback was completed (if applicable) */
	completedDate?: Date;
}

/**
 * Analysis step for the portfolio analysis progress UI
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
 * Individual realized gain/loss from a sell transaction
 */
export interface RealizedGainEntry {
	/** Trading symbol */
	symbol: string;
	/** Exchange (NSE/BSE) */
	exchange: string;
	/** Quantity sold */
	quantity: number;
	/** Date of the sell transaction */
	sellDate: Date;
	/** Price at which sold */
	sellPrice: number;
	/** Average purchase price of sold lots (FIFO) */
	purchasePrice: number;
	/** Purchase date of the oldest lot consumed */
	purchaseDate: Date;
	/** Realized profit/loss amount */
	gainLoss: number;
	/** Classification based on holding period */
	classification: Classification;
}

/**
 * Summary of realized gains/losses for the financial year
 */
export interface RealizedGainsSummary {
	/** Short-term capital gains (positive) */
	stcg: number;
	/** Short-term capital losses (negative, stored as positive for display) */
	stcl: number;
	/** Long-term capital gains (positive) */
	ltcg: number;
	/** Long-term capital losses (negative, stored as positive for display) */
	ltcl: number;
	/** Net short-term (STCG - STCL) */
	netShortTerm: number;
	/** Net long-term (LTCG - LTCL) */
	netLongTerm: number;
	/** Individual entries for detailed view */
	entries: RealizedGainEntry[];
}
