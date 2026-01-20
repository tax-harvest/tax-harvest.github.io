<!--
  RealizedGainsCard Component

  Purpose: Display realized capital gains/losses for the current FY
  Helps users understand when tax loss harvesting makes sense

  Features:
  - Shows STCG, STCL, LTCG, LTCL breakdown
  - Calculates tax liability on gains
  - Shows when harvesting is beneficial
  - Modern, mobile-friendly design
-->
<script lang="ts">
	import type { RealizedGainsSummary } from '$lib/types';

	interface Props {
		gains: RealizedGainsSummary;
	}

	let { gains }: Props = $props();

	// Tax rates for FY 2024-25 onwards
	const STCG_TAX_RATE = 0.20; // 20% for equity
	const LTCG_TAX_RATE = 0.125; // 12.5% for equity
	const LTCG_EXEMPTION = 125000; // Rs 1.25L exemption

	// Calculate estimated tax
	let stcgTax = $derived(gains.netShortTerm > 0 ? gains.netShortTerm * STCG_TAX_RATE : 0);
	let taxableLtcg = $derived(Math.max(0, gains.netLongTerm - LTCG_EXEMPTION));
	let ltcgTax = $derived(taxableLtcg * LTCG_TAX_RATE);
	let totalTax = $derived(stcgTax + ltcgTax);

	// Determine if harvesting makes sense
	let hasGainsToOffset = $derived(gains.netShortTerm > 0 || gains.netLongTerm > LTCG_EXEMPTION);

	/**
	 * Format currency in INR
	 */
	function formatCurrency(amount: number): string {
		const absAmount = Math.abs(amount);
		return new Intl.NumberFormat('en-IN', {
			style: 'currency',
			currency: 'INR',
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(absAmount);
	}

	/**
	 * Get current FY string
	 */
	function getCurrentFy(): string {
		const now = new Date();
		const month = now.getMonth();
		const year = now.getFullYear();
		const fyStartYear = month < 3 ? year - 1 : year;
		const fyEndYear = fyStartYear + 1;
		return `FY ${fyStartYear}-${fyEndYear.toString().slice(-2)}`;
	}
</script>

<div class="bg-paper-100 border border-paper-300 shadow-paper rounded-paper-lg overflow-hidden">
	<!-- Header -->
	<div class="px-4 sm:px-6 py-4 border-b border-paper-300">
		<h2 class="font-serif text-xl font-semibold text-ink-600 tracking-tight">Realized Capital Gains</h2>
		<p class="text-sm text-ink-300 mt-0.5">{getCurrentFy()} • Based on your tradebook</p>
	</div>

	<!-- Content -->
	<div class="p-4 sm:p-6">
		<!-- Gains Grid -->
		<div class="grid grid-cols-2 gap-3 sm:gap-4">
			<!-- STCG -->
			<div class="rounded-paper bg-paper-50 border border-paper-300 p-3 sm:p-4">
				<div class="flex items-center gap-2 mb-1">
					<span class="label-caps text-status-gain">STCG</span>
				</div>
				<p class="text-lg sm:text-xl font-mono font-semibold text-status-gain">{formatCurrency(gains.stcg)}</p>
				<p class="text-xs text-ink-300 mt-0.5">Short-term gains</p>
			</div>

			<!-- STCL -->
			<div class="rounded-paper bg-paper-50 border border-paper-300 p-3 sm:p-4">
				<div class="flex items-center gap-2 mb-1">
					<span class="label-caps text-status-loss">STCL</span>
				</div>
				<p class="text-lg sm:text-xl font-mono font-semibold text-status-loss">{formatCurrency(gains.stcl)}</p>
				<p class="text-xs text-ink-300 mt-0.5">Short-term losses</p>
			</div>

			<!-- LTCG -->
			<div class="rounded-paper bg-paper-50 border border-paper-300 p-3 sm:p-4">
				<div class="flex items-center gap-2 mb-1">
					<span class="label-caps text-status-gain-dark">LTCG</span>
				</div>
				<p class="text-lg sm:text-xl font-mono font-semibold text-status-gain-dark">{formatCurrency(gains.ltcg)}</p>
				<p class="text-xs text-ink-300 mt-0.5">Long-term gains</p>
			</div>

			<!-- LTCL -->
			<div class="rounded-paper bg-paper-50 border border-paper-300 p-3 sm:p-4">
				<div class="flex items-center gap-2 mb-1">
					<span class="label-caps text-status-loss-dark">LTCL</span>
				</div>
				<p class="text-lg sm:text-xl font-mono font-semibold text-status-loss-dark">{formatCurrency(gains.ltcl)}</p>
				<p class="text-xs text-ink-300 mt-0.5">Long-term losses</p>
			</div>
		</div>

		<!-- Net Summary -->
		<div class="mt-4 pt-4 border-t border-paper-300">
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
				<div class="space-y-1">
					<div class="flex items-center gap-3 text-sm">
						<span class="text-ink-400">Net Short-Term:</span>
						<span class="font-mono font-semibold {gains.netShortTerm >= 0 ? 'text-status-gain' : 'text-status-loss'}">
							{gains.netShortTerm >= 0 ? '+' : '-'}{formatCurrency(gains.netShortTerm)}
						</span>
					</div>
					<div class="flex items-center gap-3 text-sm">
						<span class="text-ink-400">Net Long-Term:</span>
						<span class="font-mono font-semibold {gains.netLongTerm >= 0 ? 'text-status-gain' : 'text-status-loss'}">
							{gains.netLongTerm >= 0 ? '+' : '-'}{formatCurrency(gains.netLongTerm)}
						</span>
					</div>
				</div>

				{#if totalTax > 0}
					<div class="rounded-paper bg-status-warning-light border border-paper-300 px-4 py-2.5 text-center sm:text-right">
						<p class="text-xs text-status-warning font-medium">Estimated Tax</p>
						<p class="text-xl font-mono font-semibold text-status-warning-dark">{formatCurrency(totalTax)}</p>
					</div>
				{/if}
			</div>
		</div>

		<!-- Harvesting Guidance -->
		<div class="mt-4 rounded-paper border-l-2 {hasGainsToOffset ? 'border-status-info bg-status-info-light' : 'border-paper-400 bg-paper-50'} p-4">
			{#if hasGainsToOffset}
				<div class="flex gap-3">
					<div class="flex-shrink-0">
						<svg class="h-5 w-5 text-status-info" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</div>
					<div>
						<p class="text-sm font-medium text-status-info-dark">Tax loss harvesting can help!</p>
						<p class="text-sm text-ink-400 mt-1">
							You have realized gains this FY. Harvesting losses from loss-making holdings can offset these gains and reduce your tax liability.
						</p>
						{#if gains.netShortTerm > 0}
							<p class="text-xs text-ink-300 mt-2">
								<span class="font-medium text-ink-500">Tip:</span> STCL can offset both STCG and LTCG
							</p>
						{/if}
					</div>
				</div>
			{:else}
				<div class="flex gap-3">
					<div class="flex-shrink-0">
						<svg class="h-5 w-5 text-ink-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</div>
					<div>
						<p class="text-sm font-medium text-ink-500">No urgent need for harvesting</p>
						<p class="text-sm text-ink-400 mt-1">
							{#if gains.netShortTerm <= 0 && gains.netLongTerm <= LTCG_EXEMPTION}
								Your net gains are within exemption limits. You may still harvest losses to carry forward for future years.
							{:else}
								No significant gains to offset currently.
							{/if}
						</p>
					</div>
				</div>
			{/if}
		</div>

		<!-- Tax Rules Info -->
		<details class="mt-4 group">
			<summary class="flex items-center gap-2 text-sm text-ink-400 cursor-pointer hover:text-ink-600">
				<svg class="h-4 w-4 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
				Tax rules reference
			</summary>
			<div class="mt-3 pl-6 space-y-2 text-xs text-ink-400">
				<p><span class="font-medium text-ink-500">STCG:</span> 20% tax on equity held ≤12 months</p>
				<p><span class="font-medium text-ink-500">LTCG:</span> 12.5% tax on equity held >12 months (above ₹1.25L exemption)</p>
				<p><span class="font-medium text-ink-500">STCL:</span> Can offset STCG + LTCG</p>
				<p><span class="font-medium text-ink-500">LTCL:</span> Can offset LTCG only</p>
				<p><span class="font-medium text-ink-500">Carry forward:</span> Unused losses can be carried forward 8 years</p>
			</div>
		</details>
	</div>
</div>
