# diskycache

[![npm version](https://img.shields.io/npm/v/diskycache.svg)](https://www.npmjs.com/package/diskycache)

A file system-based caching library for Node.js applications. Features comprehensive indexing, flexible configuration with human-readable units, and sub-millisecond content searches with automatic cleanup based on usage patterns.

# STOP

This is probably not for you. I made this over-engineered cache solution for toy projects and I honestly recommend that you use something else, such as redis. You are probably better off implementing your own cache.

---

## Features

* **Disk-based storage**: Files are cached to disk for persistence across application restarts
* **Flexible configuration**: Human-readable units (B, KB, MB, GB, TB for size; ms, s, m, h, d, w for time)
* **Configuration object support**: Modern configuration object constructor with comprehensive options and sane defaults
* **Backward compatibility**: Legacy constructor still supported for existing code
* **Comprehensive indexing**: Multi-dimensional indexes for O(1) lookups by content, size, date, and access count
* **Sub-millisecond searches**: Index-based content searches with 97% performance improvement
* **LRU eviction**: Automatic removal of least recently used entries when size limits are reached
* **Flexible data formats**: Cache any file type by configuring the file extension
* **Normalized keys**: Consistent hashing for cache keys regardless of object property order
* **Metadata tracking**: Persistent cache statistics and access tracking
* **Runtime configuration**: Update cache settings dynamically without restart
* **Production warnings**: Automatic warnings for untested large cache configurations
* **No magic numbers**: All internal constants are configurable with sensible defaults

---

## Installation

```bash
npm install diskycache
```

---

## Basic Usage

### Configuration Object Constructor (Recommended)

```js
import { CacheService } from "diskycache";

// Modern configuration object approach
const cache = new CacheService({
	cacheDir: "cache_dir",
	maxCacheSize: "100MB",
	maxCacheAge: "7d",
	maxCacheKeySize: "100KB",
	fileExtension: "json",
	metadataSaveDelayMs: 100,
	floatingPointPrecision: 10
});

// Store data in cache
await cache.set("user_123", JSON.stringify({ name: "John", age: 30 }));

// Retrieve cached data
const cachedData = await cache.get("user_123");
if (cachedData) {
	const userData = JSON.parse(cachedData.toString());
	console.log("User:", userData.name);
}

// Check if key exists
const exists = await cache.exists("user_123");
console.log("Exists:", exists);

// Find cache key by stored value (sub-millisecond with index)
const foundKey = await cache.findKeyByValue(JSON.stringify({ name: "John", age: 30 }));
console.log("Found key:", foundKey);

// Multi-dimensional searches
const smallFiles = await cache.findKeysBySize("1KB");
const todayFiles = await cache.findKeysByDate("2024-01-15");
const hotFiles = await cache.findKeysByAccessCount(10);
```

### Legacy Constructor (Backward Compatible)

```js
// Traditional constructor still works
const legacyCache = new CacheService("cache_dir", "100MB", "7d", "100KB", "json");
```

---

## Constructor Configuration

### Configuration Object Constructor (Recommended)

```js
const cache = new CacheService(config);
```

#### Configuration Object Properties

| Property | Type | Description | Default |
|----------|------|-------------|---------|
| `cacheDir` | `string` | Directory path where cache files will be stored | `"cache"` |
| `maxCacheSize` | `string \| number` | Maximum total cache size (supports B, KB, MB, GB, TB) | `"500MB"` |
| `maxCacheAge` | `string \| number` | Maximum age for cache entries (supports ms, s, m, h, d, w) | `"7d"` |
| `maxCacheKeySize` | `string \| number` | Maximum size for cache key data (supports B, KB, MB, GB, TB) | `"100KB"` |
| `fileExtension` | `string` | File extension for cached files (e.g., `"json"`, `"txt"`, `"bin"`) | `"cache"` |
| `metadataSaveDelayMs` | `number` | Batch metadata save delay in milliseconds | `100` |
| `cutoffDateRecalcIntervalMs` | `number` | Cutoff date recalculation interval in milliseconds | `300000` (5 min) |
| `floatingPointPrecision` | `number` | Floating point precision for hash normalization | `10` |
| `healthCheckConsistencyThreshold` | `number` | Health check metadata consistency threshold percentage | `90` |
| `largeCacheWarningThresholdBytes` | `number` | Large cache size warning threshold in bytes | `524288000` (500MB) |
| `processMaxListenersIncrement` | `number` | Process max listeners increment for graceful shutdown | `10` |
| `findKeyBatchSize` | `number` | Batch processing size for findKeyByValue operations | `15` |
| `findAllKeysBatchSize` | `number` | Batch processing size for findAllKeysByValue operations | `20` |
| `jsonIndentSpaces` | `number` | JSON stringify indentation spaces | `2` |
| `sizeFormatDecimalPlaces` | `number` | Size formatting decimal places | `2` |
| `timeFormatDecimalPlaces` | `number` | Time formatting decimal places | `2` |
| `statsDecimalPlaces` | `number` | Statistics calculation decimal places | `10` |

#### Configuration Examples

```js
// Minimal configuration (uses defaults for unspecified properties)
const cache1 = new CacheService({
	cacheDir: "my-cache",
	maxCacheSize: "1GB",
	maxCacheAge: "30d"
});

// Full custom configuration
const cache2 = new CacheService({
	cacheDir: "production-cache",
	maxCacheSize: "2GB",
	maxCacheAge: "7d",
	maxCacheKeySize: "1MB",
	fileExtension: "json",
	metadataSaveDelayMs: 50,
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
});

// High-performance configuration
const cache3 = new CacheService({
	cacheDir: "fast-cache",
	maxCacheSize: "500MB",
	maxCacheAge: "1d",
	metadataSaveDelayMs: 25, // Faster saves
	findKeyBatchSize: 25, // Larger batches
	findAllKeysBatchSize: 30
});
```

### Legacy Constructor (Backward Compatible)

```js
const cache = new CacheService(dirName, maxCacheSize, maxCacheAge, cacheKeyLimit, fileExtension);
```

#### Legacy Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `dirName` | `string` | Directory path where cache files will be stored |
| `maxCacheSize` | `string \| number` | Maximum total cache size (supports B, KB, MB, GB, TB) |
| `maxCacheAge` | `string \| number` | Maximum age for cache entries (supports ms, s, m, h, d, w) |
| `cacheKeyLimit` | `string \| number` | Maximum size for cache key data (supports B, KB, MB, GB, TB) |
| `fileExtension` | `string` | File extension for cached files (e.g., `"json"`, `"txt"`, `"bin"`) |

#### Legacy Configuration Examples

```js
// Traditional numeric values (backward compatible)
const cache1 = new CacheService("cache", 100, 7, 100, "json");

// Flexible string units
const cache2 = new CacheService("cache", "100MB", "7d", "100KB", "json");
const cache3 = new CacheService("cache", "1GB", "24h", "1MB", "json"); // Triggers warning
const cache4 = new CacheService("cache", "500MB", "1w", "500KB", "bin");

// Different time units
const cache5 = new CacheService("cache", "200MB", "3600s", "50KB", "txt");
const cache6 = new CacheService("cache", "50MB", "30m", "25KB", "json");
```

**⚠️ Warning**: Cache sizes above 500MB will trigger console warnings as these configurations have not been thoroughly tested for production use.

---

## API Reference

### Core Methods

#### `set(keyData, data): Promise<boolean>`
Stores data in cache under a generated hash key.

```js
// Store string data
await cache.set("api_response", JSON.stringify(responseData));

// Store object as key
await cache.set({ userId: 123, type: "profile" }, userProfileData);

// Store binary data
await cache.set("image_id", imageBuffer);
```

#### `get(keyData): Promise<Buffer | null>`
Retrieves cached data as Buffer, or null if not found.

```js
const data = await cache.get("api_response");
if (data) {
	const response = JSON.parse(data.toString());
}
```

#### `exists(keyData): Promise<boolean>`
Checks if a key exists and is valid in cache.

```js
const exists = await cache.exists("user_profile");
```

#### `deleteKey(keyData): Promise<boolean>`
Deletes a cache entry by its key data.

```js
const deleted = await cache.deleteKey("user_profile");
if (deleted) {
	console.log("Cache entry deleted successfully");
}
```

### Search Methods

#### `findKeyByValue(searchValue): Promise<string | null>`
Returns the internal cache key (SHA-256 hash) for a specific value using index-based lookup.

```js
const searchData = JSON.stringify({ name: "test" });
const cacheKey = await cache.findKeyByValue(searchData);
// Returns: "a34b5c6d..." (64-character SHA-256 hash)
// Performance: O(1) for indexed content, sub-millisecond response
```

#### `findAllKeysByValue(searchValue): Promise<string[]>`
Returns all cache keys associated with a specific value using index-based lookup.

```js
const duplicateData = "shared_data";
const allKeys = await cache.findAllKeysByValue(duplicateData);
// Returns: ["hash1...", "hash2..."]
// Performance: O(1) for indexed content, sub-millisecond response
```

#### `findKeysBySize(dataSize): Promise<string[]>`
Finds all cache keys with the specified data size using size index.

```js
const smallFiles = await cache.findKeysBySize("1KB");
const largeFiles = await cache.findKeysBySize("1MB");
// Performance: O(1) lookup time
```

#### `findKeysByDate(date): Promise<string[]>`
Finds all cache keys created on the specified date using date index.

```js
const todayFiles = await cache.findKeysByDate("2024-01-15");
const yesterdayFiles = await cache.findKeysByDate("2024-01-14");
// Performance: O(1) lookup time
```

#### `findKeysByAccessCount(accessCount): Promise<string[]>`
Finds all cache keys with the specified access count using access count index.

```js
const hotFiles = await cache.findKeysByAccessCount(10); // Frequently accessed
const unusedFiles = await cache.findKeysByAccessCount(0); // Never accessed
// Performance: O(1) lookup time
```

### Management Methods

#### `getStats(): Promise<StatisticData>`
Returns comprehensive cache statistics.

```js
const stats = await cache.getStats();
console.log({
	entries: stats.entriesCount,
	usedSpace: `${stats.totalSizeMB}MB`,
	usagePercent: `${stats.usagePercentage}%`,
	maxSize: `${stats.maxSizeMB}MB`
});
```

#### `getIndexStats(): IndexStats`
Returns statistics about the cache index system.

```js
const stats = cache.getIndexStats();
console.log({
	contentHashIndex: stats.contentHashIndexSize,
	sizeIndex: stats.sizeIndexSize,
	dateIndex: stats.dateIndexSize,
	accessCountIndex: stats.accessCountIndexSize,
	totalIndexedKeys: stats.totalIndexedKeys
});
```

#### `getConfiguration(): ConfigurationInfo`
Returns current cache configuration in human-readable format.

```js
const config = cache.getConfiguration();
console.log({
	cacheDir: config.cacheDir,
	maxCacheSize: config.maxCacheSize,    // "100.00 MB"
	maxCacheAge: config.maxCacheAge,      // "7.00 d"
	cacheKeyLimit: config.cacheKeyLimit, // "100.00 KB"
	fileExtension: config.fileExtension
});
```

#### `updateCacheSize(newSize): Promise<boolean>`
Updates the cache size limit with flexible units.

```js
const success = await cache.updateCacheSize("1GB");
if (success) {
	console.log("Cache size updated successfully");
}
```

#### `updateCacheAge(newAge): boolean`
Updates the cache age limit with flexible units.

```js
const success = cache.updateCacheAge("24h");
if (success) {
	console.log("Cache age updated successfully");
}
```

#### `updateCacheKeyLimit(newLimit): boolean`
Updates the cache key limit with flexible units.

```js
const success = cache.updateCacheKeyLimit("1MB");
if (success) {
	console.log("Cache key limit updated successfully");
}
```

#### `initializeCache(): Promise<void>`
Manually initialize cache system (called automatically on construction).

```js
await cache.initializeCache();
```

#### `destroy(): Promise<void>`
Gracefully shutdown cache and save all pending metadata.

```js
await cache.destroy(); // Safe shutdown with data preservation
```

#### `clearAll(): Promise<void>`
Removes all cached files and metadata.

```js
await cache.clearAll();
```

#### `cleanupOldEntries(): Promise<void>`
Removes expired cache entries based on age limits.

```js
await cache.cleanupOldEntries(); // Removes old files automatically
```

#### `enforceMaxCacheSize(): Promise<void>`
Manually trigger cache size enforcement (removes LRU entries if needed).

```js
await cache.enforceMaxCacheSize(); // Manual size management
```

---

## Advanced Features

### Comprehensive Index System
The cache maintains multiple indexes for fast multi-dimensional lookups:

```js
// Content-based searches (sub-millisecond)
const key = await cache.findKeyByValue("search data");

// Size-based searches
const smallFiles = await cache.findKeysBySize("1KB");
const largeFiles = await cache.findKeysBySize("1MB");

// Date-based searches
const todayFiles = await cache.findKeysByDate("2024-01-15");

// Access pattern analysis
const hotFiles = await cache.findKeysByAccessCount(10);
const unusedFiles = await cache.findKeysByAccessCount(0);
```

### Flexible Configuration
Support for human-readable units in all configuration parameters:

```js
// Size units: B, KB, MB, GB, TB
const cache1 = new CacheService("dir", "500MB", "7d", "100KB", "bin");
const cache2 = new CacheService("dir", "1GB", "24h", "1MB", "json");

// Time units: ms, s, m, h, d, w
const cache3 = new CacheService("dir", "200MB", "3600s", "50KB", "txt");
const cache4 = new CacheService("dir", "100MB", "1w", "25KB", "json");
```

### Runtime Configuration Updates
Update cache settings without restarting:

```js
// Update cache size
await cache.updateCacheSize("1GB");

// Update cache age
cache.updateCacheAge("24h");

// Update key limit
cache.updateCacheKeyLimit("1MB");

// Get current configuration
const config = cache.getConfiguration();
console.log(`Current size: ${config.maxCacheSize}`);
```

---

## Data Types and Configuration

### Supported Cache Key Types

```js
// String keys
await cache.set("simple_key", data);

// Object keys (normalized for consistency)
await cache.set({ user: 123, type: "profile" }, data);
await cache.set({ type: "profile", user: 123 }, data); // Same key as above

// Complex nested objects
await cache.set({
	region: "us-east",
	user: { id: 456, tier: "premium" },
	timestamp: Date.now()
}, data);
```

### File Extension Configuration

Configure different file extensions for different data types:

```js
// JSON data
const jsonCache = new CacheService("cache", "50MB", "1d", "50KB", "json");

// Text data
const textCache = new CacheService("cache", "50MB", "1d", "50KB", "txt");

// Binary data
const binaryCache = new CacheService("cache", "100MB", "1d", "50KB", "bin");

// Image data
const imageCache = new CacheService("cache", "500MB", "30d", "50KB", "png");
```

---

## Performance Characteristics

### Index Performance
- **Content searches**: 0.1-0.5ms (97% improvement over sequential scanning)
- **Size-based lookups**: 0.1ms (O(1) index access)
- **Date-based lookups**: 0.1ms (O(1) index access)
- **Access count lookups**: 0.1ms (O(1) index access)

### Memory Usage
- **Index overhead**: < 1% of cache data size
- **Metadata**: Loaded into memory for fast lookups
- **Content hash cache**: Reduces file I/O for repeated searches

### Configuration Warnings
Cache sizes above 500MB trigger warnings:
```
⚠️  WARNING: Cache size 1.00 GB exceeds 500MB threshold. Diskycache was made for toy projects, not for production environments.
   Large cache sizes (1.00 GB) have not been thoroughly tested.
   Consider using a smaller cache size or a different caching solution
   for production environments requiring >500MB cache storage.
   Current configuration may experience performance issues or memory problems.
```

---

## Advanced Usage Examples

### API Response Caching

```js
// Modern configuration approach
const apiCache = new CacheService({
	cacheDir: "api_cache",
	maxCacheSize: "200MB",
	maxCacheAge: "1d",
	maxCacheKeySize: "50KB",
	fileExtension: "json",
	metadataSaveDelayMs: 50, // Faster saves for API responses
	findKeyBatchSize: 20 // Optimized for API lookups
});

async function getApiData(endpoint) {
	const cacheKey = `api_${endpoint}_${Date.now()}`;
	
	// Check cache first
	const cached = await apiCache.get(cacheKey);
	if (cached) {
		return JSON.parse(cached.toString());
	}
	
	// Fetch from API
	const response = await fetch(endpoint);
	const data = await response.json();
	
	// Cache the response
	await apiCache.set(cacheKey, JSON.stringify(data));
	return data;
}
```

### Session Management

```js
// High-performance session cache
const sessionCache = new CacheService({
	cacheDir: "sessions",
	maxCacheSize: "50MB",
	maxCacheAge: "7d",
	maxCacheKeySize: "100KB",
	fileExtension: "json",
	metadataSaveDelayMs: 25, // Very fast saves for sessions
	cutoffDateRecalcIntervalMs: 60000 // Check expiration every minute
});

async function storeSession(sessionId, sessionData) {
	await sessionCache.set({ type: "session", id: sessionId }, JSON.stringify(sessionData));
}

async function getSession(sessionId) {
	const data = await sessionCache.get({ type: "session", id: sessionId });
	return data ? JSON.parse(data.toString()) : null;
}
```

### File Processing Pipeline

```js
// Large file processing cache with custom settings
const fileCache = new CacheService({
	cacheDir: "processed_files",
	maxCacheSize: "1GB",
	maxCacheAge: "30d",
	maxCacheKeySize: "200KB",
	fileExtension: "bin",
	metadataSaveDelayMs: 200, // Less frequent saves for large files
	findKeyBatchSize: 10, // Smaller batches for large files
	findAllKeysBatchSize: 15,
	largeCacheWarningThresholdBytes: 2 * 1024 * 1024 * 1024 // 2GB warning threshold
});

async function processLargeFile(filePath) {
	const fileHash = await generateFileHash(filePath);
	
	// Check if already processed
	const processed = await fileCache.get(fileHash);
	if (processed) {
		return processed;
	}
	
	// Process file (expensive operation)
	const processedData = await performExpensiveProcessing(filePath);
	
	// Cache result
	await fileCache.set(fileHash, processedData);
	return processedData;
}
```

### Multi-Dimensional Cache Analysis

```js
// Analyze cache usage patterns
const stats = await cache.getStats();
const indexStats = cache.getIndexStats();

// Find frequently accessed files
const hotFiles = await cache.findKeysByAccessCount(10);

// Find large files
const largeFiles = await cache.findKeysBySize("1MB");

// Find files created today
const today = new Date().toISOString().split('T')[0];
const todayFiles = await cache.findKeysByDate(today);

// Find duplicate content
const duplicateData = "shared_response";
const duplicateKeys = await cache.findAllKeysByValue(duplicateData);

console.log({
	totalEntries: stats.entriesCount,
	hotFiles: hotFiles.length,
	largeFiles: largeFiles.length,
	todayFiles: todayFiles.length,
	duplicates: duplicateKeys.length,
	indexEfficiency: indexStats.totalIndexedKeys / stats.entriesCount
});
```

---

## Error Handling

Handle common error scenarios:

```js
try {
	const result = await cache.set(oversizedKey, data);
	if (!result) {
		console.error("Failed to cache data");
	}
} catch (error) {
	if (error.message.includes("Cache key data too large")) {
		console.error("Key is too large, consider using a hash instead");
	} else {
		console.error("Cache error:", error);
	}
}
```

---

## Performance Considerations

### Memory Usage
- **Index overhead**: < 1% of cache data size
- **Metadata**: Loaded into memory for fast lookups
- **Content hash cache**: Reduces file I/O for repeated searches
- **Large caches**: Monitor memory usage for caches > 500MB

### Disk I/O Optimization
- **Index-based searches**: Sub-millisecond response times
- **Metadata saves**: Batched for improved performance
- **Parallel processing**: Non-indexed content searches use parallel file reading
- **Content hash caching**: Avoids re-reading files for repeated searches

### Integration Best Practices
```js
// Proper cleanup in application lifecycle
process.on("SIGINT", async () => {
	await cache.destroy();
	process.exit(0);
});

// Monitor cache performance and indexes
setInterval(async () => {
	const stats = await cache.getStats();
	const indexStats = cache.getIndexStats();
	console.log(`Cache usage: ${stats.entriesCount} entries, ${stats.usagePercentage}% full`);
	console.log(`Index efficiency: ${indexStats.totalIndexedKeys}/${stats.entriesCount} indexed`);
}, 60000);

// Runtime configuration updates
if (stats.usagePercentage > 90) {
	await cache.updateCacheSize("2GB"); // Will trigger warning
}

// Performance tuning based on usage patterns
const performanceCache = new CacheService({
	cacheDir: "performance-cache",
	maxCacheSize: "1GB",
	maxCacheAge: "7d",
	metadataSaveDelayMs: 25, // Faster saves
	findKeyBatchSize: 30, // Larger batches for better throughput
	findAllKeysBatchSize: 40,
	cutoffDateRecalcIntervalMs: 30000, // More frequent expiration checks
	healthCheckConsistencyThreshold: 95 // Stricter health checks
});
```

---

## Troubleshooting

### Common Issues

**Cache directory not created**
```js
// Ensure proper directory permissions
const cache = new CacheService("./cache", 100, 7, 50, "json");
```

**Metadata corruption**
```js
// Clear corrupted cache
await cache.clearAll();
```

**Key size exceeded**
```js
// Use hash instead of full object
const key = crypto.createHash("sha256").update(JSON.stringify(obj)).digest("hex");
await cache.set(key, data);
```

---
