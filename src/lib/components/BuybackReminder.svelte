<script lang="ts">
	import type { BuybackRecord } from '$lib/types.js';
	import { executeBuybackOrders } from '$lib/utils/kite-publisher.js';
	import { format } from 'date-fns';

	interface Props {
		buybacks: BuybackRecord[];
		apiKey: string;
		onmarkcomplete?: (id: string) => void;
	}

	let { buybacks, apiKey, onmarkcomplete }: Props = $props();

	// Selection state - tracks selected buyback IDs
	let selected = $state<Set<string>>(new Set());

	// Filter to only show pending buybacks
	let pendingBuybacks = $derived(buybacks.filter((b) => b.status === 'PENDING'));

	// Check if all are selected
	let allSelected = $derived(
		pendingBuybacks.length > 0 && pendingBuybacks.every((b) => selected.has(b.id))
	);

	// Get selected buybacks
	let selectedBuybacks = $derived(pendingBuybacks.filter((b) => selected.has(b.id)));

	// Calculate total expected loss for selected buybacks
	let totalSelectedLoss = $derived(
		selectedBuybacks.reduce((total, b) => total + (b.expectedLoss ?? 0), 0)
	);

	// Format currency in Indian Rupees
	function formatCurrency(amount: number | undefined): string {
		if (amount === undefined) return '-';
		return new Intl.NumberFormat('en-IN', {
			style: 'currency',
			currency: 'INR',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(amount);
	}

	// Format date for display
	function formatDate(date: Date): string {
		return format(date, 'dd MMM yyyy');
	}

	// Toggle individual selection
	function toggleSelection(id: string): void {
		const newSelected = new Set(selected);
		if (newSelected.has(id)) {
			newSelected.delete(id);
		} else {
			newSelected.add(id);
		}
		selected = newSelected;
	}

	// Toggle select all
	function toggleSelectAll(): void {
		if (allSelected) {
			selected = new Set();
		} else {
			selected = new Set(pendingBuybacks.map((b) => b.id));
		}
	}

	// Handle buy back now button click - only for selected items
	function handleBuyBackNow(): void {
		if (selectedBuybacks.length === 0) return;

		try {
			executeBuybackOrders(selectedBuybacks, apiKey);
		} catch (error) {
			console.error('Failed to open Kite basket:', error);
		}
	}

	// Handle mark complete for individual buyback
	function handleMarkComplete(id: string): void {
		// Remove from selection when marked complete
		const newSelected = new Set(selected);
		newSelected.delete(id);
		selected = newSelected;
		onmarkcomplete?.(id);
	}

	// Handle mark all selected as complete
	function handleMarkSelectedComplete(): void {
		for (const id of selectedBuybacks.map((b) => b.id)) {
			onmarkcomplete?.(id);
		}
		selected = new Set();
	}
</script>

{#if pendingBuybacks.length > 0}
	<div class="bg-paper-100 border-l-4 border-status-warning shadow-paper rounded-paper-lg overflow-hidden">
		<!-- Alert Banner -->
		<div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 border-b border-paper-300 px-4 py-3">
			<div class="flex items-start gap-3 flex-1">
				<div class="flex-shrink-0">
					<svg
						class="h-5 w-5 text-status-warning"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
						/>
					</svg>
				</div>
				<div class="flex-1">
					<h3 class="text-sm font-semibold text-ink-600">Buyback Reminder</h3>
					<p class="mt-0.5 text-sm text-ink-400">
						Same-day buyback is treated as intraday. Buy back next trading day.
					</p>
				</div>
			</div>
			<div class="flex gap-2 w-full sm:w-auto">
				<button
					type="button"
					onclick={toggleSelectAll}
					class="flex-1 sm:flex-none rounded-paper border border-paper-300 bg-paper-50 px-3 py-1.5 text-sm font-medium text-ink-500 transition-colors hover:bg-paper-200"
				>
					{allSelected ? 'Deselect All' : 'Select All'}
				</button>
			</div>
		</div>

		<!-- Pending Buybacks List -->
		<div class="divide-y divide-paper-300">
			{#each pendingBuybacks as buyback (buyback.id)}
				{@const isSelected = selected.has(buyback.id)}
				<div class="flex items-center gap-3 sm:gap-4 px-4 py-3 transition-colors {isSelected ? 'bg-paper-50 border-l-2 border-accent-500' : 'hover:bg-paper-50'}">
					<!-- Checkbox -->
					<input
						type="checkbox"
						checked={isSelected}
						onchange={() => toggleSelection(buyback.id)}
						class="h-4 w-4 rounded-paper border-paper-400 text-accent-500 focus:ring-accent-500"
						aria-label="Select {buyback.symbol}"
					/>

					<!-- Symbol and Exchange -->
					<div class="min-w-[80px] sm:min-w-[100px]">
						<div class="font-medium text-ink-600">{buyback.symbol}</div>
						<div class="text-xs text-ink-300">{buyback.exchange}</div>
					</div>

					<!-- Quantity -->
					<div class="min-w-[50px] sm:min-w-[60px] text-right">
						<div class="text-sm font-mono text-ink-500">{buyback.quantity}</div>
						<div class="text-xs text-ink-300">qty</div>
					</div>

					<!-- Sell Date -->
					<div class="hidden sm:block min-w-[100px] text-right">
						<div class="text-sm font-mono text-ink-500">{formatDate(buyback.sellDate)}</div>
						<div class="text-xs text-ink-300">sold on</div>
					</div>

					<!-- Expected Loss -->
					<div class="min-w-[80px] sm:min-w-[100px] text-right">
						<div class="text-sm font-mono font-medium text-status-loss">
							{buyback.expectedLoss ? `-${formatCurrency(buyback.expectedLoss)}` : '-'}
						</div>
						<div class="text-xs text-ink-300">loss</div>
					</div>

					<!-- Mark Complete Button -->
					<div class="ml-auto">
						<button
							type="button"
							onclick={() => handleMarkComplete(buyback.id)}
							class="rounded-paper border border-paper-300 bg-paper-50 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-ink-500 transition-colors hover:bg-paper-200 focus:ring-2 focus:ring-accent-500 focus:ring-offset-1 focus:outline-none"
						>
							<span class="hidden sm:inline">Mark Complete</span>
							<span class="sm:hidden">Done</span>
						</button>
					</div>
				</div>
			{/each}
		</div>

		<!-- Footer with Actions -->
		<div class="border-t border-paper-300 bg-paper-50 px-4 py-3">
			<div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
				<div class="text-sm text-ink-400 text-center sm:text-left">
					{#if selectedBuybacks.length > 0}
						<span class="font-medium text-ink-600">{selectedBuybacks.length}</span> of {pendingBuybacks.length} selected
						<span class="font-mono font-semibold text-status-loss ml-2">-{formatCurrency(totalSelectedLoss)}</span>
					{:else}
						<span class="font-medium text-ink-600">{pendingBuybacks.length}</span> pending buybacks
					{/if}
				</div>
				<div class="flex gap-2">
					{#if selectedBuybacks.length > 0}
						<button
							type="button"
							onclick={handleMarkSelectedComplete}
							class="flex-1 sm:flex-none rounded-paper border border-paper-300 bg-paper-100 px-4 py-2 text-sm font-medium text-ink-500 transition-colors hover:bg-paper-200"
						>
							Mark Selected Done
						</button>
					{/if}
					<button
						type="button"
						onclick={handleBuyBackNow}
						disabled={selectedBuybacks.length === 0}
						class="flex-1 sm:flex-none rounded-paper bg-ink-600 px-4 py-2 text-sm font-semibold text-paper-100 transition-colors hover:bg-ink-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-paper-sm"
					>
						Buy Back {selectedBuybacks.length > 0 ? `(${selectedBuybacks.length})` : 'Selected'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
