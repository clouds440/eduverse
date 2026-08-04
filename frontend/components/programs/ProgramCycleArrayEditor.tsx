'use client';

import { ArrowDown, ArrowUp, CalendarRange, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Course, CourseRequirementType, EligibleProgramCycle, ProgramCycleInput } from '@/types';

interface ProgramCycleArrayEditorProps {
    value: ProgramCycleInput[];
    onChange: (value: ProgramCycleInput[]) => void;
    eligibleCycles: EligibleProgramCycle[];
    courses: Course[];
    canCreateCycles: boolean;
    rowErrors?: Record<number, string>;
}

function emptyCycle(index: number): ProgramCycleInput {
    return {
        kind: 'EXISTING',
        academicCycleId: '',
        stage: {
            name: `Stage ${index + 1}`,
            code: `STAGE-${index + 1}`,
            courseRequirements: [],
        },
    };
}

export function ProgramCycleArrayEditor({ value, onChange, eligibleCycles, courses, canCreateCycles, rowErrors = {} }: ProgramCycleArrayEditorProps) {
    const update = (index: number, row: ProgramCycleInput) => {
        const next = [...value];
        next[index] = row;
        onChange(next);
    };

    const move = (index: number, direction: -1 | 1) => {
        const target = index + direction;
        if (target < 0 || target >= value.length) return;
        const next = [...value];
        [next[index], next[target]] = [next[target], next[index]];
        onChange(next);
    };

    return (
        <div className="space-y-4">
            <div className="flex min-h-10 items-center justify-between gap-3 px-1">
                <div>
                    <Label className="text-sm font-black">Ordered program stages</Label>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">{value.length === 0 ? 'No stages added' : `${value.length} ${value.length === 1 ? 'stage' : 'stages'} required for completion`}</p>
                </div>
                <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    icon={Plus}
                    title="Add academic cycle"
                    aria-label="Add academic cycle"
                    onClick={() => onChange([...value, emptyCycle(value.length)])}
                />
            </div>

            {value.length === 0 && (
                <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/45 px-5 py-8 text-center">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md border border-border/70 bg-background text-primary">
                        <CalendarRange className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <p className="text-sm font-black text-foreground">Add the first program stage</p>
                    <p className="mt-1 max-w-md text-xs font-medium leading-relaxed text-muted-foreground">Each stage links an institute cycle to its name and course requirements.</p>
                    <Button
                        type="button"
                        variant="secondary"
                        icon={Plus}
                        className="mt-4"
                        onClick={() => onChange([emptyCycle(0)])}
                    >
                        Add first stage
                    </Button>
                </div>
            )}

            {value.map((row, index) => (
                <section key={index} className="overflow-hidden rounded-lg border border-border/70 bg-card/75 shadow-sm">
                    <header className="flex min-h-14 items-center justify-between gap-3 border-b border-border/60 bg-background/45 px-4 py-3">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-black">Stage {index + 1}</p>
                            <p className="text-xs font-semibold text-muted-foreground">{row.stage.name || 'Unnamed stage'}</p>
                            {rowErrors[index] && <p className="text-xs font-semibold text-danger">{rowErrors[index]}</p>}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                            <Button type="button" size="icon" variant="ghost" icon={ArrowUp} disabled={index === 0} title="Move cycle up" aria-label="Move cycle up" onClick={() => move(index, -1)} />
                            <Button type="button" size="icon" variant="ghost" icon={ArrowDown} disabled={index === value.length - 1} title="Move cycle down" aria-label="Move cycle down" onClick={() => move(index, 1)} />
                            <Button type="button" size="icon" variant="ghost" icon={Trash2} title="Remove cycle" aria-label="Remove cycle" onClick={() => onChange(value.filter((_, rowIndex) => rowIndex !== index))} />
                        </div>
                    </header>

                    <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Source</Label>
                            <CustomSelect
                                value={row.kind}
                                onChange={(kind) => update(index, {
                                    ...emptyCycle(index),
                                    kind,
                                    ...(kind === 'NEW' ? { name: '', code: '', startDate: '', endDate: '' } : {}),
                                })}
                                options={[
                                    { value: 'EXISTING', label: 'Use existing' },
                                    ...(canCreateCycles ? [{ value: 'NEW' as const, label: 'Create new institute cycle' }] : []),
                                ]}
                            />
                        </div>

                        {row.kind === 'EXISTING' ? (
                            <div className="space-y-2">
                                <Label>Institute cycle</Label>
                                <CustomSelect
                                    value={row.academicCycleId || ''}
                                    onChange={(academicCycleId) => update(index, { ...row, academicCycleId })}
                                    searchable
                                    options={eligibleCycles
                                        .filter((cycle) => !value.some((selected, selectedIndex) => selectedIndex !== index && selected.kind === 'EXISTING' && selected.academicCycleId === cycle.id))
                                        .map((cycle) => ({ value: cycle.id, label: `${cycle.code} - ${cycle.name} (${cycle.programUseCount} programs)` }))}
                                    placeholder="Select cycle"
                                />
                            </div>
                        ) : (
                            <>
                                <div className="space-y-2"><Label>Cycle name</Label><Input value={row.name || ''} onChange={(event) => update(index, { ...row, name: event.target.value })} /></div>
                                <div className="space-y-2"><Label>Cycle code</Label><Input value={row.code || ''} onChange={(event) => update(index, { ...row, code: event.target.value })} /></div>
                                <div className="space-y-2"><Label>Start date</Label><Input type="date" value={row.startDate || ''} onChange={(event) => update(index, { ...row, startDate: event.target.value })} /></div>
                                <div className="space-y-2"><Label>End date</Label><Input type="date" value={row.endDate || ''} onChange={(event) => update(index, { ...row, endDate: event.target.value })} /></div>
                            </>
                        )}

                        <div className="space-y-2"><Label>Stage name</Label><Input value={row.stage.name} onChange={(event) => update(index, { ...row, stage: { ...row.stage, name: event.target.value } })} /></div>
                        <div className="space-y-2"><Label>Stage code</Label><Input value={row.stage.code} onChange={(event) => update(index, { ...row, stage: { ...row.stage, code: event.target.value } })} /></div>
                    </div>

                    <div className="border-t border-border/60 bg-background/25 p-4 sm:p-5">
                        <div className="mb-2 flex min-h-10 items-center justify-between gap-3">
                            <div>
                                <Label>Course requirements</Label>
                                <p className="mt-1 text-xs font-medium text-muted-foreground">Courses are drawn from the program&apos;s department.</p>
                            </div>
                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                icon={Plus}
                                title="Add course requirement"
                                aria-label="Add course requirement"
                                onClick={() => update(index, {
                                    ...row,
                                    stage: {
                                        ...row.stage,
                                        courseRequirements: [...row.stage.courseRequirements, { courseId: '', requirementType: CourseRequirementType.REQUIRED }],
                                    },
                                })}
                            />
                        </div>
                        <div className="space-y-2">
                            {row.stage.courseRequirements.length === 0 && (
                                <p className="rounded-md border border-dashed border-border/70 px-3 py-4 text-center text-xs font-medium text-muted-foreground">No course requirements added to this stage.</p>
                            )}
                            {row.stage.courseRequirements.map((requirement, requirementIndex) => (
                                <div key={requirementIndex} className="grid min-h-11 gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_2.5rem]">
                                    <CustomSelect
                                        value={requirement.courseId}
                                        onChange={(courseId) => {
                                            const requirements = [...row.stage.courseRequirements];
                                            requirements[requirementIndex] = { ...requirement, courseId };
                                            update(index, { ...row, stage: { ...row.stage, courseRequirements: requirements } });
                                        }}
                                        searchable
                                        options={courses
                                            .filter((course) => !row.stage.courseRequirements.some((selected, selectedIndex) => selectedIndex !== requirementIndex && selected.courseId === course.id))
                                            .map((course) => ({ value: course.id, label: `${course.code} - ${course.name}` }))}
                                        placeholder="Select course"
                                    />
                                    <CustomSelect
                                        value={requirement.requirementType}
                                        onChange={(requirementType) => {
                                            const requirements = [...row.stage.courseRequirements];
                                            requirements[requirementIndex] = { ...requirement, requirementType };
                                            update(index, { ...row, stage: { ...row.stage, courseRequirements: requirements } });
                                        }}
                                        options={Object.values(CourseRequirementType).map((type) => ({ value: type, label: type.replace('_', ' ') }))}
                                    />
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        icon={Trash2}
                                        title="Remove requirement"
                                        aria-label="Remove requirement"
                                        onClick={() => update(index, {
                                            ...row,
                                            stage: { ...row.stage, courseRequirements: row.stage.courseRequirements.filter((_, itemIndex) => itemIndex !== requirementIndex) },
                                        })}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            ))}
        </div>
    );
}
