import { sleep } from 'n8n-workflow';
import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import {
	extractMaxErrorMessage,
	isMaxAttachmentNotReadyError,
	toMaxNodeApiError,
} from '../errors/maxApiError';
import type { MaxApiCredentialsShape } from '../transport/maxApiRequest';
import { maxApiRequest } from '../transport/maxApiRequest';
import { getMaxNode } from '../maxNodeContext';
import { buildMaxUploadRetryDelays } from '../uploads/maxUpload';
import {
	buildMaxAnswerCallbackBody,
	buildMaxMessageBody,
	buildMaxSendMessageQuery,
	getMaxAttachmentRetryOptions,
	hasMaxMessageAttachments,
	normalizeMaxMessageOperationResponse,
} from './messageHelpers';

const createContinueOnFailItem = (itemIndex: number, error: unknown): INodeExecutionData => ({
	json: {
		error: extractMaxErrorMessage(error),
	},
	pairedItem: {
		item: itemIndex,
	},
});

const waitFor = async (delayMs: number): Promise<void> => {
	if (delayMs <= 0) {
		return;
	}

	await sleep(delayMs);
};

export interface MaxAttachmentRetryConfig {
	enabled: boolean;
	retryCount: number;
	baseDelayMs: number;
}

export const executeWithAttachmentRetry = async <T>(
	requestFn: () => Promise<T>,
	retryConfig: MaxAttachmentRetryConfig,
	waitFn: (delayMs: number) => Promise<void> = waitFor,
): Promise<T> => {
	try {
		return await requestFn();
	} catch (error) {
		if (
			!retryConfig.enabled ||
			retryConfig.retryCount <= 0 ||
			!isMaxAttachmentNotReadyError(error)
		) {
			throw error;
		}

		let lastError = error;
		for (const delayMs of buildMaxUploadRetryDelays(
			retryConfig.retryCount,
			retryConfig.baseDelayMs,
		)) {
			await waitFn(delayMs);

			try {
				return await requestFn();
			} catch (retryError) {
				if (!isMaxAttachmentNotReadyError(retryError)) {
					throw retryError;
				}

				lastError = retryError;
			}
		}

		throw lastError;
	}
};

export const executeMessageResource = async (
	context: IExecuteFunctions,
	credentials: MaxApiCredentialsShape,
): Promise<INodeExecutionData[]> => {
	const items = context.getInputData();
	const results: INodeExecutionData[] = [];

	for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
		try {
			const operation = context.getNodeParameter('operation', itemIndex) as string;
			let response: unknown;

			switch (operation) {
				case 'send': {
					const recipientType = context.getNodeParameter('recipientType', itemIndex) as 'chat' | 'user';
					const recipientParameter = recipientType === 'chat' ? 'chatId' : 'userId';
					const recipientId = context.getNodeParameter(recipientParameter, itemIndex) as string;
					const additionalFields = context.getNodeParameter(
						'additionalFields',
						itemIndex,
						{},
					) as IDataObject;
					const body = buildMaxMessageBody({
						text: context.getNodeParameter('text', itemIndex, '') as string,
						format: context.getNodeParameter('format', itemIndex, 'markdown') as 'markdown' | 'html',
						attachments: additionalFields.attachmentsJson,
						link: additionalFields.linkJson,
						notify:
							typeof additionalFields.notify === 'boolean' ? additionalFields.notify : undefined,
						requireContent: true,
					});
					response = await executeWithAttachmentRetry(
						() =>
							maxApiRequest(context, credentials, 'POST', '/messages', {
								query: buildMaxSendMessageQuery(
									recipientType,
									recipientId,
									additionalFields.disableLinkPreview === true,
								),
								body,
							}),
						{
							enabled: hasMaxMessageAttachments(body),
							...getMaxAttachmentRetryOptions(additionalFields),
						},
					);
					break;
				}
				case 'get': {
					const messageId = context.getNodeParameter('messageId', itemIndex) as string;
					response = await maxApiRequest(
						context,
						credentials,
						'GET',
						`/messages/${encodeURIComponent(messageId)}`,
					);
					break;
				}
				case 'edit': {
					const messageId = context.getNodeParameter('messageId', itemIndex) as string;
					const additionalFields = context.getNodeParameter(
						'additionalFields',
						itemIndex,
						{},
					) as IDataObject;
					const body = buildMaxMessageBody({
						text: context.getNodeParameter('text', itemIndex, '') as string,
						format: context.getNodeParameter('format', itemIndex, 'markdown') as 'markdown' | 'html',
						attachments: additionalFields.attachmentsJson,
						link: additionalFields.linkJson,
						notify:
							typeof additionalFields.notify === 'boolean' ? additionalFields.notify : undefined,
						requireContent: true,
					});
					response = await executeWithAttachmentRetry(
						() =>
							maxApiRequest(context, credentials, 'PUT', '/messages', {
								query: {
									message_id: messageId,
								},
								body,
							}),
						{
							enabled: hasMaxMessageAttachments(body),
							...getMaxAttachmentRetryOptions(additionalFields),
						},
					);
					break;
				}
				case 'delete': {
					const messageId = context.getNodeParameter('messageId', itemIndex) as string;
					response = await maxApiRequest(context, credentials, 'DELETE', '/messages', {
						query: {
							message_id: messageId,
						},
					});
					break;
				}
				case 'answerCallback': {
					const callbackId = context.getNodeParameter('callbackId', itemIndex) as string;
					const additionalFields = context.getNodeParameter(
						'additionalFields',
						itemIndex,
						{},
					) as IDataObject;
					const messageBody = buildMaxMessageBody({
						text: context.getNodeParameter('text', itemIndex, '') as string,
						format: context.getNodeParameter('format', itemIndex, 'markdown') as 'markdown' | 'html',
						attachments: additionalFields.attachmentsJson,
						link: additionalFields.linkJson,
						notify:
							typeof additionalFields.notify === 'boolean' ? additionalFields.notify : undefined,
						requireContent: false,
					});
					const callbackBody = buildMaxAnswerCallbackBody({
						notification: context.getNodeParameter('notification', itemIndex, '') as string,
						messageBody,
					});
					response = await executeWithAttachmentRetry(
						() =>
							maxApiRequest(context, credentials, 'POST', '/answers', {
								query: {
									callback_id: callbackId,
								},
								body: callbackBody,
							}),
						{
							enabled: hasMaxMessageAttachments(messageBody),
							...getMaxAttachmentRetryOptions(additionalFields),
						},
					);
					break;
				}
				default:
					throw new Error(`Unsupported message operation: ${operation}`);
			}

			results.push({
				json: normalizeMaxMessageOperationResponse(response),
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