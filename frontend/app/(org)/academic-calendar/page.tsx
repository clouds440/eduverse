"use client";

import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";
import { Calendar, Layers, Search, Settings2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { searchFilterLookup } from "@/lib/filterLookups";
import { formatDepartmentLabel, getPublicUrl } from "@/lib/utils";
import { useUrlQueryState } from "@/hooks/useUrlQueryState";
import {
  AcademicEvent,
  AcademicEventType,
  Department,
  DepartmentScopeType,
  PaginatedResponse,
  Role,
} from "@/types";
import { Badge } from "@/components/ui/Badge";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  FilterDrawerGrid,
  PageControls,
} from "@/components/ui/FilterDrawerToolbar";
import {
  PageHeader,
  PageShell,
  ResourcePanel,
  type ActiveFilter,
} from "@/components/ui/PageShell";
import { RemoteFilterSelect } from "@/components/ui/RemoteFilterSelect";
import { SearchBar } from "@/components/ui/SearchBar";

const DEFAULT_EVENT_BANNER = "/assets/event.png";

const ACADEMIC_EVENT_TYPE_OPTIONS = [
  { value: AcademicEventType.HOLIDAY, label: "Holiday" },
  { value: AcademicEventType.EXAM_BREAK, label: "Exam break" },
  { value: AcademicEventType.EVENT, label: "Event" },
  { value: AcademicEventType.CLOSURE, label: "Closure" },
];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateRange(event: AcademicEvent) {
  const start = formatDate(event.startDate);
  const end = formatDate(event.endDate);
  return start === end ? start : `${start} - ${end}`;
}

function getTypeLabel(type: AcademicEventType) {
  return (
    ACADEMIC_EVENT_TYPE_OPTIONS.find((option) => option.value === type)
      ?.label || "Event"
  );
}

function getDepartmentSummary(event: AcademicEvent) {
  if (event.departmentScopeType === DepartmentScopeType.ALL)
    return "All departments";
  const departments = event.departmentLinks
    ?.map((link) => link.department)
    .filter(Boolean) as Department[] | undefined;
  if (!departments?.length) return "Selected departments";
  const labels = departments.map(
    (department) => department.code || department.name || "Dept",
  );
  if (labels.length <= 3) return labels.join(", ");
  return `${labels.slice(0, 3).join(", ")} +${labels.length - 3}`;
}

function getBannerSrc(event: AcademicEvent) {
  return event.bannerUrl
    ? getPublicUrl(event.bannerUrl, event.bannerUpdatedAt)
    : DEFAULT_EVENT_BANNER;
}

export default function AcademicCalendarPage() {
  const { token, user } = useAuth();
  const { getStringParam, updateQueryParams } = useUrlQueryState();
  const searchTerm = getStringParam("search");
  const typeFilter = getStringParam("type");
  const departmentId = getStringParam("departmentId");
  const canManage =
    user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;

  const params = {
    page: 1,
    limit: 100,
    search: searchTerm || undefined,
    type: typeFilter ? (typeFilter as AcademicEventType) : undefined,
    isActive: true,
    departmentId: departmentId || undefined,
  };
  const { data, isLoading, error, mutate } = useSWR<
    PaginatedResponse<AcademicEvent>
  >(token ? (["academic-events", params] as const) : null);

  const activeFilters: ActiveFilter[] = [
    ...(searchTerm
      ? [
          {
            key: "search",
            label: "Search",
            value: searchTerm,
            onRemove: () => updateQueryParams({ search: undefined }),
          },
        ]
      : []),
    ...(typeFilter
      ? [
          {
            key: "type",
            label: "Type",
            value: getTypeLabel(typeFilter as AcademicEventType),
            onRemove: () => updateQueryParams({ type: undefined }),
          },
        ]
      : []),
    ...(departmentId
      ? [
          {
            key: "departmentId",
            label: "Department",
            value: "Selected department",
            onRemove: () => updateQueryParams({ departmentId: undefined }),
          },
        ]
      : []),
  ];

  const renderFilters = () => (
    <FilterDrawerGrid>
      <CustomSelect
        value={typeFilter}
        onChange={(value) => updateQueryParams({ type: value || undefined })}
        options={[
          { value: "", label: "All types", icon: Calendar },
          ...ACADEMIC_EVENT_TYPE_OPTIONS,
        ]}
      />
      <RemoteFilterSelect<Department>
        cacheKey="calendar-public-department-filter"
        value={departmentId}
        onChange={(value) =>
          updateQueryParams({ departmentId: value || undefined })
        }
        placeholder="All departments"
        allLabel="All departments"
        icon={Layers}
        selectedLabel="Selected department"
        loadOptions={(search) =>
          searchFilterLookup({
            token: token!,
            entity: "departments",
            search,
            isActive: true,
          })
        }
      />
    </FilterDrawerGrid>
  );

  if (error) return <ErrorState error={error} onRetry={() => mutate()} />;

  return (
    <PageShell>
      <PageHeader
        title="Academic Calendar"
        description="Upcoming holidays, closures, exam breaks, and academic events across the organization."
        icon={Calendar}
        meta={
          <Badge variant="neutral" size="sm">
            {data?.totalRecords || 0} active
          </Badge>
        }
        breadcrumbs={[
          { label: "Organization" },
          { label: "Academics" },
          { label: "Academic Calendar" },
        ]}
        actions={
          <PageControls
            drawerLabel="Calendar filters"
            activeFilters={activeFilters}
            renderFilters={renderFilters}
            leading={
              <SearchBar
                value={searchTerm}
                onChange={(value) =>
                  updateQueryParams({ search: value || undefined })
                }
                placeholder="Search events..."
                mobileMode="expandable"
              />
            }
            actions={
              canManage ? (
                <Link
                  href="/academic-calendar/manage"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-transparent bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary-hover"
                >
                  <Settings2 className="h-4 w-4" />
                  <span>Manage</span>
                </Link>
              ) : undefined
            }
          />
        }
      />

      <ResourcePanel>
        {isLoading ? (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-80 animate-pulse rounded-lg border border-border bg-muted/30"
              />
            ))}
          </div>
        ) : data?.data.length ? (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.data.map((event) => (
              <article
                key={event.id}
                className="overflow-hidden rounded-lg border border-border bg-card shadow-sm"
              >
                <div className="relative aspect-video bg-muted">
                  <Image
                    src={getBannerSrc(event)}
                    alt={event.title}
                    fill
                    className="object-cover"
                    sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 100vw"
                  />
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="neutral" size="sm">
                      {getTypeLabel(event.type)}
                    </Badge>
                    <Badge variant="info" size="sm">
                      {formatDateRange(event)}
                    </Badge>
                  </div>
                  <div>
                    <h2 className="line-clamp-2 text-base font-black text-foreground">
                      {event.title}
                    </h2>
                    {event.description && (
                      <p className="mt-1 line-clamp-3 text-sm font-medium text-muted-foreground">
                        {event.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-xs font-bold text-muted-foreground">
                    <span className="truncate">
                      {getDepartmentSummary(event)}
                    </span>
                    <span className="shrink-0">
                      {event.isFullDay
                        ? "Full day"
                        : `${event.startTime} - ${event.endTime}`}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="p-8">
            <EmptyState
              icon={Search}
              title="No active events found"
              description={
                activeFilters.length
                  ? "Adjust the filters to broaden the calendar view."
                  : "Active academic events will appear here."
              }
            />
          </div>
        )}
      </ResourcePanel>
    </PageShell>
  );
}
