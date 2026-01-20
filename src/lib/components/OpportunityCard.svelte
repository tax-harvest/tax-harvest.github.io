<script lang="ts">
	import type { Holding } from '$lib/types.js';

	interface Props {
		type: 'STCL' | 'LTCL';
		opportunities: Holding[];
		selected: Set<string>;
		onselectionchange?: (selected: Set<string>) => void;
		hideHeader?: boolean;
	}

	let { type, opportunities, selected, onselectionchange, hideHeader = false }: Props = $props();

	// Get the relevant values based on type (ST vs LT portion)
	function getQuantity(opp: Holding): number {
		return type === 'STCL' ? (opp.stQuantity ?? 0) : (opp.ltQuantity ?? 0);
	}

	function getAvgPrice(opp: Holding): number {
		return type === 'STCL' ? (opp.stAvgPrice ?? 0) : (opp.ltAvgPrice ?? 0);
	}

	function getPnl(opp: Holding): number {
		return type === 'STCL' ? (opp.stPnl ?? 0) : (opp.ltPnl ?? 0);
	}

	function getPnlPercent(opp: Holding): number {
		const pnl = getPnl(opp);
		const qty = getQuantity(opp);
		const avgPrice = getAvgPrice(opp);
		const cost = qty * avgPrice;
		return cost > 0 ? (pnl / cost) * 100 : 0;
	}

	// Computed values - work directly with the selected prop
	let allSelected = $derived(
		opportunities.length > 0 && opportunities.every((opp) => selected.has(opp.symbol))
	);

	let selectedOpportunities = $derived(opportunities.filter((opp) => selected.has(opp.symbol)));

	let totalSelectedLoss = $derived(
		selectedOpportunities.reduce((total, opp) => {
			return total + Math.abs(getPnl(opp));
		}, 0)
	);

	// Format currency in Indian Rupees
	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-IN', {
			style: 'currency',
			currency: 'INR',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(amount);
	}

	// Generate unique ID for an opportunity
	function getOpportunityId(opp: Holding): string {
		return opp.symbol;
	}

	// Toggle individual selection
	function toggleSelection(opp: Holding): void {
		const id = getOpportunityId(opp);
		const newSelected = new Set(selected);
		if (newSelected.has(id)) {
			newSelected.delete(id);
		} else {
			newSelected.add(id);
		}
		onselectionchange?.(newSelected);
	}

	// Toggle select all
	function toggleSelectAll(): void {
		let newSelected: Set<string>;
		if (allSelected) {
			// Deselect all
			newSelected = new Set<string>();
		} else {
			// Select all
			newSelected = new Set(opportunities.map((opp) => getOpportunityId(opp)));
		}
		onselectionchange?.(newSelected);
	}

	// Get label for the card type
	let typeLabel = $derived(type === 'STCL' ? 'Short Term Capital Loss' : 'Long Term Capital Loss');
</script>

<div class={hideHeader ? '' : 'rounded-paper-lg border border-paper-300 bg-paper-100 shadow-paper overflow-hidden'}>
	<!-- Header -->
	{#if !hideHeader}
		<div class="flex items-center justify-between border-b border-paper-300 px-4 py-3">
			<div class="flex items-center gap-3">
				<span class="rounded-paper border border-paper-300 bg-paper-200 px-2 py-1 text-xs font-mono font-medium text-ink-500">
					{type}
				</span>
				<h3 class="font-serif text-base font-semibold text-ink-600">{typeLabel}</h3>
			</div>
			{#if opportunities.length > 0}
				<button
					onclick={toggleSelectAll}
					class="rounded-paper bg-paper-200 px-3 py-1.5 text-sm font-medium text-ink-500 transition-colors hover:bg-paper-300 focus:ring-2 focus:ring-accent-500 focus:ring-offset-1 focus:outline-none"
				>
					{allSelected ? 'Deselect All' : 'Select All'}
				</button>
			{/if}
		</div>
	{/if}

	<!-- Content -->
	{#if opportunities.length === 0}
		<div class="px-4 py-8 text-center">
			<svg
				class="mx-auto h-12 w-12 text-ink-200"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				aria-hidden="true"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="1.5"
					d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
				/>
			</svg>
			<p class="mt-2 text-sm text-ink-400">No {type} opportunities found</p>
			<p class="mt-1 text-xs text-ink-300">
				{type === 'STCL'
					? 'No short-term holdings are currently at a loss'
					: 'No long-term holdings are currently at a loss'}
			</p>
		</div>
	{:else}
		<!-- Opportunities Table -->
		<div class="overflow-x-auto">
			<table class="w-full">
				<thead>
					<tr class="border-b border-paper-300 bg-paper-50">
						<th class="w-10 px-3 py-2 text-left">
							<span class="sr-only">Select</span>
						</th>
						<th class="px-3 py-2 text-left label-caps">Stock</th>
						<th class="px-3 py-2 text-right label-caps">Qty</th>
						<th class="px-3 py-2 text-right label-caps hidden sm:table-cell">Avg Cost</th>
						<th class="px-3 py-2 text-right label-caps hidden sm:table-cell">Current</th>
						<th class="px-3 py-2 text-right label-caps">Loss</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-paper-300">
					{#each opportunities as opp (opp.symbol)}
						{@const isSelected = selected.has(getOpportunityId(opp))}
						{@const qty = getQuantity(opp)}
						{@const avgPrice = getAvgPrice(opp)}
						{@const pnl = getPnl(opp)}
						{@const pnlPct = getPnlPercent(opp)}
						{@const lossAmount = Math.abs(pnl)}
						<tr class={`transition-colors ${isSelected ? 'bg-paper-50' : 'hover:bg-paper-50'}`}>
							<td class="px-3 py-2.5">
								<input
									type="checkbox"
									checked={isSelected}
									onchange={() => toggleSelection(opp)}
									class="h-4 w-4 rounded-paper border-paper-400 text-accent-500 focus:ring-accent-500"
									aria-label={`Select ${opp.symbol}`}
								/>
							</td>
							<td class="px-3 py-2.5">
								<div class="font-medium text-ink-600">{opp.symbol}</div>
								<div class="text-xs text-ink-300">{opp.exchange}</div>
							</td>
							<td class="px-3 py-2.5 text-right font-mono text-sm text-ink-500">
								{qty}
							</td>
							<td class="px-3 py-2.5 text-right font-mono text-sm text-ink-500 hidden sm:table-cell">
								{formatCurrency(avgPrice)}
							</td>
							<td class="px-3 py-2.5 text-right font-mono text-sm text-ink-500 hidden sm:table-cell">
								{opp.currentPrice ? formatCurrency(opp.currentPrice) : '-'}
							</td>
							<td class="px-3 py-2.5 text-right">
								<div class="font-mono font-medium text-status-loss">-{formatCurrency(lossAmount)}</div>
								<div class="text-xs text-ink-300">{pnlPct ? `${pnlPct.toFixed(2)}%` : '-'}</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Footer with Total -->
		<div class="border-t border-paper-300 bg-paper-50 px-4 py-3">
			<div class="flex items-center justify-between">
				<div class="text-sm text-ink-400">
					<span class="font-medium text-ink-600">{selectedOpportunities.length}</span> of
					<span>{opportunities.length}</span> selected
				</div>
				<div class="text-right">
					<div class="text-xs text-ink-300">Total Selected Loss</div>
					<div class="text-lg font-mono font-semibold text-status-loss">-{formatCurrency(totalSelectedLoss)}</div>
				</div>
			</div>
		</div>
	{/if}
</div>
