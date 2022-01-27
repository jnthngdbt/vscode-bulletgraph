# vscode-bulletgraph README

Extension for text-based diagram documentation.

## Features

## Requirements

This extension depends on tintinweb.graphviz-interactive-preview.

## Extension Settings

## Package and install from source

```
cd vscode-bulletgraph
npm install
sudo npm install -g vsce typescript
vsce package
code --install-extension vscode-bulletgraph-0.0.1.vsix
```

## Release Notes

### 1.0.0

Initial release to start testing it outside the debugger.

## Notes

If the preview does not work at first render, should deactivate render lock timeout:

    "graphviz-interactive-preview.renderLockAdditionalTimeout": -1
