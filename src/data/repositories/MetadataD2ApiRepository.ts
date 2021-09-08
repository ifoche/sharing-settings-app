import i18n from "@eyeseetea/d2-ui-components/locales";
import _ from "lodash";
import { Future, FutureData } from "../../domain/entities/Future";
import { ImportResult, ImportStats } from "../../domain/entities/ImportResult";
import {
    isValidModel,
    ListMetadataResponse,
    ListOptions,
    MetadataModel,
    MetadataPayload,
    MetadataRepository,
} from "../../domain/repositories/MetadataRepository";
import { MetadataResponse, D2Api, Stats } from "../../types/d2-api";
import { getD2APiFromInstance } from "../../utils/d2-api";
import { apiToFuture } from "../../utils/futures";
import { Instance } from "../entities/Instance";

export class MetadataD2ApiRepository implements MetadataRepository {
    private api: D2Api;

    constructor(instance: Instance) {
        this.api = getD2APiFromInstance(instance);
    }

    public list(options: ListOptions): FutureData<ListMetadataResponse> {
        const { model, page, pageSize, search, sorting = { field: "id", order: "asc" } } = options;

        return apiToFuture(
            //@ts-ignore: d2-api incorrectly guessing model with string access
            this.api.models[model].get({
                page,
                pageSize,
                paging: true,
                filter: { identifiable: search ? { token: search } : undefined },
                fields: { $owner: true },
                order: `${sorting.field}:${sorting.order}`,
            })
        );
    }

    public save(payload: MetadataPayload): FutureData<ImportResult> {
        return apiToFuture(this.api.metadata.post(payload)).map(response => buildMetadataImportResult(response));
    }

    public getDependencies(ids: string[]): FutureData<MetadataPayload> {
        return this.fetchMetadata(ids)
            .flatMap(payload => {
                const items = _(payload)
                    .mapValues((items, key) => {
                        if (!Array.isArray(items) || !isValidModel(key)) return undefined;
                        return items.map(item => ({ model: key, id: item.id }));
                    })
                    .values()
                    .flatten()
                    .compact()
                    .value();

                return Future.futureMap(items, ({ model, id }) => this.fetchMetadataWithDependencies(model, id));
            })
            .map(data => mergePayloads(data));
    }

    private fetchMetadata(ids: string[]): FutureData<MetadataPayload> {
        return apiToFuture(this.api.get("/metadata", { filter: `id:in:[${ids.join(",")}]` }));
    }

    private fetchMetadataWithDependencies(model: MetadataModel, id: string): FutureData<MetadataPayload> {
        return apiToFuture<MetadataPayload>(this.api.get(`/${model}/${id}/metadata.json`));
    }
}

function mergePayloads(payloads: MetadataPayload[]): MetadataPayload {
    return _.reduce(
        payloads,
        (result, payload) => {
            _.forOwn(payload, (value, key) => {
                if (Array.isArray(value)) {
                    const existing = result[key] ?? [];
                    result[key] = _.uniqBy([...existing, ...value], ({ id }) => id);
                }
            });
            return result;
        },
        {} as MetadataPayload
    );
}

function buildMetadataImportResult(response: MetadataResponse): ImportResult {
    const { status, stats, typeReports = [] } = response;
    const typeStats = typeReports.flatMap(({ klass, stats }) => formatStats(stats, getClassName(klass)));

    const messages = typeReports.flatMap(({ objectReports = [] }) =>
        objectReports.flatMap(({ uid: id, errorReports = [] }) =>
            _.take(errorReports, 1).map(({ mainKlass, errorProperty, message }) => ({
                id,
                type: getClassName(mainKlass),
                property: errorProperty,
                message: message,
            }))
        )
    );

    return {
        title: i18n.t("Metadata"),
        date: new Date(),
        status: status === "OK" ? "SUCCESS" : status,
        stats: [formatStats(stats), ...typeStats],
        errors: messages,
        rawResponse: response,
    };
}

function formatStats(stats: Stats, type?: string): ImportStats {
    return {
        ..._.omit(stats, ["created"]),
        imported: stats.created,
        type,
    };
}

function getClassName(className: string): string | undefined {
    return _(className).split(".").last();
}
