<script lang="ts">
	import type { SellOrder } from '$lib/types.js';
	import { executeSellOrders } from '$lib/utils/kite-publisher.js';

	interface Props {
		open: boolean;
		orders: SellOrder[];
		apiKey?: string;
		onconfirm?: () => void;
		oncancel?: () => void;
	}

	let { open, orders, apiKey = '', onconfirm, oncancel }: Props = $props();

	// Calculate total expected loss
	let totalExpectedLoss = $derived(
		orders.reduce((total, order) => total + Math.abs(order.expectedLoss), 0)
	);

	// Check if we can proceed (have orders and API key)
	let canProceed = $derived(orders.length > 0 && apiKey.trim() !== '');

	// Format currency in Indian Rupees
	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-IN', {
			style: 'currency',
			currency: 'INR',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(amount);
	}

	// Handle confirm - redirect to Kite basket
	function handleConfirm(): void {
		if (canProceed) {
			executeSellOrders(orders, apiKey, '_blank');
		}
		onconfirm?.();
	}

	// Handle cancel
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
		if (event.key === 'Escape') {
			handleCancel();
		}
	}
</script>

{#if open}
	<!-- Modal Backdrop -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-ink-700/40 p-4"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
		tabindex="-1"
	>
		<!-- Modal Content -->
		<div class="w-full max-w-2xl bg-paper-100 shadow-paper-lifted rounded-paper-lg">
			<!-- Header -->
			<div class="border-b border-paper-300 px-6 py-4">
				<h2 id="modal-title" class="font-serif text-lg font-semibold text-ink-600">
					Confirm Sell Orders
				</h2>
				<p class="mt-1 text-sm text-ink-400">
					Review the orders below before proceeding to Kite
				</p>
			</div>

			<!-- Orders Table -->
			<div class="max-h-96 overflow-y-auto px-6 py-4">
				{#if orders.length === 0}
					<div class="py-8 text-center">
						<p class="text-ink-400">No orders to display</p>
					</div>
				{:else}
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
									Current Price
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
				{/if}
			</div>

			<!-- Footer with Total and Actions -->
			<div class="border-t border-paper-300 bg-paper-50 px-6 py-4">
				<!-- Total Expected Loss -->
				<div class="mb-4 flex items-center justify-between">
					<span class="text-sm font-medium text-ink-500">Total Expected Loss</span>
					<span class="text-xl font-mono font-semibold text-status-loss">
						-{formatCurrency(totalExpectedLoss)}
					</span>
				</div>

				<!-- Warning Message -->
				<div class="mb-4 border-l-2 border-status-warning bg-status-warning-light rounded-paper p-3">
					<div class="flex">
						<svg
							class="h-5 w-5 text-status-warning flex-shrink-0"
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
						<p class="ml-3 text-sm text-ink-500">
							You will be redirected to Kite to execute these orders. Make sure you're logged in to your Zerodha account.
						</p>
					</div>
				</div>

				<!-- Action Buttons -->
				<div class="flex justify-end gap-3">
					<button
						type="button"
						onclick={handleCancel}
						class="rounded-paper border border-ink-200 bg-paper-100 px-4 py-2 text-sm font-medium text-ink-500 shadow-paper-sm transition-colors hover:bg-paper-200 focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 focus:outline-none"
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={handleConfirm}
						disabled={!canProceed}
						class="rounded-paper bg-ink-600 px-4 py-2 text-sm font-medium text-paper-100 shadow-paper-sm transition-colors hover:bg-ink-700 focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					>
						Proceed to Kite
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
