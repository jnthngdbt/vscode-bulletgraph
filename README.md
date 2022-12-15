# vscode-bulletgraph

Extension for text-based diagram generation.

## Features

This extension defines a new format based on a bullet points structure to define hierarchies of elements and links between them using an id system.

The format allows to hide elements or collapse a hierarchy at a certain level in order to visualize overviews of complex systems without loosing connectivity information (links of collapsed elements).

Various commands allow to control what is displayed; for example, to only show elements linked to a specific element.

## Example

### Hierarchy definition

Testing mermaid graph

```mermaid
graph LR
    A --> B
```

### Links

### Flows

## Commands

## Bullet types

## Requirements

This extension depends on tintinweb.graphviz-interactive-preview .

## Package and install from source

```
cd vscode-bulletgraph
npm install
sudo npm install -g vsce typescript
vsce package
code --install-extension vscode-bulletgraph-0.0.1.vsix
```

## Release Notes

### 0.0.1

Initial release to start testing it outside the debugger.

## Troubleshoot

If the preview does not work at first render, should deactivate render lock timeout:

    "graphviz-interactive-preview.renderLockAdditionalTimeout": -1
