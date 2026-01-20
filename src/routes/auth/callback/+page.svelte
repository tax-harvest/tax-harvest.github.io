<!--
  Auth callback loading page
  Shows a loading state while the OAuth code is being exchanged
  This page should rarely be seen as the +page.ts redirect happens quickly
-->
<script lang="ts">
	// This component displays while the auth callback is processing
	// The actual work happens in +page.ts which should redirect immediately
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50">
	<div class="text-center">
		<div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-blue-600 mb-4"></div>
		<p class="text-gray-600">Completing sign in...</p>
	</div>
</div>
