<!--
  HoldingsView Component

  Purpose: Display portfolio holdings in an accordion (collapsed by default)
  Shows short-term and long-term holdings with P&L info

  Features:
  - Accordion style, collapsed by default
  - Tabs for ST/LT filtering
  - Mobile-friendly card layout on small screens
  - Table layout on larger screens
-->
<script lang="ts">
	import type { Holding, Classification } from '$lib/types';

	interface Props {
		holdings: Holding[];
		/** Whether accordion starts expanded */
		defaultExpanded?: boolean;
	}

	let { holdings, defaultExpanded = false }: Props = $props();

	let isExpanded = $state(defaultExpanded);
	let activeTab: Classification = $state('SHORT_TERM');

	const shortTermHoldings = $derived(
		holdings.filter((h) => h.classification === 'SHORT_TERM')
	);

	const longTermHoldings = $derived(
		holdings.filter((h) => h.classification === 'LONG_TERM')
	);

	const displayedHoldings = $derived(
		activeTab === 'SHORT_TERM' ? shortTermHoldings : longTermHoldings
	);

	// Summary stats
	const totalValue = $derived(
		holdings.reduce((sum, h) => sum + (h.currentPrice ?? 0) * h.totalQuantity, 0)
	);
	const totalPnl = $derived(
		holdings.reduce((sum, h) => sum + (h.pnl ?? 0), 0)
	);

	function formatCurrency(value: number | undefined): string {
		if (value === undefined) return '-';
		return new Intl.NumberFormat('en-IN', {
			style: 'currency',
			currency: 'INR',
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(value);
	}

	function formatCurrencyPrecise(value: number | undefined): string {
		if (value === undefined) return '-';
		return new Intl.NumberFormat('en-IN', {
			style: 'currency',
			currency: 'INR',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(value);
	}

	function formatPercent(value: number | undefined): string {
		if (value === undefined) return '-';
		const sign = value >= 0 ? '+' : '';
		return `${sign}${value.toFixed(2)}%`;
	}

	function getPnlClass(pnl: number | undefined): string {
		if (pnl === undefined) return 'text-gray-500';
		if (pnl < 0) return 'text-red-600';
		if (pnl > 0) return 'text-green-600';
		return 'text-gray-500';
	}

	function toggleExpanded() {
		isExpanded = !isExpanded;
	}
</script>

<div class="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
	<!-- Accordion Header -->
	<button
		type="button"
		onclick={toggleExpanded}
		class="w-full px-4 sm:px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
	>
		<div class="flex items-center gap-3">
			<div class="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center">
				<svg class="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
				</svg>
			</div>
			<div class="text-left">
				<h2 class="text-base font-semibold text-gray-900">Your Holdings</h2>
				<p class="text-sm text-gray-500">
					{holdings.length} stocks • {formatCurrency(totalValue)} value
					{#if totalPnl !== 0}
						<span class={getPnlClass(totalPnl)}>({totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)})</span>
					{/if}
				</p>
			</div>
		</div>
		<svg
			class="h-5 w-5 text-gray-500 transition-transform duration-200 {isExpanded ? 'rotate-180' : ''}"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
		</svg>
	</button>

	<!-- Accordion Content -->
	{#if isExpanded}
		<div class="border-t border-gray-200">
			<!-- Tab Navigation -->
			<div class="px-4 sm:px-6 pt-4">
				<div class="flex rounded-lg bg-gray-100 p-1">
					<button
						type="button"
						onclick={() => (activeTab = 'SHORT_TERM')}
						class="flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all {activeTab === 'SHORT_TERM'
							? 'bg-white text-gray-900 shadow-sm'
							: 'text-gray-600 hover:text-gray-900'}"
					>
						Short Term
						<span class="ml-1.5 text-xs {activeTab === 'SHORT_TERM' ? 'text-blue-600' : 'text-gray-500'}">
							({shortTermHoldings.length})
						</span>
					</button>
					<button
						type="button"
						onclick={() => (activeTab = 'LONG_TERM')}
						class="flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all {activeTab === 'LONG_TERM'
							? 'bg-white text-gray-900 shadow-sm'
							: 'text-gray-600 hover:text-gray-900'}"
					>
						Long Term
						<span class="ml-1.5 text-xs {activeTab === 'LONG_TERM' ? 'text-emerald-600' : 'text-gray-500'}">
							({longTermHoldings.length})
						</span>
					</button>
				</div>
			</div>

			<!-- Holdings Content -->
			<div class="p-4 sm:p-6">
				{#if displayedHoldings.length === 0}
					<div class="py-8 text-center">
						<svg class="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
						</svg>
						<p class="mt-2 text-sm text-gray-500">
							No {activeTab === 'SHORT_TERM' ? 'short-term' : 'long-term'} holdings
						</p>
					</div>
				{:else}
					<!-- Mobile Card View -->
					<div class="sm:hidden space-y-3">
						{#each displayedHoldings as holding (holding.symbol + holding.exchange)}
							<div class="rounded-xl border {holding.isLoss ? 'border-red-200 bg-red-50/30' : 'border-gray-200 bg-white'} p-4">
								<div class="flex items-start justify-between">
									<div>
										<p class="font-semibold text-gray-900">{holding.symbol}</p>
										<p class="text-xs text-gray-500">{holding.exchange} • {holding.totalQuantity} shares</p>
									</div>
									<div class="text-right">
										<p class="font-semibold {getPnlClass(holding.pnl)}">{formatCurrency(holding.pnl)}</p>
										<p class="text-xs {getPnlClass(holding.pnlPercent)}">{formatPercent(holding.pnlPercent)}</p>
									</div>
								</div>
								<div class="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-sm">
									<div>
										<p class="text-xs text-gray-500">Avg Price</p>
										<p class="font-medium text-gray-900">{formatCurrencyPrecise(holding.avgPurchasePrice)}</p>
									</div>
									<div class="text-right">
										<p class="text-xs text-gray-500">Current</p>
										<p class="font-medium text-gray-900">{formatCurrencyPrecise(holding.currentPrice)}</p>
									</div>
								</div>
							</div>
						{/each}
					</div>

					<!-- Desktop Table View -->
					<div class="hidden sm:block overflow-x-auto">
						<table class="min-w-full">
							<thead>
								<tr class="border-b border-gray-200">
									<th class="pb-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Symbol</th>
									<th class="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Qty</th>
									<th class="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Avg Price</th>
									<th class="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Current</th>
									<th class="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">P&L</th>
									<th class="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">P&L %</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100">
								{#each displayedHoldings as holding (holding.symbol + holding.exchange)}
									<tr class="hover:bg-gray-50 {holding.isLoss ? 'bg-red-50/50' : ''}">
										<td class="py-3">
											<div>
												<p class="font-medium text-gray-900">{holding.symbol}</p>
												<p class="text-xs text-gray-500">{holding.exchange}</p>
											</div>
										</td>
										<td class="py-3 text-right text-sm text-gray-900">{holding.totalQuantity}</td>
										<td class="py-3 text-right text-sm text-gray-900">{formatCurrencyPrecise(holding.avgPurchasePrice)}</td>
										<td class="py-3 text-right text-sm text-gray-900">{formatCurrencyPrecise(holding.currentPrice)}</td>
										<td class="py-3 text-right text-sm font-medium {getPnlClass(holding.pnl)}">{formatCurrency(holding.pnl)}</td>
										<td class="py-3 text-right text-sm font-medium {getPnlClass(holding.pnlPercent)}">{formatPercent(holding.pnlPercent)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
