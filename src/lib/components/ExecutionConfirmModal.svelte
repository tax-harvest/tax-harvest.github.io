<script lang="ts">
	/**
	 * ExecutionConfirmModal Component
	 *
	 * A modal dialog that appears after the user is redirected back from Kite
	 * to confirm whether they completed the sell orders.
	 *
	 * Requirements:
	 * - 8.4: After Kite redirect, ask user if they completed the orders
	 * - 8.5: On confirmation, create buyback records with sell details
	 */

	import type { SellOrder } from '$lib/types';
	import { createBuybackRecords } from '$lib/stores/buybacks';

	interface Props {
		open: boolean;
		orders: SellOrder[];
		onconfirm?: () => void;
		oncancel?: () => void;
	}

	let { open, orders, onconfirm, oncancel }: Props = $props();

	let isProcessing = $state(false);
	let error = $state<string | null>(null);

	// Calculate total expected loss
	let totalExpectedLoss = $derived(
		orders.reduce((sum, order) => sum + Math.abs(order.expectedLoss), 0)
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

	// Format date for display
	function formatDate(date: Date): string {
		return new Intl.DateTimeFormat('en-IN', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		}).format(date);
	}

	// Handle confirm button click
	async function handleConfirm(): Promise<void> {
		isProcessing = true;
		error = null;

		try {
			// Create buyback records for all executed orders
			await createBuybackRecords(orders);
			onconfirm?.();
		} catch (err) {
			console.error('Failed to create buyback records:', err);
			error = err instanceof Error ? err.message : 'Failed to create buyback records';
		} finally {
			isProcessing = false;
		}
	}

	// Handle cancel button click
	function handleCancel(): void {
		oncancel?.();
	}

	// Handle backdrop click
	function handleBackdropClick(event: MouseEvent): void {
		if (event.target === event.currentTarget) {
			handleCancel();
		}
	}

	// Handle escape key
	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape' && !isProcessing) {
			handleCancel();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- Modal Backdrop -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-ink-700/40 p-4"
		onclick={handleBackdropClick}
		role="dialog"
		aria-modal="true"
		aria-labelledby="execution-confirm-title"
	>
		<!-- Modal Content -->
		<div class="w-full max-w-2xl bg-paper-100 shadow-paper-lifted rounded-paper-lg">
			<!-- Header -->
			<div class="border-b border-paper-300 px-6 py-4">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-full bg-status-info-light">
						<svg
							class="h-5 w-5 text-status-info"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							aria-hidden="true"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
					</div>
					<div>
						<h2 id="execution-confirm-title" class="font-serif text-lg font-semibold text-ink-600">
							Did you complete the orders on Kite?
						</h2>
						<p class="mt-1 text-sm text-ink-400">
							Please confirm if you executed the following orders
						</p>
					</div>
				</div>
			</div>

			<!-- Orders List -->
			<div class="max-h-80 overflow-y-auto px-6 py-4">
				{#if orders.length === 0}
					<p class="py-4 text-center text-ink-400">No orders to display</p>
				{:else}
					<div class="overflow-hidden rounded-paper border border-paper-300">
						<table class="min-w-full divide-y divide-paper-300">
							<thead class="bg-paper-50">
								<tr>
									<th
										scope="col"
										class="px-4 py-3 text-left label-caps"
									>
										Symbol
									</th>
									<th
										scope="col"
										class="px-4 py-3 text-right label-caps"
									>
										Qty
									</th>
									<th
										scope="col"
										class="px-4 py-3 text-right label-caps"
									>
										Sell Price
									</th>
									<th
										scope="col"
										class="px-4 py-3 text-right label-caps"
									>
										Expected Loss
									</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-paper-300 bg-paper-100">
								{#each orders as order (order.symbol + order.exchange)}
									<tr class="hover:bg-paper-50">
										<td class="whitespace-nowrap px-4 py-3">
											<div class="flex flex-col">
												<span class="text-sm font-medium text-ink-600">{order.symbol}</span>
												<span class="text-xs text-ink-300">{order.exchange}</span>
											</div>
										</td>
										<td class="whitespace-nowrap px-4 py-3 text-right text-sm font-mono text-ink-500">
											{order.quantity}
										</td>
										<td class="whitespace-nowrap px-4 py-3 text-right text-sm font-mono text-ink-500">
											{formatCurrency(order.currentPrice)}
										</td>
										<td class="whitespace-nowrap px-4 py-3 text-right text-sm font-mono font-medium text-status-loss">
											-{formatCurrency(Math.abs(order.expectedLoss))}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<!-- Total -->
					<div class="mt-4 flex items-center justify-between rounded-paper bg-paper-50 border border-paper-300 px-4 py-3">
						<span class="text-sm font-medium text-ink-500">Total Expected Loss</span>
						<span class="text-lg font-mono font-semibold text-status-loss">
							-{formatCurrency(totalExpectedLoss)}
						</span>
					</div>
				{/if}
			</div>

			<!-- Error Message -->
			{#if error}
				<div class="mx-6 mb-4 border-l-2 border-status-loss bg-status-loss-light rounded-paper p-3">
					<div class="flex">
						<svg
							class="h-5 w-5 text-status-loss"
							viewBox="0 0 20 20"
							fill="currentColor"
							aria-hidden="true"
						>
							<path
								fill-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
								clip-rule="evenodd"
							/>
						</svg>
						<p class="ml-3 text-sm text-status-loss-dark">{error}</p>
					</div>
				</div>
			{/if}

			<!-- Footer -->
			<div class="flex items-center justify-end gap-3 border-t border-paper-300 bg-paper-50 px-6 py-4">
				<button
					type="button"
					onclick={handleCancel}
					disabled={isProcessing}
					class="rounded-paper border border-ink-200 bg-paper-100 px-4 py-2 text-sm font-medium text-ink-500 shadow-paper-sm transition-colors hover:bg-paper-200 focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
				>
					No, I cancelled
				</button>
				<button
					type="button"
					onclick={handleConfirm}
					disabled={isProcessing || orders.length === 0}
					class="inline-flex items-center rounded-paper bg-ink-600 px-4 py-2 text-sm font-medium text-paper-100 shadow-paper-sm transition-colors hover:bg-ink-700 focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if isProcessing}
						<svg
							class="-ml-1 mr-2 h-4 w-4 animate-spin text-paper-100"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							/>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							/>
						</svg>
						Creating records...
					{:else}
						Yes, I executed
					{/if}
				</button>
			</div>

			<!-- Buyback Reminder Note -->
			<div class="rounded-b-paper-lg border-l-2 border-status-warning bg-status-warning-light px-6 py-3">
				<div class="flex items-start gap-2">
					<svg
						class="mt-0.5 h-4 w-4 flex-shrink-0 text-status-warning"
						viewBox="0 0 20 20"
						fill="currentColor"
						aria-hidden="true"
					>
						<path
							fill-rule="evenodd"
							d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
							clip-rule="evenodd"
						/>
					</svg>
					<p class="text-xs text-ink-500">
						If you confirm, buyback reminders will be created. Remember: Buy back on the next
						trading day to avoid wash sale treatment.
					</p>
				</div>
			</div>
		</div>
	</div>
{/if}
