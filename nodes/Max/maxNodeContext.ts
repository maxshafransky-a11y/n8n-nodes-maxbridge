import type { INode } from 'n8n-workflow';
const FALLBACK_MAX_NODE: INode = {
	id: 'max',
	name: 'Max',
	type: 'max',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};
export const getMaxNode = (context: { getNode?: () => INode }): INode => {
	if (typeof context.getNode === 'function') {
		return context.getNode();
	}
	return FALLBACK_MAX_NODE;
};