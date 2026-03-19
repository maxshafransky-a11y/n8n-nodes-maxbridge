import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { executeMessageResource } from './actions/message';
import { getMaxNode } from './maxNodeContext';
import { executeRawApiResource } from './actions/rawApi';
import { executeUploadResource } from './actions/upload';
import { messageDescription } from './descriptions/MessageDescription';
import { rawApiDescription } from './descriptions/RawApiDescription';
import { uploadDescription } from './descriptions/UploadDescription';
import type { MaxApiCredentialsShape } from './transport/maxApiRequest';

export class Max implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Max',
		name: 'max',
		icon: {
			light: 'file:../../icons/max.svg',
			dark: 'file:../../icons/max.dark.svg',
		},
		group: ['transform'],
		version: 1,
		usableAsTool: {
			replacements: {
				displayName: 'Max Tool',
				description: 'Use the MAX Bot API from an AI Agent tool connection',
                subtitle: '={{ "AI tool" }}',
			},
		},
		subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
		description: 'Interact with the MAX Bot API',
		defaults: {
			name: 'Max',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'maxApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Message',
						value: 'message',
					},
					{
						name: 'Upload',
						value: 'upload',
					},
					{
						name: 'Raw API',
						value: 'rawApi',
					},
				],
				default: 'message',
			},
			...messageDescription,
			...uploadDescription,
			...rawApiDescription,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const credentials = (await this.getCredentials('maxApi')) as MaxApiCredentialsShape;
		const resource = this.getNodeParameter('resource', 0) as string;

		switch (resource) {
			case 'message':
				return [await executeMessageResource(this, credentials)];
			case 'upload':
				return [await executeUploadResource(this, credentials)];
			case 'rawApi':
				return [await executeRawApiResource(this, credentials)];
			default:
				throw new NodeOperationError(getMaxNode(this), `Unsupported resource: ${resource}`);
		}
	}
}

