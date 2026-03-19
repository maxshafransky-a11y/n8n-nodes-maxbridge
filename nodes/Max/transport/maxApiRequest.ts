import type { IDataObject, IHttpRequestMethods, IHttpRequestOptions } from 'n8n-workflow';

export interface MaxApiCredentialsShape {
	accessToken?: string;
	useCustomBaseUrl?: boolean;
	baseUrl?: string;
}

export interface MaxApiRequestOptions {
	query?: IDataObject;
	body?: IHttpRequestOptions['body'];
	headers?: IDataObject;
	arrayFormat?: IHttpRequestOptions['arrayFormat'];
	ignoreHttpStatusErrors?: IHttpRequestOptions['ignoreHttpStatusErrors'];
	json?: boolean;
	returnFullResponse?: boolean;
	timeout?: number;
}

export interface MaxPaginationOptions extends MaxApiRequestOptions {
	responseItemsKey: string;
	responseMarkerKey?: string;
	requestMarkerKey?: string;
	requestLimitKey?: string;
	limit?: number;
	maxPages?: number;
	initialMarker?: string;
}

export interface MaxRequestHelperContext {
	helpers: {
		httpRequestWithAuthentication: (
			credentialType: string,
			requestOptions: IHttpRequestOptions,
		) => Promise<unknown>;
	};
}

export const MAX_API_CREDENTIAL_NAME = 'maxApi';
export const DEFAULT_MAX_BASE_URL = 'https://platform-api.max.ru';
export const DEFAULT_MAX_PAGINATION_LIMIT = 100;
export const DEFAULT_MAX_PAGINATION_MAX_PAGES = 100;

const asRecord = (value: unknown): Record<string, unknown> | undefined => {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return undefined;
	}

	return value as Record<string, unknown>;
};

export const omitUndefinedProperties = (value?: IDataObject): IDataObject | undefined => {
	if (!value) {
		return undefined;
	}

	const filteredEntries = Object.entries(value).filter(([, entryValue]) => entryValue !== undefined);

	if (filteredEntries.length === 0) {
		return undefined;
	}

	return Object.fromEntries(filteredEntries) as IDataObject;
};

export const normalizeMaxApiPath = (path: string): string => {
	const trimmedPath = path.trim();

	if (trimmedPath.length === 0) {
		return '/';
	}

	if (/^https?:\/\//i.test(trimmedPath)) {
		const url = new URL(trimmedPath);
		const normalizedUrlPath = `${url.pathname}${url.search}`;
		return normalizedUrlPath.length > 0 ? normalizedUrlPath : '/';
	}

	return trimmedPath.startsWith('/') ? trimmedPath : `/${trimmedPath}`;
};

export const getMaxBaseUrl = (credentials: MaxApiCredentialsShape): string => {
	if (credentials.useCustomBaseUrl && credentials.baseUrl) {
		return credentials.baseUrl.replace(/\/+$/, '');
	}

	return DEFAULT_MAX_BASE_URL;
};

export const buildMaxApiRequestOptions = (
	credentials: MaxApiCredentialsShape,
	method: IHttpRequestMethods,
	path: string,
	options: MaxApiRequestOptions = {},
): IHttpRequestOptions => ({
	baseURL: getMaxBaseUrl(credentials),
	url: normalizeMaxApiPath(path),
	method,
	qs: omitUndefinedProperties(options.query),
	body: options.body,
	headers: omitUndefinedProperties(options.headers),
	arrayFormat: options.arrayFormat,
	ignoreHttpStatusErrors: options.ignoreHttpStatusErrors,
	json: options.json ?? true,
	returnFullResponse: options.returnFullResponse,
	timeout: options.timeout,
});

export const maxApiRequest = async (
	context: MaxRequestHelperContext,
	credentials: MaxApiCredentialsShape,
	method: IHttpRequestMethods,
	path: string,
	options: MaxApiRequestOptions = {},
): Promise<unknown> => {
	const requestOptions = buildMaxApiRequestOptions(credentials, method, path, options);

	return await context.helpers.httpRequestWithAuthentication.call(
		context,
		MAX_API_CREDENTIAL_NAME,
		requestOptions,
	);
};

export const extractMaxPaginationItems = (response: unknown, responseItemsKey: string): IDataObject[] => {
	const responseRecord = asRecord(response);
	const rawItems = responseRecord?.[responseItemsKey];

	if (!Array.isArray(rawItems)) {
		return [];
	}

	return rawItems.filter((item): item is IDataObject => {
		return !!item && typeof item === 'object' && !Array.isArray(item);
	});
};

export const extractMaxPaginationMarker = (
	response: unknown,
	responseMarkerKey = 'marker',
): string | undefined => {
	const responseRecord = asRecord(response);
	const marker = responseRecord?.[responseMarkerKey];

	return typeof marker === 'string' && marker.length > 0 ? marker : undefined;
};

export const maxPaginatedRequest = async (
	context: MaxRequestHelperContext,
	credentials: MaxApiCredentialsShape,
	method: IHttpRequestMethods,
	path: string,
	options: MaxPaginationOptions,
): Promise<IDataObject[]> => {
	const responseMarkerKey = options.responseMarkerKey ?? 'marker';
	const requestMarkerKey = options.requestMarkerKey ?? 'marker';
	const requestLimitKey = options.requestLimitKey ?? 'limit';
	const limit = options.limit ?? DEFAULT_MAX_PAGINATION_LIMIT;
	const maxPages = options.maxPages ?? DEFAULT_MAX_PAGINATION_MAX_PAGES;

	let marker = options.initialMarker;
	const collectedItems: IDataObject[] = [];

	for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
		const query: IDataObject = {
			...(options.query ?? {}),
			[requestLimitKey]: limit,
		};

		if (marker) {
			query[requestMarkerKey] = marker;
		}

		const response = await maxApiRequest(context, credentials, method, path, {
			...options,
			query,
		});
		const pageItems = extractMaxPaginationItems(response, options.responseItemsKey);
		collectedItems.push(...pageItems);

		const nextMarker = extractMaxPaginationMarker(response, responseMarkerKey);
		if (!nextMarker || pageItems.length === 0) {
			break;
		}

		marker = nextMarker;
	}

	return collectedItems;
};
