import { CacheService } from "../src/cache"; // adjust the import path
import * as crypto from "crypto";

async function benchmarkCacheService() {
	const cache = new CacheService("cache_test_dir", 10, 7, 100, "bin"); // 10 MB max size
	const testKey = { id: "testKey", timestamp: Date.now() };
	const testData = crypto.randomBytes(1024 * 50); // 50 KB buffer

	const windowSize = 200; // max live keys at a time
	const iterations = 100;

	// Warmup
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

	// Metrics
	let totalSetTime = 0;
	let totalGetTime = 0;
	let hits = 0;
	let misses = 0;

	for (let i = 0; i < iterations; i++) {
		// Add new key
		const key = { ...testKey, i };
		const setTime = await measureTimeAsync(() => cache.set(key, testData));
		totalSetTime += setTime;
		liveKeys.add(i);

		// Remove keys older than windowSize from live keys (simulate eviction candidates)
		if (i >= windowSize) {
			liveKeys.delete(i - windowSize);
		}

		// Occasionally do get on random keys from within and outside liveKeys
		if (i % 10 === 0) { 
			// Pick random key in [i - windowSize*2, i]
			const minKey = Math.max(0, i - windowSize * 2);
			const maxKey = i;
			const randomKeyIndex = Math.floor(Math.random() * (maxKey - minKey + 1)) + minKey;
			const getKey = { ...testKey, i: randomKeyIndex };

			const getTime = await measureTimeAsync(async () => {
				const data = await cache.get(getKey);
				if (data) hits++;
				else misses++;
			});
			totalGetTime += getTime;
		}
	}

	console.log(`Average set time: ${(totalSetTime / iterations).toFixed(2)} ms`);
	console.log(`Average get time: ${(totalGetTime / (iterations / 10)).toFixed(2)} ms`);
	console.log(`Cache hits: ${hits}, misses: ${misses}, hit rate: ${(hits / (hits + misses) * 100).toFixed(2)}%`);
}

benchmarkCacheService().catch(console.error);
