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
    /**
     * No description
     *
     * @name GetHealth
     * @request GET:/health
     * @secure
     */
    getHealth = (params: RequestParams = {}) =>
        this.request<void, any>({
            path: `/health`,
            method: "GET",
            secure: true,
            ...params,
        });

    /**
     * No description
     *
     * @name GetApi
     * @request GET:/api
     * @secure
     */
    getApi = (params: RequestParams = {}) =>
        this.request<void, any>({
            path: `/api`,
            method: "GET",
            secure: true,
            ...params,
        });

    auth = {
        /**
         * No description
         *
         * @tags auth
         * @name PostLogin
         * @request POST:/api/auth/login
         * @secure
         */
        postLogin: (
            data: {
                /** @format email */
                email: string;
                /** @minLength 1 */
                password: string;
                /** @format uuid */
                companyId: string;
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
                    company?: {
                        id?: string;
                        name?: string;
                        slug?: string;
                        role?: string;
                    };
                },
                {
                    error: string;
                }
            >({
                path: `/api/auth/login`,
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
         * @name PostRegister
         * @request POST:/api/auth/register
         * @secure
         */
        postRegister: (
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
                path: `/api/auth/register`,
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
         * @name PostCompanies
         * @request POST:/api/auth/companies
         * @secure
         */
        postCompanies: (
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
                path: `/api/auth/companies`,
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
         * @name PostLogout
         * @request POST:/api/auth/logout
         * @secure
         */
        postLogout: (params: RequestParams = {}) =>
            this.request<
                {
                    message?: string;
                },
                {
                    error: string;
                }
            >({
                path: `/api/auth/logout`,
                method: "POST",
                secure: true,
                format: "json",
                ...params,
            }),

        /**
         * No description
         *
         * @tags auth
         * @name GetSession
         * @request GET:/api/auth/session
         * @secure
         */
        getSession: (params: RequestParams = {}) =>
            this.request<
                {
                    user?: {
                        id?: string;
                        email?: string;
                        userProfile?: Record<string, any>;
                        [key: string]: any;
                    };
                    company?: {
                        id?: string;
                        [key: string]: any;
                    };
                },
                {
                    error: string;
                }
            >({
                path: `/api/auth/session`,
                method: "GET",
                secure: true,
                format: "json",
                ...params,
            }),
    };
    companies = {
        /**
         * @description Get companies schema
         *
         * @tags company
         * @name Get
         * @request GET:/api/companies
         * @secure
         */
        get: (params: RequestParams = {}) =>
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
                path: `/api/companies`,
                method: "GET",
                secure: true,
                format: "json",
                ...params,
            }),

        /**
         * @description Create company with admin user schema
         *
         * @tags company
         * @name Post
         * @request POST:/api/companies
         * @secure
         */
        post: (
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
                    sessionId?: string;
                    message?: string;
                },
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/api/companies`,
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
         * @name GetCompanyid
         * @request GET:/api/companies/{companyId}
         * @secure
         */
        getCompanyid: (companyId: string, params: RequestParams = {}) =>
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
                path: `/api/companies/${companyId}`,
                method: "GET",
                secure: true,
                format: "json",
                ...params,
            }),

        /**
         * @description Add user to company schema
         *
         * @tags company
         * @name PostCompanyidUsers
         * @request POST:/api/companies/{companyId}/users
         * @secure
         */
        postCompanyidUsers: (
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
                path: `/api/companies/${companyId}/users`,
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
         * @name DeleteCompanyidUsersUserid
         * @request DELETE:/api/companies/{companyId}/users/{userId}
         * @secure
         */
        deleteCompanyidUsersUserid: (companyId: string, userId: string, params: RequestParams = {}) =>
            this.request<
                {
                    message?: string;
                },
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/api/companies/${companyId}/users/${userId}`,
                method: "DELETE",
                secure: true,
                format: "json",
                ...params,
            }),
    };
    schemas = {
        /**
         * @description Get all custom data models for the current company
         *
         * @tags Schema
         * @name Get
         * @summary List all schemas
         * @request GET:/api/schemas
         * @secure
         */
        get: (params: RequestParams = {}) =>
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
                path: `/api/schemas`,
                method: "GET",
                secure: true,
                format: "json",
                ...params,
            }),

        /**
         * @description Create a new custom data model and corresponding database table
         *
         * @tags Schema
         * @name Post
         * @summary Create a new schema
         * @request POST:/api/schemas
         * @secure
         */
        post: (
            data: {
                /** @pattern ^[a-z][a-z0-9_]*$ */
                slug: string;
                /** @minLength 1 */
                label: string;
                /** @minLength 1 */
                description: string;
                is_system?: boolean;
                is_relation?: boolean;
                /** @minItems 0 */
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
                path: `/api/schemas`,
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
         * @name GetTableSlug
         * @summary Get schema by slug
         * @request GET:/api/schemas/{table_slug}
         * @secure
         */
        getTableSlug: (tableSlug: string, params: RequestParams = {}) =>
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
                path: `/api/schemas/${tableSlug}`,
                method: "GET",
                secure: true,
                format: "json",
                ...params,
            }),

        /**
         * @description Update an existing custom data model and modify the database table structure
         *
         * @tags Schema
         * @name PutTableSlug
         * @summary Update schema
         * @request PUT:/api/schemas/{table_slug}
         * @secure
         */
        putTableSlug: (
            tableSlug: string,
            data: {
                /** @minLength 1 */
                label?: string;
                /** @minLength 1 */
                description?: string;
                /** @minItems 0 */
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
                path: `/api/schemas/${tableSlug}`,
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
         * @name DeleteTableSlug
         * @summary Delete schema
         * @request DELETE:/api/schemas/{table_slug}
         * @secure
         */
        deleteTableSlug: (tableSlug: string, params: RequestParams = {}) =>
            this.request<
                void,
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/api/schemas/${tableSlug}`,
                method: "DELETE",
                secure: true,
                ...params,
            }),

        /**
         * @description Get workflow event configuration for a custom data table
         *
         * @tags Schema Events
         * @name GetTableSlugEvents
         * @summary Get table event configuration
         * @request GET:/api/schemas/{table_slug}/events
         * @secure
         */
        getTableSlugEvents: (tableSlug: string, params: RequestParams = {}) =>
            this.request<
                object,
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/api/schemas/${tableSlug}/events`,
                method: "GET",
                secure: true,
                format: "json",
                ...params,
            }),

        /**
         * @description Configure workflow triggers for a custom data table
         *
         * @tags Schema Events
         * @name PutTableSlugEvents
         * @summary Update table event configuration
         * @request PUT:/api/schemas/{table_slug}/events
         * @secure
         */
        putTableSlugEvents: (
            tableSlug: string,
            data: {
                triggers?: {
                    workflow_slug: string;
                    event: "insert" | "update" | "delete" | "any";
                    conditions?: object;
                }[];
            },
            params: RequestParams = {},
        ) =>
            this.request<
                object,
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/api/schemas/${tableSlug}/events`,
                method: "PUT",
                body: data,
                secure: true,
                type: ContentType.Json,
                format: "json",
                ...params,
            }),

        /**
         * @description Remove all workflow event configuration for a custom data table
         *
         * @tags Schema Events
         * @name DeleteTableSlugEvents
         * @summary Remove table event configuration
         * @request DELETE:/api/schemas/{table_slug}/events
         * @secure
         */
        deleteTableSlugEvents: (tableSlug: string, params: RequestParams = {}) =>
            this.request<
                void,
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/api/schemas/${tableSlug}/events`,
                method: "DELETE",
                secure: true,
                ...params,
            }),

        /**
         * @description Get all custom data tables that have workflow event configurations
         *
         * @tags Schema Events
         * @name GetEvents
         * @summary List tables with event configurations
         * @request GET:/api/schemas/events
         * @secure
         */
        getEvents: (params: RequestParams = {}) =>
            this.request<
                {
                    slug?: string;
                    label?: string;
                    events?: object;
                }[],
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/api/schemas/events`,
                method: "GET",
                secure: true,
                format: "json",
                ...params,
            }),
    };
    records = {
        /**
         * @description Create a new record in the specified table
         *
         * @tags records
         * @name PostTableSlug
         * @request POST:/api/records/{table_slug}
         * @secure
         */
        postTableSlug: (tableSlug: string, data: Record<string, any>, params: RequestParams = {}) =>
            this.request<
                Record<string, any>,
                {
                    error?: string;
                }
            >({
                path: `/api/records/${tableSlug}`,
                method: "POST",
                body: data,
                secure: true,
                type: ContentType.Json,
                format: "json",
                ...params,
            }),

        /**
         * @description Get records from the specified table with filtering and pagination
         *
         * @tags records
         * @name GetTableSlug
         * @request GET:/api/records/{table_slug}
         * @secure
         */
        getTableSlug: (
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
            this.request<
                {
                    records?: Record<string, any>[];
                    total?: number;
                    limit?: number;
                    offset?: number;
                },
                {
                    error?: string;
                }
            >({
                path: `/api/records/${tableSlug}`,
                method: "GET",
                query: query,
                secure: true,
                format: "json",
                ...params,
            }),

        /**
         * @description Create multiple records in a single batch operation
         *
         * @tags records
         * @name PostTableSlugBatch
         * @request POST:/api/records/{table_slug}/batch
         * @secure
         */
        postTableSlugBatch: (
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
            this.request<
                {
                    records?: Record<string, any>[];
                    total?: number;
                    errors?: object[];
                    success?: boolean;
                },
                {
                    error?: string;
                }
            >({
                path: `/api/records/${tableSlug}/batch`,
                method: "POST",
                body: data,
                secure: true,
                type: ContentType.Json,
                format: "json",
                ...params,
            }),

        /**
         * @description Get a specific record by ID from the specified table
         *
         * @tags records
         * @name GetTableSlugRecordId
         * @request GET:/api/records/{table_slug}/{record_id}
         * @secure
         */
        getTableSlugRecordId: (tableSlug: string, recordId: string, params: RequestParams = {}) =>
            this.request<
                Record<string, any>,
                {
                    error?: string;
                }
            >({
                path: `/api/records/${tableSlug}/${recordId}`,
                method: "GET",
                secure: true,
                format: "json",
                ...params,
            }),

        /**
         * @description Update an existing record in the specified table
         *
         * @tags records
         * @name PutTableSlugRecordId
         * @request PUT:/api/records/{table_slug}/{record_id}
         * @secure
         */
        putTableSlugRecordId: (
            tableSlug: string,
            recordId: string,
            data: Record<string, any>,
            params: RequestParams = {},
        ) =>
            this.request<
                Record<string, any>,
                {
                    error?: string;
                }
            >({
                path: `/api/records/${tableSlug}/${recordId}`,
                method: "PUT",
                body: data,
                secure: true,
                type: ContentType.Json,
                format: "json",
                ...params,
            }),

        /**
         * @description Delete a record from the specified table
         *
         * @tags records
         * @name DeleteTableSlugRecordId
         * @request DELETE:/api/records/{table_slug}/{record_id}
         * @secure
         */
        deleteTableSlugRecordId: (tableSlug: string, recordId: string, params: RequestParams = {}) =>
            this.request<
                void,
                {
                    error?: string;
                }
            >({
                path: `/api/records/${tableSlug}/${recordId}`,
                method: "DELETE",
                secure: true,
                ...params,
            }),

        /**
         * @description Execute advanced table query with relations and aggregations
         *
         * @tags records
         * @name PostTableSlugQueryTable
         * @request POST:/api/records/{table_slug}/query/table
         * @secure
         */
        postTableSlugQueryTable: (
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
            this.request<
                Record<string, any>,
                {
                    error?: string;
                }
            >({
                path: `/api/records/${tableSlug}/query/table`,
                method: "POST",
                body: data,
                secure: true,
                type: ContentType.Json,
                format: "json",
                ...params,
            }),

        /**
         * @description Execute Kanban board query with status grouping
         *
         * @tags records
         * @name PostTableSlugQueryKanban
         * @request POST:/api/records/{table_slug}/query/kanban
         * @secure
         */
        postTableSlugQueryKanban: (
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
                {
                    error?: string;
                }
            >({
                path: `/api/records/${tableSlug}/query/kanban`,
                method: "POST",
                body: data,
                secure: true,
                type: ContentType.Json,
                format: "json",
                ...params,
            }),

        /**
         * @description Execute hierarchical tree query with parent-child relationships
         *
         * @tags records
         * @name PostTableSlugQueryTree
         * @request POST:/api/records/{table_slug}/query/tree
         * @secure
         */
        postTableSlugQueryTree: (
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
            this.request<
                Record<string, any>,
                {
                    error?: string;
                }
            >({
                path: `/api/records/${tableSlug}/query/tree`,
                method: "POST",
                body: data,
                secure: true,
                type: ContentType.Json,
                format: "json",
                ...params,
            }),

        /**
         * @description Execute aggregation statistics query with grouping
         *
         * @tags records
         * @name PostTableSlugStatsAgg
         * @request POST:/api/records/{table_slug}/stats/agg
         * @secure
         */
        postTableSlugStatsAgg: (
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
            this.request<
                Record<string, any>,
                {
                    error?: string;
                }
            >({
                path: `/api/records/${tableSlug}/stats/agg`,
                method: "POST",
                body: data,
                secure: true,
                type: ContentType.Json,
                format: "json",
                ...params,
            }),

        /**
         * @description Generate chart data with various visualization types
         *
         * @tags records
         * @name PostTableSlugStatsChart
         * @request POST:/api/records/{table_slug}/stats/chart
         * @secure
         */
        postTableSlugStatsChart: (
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
            this.request<
                Record<string, any>,
                {
                    error?: string;
                }
            >({
                path: `/api/records/${tableSlug}/stats/chart`,
                method: "POST",
                body: data,
                secure: true,
                type: ContentType.Json,
                format: "json",
                ...params,
            }),

        /**
         * @description Execute Gantt chart query for project timeline visualization
         *
         * @tags records
         * @name PostTableSlugQueryGantt
         * @request POST:/api/records/{table_slug}/query/gantt
         * @secure
         */
        postTableSlugQueryGantt: (
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
                {
                    error?: string;
                }
            >({
                path: `/api/records/${tableSlug}/query/gantt`,
                method: "POST",
                body: data,
                secure: true,
                type: ContentType.Json,
                format: "json",
                ...params,
            }),

        /**
         * @description Generate breadcrumb navigation for hierarchical data
         *
         * @tags records
         * @name PostTableSlugBreadcrumb
         * @request POST:/api/records/{table_slug}/breadcrumb
         * @secure
         */
        postTableSlugBreadcrumb: (
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
                {
                    error?: string;
                }
            >({
                path: `/api/records/${tableSlug}/breadcrumb`,
                method: "POST",
                body: data,
                secure: true,
                type: ContentType.Json,
                format: "json",
                ...params,
            }),

        /**
         * @description Execute dropdown query for form field options
         *
         * @tags records
         * @name PostTableSlugQueryDropdown
         * @request POST:/api/records/{table_slug}/query/dropdown
         * @secure
         */
        postTableSlugQueryDropdown: (
            tableSlug: string,
            data: {
                label: string;
                value: string;
                search?: string;
                filters?: object;
                sort?: {
                    field: string;
                    direction: "ASC" | "DESC";
                }[];
                /**
                 * @min 1
                 * @max 1000
                 * @default 100
                 */
                limit?: number;
                /** @default true */
                distinct?: boolean;
                /** @default false */
                includeEmpty?: boolean;
                groupBy?: string;
            },
            params: RequestParams = {},
        ) =>
            this.request<
                {
                    options?: Record<string, any>[];
                    total?: number;
                    hasMore?: boolean;
                },
                {
                    error?: string;
                }
            >({
                path: `/api/records/${tableSlug}/query/dropdown`,
                method: "POST",
                body: data,
                secure: true,
                type: ContentType.Json,
                format: "json",
                ...params,
            }),
    };
    files = {
        /**
         * @description Upload a file and associate it with a table record
         *
         * @tags files
         * @name PostUpload
         * @request POST:/api/files/upload
         * @secure
         */
        postUpload: (params: RequestParams = {}) =>
            this.request<
                {
                    filePath?: string;
                    metadata?: object;
                    message?: string;
                    [key: string]: any;
                },
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/api/files/upload`,
                method: "POST",
                secure: true,
                format: "json",
                ...params,
            }),

        /**
         * @description Get file by ID for download or display
         *
         * @tags files
         * @name GetFileid
         * @request GET:/api/files/{fileId}
         * @secure
         */
        getFileid: (fileId: string, params: RequestParams = {}) =>
            this.request<
                {
                    /** @format binary */
                    stream?: File;
                    metadata?: object;
                },
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/api/files/${fileId}`,
                method: "GET",
                secure: true,
                format: "json",
                ...params,
            }),

        /**
         * @description Delete a file and remove its reference from table records
         *
         * @tags files
         * @name PostFileidDelete
         * @request POST:/api/files/{fileId}/delete
         * @secure
         */
        postFileidDelete: (
            fileId: string,
            data: {
                /** @maxLength 128 */
                table?: string;
                /**
                 * Column name or nested JSONB path using dot notation (e.g., "file_path" or "metadata.files.primary")
                 * @maxLength 128
                 */
                column?: string;
                /** @format uuid */
                row?: string;
                /**
                 * Optional metadata field name or nested JSONB path using dot notation
                 * @maxLength 128
                 */
                metadataField?: string;
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
                path: `/api/files/${fileId}/delete`,
                method: "POST",
                body: data,
                secure: true,
                type: ContentType.Json,
                format: "json",
                ...params,
            }),

        /**
         * @description Find all references to a file across table records
         *
         * @tags files
         * @name GetFileidReferences
         * @request GET:/api/files/{fileId}/references
         * @secure
         */
        getFileidReferences: (fileId: string, params: RequestParams = {}) =>
            this.request<
                {
                    references?: object[];
                },
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/api/files/${fileId}/references`,
                method: "GET",
                secure: true,
                format: "json",
                ...params,
            }),
    };
    workflows = {
        /**
         * @description List all workflow definitions for the current company
         *
         * @tags workflow
         * @name Get
         * @request GET:/api/workflows
         * @secure
         */
        get: (
            query?: {
                /**
                 * @min 1
                 * @max 100
                 * @default 50
                 */
                limit?: number;
                /**
                 * @min 0
                 * @default 0
                 */
                offset?: number;
                status?: "active" | "inactive" | "draft";
            },
            params: RequestParams = {},
        ) =>
            this.request<
                {
                    id?: string;
                    name?: string;
                    slug?: string;
                    version?: string;
                    definition?: object;
                    events?: object;
                    status?: string;
                    created_by?: string;
                    created_at?: string;
                    updated_at?: string;
                }[],
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/api/workflows`,
                method: "GET",
                query: query,
                secure: true,
                format: "json",
                ...params,
            }),

        /**
         * @description Create a new workflow definition
         *
         * @tags workflow
         * @name Post
         * @request POST:/api/workflows
         * @secure
         */
        post: (
            data: {
                /**
                 * @minLength 1
                 * @maxLength 255
                 */
                name: string;
                /**
                 * @maxLength 100
                 * @pattern ^[a-z][a-z0-9_-]*$
                 */
                slug: string;
                /** @maxLength 20 */
                version?: string;
                definition: object;
                events?: object;
                status?: "active" | "inactive" | "draft";
            },
            params: RequestParams = {},
        ) =>
            this.request<
                {
                    id?: string;
                    name?: string;
                    slug?: string;
                    version?: string;
                    definition?: object;
                    events?: object;
                    status?: string;
                    created_by?: string;
                    created_at?: string;
                    updated_at?: string;
                },
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/api/workflows`,
                method: "POST",
                body: data,
                secure: true,
                type: ContentType.Json,
                format: "json",
                ...params,
            }),

        /**
         * @description Get a specific workflow definition by slug
         *
         * @tags workflow
         * @name GetSlug
         * @request GET:/api/workflows/{slug}
         * @secure
         */
        getSlug: (slug: string, params: RequestParams = {}) =>
            this.request<
                {
                    id?: string;
                    name?: string;
                    slug?: string;
                    version?: string;
                    definition?: object;
                    events?: object;
                    status?: string;
                    created_by?: string;
                    created_at?: string;
                    updated_at?: string;
                },
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/api/workflows/${slug}`,
                method: "GET",
                secure: true,
                format: "json",
                ...params,
            }),

        /**
         * @description Update an existing workflow definition
         *
         * @tags workflow
         * @name PutSlug
         * @request PUT:/api/workflows/{slug}
         * @secure
         */
        putSlug: (
            slug: string,
            data: {
                /**
                 * @minLength 1
                 * @maxLength 255
                 */
                name?: string;
                definition?: object;
                events?: object;
                status?: "active" | "inactive" | "draft";
            },
            params: RequestParams = {},
        ) =>
            this.request<
                {
                    id?: string;
                    name?: string;
                    slug?: string;
                    version?: string;
                    definition?: object;
                    events?: object;
                    status?: string;
                    created_by?: string;
                    created_at?: string;
                    updated_at?: string;
                },
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/api/workflows/${slug}`,
                method: "PUT",
                body: data,
                secure: true,
                type: ContentType.Json,
                format: "json",
                ...params,
            }),

        /**
         * @description Delete a workflow definition
         *
         * @tags workflow
         * @name DeleteSlug
         * @request DELETE:/api/workflows/{slug}
         * @secure
         */
        deleteSlug: (slug: string, params: RequestParams = {}) =>
            this.request<
                void,
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/api/workflows/${slug}`,
                method: "DELETE",
                secure: true,
                ...params,
            }),

        /**
         * @description Manually trigger a workflow execution
         *
         * @tags workflow
         * @name PostSlugTrigger
         * @request POST:/api/workflows/{slug}/trigger
         * @secure
         */
        postSlugTrigger: (
            slug: string,
            data: {
                trigger_data?: object;
            },
            params: RequestParams = {},
        ) =>
            this.request<
                {
                    execution_id?: string;
                    temporal_workflow_id?: string;
                    temporal_run_id?: string;
                    message?: string;
                },
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/api/workflows/${slug}/trigger`,
                method: "POST",
                body: data,
                secure: true,
                type: ContentType.Json,
                format: "json",
                ...params,
            }),

        /**
         * @description List workflow executions for a specific workflow
         *
         * @tags workflow
         * @name GetSlugExecutions
         * @request GET:/api/workflows/{slug}/executions
         * @secure
         */
        getSlugExecutions: (
            slug: string,
            query?: {
                /**
                 * @min 1
                 * @max 100
                 * @default 50
                 */
                limit?: number;
                /**
                 * @min 0
                 * @default 0
                 */
                offset?: number;
            },
            params: RequestParams = {},
        ) =>
            this.request<
                {
                    id?: string;
                    workflow_definition_id?: string;
                    definition?: object;
                    temporal_workflow_id?: string;
                    temporal_run_id?: string;
                    trigger_data?: object;
                    status?: string;
                    started_at?: string;
                    completed_at?: string;
                    result?: object;
                    error_message?: string;
                    workflow_name?: string;
                    workflow_slug?: string;
                }[],
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/api/workflows/${slug}/executions`,
                method: "GET",
                query: query,
                secure: true,
                format: "json",
                ...params,
            }),

        /**
         * @description Get details of a specific workflow execution
         *
         * @tags workflow
         * @name GetExecutionsId
         * @request GET:/api/workflows/executions/{id}
         * @secure
         */
        getExecutionsId: (id: string, params: RequestParams = {}) =>
            this.request<
                {
                    id?: string;
                    workflow_definition_id?: string;
                    definition?: object;
                    temporal_workflow_id?: string;
                    temporal_run_id?: string;
                    trigger_data?: object;
                    status?: string;
                    started_at?: string;
                    completed_at?: string;
                    result?: object;
                    error_message?: string;
                    workflow_name?: string;
                    workflow_slug?: string;
                },
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/api/workflows/executions/${id}`,
                method: "GET",
                secure: true,
                format: "json",
                ...params,
            }),

        /**
         * @description Cancel a running workflow execution
         *
         * @tags workflow
         * @name PostExecutionsIdCancel
         * @request POST:/api/workflows/executions/{id}/cancel
         * @secure
         */
        postExecutionsIdCancel: (
            id: string,
            data: {
                reason?: string;
            },
            params: RequestParams = {},
        ) =>
            this.request<
                {
                    message?: string;
                    status?: string;
                },
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/api/workflows/executions/${id}/cancel`,
                method: "POST",
                body: data,
                secure: true,
                type: ContentType.Json,
                format: "json",
                ...params,
            }),
    };
    userTasks = {
        /**
         * @description List user tasks assigned to the current user
         *
         * @tags workflow
         * @name GetUserTasks
         * @request GET:/api/user-tasks
         * @secure
         */
        getUserTasks: (
            query?: {
                status?: "pending" | "assigned" | "completed" | "cancelled" | "timeout";
                /**
                 * @min 1
                 * @max 100
                 * @default 50
                 */
                limit?: number;
                /**
                 * @min 0
                 * @default 0
                 */
                offset?: number;
            },
            params: RequestParams = {},
        ) =>
            this.request<
                {
                    id?: string;
                    workflow_execution_id?: string;
                    step_id?: string;
                    assignee_id?: string;
                    candidate?: object;
                    task_type?: string;
                    form_definition?: object;
                    context_data?: object;
                    status?: string;
                    result?: object;
                    created_at?: string;
                    completed_at?: string;
                    timeout_at?: string;
                    temporal_workflow_id?: string;
                    workflow_name?: string;
                    workflow_slug?: string;
                }[],
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/api/user-tasks`,
                method: "GET",
                query: query,
                secure: true,
                format: "json",
                ...params,
            }),

        /**
         * @description Get details of a specific user task
         *
         * @tags workflow
         * @name GetUserTasksId
         * @request GET:/api/user-tasks/{id}
         * @secure
         */
        getUserTasksId: (id: string, params: RequestParams = {}) =>
            this.request<
                {
                    id?: string;
                    workflow_execution_id?: string;
                    step_id?: string;
                    assignee_id?: string;
                    candidate?: object;
                    task_type?: string;
                    form_definition?: object;
                    context_data?: object;
                    status?: string;
                    result?: object;
                    created_at?: string;
                    completed_at?: string;
                    timeout_at?: string;
                    temporal_workflow_id?: string;
                    workflow_name?: string;
                    workflow_slug?: string;
                },
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/api/user-tasks/${id}`,
                method: "GET",
                secure: true,
                format: "json",
                ...params,
            }),

        /**
         * @description Complete a user task in a workflow execution
         *
         * @tags workflow
         * @name PostUserTasksIdComplete
         * @request POST:/api/user-tasks/{id}/complete
         * @secure
         */
        postUserTasksIdComplete: (
            id: string,
            data: {
                result: object;
            },
            params: RequestParams = {},
        ) =>
            this.request<
                {
                    id?: string;
                    workflow_execution_id?: string;
                    step_id?: string;
                    assignee_id?: string;
                    candidate?: object;
                    task_type?: string;
                    form_definition?: object;
                    context_data?: object;
                    status?: string;
                    result?: object;
                    created_at?: string;
                    completed_at?: string;
                    timeout_at?: string;
                },
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/api/user-tasks/${id}/complete`,
                method: "POST",
                body: data,
                secure: true,
                type: ContentType.Json,
                format: "json",
                ...params,
            }),
    };
    users = {
        /**
         * No description
         *
         * @tags users
         * @name Get
         * @request GET:/api/users
         * @secure
         */
        get: (
            query?: {
                search?: string;
                /**
                 * @min 1
                 * @max 100
                 * @default 50
                 */
                limit?: number;
                /** @default false */
                with_assignments?: boolean;
            },
            params: RequestParams = {},
        ) =>
            this.request<
                | {
                      id: string;
                      name: string;
                      email: string;
                      phone?: string | null;
                      address?: string | null;
                      city?: string | null;
                      preferences: object;
                      /** @format date-time */
                      created_at: string;
                      /** @format date-time */
                      updated_at: string;
                      created_by: string;
                  }[]
                | {
                      user_id?: string;
                      role_id?: string | null;
                      role_name?: string | null;
                      groups?: {
                          group_id?: string;
                          group_name?: string;
                          /** @format date-time */
                          assigned_at?: string;
                      }[];
                  }[],
                any
            >({
                path: `/api/users`,
                method: "GET",
                query: query,
                secure: true,
                format: "json",
                ...params,
            }),

        /**
         * No description
         *
         * @tags users
         * @name Post
         * @request POST:/api/users
         * @secure
         */
        post: (
            data: {
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
                phone?: string;
                /** @maxLength 256 */
                address?: string;
                /** @maxLength 128 */
                city?: string;
                preferences?: object;
            },
            params: RequestParams = {},
        ) =>
            this.request<
                {
                    id: string;
                    name: string;
                    email: string;
                    phone?: string | null;
                    address?: string | null;
                    city?: string | null;
                    preferences: object;
                    /** @format date-time */
                    created_at: string;
                    /** @format date-time */
                    updated_at: string;
                    created_by: string;
                },
                {
                    error?: string;
                }
            >({
                path: `/api/users`,
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
         * @tags users
         * @name GetUserid
         * @request GET:/api/users/{userId}
         * @secure
         */
        getUserid: (userId: string, params: RequestParams = {}) =>
            this.request<
                {
                    id: string;
                    name: string;
                    email: string;
                    phone?: string | null;
                    address?: string | null;
                    city?: string | null;
                    preferences: object;
                    /** @format date-time */
                    created_at: string;
                    /** @format date-time */
                    updated_at: string;
                    created_by: string;
                },
                {
                    error?: string;
                }
            >({
                path: `/api/users/${userId}`,
                method: "GET",
                secure: true,
                format: "json",
                ...params,
            }),

        /**
         * No description
         *
         * @tags users
         * @name PutUserid
         * @request PUT:/api/users/{userId}
         * @secure
         */
        putUserid: (
            userId: string,
            data: {
                /**
                 * @minLength 1
                 * @maxLength 128
                 */
                name?: string;
                /**
                 * @format email
                 * @maxLength 128
                 */
                email?: string;
                /** @maxLength 128 */
                phone?: string;
                /** @maxLength 256 */
                address?: string;
                /** @maxLength 128 */
                city?: string;
                preferences?: object;
            },
            params: RequestParams = {},
        ) =>
            this.request<
                {
                    id: string;
                    name: string;
                    email: string;
                    phone?: string | null;
                    address?: string | null;
                    city?: string | null;
                    preferences: object;
                    /** @format date-time */
                    created_at: string;
                    /** @format date-time */
                    updated_at: string;
                    created_by: string;
                },
                {
                    error?: string;
                }
            >({
                path: `/api/users/${userId}`,
                method: "PUT",
                body: data,
                secure: true,
                type: ContentType.Json,
                format: "json",
                ...params,
            }),

        /**
         * No description
         *
         * @tags users
         * @name DeleteUserid
         * @request DELETE:/api/users/{userId}
         * @secure
         */
        deleteUserid: (userId: string, params: RequestParams = {}) =>
            this.request<
                void,
                {
                    error?: string;
                }
            >({
                path: `/api/users/${userId}`,
                method: "DELETE",
                secure: true,
                ...params,
            }),

        /**
         * No description
         *
         * @tags users
         * @name PutUseridRole
         * @request PUT:/api/users/{userId}/role
         * @secure
         */
        putUseridRole: (
            userId: string,
            data: {
                /** @format uuid */
                role_id: string;
            },
            params: RequestParams = {},
        ) =>
            this.request<
                {
                    user_id?: string;
                    role_id?: string;
                    /** @format date-time */
                    assigned_at?: string;
                },
                {
                    error?: string;
                }
            >({
                path: `/api/users/${userId}/role`,
                method: "PUT",
                body: data,
                secure: true,
                type: ContentType.Json,
                format: "json",
                ...params,
            }),

        /**
         * No description
         *
         * @tags users
         * @name DeleteUseridRole
         * @request DELETE:/api/users/{userId}/role
         * @secure
         */
        deleteUseridRole: (userId: string, params: RequestParams = {}) =>
            this.request<
                void,
                {
                    error?: string;
                }
            >({
                path: `/api/users/${userId}/role`,
                method: "DELETE",
                secure: true,
                ...params,
            }),

        /**
         * No description
         *
         * @tags users
         * @name PutUseridGroup
         * @request PUT:/api/users/{userId}/group
         * @secure
         */
        putUseridGroup: (
            userId: string,
            data: {
                /** @format uuid */
                group_id: string;
                /** @maxLength 256 */
                description?: string;
            },
            params: RequestParams = {},
        ) =>
            this.request<
                {
                    user_id?: string;
                    group_id?: string;
                    /** @format date-time */
                    assigned_at?: string;
                },
                {
                    error?: string;
                }
            >({
                path: `/api/users/${userId}/group`,
                method: "PUT",
                body: data,
                secure: true,
                type: ContentType.Json,
                format: "json",
                ...params,
            }),

        /**
         * No description
         *
         * @tags users
         * @name DeleteUseridGroupGroupid
         * @request DELETE:/api/users/{userId}/group/{groupId}
         * @secure
         */
        deleteUseridGroupGroupid: (userId: string, groupId: string, params: RequestParams = {}) =>
            this.request<
                void,
                {
                    error?: string;
                }
            >({
                path: `/api/users/${userId}/group/${groupId}`,
                method: "DELETE",
                secure: true,
                ...params,
            }),

        /**
         * No description
         *
         * @tags users
         * @name GetUseridAssignments
         * @request GET:/api/users/{userId}/assignments
         * @secure
         */
        getUseridAssignments: (userId: string, params: RequestParams = {}) =>
            this.request<
                {
                    user_id?: string;
                    role_id?: string | null;
                    role_name?: string | null;
                    groups?: {
                        group_id?: string;
                        group_name?: string;
                        /** @format date-time */
                        assigned_at?: string;
                    }[];
                },
                {
                    error?: string;
                }
            >({
                path: `/api/users/${userId}/assignments`,
                method: "GET",
                secure: true,
                format: "json",
                ...params,
            }),
    };
    roles = {
        /**
         * No description
         *
         * @tags roles
         * @name Get
         * @request GET:/api/roles
         * @secure
         */
        get: (
            query?: {
                search?: string;
                /**
                 * @min 1
                 * @max 100
                 * @default 50
                 */
                limit?: number;
                /** @default false */
                hierarchy?: boolean;
            },
            params: RequestParams = {},
        ) =>
            this.request<
                | {
                      id: string;
                      name: string;
                      slug: string;
                      description: string;
                      parent_role_id?: string | null;
                      /** @format date-time */
                      created_at: string;
                      /** @format date-time */
                      updated_at: string;
                  }[]
                | {
                      id: string;
                      name: string;
                      slug: string;
                      description: string;
                      parent_role_id?: string | null;
                      /** @format date-time */
                      created_at: string;
                      /** @format date-time */
                      updated_at: string;
                      children?: {
                          id: string;
                          name: string;
                          slug: string;
                          description: string;
                          parent_role_id?: string | null;
                          /** @format date-time */
                          created_at: string;
                          /** @format date-time */
                          updated_at: string;
                      }[];
                      parent?: {
                          id: string;
                          name: string;
                          slug: string;
                          description: string;
                          parent_role_id?: string | null;
                          /** @format date-time */
                          created_at: string;
                          /** @format date-time */
                          updated_at: string;
                      };
                  }[],
                any
            >({
                path: `/api/roles`,
                method: "GET",
                query: query,
                secure: true,
                format: "json",
                ...params,
            }),

        /**
         * No description
         *
         * @tags roles
         * @name Post
         * @request POST:/api/roles
         * @secure
         */
        post: (
            data: {
                /**
                 * @minLength 1
                 * @maxLength 128
                 */
                name: string;
                /**
                 * @minLength 1
                 * @maxLength 128
                 * @pattern ^[a-z0-9-_]+$
                 */
                slug: string;
                /**
                 * @minLength 1
                 * @maxLength 256
                 */
                description: string;
                /** @format uuid */
                parent_role_id?: string;
            },
            params: RequestParams = {},
        ) =>
            this.request<
                {
                    id: string;
                    name: string;
                    slug: string;
                    description: string;
                    parent_role_id?: string | null;
                    /** @format date-time */
                    created_at: string;
                    /** @format date-time */
                    updated_at: string;
                },
                {
                    error?: string;
                }
            >({
                path: `/api/roles`,
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
         * @tags roles
         * @name GetRoleid
         * @request GET:/api/roles/{roleId}
         * @secure
         */
        getRoleid: (roleId: string, params: RequestParams = {}) =>
            this.request<
                {
                    id: string;
                    name: string;
                    slug: string;
                    description: string;
                    parent_role_id?: string | null;
                    /** @format date-time */
                    created_at: string;
                    /** @format date-time */
                    updated_at: string;
                },
                {
                    error?: string;
                }
            >({
                path: `/api/roles/${roleId}`,
                method: "GET",
                secure: true,
                format: "json",
                ...params,
            }),

        /**
         * No description
         *
         * @tags roles
         * @name PutRoleid
         * @request PUT:/api/roles/{roleId}
         * @secure
         */
        putRoleid: (
            roleId: string,
            data: {
                /**
                 * @minLength 1
                 * @maxLength 128
                 */
                name?: string;
                /**
                 * @minLength 1
                 * @maxLength 128
                 * @pattern ^[a-z0-9-_]+$
                 */
                slug?: string;
                /**
                 * @minLength 1
                 * @maxLength 256
                 */
                description?: string;
                /** @format uuid */
                parent_role_id?: string;
            },
            params: RequestParams = {},
        ) =>
            this.request<
                {
                    id: string;
                    name: string;
                    slug: string;
                    description: string;
                    parent_role_id?: string | null;
                    /** @format date-time */
                    created_at: string;
                    /** @format date-time */
                    updated_at: string;
                },
                {
                    error?: string;
                }
            >({
                path: `/api/roles/${roleId}`,
                method: "PUT",
                body: data,
                secure: true,
                type: ContentType.Json,
                format: "json",
                ...params,
            }),

        /**
         * No description
         *
         * @tags roles
         * @name DeleteRoleid
         * @request DELETE:/api/roles/{roleId}
         * @secure
         */
        deleteRoleid: (roleId: string, params: RequestParams = {}) =>
            this.request<
                void,
                {
                    error?: string;
                }
            >({
                path: `/api/roles/${roleId}`,
                method: "DELETE",
                secure: true,
                ...params,
            }),

        /**
         * No description
         *
         * @tags roles
         * @name GetRoleidDescendants
         * @request GET:/api/roles/{roleId}/descendants
         * @secure
         */
        getRoleidDescendants: (roleId: string, params: RequestParams = {}) =>
            this.request<
                {
                    id: string;
                    name: string;
                    slug: string;
                    description: string;
                    parent_role_id?: string | null;
                    /** @format date-time */
                    created_at: string;
                    /** @format date-time */
                    updated_at: string;
                }[],
                {
                    error?: string;
                }
            >({
                path: `/api/roles/${roleId}/descendants`,
                method: "GET",
                secure: true,
                format: "json",
                ...params,
            }),
    };
    groups = {
        /**
         * No description
         *
         * @tags groups
         * @name Get
         * @request GET:/api/groups
         * @secure
         */
        get: (
            query?: {
                search?: string;
                /**
                 * @min 1
                 * @max 100
                 * @default 50
                 */
                limit?: number;
                /** @default false */
                with_members?: boolean;
            },
            params: RequestParams = {},
        ) =>
            this.request<
                | {
                      id: string;
                      name: string;
                      slug: string;
                      description: string;
                      /** @format date-time */
                      created_at: string;
                      /** @format date-time */
                      updated_at: string;
                      auto_join: boolean;
                      auto_join_rule: object;
                  }[]
                | {
                      id: string;
                      name: string;
                      slug: string;
                      description: string;
                      /** @format date-time */
                      created_at: string;
                      /** @format date-time */
                      updated_at: string;
                      auto_join: boolean;
                      auto_join_rule: object;
                      member_count: number;
                  }[],
                any
            >({
                path: `/api/groups`,
                method: "GET",
                query: query,
                secure: true,
                format: "json",
                ...params,
            }),

        /**
         * No description
         *
         * @tags groups
         * @name Post
         * @request POST:/api/groups
         * @secure
         */
        post: (
            data: {
                /**
                 * @minLength 1
                 * @maxLength 128
                 */
                name: string;
                /**
                 * @minLength 1
                 * @maxLength 128
                 * @pattern ^[a-z0-9-_]+$
                 */
                slug: string;
                /**
                 * @minLength 1
                 * @maxLength 256
                 */
                description: string;
                auto_join?: boolean;
                auto_join_rule?: object;
            },
            params: RequestParams = {},
        ) =>
            this.request<
                {
                    id: string;
                    name: string;
                    slug: string;
                    description: string;
                    /** @format date-time */
                    created_at: string;
                    /** @format date-time */
                    updated_at: string;
                    auto_join: boolean;
                    auto_join_rule: object;
                },
                {
                    error?: string;
                }
            >({
                path: `/api/groups`,
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
         * @tags groups
         * @name GetGroupid
         * @request GET:/api/groups/{groupId}
         * @secure
         */
        getGroupid: (groupId: string, params: RequestParams = {}) =>
            this.request<
                {
                    id: string;
                    name: string;
                    slug: string;
                    description: string;
                    /** @format date-time */
                    created_at: string;
                    /** @format date-time */
                    updated_at: string;
                    auto_join: boolean;
                    auto_join_rule: object;
                },
                {
                    error?: string;
                }
            >({
                path: `/api/groups/${groupId}`,
                method: "GET",
                secure: true,
                format: "json",
                ...params,
            }),

        /**
         * No description
         *
         * @tags groups
         * @name PutGroupid
         * @request PUT:/api/groups/{groupId}
         * @secure
         */
        putGroupid: (
            groupId: string,
            data: {
                /**
                 * @minLength 1
                 * @maxLength 128
                 */
                name?: string;
                /**
                 * @minLength 1
                 * @maxLength 128
                 * @pattern ^[a-z0-9-_]+$
                 */
                slug?: string;
                /**
                 * @minLength 1
                 * @maxLength 256
                 */
                description?: string;
                auto_join?: boolean;
                auto_join_rule?: object;
            },
            params: RequestParams = {},
        ) =>
            this.request<
                {
                    id: string;
                    name: string;
                    slug: string;
                    description: string;
                    /** @format date-time */
                    created_at: string;
                    /** @format date-time */
                    updated_at: string;
                    auto_join: boolean;
                    auto_join_rule: object;
                },
                {
                    error?: string;
                }
            >({
                path: `/api/groups/${groupId}`,
                method: "PUT",
                body: data,
                secure: true,
                type: ContentType.Json,
                format: "json",
                ...params,
            }),

        /**
         * No description
         *
         * @tags groups
         * @name DeleteGroupid
         * @request DELETE:/api/groups/{groupId}
         * @secure
         */
        deleteGroupid: (groupId: string, params: RequestParams = {}) =>
            this.request<
                void,
                {
                    error?: string;
                }
            >({
                path: `/api/groups/${groupId}`,
                method: "DELETE",
                secure: true,
                ...params,
            }),

        /**
         * No description
         *
         * @tags groups
         * @name GetGroupidMembers
         * @request GET:/api/groups/{groupId}/members
         * @secure
         */
        getGroupidMembers: (groupId: string, params: RequestParams = {}) =>
            this.request<
                {
                    id: string;
                    user_id: string;
                    group_id: string;
                    description?: string | null;
                    /** @format date-time */
                    created_at: string;
                    /** @format date-time */
                    updated_at: string;
                }[],
                {
                    error?: string;
                }
            >({
                path: `/api/groups/${groupId}/members`,
                method: "GET",
                secure: true,
                format: "json",
                ...params,
            }),

        /**
         * No description
         *
         * @tags groups
         * @name PostGroupidMembers
         * @request POST:/api/groups/{groupId}/members
         * @secure
         */
        postGroupidMembers: (
            groupId: string,
            data: {
                /** @format uuid */
                user_id: string;
                /** @maxLength 256 */
                description?: string;
            },
            params: RequestParams = {},
        ) =>
            this.request<
                {
                    id: string;
                    user_id: string;
                    group_id: string;
                    description?: string | null;
                    /** @format date-time */
                    created_at: string;
                    /** @format date-time */
                    updated_at: string;
                },
                {
                    error?: string;
                }
            >({
                path: `/api/groups/${groupId}/members`,
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
         * @tags groups
         * @name DeleteGroupidMembersUserid
         * @request DELETE:/api/groups/{groupId}/members/{userId}
         * @secure
         */
        deleteGroupidMembersUserid: (groupId: string, userId: string, params: RequestParams = {}) =>
            this.request<
                void,
                {
                    error?: string;
                }
            >({
                path: `/api/groups/${groupId}/members/${userId}`,
                method: "DELETE",
                secure: true,
                ...params,
            }),
    };
    views = {
        /**
         * No description
         *
         * @tags data-views
         * @name GetTableSlug
         * @request GET:/api/views/{table_slug}
         * @secure
         */
        getTableSlug: (
            tableSlug: string,
            query?: {
                search?: string;
                /**
                 * @min 1
                 * @max 100
                 * @default 50
                 */
                limit?: number;
            },
            params: RequestParams = {},
        ) =>
            this.request<
                {
                    id: string;
                    name: string;
                    description?: string | null;
                    table_slug: string;
                    is_default: boolean;
                    layout: {
                        id: string;
                        label: string;
                        /**
                         * @min 1
                         * @max 24
                         */
                        column: number;
                        /** @min 1 */
                        row: number;
                        /**
                         * @min 1
                         * @max 24
                         */
                        width: number;
                        /** @min 1 */
                        height: number;
                        component: string;
                        config: object;
                    }[];
                    created_by: string;
                    /** @format date-time */
                    created_at: string;
                    /** @format date-time */
                    updated_at: string;
                }[],
                any
            >({
                path: `/api/views/${tableSlug}`,
                method: "GET",
                query: query,
                secure: true,
                format: "json",
                ...params,
            }),

        /**
         * No description
         *
         * @tags data-views
         * @name PostTableSlug
         * @request POST:/api/views/{table_slug}
         * @secure
         */
        postTableSlug: (
            tableSlug: string,
            data: {
                /**
                 * @minLength 1
                 * @maxLength 128
                 */
                name: string;
                /** @maxLength 512 */
                description?: string;
                is_default?: boolean;
                /** @minItems 1 */
                layout: {
                    id: string;
                    label: string;
                    /**
                     * @min 1
                     * @max 24
                     */
                    column: number;
                    /** @min 1 */
                    row: number;
                    /**
                     * @min 1
                     * @max 24
                     */
                    width: number;
                    /** @min 1 */
                    height: number;
                    component: string;
                    config: object;
                }[];
            },
            params: RequestParams = {},
        ) =>
            this.request<
                {
                    id: string;
                    name: string;
                    description?: string | null;
                    table_slug: string;
                    is_default: boolean;
                    layout: {
                        id: string;
                        label: string;
                        /**
                         * @min 1
                         * @max 24
                         */
                        column: number;
                        /** @min 1 */
                        row: number;
                        /**
                         * @min 1
                         * @max 24
                         */
                        width: number;
                        /** @min 1 */
                        height: number;
                        component: string;
                        config: object;
                    }[];
                    created_by: string;
                    /** @format date-time */
                    created_at: string;
                    /** @format date-time */
                    updated_at: string;
                },
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/api/views/${tableSlug}`,
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
         * @tags data-views
         * @name GetTableSlugViewId
         * @request GET:/api/views/{table_slug}/{view_id}
         * @secure
         */
        getTableSlugViewId: (tableSlug: string, viewId: string, params: RequestParams = {}) =>
            this.request<
                {
                    id: string;
                    name: string;
                    description?: string | null;
                    table_slug: string;
                    is_default: boolean;
                    layout: {
                        id: string;
                        label: string;
                        /**
                         * @min 1
                         * @max 24
                         */
                        column: number;
                        /** @min 1 */
                        row: number;
                        /**
                         * @min 1
                         * @max 24
                         */
                        width: number;
                        /** @min 1 */
                        height: number;
                        component: string;
                        config: object;
                    }[];
                    created_by: string;
                    /** @format date-time */
                    created_at: string;
                    /** @format date-time */
                    updated_at: string;
                },
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/api/views/${tableSlug}/${viewId}`,
                method: "GET",
                secure: true,
                format: "json",
                ...params,
            }),

        /**
         * No description
         *
         * @tags data-views
         * @name PutTableSlugViewId
         * @request PUT:/api/views/{table_slug}/{view_id}
         * @secure
         */
        putTableSlugViewId: (
            tableSlug: string,
            viewId: string,
            data: {
                /**
                 * @minLength 1
                 * @maxLength 128
                 */
                name?: string;
                /** @maxLength 512 */
                description?: string;
                is_default?: boolean;
                /** @minItems 1 */
                layout?: {
                    id: string;
                    label: string;
                    /**
                     * @min 1
                     * @max 24
                     */
                    column: number;
                    /** @min 1 */
                    row: number;
                    /**
                     * @min 1
                     * @max 24
                     */
                    width: number;
                    /** @min 1 */
                    height: number;
                    component: string;
                    config: object;
                }[];
            },
            params: RequestParams = {},
        ) =>
            this.request<
                {
                    id: string;
                    name: string;
                    description?: string | null;
                    table_slug: string;
                    is_default: boolean;
                    layout: {
                        id: string;
                        label: string;
                        /**
                         * @min 1
                         * @max 24
                         */
                        column: number;
                        /** @min 1 */
                        row: number;
                        /**
                         * @min 1
                         * @max 24
                         */
                        width: number;
                        /** @min 1 */
                        height: number;
                        component: string;
                        config: object;
                    }[];
                    created_by: string;
                    /** @format date-time */
                    created_at: string;
                    /** @format date-time */
                    updated_at: string;
                },
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/api/views/${tableSlug}/${viewId}`,
                method: "PUT",
                body: data,
                secure: true,
                type: ContentType.Json,
                format: "json",
                ...params,
            }),

        /**
         * No description
         *
         * @tags data-views
         * @name DeleteTableSlugViewId
         * @request DELETE:/api/views/{table_slug}/{view_id}
         * @secure
         */
        deleteTableSlugViewId: (tableSlug: string, viewId: string, params: RequestParams = {}) =>
            this.request<
                void,
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/api/views/${tableSlug}/${viewId}`,
                method: "DELETE",
                secure: true,
                ...params,
            }),

        /**
         * No description
         *
         * @tags data-views
         * @name PutTableSlugViewIdDefault
         * @request PUT:/api/views/{table_slug}/{view_id}/default
         * @secure
         */
        putTableSlugViewIdDefault: (tableSlug: string, viewId: string, params: RequestParams = {}) =>
            this.request<
                {
                    id: string;
                    name: string;
                    description?: string | null;
                    table_slug: string;
                    is_default: boolean;
                    layout: {
                        id: string;
                        label: string;
                        /**
                         * @min 1
                         * @max 24
                         */
                        column: number;
                        /** @min 1 */
                        row: number;
                        /**
                         * @min 1
                         * @max 24
                         */
                        width: number;
                        /** @min 1 */
                        height: number;
                        component: string;
                        config: object;
                    }[];
                    created_by: string;
                    /** @format date-time */
                    created_at: string;
                    /** @format date-time */
                    updated_at: string;
                },
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/api/views/${tableSlug}/${viewId}/default`,
                method: "PUT",
                secure: true,
                format: "json",
                ...params,
            }),

        /**
         * No description
         *
         * @tags data-views
         * @name PostTableSlugViewIdRender
         * @request POST:/api/views/{table_slug}/{view_id}/render
         * @secure
         */
        postTableSlugViewIdRender: (
            tableSlug: string,
            viewId: string,
            data: {
                filters?: any[];
                globalFilters?: any[];
            },
            params: RequestParams = {},
        ) =>
            this.request<
                {
                    view_id?: string;
                    view_name?: string;
                    table_slug?: string;
                    widgets?: {
                        widget_id?: string;
                        widget_label?: string;
                        component?: string;
                        data?: any;
                        error?: string | null;
                    }[];
                },
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/api/views/${tableSlug}/${viewId}/render`,
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
         * @tags data-views
         * @name PostTableSlugViewIdWidgetsWidgetIdData
         * @request POST:/api/views/{table_slug}/{view_id}/widgets/{widget_id}/data
         * @secure
         */
        postTableSlugViewIdWidgetsWidgetIdData: (
            tableSlug: string,
            viewId: string,
            widgetId: string,
            data: {
                filters?: any[];
                globalFilters?: any[];
                widgetOverrides?: object;
            },
            params: RequestParams = {},
        ) =>
            this.request<
                {
                    widget_id?: string;
                    widget_label?: string;
                    component?: string;
                    data?: any;
                    error?: string | null;
                },
                {
                    error: string;
                    code?: string;
                }
            >({
                path: `/api/views/${tableSlug}/${viewId}/widgets/${widgetId}/data`,
                method: "POST",
                body: data,
                secure: true,
                type: ContentType.Json,
                format: "json",
                ...params,
            }),
    };
}
