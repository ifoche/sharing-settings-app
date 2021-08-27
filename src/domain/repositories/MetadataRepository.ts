import { FutureData } from "../entities/Future";

export interface MetadataRepository {
    list(options: ListOptions): FutureData<ListMetadataResponse>;
    getDependencies(ids: string[]): FutureData<MetadataPayload>;
}

export interface ListOptions {
    model: MetadataModel;
    page?: number;
    pageSize?: number;
    search?: string;
    sorting?: { field: string; order: "asc" | "desc" };
}

export type MetadataModel = "dataSets" | "programs" | "dashboards";

export type MetadataPayload = Record<string, MetadataItem[]>;

export type MetadataItem = { id: string; [key: string]: string | number | boolean | undefined };

export interface ListMetadataResponse {
    objects: MetadataItem[];
    pager: Pager;
}

export interface Pager {
    page: number;
    pageSize: number;
    total: number;
}
