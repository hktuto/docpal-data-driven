/* eslint-disable */
/* tslint:disable */
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

import type { AxiosInstance, AxiosRequestConfig, HeadersDefaults, ResponseType } from "axios";
import axios from "axios";

export type QueryParamsType = Record<string | number, any>;

export interface FullRequestParams extends Omit<AxiosRequestConfig, "data" | "params" | "url" | "responseType"> {
    /** set parameter to `true` for call `securityWorker` for this request */
    secure?: boolean;
    /** request path */
    path: string;
    /** content type of request body */
    type?: ContentType;
    /** query params */
    query?: QueryParamsType;
    /** format of response (i.e. response.json() -> format: "json") */
    format?: ResponseType;
    /** request body */
    body?: unknown;
}

export type RequestParams = Omit<FullRequestParams, "body" | "method" | "query" | "path">;

export interface ApiConfig<SecurityDataType = unknown> extends Omit<AxiosRequestConfig, "data" | "cancelToken"> {
    securityWorker?: (
        securityData: SecurityDataType | null,
    ) => Promise<AxiosRequestConfig | void> | AxiosRequestConfig | void;
    secure?: boolean;
    format?: ResponseType;
}

export enum ContentType {
    Json = "application/json",
    FormData = "multipart/form-data",
    UrlEncoded = "application/x-www-form-urlencoded",
    Text = "text/plain",
}

export class HttpClient<SecurityDataType = unknown> {
    public instance: AxiosInstance;
    private securityData: SecurityDataType | null = null;
    private securityWorker?: ApiConfig<SecurityDataType>["securityWorker"];
    private secure?: boolean;
    private format?: ResponseType;

    constructor({ securityWorker, secure, format, ...axiosConfig }: ApiConfig<SecurityDataType> = {}) {
        this.instance = axios.create({ ...axiosConfig, baseURL: axiosConfig.baseURL || "http://localhost:3333" });
        this.secure = secure;
        this.format = format;
        this.securityWorker = securityWorker;
    }

    public setSecurityData = (data: SecurityDataType | null) => {
        this.securityData = data;
    };

    protected mergeRequestParams(params1: AxiosRequestConfig, params2?: AxiosRequestConfig): AxiosRequestConfig {
        const method = params1.method || (params2 && params2.method);

        return {
            ...this.instance.defaults,
            ...params1,
            ...(params2 || {}),
            headers: {
                ...((method && this.instance.defaults.headers[method.toLowerCase() as keyof HeadersDefaults]) || {}),
                ...(params1.headers || {}),
                ...((params2 && params2.headers) || {}),
            },
        };
    }

    protected stringifyFormItem(formItem: unknown) {
        if (typeof formItem === "object" && formItem !== null) {
            return JSON.stringify(formItem);
        } else {
            return `${formItem}`;
        }
    }

    protected createFormData(input: Record<string, unknown>): FormData {
        if (input instanceof FormData) {
            return input;
        }
        return Object.keys(input || {}).reduce((formData, key) => {
            const property = input[key];
            const propertyContent: any[] = property instanceof Array ? property : [property];

            for (const formItem of propertyContent) {
                const isFileType = formItem instanceof Blob || formItem instanceof File;
                formData.append(key, isFileType ? formItem : this.stringifyFormItem(formItem));
            }

            return formData;
        }, new FormData());
    }

    public request = async <T = any, _E = any>({
        secure,
        path,
        type,
        query,
        format,
        body,
        ...params
    }: FullRequestParams): Promise<T> => {
        const secureParams =
            ((typeof secure === "boolean" ? secure : this.secure) &&
                this.securityWorker &&
                (await this.securityWorker(this.securityData))) ||
            {};
        const requestParams = this.mergeRequestParams(params, secureParams);
        const responseFormat = format || this.format || undefined;

        if (type === ContentType.FormData && body && body !== null && typeof body === "object") {
            body = this.createFormData(body as Record<string, unknown>);
        }

        if (type === ContentType.Text && body && body !== null && typeof body !== "string") {
            body = JSON.stringify(body);
        }

        return this.instance
            .request({
                ...requestParams,
                headers: {
                    ...(requestParams.headers || {}),
                    ...(type ? { "Content-Type": type } : {}),
                },
                params: query,
                responseType: responseFormat,
                data: body,
                url: path,
            })
            .then((response) => response.data);
    };
}

