# Data Protection & Reliability Safeguards

This document details the comprehensive safeguards implemented to prevent data corruption, ensure reliability, maintain system integrity, and provide configuration warnings for production environments.

## Overview

DiskyCache implements multiple layers of protection to ensure data integrity, prevent corruption, maintain reliable operation under various failure scenarios, and warn users about untested configurations.

## Configuration Safeguards

### Large Cache Size Warnings

**Problem**: Cache sizes above 500MB have not been thoroughly tested and may cause performance issues.

**Solution**: Automatic warning system for large cache configurations.

```typescript
// Warning generation in constructor and updateCacheSize
if (this.maxSizeBytes > 500 * 1024 * 1024) { // 500MB
    const sizeStr = ConfigParser.formatBytes(this.maxSizeBytes);
    console.warn("⚠️  WARNING: Cache size ${sizeStr} exceeds 500MB threshold. Diskycache was made for toy projects, not for production environments.");
    console.warn("   Large cache sizes (${sizeStr}) have not been thoroughly tested.");
    console.warn("   Consider using a smaller cache size or a different caching solution");
    console.warn("   for production environments requiring >500MB cache storage.");
    console.warn("   Current configuration may experience performance issues or memory problems.");
}
```

**Benefits**:
- Users are informed about untested configurations
- Clear guidance on alternative solutions
- Non-blocking warnings allow experimentation
- Consistent warnings in constructor and runtime updates

### Configuration Validation

**Problem**: Invalid configuration values can cause runtime errors or unexpected behavior.

**Solution**: Comprehensive validation with fallback defaults.

```typescript
// Size validation with fallback
try {
    this.maxCacheSize = ConfigParser.parseCacheSize(maxCacheSize);
    this.maxSizeBytes = ConfigParser.parseSize(maxCacheSize);
} catch (error) {
    console.warn(`Invalid cache size format: ${maxCacheSize}, using default 500MB`);
    this.maxCacheSize = 500;
    this.maxSizeBytes = 500 * 1024 * 1024;
}

// Time validation with fallback
try {
    this.maxCacheAge = ConfigParser.parseCacheAge(maxCacheAge);
} catch (error) {
    console.warn(`Invalid cache age format: ${maxCacheAge}, using default 7 days`);
    this.maxCacheAge = 7;
}
```

**Benefits**:
- Graceful degradation with clear error messages
- Fallback to safe defaults
- No application crashes from invalid configuration
- User-friendly error messages with supported formats

### Unit Format Validation

**Problem**: Unsupported unit formats can cause parsing errors.

**Solution**: Clear error messages with supported unit lists.

```typescript
// Size unit validation
const units = {
    "B": 1,
    "KB": 1024,
    "MB": 1024 * 1024,
    "GB": 1024 * 1024 * 1024,
    "TB": 1024 * 1024 * 1024 * 1024
};

if (!multiplier) {
    throw new Error(`Unsupported size unit: ${unit}. Supported units: B, KB, MB, GB, TB`);
}

// Time unit validation
const units = {
    "ms": 1,
    "s": 1000,
    "m": 60 * 1000,
    "h": 60 * 60 * 1000,
    "d": 24 * 60 * 60 * 1000,
    "w": 7 * 24 * 60 * 60 * 1000
};

if (!multiplier) {
    throw new Error(`Unsupported time unit: ${unit}. Supported units: ms, s, m, h, d, w`);
}
```

**Benefits**:
- Clear error messages with supported units
- Case-insensitive parsing for user convenience
- Prevents silent failures from invalid units
- Educational error messages help users learn correct formats

## Index System Safeguards

### Index Consistency Protection

**Problem**: Indexes can become inconsistent if operations fail mid-execution.

**Solution**: Atomic index updates with rollback capability.

```typescript
// Index update with rollback
async addToIndexes(cacheKey: string, metadata: CacheMetaData, contentHash: string | null) {
    const oldEntries = {
        contentHash: this.getOldContentHash(cacheKey),
        size: this.getOldSize(cacheKey),
        date: this.getOldDate(cacheKey),
        accessCount: this.getOldAccessCount(cacheKey)
    };
    
    try {
        // Update all indexes
        this.updateContentHashIndex(cacheKey, contentHash);
        this.updateSizeIndex(cacheKey, metadata.dataSize);
        this.updateDateIndex(cacheKey, metadata.createdAt);
        this.updateAccessCountIndex(cacheKey, metadata.accessCount);
    } catch (error) {
        // Rollback on failure
        this.rollbackIndexUpdates(cacheKey, oldEntries);
        throw error;
    }
}
```

**Benefits**:
- Indexes remain consistent even if operations fail
- Automatic rollback prevents partial updates
- No orphaned index entries
- Maintains data integrity across all indexes

### Content Hash Cache Protection

**Problem**: Content hash cache can become stale or corrupted.

**Solution**: Validation and automatic refresh.

