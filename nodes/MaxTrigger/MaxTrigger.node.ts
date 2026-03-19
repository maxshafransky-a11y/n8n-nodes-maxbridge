import type {
	IDataObject,
	IHookFunctions,
	INode,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { toMaxNodeApiError } from '../Max/errors/maxApiError';
import type { MaxApiCredentialsShape } from '../Max/transport/maxApiRequest';
import { maxApiRequest } from '../Max/transport/maxApiRequest';
import {
	buildMaxSubscriptionBody,
	findMaxSubscriptionByUrl,
	hasValidMaxWebhookSecret,
	normalizeMaxTriggerEvent,
} from './triggerHelpers';

const TRIGGER_STATIC_SUBSCRIPTION_URL = 'subscriptionUrl';

const FALLBACK_TRIGGER_NODE: INode = {
	id: 'maxTrigger',
	name: 'Max Trigger',
	type: 'maxTrigger',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

const getMaxTriggerNode = (context: { getNode?: () => INode }): INode => {
	if (typeof context.getNode === 'function') {
		return context.getNode();
	}

	return FALLBACK_TRIGGER_NODE;
};

const clearStoredSubscription = (staticData: IDataObject): void => {
	delete staticData[TRIGGER_STATIC_SUBSCRIPTION_URL];
};
export class MaxTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Max Trigger',
		name: 'maxTrigger',
		icon: {
			light: 'file:../../icons/max.svg',
			dark: 'file:../../icons/max.dark.svg',
		},
		group: ['trigger'],
		version: 1,
		usableAsTool: false as unknown as true,
		description: 'Handle MAX webhook updates',
		defaults: {
			name: 'Max Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'maxApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Update Types',
				name: 'updateTypes',
				type: 'multiOptions',
				options: [
					{ name: 'Bot Started', value: 'bot_started' },
					{ name: 'Message Callback', value: 'message_callback' },
					{ name: 'Message Created', value: 'message_created' },
				],
				default: [],
				description: 'Optional update type filters for the registered webhook',
			},
			{
				displayName: 'Webhook Secret',
				name: 'webhookSecret',
				type: 'string',
				typeOptions: {
					password: true,
				},
				default: '',
				description: 'Secret expected in the X-Max-Bot-Api-Secret header',
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const credentials = (await this.getCredentials('maxApi')) as MaxApiCredentialsShape;
				const webhookUrl = this.getNodeWebhookUrl('default');
				if (!webhookUrl) {
					return false;
				}

				const response = await maxApiRequest(this, credentials, 'GET', '/subscriptions');
				const subscription = findMaxSubscriptionByUrl(response, webhookUrl);
				const staticData = this.getWorkflowStaticData('node');

				if (subscription) {
					staticData[TRIGGER_STATIC_SUBSCRIPTION_URL] = webhookUrl;
					return true;
				}

				clearStoredSubscription(staticData);
				return false;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				const credentials = (await this.getCredentials('maxApi')) as MaxApiCredentialsShape;
				const webhookUrl = this.getNodeWebhookUrl('default');
				if (!webhookUrl) {
					throw new NodeOperationError(
						getMaxTriggerNode(this),
						'n8n did not provide a webhook URL for the MAX trigger.',
					);
				}

				const updateTypes = this.getNodeParameter('updateTypes', []) as string[];
				const webhookSecret = this.getNodeParameter('webhookSecret', '') as string;

				await maxApiRequest(this, credentials, 'POST', '/subscriptions', {
					body: buildMaxSubscriptionBody(webhookUrl, webhookSecret, updateTypes),
				});

				const staticData = this.getWorkflowStaticData('node');
				staticData[TRIGGER_STATIC_SUBSCRIPTION_URL] = webhookUrl;
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				const credentials = (await this.getCredentials('maxApi')) as MaxApiCredentialsShape;
				const staticData = this.getWorkflowStaticData('node');
				const storedWebhookUrl = staticData[TRIGGER_STATIC_SUBSCRIPTION_URL];
				const webhookUrl =
					typeof storedWebhookUrl === 'string' && storedWebhookUrl.length > 0
						? storedWebhookUrl
						: this.getNodeWebhookUrl('default');

				if (!webhookUrl) {
					clearStoredSubscription(staticData);
					return true;
				}

				await maxApiRequest(this, credentials, 'DELETE', '/subscriptions', {
					query: {
						url: webhookUrl,
					},
				});
				clearStoredSubscription(staticData);
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		try {
			const webhookSecret = this.getNodeParameter('webhookSecret', '') as string;
			const headerData = this.getHeaderData();
			if (!hasValidMaxWebhookSecret(webhookSecret, headerData)) {
				this.getResponseObject().status(401);
				return {
					webhookResponse: {
						message: 'Invalid MAX webhook secret.',
					},
				};
			}

			const body = this.getBodyData() as IDataObject;
			const updateTypes = this.getNodeParameter('updateTypes', []) as string[];
			const updateType = typeof body.update_type === 'string' ? body.update_type : undefined;
			if (updateTypes.length > 0 && updateType && !updateTypes.includes(updateType)) {
				return {
					webhookResponse: {
						accepted: true,
						skipped: true,
					},
				};
			}

			const item: INodeExecutionData = {
				json: normalizeMaxTriggerEvent(body),
			};

			return {
				workflowData: [[item]],
			};
		} catch (error) {
			throw toMaxNodeApiError(getMaxTriggerNode(this), error);
		}
	}
}

export { normalizeMaxTriggerEvent };


