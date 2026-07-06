'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Building2, ChevronDown, ChevronUp, DoorOpen, MapPin, Navigation, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatBuildingLabel, formatDepartmentLabel, getPublicUrl } from '@/lib/utils';
import {
    CampusNavigationBuilding,
    CampusNavigationBuildingRoomsResponse,
    CampusNavigationResponse,
    CampusNavigationRoom,
    CampusNavigationRoomSelection,
    RoomType,
} from '@/types';

type CampusTargetType = 'building' | 'department' | 'room' | 'area' | 'landmark';

interface CampusNavigationQueryParams {
    q?: string;
    buildingCode?: string;
    departmentCode?: string;
    floor?: string;
    roomType?: RoomType | '';
}

interface CampusNavigationDirectoryProps {
    data?: CampusNavigationResponse;
    queryParams?: CampusNavigationQueryParams;
    selectedRoomData?: CampusNavigationRoomSelection;
    isSelectedRoomLoading?: boolean;
    targetType?: CampusTargetType;
    targetCode?: string;
    targetId?: string;
    selectedRoomId?: string;
    onRoomOpen?: (roomId: string) => void;
    onRoomClose?: () => void;
}

export function formatRoomTypeLabel(type?: RoomType | null) {
    if (!type) return 'General';
    return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isTarget(targetType: CampusTargetType | undefined, targetCode: string | undefined, targetId: string | undefined, type: CampusTargetType, item: { id?: string; code?: string | null; landmark?: string | null }) {
    if (!targetType || targetType !== type) return false;
    const codeMatches = targetCode && item.code?.toLowerCase() === targetCode.toLowerCase();
    const idMatches = targetId && item.id === targetId;
    const landmarkMatches = type === 'landmark' && targetCode && item.landmark?.toLowerCase().includes(targetCode.toLowerCase());
    return Boolean(codeMatches || idMatches || landmarkMatches);
}

function RoomCard({ room, building, highlighted, onOpen }: { room: CampusNavigationRoom; building: CampusNavigationBuilding; highlighted: boolean; onOpen?: (roomId: string) => void }) {
    return (
        <button
            type="button"
            onClick={() => onOpen?.(room.id)}
            className={`w-full rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${highlighted ? 'border-primary bg-primary/10' : 'border-border/70 bg-background/70 hover:border-primary/45 hover:bg-primary/5'}`}
        >
            <div className="flex min-w-0 gap-3">
                <div className="relative flex h-20 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/70 bg-primary/10 text-primary">
                    {room.imageUrl ? (
                        <Image src={getPublicUrl(room.imageUrl, room.imageUpdatedAt)} alt={room.name} fill className="object-cover" sizes="96px" />
                    ) : (
                        <DoorOpen className="h-6 w-6" aria-hidden="true" />
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <h4 className="truncate text-sm font-black text-foreground">{room.name}</h4>
                                <Badge variant="neutral" size="sm">{room.code}</Badge>
                                <Badge variant="info" size="sm">{formatRoomTypeLabel(room.type)}</Badge>
                            </div>
                            <p className="mt-1 text-xs font-semibold text-muted-foreground">
                                {formatBuildingLabel(building)} - Floor {room.floor}
                            </p>
                        </div>
                        {room.capacity ? <span className="rounded-md bg-muted px-2 py-1 text-xs font-bold text-muted-foreground">{room.capacity} seats</span> : null}
                    </div>
                </div>
            </div>

            {(room.landmark || room.directionsNote || room.description) && (
                <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                    {room.landmark && <p><span className="font-bold text-foreground">Landmark:</span> {room.landmark}</p>}
                    {room.directionsNote && <p><span className="font-bold text-foreground">Directions:</span> {room.directionsNote}</p>}
                    {room.description && <p>{room.description}</p>}
                </div>
            )}

            {room.sections.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {room.sections.map((section) => (
                        <span key={section.id} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
                            <Users className="h-3 w-3" aria-hidden="true" />
                            {section.course?.code ? `${section.course.code} - ` : ''}{section.name}
                        </span>
                    ))}
                </div>
            )}
        </button>
    );
}

function RoomDetailsSkeleton() {
    return (
        <div className="grid min-h-0 gap-0 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
            <Skeleton className="min-h-72 rounded-none lg:min-h-[32rem]" />
            <div className="space-y-4 p-4 sm:p-5">
                <div className="flex flex-wrap gap-1.5">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 w-28" />
                    <Skeleton className="h-6 w-18" />
                </div>
                <div className="space-y-3 rounded-md border border-border/70 bg-background/65 p-3">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                </div>
                <div className="space-y-3 rounded-md border border-border/70 bg-background/65 p-3">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                </div>
            </div>
        </div>
    );
}

function RoomDetailsModal({
    isOpen,
    isLoading,
    selection,
    onClose,
}: {
    isOpen: boolean;
    isLoading?: boolean;
    selection?: CampusNavigationRoomSelection;
    onClose: () => void;
}) {
    const room = selection?.room;
    const building = selection?.building;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={room ? `${room.name} (${room.code})` : 'Room details'}
            subtitle={building ? `${formatBuildingLabel(building)} - Floor ${room?.floor || ''}` : undefined}
            maxWidth="max-w-5xl"
            bodyClassName="p-0"
        >
            {isLoading ? (
                <RoomDetailsSkeleton />
            ) : room && building ? (
                <div className="grid min-h-0 gap-0 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
                    <div className="relative min-h-72 bg-primary/10 lg:min-h-[32rem]">
                        {room.imageUrl ? (
                            <Image src={getPublicUrl(room.imageUrl, room.imageUpdatedAt)} alt={room.name} fill className="object-contain" sizes="(min-width: 1024px) 58vw, 100vw" />
                        ) : (
                            <div className="flex h-full min-h-72 items-center justify-center text-primary">
                                <DoorOpen className="h-16 w-16" aria-hidden="true" />
                            </div>
                        )}
                    </div>
                    <div className="space-y-4 p-4 sm:p-5">
                        <div className="flex flex-wrap gap-1.5">
                            <Badge variant="neutral" size="sm">{room.code}</Badge>
                            <Badge variant="info" size="sm">{formatRoomTypeLabel(room.type)}</Badge>
                            <Badge variant="neutral" size="sm">Floor {room.floor}</Badge>
                            {room.capacity ? <Badge variant="neutral" size="sm">{room.capacity} seats</Badge> : null}
                        </div>

                        <section className="rounded-md border border-border/70 bg-background/65 p-3">
                            <h3 className="text-sm font-black text-foreground">Room Details</h3>
                            <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                                {room.landmark && <p><span className="font-bold text-foreground">Landmark:</span> {room.landmark}</p>}
                                {room.directionsNote && <p><span className="font-bold text-foreground">Directions:</span> {room.directionsNote}</p>}
                                {room.description && <p>{room.description}</p>}
                                {!room.landmark && !room.directionsNote && !room.description && <p>No room notes yet.</p>}
                            </div>
                        </section>

                        <section className="rounded-md border border-border/70 bg-background/65 p-3">
                            <h3 className="text-sm font-black text-foreground">Building Details</h3>
                            <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                                <p><span className="font-bold text-foreground">Building:</span> {formatBuildingLabel(building)}</p>
                                {building.address && <p><span className="font-bold text-foreground">Address:</span> {building.address}</p>}
                                {building.landmark && <p><span className="font-bold text-foreground">Landmark:</span> {building.landmark}</p>}
                                {building.directionsNote && <p><span className="font-bold text-foreground">Directions:</span> {building.directionsNote}</p>}
                                {building.description && <p>{building.description}</p>}
                            </div>
                            {building.departments?.length ? (
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                    {building.departments.map((department) => (
                                        <Badge key={department.id} variant="primary" size="sm" color={department.color}>
                                            {formatDepartmentLabel(department)}
                                        </Badge>
                                    ))}
                                </div>
                            ) : null}
                        </section>

                        {room.sections.length > 0 && (
                            <section className="rounded-md border border-border/70 bg-background/65 p-3">
                                <h3 className="text-sm font-black text-foreground">Scheduled Sections</h3>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {room.sections.map((section) => (
                                        <span key={section.id} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
                                            <Users className="h-3 w-3" aria-hidden="true" />
                                            {section.course?.code ? `${section.course.code} - ` : ''}{section.name}
                                        </span>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                </div>
            ) : (
                <EmptyState title="Room not found" description="The selected room may no longer be available." className="m-4 min-h-64" />
            )}
        </Modal>
    );
}

function BuildingSection({
    building,
    targetType,
    targetCode,
    targetId,
    onRoomOpen,
    onLoadAllRooms,
    isLoadingRooms,
    isRoomsCollapsed,
    onToggleRooms,
}: {
    building: CampusNavigationBuilding;
    targetType?: CampusTargetType;
    targetCode?: string;
    targetId?: string;
    onRoomOpen?: (roomId: string) => void;
    onLoadAllRooms: (buildingId: string) => void;
    isLoadingRooms: boolean;
    isRoomsCollapsed: boolean;
    onToggleRooms: (buildingId: string) => void;
}) {
    const highlighted = isTarget(targetType, targetCode, targetId, 'building', building);
    const hasMoreRooms = building.roomsTotal > building.rooms.length;

    return (
        <section className={`rounded-lg border bg-card ${highlighted ? 'border-primary shadow-sm shadow-primary/10' : 'border-border/70'}`}>
            <div className="border-b border-border/60 p-4">
                <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start">
                    <div className="relative h-40 w-full shrink-0 overflow-hidden rounded-md border border-border/70 bg-primary/10 text-primary lg:h-32 lg:w-56">
                        {building.imageUrl ? (
                            <Image src={getPublicUrl(building.imageUrl, building.imageUpdatedAt)} alt={formatBuildingLabel(building)} fill className="object-cover" sizes="(min-width: 1024px) 224px, 100vw" />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center">
                                <Building2 className="h-8 w-8" aria-hidden="true" />
                            </div>
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <Building2 className="h-5 w-5 text-primary" aria-hidden="true" />
                            <h3 className="truncate text-base font-black text-foreground">{formatBuildingLabel(building)}</h3>
                            <Badge variant="neutral" size="sm">{building.roomsTotal} rooms</Badge>
                            <Badge variant="neutral" size="sm">{building.floorsTotal} floors</Badge>
                        </div>
                        {building.address && <p className="mt-1 text-sm font-medium text-muted-foreground">{building.address}</p>}
                    </div>
                    <div className="flex flex-wrap gap-1.5 lg:ml-auto">
                        {building.departments?.map((department) => (
                            <Badge key={department.id} variant="primary" size="sm" color={department.color}>
                                {formatDepartmentLabel(department)}
                            </Badge>
                        ))}
                    </div>
                </div>

                {(building.landmark || building.directionsNote || building.description) && (
                    <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                        {building.landmark && <p><span className="font-bold text-foreground">Landmark:</span> {building.landmark}</p>}
                        {building.directionsNote && <p><span className="font-bold text-foreground">Directions:</span> {building.directionsNote}</p>}
                        {building.description && <p>{building.description}</p>}
                    </div>
                )}

                {building.roomsTotal > 0 && (
                    <div className="mt-3 flex justify-end">
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            icon={isRoomsCollapsed ? ChevronDown : ChevronUp}
                            onClick={() => onToggleRooms(building.id)}
                        >
                            {isRoomsCollapsed ? 'Show rooms' : 'Hide rooms'}
                        </Button>
                    </div>
                )}
            </div>

            {!isRoomsCollapsed && (
                <div className="divide-y divide-border/60">
                    {building.floors.map((floor) => (
                        <div key={floor.floor} className="grid gap-3 p-4 lg:grid-cols-[9rem_1fr]">
                            <div className="flex items-center gap-2 text-sm font-black text-foreground lg:items-start">
                                <Navigation className="h-4 w-4 text-primary" aria-hidden="true" />
                                Floor {floor.floor}
                            </div>
                            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                {floor.rooms.map((room) => (
                                    <RoomCard
                                        key={room.id}
                                        room={room}
                                        building={building}
                                        highlighted={isTarget(targetType, targetCode, targetId, 'room', room) || isTarget(targetType, targetCode, targetId, 'landmark', room)}
                                        onOpen={onRoomOpen}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}

                    {hasMoreRooms && (
                        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm font-semibold text-muted-foreground">
                                Showing {building.rooms.length} of {building.roomsTotal} rooms.
                            </p>
                            {isLoadingRooms ? (
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-5 w-36" />
                                    <Skeleton className="h-9 w-28" />
                                </div>
                            ) : (
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => onLoadAllRooms(building.id)}
                                >
                                    Load all rooms
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}

function findRoomSelection(data: CampusNavigationResponse | undefined, roomId: string | undefined) {
    if (!data || !roomId) return undefined;
    for (const building of data.buildings) {
        const room = building.rooms.find((item) => item.id === roomId);
        if (room) return { room, building };
    }
    return undefined;
}

export function CampusNavigationDirectory({
    data,
    queryParams,
    selectedRoomData,
    isSelectedRoomLoading,
    targetType,
    targetCode,
    targetId,
    selectedRoomId,
    onRoomOpen,
    onRoomClose,
}: CampusNavigationDirectoryProps) {
    const { token } = useAuth();
    const [loadedRoomsByBuilding, setLoadedRoomsByBuilding] = useState<Record<string, CampusNavigationBuildingRoomsResponse>>({});
    const [loadingBuildingId, setLoadingBuildingId] = useState<string | null>(null);
    const [collapsedBuildingIds, setCollapsedBuildingIds] = useState<Set<string>>(() => new Set());
    const previewSelection = findRoomSelection(data, selectedRoomId);
    const selectedRoom = selectedRoomData || previewSelection;
    const queryKey = useMemo(() => JSON.stringify(queryParams || {}), [queryParams]);

    useEffect(() => {
        setLoadedRoomsByBuilding({});
        setLoadingBuildingId(null);
        setCollapsedBuildingIds(new Set());
    }, [queryKey]);

    const getBuildingWithLoadedRooms = (building: CampusNavigationBuilding): CampusNavigationBuilding => {
        const loaded = loadedRoomsByBuilding[building.id];
        if (!loaded) return building;
        return {
            ...building,
            rooms: loaded.rooms,
            floors: loaded.floors,
            roomsTotal: loaded.roomsTotal,
            floorsTotal: loaded.floorsTotal,
        };
    };

    const handleLoadAllRooms = async (buildingId: string) => {
        if (!token || loadingBuildingId) return;
        setLoadingBuildingId(buildingId);
        try {
            const loadedRooms = await api.org.getCampusNavigationBuildingRooms(token, buildingId, {
                q: queryParams?.q,
                floor: queryParams?.floor,
                roomType: queryParams?.roomType,
            });
            setLoadedRoomsByBuilding((current) => ({ ...current, [buildingId]: loadedRooms }));
        } finally {
            setLoadingBuildingId(null);
        }
    };

    const toggleRoomsCollapsed = (buildingId: string) => {
        setCollapsedBuildingIds((current) => {
            const next = new Set(current);
            if (next.has(buildingId)) next.delete(buildingId);
            else next.add(buildingId);
            return next;
        });
    };

    if (!data || data.buildings.length === 0) {
        return (
            <>
                <EmptyState
                    icon={MapPin}
                    title="No campus locations found"
                    description="Try another building, department, floor, room type, code, or landmark."
                    className="min-h-80"
                />
                <RoomDetailsModal
                    isOpen={Boolean(selectedRoomId)}
                    isLoading={isSelectedRoomLoading}
                    selection={selectedRoom}
                    onClose={onRoomClose || (() => undefined)}
                />
            </>
        );
    }

    return (
        <>
            <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-3">
                    {[
                        ['Buildings', data.counts.buildings],
                        ['Rooms', data.counts.rooms],
                        ['Departments', data.counts.departments],
                    ].map(([label, value]) => (
                        <div key={label} className="rounded-lg border border-border/70 bg-card p-3">
                            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
                            <p className="mt-1 text-2xl font-black text-foreground">{value}</p>
                        </div>
                    ))}
                </div>

                {data.buildings.map((building) => {
                    const displayedBuilding = getBuildingWithLoadedRooms(building);
                    return (
                        <BuildingSection
                            key={building.id}
                            building={displayedBuilding}
                            targetType={targetType}
                            targetCode={targetCode}
                            targetId={targetId}
                            onRoomOpen={onRoomOpen}
                            onLoadAllRooms={handleLoadAllRooms}
                            isLoadingRooms={loadingBuildingId === building.id}
                            isRoomsCollapsed={collapsedBuildingIds.has(building.id)}
                            onToggleRooms={toggleRoomsCollapsed}
                        />
                    );
                })}
            </div>
            <RoomDetailsModal
                isOpen={Boolean(selectedRoomId)}
                isLoading={isSelectedRoomLoading}
                selection={selectedRoom}
                onClose={onRoomClose || (() => undefined)}
            />
        </>
    );
}
