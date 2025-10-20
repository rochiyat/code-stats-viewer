const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

let statsCache = null;
let treeDataProvider = null;

function activate(context) {
    console.log('Code Stats Viewer is now active');

    treeDataProvider = new StatsTreeDataProvider();
    const treeView = vscode.window.createTreeView('codeStatsView', {
        treeDataProvider: treeDataProvider,
        showCollapseAll: true
    });

    const showStatsCommand = vscode.commands.registerCommand('code-stats-viewer.showStats', () => {
        showDetailedStats(context);
    });

    const refreshCommand = vscode.commands.registerCommand('code-stats-viewer.refresh', () => {
        statsCache = null;
        treeDataProvider.refresh();
        vscode.window.showInformationMessage('Code statistics refreshed');
    });

    const exportCSVCommand = vscode.commands.registerCommand('code-stats-viewer.exportCSV', async () => {
        await exportToCSV();
    });

    const exportJSONCommand = vscode.commands.registerCommand('code-stats-viewer.exportJSON', async () => {
        await exportToJSON();
    });

    const changeSidebarMaxCommand = vscode.commands.registerCommand('code-stats-viewer.changeSidebarMax', async () => {
        await changeSidebarMaxFiles();
    });

    const changeExportMaxCommand = vscode.commands.registerCommand('code-stats-viewer.changeExportMax', async () => {
        await changeExportMaxFiles();
    });

    const saveListener = vscode.workspace.onDidSaveTextDocument(() => {
        statsCache = null;
        treeDataProvider.refresh();
    });

    const createListener = vscode.workspace.onDidCreateFiles(() => {
        statsCache = null;
        treeDataProvider.refresh();
    });

    const deleteListener = vscode.workspace.onDidDeleteFiles(() => {
        statsCache = null;
        treeDataProvider.refresh();
    });

    const configListener = vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('codeStatsViewer')) {
            statsCache = null;
            treeDataProvider.refresh();
        }
    });

    context.subscriptions.push(
        treeView,
        showStatsCommand,
        refreshCommand,
        exportCSVCommand,
        exportJSONCommand,
        changeSidebarMaxCommand,
        changeExportMaxCommand,
        saveListener,
        createListener,
        deleteListener,
        configListener
    );

    treeDataProvider.refresh();
}

function deactivate() {
    statsCache = null;
}

class StatsTreeDataProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element) {
        return element;
    }

    async getChildren(element) {
        if (!vscode.workspace.workspaceFolders) {
            return [];
        }

        const stats = await analyzeWorkspace();

        if (!element) {
            return [
                new StatsItem('Overview', vscode.TreeItemCollapsibleState.Collapsed, 'overview'),
                new StatsItem('Languages', vscode.TreeItemCollapsibleState.Collapsed, 'languages'),
                new StatsItem('Largest Files', vscode.TreeItemCollapsibleState.Collapsed, 'files'),
                new StatsItem('Settings', vscode.TreeItemCollapsibleState.Collapsed, 'settings'),
                new StatsItem('Export', vscode.TreeItemCollapsibleState.Collapsed, 'export')
            ];
        }

        if (element.contextValue === 'overview') {
            return [
                new StatsItem(`📁 Total Files: ${stats.totalFiles}`, vscode.TreeItemCollapsibleState.None, 'stat'),
                new StatsItem(`📝 Total Lines: ${stats.totalLines.toLocaleString()}`, vscode.TreeItemCollapsibleState.None, 'stat'),
                new StatsItem(`⚡ Functions: ${stats.totalFunctions.toLocaleString()}`, vscode.TreeItemCollapsibleState.None, 'stat'),
                new StatsItem(`🏛️ Classes: ${stats.totalClasses.toLocaleString()}`, vscode.TreeItemCollapsibleState.None, 'stat'),
                new StatsItem(`📊 Avg Lines/File: ${stats.avgLinesPerFile}`, vscode.TreeItemCollapsibleState.None, 'stat')
            ];
        }

        if (element.contextValue === 'languages') {
            const top10 = stats.languageBreakdown.slice(0, 10);
            return top10.map(lang => 
                new StatsItem(
                    `${lang.language}: ${lang.files} files (${lang.lines.toLocaleString()} lines)`,
                    vscode.TreeItemCollapsibleState.None,
                    'language'
                )
            );
        }

        if (element.contextValue === 'files') {
            const maxFiles = vscode.workspace.getConfiguration('codeStatsViewer').get('maxLargestFilesSidebar', 10);
            const topFiles = stats.largestFiles.slice(0, maxFiles);
            return topFiles.map((file, index) => {
                const item = new StatsItem(
                    `${index + 1}. ${path.basename(file.path)} (${file.lines.toLocaleString()} lines)`,
                    vscode.TreeItemCollapsibleState.None,
                    'file'
                );
                item.command = {
                    command: 'vscode.open',
                    title: 'Open File',
                    arguments: [vscode.Uri.file(file.path)]
                };
                item.tooltip = file.path;
                return item;
            });
        }

        if (element.contextValue === 'settings') {
            const config = vscode.workspace.getConfiguration('codeStatsViewer');
            const maxSidebar = config.get('maxLargestFilesSidebar', 10);
            const maxExport = config.get('maxLargestFilesExport', 20);

            const sidebarItem = new StatsItem(
                `📊 Sidebar Files: ${maxSidebar}`,
                vscode.TreeItemCollapsibleState.None,
                'setting-sidebar'
            );
            sidebarItem.command = {
                command: 'code-stats-viewer.changeSidebarMax',
                title: 'Change Sidebar Max Files'
            };
            sidebarItem.tooltip = 'Click to change max files in sidebar (1-100)';

            const exportItem = new StatsItem(
                `💾 Export Files: ${maxExport}`,
                vscode.TreeItemCollapsibleState.None,
                'setting-export'
            );
            exportItem.command = {
                command: 'code-stats-viewer.changeExportMax',
                title: 'Change Export Max Files'
            };
            exportItem.tooltip = 'Click to change max files in export (1-1000)';

            return [sidebarItem, exportItem];
        }

        if (element.contextValue === 'export') {
            const csvItem = new StatsItem('📄 Export to CSV', vscode.TreeItemCollapsibleState.None, 'export-action');
            csvItem.command = {
                command: 'code-stats-viewer.exportCSV',
                title: 'Export to CSV'
            };

            const jsonItem = new StatsItem('📋 Export to JSON', vscode.TreeItemCollapsibleState.None, 'export-action');
            jsonItem.command = {
                command: 'code-stats-viewer.exportJSON',
                title: 'Export to JSON'
            };

            return [csvItem, jsonItem];
        }

        return [];
    }
}

class StatsItem extends vscode.TreeItem {
    constructor(label, collapsibleState, contextValue) {
        super(label, collapsibleState);
        this.contextValue = contextValue;
    }
}

