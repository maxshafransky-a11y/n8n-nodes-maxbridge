import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { extractMaxErrorMessage, toMaxNodeApiError } from '../errors/maxApiError';
import { getMaxNode } from '../maxNodeContext';
import type { MaxApiCredentialsShape } from '../transport/maxApiRequest';
import { maxApiRequest } from '../transport/maxApiRequest';
import {
	buildMaxMessageAttachment,
	buildMaxUploadFormData,
	buildMaxUploadRequestQuery,
	maxUploadBinaryRequest,
} from '../uploads/maxUpload';
import { normalizeMaxNodeResponse } from './messageHelpers';

const asDataObject = (value: unknown, errorMessage: string): IDataObject => {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error(errorMessage);
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

export const executeUploadResource = async (
	context: IExecuteFunctions,
	credentials: MaxApiCredentialsShape,
): Promise<INodeExecutionData[]> => {
	const items = context.getInputData();
	const results: INodeExecutionData[] = [];

	for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
		try {
			const operation = context.getNodeParameter('operation', itemIndex) as string;
			const attachmentType = context.getNodeParameter('attachmentType', itemIndex) as
				| 'audio'
				| 'file'
				| 'image'
				| 'video';
			let response: unknown;

			switch (operation) {
				case 'getUploadUrl': {
					response = await maxApiRequest(context, credentials, 'POST', '/uploads', {
						query: buildMaxUploadRequestQuery(attachmentType),
					});
					break;
				}
				case 'uploadBinary': {
					const binaryProperty = context.getNodeParameter('binaryProperty', itemIndex) as string;
					const uploadUrl = context.getNodeParameter('uploadUrl', itemIndex) as string;
					const binaryData = context.helpers.assertBinaryData(itemIndex, binaryProperty);
					const buffer = await context.helpers.getBinaryDataBuffer(itemIndex, binaryProperty);
					response = await maxUploadBinaryRequest(
						context,
						credentials,
						uploadUrl,
						buildMaxUploadFormData({
							data: buffer,
							fileName: binaryData.fileName ?? binaryProperty,
							mimeType: binaryData.mimeType,
						}),
					);
					break;
				}
				case 'uploadAndReturnAttachment': {
					const binaryProperty = context.getNodeParameter('binaryProperty', itemIndex) as string;
					const binaryData = context.helpers.assertBinaryData(itemIndex, binaryProperty);
					const buffer = await context.helpers.getBinaryDataBuffer(itemIndex, binaryProperty);
					const uploadLinkResponse = asDataObject(
						await maxApiRequest(context, credentials, 'POST', '/uploads', {
							query: buildMaxUploadRequestQuery(attachmentType),
						}),
						'MAX upload link response must be an object.',
					);
					if (typeof uploadLinkResponse.url !== 'string' || uploadLinkResponse.url.length === 0) {
						throw new Error('MAX upload link response does not contain a valid upload URL.');
					}

					const uploadResult = asDataObject(
						await maxUploadBinaryRequest(
							context,
							credentials,
							uploadLinkResponse.url,
							buildMaxUploadFormData({
								data: buffer,
								fileName: binaryData.fileName ?? binaryProperty,
								mimeType: binaryData.mimeType,
							}),
						),
						'MAX upload result must be an object.',
					);

					response = {
						attachment: buildMaxMessageAttachment(attachmentType, uploadLinkResponse, uploadResult),
						uploadLink: uploadLinkResponse,
						uploadResult,
					};
					break;
				}
				default:
					throw new Error(`Unsupported upload operation: ${operation}`);
			}

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