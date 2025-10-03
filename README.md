# diskycache

[![npm version](https://img.shields.io/npm/v/diskycache.svg)](https://www.npmjs.com/package/diskycache)

A file system-based caching library for Node.js applications. Stores cached data on disk with configurable size and age limits, providing persistent caching with automatic cleanup based on usage patterns.

---

## Features

* **Disk-based storage**: Files are cached to disk for persistence across application restarts
* **Configurable limits**: Set maximum cache size (MB) and age (days)
* **LRU eviction**: Automatic removal of least recently used entries when size limits are reached
* **Flexible data formats**: Cache any file type by configuring the file extension
* **Normalized keys**: Consistent hashing for cache keys regardless of object property order
* **Metadata tracking**: Persistent cache statistics and access tracking
* **Search capabilities**: Find cache entries by value content

---

## Installation

```bash
npm install diskycache
```

---

## Basic Usage

```js
import { CacheService } from "diskycache";

const cache = new CacheService("cache_dir", 100, 7, 100, "json");

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

// Find cache key by stored value
const foundKey = await cache.findKeyByValue(JSON.stringify({ name: "John", age: 30 }));
console.log("Found key:", foundKey);
```

---

## Constructor Configuration

```js
const cache = new CacheService(dirName, maxCacheSizeMB, maxCacheAgeDays, maxKeySizeKB, fileExtension);
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `dirName` | `string` | Directory path where cache files will be stored |
| `maxCacheSizeMB` | `number` | Maximum total cache size in megabytes (default: 500) |
| `maxCacheAgeDays` | `number` | Maximum age for cache entries in days before expiration |
| `maxKeySizeKB` | `number` | Maximum size for cache key data in kilobytes (default: 100) |
| `fileExtension` | `string` | File extension for cached files (e.g., `"json"`, `"txt"`, `"bin"`) |

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

### Search Methods

#### `findKeyByValue(searchValue): Promise<string | null>`
Returns the internal cache key (SHA-256 hash) for a specific value.

```js
const searchData = JSON.stringify({ name: "test" });
const cacheKey = await cache.findKeyByValue(searchData);
// Returns: "a34b5c6d..." (64-character SHA-256 hash)
```

#### `findAllKeysByValue(searchValue): Promise<string[]>`
Returns all cache keys associated with a specific value.

```js
const duplicateData = "shared_data";
const allKeys = await cache.findAllKeysByValue(duplicateData);
// Returns: ["hash1...", "hash2..."]
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

#### `getHealthStatus(): Promise<HealthStatus>`
Performs health check on cache system and returns detailed diagnostics.

```js
const health = await cache.getHealthStatus();
console.log({
	healthy: health.healthy,
	consistency: `${health.metadataConsistency}%`,
	filesOnDisk: health.filesOnDisk,
	orphanedFiles: health.orphanedFiles,
	issues: health.issues // Array of detected problems
});
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

### Automatic Metadata Validation
The cache automatically validates metadata consistency on startup and during operations:

```js
// Metadata validation happens automatically
// Checks for orphaned files, corrupted metadata, size mismatches
const health = await cache.getHealthStatus();
if (!health.healthy) {
    console.log("Issues detected:", health.issues);
}
```

### Atomic Metadata Operations
All metadata writes use atomic operations to prevent corruption:

```js
// Safe batch operations with automatic cleanup
await cache.set("key1", "data1"); // Batched save
await cache.set("key2", "data2"); // Reuses batch timer
await cache.set("key3", "data3"); // Still batched
// Single metadata save occurs after 100ms
```

### Graceful Shutdown Handling
Automatic process shutdown handlers ensure data safety:

```js
// Cache automatically saves metadata on:
// - SIGINT, SIGTERM signals
// - Uncaught exceptions
// - Process termination
// No data loss during application crashes
```

### Health Monitoring
Built-in health checks for production monitoring:

```js
const diagnostics = await cache.getHealthStatus();
console.log({
    consistency: `${diagnostics.metadataConsistency}%`,
    orphanedFiles: diagnostics.orphanedFiles,
    corruptedEntries: diagnostics.corruptedMetadata,
    totalIssues: diagnostics.issues.length
});
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
const jsonCache = new CacheService("cache", 50, 1, 50, "json");

// Text data
const textCache = new CacheService("cache", 50, 1, 50, "txt");

// Binary data
const binaryCache = new CacheService("cache", 100, 1, 50, "bin");

// Image data
const imageCache = new CacheService("cache", 500, 30, 50, "png");
```

---

## Advanced Usage Examples

### API Response Caching

```js
const apiCache = new CacheService("api_cache", 200, 1, 50, "json");

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
const sessionCache = new CacheService("sessions", 50, 7, 100, "json");

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
const fileCache = new CacheService("processed_files", 1000, 30, 200, "bin");

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
- Cache metadata is loaded into memory for fast lookups
- Actual cached data remains on disk
- Larger caches require more memory for metadata indexing

### Disk I/O Optimization
- Metadata saves are batched for improved performance
- Use `destroy()` method for graceful shutdown to force final saves
- Consider cache size limits to balance performance with storage

### Integration Best Practices
```js
// Proper cleanup in application lifecycle
process.on("SIGINT", async () => {
	await cache.destroy();
	process.exit(0);
});

// Monitor cache performance
setInterval(async () => {
	const stats = await cache.getStats();
	console.log(`Cache usage: ${stats.entriesCount} entries, ${stats.usagePercentage}% full`);
}, 60000);
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
