/**
 * Unit tests for Holdings Calculator
 * Tests FIFO (First-In-First-Out) logic and ST/LT classification
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateHoldings, classifyHolding } from './holdings-calculator';
import type { TradeRecord } from '$lib/types';

/**
 * Helper function to create a TradeRecord for testing
 */
function createTrade(
	overrides: Partial<TradeRecord> & Pick<TradeRecord, 'symbol' | 'tradeDate' | 'tradeType' | 'quantity' | 'price'>
): TradeRecord {
	return {
		tradeId: `trade-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
		isin: 'INE000000000',
		exchange: 'NSE',
		...overrides
	};
}

/**
 * Helper function to create a Date from days ago relative to reference date
 */
function daysAgo(days: number, referenceDate: Date = new Date()): Date {
	const date = new Date(referenceDate);
	date.setDate(date.getDate() - days);
	return date;
}

describe('calculateHoldings', () => {
	describe('FIFO Logic', () => {
		it('should return holding with correct date for single buy', () => {
			const buyDate = new Date('2024-01-15');
			const trades: TradeRecord[] = [
				createTrade({
					symbol: 'INFY',
					tradeDate: buyDate,
					tradeType: 'buy',
					quantity: 100,
					price: 1500
				})
			];

			const holdings = calculateHoldings(trades);

			expect(holdings).toHaveLength(1);
			expect(holdings[0].symbol).toBe('INFY');
			expect(holdings[0].totalQuantity).toBe(100);
			expect(holdings[0].avgPurchasePrice).toBe(1500);
			expect(holdings[0].oldestPurchaseDate.getTime()).toBe(buyDate.getTime());
			expect(holdings[0].newestPurchaseDate.getTime()).toBe(buyDate.getTime());
			expect(holdings[0].lots).toHaveLength(1);
			expect(holdings[0].lots[0].purchaseDate.getTime()).toBe(buyDate.getTime());
		});

		it('should consume oldest lots first on partial sell (FIFO)', () => {
			const firstBuyDate = new Date('2024-01-10');
			const secondBuyDate = new Date('2024-02-15');
			const sellDate = new Date('2024-03-01');

			const trades: TradeRecord[] = [
				createTrade({
					tradeId: 'buy1',
					symbol: 'RELIANCE',
					tradeDate: firstBuyDate,
					tradeType: 'buy',
					quantity: 50,
					price: 2400
				}),
				createTrade({
					tradeId: 'buy2',
					symbol: 'RELIANCE',
					tradeDate: secondBuyDate,
					tradeType: 'buy',
					quantity: 50,
					price: 2600
				}),
				createTrade({
					tradeId: 'sell1',
					symbol: 'RELIANCE',
					tradeDate: sellDate,
					tradeType: 'sell',
					quantity: 30,
					price: 2700
				})
			];

			const holdings = calculateHoldings(trades);

			expect(holdings).toHaveLength(1);
			expect(holdings[0].symbol).toBe('RELIANCE');
			expect(holdings[0].totalQuantity).toBe(70); // 100 bought - 30 sold

			// FIFO: First lot should be partially consumed (50 - 30 = 20)
			expect(holdings[0].lots).toHaveLength(2);
			expect(holdings[0].lots[0].quantity).toBe(20);
			expect(holdings[0].lots[0].purchasePrice).toBe(2400);
			expect(holdings[0].lots[0].purchaseDate.getTime()).toBe(firstBuyDate.getTime());

			// Second lot should remain intact
			expect(holdings[0].lots[1].quantity).toBe(50);
			expect(holdings[0].lots[1].purchasePrice).toBe(2600);
			expect(holdings[0].lots[1].purchaseDate.getTime()).toBe(secondBuyDate.getTime());

			// Oldest date should still be from first lot
			expect(holdings[0].oldestPurchaseDate.getTime()).toBe(firstBuyDate.getTime());
		});

		it('should consume entire first lot and part of second lot when selling more than first lot', () => {
			const firstBuyDate = new Date('2024-01-10');
			const secondBuyDate = new Date('2024-02-15');
			const sellDate = new Date('2024-03-01');

			const trades: TradeRecord[] = [
				createTrade({
					tradeId: 'buy1',
					symbol: 'TCS',
					tradeDate: firstBuyDate,
					tradeType: 'buy',
					quantity: 30,
					price: 3500
				}),
				createTrade({
					tradeId: 'buy2',
					symbol: 'TCS',
					tradeDate: secondBuyDate,
					tradeType: 'buy',
					quantity: 40,
					price: 3600
				}),
				createTrade({
					tradeId: 'sell1',
					symbol: 'TCS',
					tradeDate: sellDate,
					tradeType: 'sell',
					quantity: 50,
					price: 3700
				})
			];

			const holdings = calculateHoldings(trades);

			expect(holdings).toHaveLength(1);
			expect(holdings[0].totalQuantity).toBe(20); // 70 - 50 = 20

			// First lot fully consumed, second lot partially consumed
			expect(holdings[0].lots).toHaveLength(1);
			expect(holdings[0].lots[0].quantity).toBe(20);
			expect(holdings[0].lots[0].purchasePrice).toBe(3600);
			expect(holdings[0].lots[0].purchaseDate.getTime()).toBe(secondBuyDate.getTime());

			// Oldest date should now be from second lot (first lot fully consumed)
			expect(holdings[0].oldestPurchaseDate.getTime()).toBe(secondBuyDate.getTime());
		});

		it('should exclude holdings with zero quantity (full sell)', () => {
			const buyDate = new Date('2024-01-15');
			const sellDate = new Date('2024-02-20');

			const trades: TradeRecord[] = [
				createTrade({
					tradeId: 'buy1',
					symbol: 'HDFC',
					tradeDate: buyDate,
					tradeType: 'buy',
					quantity: 100,
					price: 1600
				}),
				createTrade({
					tradeId: 'sell1',
					symbol: 'HDFC',
					tradeDate: sellDate,
					tradeType: 'sell',
					quantity: 100,
					price: 1700
				})
			];

			const holdings = calculateHoldings(trades);

			expect(holdings).toHaveLength(0);
		});

		it('should handle multiple sells across multiple lots', () => {
			const trades: TradeRecord[] = [
				createTrade({
					tradeId: 'buy1',
					symbol: 'WIPRO',
					tradeDate: new Date('2024-01-01'),
					tradeType: 'buy',
					quantity: 100,
					price: 400
				}),
				createTrade({
					tradeId: 'buy2',
					symbol: 'WIPRO',
					tradeDate: new Date('2024-02-01'),
					tradeType: 'buy',
					quantity: 100,
					price: 420
				}),
				createTrade({
					tradeId: 'buy3',
					symbol: 'WIPRO',
					tradeDate: new Date('2024-03-01'),
					tradeType: 'buy',
					quantity: 100,
					price: 440
				}),
				createTrade({
					tradeId: 'sell1',
					symbol: 'WIPRO',
					tradeDate: new Date('2024-04-01'),
					tradeType: 'sell',
					quantity: 150,
					price: 450
				}),
				createTrade({
					tradeId: 'sell2',
					symbol: 'WIPRO',
					tradeDate: new Date('2024-05-01'),
					tradeType: 'sell',
					quantity: 100,
					price: 460
				})
			];

			const holdings = calculateHoldings(trades);

			expect(holdings).toHaveLength(1);
			expect(holdings[0].totalQuantity).toBe(50); // 300 - 150 - 100 = 50

			// Only third lot should remain, partially consumed
			expect(holdings[0].lots).toHaveLength(1);
			expect(holdings[0].lots[0].quantity).toBe(50);
			expect(holdings[0].lots[0].purchasePrice).toBe(440);
		});
	});

	describe('Classification Logic', () => {
		let mockDate: Date;

		beforeEach(() => {
			// Mock the current date for consistent testing
			mockDate = new Date('2025-01-20');
			vi.useFakeTimers();
			vi.setSystemTime(mockDate);
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('should classify holding as SHORT_TERM when held for exactly 365 days', () => {
			// 365 days before Jan 20, 2025
			// Note: 2024 is a leap year, so we need to account for Feb 29
			// Jan 21, 2024 to Jan 20, 2025 = 365 days (includes leap day)
			const purchaseDate = new Date('2024-01-21');

			const classification = classifyHolding(purchaseDate);

			expect(classification).toBe('SHORT_TERM');
		});

		it('should classify holding as LONG_TERM when held for 366 days', () => {
			// 366 days before Jan 20, 2025 = Jan 20, 2024
			// (includes the leap day Feb 29, 2024)
			const purchaseDate = new Date('2024-01-20');

			const classification = classifyHolding(purchaseDate);

			expect(classification).toBe('LONG_TERM');
		});

		it('should classify holding as SHORT_TERM when held for less than 365 days', () => {
			// 100 days before Jan 20, 2025
			const purchaseDate = new Date('2024-10-12');

			const classification = classifyHolding(purchaseDate);

			expect(classification).toBe('SHORT_TERM');
		});

		it('should classify holding as LONG_TERM when held for more than 366 days', () => {
			// ~2 years before Jan 20, 2025
			const purchaseDate = new Date('2023-01-20');

			const classification = classifyHolding(purchaseDate);

			expect(classification).toBe('LONG_TERM');
		});

		it('should classify holdings correctly through calculateHoldings function', () => {
			const shortTermDate = new Date('2024-10-01'); // ~111 days ago
			const longTermDate = new Date('2023-06-01'); // ~599 days ago

			const trades: TradeRecord[] = [
				createTrade({
					tradeId: 'buy1',
					symbol: 'INFY',
					tradeDate: shortTermDate,
					tradeType: 'buy',
					quantity: 50,
					price: 1500
				}),
				createTrade({
					tradeId: 'buy2',
					symbol: 'TCS',
					tradeDate: longTermDate,
					tradeType: 'buy',
					quantity: 50,
					price: 3500
				})
			];

			const holdings = calculateHoldings(trades);

			expect(holdings).toHaveLength(2);

			const infyHolding = holdings.find(h => h.symbol === 'INFY');
			const tcsHolding = holdings.find(h => h.symbol === 'TCS');

			expect(infyHolding?.classification).toBe('SHORT_TERM');
			expect(tcsHolding?.classification).toBe('LONG_TERM');
		});

		it('should classify based on oldest lot when multiple lots exist', () => {
			// Oldest lot is long-term, newest is short-term
			// Classification should be based on oldest (LONG_TERM)
			const oldLotDate = new Date('2023-06-01'); // Long-term
			const newLotDate = new Date('2024-12-01'); // Short-term

			const trades: TradeRecord[] = [
				createTrade({
					tradeId: 'buy1',
					symbol: 'RELIANCE',
					tradeDate: oldLotDate,
					tradeType: 'buy',
					quantity: 30,
					price: 2400
				}),
				createTrade({
					tradeId: 'buy2',
					symbol: 'RELIANCE',
					tradeDate: newLotDate,
					tradeType: 'buy',
					quantity: 20,
					price: 2600
				})
			];

			const holdings = calculateHoldings(trades);

			expect(holdings).toHaveLength(1);
			expect(holdings[0].classification).toBe('LONG_TERM');
			expect(holdings[0].oldestPurchaseDate.getTime()).toBe(oldLotDate.getTime());
		});
	});

	describe('Exchange Separation (NSE vs BSE)', () => {
		it('should treat NSE and BSE trades for same stock as separate holdings', () => {
			const buyDate = new Date('2024-06-15');

			const trades: TradeRecord[] = [
				createTrade({
					tradeId: 'buy-nse',
					symbol: 'RELIANCE',
					exchange: 'NSE',
					tradeDate: buyDate,
					tradeType: 'buy',
					quantity: 100,
					price: 2500
				}),
				createTrade({
					tradeId: 'buy-bse',
					symbol: 'RELIANCE',
					exchange: 'BSE',
					tradeDate: buyDate,
					tradeType: 'buy',
					quantity: 50,
					price: 2510
				})
			];

			const holdings = calculateHoldings(trades);

			expect(holdings).toHaveLength(2);

			const nseHolding = holdings.find(h => h.exchange === 'NSE');
			const bseHolding = holdings.find(h => h.exchange === 'BSE');

			expect(nseHolding).toBeDefined();
			expect(nseHolding?.symbol).toBe('RELIANCE');
			expect(nseHolding?.totalQuantity).toBe(100);
			expect(nseHolding?.avgPurchasePrice).toBe(2500);

			expect(bseHolding).toBeDefined();
			expect(bseHolding?.symbol).toBe('RELIANCE');
			expect(bseHolding?.totalQuantity).toBe(50);
			expect(bseHolding?.avgPurchasePrice).toBe(2510);
		});

		it('should apply FIFO independently for NSE and BSE holdings', () => {
			const trades: TradeRecord[] = [
				// NSE buys
				createTrade({
					tradeId: 'nse-buy1',
					symbol: 'INFY',
					exchange: 'NSE',
					tradeDate: new Date('2024-01-01'),
					tradeType: 'buy',
					quantity: 100,
					price: 1400
				}),
				createTrade({
					tradeId: 'nse-buy2',
					symbol: 'INFY',
					exchange: 'NSE',
					tradeDate: new Date('2024-02-01'),
					tradeType: 'buy',
					quantity: 50,
					price: 1500
				}),
				// BSE buy
				createTrade({
					tradeId: 'bse-buy1',
					symbol: 'INFY',
					exchange: 'BSE',
					tradeDate: new Date('2024-01-15'),
					tradeType: 'buy',
					quantity: 80,
					price: 1450
				}),
				// NSE sell - should only affect NSE holdings
				createTrade({
					tradeId: 'nse-sell1',
					symbol: 'INFY',
					exchange: 'NSE',
					tradeDate: new Date('2024-03-01'),
					tradeType: 'sell',
					quantity: 120,
					price: 1600
				})
			];

			const holdings = calculateHoldings(trades);

			expect(holdings).toHaveLength(2);

			const nseHolding = holdings.find(h => h.exchange === 'NSE');
			const bseHolding = holdings.find(h => h.exchange === 'BSE');

			// NSE: 150 bought - 120 sold = 30 remaining (from second lot)
			expect(nseHolding?.totalQuantity).toBe(30);
			expect(nseHolding?.lots).toHaveLength(1);
			expect(nseHolding?.lots[0].quantity).toBe(30);
			expect(nseHolding?.lots[0].purchasePrice).toBe(1500);

			// BSE: 80 bought, no sells = 80 remaining
			expect(bseHolding?.totalQuantity).toBe(80);
			expect(bseHolding?.lots).toHaveLength(1);
			expect(bseHolding?.lots[0].quantity).toBe(80);
		});

		it('should handle full sell on one exchange while keeping holdings on another', () => {
			const trades: TradeRecord[] = [
				createTrade({
					tradeId: 'nse-buy',
					symbol: 'TCS',
					exchange: 'NSE',
					tradeDate: new Date('2024-01-01'),
					tradeType: 'buy',
					quantity: 50,
					price: 3500
				}),
				createTrade({
					tradeId: 'bse-buy',
					symbol: 'TCS',
					exchange: 'BSE',
					tradeDate: new Date('2024-01-01'),
					tradeType: 'buy',
					quantity: 50,
					price: 3510
				}),
				// Sell all NSE holdings
				createTrade({
					tradeId: 'nse-sell',
					symbol: 'TCS',
					exchange: 'NSE',
					tradeDate: new Date('2024-02-01'),
					tradeType: 'sell',
					quantity: 50,
					price: 3600
				})
			];

			const holdings = calculateHoldings(trades);

			// Only BSE holding should remain
			expect(holdings).toHaveLength(1);
			expect(holdings[0].exchange).toBe('BSE');
			expect(holdings[0].totalQuantity).toBe(50);
		});
	});

	describe('Edge Cases', () => {
		it('should return empty array for empty trades input', () => {
			const holdings = calculateHoldings([]);

			expect(holdings).toEqual([]);
		});

		it('should return empty array for null/undefined input', () => {
			// @ts-expect-error Testing invalid input
			const holdings1 = calculateHoldings(null);
			// @ts-expect-error Testing invalid input
			const holdings2 = calculateHoldings(undefined);

			expect(holdings1).toEqual([]);
			expect(holdings2).toEqual([]);
		});

		it('should handle trades arriving out of chronological order', () => {
			const firstBuyDate = new Date('2024-01-01');
			const secondBuyDate = new Date('2024-03-01');
			const sellDate = new Date('2024-02-01'); // Between buys

			// Trades given in random order
			const trades: TradeRecord[] = [
				createTrade({
					tradeId: 'buy2',
					symbol: 'HDFC',
					tradeDate: secondBuyDate,
					tradeType: 'buy',
					quantity: 50,
					price: 1700
				}),
				createTrade({
					tradeId: 'sell1',
					symbol: 'HDFC',
					tradeDate: sellDate,
					tradeType: 'sell',
					quantity: 30,
					price: 1650
				}),
				createTrade({
					tradeId: 'buy1',
					symbol: 'HDFC',
					tradeDate: firstBuyDate,
					tradeType: 'buy',
					quantity: 100,
					price: 1600
				})
			];

			const holdings = calculateHoldings(trades);

			expect(holdings).toHaveLength(1);
			// First buy (100), then sell (30), then second buy (50) = 120
			expect(holdings[0].totalQuantity).toBe(120);

			// After sell, first lot should have 70 remaining
			const firstLot = holdings[0].lots.find(l => l.purchasePrice === 1600);
			const secondLot = holdings[0].lots.find(l => l.purchasePrice === 1700);

			expect(firstLot?.quantity).toBe(70);
			expect(secondLot?.quantity).toBe(50);
		});

		it('should calculate correct weighted average price with multiple lots', () => {
			const trades: TradeRecord[] = [
				createTrade({
					tradeId: 'buy1',
					symbol: 'INFY',
					tradeDate: new Date('2024-01-01'),
					tradeType: 'buy',
					quantity: 100,
					price: 1000
				}),
				createTrade({
					tradeId: 'buy2',
					symbol: 'INFY',
					tradeDate: new Date('2024-02-01'),
					tradeType: 'buy',
					quantity: 200,
					price: 1500
				})
			];

			const holdings = calculateHoldings(trades);

			// Weighted average: (100 * 1000 + 200 * 1500) / 300 = 400000 / 300 = 1333.33...
			expect(holdings[0].avgPurchasePrice).toBeCloseTo(1333.33, 2);
		});

		it('should sort holdings alphabetically by symbol', () => {
			const trades: TradeRecord[] = [
				createTrade({
					tradeId: 'buy-wipro',
					symbol: 'WIPRO',
					tradeDate: new Date('2024-01-01'),
					tradeType: 'buy',
					quantity: 50,
					price: 400
				}),
				createTrade({
					tradeId: 'buy-infy',
					symbol: 'INFY',
					tradeDate: new Date('2024-01-01'),
					tradeType: 'buy',
					quantity: 50,
					price: 1500
				}),
				createTrade({
					tradeId: 'buy-tcs',
					symbol: 'TCS',
					tradeDate: new Date('2024-01-01'),
					tradeType: 'buy',
					quantity: 50,
					price: 3500
				})
			];

			const holdings = calculateHoldings(trades);

			expect(holdings.map(h => h.symbol)).toEqual(['INFY', 'TCS', 'WIPRO']);
		});

		it('should preserve ISIN from trade records', () => {
			const trades: TradeRecord[] = [
				createTrade({
					tradeId: 'buy1',
					symbol: 'INFY',
					isin: 'INE009A01021',
					tradeDate: new Date('2024-01-01'),
					tradeType: 'buy',
					quantity: 100,
					price: 1500
				})
			];

			const holdings = calculateHoldings(trades);

			expect(holdings[0].isin).toBe('INE009A01021');
		});
	});
});

describe('classifyHolding', () => {
	let mockDate: Date;

	beforeEach(() => {
		mockDate = new Date('2025-01-20');
		vi.useFakeTimers();
		vi.setSystemTime(mockDate);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('should return SHORT_TERM for holding purchased today', () => {
		const purchaseDate = new Date('2025-01-20');
		expect(classifyHolding(purchaseDate)).toBe('SHORT_TERM');
	});

	it('should return SHORT_TERM for holding at exactly 365 days boundary', () => {
		// 365 days before Jan 20, 2025 = Jan 21, 2024 (accounting for leap year)
		const purchaseDate = new Date('2024-01-21');
		expect(classifyHolding(purchaseDate)).toBe('SHORT_TERM');
	});

	it('should return LONG_TERM for holding at 366 days', () => {
		// 366 days before Jan 20, 2025 = Jan 20, 2024 (includes leap day Feb 29)
		const purchaseDate = new Date('2024-01-20');
		expect(classifyHolding(purchaseDate)).toBe('LONG_TERM');
	});

	it('should return LONG_TERM for holding purchased multiple years ago', () => {
		const purchaseDate = new Date('2020-01-01');
		expect(classifyHolding(purchaseDate)).toBe('LONG_TERM');
	});
});
