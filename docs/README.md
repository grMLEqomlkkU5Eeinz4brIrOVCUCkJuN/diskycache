# DiskyCache Documentation

This directory contains detailed documentation for the DiskyCache library, explaining its architecture, implementation details, and usage patterns.

## Documentation Structure

- **[Architecture](./architecture.md)** - System design, components, and data flow
- **[Operations](./operations.md)** - Detailed sequence diagrams and operation flows
- **[API Reference](./api-reference.md)** - Complete method documentation
- **[Performance](./performance.md)** - Performance characteristics and optimization
- **[Safeguards](./safeguards.md)** - Data protection and reliability mechanisms
- **[Examples](./examples.md)** - Practical usage examples and patterns

## Quick Links

### Core Concepts
- **SHA-256 Hashing**: Cache keys are normalized and hashed for consistent, collision-resistant identification
- **Metadata Tracking**: File metadata stored separately from data files for efficient operations
- **LRU Eviction**: Automatic cleanup based on cache size and age limits
- **Atomic Operations**: Metadata writes use temporary files to prevent corruption

### Key Features
- **Disk Persistence**: Data survives application restarts
- **Automatic Cleanup**: Expired entries removed based on age and usage
- **Health Monitoring**: Built-in diagnostics for production environments
- **Graceful Shutdown**: Automatic data preservation on process termination

### Operation Flow
1. **Cache Initialization**: Creates directory, loads metadata, validates consistency
2. **Data Storage**: Normalizes key, generates hash, stores file and metadata
3. **Data Retrieval**: Uses hash to locate file, validates existence, updates access tracking
4. **Background Tasks**: Periodic cleanup, metadata saving, health checks

## Getting Started

For basic usage, see the main [README](../README.md). This documentation provides deeper insights for:

- **Development**: Understanding implementation details
- **Integration**: Optimizing for specific use cases
- **Troubleshooting**: Diagnosing issues and performance problems
- **Extending**: Building upon the existing functionality

## Visual Operations Flow

The [Operations Documentation](./operations.md) includes comprehensive sequence diagrams showing key cache interactions:

### Primary Operations
- **Set Operation**: Key normalization → SHA-256 hash → File write → Metadata update
- **Get Operation**: Hash lookup → Metadata validation → File read → Access tracking
- **Search by Value**: Size filtering → File comparison → Result return

### Background Processes
- **Batch Metadata Saving**: Timer-based I/O optimization
- **Cleanup Operations**: Expiration checking → File removal → Metadata synchronization
- **Health Monitoring**: Consistency validation → Issue detection → Status reporting

### Error Scenarios
- **Graceful Shutdown**: Signal handling → Metadata preservation → Safe shutdown
- **Error Recovery**: Corruption detection → Automatic cleanup → Self-healing

## Documentation Highlights

### Architecture Features
- **SHA-256 Hashing**: Collision-resistant cache key generation
- **Metadata Tracking**: In-memory HashMap with JSON persistence
- **Atomic Operations**: Temporary files prevent corruption
- **Health Monitoring**: Production-ready diagnostics

### Performance Optimizations
- **Batch I/O**: 90% reduction in metadata saves
- **LRU Eviction**: Automatic size management
- **Background Tasks**: Non-blocking cleanup operations
- **Resource Management**: Timer leak prevention

### Reliability Safeguards
- **Process Signal Handling**: Automatic shutdown protection
- **Consistency Validation**: Startup and runtime checks
- **Orphaned Entry Cleanup**: Automatic metadata maintenance
- **Cross-platform Compatibility**: Windows, Linux, macOS support