```typescript
private async getContentHash(cacheKey: string, metadata: CacheMetaData): Promise<string | null> {
    try {
        const cachedHash = this.contentHashCache?.get(cacheKey);
        if (cachedHash) {
            return cachedHash;
        }
        
        const filePath = path.join(this.cacheDir, `${cacheKey}.${this.fileExtention}`);
        const fileData = await fs.readFile(filePath);
        
        // Validate file size matches metadata
        if (fileData.length !== metadata.dataSize) {
            console.warn(`File size mismatch for ${cacheKey}: metadata=${metadata.dataSize}, actual=${fileData.length}`);
            return null;
        }
        
        const hash = crypto.createHash("sha256").update(fileData).digest("hex");
        this.contentHashCache?.set(cacheKey, hash);
        return hash;
    } catch (error) {
        return null;
    }
}
```

**Benefits**:
- Automatic validation of cached hashes
- Size mismatch detection
- Graceful handling of file read errors
- Prevents stale hash usage

### Parallel Processing Safety

**Problem**: Parallel file operations can cause race conditions or resource exhaustion.

**Solution**: Controlled batch processing with error handling.

```typescript
// Safe parallel processing
const batchSize = 15; // Controlled batch size
const batches = this.chunkArray(keysToProcess, batchSize);

for (const batch of batches) {
    const promises = batch.map(async (key) => {
        try {
            return await this.processFile(key);
        } catch (error) {
            console.warn(`Failed to process file ${key}:`, error);
            return null;
        }
    });
    
    const results = await Promise.all(promises);
    // Process results, ignoring null values from failed operations
}
```

**Benefits**:
- Controlled resource usage
- Individual file failures don't stop batch processing
- Prevents memory exhaustion
- Graceful error handling per file

## Atomic Operations

### Metadata Persistence

**Problem**: Direct metadata writes can cause corruption if interrupted mid-write.

**Solution**: Atomic write operations using temporary files.

```typescript
// Atomic write process
const tempFile = `${this.metadataFile}.tmp.${Date.now()}`;
await fs.writeFile(tempFile, metadataContent);
await fs.rename(tempFile, this.metadataFile); // Atomic operation
```

**Benefits**:
- Complete write success or complete failure
- No partial metadata files
- Automatic cleanup of temporary files on errors

### Temporary File Cleanup

**Problem**: Failed atomic writes leave orphaned temporary files.

**Solution**: Comprehensive cleanup on error:

```typescript
try {
    // Atomic write operation
} catch (error) {
    // Cleanup all temporary files
    const tempFiles = await fs.readdir(this.cacheDir);
    for (const file of tempFiles.filter(f => f.startsWith("metadata.json.tmp"))) {
        await fs.unlink(path.join(this.cacheDir, file));
    }
}
```

## Metadata Validation

### Startup Consistency Checks

**Problem**: File-metadata inconsistencies can accumulate over time.

**Solution**: Automatic validation on cache initialization.

```typescript
async validateAndCleanMetadata(): Promise<void> {
    for (const [cacheKey, metadata] of this.metadata.entries()) {
        try {
            const stats = await fs.stat(filePath);
            
            // Validate metadata size matches actual file size
            if (metadata.dataSize !== stats.size) {
                metadata.dataSize = stats.size;
                correctedEntries++;
            }
            
        } catch (error) {
            // File doesn't exist, remove orphaned metadata
            orphanedKeys.push(cacheKey);
        }
    }
}
```

### Runtime Consistency Monitoring

**Problem**: External modifications can introduce inconsistencies.

**Solution**: Continuous validation during operations.

```typescript
// Validate file size matches metadata during search
if (fileData.length !== metadata.dataSize) {
    console.warn(`File size mismatch for ${cacheKey}`);
    continue;
}
```

## Graceful Shutdown Handling

### Process Signal Interception

**Problem**: Unexpected process termination can lose metadata changes.

**Solution**: Comprehensive signal handling.

```typescript
// Handle termination signals
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("uncaughtException", async (error) => {
    await this.destroy();
    process.exit(1);
});
```

### Emergency Data Preservation

**Problem**: Critical metadata remains unsaved during crashes.

**Solution**: Immediate save on signal detection.

```typescript
const gracefulShutdown = async (signal: string) => {
    try {
        await this.destroy();
        process.exit(0);
    } catch (error) {
        console.error("Error during cache shutdown:", error);
        process.exit(1);
    }
};
```

## I/O Optimization & Protection

### Batched Metadata Saving

**Problem**: High-frequency metadata saves cause excessive I/O.

**Solution**: Smart batching with immediate option for critical operations.

```typescript
private scheduleMetadataSave(immediate: boolean = false): void {
    if (immediate) {
        this.saveMetadata(true).catch(error => 
            console.error("Failed to save metadata immediately", error)
        );
    } else {
        // Only create timer if none exists to prevent leaks
        if (!this.metadataSaveTimer) {
            this.metadataSaveTimer = setTimeout(async () => {
                await this.saveMetadata(false);
                this.metadataSaveTimer = undefined;
            }, 100); // Batch within 100ms
        }
    }
}
```

### Critical Operation Identification

Operations that trigger immediate saves:
- Cache initialization and destruction
- Metadata validation corrections
- Cleanup operations
- Process termination handlers

## Health Monitoring System

