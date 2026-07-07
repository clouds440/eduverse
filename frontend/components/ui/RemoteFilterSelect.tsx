'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import type { LucideIcon } from 'lucide-react';
import { CustomSelect, type DropdownOption } from './CustomSelect';

const DEFAULT_MIN_SEARCH_LENGTH = 2;
const DEFAULT_LIMIT = 25;

interface RemoteFilterSelectBaseProps {
    cacheKey: string;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    allLabel: string;
    icon?: LucideIcon;
    selectedLabel?: string;
    selectedIcon?: LucideIcon;
    className?: string;
    disabled?: boolean;
    searchPlaceholder?: string;
    minSearchLength?: number;
    limit?: number;
}

type RemoteFilterSelectProps<TItem> = RemoteFilterSelectBaseProps & (
    | {
        loadOptions: (search: string) => Promise<DropdownOption[]>;
        fetchOptions?: never;
        mapOption?: never;
    }
    | {
        fetchOptions: (search: string) => Promise<TItem[]>;
        mapOption: (item: TItem) => DropdownOption;
        loadOptions?: never;
    }
);

export function RemoteFilterSelect<TItem>({
    cacheKey,
    value,
    onChange,
    loadOptions,
    fetchOptions,
    mapOption,
    placeholder,
    allLabel,
    icon,
    selectedLabel,
    selectedIcon,
    className,
    disabled,
    searchPlaceholder,
    minSearchLength = DEFAULT_MIN_SEARCH_LENGTH,
    limit = DEFAULT_LIMIT,
}: RemoteFilterSelectProps<TItem>) {
    const [search, setSearch] = useState('');
    const trimmedSearch = search.trim();
    const canSearch = trimmedSearch.length >= minSearchLength;
    const swrKey: readonly ['remote-filter-select', string, string, number] | null = canSearch
        ? ['remote-filter-select', cacheKey, trimmedSearch, limit] as const
        : null;
    const { data: fetchedOptions = [], isLoading } = useSWR<DropdownOption[]>(
        swrKey,
        ([, , query]: readonly ['remote-filter-select', string, string, number]) => {
            if (loadOptions) return loadOptions(query);
            if (!fetchOptions || !mapOption) return Promise.resolve([]);
            return fetchOptions(query).then((items) => items.map(mapOption));
        },
        { keepPreviousData: false },
    );

    const options = useMemo<DropdownOption[]>(() => {
        const baseOption: DropdownOption = { value: '', label: allLabel, icon };
        const selectedOption = value && !fetchedOptions.some((option) => option.value === value)
            ? { value, label: selectedLabel || 'Selected item', icon: selectedIcon || icon }
            : null;

        return [
            baseOption,
            ...(selectedOption ? [selectedOption] : []),
            ...fetchedOptions.filter((option) => option.value !== ''),
        ];
    }, [allLabel, fetchedOptions, icon, selectedIcon, selectedLabel, value]);

    const emptyMessage = trimmedSearch.length === 0
        ? `Type at least ${minSearchLength} characters to search.`
        : trimmedSearch.length < minSearchLength
            ? `Keep typing, ${minSearchLength} characters minimum.`
            : undefined;

    return (
        <CustomSelect
            value={value}
            onChange={onChange}
            options={options}
            placeholder={placeholder}
            icon={icon}
            className={className}
            disabled={disabled}
            searchable
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder={searchPlaceholder}
            isSearching={isLoading}
            emptyMessage={emptyMessage}
        />
    );
}
