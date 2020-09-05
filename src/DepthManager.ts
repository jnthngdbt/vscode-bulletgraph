import { BulletGraph, Node, IdSet, LinksMap, Edge } from './BulletGraph';
import { Id, EEdge } from './constants'

export class DepthManager {
    nodeRerouteMap: { [key:string]:Id; } = {};
    bullet = new BulletGraph();

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
                childOut.bullet = childIn.bullet;
                childOut.dependencySize = childIn.dependencySize;
                childOut.id = childIn.id;
                childOut.isHighlight = childIn.isHighlight;
                childOut.label = childIn.label;
                nodeOut.children.push(childOut); // add it to ouput hierarchy
            }
            this.rerouteNodes(childIn, floorNodeIds, hideNodeIds, childOut, isFloorReachedForNext, isHiddenForNext, floorNodeIdForNext);
        });
    }

    rerouteLinks(links: LinksMap) {
        for (var id of links.getNodeIds()) {
            const nodeId = this.nodeRerouteMap[id];
            links.getNodeLinks(id).outputs.forEach( edge => {
                if (edge.type !== EEdge.eHierarchy) {
                    const idDst = this.nodeRerouteMap[edge.idDst];
                    if (nodeId && idDst && (idDst !== nodeId))
                        this.bullet.links.addEdge(nodeId, idDst, edge.type);
                }
            })
            links.getNodeLinks(id).inputs.forEach( edge => {
                if (edge.type !== EEdge.eHierarchy) {
                    const idSrc = this.nodeRerouteMap[edge.idSrc];
                    if (nodeId && idSrc && (idSrc !== nodeId))
                        this.bullet.links.addEdge(idSrc, nodeId, edge.type);
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
        let links = this.bullet.links;
        let nodeIds = links.getNodeIds();
        nodeIds.forEach(nodeId => {
            let nodeLinks = links.getNodeLinks(nodeId);
            this.removeDuplicateLinksInArray(nodeLinks.inputs);
            this.removeDuplicateLinksInArray(nodeLinks.outputs);
        });
    }

    convertBackAndForthLinksToBidirectional() {
        let links = this.bullet.links;
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
        this.bullet.clear();
        this.rerouteNodes(bulletIn.hierarchy, bulletIn.floorNodeIds, bulletIn.hideNodeIds, this.bullet.hierarchy);
        this.rerouteLinks(bulletIn.links);
        this.bullet.createHierarchyEdges(this.bullet.hierarchy);
        this.removeDuplicateLinks();
        this.convertBackAndForthLinksToBidirectional();
        
        return this.bullet;
    }
}