/**
 * @title DocPal API
 * @version 1.0.0
 * @license MIT (https://opensource.org/licenses/MIT)
 * @baseUrl http://localhost:3333
 * @contact DocPal Team <support@docpal.com>
 *
 * Multi-tenant document management platform API
 */
export class api<SecurityDataType extends unknown> extends HttpClient<SecurityDataType> {
    health = {
        /**
         * No description
         *
         * @name Get
         * @request GET:/health
         * @secure
         */
        get: (params: RequestParams = {}) =>
            this.request<void, any>({
                path: `/health`,
                method: "GET",
                secure: true,
                ...params,
            }),
    };
    api = {
        /**
         * No description
         *
         * @name Getundefined
         * @request GET:/api
         * @secure
         */
        getundefined: (params: RequestParams = {}) =>
            this.request<void, any>({
                path: ``,
                method: "GET",
                secure: true,
                ...params,
            }),

        /**
         * No description
         *
         * @tags auth
         * @name PostAuthLogin
         * @request POST:/api/auth/login
         * @secure
         */
        postAuthLogin: (
            data: {
                /** @format email */
                email: string;
                /** @minLength 1 */
                password: string;
            },
            params: RequestParams = {},
        ) =>
            this.request<
                {
                    message?: string;
                    user?: {
                        id?: string;
                        email?: string;
                        first_name?: string | null;
                        last_name?: string | null;
                        is_active?: boolean;
                        /** @format date-time */
                        created_at?: string;
                        /** @format date-time */
                        updated_at?: string;
                    };
                    companies?: {
                        id?: string;
                        name?: string;
                        slug?: string;
                        role?: string;
                    }[];
                },
                {
                    error: string;
                }
            >({
                path: `/auth/login`,
                method: "POST",
                body: data,
                secure: true,
                type: ContentType.Json,
                format: "json",
                ...params,
            }),

        /**
         * No description
         *
         * @tags auth
         * @name PostAuthRegister
         * @request POST:/api/auth/register
         * @secure
         */
        postAuthRegister: (
            data: {
                /** @format email */
                email: string;
                /** @minLength 8 */
                password: string;
            },
            params: RequestParams = {},
        ) =>
            this.request<
                {
                    message?: string;
                    user?: {
                        id?: string;
                        email?: string;
                        first_name?: string | null;
                        last_name?: string | null;
                        is_active?: boolean;
                        /** @format date-time */
                        created_at?: string;
                        /** @format date-time */
                        updated_at?: string;
                    };
                },
                {
                    error: string;
                }
            >({
                path: `/auth/register`,
                method: "POST",
                body: data,
                secure: true,
                type: ContentType.Json,
                format: "json",
                ...params,
            }),

        /**
         * @description Get available companies for user by email/password
         *
         * @tags auth
         * @name PostAuthCompanies
         * @request POST:/api/auth/companies
         * @secure
         */
        postAuthCompanies: (
            data: {
                /** @format email */
                email: string;
                /** @minLength 1 */
                password: string;
            },
            params: RequestParams = {},
        ) =>
            this.request<
                {
                    id?: string;
                    name?: string;
                    slug?: string;
                    description?: string | null;
                    role?: string;
                    /** @format date-time */
                    joined_at?: string;
                }[],
                {
                    error: string;
                }
            >({
                path: `/auth/companies`,
                method: "POST",
                body: data,
                secure: true,
                type: ContentType.Json,
                format: "json",
                ...params,
            }),

        /**
         * No description
         *
         * @tags auth
         * @name PostAuthLogout
         * @request POST:/api/auth/logout
         * @secure
         */
        postAuthLogout: (params: RequestParams = {}) =>
            this.request<
                {
                    message?: string;
                },
                {
                    error: string;
                }
            >({
                path: `/auth/logout`,
                method: "POST",
                secure: true,
                format: "json",
                ...params,
            }),

        /**
         * No description
         *
         * @tags auth
         * @name GetAuthSession
         * @request GET:/api/auth/session
         * @secure
         */
        getAuthSession: (params: RequestParams = {}) =>
            this.request<
                {
                    user?: {
                        id?: string;
                        email?: string;
                        first_name?: string | null;
                        last_name?: string | null;
                        is_active?: boolean;
                        /** @format date-time */
                        created_at?: string;
                        /** @format date-time */
                        updated_at?: string;
                    };
                    company?: {
                        id?: string;
                        name?: string;
                        slug?: string;
                        role?: string;
                    } | null;
                },
                {
                    error: string;
                }
            >({
                path: `/auth/session`,
                method: "GET",
                secure: true,
                format: "json",
                ...params,
            }),

        /**
         * @description Get companies schema
         *
         * @tags company
         * @name GetCompanies
         * @request GET:/api/companies
         * @secure
         */
        getCompanies: (params: RequestParams = {}) =>
            this.request<
                {
                    id?: string;
                    name?: string;
                    slug?: string;
                    description?: string | null;
                    settings?: object;
                    status?: "active" | "inactive" | "suspended";
                    created_by?: string;
                    openfga_store_id?: string | null;
                    /** @format date-time */
                    created_at?: string;
                    /** @format date-time */
                    updated_at?: string;
                    role?: string;
                    /** @format date-time */
                    joined_at?: string;
                }[],
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/companies`,
                method: "GET",
                secure: true,
                format: "json",
                ...params,
            }),

        /**
         * @description Create company with admin user schema
         *
         * @tags company
         * @name PostCompanies
         * @request POST:/api/companies
         * @secure
         */
        postCompanies: (
            data: {
                /**
                 * @minLength 1
                 * @maxLength 255
                 */
                name: string;
                /**
                 * @minLength 1
                 * @maxLength 100
                 * @pattern ^[a-z0-9-]+$
                 */
                slug: string;
                /** @maxLength 1000 */
                description?: string;
                settings?: object;
                admin: {
                    /**
                     * @format email
                     * @maxLength 128
                     */
                    email: string;
                    /**
                     * @minLength 8
                     * @maxLength 128
                     */
                    password: string;
                    profile: {
                        /**
                         * @minLength 1
                         * @maxLength 128
                         */
                        name: string;
                        /**
                         * @format email
                         * @maxLength 128
                         */
                        email: string;
                        /** @maxLength 128 */
                        phone: string;
                        /** @maxLength 256 */
                        address?: string;
                        /** @maxLength 128 */
                        city?: string;
                        preferences?: object;
                    };
                };
            },
            params: RequestParams = {},
        ) =>
            this.request<
                {
                    company?: {
                        id?: string;
                        name?: string;
                        slug?: string;
                        description?: string | null;
                        settings?: object;
                        status?: "active" | "inactive" | "suspended";
                        created_by?: string;
                        openfga_store_id?: string | null;
                        /** @format date-time */
                        created_at?: string;
                        /** @format date-time */
                        updated_at?: string;
                    };
                    user?: {
                        id?: string;
                        email?: string;
                        /** @format date-time */
                        created_at?: string;
                        /** @format date-time */
                        updated_at?: string;
                        isNewUser?: boolean;
                    };
                    sessionToken?: string;
                    message?: string;
                },
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/companies`,
                method: "POST",
                body: data,
                secure: true,
                type: ContentType.Json,
                format: "json",
                ...params,
            }),

        /**
         * @description Get company by ID schema
         *
         * @tags company
         * @name GetCompaniesCompanyid
         * @request GET:/api/companies/{companyId}
         * @secure
         */
        getCompaniesCompanyid: (companyId: string, params: RequestParams = {}) =>
            this.request<
                {
                    id?: string;
                    name?: string;
                    slug?: string;
                    description?: string | null;
                    settings?: object;
                    status?: "active" | "inactive" | "suspended";
                    created_by?: string;
                    openfga_store_id?: string | null;
                    /** @format date-time */
                    created_at?: string;
                    /** @format date-time */
                    updated_at?: string;
                },
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/companies/${companyId}`,
                method: "GET",
                secure: true,
                format: "json",
                ...params,
            }),

        /**
         * @description Add user to company schema
         *
         * @tags company
         * @name PostCompaniesCompanyidUsers
         * @request POST:/api/companies/{companyId}/users
         * @secure
         */
        postCompaniesCompanyidUsers: (
            companyId: string,
            data: {
                /** @format uuid */
                userId: string;
                /** @default "member" */
                role?: "owner" | "admin" | "member";
            },
            params: RequestParams = {},
        ) =>
            this.request<
                {
                    message?: string;
                },
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/companies/${companyId}/users`,
                method: "POST",
                body: data,
                secure: true,
                type: ContentType.Json,
                format: "json",
                ...params,
            }),

        /**
         * @description Remove user from company schema
         *
         * @tags company
         * @name DeleteCompaniesCompanyidUsersUserid
         * @request DELETE:/api/companies/{companyId}/users/{userId}
         * @secure
         */
        deleteCompaniesCompanyidUsersUserid: (companyId: string, userId: string, params: RequestParams = {}) =>
            this.request<
                {
                    message?: string;
                },
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/companies/${companyId}/users/${userId}`,
                method: "DELETE",
                secure: true,
                format: "json",
                ...params,
            }),

        /**
         * @description Get all custom data models for the current company
         *
         * @tags Schema
         * @name GetSchemas
         * @summary List all schemas
         * @request GET:/api/schemas
         * @secure
         */
        getSchemas: (params: RequestParams = {}) =>
            this.request<
                {
                    id?: string;
                    slug?: string;
                    label?: string;
                    is_system?: boolean;
                    is_relation?: boolean;
                    description?: string;
                    columns?: any[];
                    company_id?: string;
                    created_at?: string;
                    updated_at?: string;
                }[],
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/schemas`,
                method: "GET",
                secure: true,
                format: "json",
                ...params,
            }),

        /**
         * @description Create a new custom data model and corresponding database table
         *
         * @tags Schema
         * @name PostSchemas
         * @summary Create a new schema
         * @request POST:/api/schemas
         * @secure
         */
        postSchemas: (
            data: {
                /** @pattern ^[a-z][a-z0-9_]*$ */
                slug: string;
                /** @minLength 1 */
                label: string;
                /** @minLength 1 */
                description: string;
                is_system?: boolean;
                is_relation?: boolean;
                /** @minItems 1 */
                columns: {
                    /** @pattern ^[a-z][a-z0-9_]*$ */
                    name: string;
                    data_type: string;
                    data_type_options?: {
                        length?: number;
                        precision?: number;
                        scale?: number;
                    };
                    nullable: boolean;
                    default?: any;
                    view_type: "text" | "number" | "boolean" | "datetime" | "file" | "relation" | "json" | "select";
                    view_validation?: object;
                    view_editor: string;
                    view_editor_options?: object;
                    is_relation?: boolean;
                    relation_setting?: object;
                }[];
            },
            params: RequestParams = {},
        ) =>
            this.request<
                {
                    id?: string;
                    slug?: string;
                    label?: string;
                    is_system?: boolean;
                    is_relation?: boolean;
                    description?: string;
                    columns?: any[];
                    company_id?: string;
                    created_at?: string;
                    updated_at?: string;
                },
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/schemas`,
                method: "POST",
                body: data,
                secure: true,
                type: ContentType.Json,
                format: "json",
                ...params,
            }),

        /**
         * @description Get a specific custom data model by its slug
         *
         * @tags Schema
         * @name GetSchemasTableSlug
         * @summary Get schema by slug
         * @request GET:/api/schemas/{table_slug}
         * @secure
         */
        getSchemasTableSlug: (tableSlug: string, params: RequestParams = {}) =>
            this.request<
                {
                    id?: string;
                    slug?: string;
                    label?: string;
                    is_system?: boolean;
                    is_relation?: boolean;
                    description?: string;
                    columns?: any[];
                    company_id?: string;
                    created_at?: string;
                    updated_at?: string;
                },
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/schemas/${tableSlug}`,
                method: "GET",
                secure: true,
                format: "json",
                ...params,
            }),

        /**
         * @description Update an existing custom data model and modify the database table structure
         *
         * @tags Schema
         * @name PutSchemasTableSlug
         * @summary Update schema
         * @request PUT:/api/schemas/{table_slug}
         * @secure
         */
        putSchemasTableSlug: (
            tableSlug: string,
            data: {
                /** @minLength 1 */
                label?: string;
                /** @minLength 1 */
                description?: string;
                /** @minItems 1 */
                columns?: {
                    /** @pattern ^[a-z][a-z0-9_]*$ */
                    name: string;
                    data_type: string;
                    data_type_options?: {
                        length?: number;
                        precision?: number;
                        scale?: number;
                    };
                    nullable: boolean;
                    default?: any;
                    view_type: "text" | "number" | "boolean" | "datetime" | "file" | "relation" | "json";
                    view_validation?: object;
                    view_editor: string;
                    view_editor_options?: object;
                    is_relation?: boolean;
                    relation_setting?: object;
                }[];
            },
            params: RequestParams = {},
        ) =>
            this.request<
                {
                    id?: string;
                    slug?: string;
                    label?: string;
                    is_system?: boolean;
                    is_relation?: boolean;
                    description?: string;
                    columns?: any[];
                    company_id?: string;
                    created_at?: string;
                    updated_at?: string;
                },
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/schemas/${tableSlug}`,
                method: "PUT",
                body: data,
                secure: true,
                type: ContentType.Json,
                format: "json",
                ...params,
            }),

        /**
         * @description Delete a custom data model and its corresponding database table
         *
         * @tags Schema
         * @name DeleteSchemasTableSlug
         * @summary Delete schema
         * @request DELETE:/api/schemas/{table_slug}
         * @secure
         */
        deleteSchemasTableSlug: (tableSlug: string, params: RequestParams = {}) =>
            this.request<
                void,
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/schemas/${tableSlug}`,
                method: "DELETE",
                secure: true,
                ...params,
            }),

        /**
         * No description
         *
         * @name PostRecordsTableSlug
         * @request POST:/api/records/{table_slug}
         * @secure
         */
        postRecordsTableSlug: (tableSlug: string, data: Record<string, any>, params: RequestParams = {}) =>
            this.request<void, any>({
                path: `/records/${tableSlug}`,
                method: "POST",
                body: data,
                secure: true,
                type: ContentType.Json,
                ...params,
            }),

        /**
         * No description
         *
         * @name GetRecordsTableSlug
         * @request GET:/api/records/{table_slug}
         * @secure
         */
        getRecordsTableSlug: (
            tableSlug: string,
            query?: {
                /**
                 * @min 1
                 * @max 1000
                 * @default 50
                 */
                limit?: number;
                /**
                 * @min 0
                 * @default 0
                 */
                offset?: number;
                orderBy?: string;
                /** @default "DESC" */
                orderDirection?: "ASC" | "DESC";
                search?: string;
            },
            params: RequestParams = {},
        ) =>
            this.request<void, any>({
                path: `/records/${tableSlug}`,
                method: "GET",
                query: query,
                secure: true,
                ...params,
            }),

        /**
         * No description
         *
         * @name PostRecordsTableSlugBatch
         * @request POST:/api/records/{table_slug}/batch
         * @secure
         */
        postRecordsTableSlugBatch: (
            tableSlug: string,
            data: {
                /**
                 * @maxItems 1000
                 * @minItems 1
                 */
                records: Record<string, any>[];
            },
            params: RequestParams = {},
        ) =>
            this.request<void, any>({
                path: `/records/${tableSlug}/batch`,
                method: "POST",
                body: data,
                secure: true,
                type: ContentType.Json,
                ...params,
            }),

        /**
         * No description
         *
         * @name GetRecordsTableSlugRecordId
         * @request GET:/api/records/{table_slug}/{record_id}
         * @secure
         */
        getRecordsTableSlugRecordId: (tableSlug: string, recordId: string, params: RequestParams = {}) =>
            this.request<void, any>({
                path: `/records/${tableSlug}/${recordId}`,
                method: "GET",
                secure: true,
                ...params,
            }),

        /**
         * No description
         *
         * @name PutRecordsTableSlugRecordId
         * @request PUT:/api/records/{table_slug}/{record_id}
         * @secure
         */
        putRecordsTableSlugRecordId: (
            tableSlug: string,
            recordId: string,
            data: Record<string, any>,
            params: RequestParams = {},
        ) =>
            this.request<void, any>({
                path: `/records/${tableSlug}/${recordId}`,
                method: "PUT",
                body: data,
                secure: true,
                type: ContentType.Json,
                ...params,
            }),

        /**
         * No description
         *
         * @name DeleteRecordsTableSlugRecordId
         * @request DELETE:/api/records/{table_slug}/{record_id}
         * @secure
         */
        deleteRecordsTableSlugRecordId: (tableSlug: string, recordId: string, params: RequestParams = {}) =>
            this.request<void, any>({
                path: `/records/${tableSlug}/${recordId}`,
                method: "DELETE",
                secure: true,
                ...params,
            }),

        /**
         * No description
         *
         * @name PostRecordsTableSlugQueryTable
         * @request POST:/api/records/{table_slug}/query/table
         * @secure
         */
        postRecordsTableSlugQueryTable: (
            tableSlug: string,
            data: {
                columns?: string[];
                filters?: object;
                search?: string;
                orderBy?: string;
                orderDirection?: "ASC" | "DESC";
                /**
                 * @min 1
                 * @max 1000
                 */
                limit?: number;
                /** @min 0 */
                offset?: number;
                relationColumns?: {
                    label: string;
                    local_key: string;
                    foreign_table: string;
                    foreign_key: string;
                    display_columns: string[];
                    filters?: object;
                }[];
                aggColumns?: {
                    label: string;
                    local_key: string;
                    foreign_table: string;
                    foreign_key: string;
                    function: "count" | "sum" | "avg" | "min" | "max" | "array_agg" | "string_agg";
                    function_field?: string;
                    filters?: object;
                    group_by?: string[];
                }[];
                aggregation_filter?: string[];
            },
            params: RequestParams = {},
        ) =>
            this.request<void, any>({
                path: `/records/${tableSlug}/query/table`,
                method: "POST",
                body: data,
                secure: true,
                type: ContentType.Json,
                ...params,
            }),

        /**
         * No description
         *
         * @name PostRecordsTableSlugQueryKanban
         * @request POST:/api/records/{table_slug}/query/kanban
         * @secure
         */
        postRecordsTableSlugQueryKanban: (
            tableSlug: string,
            data: {
                statusColumn: string;
                groupByColumn?: string;
                columns?: string[];
                filters?: object;
                search?: string;
                /**
                 * @min 1
                 * @max 10000
                 */
                limit?: number;
                relationColumns?: {
                    label: string;
                    local_key: string;
                    foreign_table: string;
                    foreign_key: string;
                    display_columns: string[];
                    filters?: object;
                }[];
                aggColumns?: {
                    label: string;
                    local_key: string;
                    foreign_table: string;
                    foreign_key: string;
                    function: "count" | "sum" | "avg" | "min" | "max" | "array_agg" | "string_agg";
                    function_field?: string;
                    filters?: object;
                    group_by?: string[];
                }[];
                aggregation_filter?: string[];
            },
            params: RequestParams = {},
        ) =>
            this.request<
                {
                    boards?: any[];
                    aggregation?: Record<string, any>;
                },
                any
            >({
                path: `/records/${tableSlug}/query/kanban`,
                method: "POST",
                body: data,
                secure: true,
                type: ContentType.Json,
                format: "json",
                ...params,
            }),

        /**
         * No description
         *
         * @name PostRecordsTableSlugQueryTree
         * @request POST:/api/records/{table_slug}/query/tree
         * @secure
         */
        postRecordsTableSlugQueryTree: (
            tableSlug: string,
            data: {
                parentColumn: string;
                labelColumn: string;
                columns?: string[];
                rootValue?: any;
                /**
                 * @min 1
                 * @max 20
                 */
                maxDepth?: number;
                filters?: object;
                relationColumns?: {
                    label: string;
                    local_key: string;
                    foreign_table: string;
                    foreign_key: string;
                    display_columns: string[];
                    filters?: object;
                }[];
                aggColumns?: {
                    label: string;
                    local_key: string;
                    foreign_table: string;
                    foreign_key: string;
                    function: "count" | "sum" | "avg" | "min" | "max" | "array_agg" | "string_agg";
                    function_field?: string;
                    filters?: object;
                    group_by?: string[];
                }[];
                aggregation_filter?: string[];
            },
            params: RequestParams = {},
        ) =>
            this.request<void, any>({
                path: `/records/${tableSlug}/query/tree`,
                method: "POST",
                body: data,
                secure: true,
                type: ContentType.Json,
                ...params,
            }),

        /**
         * No description
         *
         * @name PostRecordsTableSlugStatsAgg
         * @request POST:/api/records/{table_slug}/stats/agg
         * @secure
         */
        postRecordsTableSlugStatsAgg: (
            tableSlug: string,
            data: {
                groupBy?: string[];
                aggregations: {
                    column: string;
                    function: "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";
                    alias?: string;
                }[];
                filters?: object;
                having?: object;
            },
            params: RequestParams = {},
        ) =>
            this.request<void, any>({
                path: `/records/${tableSlug}/stats/agg`,
                method: "POST",
                body: data,
                secure: true,
                type: ContentType.Json,
                ...params,
            }),

        /**
         * No description
         *
         * @name PostRecordsTableSlugStatsChart
         * @request POST:/api/records/{table_slug}/stats/chart
         * @secure
         */
        postRecordsTableSlugStatsChart: (
            tableSlug: string,
            data: {
                chartType: "bar" | "line" | "pie" | "scatter";
                xAxis: string;
                yAxis: string;
                aggregation?: "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";
                groupBy?: string;
                filters?: object;
                /**
                 * @min 1
                 * @max 1000
                 */
                limit?: number;
            },
            params: RequestParams = {},
        ) =>
            this.request<void, any>({
                path: `/records/${tableSlug}/stats/chart`,
                method: "POST",
                body: data,
                secure: true,
                type: ContentType.Json,
                ...params,
            }),

        /**
         * No description
         *
         * @name PostRecordsTableSlugQueryGantt
         * @request POST:/api/records/{table_slug}/query/gantt
         * @secure
         */
        postRecordsTableSlugQueryGantt: (
            tableSlug: string,
            data: {
                taskNameColumn: string;
                startDateColumn: string;
                endDateColumn: string;
                progressColumn?: string;
                dependencyColumn?: string;
                categoryColumn?: string;
                assigneeColumn?: string;
                columns?: string[];
                filters?: object;
                search?: string;
                dateRange?: {
                    /** @format date */
                    start?: string;
                    /** @format date */
                    end?: string;
                };
                relationColumns?: {
                    label: string;
                    local_key: string;
                    foreign_table: string;
                    foreign_key: string;
                    display_columns: string[];
                    filters?: object;
                }[];
                aggColumns?: {
                    label: string;
                    local_key: string;
                    foreign_table: string;
                    foreign_key: string;
                    function: "count" | "sum" | "avg" | "min" | "max" | "array_agg" | "string_agg";
                    function_field?: string;
                    filters?: object;
                    group_by?: string[];
                }[];
                aggregation_filter?: string[];
            },
            params: RequestParams = {},
        ) =>
            this.request<
                {
                    tasks?: any[];
                    timeline?: Record<string, any>;
                    aggregation?: Record<string, any>;
                    total?: number;
                },
                any
            >({
                path: `/records/${tableSlug}/query/gantt`,
                method: "POST",
                body: data,
                secure: true,
                type: ContentType.Json,
                format: "json",
                ...params,
            }),

        /**
         * No description
         *
         * @name PostRecordsTableSlugBreadcrumb
         * @request POST:/api/records/{table_slug}/breadcrumb
         * @secure
         */
        postRecordsTableSlugBreadcrumb: (
            tableSlug: string,
            data: {
                record_id: string;
                label_column: string;
                value_column: string;
                parent_column: string;
                /** @default "root_to_current" */
                direction?: "root_to_current" | "current_to_root";
                /**
                 * @min 1
                 * @max 100
                 * @default 50
                 */
                max_depth?: number;
            },
            params: RequestParams = {},
        ) =>
            this.request<
                {
                    breadcrumb?: {
                        label?: string;
                        value?: string;
                    }[];
                    depth?: number;
                },
                any
            >({
                path: `/records/${tableSlug}/breadcrumb`,
                method: "POST",
                body: data,
                secure: true,
                type: ContentType.Json,
                format: "json",
                ...params,
            }),

        /**
         * No description
         *
         * @name PostFilesUpload
         * @request POST:/api/files/upload
         * @secure
         */
        postFilesUpload: (params: RequestParams = {}) =>
            this.request<void, any>({
                path: `/files/upload`,
                method: "POST",
                secure: true,
                ...params,
            }),

        /**
         * No description
         *
         * @name GetFilesFileid
         * @request GET:/api/files/{fileId}
         * @secure
         */
        getFilesFileid: (fileId: string, params: RequestParams = {}) =>
            this.request<void, any>({
                path: `/files/${fileId}`,
                method: "GET",
                secure: true,
                ...params,
            }),

        /**
         * No description
         *
         * @name PostFilesFileidDelete
         * @request POST:/api/files/{fileId}/delete
         * @secure
         */
        postFilesFileidDelete: (
            fileId: string,
            data: {
                /** @maxLength 128 */
                table?: string;
                /** @maxLength 128 */
                column?: string;
                /** @format uuid */
                row?: string;
                /** @maxLength 128 */
                metadataField?: string;
            },
            params: RequestParams = {},
        ) =>
            this.request<void, any>({
                path: `/files/${fileId}/delete`,
                method: "POST",
                body: data,
                secure: true,
                type: ContentType.Json,
                ...params,
            }),

        /**
         * No description
         *
         * @name GetFilesFileidReferences
         * @request GET:/api/files/{fileId}/references
         * @secure
         */
        getFilesFileidReferences: (fileId: string, params: RequestParams = {}) =>
            this.request<void, any>({
                path: `/files/${fileId}/references`,
                method: "GET",
                secure: true,
                ...params,
            }),
    };
}