async function analyzeWorkspace() {
    if (statsCache) {
        return statsCache;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        return getEmptyStats();
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const excludePatterns = getExcludePatterns();
    const includedExtensions = vscode.workspace.getConfiguration('codeStatsViewer').get('includedExtensions');

    const stats = {
        totalFiles: 0,
        totalLines: 0,
        totalFunctions: 0,
        totalClasses: 0,
        avgLinesPerFile: 0,
        languageBreakdown: {},
        largestFiles: []
    };

    try {
        await scanDirectory(rootPath, rootPath, stats, excludePatterns, includedExtensions);
        
        stats.avgLinesPerFile = stats.totalFiles > 0 
            ? Math.round(stats.totalLines / stats.totalFiles) 
            : 0;

        stats.languageBreakdown = Object.entries(stats.languageBreakdown)
            .map(([lang, data]) => ({
                language: lang,
                files: data.files,
                lines: data.lines,
                avgLinesPerFile: Math.round(data.lines / data.files)
            }))
            .sort((a, b) => b.lines - a.lines);

        stats.largestFiles.sort((a, b) => b.lines - a.lines);

        statsCache = stats;
        return stats;
    } catch (error) {
        vscode.window.showErrorMessage(`Error analyzing workspace: ${error.message}`);
        return getEmptyStats();
    }
}

async function scanDirectory(dirPath, rootPath, stats, excludePatterns, includedExtensions) {
    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            const relativePath = path.relative(rootPath, fullPath);

            if (shouldExcludeFile(relativePath, entry.name, entry.isDirectory(), excludePatterns)) {
                continue;
            }

            if (entry.isDirectory()) {
                await scanDirectory(fullPath, rootPath, stats, excludePatterns, includedExtensions);
            } else {
                const ext = path.extname(entry.name);
                if (!includedExtensions.includes(ext)) {
                    continue;
                }

                try {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    const lines = content.split('\n').length;
                    const language = getLanguageFromExtension(ext);

                    stats.totalFiles++;
                    stats.totalLines += lines;

                    const functions = countFunctions(content, language);
                    const classes = countClasses(content, language);
                    stats.totalFunctions += functions;
                    stats.totalClasses += classes;

                    if (!stats.languageBreakdown[language]) {
                        stats.languageBreakdown[language] = { files: 0, lines: 0 };
                    }
                    stats.languageBreakdown[language].files++;
                    stats.languageBreakdown[language].lines += lines;

                    stats.largestFiles.push({
                        path: fullPath,
                        lines: lines,
                        language: language
                    });
                } catch (error) {
                    // Skip files that can't be read
                }
            }
        }
    } catch (error) {
        // Skip directories that can't be read
    }
}

function getExcludePatterns() {
    const config = vscode.workspace.getConfiguration('codeStatsViewer');
    const excludeDirs = config.get('excludeDirs') || [];
    const excludePatterns = config.get('excludePatterns') || [];
    
    return {
        dirs: excludeDirs,
        patterns: excludePatterns
    };
}

function shouldExcludeFile(relativePath, fileName, isDirectory, excludePatterns) {
    const pathParts = relativePath.split(path.sep);

    if (isDirectory && excludePatterns.dirs.some(dir => pathParts.includes(dir))) {
        return true;
    }

    for (const pattern of excludePatterns.patterns) {
        if (matchPattern(fileName, pattern)) {
            return true;
        }
    }

    return false;
}

function matchPattern(fileName, pattern) {
    const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(fileName);
}

function getLanguageFromExtension(ext) {
    const languageMap = {
        '.js': 'JavaScript',
        '.jsx': 'JavaScript',
        '.ts': 'TypeScript',
        '.tsx': 'TypeScript',
        '.py': 'Python',
        '.java': 'Java',
        '.c': 'C',
        '.cpp': 'C++',
        '.cc': 'C++',
        '.cxx': 'C++',
        '.cs': 'C#',
        '.php': 'PHP',
        '.rb': 'Ruby',
        '.go': 'Go',
        '.rs': 'Rust',
        '.swift': 'Swift',
        '.kt': 'Kotlin',
        '.dart': 'Dart',
        '.vue': 'Vue',
        '.svelte': 'Svelte',
        '.html': 'HTML',
        '.css': 'CSS',
        '.scss': 'SCSS'
    };
    return languageMap[ext] || 'Other';
}

