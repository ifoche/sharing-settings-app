import i18n from "@dhis2/d2-i18n";
import { ObjectsTable, TableState, useSnackbar } from "@eyeseetea/d2-ui-components";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ListMetadataResponse,
    ListOptions,
    MetadataItem,
    MetadataModel
} from "../../../../domain/repositories/MetadataRepository";
import Dropdown, { DropdownOption } from "../../../components/dropdown/Dropdown";
import { useAppContext } from "../../../contexts/app-context";
import { MetadataSharingWizardStepProps } from "../SharingWizardSteps";

export const SelectMetadataStep: React.FC<MetadataSharingWizardStepProps> = ({
    selection,
    changeSelection: onChange,
}: MetadataSharingWizardStepProps) => {
    const { compositionRoot } = useAppContext();
    const snackbar = useSnackbar();

    const [isLoading, setLoading] = useState<boolean>(false);

    const [response, setResponse] = useState<ListMetadataResponse>(initialResponse);
    const [listOptions, setListOptions] = useState<ListOptions>(initialState);

    const columns = useMemo(
        () => [
            { name: "name", text: i18n.t("Name"), sortable: true },
            { name: "id", text: i18n.t("ID"), sortable: true },
            { name: "publicAccess", text: i18n.t("Public Access"), sortable: true },
            { name: "userAccesses", text: i18n.t("Users"), sortable: true },
            { name: "userGroupAccesses", text: i18n.t("User Groups"), sortable: true },
        ],
        []
    );

    useEffect(() => {
        setLoading(true);

        compositionRoot.metadata.list(listOptions).run(
            data => {
                const rows = data.objects.map((item: MetadataItem) => ({
                    ...item,
                    model: listOptions.model,
                }));

                setResponse({ objects: rows, pager: data.pager });
                setLoading(false);
            },
            error => snackbar.error(error)
        );
    }, [compositionRoot, snackbar, listOptions]);

    const onTableChange = useCallback(
        async ({ pagination, sorting, selection }: TableState<MetadataItem>) => {
            onChange(selection);
            setListOptions(options => ({
                ...options,
                pageSize: pagination.pageSize,
                page: pagination.page,
                sorting: { field: String(sorting.field), order: sorting.order },
            }));
        },
        [onChange]
    );

    const filterComponents = (
        <Dropdown<MetadataModel>
            items={filterModels}
            onValueChange={model => setListOptions(options => ({ ...options, model }))}
            value={listOptions.model}
            label={i18n.t("Metadata type")}
            hideEmpty={true}
        />
    );

    return (
        <ObjectsTable<MetadataItem>
            rows={response.objects}
            columns={columns}
            onChange={onTableChange}
            pagination={response.pager}
            sorting={{ field: "displayName", order: "asc" }}
            loading={isLoading}
            initialState={initialState}
            selection={selection}
            forceSelectionColumn={true}
            filterComponents={filterComponents}
            onChangeSearch={search => setListOptions(options => ({ ...options, search }))}
            searchBoxLabel={i18n.t(`Search by name`)}
        />
    );
};

const initialState: ListOptions = {
    model: "dashboards",
    sorting: { field: "name", order: "asc" },
    pageSize: 10,
};

const initialResponse: ListMetadataResponse = {
    objects: [],
    pager: { pageSize: 10, page: 1, total: 0 },
};

const filterModels: DropdownOption<MetadataModel>[] = [
    { id: "dataSets", name: i18n.t("Data Sets") },
    { id: "dashboards", name: i18n.t("Dashboards") },
    { id: "programs", name: i18n.t("Programs") },
];
