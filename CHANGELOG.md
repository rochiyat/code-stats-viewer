# Change Log

All notable changes to the "Code Stats Viewer" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2024-01-20

### Added
- ✨ **Settings Section in Sidebar**: New expandable section with clickable configuration items
  - Click "📊 Sidebar Files" to change max files shown in sidebar (1-100)
  - Click "💾 Export Files" to change max files included in exports (1-1000)
- ✨ **Display Settings Panel**: Interactive UI in detailed view to configure settings
  - Input fields with real-time validation
  - Update button for instant apply
- ✨ **Language Icons**: Visual identification for 19+ programming languages
  - 📜 JavaScript, 📘 TypeScript, 🐍 Python, ☕ Java
  - 🦀 Rust, 🐹 Go, 💎 Ruby, 🐘 PHP, and more
- ✨ **Clickable File Links**: Click any file path in detailed view to open in editor
  - Hover effects with underline
  - Tooltip showing full file path
  - Opens in non-preview tab for permanent editing
- ✨ **Custom Tab Icon**: Bar chart icon in Code Statistics webview tab
  - Adaptive theme support (light/dark)
  - SVG-based for crisp display
- ✨ **New Configuration Options**:
  - `codeStatsViewer.maxLargestFilesSidebar`: Configure sidebar file count (1-100, default: 10)
  - `codeStatsViewer.maxLargestFilesExport`: Configure export file count (1-1000, default: 20)
- 📚 **New Commands**:
  - `Code Stats: Change Sidebar Max Files` - Quick access to sidebar configuration
  - `Code Stats: Change Export Max Files` - Quick access to export configuration

### Changed
- 🎨 **Improved Webview Styling**: Enhanced visual hierarchy and spacing
  - Better card layouts with hover effects
  - Improved table styling with alternating rows
  - Enhanced button and input field designs
- 🎨 **Better Dark Mode Support**: All UI elements now fully adaptive to theme
  - Dynamic color variables for all components
  - Icon colors automatically adjust to theme
  - Better contrast ratios for accessibility

### Improved
- ⚡ **Performance Optimizations**: Faster scanning for large projects
  - Smart caching mechanism for repeated scans
  - Optimized file system traversal
  - Reduced memory footprint
- 🔄 **Auto-refresh Reliability**: Fixed issues with inconsistent updates
  - More reliable file watcher events
  - Better configuration change detection
  - Faster refresh cycles

### Fixed
- 🐛 Fixed auto-refresh not triggering on configuration changes
- 🐛 Fixed sidebar not updating after settings modification
- 🐛 Fixed webview not reflecting updated statistics
- 🐛 Fixed memory leaks in file scanning process

## [1.0.0] - 2024-01-01

### Added
- 🎉 **Initial Release**
- 📊 **Real-time Sidebar Statistics**: 4 expandable sections
  - Overview: Total files, lines, functions, classes, averages
  - Languages: Top 10 languages by line count
  - Largest Files: Top 10 largest files (clickable)
  - Export: Quick access to CSV and JSON export
- 📈 **Detailed Analytics View**: Comprehensive webview with:
  - 6 stat cards showing key metrics
  - Language breakdown table
  - Top 20 largest files table
- 💾 **Export Functionality**:
  - Export to CSV with summary, language breakdown, and file ranking
  - Export to JSON with structured data for integration
  - Timestamp-based file naming for multiple exports
- 🎨 **Custom Filtering**:
  - `codeStatsViewer.excludeDirs`: Exclude specific directories
  - `codeStatsViewer.excludePatterns`: Wildcard pattern support (*, ?)
  - `codeStatsViewer.includedExtensions`: Choose which file types to analyze
- 🌍 **Multi-language Support**: 19+ programming languages
  - JavaScript, TypeScript, Python, Java, C, C++, C#
  - PHP, Ruby, Go, Rust, Swift, Kotlin, Dart
  - Vue, Svelte, HTML, CSS, SCSS
- ⚡ **High Performance**: Optimized for large codebases
  - Non-blocking workspace scanning
  - Efficient file reading with error handling
  - Smart pattern matching algorithms
- 🔄 **Auto-refresh**: Real-time updates on:
  - File save events
  - File creation events
  - File deletion events
  - Configuration changes
- 🎯 **Commands**:
  - Show Detailed Statistics
  - Refresh Statistics
  - Export to CSV
  - Export to JSON

### Technical Details
- Minimum VS Code version: ^1.75.0
- Built with pure Node.js (no external dependencies)
- Uses VS Code Extension API only
- Smart caching for performance
- Comprehensive error handling

---

## Roadmap

### Planned Features
- [ ] Git integration (show stats per branch/commit)
- [ ] Historical trends (track changes over time)
- [ ] Custom reports (user-defined metrics)
- [ ] Team analytics (multi-developer statistics)
- [ ] Code complexity metrics (cyclomatic complexity)
- [ ] Comment ratio analysis
- [ ] Test coverage integration
- [ ] Customizable themes for webview
- [ ] Export to more formats (PDF, HTML)
- [ ] Scheduled auto-exports

### Community Requests
- [ ] Filter by date range
- [ ] Compare two branches
- [ ] Integration with project management tools
- [ ] VS Code workspace support (multi-root)
- [ ] Language-specific metrics

---

## Support

For bug reports and feature requests, please visit:
- GitHub Issues: [your-repository-url]
- Documentation: [README.md](./README.md)

## License

MIT License - See [LICENSE](./LICENSE) file for details
