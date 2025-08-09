# diskycache

[![npm version](https://img.shields.io/npm/v/diskycache.svg)](https://www.npmjs.com/package/diskycache)
[![license](https://img.shields.io/npm/l/diskycache.svg)](LICENSE)

A simple, efficient **disk-backed cache** library for Node.js - designed to cache files of any type on disk with configurable size and age limits. Ideal for applications needing persistent caching with controlled storage size and expiration.

---

## Features

* File system-based cache with metadata tracking
* Configurable max cache size (in MB) and max cache age (in days)
* Automatic cache eviction on size limits (LRU based on last accessed)
* Supports caching **any file type** (binary, text, JSON, images, etc.) via configurable file extensions
* Normalizes cache keys for consistent hashing
* Async API with `get`, `set`, `exists`, and stats retrieval
* Metadata persistence for cache consistency across restarts
* Easy integration with any Node.js project

---

## Installation

```bash
npm install diskycache
```

---

## Usage

```ts
import { CacheService } from "diskycache";

async function example() {
  // Initialize cache:
  // - "cache_dir" as storage folder
  // - 100 MB max size
  // - 7 days max age
  // - 100 KB max key size
  // - "json" file extension for cached files (can be any extension)
  const cache = new CacheService("cache_dir", 100, 7, 100, "json");

  const key = { id: "user123", timestamp: Date.now() };
  const data = JSON.stringify({ name: "Alice", age: 30 });

  // Store JSON string in cache with ".json" extension
  await cache.set(key, data);

  // Retrieve cached data as Buffer, parse as needed
  const cachedData = await cache.get(key);
  if (cachedData) {
    console.log("Cache hit:", cachedData.toString());
  } else {
    console.log("Cache miss");
  }

  // Check existence
  const exists = await cache.exists(key);
  console.log("Exists?", exists);

  // Get cache stats
  const stats = await cache.getStats();
  console.log(stats);
}

example();
```

---

## API

### `new CacheService(dirName, maxCacheSizeMB, maxCacheAgeDays, maxKeySizeKB, fileExtension)`

* `dirName` (string): Directory to store cache files
* `maxCacheSizeMB` (number): Maximum total cache size in megabytes (default 500)
* `maxCacheAgeDays` (number): Maximum age for cache entries in days
* `maxKeySizeKB` (number): Maximum size for cache key data in kilobytes
* `fileExtension` (string): File extension for cached files (e.g., `"bin"`, `"json"`, `"txt"`, `"png"`)

### Methods

* `set(keyData, data): Promise<boolean>` — Store data (Buffer or string) in cache under a normalized hash key
* `get(keyData): Promise<Buffer | null>` — Retrieve cached data as a Buffer, or null if missing or expired
* `exists(keyData): Promise<boolean>` — Check if a key exists and is valid in cache
* `clearAll(): Promise<void>` — Clear all cached files and metadata
* `getStats(): Promise<StatisticData>` — Get cache statistics including size, counts, usage percentage, and entry dates

---

## Notes & Limitations

* Cache keys are normalized and hashed with SHA-256 for consistent and collision-resistant keys
* Metadata is persisted as JSON in the cache directory to maintain state across restarts
* Cache eviction is performed based on Least Recently Used (LRU) principle, removing oldest accessed files first
* Current size estimation relies on JSON string length of keys and metadata, which might not be perfectly accurate
* Suitable for moderate data sizes (default tested with \~50 KB chunks), configurable to support other sizes
* Metadata I/O occurs on every get/set call — possible optimization for batching or throttling in future versions
* Supports caching any file type by specifying the desired file extension on initialization

---

## TODO / Planned Improvements

* Improved parsing and handling of cache entry expiration dates
* Enforcement of max data size per cached entry
* More precise size estimation techniques for keys and cached data
* Streaming support to cache large payloads efficiently
* Better module segregation and codebase organization
* Comprehensive benchmarks including edge cases and stress tests
* Batch processing for `get` and `set` to improve performance and reduce I/O overhead
* Support for dynamic chunk sizes beyond the current 50 KB default
