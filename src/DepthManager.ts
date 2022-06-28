import { BulletGraph, Node, IdSet, LinksMap, Edge } from './BulletGraph';
import { Id, EEdge } from './constants'

export class DepthManager {
    nodeRerouteMap: { [key:string]:Id; } = {};
    graph = new BulletGraph();

    rerouteNodes(nodeIn: Node, floorNodeIds: IdSet, hideNodeIds: IdSet, nodeOut: Node, isFloorReached = false, isHidden = false, floorNodeId = "") {
        nodeIn.children.forEach( childIn => {
            let childOut = new Node();

            let isFloorReachedForNext = isFloorReached || floorNodeIds.has(childIn.id);
            let floorNodeIdForNext = (!isFloorReached && isFloorReachedForNext) ? childIn.id : floorNodeId;

            let isHiddenForNext = isHidden || hideNodeIds.has(childIn.id);
            
            if (isHiddenForNext) { // do not show current child if hiding starts at it
                this.nodeRerouteMap[childIn.id] = "";
            } else if (isFloorReached) { // show current child if floor starts at it
                this.nodeRerouteMap[childIn.id] = floorNodeId;
            } else {
                this.nodeRerouteMap[childIn.id] = childIn.id; // reroute to itself (no effect)

                // Copy child.
                childOut.bulletType = childIn.bulletType;
                childOut.dependencySize = childIn.dependencySize;
                childOut.id = childIn.id;
                childOut.isHighlight = childIn.isHighlight;
                childOut.label = childIn.label;
                nodeOut.children.push(childOut); // add it to ouput hierarchy
            }
            this.rerouteNodes(childIn, floorNodeIds, hideNodeIds, childOut, isFloorReachedForNext, isHiddenForNext, floorNodeIdForNext);
        });
    }

    isNodeRerouted(id: Id) {
        return id != this.nodeRerouteMap[id];
    }

    rerouteLinks(links: LinksMap) {
        let processEdgeType = (type: EEdge, idSrcUnrerouted: Id, idDstUnrerouted: Id) => {
            if (type === EEdge.eEqual) {
                if (this.isNodeRerouted(idSrcUnrerouted) && this.isNodeRerouted(idDstUnrerouted)) {
                    return EEdge.eEqualFolded;
                }
                else if (this.isNodeRerouted(idSrcUnrerouted)) {
                    return EEdge.eEqualOut;
                }
                else if (this.isNodeRerouted(idDstUnrerouted)) {
                    return EEdge.eEqualIn;
                }
            }

            return type; // default, return initial type
        };

        for (var id of links.getNodeIds()) {
            const nodeId = this.nodeRerouteMap[id];
            links.getNodeLinks(id).outputs.forEach( edge => {
                if ((edge.type !== EEdge.eHierarchy) && (edge.type !== EEdge.eHierarchySibling)) {
                    const idDst = this.nodeRerouteMap[edge.idDst];
                    const linksToItself = idDst === nodeId;
                    const type = processEdgeType(edge.type, id, edge.idDst);
                    if (nodeId && idDst && !linksToItself)
                        this.graph.links.addEdge(nodeId, idDst, type);
                }
            })
            links.getNodeLinks(id).inputs.forEach( edge => {
                if ((edge.type !== EEdge.eHierarchy) && (edge.type !== EEdge.eHierarchySibling)) {
                    const idSrc = this.nodeRerouteMap[edge.idSrc];
                    const linksToItself = idSrc === nodeId;
                    const type = processEdgeType(edge.type, id, edge.idDst);
                    if (nodeId && idSrc && !linksToItself)
                        this.graph.links.addEdge(idSrc, nodeId, type);
                }
            })
        }
    }

    removeDuplicateLinksInArray(edges : Array<Edge>) {
        const isDuplicate = (edgeIdx = 0): Boolean => {
            for (let i = 0; i < edgeIdx; i++) { // avoid i === edgeIdx, to not test with itself
                if (edges[i].isEqual(edges[edgeIdx]))
                    return true;
            }
            return false;
        };

        // Find duplicates and delete them.
        for (let i = edges.length-1; i >= 0; i--) { // go backwards to not be affected by deletes
            if (isDuplicate(i)) {
                edges.splice(i, 1); // delete
            }
        }
    }

    removeDuplicateLinks() {
        let links = this.graph.links;
        let nodeIds = links.getNodeIds();
        nodeIds.forEach(nodeId => {
            let nodeLinks = links.getNodeLinks(nodeId);
            this.removeDuplicateLinksInArray(nodeLinks.inputs);
            this.removeDuplicateLinksInArray(nodeLinks.outputs);
        });
    }

    convertBackAndForthLinksToBidirectional() {
        let links = this.graph.links;
        let nodeIds = links.getNodeIds();

        const setBidirectionalIfItIs = (output: Edge, inputs: Array<Edge>): Boolean => {
            for (let input of inputs) {
                if (input.isEqual(output)) { // is bidirectional
                    output.type = EEdge.eBiLink;
                    input.type = EEdge.eBiLink;
                    return true;
                }
            }
            return false;
        };

        const updateBidirectionalLinksOfOtherNode = (otherNodeId: Id, srcNodeId: Id) => {
            let setFromList = (list: Array<Edge>) => {
                list.forEach( edge => {
                    if (edge.idDst === srcNodeId) {
                        edge.type = EEdge.eBiLink;
                        edge.mustRender = false; // deactivate if, will be rendered by other node
                    }
                });
            };

            let nodeLinks = links.getNodeLinks(otherNodeId);
            setFromList(nodeLinks.outputs);
            setFromList(nodeLinks.inputs);
        };

        nodeIds.forEach(nodeId => {
            let nodeLinks = links.getNodeLinks(nodeId);
            nodeLinks.outputs.forEach( output => {
                if (output.mustRender) { // skip if was already updated from other node
                    if (setBidirectionalIfItIs(output, nodeLinks.inputs)) { // if is bidirectional
                        updateBidirectionalLinksOfOtherNode(output.idDst, nodeId);
                    }
                }
            });
        });
    }

    pruneAndReorganize(bulletIn: BulletGraph): BulletGraph {
        this.graph.clear();
        this.rerouteNodes(bulletIn.hierarchy, bulletIn.foldNodeIds, bulletIn.hideNodeIds, this.graph.hierarchy);
        this.rerouteLinks(bulletIn.links);
        this.graph.createHierarchyEdges(this.graph.hierarchy);
        this.graph.createFlowEdges(this.graph.hierarchy);
        this.removeDuplicateLinks();
        this.convertBackAndForthLinksToBidirectional();
        
        return this.graph;
    }
}