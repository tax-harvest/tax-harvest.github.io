<!--
  Main Dashboard Page

  Implements the primary user flow for tax loss harvesting:
  1. Upload state: Show FileUpload for tradebook CSV uploads
  2. Analyzing state: Show AnalysisProgress with step indicators
  3. Results state: Show RealizedGains, Holdings, Opportunities
  4. Error state: Show error message with retry option
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { SellOrder } from '$lib/types';

	// Components
	import FileUpload from '$lib/components/FileUpload.svelte';
	import AnalysisProgress from '$lib/components/AnalysisProgress.svelte';
	import RealizedGainsCard from '$lib/components/RealizedGainsCard.svelte';
	import OpportunityCard from '$lib/components/OpportunityCard.svelte';
	import SellConfirmModal from '$lib/components/SellConfirmModal.svelte';
	import ExecutionConfirmModal from '$lib/components/ExecutionConfirmModal.svelte';
	import BuybackReminder from '$lib/components/BuybackReminder.svelte';
	import RecoveryLinkCard from '$lib/components/RecoveryLinkCard.svelte';

	// Stores
	import {
		uploadedFiles,
		addTradebooks,
		removeTradebook,
		clearAllTradebooks
	} from '$lib/stores/tradebook';
	import {
		holdings,
		realizedGains,
		stclOpportunities,
		ltclOpportunities,
		clearHoldings
	} from '$lib/stores/holdings';
	import {
		analysisState,
		analyzePortfolio,
		resetAnalysis
	} from '$lib/stores/prices';
	import {
		pendingBuybacks,
		loadBuybacks,
		markComplete,
		createBuybackRecordsWithRecovery,
		recoveryToken
	} from '$lib/stores/buybacks';

	// Utilities
	import { exportHoldingsToCSV } from '$lib/utils/export';

	// Environment variable for Kite API key
	import { env } from '$env/dynamic/public';

	// Get Kite API key from environment
	const kiteApiKey = env.PUBLIC_KITE_API_KEY ?? '';

	// Page state
	type PageState = 'upload' | 'analyzing' | 'results' | 'error';

	// Derive page state from analysis state
	let pageState = $derived.by((): PageState => {
		const step = $analysisState.step;

		if (step === 'idle') {
			return 'upload';
		}

		if (step === 'error') {
			return 'error';
		}

		if (step === 'complete') {
			return 'results';
		}

		return 'analyzing';
	});

	// Selection state for STCL and LTCL opportunities
	let stclSelected = $state<Set<string>>(new Set());
	let ltclSelected = $state<Set<string>>(new Set());

	// Modal state
	let showSellConfirmModal = $state(false);
	let showExecutionConfirmModal = $state(false);

	// Pending orders for modals
	let pendingOrders = $state<SellOrder[]>([]);

	// Recovery link state
	let showRecoveryLink = $state(false);
	let generatingRecoveryToken = $state(false);

	// Guard against double submission
	let isCreatingBuybacks = $state(false);

	// Check if any opportunities are selected
	let hasSelections = $derived(stclSelected.size > 0 || ltclSelected.size > 0);

	// Calculate total selected loss (using per-lot ST/LT P&L values)
	let totalSelectedLoss = $derived.by(() => {
		let total = 0;

		for (const opp of $stclOpportunities) {
			if (stclSelected.has(opp.symbol)) {
				// Use ST P&L for STCL opportunities
				total += Math.abs(opp.stPnl ?? 0);
			}
		}

		for (const opp of $ltclOpportunities) {
			if (ltclSelected.has(opp.symbol)) {
				// Use LT P&L for LTCL opportunities
				total += Math.abs(opp.ltPnl ?? 0);
			}
		}

		return total;
	});

	// Format currency in Indian Rupees
	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-IN', {
			style: 'currency',
			currency: 'INR',
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(amount);
	}

	// Load buybacks on mount
	onMount(async () => {
		try {
			await loadBuybacks();
		} catch (error) {
			console.warn('Could not load buybacks:', error);
		}
	});

	async function handleUpload(files: FileList) {
		if (files && files.length > 0) {
			await addTradebooks(files);
		}
	}

	function handleRemove(fileId: string) {
		removeTradebook(fileId);
	}

	async function handleAnalyze() {
		stclSelected = new Set();
		ltclSelected = new Set();
		await analyzePortfolio();
	}

	async function handleRetry() {
		resetAnalysis();
		await analyzePortfolio();
	}

	function handleReset() {
		clearAllTradebooks();
		clearHoldings();
		resetAnalysis();
		stclSelected = new Set();
		ltclSelected = new Set();
		showRecoveryLink = false;
	}

	function handleStclSelectionChange(selected: Set<string>) {
		stclSelected = selected;
	}

	function handleLtclSelectionChange(selected: Set<string>) {
		ltclSelected = selected;
	}

	function handleHarvest() {
		const orders: SellOrder[] = [];

		// For STCL opportunities, sell only the short-term portion
		for (const opp of $stclOpportunities) {
			if (stclSelected.has(opp.symbol) && opp.currentPrice !== undefined && opp.stQuantity) {
				orders.push({
					symbol: opp.symbol,
					exchange: opp.exchange,
					quantity: opp.stQuantity, // Only ST portion
					purchasePrice: opp.stAvgPrice ?? opp.avgPurchasePrice,
					purchaseDate: opp.oldestPurchaseDate, // Keep oldest for reference
					currentPrice: opp.currentPrice,
					expectedLoss: Math.abs(opp.stPnl ?? 0)
				});
			}
		}

		// For LTCL opportunities, sell only the long-term portion
		for (const opp of $ltclOpportunities) {
			if (ltclSelected.has(opp.symbol) && opp.currentPrice !== undefined && opp.ltQuantity) {
				orders.push({
					symbol: opp.symbol,
					exchange: opp.exchange,
					quantity: opp.ltQuantity, // Only LT portion
					purchasePrice: opp.ltAvgPrice ?? opp.avgPurchasePrice,
					purchaseDate: opp.oldestPurchaseDate, // Keep oldest for reference
					currentPrice: opp.currentPrice,
					expectedLoss: Math.abs(opp.ltPnl ?? 0)
				});
			}
		}

		if (orders.length > 0) {
			pendingOrders = orders;
			showSellConfirmModal = true;
		}
	}

	function handleExport() {
		exportHoldingsToCSV($holdings);
	}

	function handleSellConfirm() {
		showSellConfirmModal = false;
		setTimeout(() => {
			showExecutionConfirmModal = true;
		}, 1000);
	}

	function handleSellCancel() {
		showSellConfirmModal = false;
		pendingOrders = [];
	}

	async function handleExecutionConfirm() {
		// Guard against double submission
		if (isCreatingBuybacks) return;
		isCreatingBuybacks = true;

		showExecutionConfirmModal = false;
		generatingRecoveryToken = true;

		try {
			await createBuybackRecordsWithRecovery(pendingOrders);
			showRecoveryLink = true;
			stclSelected = new Set();
			ltclSelected = new Set();
			// loadBuybacks replaces the store, so no duplicates
			await loadBuybacks();
		} catch (error) {
			console.error('Failed to create buyback records:', error);
		} finally {
			generatingRecoveryToken = false;
			isCreatingBuybacks = false;
			pendingOrders = [];
		}
	}

	function handleExecutionCancel() {
		showExecutionConfirmModal = false;
		pendingOrders = [];
	}

	async function handleMarkBuybackComplete(id: string) {
		try {
			await markComplete(id);
		} catch (error) {
			console.error('Failed to mark buyback complete:', error);
		}
	}
