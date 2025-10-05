import { CacheService } from "../src/cache";
import * as fs from "fs/promises";
import * as path from "path";

describe("Metadata Persistence Tests", () => {
	const testDir = "test-metadata-persistence";
	const jsonCacheDir = path.join(testDir, "json-cache");
	const binCacheDir = path.join(testDir, "bin-cache");

	beforeAll(async () => {
		// Create test directories
		await fs.mkdir(jsonCacheDir, { recursive: true });
		await fs.mkdir(binCacheDir, { recursive: true });
	});

	afterAll(async () => {
		// Clean up test directories
		try {
			await fs.rm(testDir, { recursive: true, force: true });
		} catch (error) {
			// Ignore cleanup errors
		}
	});

	describe("JSON Cache Extension", () => {
		let jsonCache: CacheService;

		beforeEach(async () => {
			jsonCache = new CacheService({
				cacheDir: jsonCacheDir,
				maxCacheSize: "10MB",
				maxCacheAge: "1d",
				maxCacheKeySize: "1KB",
				fileExtension: "json"
			});
			// Wait for initialization
			await new Promise(resolve => setTimeout(resolve, 100));
		});

		afterEach(async () => {
			// Don't destroy the cache to preserve files for inspection
			// await jsonCache.destroy();
		});

		it("should not create metadata.json when cache is empty", async () => {
			const metadataFile = path.join(jsonCacheDir, "metadata.json");
			
			// Wait a bit to ensure no pending saves
			await new Promise(resolve => setTimeout(resolve, 200));
			
			const exists = await fs.access(metadataFile).then(() => true).catch(() => false);
			expect(exists).toBe(false);
		});

		it("should create metadata.json when data is added", async () => {
			const metadataFile = path.join(jsonCacheDir, "metadata.json");
			
			// Add some data
			await jsonCache.set("test-key-1", JSON.stringify({ name: "test", value: 123 }));
			
			// Wait for metadata save
			await new Promise(resolve => setTimeout(resolve, 200));
			
			const exists = await fs.access(metadataFile).then(() => true).catch(() => false);
			expect(exists).toBe(true);
			
			if (exists) {
				const content = await fs.readFile(metadataFile, "utf8");
				const metadata = JSON.parse(content);
				expect(Array.isArray(metadata)).toBe(true);
				expect(metadata.length).toBe(1);
				expect(metadata[0][0]).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hash
			}
		});

		it("should persist metadata across cache operations", async () => {
			const metadataFile = path.join(jsonCacheDir, "metadata.json");
			
			// Add multiple entries
			await jsonCache.set("user:1", JSON.stringify({ id: 1, name: "Alice" }));
			await jsonCache.set("user:2", JSON.stringify({ id: 2, name: "Bob" }));
			await jsonCache.set("config", JSON.stringify({ theme: "dark", lang: "en" }));
			
			// Wait for metadata save
			await new Promise(resolve => setTimeout(resolve, 200));
			
			const exists = await fs.access(metadataFile).then(() => true).catch(() => false);
			expect(exists).toBe(true);
			
			if (exists) {
				const content = await fs.readFile(metadataFile, "utf8");
				const metadata = JSON.parse(content);
				expect(metadata.length).toBeGreaterThanOrEqual(3);
				
				// Verify all entries have proper structure
				for (const [hash, entry] of metadata) {
					expect(typeof hash).toBe("string");
					expect(hash).toMatch(/^[a-f0-9]{64}$/);
					expect(typeof entry).toBe("object");
					expect(entry).toHaveProperty("key");
					expect(entry).toHaveProperty("createdAt");
					expect(entry).toHaveProperty("lastAccessed");
					expect(entry).toHaveProperty("dataSize");
					expect(entry).toHaveProperty("accessCount");
				}
			}
		});

		it("should remove metadata.json when cache is cleared", async () => {
			const metadataFile = path.join(jsonCacheDir, "metadata.json");
			
			// Add some data first
			await jsonCache.set("temp-key", JSON.stringify({ temp: true }));
			await new Promise(resolve => setTimeout(resolve, 200));
			
			// Verify metadata exists
			const existsBefore = await fs.access(metadataFile).then(() => true).catch(() => false);
			expect(existsBefore).toBe(true);
			
			// Clear the cache
			await jsonCache.clearAll();
			await new Promise(resolve => setTimeout(resolve, 200));
			
			// Verify metadata is removed
			const existsAfter = await fs.access(metadataFile).then(() => true).catch(() => false);
			expect(existsAfter).toBe(false);
		});

		it("should handle metadata file corruption gracefully", async () => {
			const metadataFile = path.join(jsonCacheDir, "metadata.json");
			
			// Create a corrupted metadata file
			await fs.writeFile(metadataFile, "invalid json content");
			
			// Create new cache instance - should handle corruption gracefully
			const newCache = new CacheService({
				cacheDir: jsonCacheDir,
				maxCacheSize: "10MB",
				maxCacheAge: "1d",
				maxCacheKeySize: "1KB",
				fileExtension: "json"
			});
			
			await new Promise(resolve => setTimeout(resolve, 100));
			
			// Should work normally despite corrupted metadata
			await newCache.set("recovery-test", JSON.stringify({ recovered: true }));
			await new Promise(resolve => setTimeout(resolve, 200));
			
			// Should have created new metadata file
			const exists = await fs.access(metadataFile).then(() => true).catch(() => false);
			expect(exists).toBe(true);
			
			if (exists) {
				const content = await fs.readFile(metadataFile, "utf8");
				const metadata = JSON.parse(content);
				expect(metadata.length).toBe(1);
			}
		});
	});

	describe("Binary Cache Extension", () => {
		let binCache: CacheService;

		beforeEach(async () => {
			binCache = new CacheService({
				cacheDir: binCacheDir,
				maxCacheSize: "10MB",
				maxCacheAge: "1d",
				maxCacheKeySize: "1KB",
				fileExtension: "bin"
			});
			// Wait for initialization
			await new Promise(resolve => setTimeout(resolve, 100));
		});

		afterEach(async () => {
			// Don't destroy the cache to preserve files for inspection
			// await binCache.destroy();
		});

		it("should not create metadata.json when cache is empty", async () => {
			const metadataFile = path.join(binCacheDir, "metadata.json");
			
			// Wait a bit to ensure no pending saves
			await new Promise(resolve => setTimeout(resolve, 200));
			
			const exists = await fs.access(metadataFile).then(() => true).catch(() => false);
			expect(exists).toBe(false);
		});

		it("should create metadata.json when binary data is added", async () => {
			const metadataFile = path.join(binCacheDir, "metadata.json");
			
			// Add binary data
			const binaryData = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]);
			await binCache.set("binary-key", binaryData);
			
			// Wait for metadata save
			await new Promise(resolve => setTimeout(resolve, 200));
			
			const exists = await fs.access(metadataFile).then(() => true).catch(() => false);
			expect(exists).toBe(true);
			
			if (exists) {
				const content = await fs.readFile(metadataFile, "utf8");
				const metadata = JSON.parse(content);
				expect(Array.isArray(metadata)).toBe(true);
				expect(metadata.length).toBe(1);
				expect(metadata[0][1].dataSize).toBe(5); // Binary data size
			}
		});

		it("should persist metadata for mixed data types", async () => {
			const metadataFile = path.join(binCacheDir, "metadata.json");
			
			// Add different types of data
			await binCache.set("string-data", "Hello World");
			await binCache.set("json-data", JSON.stringify({ type: "object", data: [1, 2, 3] }));
			await binCache.set("binary-data", Buffer.from([0xFF, 0xFE, 0xFD]));
			
			// Wait for metadata save
			await new Promise(resolve => setTimeout(resolve, 200));
			
			const exists = await fs.access(metadataFile).then(() => true).catch(() => false);
			expect(exists).toBe(true);
			
			if (exists) {
				const content = await fs.readFile(metadataFile, "utf8");
				const metadata = JSON.parse(content);
				expect(metadata.length).toBeGreaterThanOrEqual(3);
				
				// Verify data sizes are correct
				const sizes = metadata.map(([, entry]) => entry.dataSize);
				expect(sizes).toContain(11); // "Hello World"
				expect(sizes).toContain(3);  // Binary data
				expect(sizes).toContain(JSON.stringify({ type: "object", data: [1, 2, 3] }).length);
			}
		});

		it("should handle large binary data correctly", async () => {
			const metadataFile = path.join(binCacheDir, "metadata.json");
			
			// Create large binary data (1MB)
			const largeData = Buffer.alloc(1024 * 1024, 0x42);
			await binCache.set("large-binary", largeData);
			
			// Wait for metadata save
			await new Promise(resolve => setTimeout(resolve, 200));
			
			const exists = await fs.access(metadataFile).then(() => true).catch(() => false);
			expect(exists).toBe(true);
			
			if (exists) {
				const content = await fs.readFile(metadataFile, "utf8");
				const metadata = JSON.parse(content);
				expect(metadata.length).toBeGreaterThanOrEqual(1);
				
				// Find the large binary entry
				const largeEntry = metadata.find(([, entry]) => entry.dataSize === 1024 * 1024);
				expect(largeEntry).toBeDefined();
				expect(largeEntry[1].dataSize).toBe(1024 * 1024);
			}
		});
	});

	describe("Cross-Extension Compatibility", () => {
		it("should maintain separate metadata files for different extensions", async () => {
			const jsonMetadataFile = path.join(jsonCacheDir, "metadata.json");
			const binMetadataFile = path.join(binCacheDir, "metadata.json");
			
			// Create caches with different extensions
			const jsonCache = new CacheService({
				cacheDir: jsonCacheDir,
				fileExtension: "json"
			});
			
			const binCache = new CacheService({
				cacheDir: binCacheDir,
				fileExtension: "bin"
			});
			
			await new Promise(resolve => setTimeout(resolve, 100));
			
			// Add data to both caches
			await jsonCache.set("json-only", JSON.stringify({ format: "json" }));
			await binCache.set("bin-only", Buffer.from([0x01, 0x02]));
			
			await new Promise(resolve => setTimeout(resolve, 200));
			
			// Both should have metadata files
			const jsonExists = await fs.access(jsonMetadataFile).then(() => true).catch(() => false);
			const binExists = await fs.access(binMetadataFile).then(() => true).catch(() => false);
			
			expect(jsonExists).toBe(true);
			expect(binExists).toBe(true);
			
			// Verify they contain different data
			if (jsonExists && binExists) {
				const jsonContent = await fs.readFile(jsonMetadataFile, "utf8");
				const binContent = await fs.readFile(binMetadataFile, "utf8");
				
				expect(jsonContent).not.toBe(binContent);
				
				const jsonMetadata = JSON.parse(jsonContent);
				const binMetadata = JSON.parse(binContent);
				
				expect(jsonMetadata.length).toBeGreaterThanOrEqual(1);
				expect(binMetadata.length).toBeGreaterThanOrEqual(1);
				
				// Verify they contain the expected entries
				const jsonHasJsonOnly = jsonMetadata.some(([hash, entry]) => 
					hash && entry.dataSize === JSON.stringify({ format: "json" }).length);
				const binHasBinOnly = binMetadata.some(([hash, entry]) => 
					hash && entry.dataSize === 2); // Buffer.from([0x01, 0x02]) length
				
				expect(jsonHasJsonOnly).toBe(true);
				expect(binHasBinOnly).toBe(true);
			}
		});
	});

	describe("File System Inspection", () => {
		it("should create proper file structure", async () => {
			const testCache = new CacheService({
				cacheDir: path.join(testDir, "inspection"),
				fileExtension: "test"
			});
			
			await new Promise(resolve => setTimeout(resolve, 100));
			
			// Add some test data
			await testCache.set("inspect-key", "test data");
			await new Promise(resolve => setTimeout(resolve, 200));
			
			const cacheDir = path.join(testDir, "inspection");
			const files = await fs.readdir(cacheDir);
			
			// Should have metadata.json and the cache file
			expect(files).toContain("metadata.json");
			expect(files.some(file => file.endsWith(".test"))).toBe(true);
			
			// Verify metadata.json content
			const metadataFile = path.join(cacheDir, "metadata.json");
			const content = await fs.readFile(metadataFile, "utf8");
			const metadata = JSON.parse(content);
			
			expect(metadata.length).toBe(1);
			expect(metadata[0][1].dataSize).toBe(9); // "test data" length
		});
	});
});
