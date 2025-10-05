import { CacheService } from "../src/cache"; // adjust the import path
import * as crypto from "crypto";

interface BenchmarkMetrics {
	totalSetTime: number;
	totalGetTime: number;
	totalExistsTime: number;
	totalFindKeyTime: number;
	totalFindAllKeysTime: number;
	totalStatsTime: number;
	totalHealthTime: number;
	hits: number;
	misses: number;
	existsHits: number;
	existsMisses: number;
	findKeyHits: number;
	findKeyMisses: number;
	setOperations: number;
	getOperations: number;
	existsOperations: number;
	findKeyOperations: number;
	findAllKeysOperations: number;
	statsOperations: number;
	healthOperations: number;
}

async function benchmarkCacheService() {
	const cache = new CacheService("cache_test_dir", 50, 7, 100, "bin"); // 50 MB max size for more data
	
	// Test with different data sizes
	const dataSizes = [
		{ name: "Small", size: 1024 }, // 1 KB
		{ name: "Medium", size: 1024 * 50 }, // 50 KB
		{ name: "Large", size: 1024 * 500 }, // 500 KB
		{ name: "XLarge", size: 1024 * 1024 } // 1 MB
	];

	const iterations = 1000; // Increased iterations
	const windowSize = 500; // Increased window size
	const testKeyPrefix = { id: "testKey", timestamp: Date.now() };

	// Warmup
	console.log("Clearing cache for fresh start...");
	await cache.clearAll();

	// Helper: measure async execution time
	async function measureTimeAsync(fn: () => Promise<any>): Promise<number> {
		const start = process.hrtime.bigint();
		await fn();
		const end = process.hrtime.bigint();
		return Number(end - start) / 1e6; // ms
	}

	// Store keys currently considered "live"
	const liveKeys = new Set<number>();
	const storedData = new Map<number, Buffer>(); // Track what we stored for findKeyByValue tests

	// Initialize metrics
	const metrics: BenchmarkMetrics = {
		totalSetTime: 0,
		totalGetTime: 0,
		totalExistsTime: 0,
		totalFindKeyTime: 0,
		totalFindAllKeysTime: 0,
		totalStatsTime: 0,
		totalHealthTime: 0,
		hits: 0,
		misses: 0,
		existsHits: 0,
		existsMisses: 0,
		findKeyHits: 0,
		findKeyMisses: 0,
		setOperations: 0,
		getOperations: 0,
		existsOperations: 0,
		findKeyOperations: 0,
		findAllKeysOperations: 0,
		statsOperations: 0,
		healthOperations: 0
	};

	console.log(`Starting comprehensive benchmark with ${iterations} iterations...`);
	console.log(`Testing with window size: ${windowSize} live keys`);

	for (let i = 0; i < iterations; i++) {
		// Cycle through different data sizes
		const dataSize = dataSizes[i % dataSizes.length];
		const testData = crypto.randomBytes(dataSize.size);
		const key = { ...testKeyPrefix, i, dataSize: dataSize.name };

		// 1. SET operation
		const setTime = await measureTimeAsync(() => cache.set(key, testData));
		metrics.totalSetTime += setTime;
		metrics.setOperations++;
		liveKeys.add(i);
		storedData.set(i, testData);

		// Remove keys older than windowSize from live keys (simulate eviction candidates)
		if (i >= windowSize) {
			liveKeys.delete(i - windowSize);
			storedData.delete(i - windowSize);
		}

		// 2. GET operation (every 5 iterations)
		if (i % 5 === 0) {
			// Focus on recent keys that are more likely to exist
			const minKey = Math.max(0, i - windowSize);
			const maxKey = i;
			const randomKeyIndex = Math.floor(Math.random() * (maxKey - minKey + 1)) + minKey;
			const dataSize = dataSizes[randomKeyIndex % dataSizes.length];
			const getKey = { ...testKeyPrefix, i: randomKeyIndex, dataSize: dataSize.name };

			const getTime = await measureTimeAsync(async () => {
				const data = await cache.get(getKey);
				if (data) metrics.hits++;
				else metrics.misses++;
			});
			metrics.totalGetTime += getTime;
			metrics.getOperations++;
		}

		// 3. EXISTS operation (every 7 iterations)
		if (i % 7 === 0) {
			// Focus on recent keys that are more likely to exist
			const minKey = Math.max(0, i - windowSize);
			const maxKey = i;
			const randomKeyIndex = Math.floor(Math.random() * (maxKey - minKey + 1)) + minKey;
			const dataSize = dataSizes[randomKeyIndex % dataSizes.length];
			const existsKey = { ...testKeyPrefix, i: randomKeyIndex, dataSize: dataSize.name };

			const existsTime = await measureTimeAsync(async () => {
				const exists = await cache.exists(existsKey);
				if (exists) metrics.existsHits++;
				else metrics.existsMisses++;
			});
			metrics.totalExistsTime += existsTime;
			metrics.existsOperations++;
		}

		// 4. findKeyByValue operation (every 10 iterations)
		if (i % 10 === 0 && storedData.size > 0) {
			const randomStoredIndex = Array.from(storedData.keys())[Math.floor(Math.random() * storedData.size)];
			const searchData = storedData.get(randomStoredIndex)!;

			const findKeyTime = await measureTimeAsync(async () => {
				const foundKey = await cache.findKeyByValue(searchData);
				if (foundKey) metrics.findKeyHits++;
				else metrics.findKeyMisses++;
			});
			metrics.totalFindKeyTime += findKeyTime;
			metrics.findKeyOperations++;
		}

		// 5. findAllKeysByValue operation (every 20 iterations)
		if (i % 20 === 0 && storedData.size > 0) {
			const randomStoredIndex = Array.from(storedData.keys())[Math.floor(Math.random() * storedData.size)];
			const searchData = storedData.get(randomStoredIndex)!;

			const findAllKeysTime = await measureTimeAsync(async () => {
				const foundKeys = await cache.findAllKeysByValue(searchData);
				// Note: We don't track hits/misses for findAllKeys as it can return multiple results
			});
			metrics.totalFindAllKeysTime += findAllKeysTime;
			metrics.findAllKeysOperations++;
		}

		// 6. getStats operation (every 50 iterations)
		if (i % 50 === 0) {
			const statsTime = await measureTimeAsync(async () => {
				const stats = await cache.getStats();
				// Log stats occasionally for monitoring
				if (i % 200 === 0) {
					console.log(`Stats at iteration ${i}: ${stats.entriesCount} entries, ${stats.totalSizeMB.toFixed(2)} MB used`);
				}
			});
			metrics.totalStatsTime += statsTime;
			metrics.statsOperations++;
		}

		// 7. getHealthStatus operation (every 100 iterations)
		if (i % 100 === 0) {
			const healthTime = await measureTimeAsync(async () => {
				const health = await cache.getHealthStatus();
				if (!health.healthy && i % 500 === 0) {
					console.log(`Health issues detected: ${health.issues.join(", ")}`);
				}
			});
			metrics.totalHealthTime += healthTime;
			metrics.healthOperations++;
		}

		// Progress indicator
		if (i % 100 === 0) {
			console.log(`Progress: ${i}/${iterations} (${((i/iterations)*100).toFixed(1)}%)`);
		}
	}

	// Final comprehensive report
	console.log("\n" + "=".repeat(80));
	console.log("COMPREHENSIVE BENCHMARK RESULTS");
	console.log("=".repeat(80));

	// Performance metrics
	console.log("\nPERFORMANCE METRICS:");
	console.log(`Average SET time: ${(metrics.totalSetTime / metrics.setOperations).toFixed(2)} ms (${metrics.setOperations} operations)`);
	console.log(`Average GET time: ${(metrics.totalGetTime / metrics.getOperations).toFixed(2)} ms (${metrics.getOperations} operations)`);
	console.log(`Average EXISTS time: ${(metrics.totalExistsTime / metrics.existsOperations).toFixed(2)} ms (${metrics.existsOperations} operations)`);
	console.log(`Average findKeyByValue time: ${(metrics.totalFindKeyTime / metrics.findKeyOperations).toFixed(2)} ms (${metrics.findKeyOperations} operations)`);
	console.log(`Average findAllKeysByValue time: ${(metrics.totalFindAllKeysTime / metrics.findAllKeysOperations).toFixed(2)} ms (${metrics.findAllKeysOperations} operations)`);
	console.log(`Average getStats time: ${(metrics.totalStatsTime / metrics.statsOperations).toFixed(2)} ms (${metrics.statsOperations} operations)`);
	console.log(`Average getHealthStatus time: ${(metrics.totalHealthTime / metrics.healthOperations).toFixed(2)} ms (${metrics.healthOperations} operations)`);

	// Hit rate metrics
	console.log("\nHIT RATE METRICS:");
	const totalGets = metrics.hits + metrics.misses;
	const totalExists = metrics.existsHits + metrics.existsMisses;
	const totalFindKey = metrics.findKeyHits + metrics.findKeyMisses;
	
	console.log(`GET hit rate: ${metrics.hits}/${totalGets} (${totalGets > 0 ? (metrics.hits / totalGets * 100).toFixed(2) : 0}%)`);
	console.log(`EXISTS hit rate: ${metrics.existsHits}/${totalExists} (${totalExists > 0 ? (metrics.existsHits / totalExists * 100).toFixed(2) : 0}%)`);
	console.log(`findKeyByValue hit rate: ${metrics.findKeyHits}/${totalFindKey} (${totalFindKey > 0 ? (metrics.findKeyHits / totalFindKey * 100).toFixed(2) : 0}%)`);

	// Final cache statistics
	console.log("\nFINAL CACHE STATISTICS:");
	const finalStats = await cache.getStats();
	console.log(`Total entries: ${finalStats.entriesCount}`);
	console.log(`Total size: ${finalStats.totalSizeMB.toFixed(2)} MB / ${finalStats.maxSizeMB} MB (${finalStats.usagePercentage}%)`);
	console.log(`Total accesses: ${finalStats.totalAccesses}`);
	console.log(`Average accesses per entry: ${finalStats.averageAccessesPerEntry}`);
	console.log(`Oldest entry: ${finalStats.oldestEntryDate}`);
	console.log(`Newest entry: ${finalStats.newestEntryDate}`);

	console.log("\n" + "=".repeat(80));
	console.log("Benchmark completed successfully!");
	console.log("=".repeat(80));

	// Cleanup: Force metadata save and destroy cache to ensure clean state
	console.log("\nPerforming final cleanup...");
	await cache.destroy();
	console.log("Cache cleanup completed!");

	// Final health check after cleanup
	console.log("\nFINAL HEALTH CHECK (after cleanup):");
	const finalHealth = await cache.getHealthStatus();
	console.log(`Cache healthy: ${finalHealth.healthy ? "Yes" : "No"}`);
	console.log(`Metadata consistency: ${finalHealth.metadataConsistency}%`);
	console.log(`Files on disk: ${finalHealth.filesOnDisk}`);
	console.log(`Metadata entries: ${finalHealth.metadataEntries}`);
	console.log(`Orphaned files: ${finalHealth.orphanedFiles}`);
	console.log(`Corrupted metadata: ${finalHealth.corruptedMetadata}`);
	if (finalHealth.issues.length > 0) {
		console.log(`Issues found: ${finalHealth.issues.join(", ")}`);
	} else {
		console.log("No issues found - cache is in perfect health!");
	}
}

benchmarkCacheService().catch(console.error);
