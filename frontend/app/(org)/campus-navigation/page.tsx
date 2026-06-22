'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { MapPinned, RotateCcw } from 'lucide-react';
import { CampusNavigationDirectory, formatRoomTypeLabel } from '@/components/campus/CampusNavigationDirectory';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterDrawerGrid, PageControls } from '@/components/ui/FilterDrawerToolbar';
import { Label } from '@/components/ui/Label';
import { PageHeader, PageShell, ResourcePanel, type ActiveFilter } from '@/components/ui/PageShell';
import { SearchBar } from '@/components/ui/SearchBar';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useAuth } from '@/context/AuthContext';
import { useUrlQueryState } from '@/hooks/useUrlQueryState';
import { formatBuildingLabel, formatDepartmentLabel } from '@/lib/utils';
import { CampusNavigationResponse, RoomType } from '@/types';

export default function CampusNavigationPage() {
    const { token } = useAuth();
    const { getStringParam, updateQueryParams } = useUrlQueryState();

    const q = getStringParam('q');
    const roomId = getStringParam('roomId');
    const buildingCode = getStringParam('buildingCode');
    const departmentCode = getStringParam('departmentCode');
    const floor = getStringParam('floor');
    const roomType = getStringParam('roomType') as RoomType | '';
    const targetType = getStringParam('targetType') as 'building' | 'department' | 'room' | 'area' | 'landmark' | '';
    const targetCode = getStringParam('targetCode');
    const targetId = getStringParam('targetId');

    const params = useMemo(() => ({
        q,
        roomId,
        buildingCode,
        departmentCode,
        floor,
        roomType,
    }), [buildingCode, departmentCode, floor, q, roomId, roomType]);

    const { data, isLoading, error, mutate } = useSWR<CampusNavigationResponse>(
        token ? ['campus-navigation', params] as const : null,
    );

    const buildingOptions = useMemo(() => {
        const options = data?.buildings.map((building) => ({
            value: building.code,
            label: formatBuildingLabel(building),
        })) || [];
        return [{ value: '', label: 'All Buildings' }, ...options];
    }, [data?.buildings]);

    const departmentOptions = useMemo(() => {
        const options = data?.lookups.departments.map((department) => ({
            value: department.code,
            label: formatDepartmentLabel(department),
        })) || [];
        return [{ value: '', label: 'All Departments' }, ...options];
    }, [data?.lookups.departments]);

    const floorOptions = useMemo(() => {
        const options = data?.lookups.floors.map((item) => ({ value: item, label: `Floor ${item}` })) || [];
        return [{ value: '', label: 'All Floors' }, ...options];
    }, [data?.lookups.floors]);

    const roomTypeOptions = useMemo<Array<{ value: RoomType | ''; label: string }>>(() => [
        { value: '', label: 'All Room Types' },
        ...Object.values(RoomType).map((value) => ({ value, label: formatRoomTypeLabel(value) })),
    ], []);

    const activeFilters = useMemo<ActiveFilter[]>(() => [
        ...(q ? [{ key: 'q', label: 'Search', value: q, onRemove: () => updateQueryParams({ q: undefined }) }] : []),
        ...(roomId ? [{ key: 'roomId', label: 'Room View', value: 'Selected room', onRemove: () => updateQueryParams({ roomId: undefined }) }] : []),
        ...(buildingCode ? [{ key: 'buildingCode', label: 'Building', value: buildingCode, onRemove: () => updateQueryParams({ buildingCode: undefined }) }] : []),
        ...(departmentCode ? [{ key: 'departmentCode', label: 'Department', value: departmentCode, onRemove: () => updateQueryParams({ departmentCode: undefined }) }] : []),
        ...(floor ? [{ key: 'floor', label: 'Floor', value: floor, onRemove: () => updateQueryParams({ floor: undefined }) }] : []),
        ...(roomType ? [{ key: 'roomType', label: 'Type', value: formatRoomTypeLabel(roomType), onRemove: () => updateQueryParams({ roomType: undefined }) }] : []),
    ], [buildingCode, departmentCode, floor, q, roomId, roomType, updateQueryParams]);

    const updateFilters = (next: Partial<typeof params>) => updateQueryParams({ ...next, roomId: undefined });

    const resetFilters = () => updateQueryParams({
        q: undefined,
        roomId: undefined,
        buildingCode: undefined,
        departmentCode: undefined,
        floor: undefined,
        roomType: undefined,
        targetType: undefined,
        targetCode: undefined,
        targetId: undefined,
    });

    return (
        <PageShell>
            <PageHeader
                title="Campus Navigation"
                description="Find buildings, departments, floors, rooms, landmarks, and directions from the campus directory."
                icon={MapPinned}
                breadcrumbs={[{ label: 'Organization' }, { label: 'Campus Navigation' }]}
            />

            <ResourcePanel>
                <div className="shrink-0 border-b border-border/60 bg-card/95 p-2.5 sm:p-3">
                    <PageControls
                        activeFilters={activeFilters}
                        leading={<SearchBar value={q} onChange={(value) => updateFilters({ q: value })} placeholder="Search by room, code, building, floor, department, or landmark..." mobileMode="expandable" />}
                        actions={activeFilters.length > 0 ? <Button variant="secondary" icon={RotateCcw} onClick={resetFilters}>Reset</Button> : undefined}
                        renderFilters={() => (
                            <FilterDrawerGrid>
                            <div className="min-w-44 space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Building</Label>
                                <CustomSelect options={buildingOptions} value={buildingCode} onChange={(value) => updateFilters({ buildingCode: value })} placeholder="All Buildings" searchable />
                            </div>
                            <div className="min-w-44 space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Department</Label>
                                <CustomSelect options={departmentOptions} value={departmentCode} onChange={(value) => updateFilters({ departmentCode: value })} placeholder="All Departments" searchable />
                            </div>
                            <div className="min-w-36 space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Floor</Label>
                                <CustomSelect options={floorOptions} value={floor} onChange={(value) => updateFilters({ floor: value })} placeholder="All Floors" searchable />
                            </div>
                            <div className="min-w-44 space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Room Type</Label>
                                <CustomSelect options={roomTypeOptions} value={roomType} onChange={(value) => updateFilters({ roomType: value })} placeholder="All Room Types" searchable />
                            </div>
                            </FilterDrawerGrid>
                        )}
                    />
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar">
                    {error ? (
                        <ErrorState error={error} onRetry={() => mutate()} />
                    ) : isLoading ? (
                        <div className="grid gap-3">
                            <SkeletonCard />
                            <SkeletonCard />
                            <SkeletonCard />
                        </div>
                    ) : (
                        <CampusNavigationDirectory
                            data={data}
                            targetType={targetType || undefined}
                            targetCode={targetCode || undefined}
                            targetId={targetId || undefined}
                            selectedRoomId={roomId || undefined}
                            onRoomOpen={(nextRoomId) => updateQueryParams({ roomId: nextRoomId })}
                            onRoomClose={() => updateQueryParams({ roomId: undefined })}
                        />
                    )}
                </div>
            </ResourcePanel>
        </PageShell>
    );
}
