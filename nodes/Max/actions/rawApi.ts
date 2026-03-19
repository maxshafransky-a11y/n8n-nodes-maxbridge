import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	IHttpRequestMethods,
	IHttpRequestOptions,
} from 'n8n-workflow';

import { extractMaxErrorMessage, toMaxNodeApiError } from '../errors/maxApiError';
import { getMaxNode } from '../maxNodeContext';
import type { MaxApiCredentialsShape } from '../transport/maxApiRequest';
import { maxApiRequest } from '../transport/maxApiRequest';
import { normalizeMaxNodeResponse, parseMaxJsonParameter } from './messageHelpers';

const asQueryObject = (value: unknown): IDataObject | undefined => {
	if (value === undefined) {
		return undefined;
	}

	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error('Raw API query parameters must be a JSON object.');
	}

	return value as IDataObject;
};

const createContinueOnFailItem = (itemIndex: number, error: unknown): INodeExecutionData => ({
	json: {
		error: extractMaxErrorMessage(error),
	},
	pairedItem: {
		item: itemIndex,
	},
});

export const executeRawApiResource = async (
	context: IExecuteFunctions,
	credentials: MaxApiCredentialsShape,
): Promise<INodeExecutionData[]> => {
	const items = context.getInputData();
	const results: INodeExecutionData[] = [];

	for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
		try {
			const method = context.getNodeParameter('httpMethod', itemIndex) as IHttpRequestMethods;
			const path = context.getNodeParameter('path', itemIndex) as string;
			const returnFullResponse = context.getNodeParameter('returnFullResponse', itemIndex, false) as boolean;
			const query = asQueryObject(
				parseMaxJsonParameter(
					context.getNodeParameter('query', itemIndex, '{}'),
					'Raw API Query',
				),
			);
			const shouldSendBody = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
			const body = shouldSendBody
				? (parseMaxJsonParameter(
						context.getNodeParameter('body', itemIndex, '{}'),
						'Raw API Body',
					) as IHttpRequestOptions['body'])
				: undefined;

			const response = await maxApiRequest(context, credentials, method, path, {
				query,
				body,
				returnFullResponse,
			});
			results.push({
				json: normalizeMaxNodeResponse(response),
				pairedItem: {
					item: itemIndex,
				},
			});
		} catch (error) {
			if (context.continueOnFail()) {
				results.push(createContinueOnFailItem(itemIndex, error));
				continue;
			}

			throw toMaxNodeApiError(getMaxNode(context), error);
		}
	}

	return results;
};