function countFunctions(content, language) {
    const patterns = {
        'JavaScript': [
            /function\s+\w+/g,
            /const\s+\w+\s*=\s*\([^)]*\)\s*=>/g,
            /\w+\s*\([^)]*\)\s*{/g
        ],
        'TypeScript': [
            /function\s+\w+/g,
            /const\s+\w+\s*=\s*\([^)]*\)\s*=>/g,
            /\w+\s*\([^)]*\)\s*{/g
        ],
        'Python': [/def\s+\w+/g],
        'Java': [/(public|private|protected)?\s*\w+\s+\w+\s*\([^)]*\)/g],
        'C': [/\w+\s+\w+\s*\([^)]*\)\s*{/g],
        'C++': [/\w+\s+\w+\s*\([^)]*\)\s*{/g],
        'C#': [/(public|private|protected)?\s*\w+\s+\w+\s*\([^)]*\)/g],
        'PHP': [/function\s+\w+/g],
        'Ruby': [/def\s+\w+/g],
        'Go': [/func\s+\w+/g],
        'Rust': [/fn\s+\w+/g],
        'Swift': [/func\s+\w+/g],
        'Kotlin': [/fun\s+\w+/g]
    };

    const langPatterns = patterns[language] || [];
    let count = 0;

    for (const pattern of langPatterns) {
        const matches = content.match(pattern);
        if (matches) {
            count += matches.length;
        }
    }

    return count;
}

function countClasses(content, language) {
    const patterns = {
        'JavaScript': [/class\s+\w+/g],
        'TypeScript': [/class\s+\w+/g, /interface\s+\w+/g],
        'Python': [/class\s+\w+/g],
        'Java': [/(public|private|protected)?\s*class\s+\w+/g],
        'C++': [/class\s+\w+/g],
        'C#': [/(public|private|protected)?\s*class\s+\w+/g],
        'PHP': [/class\s+\w+/g],
        'Ruby': [/class\s+\w+/g],
        'Swift': [/class\s+\w+/g, /struct\s+\w+/g],
        'Kotlin': [/class\s+\w+/g]
    };

    const langPatterns = patterns[language] || [];
    let count = 0;

    for (const pattern of langPatterns) {
        const matches = content.match(pattern);
        if (matches) {
            count += matches.length;
        }
    }

    return count;
}

async function changeSidebarMaxFiles() {
    const config = vscode.workspace.getConfiguration('codeStatsViewer');
    const currentValue = config.get('maxLargestFilesSidebar', 10);

    const input = await vscode.window.showInputBox({
        prompt: 'Enter maximum number of largest files to show in sidebar',
        value: currentValue.toString(),
        placeHolder: '10',
        validateInput: (value) => {
            const num = parseInt(value);
            if (isNaN(num)) {
                return 'Please enter a valid number';
            }
            if (num < 1 || num > 100) {
                return 'Value must be between 1 and 100';
            }
            return null;
        }
    });

    if (input !== undefined) {
        const newValue = parseInt(input);
        await config.update('maxLargestFilesSidebar', newValue, vscode.ConfigurationTarget.Workspace);
        vscode.window.showInformationMessage(`Sidebar max files updated to ${newValue}`);
        statsCache = null;
        treeDataProvider.refresh();
    }
}

async function changeExportMaxFiles() {
    const config = vscode.workspace.getConfiguration('codeStatsViewer');
    const currentValue = config.get('maxLargestFilesExport', 20);

    const input = await vscode.window.showInputBox({
        prompt: 'Enter maximum number of largest files to include in exports',
        value: currentValue.toString(),
        placeHolder: '20',
        validateInput: (value) => {
            const num = parseInt(value);
            if (isNaN(num)) {
                return 'Please enter a valid number';
            }
            if (num < 1 || num > 1000) {
                return 'Value must be between 1 and 1000';
            }
            return null;
        }
    });

    if (input !== undefined) {
        const newValue = parseInt(input);
        await config.update('maxLargestFilesExport', newValue, vscode.ConfigurationTarget.Workspace);
        vscode.window.showInformationMessage(`Export max files updated to ${newValue}`);
        statsCache = null;
        treeDataProvider.refresh();
    }
}

