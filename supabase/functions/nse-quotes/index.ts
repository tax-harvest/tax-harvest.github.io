/**
 * Stock Quotes Edge Function (via Yahoo Finance)
 *
 * Fetches current stock prices for Indian stocks from Yahoo Finance.
 * Uses .NS suffix for NSE stocks and .BO for BSE stocks.
 *
 * @endpoint POST /functions/v1/nse-quotes
 * @body { symbols: string[] }
 * @returns { quotes: Record<string, QuoteData>, errors: string[] }
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

// Types for the response
interface QuoteData {
  lastPrice: number;
  change: number;
  pChange: number;
}

interface QuotesResponse {
  quotes: Record<string, QuoteData>;
  errors: string[];
}

// Retry configuration
const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY_MS = 500;
const DELAY_BETWEEN_REQUESTS_MS = 100;

// CORS headers for the response
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * Sleep utility for delays between requests
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch quote from Yahoo Finance
 * Yahoo uses .NS suffix for NSE stocks and .BO for BSE
 */
async function fetchFromYahoo(symbol: string, retryCount = 0): Promise<QuoteData> {
  // Try NSE first (.NS suffix), then BSE (.BO suffix)
  const suffixes = [".NS", ".BO"];

  for (const suffix of suffixes) {
    const yahooSymbol = `${symbol.toUpperCase()}${suffix}`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        continue; // Try next suffix
      }

      const data = await response.json();
      const result = data?.chart?.result?.[0];

      if (!result?.meta?.regularMarketPrice) {
        continue; // Try next suffix
      }

      const meta = result.meta;
      const lastPrice = meta.regularMarketPrice;
      const previousClose = meta.previousClose || meta.chartPreviousClose || lastPrice;
      const change = lastPrice - previousClose;
      const pChange = previousClose !== 0 ? (change / previousClose) * 100 : 0;

      return {
        lastPrice,
        change,
        pChange,
      };
    } catch (e) {
      console.log(`Yahoo fetch failed for ${yahooSymbol}:`, e);
      continue;
    }
  }

  // Retry logic if both suffixes failed
  if (retryCount < MAX_RETRIES) {
    const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount);
    console.log(`All suffixes failed for ${symbol}, retrying in ${delay}ms`);
    await sleep(delay);
    return fetchFromYahoo(symbol, retryCount + 1);
  }

  throw new Error(`No data found for ${symbol}`);
}

/**
 * Main handler for the Edge Function
 */
serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  try {
    // Parse request body
    const body = await req.json();
    const symbols: string[] = body.symbols;

    // Validate input
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Invalid request: symbols array is required",
        }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Limit number of symbols per request
    const MAX_SYMBOLS = 10;
    if (symbols.length > MAX_SYMBOLS) {
      return new Response(
        JSON.stringify({
          error: `Too many symbols. Maximum ${MAX_SYMBOLS} symbols per request.`,
        }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Fetching quotes for ${symbols.length} symbols`);

    // Fetch quotes for each symbol
    const result: QuotesResponse = {
      quotes: {},
      errors: [],
    };

    for (let i = 0; i < symbols.length; i++) {
      const symbol = symbols[i].trim().toUpperCase();

      if (!symbol) {
        continue;
      }

      try {
        const quote = await fetchFromYahoo(symbol);
        result.quotes[symbol] = quote;
        console.log(`Got quote for ${symbol}: ${quote.lastPrice}`);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(`Failed for ${symbol}:`, errorMessage);
        result.errors.push(`${symbol}: ${errorMessage}`);
      }

      // Add delay between requests
      if (i < symbols.length - 1) {
        await sleep(DELAY_BETWEEN_REQUESTS_MS);
      }
    }

    console.log(
      `Done: ${Object.keys(result.quotes).length} quotes, ${result.errors.length} errors`
    );

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return new Response(
      JSON.stringify({
        error: errorMessage,
        quotes: {},
        errors: [],
      }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
});