</script>

<svelte:head>
	<title>Tax Loss Harvesting Tool | India</title>
	<meta name="description" content="Harvest tax losses from your Indian equity portfolio. Upload Zerodha tradebook, see STCG/LTCG, and execute via Kite." />
</svelte:head>

<div class="min-h-screen bg-paper-200">
	<!-- Header -->
	<header class="sticky top-0 z-10 bg-paper-100/95 backdrop-blur-sm shadow-paper-sm">
		<div class="mx-auto max-w-5xl px-4 sm:px-6">
			<div class="flex items-center justify-between h-14 sm:h-16">
				<div class="flex items-center gap-3">
					<!-- Logo/Icon -->
					<div class="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-paper bg-ink-600 flex items-center justify-center shadow-paper-sm">
						<svg class="w-4 h-4 sm:w-5 sm:h-5 text-paper-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
						</svg>
					</div>
					<div>
						<h1 class="font-serif text-lg sm:text-xl font-semibold text-ink-600 tracking-tight leading-tight">Tax Loss Harvesting</h1>
						<p class="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-ink-300">India Equity</p>
					</div>
				</div>
				{#if pageState === 'results'}
					<button
						type="button"
						onclick={handleReset}
						class="flex items-center gap-1.5 rounded-paper px-3 py-1.5 text-sm font-medium text-ink-500 hover:text-ink-600 bg-paper-200 hover:bg-paper-300 transition-colors border border-paper-300"
					>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
						</svg>
						<span class="hidden sm:inline">New Upload</span>
						<span class="sm:hidden">New</span>
					</button>
				{/if}
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
		<!-- Recovery Link Card -->
		{#if showRecoveryLink && $recoveryToken}
			<div class="mb-6">
				<RecoveryLinkCard recoveryToken={$recoveryToken} />
			</div>
		{/if}

		<!-- Buyback Reminder -->
		{#if $pendingBuybacks.length > 0}
			<div class="mb-6">
				<BuybackReminder
					buybacks={$pendingBuybacks}
					apiKey={kiteApiKey}
					onmarkcomplete={handleMarkBuybackComplete}
				/>
			</div>
		{/if}

		<!-- State 1: Upload -->
		{#if pageState === 'upload'}
			<div class="max-w-xl mx-auto py-8">
				<FileUpload
					files={$uploadedFiles}
					disabled={false}
					onupload={handleUpload}
					onremove={handleRemove}
					onanalyze={handleAnalyze}
				/>
			</div>
		{/if}

		<!-- State 2: Analyzing -->
		{#if pageState === 'analyzing'}
			<div class="flex items-center justify-center py-16">
				<AnalysisProgress
					step={$analysisState.step}
					stats={{ trades: $analysisState.tradesCount, stocks: $analysisState.stocksCount }}
				/>
			</div>
		{/if}

		<!-- State 3: Results -->
		{#if pageState === 'results'}
			<div class="space-y-6">
				<!-- Realized Gains Card - Most Important! -->
				<RealizedGainsCard gains={$realizedGains} />

				<!-- Opportunities Section -->
				{#if $stclOpportunities.length > 0 || $ltclOpportunities.length > 0}
					<div class="bg-paper-100 border border-paper-300 shadow-paper rounded-paper-lg overflow-hidden">
						<div class="px-4 sm:px-6 py-4 border-b border-paper-300">
							<h2 class="font-serif text-xl font-semibold text-ink-600 tracking-tight">Loss Harvesting Opportunities</h2>
							<p class="text-sm text-ink-300 mt-0.5">Select stocks to sell and harvest losses</p>
						</div>

						<div class="p-4 sm:p-6">
							<div class="space-y-3">
								<!-- STCL Accordion -->
								{#if $stclOpportunities.length > 0}
									{@const stclAllSelected = $stclOpportunities.every((opp) => stclSelected.has(opp.symbol))}
									<details class="group bg-paper-100 border border-paper-300 rounded-paper-lg shadow-paper overflow-hidden" open>
										<summary class="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-paper-50 transition-colors">
											<div class="flex items-center gap-3">
												<span class="rounded-paper border border-paper-300 bg-paper-200 px-2 py-1 text-xs font-mono font-medium text-ink-500">
													STCL
												</span>
												<h3 class="font-serif text-base font-semibold text-ink-600">Short Term Capital Loss</h3>
												<span class="text-sm text-ink-400">({$stclOpportunities.length})</span>
											</div>
											<div class="flex items-center gap-2">
												<button
													type="button"
													onclick={(e) => { e.preventDefault(); handleStclSelectionChange(stclAllSelected ? new Set() : new Set($stclOpportunities.map(o => o.symbol))); }}
													class="rounded-paper bg-paper-200 px-3 py-1 text-xs font-medium text-ink-500 transition-colors hover:bg-paper-300"
												>
													{stclAllSelected ? 'Deselect All' : 'Select All'}
												</button>
												<svg class="h-5 w-5 text-ink-400 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
												</svg>
											</div>
										</summary>
										<div class="border-t border-paper-300">
											<OpportunityCard
												type="STCL"
												opportunities={$stclOpportunities}
												selected={stclSelected}
												onselectionchange={handleStclSelectionChange}
												hideHeader={true}
											/>
										</div>
									</details>
								{/if}

								<!-- LTCL Accordion -->
								{#if $ltclOpportunities.length > 0}
									{@const ltclAllSelected = $ltclOpportunities.every((opp) => ltclSelected.has(opp.symbol))}
									<details class="group bg-paper-100 border border-paper-300 rounded-paper-lg shadow-paper overflow-hidden" open>
										<summary class="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-paper-50 transition-colors">
											<div class="flex items-center gap-3">
												<span class="rounded-paper border border-paper-300 bg-paper-200 px-2 py-1 text-xs font-mono font-medium text-ink-500">
													LTCL
												</span>
												<h3 class="font-serif text-base font-semibold text-ink-600">Long Term Capital Loss</h3>
												<span class="text-sm text-ink-400">({$ltclOpportunities.length})</span>
											</div>
											<div class="flex items-center gap-2">
												<button
													type="button"
													onclick={(e) => { e.preventDefault(); handleLtclSelectionChange(ltclAllSelected ? new Set() : new Set($ltclOpportunities.map(o => o.symbol))); }}
													class="rounded-paper bg-paper-200 px-3 py-1 text-xs font-medium text-ink-500 transition-colors hover:bg-paper-300"
												>
													{ltclAllSelected ? 'Deselect All' : 'Select All'}
												</button>
												<svg class="h-5 w-5 text-ink-400 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
												</svg>
											</div>
										</summary>
										<div class="border-t border-paper-300">
											<OpportunityCard
												type="LTCL"
												opportunities={$ltclOpportunities}
												selected={ltclSelected}
												onselectionchange={handleLtclSelectionChange}
												hideHeader={true}
											/>
										</div>
									</details>
								{/if}
							</div>

							<!-- Action Bar -->
							<div class="mt-6 pt-4 border-t border-paper-300 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
								<div class="text-center sm:text-left">
									{#if hasSelections}
										<p class="text-sm text-ink-400">
											Selected loss: <span class="font-semibold font-mono text-status-loss">{formatCurrency(totalSelectedLoss)}</span>
										</p>
									{:else}
										<p class="text-sm text-ink-300">Select stocks above to harvest</p>
									{/if}
								</div>
								<div class="flex gap-3">
									<button
										type="button"
										onclick={handleExport}
										class="flex-1 sm:flex-none px-4 py-2.5 rounded-paper border border-ink-200 text-sm font-medium text-ink-500 hover:bg-paper-50 transition-colors"
									>
										Export CSV
									</button>
									<button
										type="button"
										onclick={handleHarvest}
										disabled={!hasSelections}
										class="flex-1 sm:flex-none px-6 py-2.5 rounded-paper bg-ink-600 text-sm font-semibold text-paper-100 hover:bg-ink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-paper-sm"
									>
										Harvest Losses
									</button>
								</div>
							</div>
						</div>
					</div>
				{:else}
					<!-- No opportunities -->
					<div class="bg-paper-100 border border-paper-300 shadow-paper rounded-paper-lg p-8 text-center">
						<div class="mx-auto h-16 w-16 rounded-full bg-status-gain-light flex items-center justify-center">
							<svg class="h-8 w-8 text-status-gain" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
						</div>
						<h3 class="mt-4 font-serif text-lg font-semibold text-ink-600">No Losses to Harvest</h3>
						<p class="mt-2 text-sm text-ink-400 max-w-sm mx-auto">
							All your holdings are in profit or at breakeven. Check back when market conditions change.
						</p>
						<button
							type="button"
							onclick={handleExport}
							class="mt-4 px-4 py-2 rounded-paper border border-paper-300 text-sm font-medium text-ink-500 hover:bg-paper-50 transition-colors"
						>
							Export Holdings
						</button>
					</div>
				{/if}
			</div>
		{/if}

		<!-- State 4: Error -->
		{#if pageState === 'error'}
			<div class="max-w-md mx-auto py-12">
				<div class="bg-paper-100 border border-paper-300 shadow-paper rounded-paper-lg p-8 text-center">
					<div class="mx-auto h-16 w-16 rounded-full bg-status-loss-light flex items-center justify-center">
						<svg class="h-8 w-8 text-status-loss" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
						</svg>
					</div>
					<h3 class="mt-4 font-serif text-lg font-semibold text-ink-600">Analysis Failed</h3>
					<p class="mt-2 text-sm text-ink-400">
						{$analysisState.error ?? 'An unexpected error occurred.'}
					</p>
					<div class="mt-6 flex justify-center gap-3">
						<button
							type="button"
							onclick={handleReset}
							class="px-4 py-2.5 rounded-paper border border-paper-300 text-sm font-medium text-ink-500 hover:bg-paper-50 transition-colors"
						>
							Start Over
						</button>
						<button
							type="button"
							onclick={handleRetry}
							class="px-4 py-2.5 rounded-paper bg-ink-600 text-sm font-semibold text-paper-100 hover:bg-ink-700 transition-colors"
						>
							Retry
						</button>
					</div>
				</div>
			</div>
		{/if}
	</main>

	<!-- Footer -->
	<footer class="mt-auto py-6">
		<div class="mx-auto max-w-5xl px-4 sm:px-6">
			<p class="text-center text-xs text-ink-300">
				All data is processed locally in your browser. Nothing is uploaded to any server.
			</p>
		</div>
	</footer>
</div>

<!-- Modals -->
<SellConfirmModal
	open={showSellConfirmModal}
	orders={pendingOrders}
	apiKey={kiteApiKey}
	onconfirm={handleSellConfirm}
	oncancel={handleSellCancel}
/>

<ExecutionConfirmModal
	open={showExecutionConfirmModal}
	orders={pendingOrders}
	onconfirm={handleExecutionConfirm}
	oncancel={handleExecutionCancel}
/>
