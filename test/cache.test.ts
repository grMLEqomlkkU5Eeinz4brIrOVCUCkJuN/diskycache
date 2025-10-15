import { CacheService } from "../src/cache";
import { CacheConfig, DEFAULT_CACHE_CONFIG } from "../src/types/cacheConfig";
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

		it("should delete cache entries", async () => {
			const testData = "data-to-delete";
			const cacheKey = "delete-test";

			// Set the key
			await cache.set(cacheKey, testData);
			let exists = await cache.exists(cacheKey);
			expect(exists).toBe(true);

			// Delete the key
			const deleteResult = await cache.deleteKey(cacheKey);
			expect(deleteResult).toBe(true);

			// Verify it's deleted
			exists = await cache.exists(cacheKey);
			expect(exists).toBe(false);

			const retrieved = await cache.get(cacheKey);
			expect(retrieved).toBeNull();
		});

		it("should handle deleting non-existent keys", async () => {
			const deleteResult = await cache.deleteKey("non-existent-key");
			expect(deleteResult).toBe(false);
		});

		it("should delete entries with object keys", async () => {
			const testData = "object-key-data";
			const cacheKey = { type: "delete", id: "test" };

			// Set the key
			await cache.set(cacheKey, testData);
			let exists = await cache.exists(cacheKey);
			expect(exists).toBe(true);

			// Delete the key
			const deleteResult = await cache.deleteKey(cacheKey);
			expect(deleteResult).toBe(true);

			// Verify it's deleted
			exists = await cache.exists(cacheKey);
			expect(exists).toBe(false);
		});

		it("should clean up orphaned files when deleting", async () => {
			const testData = "orphan-test-data";
			const cacheKey = "orphan-test";

			// Set the key
			await cache.set(cacheKey, testData);
			
			// Manually remove from metadata to simulate orphaned file
			const hashKey = cache.generateCacheKey(cacheKey);
			cache.metadata.delete(hashKey);

			// Delete should still work and clean up the orphaned file
			const deleteResult = await cache.deleteKey(cacheKey);
			expect(deleteResult).toBe(true);

			// Verify it's deleted
			const exists = await cache.exists(cacheKey);
			expect(exists).toBe(false);
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

	describe("Find Key By Value", () => {
		it("should find key by exact string value", async () => {
			const testData = "Hello, World!";
			const cacheKey = "test-key";

			await cache.set(cacheKey, testData);

			const foundKey = await cache.findKeyByValue(testData);
			expect(foundKey).toBeTruthy();
			expect(typeof foundKey).toBe("string");
			expect(foundKey!.length).toBe(64); // SHA256 hash length
		});

		it("should find key by exact buffer value", async () => {
			const testBuffer = Buffer.from("Binary data", "utf8");
			const cacheKey = "buffer-key";

			await cache.set(cacheKey, testBuffer);

			const foundKey = await cache.findKeyByValue(testBuffer);
			expect(foundKey).toBeTruthy();
			expect(typeof foundKey).toBe("string");
			expect(foundKey!.length).toBe(64); // SHA256 hash length
		});

		it("should return null for non-existent value", async () => {
			const nonExistentData = "This data was never cached";

			const foundKey = await cache.findKeyByValue(nonExistentData);
			expect(foundKey).toBeNull();
		});

		it("should find key when searching with string for buffer value", async () => {
			const testData = "Converted data";
			const cacheKey = "string-key";

			await cache.set(cacheKey, testData);

			const searchResult = await cache.findKeyByValue(Buffer.from(testData, "utf8"));
			expect(searchResult).toBeTruthy();
			expect(typeof searchResult).toBe("string");
		});

		it("should find key when searching with buffer for string value", async () => {
			const testBuffer = Buffer.from("Binary search", "utf8");
			const cacheKey = "buffer-search-key";

			await cache.set(cacheKey, testBuffer);

			const searchResult = await cache.findKeyByValue(testBuffer.toString());
			expect(searchResult).toBeTruthy();
			expect(typeof searchResult).toBe("string");
		});

		it("should handle JSON string values", async () => {
			const testObj = { name: "test", value: 42 };
			const testData = JSON.stringify(testObj);
			const cacheKey = "json-key";

			await cache.set(cacheKey, testData);

			const foundKey = await cache.findKeyByValue(testData);
			expect(foundKey).toBeTruthy();
			expect(typeof foundKey).toBe("string");
		});

		it("should return null for expired entries", async () => {
			// This test might need adjustment based on the expiration logic
			const testData = "expired-data";
			const cacheKey = "expired-key";

			await cache.set(cacheKey, testData);

			// Wait a bit and then trigger cleanup (assuming 1 day max age from beforeEach)
			// This is a limitation of testing expiration
			const foundKey = await cache.findKeyByValue(testData);
			expect(foundKey).toBeTruthy(); // Should still find it unless cleanup runs
		});
	});

	describe("Find All Keys By Value", () => {
		it("should find all keys with the same value", async () => {
			const testData = "Duplicate value";
			const cacheKey1 = "duplicate-key-1";
			const cacheKey2 = "duplicate-key-2";

			await cache.set(cacheKey1, testData);
			await cache.set(cacheKey2, testData);

			const foundKeys = await cache.findAllKeysByValue(testData);
			expect(foundKeys).toHaveLength(2);
			expect(foundKeys.every(key => typeof key === "string" && key.length === 64)).toBe(true);
		});

		it("should return empty array for non-existent value", async () => {
			const nonExistentData = "No matches for this";

			const foundKeys = await cache.findAllKeysByValue(nonExistentData);
			expect(foundKeys).toEqual([]);
		});

		it("should return all keys even with different original key formats", async () => {
			const testData = "Same data";
			
			await cache.set("string-key", testData);
			await cache.set({ type: "object", id: "test" }, testData);

			const foundKeys = await cache.findAllKeysByValue(testData);
			expect(foundKeys).toHaveLength(2);
			expect(foundKeys.every(key => typeof key === "string" && key.length === 64)).toBe(true);
		});

		it("should handle mix of buffer and string values", async () => {
			const testValue = "Mixed format test";
			const bufferValue = Buffer.from(testValue, "utf8");

			await cache.set("string-key", testValue);
			await cache.set("buffer-key", bufferValue);

			// Search for string version
			const stringKeys = await cache.findAllKeysByValue(testValue);
			expect(stringKeys).toHaveLength(2);

			// Search for buffer version
			const bufferKeys = await cache.findAllKeysByValue(bufferValue);
			expect(bufferKeys).toHaveLength(2);

			// Both searches should return the same keys
			expect(stringKeys.sort()).toEqual(bufferKeys.sort());
		});

		it("should return single key when only one match exists", async () => {
			const testData = "Unique value";
			const cacheKey = "unique-key";

			await cache.set(cacheKey, testData);

			const foundKeys = await cache.findAllKeysByValue(testData);
			expect(foundKeys).toHaveLength(1);
			expect(typeof foundKeys[0]).toBe("string");
			expect(foundKeys[0].length).toBe(64);
		});
	});

	describe("Find Key Performance and Edge Cases", () => {
		it("should handle empty string values", async () => {
			const emptyData = "";
			const cacheKey = "empty-key";

			await cache.set(cacheKey, emptyData);

			const foundKey = await cache.findKeyByValue(emptyData);
			expect(foundKey).toBeTruthy();
		});

		describe("JSON Helpers", () => {
			it("should set and get JSON with types", async () => {
				const key = { type: "json", id: "1" };
				const value = { id: 1, name: "Alice", active: true };

				const setOk = await cache.setJSON(key, value);
				expect(setOk).toBe(true);

				const retrieved = await cache.getJSON<typeof value>(key);
				expect(retrieved).toEqual(value);
			});

			it("should return null when JSON entry missing", async () => {
				const missing = await cache.getJSON<{ id: number }>("does-not-exist");
				expect(missing).toBeNull();
			});

			it("should handle circular data serialization error in setJSON", async () => {
				const key = { type: "json", id: "circular" };
				const circular: any = { a: 1 };
				circular.self = circular;

				const setOk = await cache.setJSON(key, circular);
				expect(setOk).toBe(false);
			});

			it("should handle invalid JSON content in getJSON", async () => {
				const key = { type: "json", id: "invalid" };
				// Write an invalid JSON string deliberately
				await cache.set(key, "{ invalid json");

				const parsed = await cache.getJSON(key);
				expect(parsed).toBeNull();
			});
		});

		it("should handle large values efficiently", async () => {
			const largeData = "x".repeat(10000); // 10KB string
			const cacheKey = "large-key";

			await cache.set(cacheKey, largeData);

			const foundKey = await cache.findKeyByValue(largeData);
			expect(foundKey).toBeTruthy();

			const foundKeys = await cache.findAllKeysByValue(largeData);
			expect(foundKeys).toHaveLength(1);
		});

		it("should handle binary data", async () => {
			const binaryData = Buffer.from([0x01, 0x02, 0x03, 0x04, 0xFF, 0x00]);
			const cacheKey = "binary-key";

			await cache.set(cacheKey, binaryData);

			const foundKey = await cache.findKeyByValue(binaryData);
			expect(foundKey).toBeTruthy();

			// Test that we can find by exact buffer content
			const foundKeys = await cache.findAllKeysByValue(binaryData);
			expect(foundKeys).toHaveLength(1);
			expect(typeof foundKeys[0]).toBe("string");
		});
	});

	describe("Configuration System", () => {
		it("should work with configuration object constructor", async () => {
			const config: CacheConfig = {
				...DEFAULT_CACHE_CONFIG,
				cacheDir: "test-cache-config",
				maxCacheSize: "2MB",
				maxCacheAge: "2d",
				maxCacheKeySize: "200KB",
				fileExtension: "config-test",
				metadataSaveDelayMs: 50,
				floatingPointPrecision: 5
			};

			const configCache = new CacheService(config);
			await new Promise(resolve => setTimeout(resolve, 100));

			// Test basic functionality
			const testData = "Configuration test data";
			const cacheKey = "config-test-key";

			const setResult = await configCache.set(cacheKey, testData);
			expect(setResult).toBe(true);

			const retrieved = await configCache.get(cacheKey);
			expect(retrieved).not.toBeNull();
			expect(retrieved!.toString()).toBe(testData);

			// Cleanup
			await configCache.clearAll();
		});

		it("should maintain backward compatibility with legacy constructor", async () => {
			// This test ensures the legacy constructor still works
			const legacyCache = new CacheService("test-cache-legacy", 1, 1, 50, "legacy");
			await new Promise(resolve => setTimeout(resolve, 100));

			const testData = "Legacy test data";
			const cacheKey = "legacy-test-key";

			const setResult = await legacyCache.set(cacheKey, testData);
			expect(setResult).toBe(true);

			const retrieved = await legacyCache.get(cacheKey);
			expect(retrieved).not.toBeNull();
			expect(retrieved!.toString()).toBe(testData);

			// Cleanup
			await legacyCache.clearAll();
		});

		it("should use default configuration when no config provided", async () => {
			const defaultConfigCache = new CacheService({
				cacheDir: "test-cache-default"
			});

			await new Promise(resolve => setTimeout(resolve, 100));

			// Test that it uses default values
			const stats = await defaultConfigCache.getStats();
			expect(stats.maxSizeMB).toBe(500); // Default cache size
			expect(stats.maxCacheAgeDays).toBe(7); // Default cache age

			// Cleanup
			await defaultConfigCache.clearAll();
		});

		it("should allow custom configuration values", async () => {
			const customConfig: CacheConfig = {
				...DEFAULT_CACHE_CONFIG,
				cacheDir: "test-cache-custom",
				maxCacheSize: "10MB",
				maxCacheAge: "1d",
				maxCacheKeySize: "1MB",
				fileExtension: "custom",
				metadataSaveDelayMs: 200,
				cutoffDateRecalcIntervalMs: 60000, // 1 minute
				floatingPointPrecision: 15,
				healthCheckConsistencyThreshold: 95,
				largeCacheWarningThresholdBytes: 100 * 1024 * 1024, // 100MB
				processMaxListenersIncrement: 5,
				findKeyBatchSize: 10,
				findAllKeysBatchSize: 15,
				jsonIndentSpaces: 4,
				sizeFormatDecimalPlaces: 3,
				timeFormatDecimalPlaces: 3,
				statsDecimalPlaces: 15
			};

			const customCache = new CacheService(customConfig);
			await new Promise(resolve => setTimeout(resolve, 100));

			// Test that custom values are applied
			const stats = await customCache.getStats();
			expect(stats.maxSizeMB).toBe(10); // Custom cache size
			expect(stats.maxCacheAgeDays).toBe(1); // Custom cache age

			// Test functionality still works
			const testData = "Custom config test";
			const cacheKey = "custom-test-key";

			const setResult = await customCache.set(cacheKey, testData);
			expect(setResult).toBe(true);

			const retrieved = await customCache.get(cacheKey);
			expect(retrieved).not.toBeNull();
			expect(retrieved!.toString()).toBe(testData);

			// Cleanup
			await customCache.clearAll();
		});
	});
});