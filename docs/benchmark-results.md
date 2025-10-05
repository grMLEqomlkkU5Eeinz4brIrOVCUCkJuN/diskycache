# Cache Benchmark Results

This document contains sample benchmark results from the comprehensive cache performance test.

## Test Configuration

- **Total Iterations**: 1,000 operations
- **Window Size**: 500 live keys
- **Cache Size**: 50 MB maximum
- **Data Sizes**: 1KB, 50KB, 500KB, 1MB (cycled)
- **Test Duration**: Approximately 2-5 minutes depending on system

## Sample Results

```
================================================================================
COMPREHENSIVE BENCHMARK RESULTS
================================================================================

PERFORMANCE METRICS:
Average SET time: 3.74 ms (1000 operations)
Average GET time: 0.69 ms (200 operations)
Average EXISTS time: 0.24 ms (143 operations)
Average findKeyByValue time: 0.40 ms (100 operations)
Average findAllKeysByValue time: 0.39 ms (50 operations)
Average getStats time: 0.13 ms (20 operations)
Average getHealthStatus time: 16.34 ms (10 operations)

HIT RATE METRICS:
GET hit rate: 84/200 (42.00%)
EXISTS hit rate: 64/143 (44.76%)
findKeyByValue hit rate: 41/100 (41.00%)

FINAL CACHE STATISTICS:
Total entries: 129
Total size: 49.22 MB / 50 MB (98%)
Total accesses: 6
Average accesses per entry: 0
Oldest entry: 2025-10-05T00:51:49.964Z
Newest entry: 2025-10-05T00:51:50.762Z

================================================================================
Benchmark completed successfully!
================================================================================

FINAL HEALTH CHECK (after cleanup):
Cache healthy: Yes
Metadata consistency: 100%
Files on disk: 129
Metadata entries: 129
Orphaned files: 0
Corrupted metadata: 0
No issues found - cache is in perfect health!
```

## Operation Frequency

The benchmark performs operations at different frequencies:

- **SET**: Every iteration (1000 operations)
- **GET**: Every 5th iteration (200 operations)
- **EXISTS**: Every 7th iteration (142 operations)
- **findKeyByValue**: Every 10th iteration (100 operations)
- **findAllKeysByValue**: Every 20th iteration (50 operations)
- **getStats**: Every 50th iteration (20 operations)
- **getHealthStatus**: Every 100th iteration (10 operations)

## Performance Characteristics

### Fast Operations (< 1ms)
- **findKeyByValue**: Index-based content search (0.40 ms)
- **findAllKeysByValue**: Index-based content search (0.39 ms)
- **getStats**: In-memory statistics calculation (0.13 ms)

### Moderate Operations (1-5ms)
- **SET**: Core storage operation with indexing (3.74 ms)
- **GET**: Core retrieval operation (0.69 ms)
- **EXISTS**: Metadata-only existence check (0.24 ms)

### Slower Operations (> 10ms)
- **getHealthStatus**: File system validation (16.34 ms)

## Cache Behavior Under Memory Pressure

The results show realistic cache behavior when operating near capacity:

- **Cache Usage**: 98% full (49.22 MB / 50 MB)
- **Hit Rates**: 41-45% (realistic for memory-constrained cache)
- **Eviction**: Working effectively (129 entries from 1000 operations)
- **Access Pattern**: Low average accesses per entry due to aggressive eviction
- **Index Performance**: Content searches achieve sub-millisecond performance

## Expected Variations

Performance will vary based on:

- **System specifications** (CPU, RAM, storage type)
- **Operating system** (Windows, Linux, macOS)
- **Storage type** (SSD vs HDD)
- **System load** during testing
- **File system** (NTFS, ext4, APFS, etc.)
- **Cache utilization** (higher usage = more eviction = lower hit rates)

## Typical Performance Ranges

| Operation | Actual Results | Typical Range | Notes |
|-----------|----------------|---------------|-------|
| SET | 3.74 ms | 2-6 ms | Includes indexing overhead |
| GET | 0.69 ms | 0.5-3 ms | Fastest operation |
| EXISTS | 0.24 ms | 0.3-2 ms | Metadata-only check |
| findKeyByValue | 0.40 ms | 0.1-1 ms | Index-based lookup |
| findAllKeysByValue | 0.39 ms | 0.1-1 ms | Index-based lookup |
| getStats | 0.13 ms | 0.1-1 ms | In-memory calculation |
| getHealthStatus | 16.34 ms | 5-20 ms | File system validation |

## Health Metrics

A healthy cache should show:
- **Metadata consistency**: 100%
- **Orphaned files**: 0
- **Corrupted metadata**: 0
- **Cache healthy**: Yes
