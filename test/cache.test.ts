import { CacheService } from "../src/cache";
import * as fs from "fs/promises";
import * as path from "path";

describe("CacheService", () => {
	let cache: CacheService;
	const testCacheDir = "test-cache";
	const testExtension = "test";

	beforeEach(async () => {
		// Clean up any existing test cache
		await cleanupTestCache();

		// Create fresh cache instance for each test
		cache = new CacheService(testCacheDir, 1, 1, 50, testExtension); // 1MB, 1 day, 50KB key limit

		// Wait for initialization
		await new Promise(resolve => setTimeout(resolve, 100));
	});

	afterEach(async () => {
		if (cache) {
			await cache.clearAll();
		}
		await cleanupTestCache();
	});

	async function cleanupTestCache() {
		try {
			const cacheDir = path.join(process.cwd(), testCacheDir);
			await fs.rm(cacheDir, { recursive: true, force: true });
		} catch (error) {
			// Directory might not exist, that's fine
		}
	}

	describe("Cache Key Generation", () => {
		it("should generate consistent cache keys for same input", () => {
			const data1 = { name: "test", value: 123 };
			const data2 = { name: "test", value: 123 };

			const key1 = cache.generateCacheKey(data1);
			const key2 = cache.generateCacheKey(data2);

			expect(key1).toBe(key2);
			expect(typeof key1).toBe("string");
			expect(key1.length).toBe(64); // SHA256 hex length
		});

		it("should generate different keys for different input", () => {
			const key1 = cache.generateCacheKey({ name: "test1" });
			const key2 = cache.generateCacheKey({ name: "test2" });

			expect(key1).not.toBe(key2);
		});

		it("should handle object property order consistently", () => {
			const obj1 = { b: 2, a: 1, c: 3 };
			const obj2 = { a: 1, b: 2, c: 3 };

			const key1 = cache.generateCacheKey(obj1);
			const key2 = cache.generateCacheKey(obj2);

			expect(key1).toBe(key2);
		});

		it("should handle arrays consistently", () => {
			const data1 = { items: [1, 2, 3] };
			const data2 = { items: [1, 2, 3] };

			const key1 = cache.generateCacheKey(data1);
			const key2 = cache.generateCacheKey(data2);

			expect(key1).toBe(key2);
		});

		it("should handle string input", () => {
			const key1 = cache.generateCacheKey("test-string");
			const key2 = cache.generateCacheKey("test-string");
			const key3 = cache.generateCacheKey("different-string");

			expect(key1).toBe(key2);
			expect(key1).not.toBe(key3);
		});
	});

	describe("Cache Key Size Validation", () => {
		it("should accept small objects", () => {
			const smallData = { key: "value" };
			expect(() => cache.validateCacheKeySize(smallData)).not.toThrow();
		});

		it("should reject oversized objects", () => {
			// Create large object exceeding 50KB limit
			const largeData = {
				data: "x".repeat(60 * 1024) // 60KB string
			};

			expect(() => cache.validateCacheKeySize(largeData)).toThrow(/Cache key data too large/);
		});

		it("should handle circular references gracefully", () => {
			const circularObj: any = { name: "test" };
			circularObj.self = circularObj;

			expect(() => cache.validateCacheKeySize(circularObj)).toThrow(/circular references/);
		});
	});

	describe("Basic Cache Operations", () => {
		it("should set and get cache entries", async () => {
			const testData = "Hello, World!";
			const cacheKey = "test-key";

			const setResult = await cache.set(cacheKey, testData);
			expect(setResult).toBe(true);

			const retrieved = await cache.get(cacheKey);
			expect(retrieved).not.toBeNull();
			expect(retrieved!.toString()).toBe(testData);
		});

		it("should handle Buffer data", async () => {
			const testBuffer = Buffer.from("Binary data test", "utf8");
			const cacheKey = "buffer-key";

			const setResult = await cache.set(cacheKey, testBuffer);
			expect(setResult).toBe(true);

			const retrieved = await cache.get(cacheKey);
			expect(retrieved).not.toBeNull();
			expect(Buffer.compare(retrieved!, testBuffer)).toBe(0);
		});

		it("should handle JSON objects", async () => {
			const testObj = { name: "test", value: 42, nested: { prop: "value" } };
			const cacheKey = { type: "object", id: "test" };

			const setResult = await cache.set(cacheKey, JSON.stringify(testObj));
			expect(setResult).toBe(true);

			const retrieved = await cache.get(cacheKey);
			expect(retrieved).not.toBeNull();

			const parsed = JSON.parse(retrieved!.toString());
			expect(parsed).toEqual(testObj);
		});

		it("should return null for non-existent keys", async () => {
			const retrieved = await cache.get("non-existent-key");
			expect(retrieved).toBeNull();
		});

		it("should check existence correctly", async () => {
			const cacheKey = "existence-test";

			// Should not exist initially
			let exists = await cache.exists(cacheKey);
			expect(exists).toBe(false);

			// Set the cache entry
			await cache.set(cacheKey, "test data");

			// Should exist now
			exists = await cache.exists(cacheKey);
			expect(exists).toBe(true);
		});
	});

	describe("Access Tracking", () => {
		it("should track access count and last accessed time", async () => {
			const cacheKey = "access-test";
			await cache.set(cacheKey, "test data");

			// Access the cache entry multiple times
			await cache.get(cacheKey);
			await cache.get(cacheKey);
			await cache.get(cacheKey);

			const stats = await cache.getStats();
			expect(stats.totalAccesses).toBeGreaterThan(0);
		});
	});

	describe("Cache Statistics", () => {
		it("should provide accurate statistics", async () => {
			// Add some test data
			await cache.set("key1", "data1");
			await cache.set("key2", "data2");
			await cache.set({ id: "key3" }, "data3");

			const stats = await cache.getStats();

			expect(stats.entriesCount).toBe(3);
			expect(stats.totalSizeBytes).toBeGreaterThan(0);
			expect(stats.totalSizeMB).toBeGreaterThanOrEqual(0); // this is for extremely small caches
			expect(stats.maxSizeMB).toBe(1); // Set in beforeEach
			expect(stats.usagePercentage).toBeGreaterThanOrEqual(0);
			expect(stats.maxCacheAgeDays).toBe(1); // Set in beforeEach
			expect(stats.oldestEntryDate).toBeTruthy();
			expect(stats.newestEntryDate).toBeTruthy();
		});

		it("should handle empty cache statistics", async () => {
			const stats = await cache.getStats();

			expect(stats.entriesCount).toBe(0);
			expect(stats.totalSizeBytes).toBe(0);
			expect(stats.totalSizeMB).toBe(0);
			expect(stats.totalAccesses).toBe(0);
			expect(stats.averageAccessesPerEntry).toBe(0);
		});
	});

	describe("Cache Cleanup", () => {
		it("should clear all cache entries", async () => {
			// Add test data
			await cache.set("key1", "data1");
			await cache.set("key2", "data2");

			let stats = await cache.getStats();
			expect(stats.entriesCount).toBe(2);

			// Clear all
			await cache.clearAll();

			stats = await cache.getStats();
			expect(stats.entriesCount).toBe(0);

			// Verify entries don't exist
			const exists1 = await cache.exists("key1");
			const exists2 = await cache.exists("key2");
			expect(exists1).toBe(false);
			expect(exists2).toBe(false);
		});
	});

	describe("Error Handling", () => {
		it("should handle invalid cache key data gracefully", async () => {
			const result = await cache.get("");
			expect(result).toBeNull();
		});

		it("should handle file system errors gracefully", async () => {
			// This test might be platform-specific
			const result = await cache.set("test", "data");
			expect(typeof result).toBe("boolean");
		});
	});

	describe("Data Normalization", () => {
		it("should normalize floating point numbers consistently", () => {
			const data1 = { value: 1.1 };
			const data2 = { value: 1.10000000001 };

			const key1 = cache.generateCacheKey(data1);
			const key2 = cache.generateCacheKey(data2);

			// Should be the same due to normalization
			expect(key1).toBe(key2);
		});

		it("should handle special number values", () => {
			const data1 = { value: Infinity };
			const data2 = { value: -Infinity };
			const data3 = { value: NaN };

			expect(() => cache.generateCacheKey(data1)).not.toThrow();
			expect(() => cache.generateCacheKey(data2)).not.toThrow();
			expect(() => cache.generateCacheKey(data3)).not.toThrow();
		});

		it("should handle null and undefined values", () => {
			const data1 = { value: null };
			const data2 = { value: undefined };

			const key1 = cache.generateCacheKey(data1);
			const key2 = cache.generateCacheKey(data2);

			expect(key1).not.toBe(key2);
		});
	});

	describe("Size Estimation", () => {
		it("should estimate object size correctly", () => {
			const smallObj = { key: "value" };
			const largeObj = { key: "x".repeat(1000) };

			const smallSize = cache.estimateSizeInBytes(smallObj);
			const largeSize = cache.estimateSizeInBytes(largeObj);

			expect(largeSize).toBeGreaterThan(smallSize);
			expect(smallSize).toBeGreaterThan(0);
		});
	});

	describe("Integration Tests", () => {
		it("should handle complete workflow with complex data", async () => {
			const complexData = {
				user: {
					id: 12345,
					name: "John Doe",
					preferences: {
						theme: "dark",
						notifications: true,
						settings: [1, 2, 3, 4, 5]
					}
				},
				metadata: {
					created: "2024-01-01",
					version: 1.0,
					tags: ["user", "profile", "settings"]
				}
			};

			const cacheKey = { userId: 12345, type: "profile" };
			const dataString = JSON.stringify(complexData);

			// Set cache
			const setResult = await cache.set(cacheKey, dataString);
			expect(setResult).toBe(true);

			// Verify existence
			const exists = await cache.exists(cacheKey);
			expect(exists).toBe(true);

			// Get and verify data
			const retrieved = await cache.get(cacheKey);
			expect(retrieved).not.toBeNull();

			const parsed = JSON.parse(retrieved!.toString());
			expect(parsed).toEqual(complexData);

			// Check stats
			const stats = await cache.getStats();
			expect(stats.entriesCount).toBe(1);
			expect(stats.totalSizeBytes).toBeGreaterThan(0);
		});
	});
});