# Cache Index System

The cache implements a comprehensive index system for fast multi-dimensional lookups and searches.

## Index Architecture

The cache maintains multiple indexes in memory for different types of queries:

### Primary Indexes

**Content Hash Index**
- Type: `Map<string, Set<string>>`
- Purpose: Fast content-based lookups
- Key: SHA256 hash of file content
- Value: Set of cache keys containing that content
- Performance: O(1) lookup time

**Size Index**
- Type: `Map<number, Set<string>>`
- Purpose: Fast size-based lookups
- Key: File size in bytes
- Value: Set of cache keys with that size
- Performance: O(1) lookup time

**Date Index**
- Type: `Map<string, Set<string>>`
- Purpose: Fast date-based lookups
- Key: Creation date (YYYY-MM-DD format)
- Value: Set of cache keys created on that date
- Performance: O(1) lookup time

**Access Count Index**
- Type: `Map<number, Set<string>>`
- Purpose: Fast popularity-based lookups
- Key: Number of access times
- Value: Set of cache keys accessed that many times
- Performance: O(1) lookup time

### Supporting Indexes

**Primary Key Index**
- Type: `Map<string, CacheMetaData>`
- Purpose: Fast key-to-metadata lookups
- Performance: O(1) lookup time

**Content Hash Cache**
- Type: `Map<string, string>`
- Purpose: Cache computed file hashes
- Performance: Avoids re-computation

## Index Operations

### Automatic Indexing

Indexes are maintained automatically during cache operations:

**On SET operations:**
1. Calculate content hash
2. Add entry to all relevant indexes
3. Remove old entry from indexes if updating

**On REMOVE operations:**
1. Remove entry from all indexes
2. Clean up empty index entries

**On SEARCH operations:**
1. Check content hash index first
2. Build index for non-indexed content
3. Return results from index

### Manual Index Management

**Index Statistics**
```typescript
const stats = cache.getIndexStats();
// Returns: contentHashIndexSize, sizeIndexSize, dateIndexSize, accessCountIndexSize, totalIndexedKeys
```

**Clear All Indexes**
```typescript
await cache.clearAll(); // Clears all indexes along with cache data
```

## Search Methods

### Content-Based Search

**findKeyByValue(searchValue)**
- Uses content hash index for O(1) lookup
- Falls back to parallel file scanning for non-indexed content
- Automatically builds index for future searches
- Performance: 0.1-1ms for indexed content

**findAllKeysByValue(searchValue)**
- Uses content hash index for O(1) lookup
- Returns all cache keys containing the search value
- Performance: 0.1-1ms for indexed content

### Size-Based Search

**findKeysBySize(dataSize)**
- Direct lookup in size index
- Returns all cache keys with specified size
- Performance: O(1) lookup time

### Date-Based Search

**findKeysByDate(date)**
- Direct lookup in date index
- Date format: "YYYY-MM-DD"
- Returns all cache keys created on specified date
- Performance: O(1) lookup time

### Access Count Search

**findKeysByAccessCount(accessCount)**
- Direct lookup in access count index
- Returns all cache keys accessed specified number of times
- Performance: O(1) lookup time

## Performance Characteristics

### Index Performance

| Operation | Performance | Notes |
|-----------|-------------|-------|
| Indexed content search | 0.1-0.5ms | O(1) hash lookup |
| Non-indexed content search | 5-8ms | Parallel file scanning + indexing |
| Size-based search | 0.1ms | Direct index lookup |
| Date-based search | 0.1ms | Direct index lookup |
| Access count search | 0.1ms | Direct index lookup |

### Memory Usage

Indexes consume additional memory but provide significant performance benefits:

- **Content Hash Index**: ~64 bytes per unique content hash
- **Size Index**: ~32 bytes per unique size
- **Date Index**: ~32 bytes per unique date
- **Access Count Index**: ~32 bytes per unique access count

Total index overhead is typically < 1% of cache data size.

## Index Maintenance

### Automatic Cleanup

Indexes are automatically maintained during cache operations:

- **Entry removal**: Removes from all indexes
- **Cache eviction**: Updates indexes accordingly
- **Cache clearing**: Clears all indexes

### Consistency Guarantees

The index system maintains consistency with the underlying cache:

- Indexes are updated atomically with cache operations
- Failed operations do not leave indexes in inconsistent state
- Index cleanup occurs during cache maintenance operations

## Usage Examples

### Basic Content Search
```typescript
// Find first cache key containing specific data
const key = await cache.findKeyByValue("search data");

// Find all cache keys containing specific data
const keys = await cache.findAllKeysByValue("search data");
```

### Size-Based Queries
```typescript
// Find all 1KB files
const smallFiles = await cache.findKeysBySize(1024);

// Find all large files (>1MB)
const largeFiles = await cache.findKeysBySize(1024 * 1024);
```

### Date-Based Queries
```typescript
// Find all files created today
const today = new Date().toISOString().split('T')[0];
const todayFiles = await cache.findKeysByDate(today);

// Find all files created on specific date
const specificFiles = await cache.findKeysByDate("2024-01-15");
```

### Access Pattern Analysis
```typescript
// Find frequently accessed files
const hotFiles = await cache.findKeysByAccessCount(10);

// Find unused files
const unusedFiles = await cache.findKeysByAccessCount(0);
```

### Index Monitoring
```typescript
// Get index statistics
const stats = cache.getIndexStats();
console.log(`Content hash index: ${stats.contentHashIndexSize} entries`);
console.log(`Size index: ${stats.sizeIndexSize} entries`);
console.log(`Date index: ${stats.dateIndexSize} entries`);
console.log(`Access count index: ${stats.accessCountIndexSize} entries`);
```

## Best Practices

### Index Usage
- Use content-based searches for duplicate detection
- Use size-based searches for storage analysis
- Use date-based searches for cleanup operations
- Use access count searches for cache optimization

### Performance Optimization
- Indexes are built automatically on first search
- Subsequent searches of same content are instant
- Consider cache size when using multiple indexes
- Monitor index statistics for memory usage

### Maintenance
- Indexes are maintained automatically
- No manual index maintenance required
- Indexes are cleared during cache clearing operations
- Failed operations do not corrupt indexes