async function exportToCSV() {
    const stats = await analyzeWorkspace();
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const fileName = `code-stats-${timestamp}.csv`;

    const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name || 'Unknown';
    
    let csv = 'Code Statistics Export\n\n';
    csv += 'Summary Metrics\n';
    csv += 'Metric,Value\n';
    csv += `Total Files,${stats.totalFiles}\n`;
    csv += `Total Lines,${stats.totalLines}\n`;
    csv += `Total Functions,${stats.totalFunctions}\n`;
    csv += `Total Classes,${stats.totalClasses}\n`;
    csv += `Average Lines per File,${stats.avgLinesPerFile}\n`;
    csv += `Workspace,${workspaceName}\n`;
    csv += `Export Date,${new Date().toISOString()}\n\n`;

    csv += 'Language Breakdown\n';
    csv += 'Language,Files,Lines,Avg Lines per File\n';
    for (const lang of stats.languageBreakdown) {
        csv += `${lang.language},${lang.files},${lang.lines},${lang.avgLinesPerFile}\n`;
    }

    const maxExportFiles = vscode.workspace.getConfiguration('codeStatsViewer').get('maxLargestFilesExport', 20);

    csv += '\nLargest Files\n';
    csv += 'Rank,File Path,Lines,Language\n';
    stats.largestFiles.slice(0, maxExportFiles).forEach((file, index) => {
        csv += `${index + 1},${file.path},${file.lines},${file.language}\n`;
    });

    try {
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(fileName),
            filters: { 'CSV Files': ['csv'] }
        });

        if (uri) {
            fs.writeFileSync(uri.fsPath, csv, 'utf8');
            vscode.window.showInformationMessage(`Statistics exported to ${fileName}`);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Export failed: ${error.message}`);
    }
}

async function exportToJSON() {
    const stats = await analyzeWorkspace();
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const fileName = `code-stats-${timestamp}.json`;

    const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name || 'Unknown';
    const maxExportFiles = vscode.workspace.getConfiguration('codeStatsViewer').get('maxLargestFilesExport', 20);

    const exportData = {
        exportDate: new Date().toISOString(),
        workspace: workspaceName,
        summary: {
            totalFiles: stats.totalFiles,
            totalLines: stats.totalLines,
            totalFunctions: stats.totalFunctions,
            totalClasses: stats.totalClasses,
            avgLinesPerFile: stats.avgLinesPerFile
        },
        languageBreakdown: stats.languageBreakdown,
        largestFiles: stats.largestFiles.slice(0, maxExportFiles).map((file, index) => ({
            rank: index + 1,
            path: file.path,
            lines: file.lines,
            language: file.language
        }))
    };

    try {
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(fileName),
            filters: { 'JSON Files': ['json'] }
        });

        if (uri) {
            fs.writeFileSync(uri.fsPath, JSON.stringify(exportData, null, 2), 'utf8');
            vscode.window.showInformationMessage(`Statistics exported to ${fileName}`);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Export failed: ${error.message}`);
    }
}

async function showDetailedStats(context) {
    const stats = await analyzeWorkspace();
    const panel = vscode.window.createWebviewPanel(
        'codeStats',
        'Code Statistics',
        vscode.ViewColumn.One,
        {
            enableScripts: true
        }
    );
    
    panel.iconPath = {
        light: vscode.Uri.file(path.join(context.extensionPath, 'resources', 'icon-light.svg')),
        dark: vscode.Uri.file(path.join(context.extensionPath, 'resources', 'icon-dark.svg'))
    };

    panel.webview.html = getWebviewContent(stats);

    panel.webview.onDidReceiveMessage(
        async message => {
            switch (message.command) {
                case 'exportCSV':
                    await exportToCSV();
                    break;
                case 'exportJSON':
                    await exportToJSON();
                    break;
                case 'updateSettings':
                    const config = vscode.workspace.getConfiguration('codeStatsViewer');
                    if (message.setting === 'sidebar') {
                        await config.update('maxLargestFilesSidebar', message.value, vscode.ConfigurationTarget.Workspace);
                        vscode.window.showInformationMessage(`Sidebar max files updated to ${message.value}`);
                    } else if (message.setting === 'export') {
                        await config.update('maxLargestFilesExport', message.value, vscode.ConfigurationTarget.Workspace);
                        vscode.window.showInformationMessage(`Export max files updated to ${message.value}`);
                    }
                    statsCache = null;
                    treeDataProvider.refresh();
                    panel.webview.html = getWebviewContent(await analyzeWorkspace());
                    break;
                case 'openFile':
                    try {
                        const fileUri = vscode.Uri.file(message.filePath);
                        const document = await vscode.workspace.openTextDocument(fileUri);
                        await vscode.window.showTextDocument(document, { preview: false });
                    } catch (error) {
                        vscode.window.showErrorMessage(`Could not open file: ${error.message}`);
                    }
                    break;
            }
        },
        undefined,
        context.subscriptions
    );
}