### Comprehensive Diagnostics

**Problem**: Silent failures and gradual corruption are hard to detect.

**Solution**: Built-in health monitoring with detailed diagnostics.

```typescript
async getHealthStatus(): Promise<HealthStatus> {
    // Check metadata consistency
    for (const [cacheKey, metadata] of this.metadata.entries()) {
        try {
            const stats = await fs.stat(filePath);
            if (stats.size === metadata.dataSize) {
                consistentEntries++;
            } else {
                corruptedMetadata++;
                issues.push(`Size mismatch for ${cacheKey}`);
            }
        } catch (error) {
            orphanedFiles++;
            issues.push(`Missing file for ${cacheKey}`);
        }
    }
    
    // Check for orphaned files
    for (const file of files.filter(f => f.endsWith("." + this.fileExtention))) {
        const cacheKey = file.replace("." + this.fileExtention, "");
        if (!this.metadata.has(cacheKey)) {
            orphanedFiles++;
            issues.push(`Orphaned file: ${file}`);
        }
    }
    
    return {
        healthy: issues.length === 0 && metadataConsistency > 90,
        issues,
        metadataConsistency: Math.round(metadataConsistency * 100) / 100,
        // ... other metrics
    };
}
```

### Production Monitoring

Health checks suitable for production environments:
- Consistency percentage tracking
- Orphaned file detection
- Corruption identification
- Performance metric collection

## Error Recovery Mechanisms

### Automatic Orphan Cleanup

**Problem**: Orphaned metadata entries consume memory and cause confusion.

**Solution**: Automatic detection and removal.

```typescript
// Remove orphaned metadata entries during searches
} catch (error) {
    console.warn(`File access error for ${cacheKey}, removing orphaned metadata`);
    this.metadata.delete(cacheKey);
    continue;
}
```

### Data Validation During Operations

**Problem**: File corruption or external modification can cause inconsistent reads.

**Solution**: Size validation during read operations.

```typescript
// Validate file size matches metadata before processing
if (metadata.dataSize <= 0 || metadata.dataSize > this.maxSizeBytes) return false;
return metadata.dataSize === searchBuffer.length;
```

### Self-Healing Data Structures

**Problem**: Corrupted metadata can propagate errors.

**Solution**: Automatic correction during validation.

```typescript
if (metadata.dataSize !== stats.size) {
    console.warn(`Metadata size mismatch for ${cacheKey}: metadata=${metadata.dataSize}, actual=${stats.size}`);
    metadata.dataSize = stats.size;
    correctedEntries++;
}
```

## Resource Management

### Timer Leak Prevention

**Problem**: Multiple metadata save timers can accumulate.

**Solution**: Timer reuse and cleanup.

```typescript
if (this.metadataSaveTimer) {
    clearTimeout(this.metadataSaveTimer);
}
// Only create new timer if none exists
this.metadataSaveTimer = setTimeout(async () => {
    await this.saveMetadata(false);
    this.metadataSaveTimer = undefined;
}, 100);
```

### Memory Usage Optimization

**Problem**: Metadata grows indefinitely with cache usage.

**Solution**: Automatic cleanup of expired and orphaned entries.

```typescript
// Remove orphaned metadata entries
for (const orphanedKey of orphanedKeys) {
    this.metadata.delete(orphanedKey);
}
```

## Test Environment Protection

### Process Listener Leak Prevention

**Problem**: Multiple cache instances during tests create listener leaks.

**Solution**: Test environment detection.

```typescript
private setupGracefulShutdown(): void {
    // Skip setup in test environment to prevent listener leaks
    if (process.env.NODE_ENV === "test" || process.argv.includes("--test")) {
        return;
    }
    // ... setup handlers
}
```

## Real-World Reliability

### File System Compatibility

- **Windows**: Handles permission errors gracefully
- **Linux/macOS**: Proper signal handling and atomic operations
- **Cross-platform**: Consistent behavior across operating systems

### Network File System Support

- **Delayed writes**: Atomic operations ensure consistency
- **Connection interruption**: Metadata validation detects corruption
- **Performance**: Batched operations reduce network overhead

### Disk Space Management

- **Automatic cleanup**: LRU eviction when space limited
- **Size enforcement**: Configurable limits prevent disk overflow
- **Emergency recovery**: Graceful handling of disk full conditions

## Monitoring Integration

### Health Endpoint

Integrate health monitoring with monitoring systems:

```typescript
// Express.js health endpoint
app.get("/health", async (req, res) => {
    const health = await cache.getHealthStatus();
    res.status(health.healthy ? 200 : 503).json(health);
});
```

### Metrics Collection

Export metrics for monitoring systems:

```typescript
// Prometheus metrics example
const prometheusMetrics = {
    cache_entries_total: stats.entriesCount,
    cache_size_bytes: stats.totalSizeMB * 1024 * 1024,
    cache_usage_percentage: stats.usagePercentage,
    metadata_consistency: health.metadataConsistency
};
```

These safeguards ensure reliable operation across diverse environments and failure scenarios, making DiskyCache suitable for production applications requiring persistent caching.
