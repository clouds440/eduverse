'use client';

import { ArrowDown, ArrowUp, Layers, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Toggle } from '@/components/ui/Toggle';
import { Course, CourseRequirementType, ProgramStageInput } from '@/types';

interface ProgramStageArrayEditorProps {
    value: ProgramStageInput[];
    onChange: (value: ProgramStageInput[]) => void;
    courses: Course[];
    rowErrors?: Record<number, string>;
}

function emptyStage(index: number): ProgramStageInput {
    return {
        name: `Stage ${index + 1}`,
        code: `STAGE-${index + 1}`,
        isOptional: false,
        courseRequirements: [],
    };
}

export function ProgramStageArrayEditor({ value, onChange, courses, rowErrors = {} }: ProgramStageArrayEditorProps) {
    const update = (index: number, stage: ProgramStageInput) => {
        const next = [...value];
        next[index] = stage;
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
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">{value.length === 0 ? 'No stages added' : `${value.length} ${value.length === 1 ? 'stage' : 'stages'} in this curriculum`}</p>
                </div>
                <Button type="button" size="icon" variant="secondary" icon={Plus} title="Add stage" aria-label="Add stage" onClick={() => onChange([...value, emptyStage(value.length)])} />
            </div>

            {value.length === 0 && (
                <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/45 px-5 py-8 text-center">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md border border-border/70 bg-background text-primary"><Layers className="h-5 w-5" aria-hidden="true" /></div>
                    <p className="text-sm font-black text-foreground">Add the first program stage</p>
                    <p className="mt-1 max-w-md text-xs font-medium leading-relaxed text-muted-foreground">Stages are permanent curriculum steps. Institute academic cycles are attached later when the program is offered.</p>
                    <Button type="button" variant="secondary" icon={Plus} className="mt-4" onClick={() => onChange([emptyStage(0)])}>Add first stage</Button>
                </div>
            )}

            {value.map((stage, index) => (
                <section key={`${stage.code}-${index}`} className="overflow-hidden rounded-lg border border-border/70 bg-card/75 shadow-sm">
                    <header className="flex min-h-14 items-center justify-between gap-3 border-b border-border/60 bg-background/45 px-4 py-3">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-black">Stage {index + 1}</p>
                            <p className="truncate text-xs font-semibold text-muted-foreground">{stage.name || 'Unnamed stage'}</p>
                            {rowErrors[index] && <p className="text-xs font-semibold text-danger">{rowErrors[index]}</p>}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                            <Button type="button" size="icon" variant="ghost" icon={ArrowUp} disabled={index === 0} title="Move stage up" aria-label="Move stage up" onClick={() => move(index, -1)} />
                            <Button type="button" size="icon" variant="ghost" icon={ArrowDown} disabled={index === value.length - 1} title="Move stage down" aria-label="Move stage down" onClick={() => move(index, 1)} />
                            <Button type="button" size="icon" variant="ghost" icon={Trash2} title="Remove stage" aria-label="Remove stage" onClick={() => onChange(value.filter((_, rowIndex) => rowIndex !== index))} />
                        </div>
                    </header>

                    <div className="grid gap-5 p-4 sm:p-5 md:grid-cols-2">
                        <div className="space-y-2"><Label>Stage name</Label><Input value={stage.name} onChange={(event) => update(index, { ...stage, name: event.target.value })} placeholder="e.g. Foundation" /></div>
                        <div className="space-y-2"><Label>Stage code</Label><Input value={stage.code} onChange={(event) => update(index, { ...stage, code: event.target.value })} placeholder="e.g. FOUNDATION" /></div>
                        <div className="space-y-2"><Label>Stage type</Label><Input value={stage.stageType || ''} onChange={(event) => update(index, { ...stage, stageType: event.target.value || undefined })} placeholder="Optional label, e.g. Semester" /></div>
                        <div className="flex items-end pb-2"><Toggle checked={Boolean(stage.isOptional)} onCheckedChange={(isOptional) => update(index, { ...stage, isOptional })} label="Optional stage" /></div>
                    </div>

                    <div className="border-t border-border/60 bg-background/25 p-4 sm:p-5">
                        <div className="mb-2 flex min-h-10 items-center justify-between gap-3">
                            <div><Label>Course requirements</Label><p className="mt-1 text-xs font-medium text-muted-foreground">Courses may come from any department in the organization.</p></div>
                            <Button type="button" size="icon" variant="ghost" icon={Plus} title="Add course requirement" aria-label="Add course requirement" onClick={() => update(index, { ...stage, courseRequirements: [...stage.courseRequirements, { courseId: '', requirementType: CourseRequirementType.REQUIRED }] })} />
                        </div>
                        <div className="space-y-2">
                            {stage.courseRequirements.length === 0 && <p className="rounded-md border border-dashed border-border/70 px-3 py-4 text-center text-xs font-medium text-muted-foreground">No course requirements added to this stage.</p>}
                            {stage.courseRequirements.map((requirement, requirementIndex) => (
                                <div key={requirementIndex} className="grid min-h-11 gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_2.5rem]">
                                    <CustomSelect value={requirement.courseId} onChange={(courseId) => { const requirements = [...stage.courseRequirements]; requirements[requirementIndex] = { ...requirement, courseId }; update(index, { ...stage, courseRequirements: requirements }); }} searchable options={courses.filter((course) => !stage.courseRequirements.some((selected, selectedIndex) => selectedIndex !== requirementIndex && selected.courseId === course.id)).map((course) => ({ value: course.id, label: `${course.code} - ${course.name}` }))} placeholder="Select course" />
                                    <CustomSelect value={requirement.requirementType} onChange={(requirementType) => { const requirements = [...stage.courseRequirements]; requirements[requirementIndex] = { ...requirement, requirementType }; update(index, { ...stage, courseRequirements: requirements }); }} options={Object.values(CourseRequirementType).map((type) => ({ value: type, label: type.replaceAll('_', ' ') }))} />
                                    <Button type="button" size="icon" variant="ghost" icon={Trash2} title="Remove requirement" aria-label="Remove requirement" onClick={() => update(index, { ...stage, courseRequirements: stage.courseRequirements.filter((_, itemIndex) => itemIndex !== requirementIndex) })} />
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            ))}
        </div>
    );
}