function getLanguageIcon(language) {
    const icons = {
        'JavaScript': '📜',
        'TypeScript': '📘',
        'Python': '🐍',
        'Java': '☕',
        'C': '⚙️',
        'C++': '⚡',
        'C#': '🎯',
        'PHP': '🐘',
        'Ruby': '💎',
        'Go': '🐹',
        'Rust': '🦀',
        'Swift': '🦅',
        'Kotlin': '🟣',
        'Dart': '🎯',
        'Vue': '💚',
        'Svelte': '🧡',
        'HTML': '🌐',
        'CSS': '🎨',
        'SCSS': '💅',
        'Other': '📄'
    };
    return icons[language] || '📄';
}

function getWebviewContent(stats) {
    const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name || 'Unknown';
    const config = vscode.workspace.getConfiguration('codeStatsViewer');
    const maxSidebarFiles = config.get('maxLargestFilesSidebar', 10);
    const maxExportFiles = config.get('maxLargestFilesExport', 20);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code Statistics</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        h1 {
            font-size: 28px;
            font-weight: 600;
        }
        .export-buttons {
            display: flex;
            gap: 10px;
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            cursor: pointer;
            border-radius: 4px;
            font-size: 13px;
            transition: background-color 0.2s;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 20px;
            border-radius: 8px;
            border: 1px solid var(--vscode-panel-border);
            transition: transform 0.2s;
        }
        .stat-card:hover {
            transform: translateY(-2px);
        }
        .stat-value {
            font-size: 32px;
            font-weight: bold;
            margin: 10px 0;
            color: var(--vscode-textLink-foreground);
        }
        .stat-label {
            font-size: 14px;
            color: var(--vscode-descriptionForeground);
        }
        .section {
            margin-bottom: 30px;
        }
        h2 {
            font-size: 20px;
            margin-bottom: 15px;
            color: var(--vscode-foreground);
        }
        table {
            width: 100%;
            border-collapse: collapse;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 8px;
            overflow: hidden;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        th {
            background-color: var(--vscode-editor-selectionBackground);
            font-weight: 600;
        }
        tr:last-child td {
            border-bottom: none;
        }
        tr:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .file-link {
            color: var(--vscode-textLink-foreground);
            cursor: pointer;
            text-decoration: none;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .file-link:hover {
            text-decoration: underline;
            color: var(--vscode-textLink-activeForeground);
        }
        .file-icon {
            font-size: 16px;
            flex-shrink: 0;
        }
        .file-path-text {
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .workspace-info {
            color: var(--vscode-descriptionForeground);
            font-size: 14px;
            margin-bottom: 5px;
        }
        .settings-section {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
            border: 1px solid var(--vscode-panel-border);
        }
        .settings-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }
        .setting-item {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .setting-item label {
            font-size: 13px;
            white-space: nowrap;
        }
        .setting-item input {
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 6px 10px;
            border-radius: 4px;
            font-size: 13px;
            width: 80px;
        }
        .setting-item input:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }
        .setting-item button {
            padding: 6px 12px;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h1>📊 Code Statistics</h1>
            <div class="workspace-info">Workspace: ${workspaceName}</div>
            <div class="workspace-info">Generated: ${new Date().toLocaleString()}</div>
        </div>
        <div class="export-buttons">
            <button onclick="exportCSV()">📄 Export CSV</button>
            <button onclick="exportJSON()">📋 Export JSON</button>
        </div>
    </div>

    <div class="settings-section">
        <h2>⚙️ Display Settings</h2>
        <div class="settings-grid">
            <div class="setting-item">
                <label for="sidebarMax">Sidebar Max Files (1-100):</label>
                <input type="number" id="sidebarMax" value="${maxSidebarFiles}" min="1" max="100" />
                <button onclick="updateSidebarMax()">Update</button>
            </div>
            <div class="setting-item">
                <label for="exportMax">Export Max Files (1-1000):</label>
                <input type="number" id="exportMax" value="${maxExportFiles}" min="1" max="1000" />
                <button onclick="updateExportMax()">Update</button>
            </div>
        </div>
    </div>

    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-label">Total Files</div>
            <div class="stat-value">${stats.totalFiles}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Total Lines</div>
            <div class="stat-value">${stats.totalLines.toLocaleString()}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Functions</div>
            <div class="stat-value">${stats.totalFunctions.toLocaleString()}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Classes</div>
            <div class="stat-value">${stats.totalClasses.toLocaleString()}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Avg Lines/File</div>
            <div class="stat-value">${stats.avgLinesPerFile}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Languages</div>
            <div class="stat-value">${stats.languageBreakdown.length}</div>
        </div>
    </div>

    <div class="section">
        <h2>📚 Language Breakdown</h2>
        <table>
            <thead>
                <tr>
                    <th>Language</th>
                    <th>Files</th>
                    <th>Lines</th>
                    <th>Avg Lines/File</th>
                </tr>
            </thead>
            <tbody>
                ${stats.languageBreakdown.map(lang => `
                    <tr>
                        <td>${lang.language}</td>
                        <td>${lang.files}</td>
                        <td>${lang.lines.toLocaleString()}</td>
                        <td>${lang.avgLinesPerFile}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>📁 Top ${maxExportFiles} Largest Files</h2>
        <table>
            <thead>
                <tr>
                    <th>Rank</th>
                    <th>File Path</th>
                    <th>Lines</th>
                    <th>Language</th>
                </tr>
            </thead>
            <tbody>
                ${stats.largestFiles.slice(0, maxExportFiles).map((file, index) => `
                    <tr>
                        <td>${index + 1}</td>
                        <td>
                            <a class="file-link" onclick="openFile('${file.path.replace(/\\/g, '\\\\')}')">
                                <span class="file-icon">${getLanguageIcon(file.language)}</span>
                                <span class="file-path-text" title="${file.path}">${file.path}</span>
                            </a>
                        </td>
                        <td>${file.lines.toLocaleString()}</td>
                        <td>${file.language}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function exportCSV() {
            vscode.postMessage({ command: 'exportCSV' });
        }

        function exportJSON() {
            vscode.postMessage({ command: 'exportJSON' });
        }

        function updateSidebarMax() {
            const input = document.getElementById('sidebarMax');
            const value = parseInt(input.value);
            if (value >= 1 && value <= 100) {
                vscode.postMessage({ 
                    command: 'updateSettings', 
                    setting: 'sidebar', 
                    value: value 
                });
            } else {
                alert('Value must be between 1 and 100');
            }
        }

        function updateExportMax() {
            const input = document.getElementById('exportMax');
            const value = parseInt(input.value);
            if (value >= 1 && value <= 1000) {
                vscode.postMessage({ 
                    command: 'updateSettings', 
                    setting: 'export', 
                    value: value 
                });
            } else {
                alert('Value must be between 1 and 1000');
            }
        }

        function openFile(filePath) {
            vscode.postMessage({ 
                command: 'openFile', 
                filePath: filePath 
            });
        }
    </script>
</body>
</html>`;
}

function getEmptyStats() {
    return {
        totalFiles: 0,
        totalLines: 0,
        totalFunctions: 0,
        totalClasses: 0,
        avgLinesPerFile: 0,
        languageBreakdown: [],
        largestFiles: []
    };
}

module.exports = {
    activate,
    deactivate
};
