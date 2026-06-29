import { TimetableEntry } from '@/types';
import { getCourseSectionLabelParts, getSectionColor } from '@/lib/utils';
import { createPdfBuilder } from './core';

export interface TimetablePdfSectionSummary {
    id: string;
    name: string;
    courseName: string;
    color?: string | null;
}

export interface TimetablePdfInput {
    orgName: string;
    logoUrl?: string | null;
    userName: string;
    roleLabel: string;
    cohortName?: string | null;
    sections: TimetablePdfSectionSummary[];
    entries: TimetableEntry[];
    startHour: number;
    endHour: number;
    theme?: 'light' | 'dark';
    generatedAt?: Date;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEKEND_DAYS = new Set([0, 6]);

interface TimetablePdfSlotGroup {
    day: number;
    startTime: string;
    endTime: string;
    entries: TimetableEntry[];
}

function timeToMinutes(time: string) {
    const [hours = '0', minutes = '0'] = time.split(':');
    return Number(hours) * 60 + Number(minutes);
}

function formatHour(hour: number) {
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${displayHour} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function formatDuration(startTime: string, endTime: string) {
    const duration = Math.max(0, timeToMinutes(endTime) - timeToMinutes(startTime));
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    if (hours && minutes) return `${hours}h ${minutes}m`;
    if (hours) return `${hours}h`;
    return `${minutes}m`;
}

function getTeacherLabel(entry: TimetableEntry) {
    return entry.teacherName || 'Teacher TBD';
}

function mixHex(hex: string, target: string, amount: number) {
    const normalize = (value: string) => {
        const safe = value.replace('#', '');
        return /^[0-9a-f]{6}$/i.test(safe) ? safe : '3B82F6';
    };
    const from = Number.parseInt(normalize(hex), 16);
    const to = Number.parseInt(normalize(target), 16);
    const channel = (shift: number) => {
        const a = (from >> shift) & 255;
        const b = (to >> shift) & 255;
        return Math.round(a + (b - a) * amount);
    };
    return `#${[channel(16), channel(8), channel(0)].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function getEntriesByDay(entries: TimetableEntry[]) {
    const grouped = new Map<number, TimetableEntry[]>();
    WEEK_DAYS.forEach((day) => grouped.set(day, []));
    entries.forEach((entry) => grouped.get(entry.day)?.push(entry));
    grouped.forEach((dayEntries) => dayEntries.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)));
    return grouped;
}

function getPrintableDays(entriesByDay: Map<number, TimetableEntry[]>) {
    const days = WEEK_DAYS.filter((day) => !WEEKEND_DAYS.has(day) || (entriesByDay.get(day)?.length || 0) > 0);
    return days.length > 0 ? days : [1, 2, 3, 4, 5];
}

function getSlotGroupsByDay(entriesByDay: Map<number, TimetableEntry[]>) {
    const grouped = new Map<number, TimetablePdfSlotGroup[]>();

    entriesByDay.forEach((dayEntries, day) => {
        const slotMap = new Map<string, TimetablePdfSlotGroup>();
        dayEntries.forEach((entry) => {
            const key = `${entry.startTime}-${entry.endTime}`;
            const group = slotMap.get(key);
            if (group) {
                group.entries.push(entry);
            } else {
                slotMap.set(key, {
                    day,
                    startTime: entry.startTime,
                    endTime: entry.endTime,
                    entries: [entry],
                });
            }
        });
        grouped.set(day, Array.from(slotMap.values()).sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)));
    });

    return grouped;
}

function getBreaksByDay(entries: TimetableEntry[]) {
    const grouped = new Map<number, { startTime: string; endTime: string }[]>();
    const entriesByDay = getEntriesByDay(entries);

    WEEK_DAYS.forEach((day) => {
        const slotMap = new Map<string, { startTime: string; endTime: string }>();
        entriesByDay.get(day)?.forEach((entry) => {
            const key = `${entry.startTime}-${entry.endTime}`;
            if (!slotMap.has(key)) slotMap.set(key, { startTime: entry.startTime, endTime: entry.endTime });
        });
        const slots = Array.from(slotMap.values()).sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
        const breaks: { startTime: string; endTime: string }[] = [];

        for (let index = 0; index < slots.length - 1; index += 1) {
            const currentEnd = timeToMinutes(slots[index].endTime);
            const nextStart = timeToMinutes(slots[index + 1].startTime);
            if (nextStart > currentEnd) breaks.push({ startTime: slots[index].endTime, endTime: slots[index + 1].startTime });
        }

        grouped.set(day, breaks);
    });

    return grouped;
}

function getUniqueSections(entries: TimetableEntry[]) {
    const map = new Map<string, TimetablePdfSectionSummary>();
    entries.forEach((entry) => {
        if (map.has(entry.sectionId)) return;
        map.set(entry.sectionId, {
            id: entry.sectionId,
            name: entry.sectionName,
            courseName: entry.courseName,
            color: entry.color,
        });
    });
    return Array.from(map.values());
}

function truncateToWidth(text: string, maxWidth: number, measure: (value: string) => number) {
    if (measure(text) <= maxWidth) return text;
    const suffix = '...';
    let next = text;
    while (next.length > 0 && measure(`${next}${suffix}`) > maxWidth) {
        next = next.slice(0, -1);
    }
    return next ? `${next}${suffix}` : suffix;
}

function drawTimetableEntryCard({
    pdf,
    entry,
    x,
    y,
    width,
    height,
    color,
    palette,
    theme,
}: {
    pdf: Awaited<ReturnType<typeof createPdfBuilder>>;
    entry: TimetableEntry;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    palette: ReturnType<typeof getPdfPalette>;
    theme: 'light' | 'dark';
}) {
    const paddingX = 4;
    const textWidth = Math.max(8, width - paddingX * 2);
    const parts = getCourseSectionLabelParts({ courseName: entry.courseName, sectionName: entry.sectionName });
    const cardFill = mixHex(color, palette.sectionTarget, theme === 'dark' ? 0.72 : 0.84);

    pdf.rect({ x, y, width, height, fill: cardFill, stroke: color, borderWidth: 0.65 });

    if (height < 9) {
        pdf.rect({ x: x + 2, y: y + 2, width: Math.max(3, width - 4), height: Math.max(2, height - 4), fill: color });
        return;
    }

    let cursorY = y + height - 7;
    const bottomY = y + 3;
    const drawLine = (text: string, options: { size: number; font?: 'regular' | 'bold'; color: string; minHeight?: number }) => {
        if (!text || height < (options.minHeight || 0) || cursorY < bottomY + options.size - 1) return false;
        const font = options.font || 'regular';
        const measure = (value: string) => pdf.font(font).widthOfTextAtSize(value, options.size);
        pdf.text(truncateToWidth(text, textWidth, measure), x + paddingX, cursorY, {
            size: options.size,
            font,
            color: options.color,
        });
        cursorY -= options.size + 2;
        return true;
    };

    drawLine(parts.courseName || parts.inlineLabel, { size: 6.5, font: 'bold', color });
    drawLine(parts.sectionName || '', { size: 5.5, font: 'bold', color: mixHex(color, palette.text, 0.25), minHeight: 20 });
    drawLine(`${entry.startTime} - ${entry.endTime} | ${formatDuration(entry.startTime, entry.endTime)}`, { size: 5.5, font: 'bold', color, minHeight: 28 });
    drawLine(`Room: ${entry.room || 'Room TBD'}`, { size: 5.3, color: palette.muted, minHeight: 38 });
    drawLine(`Teacher: ${getTeacherLabel(entry)}`, { size: 5.3, color: palette.muted, minHeight: 48 });
}

function getPdfPalette(theme: 'light' | 'dark' = 'light') {
    if (theme === 'dark') {
        return {
            page: '#0B0F19',
            surface: '#121826',
            softSurface: '#1A2233',
            mutedSurface: '#0F172A',
            text: '#E6EAF2',
            muted: '#94A3B8',
            border: '#334155',
            softBorder: '#1F2937',
            grid: '#1E293B',
            gridSoft: '#172033',
            sectionTarget: '#0B0F19',
        };
    }

    return {
        page: '#FFFFFF',
        surface: '#FFFFFF',
        softSurface: '#F9FAFB',
        mutedSurface: '#F3F4F6',
        text: '#111827',
        muted: '#6B7280',
        border: '#D1D5DB',
        softBorder: '#E5E7EB',
        grid: '#D1D5DB',
        gridSoft: '#EEF2F7',
        sectionTarget: '#FFFFFF',
    };
}

export async function createTimetablePdf({
    orgName,
    logoUrl,
    userName,
    roleLabel,
    cohortName,
    sections,
    entries,
    startHour,
    endHour,
    theme = 'light',
    generatedAt = new Date(),
}: TimetablePdfInput) {
    const pdf = await createPdfBuilder({
        page: 'letterLandscape',
        margin: 28,
        title: `${userName} Timetable`,
        author: orgName,
    });

    const usableWidth = pdf.width - pdf.margin * 2;
    const headerTop = pdf.height - pdf.margin;
    const sectionSummary = sections.length > 0 ? sections : getUniqueSections(entries);
    const roleText = roleLabel ? `${roleLabel} Timetable` : 'Weekly Timetable';
    const palette = getPdfPalette(theme);

    pdf.rect({ x: 0, y: 0, width: pdf.width, height: pdf.height, fill: palette.page });
    const didDrawLogo = logoUrl ? await pdf.imageFromUrl(logoUrl, pdf.margin, headerTop - 44, 44, 44, { rounded: true }) : false;
    if (!didDrawLogo) {
        pdf.text(orgName.slice(0, 1).toUpperCase(), pdf.margin + 13, headerTop - 28, { size: 18, font: 'bold', color: '#2563EB' });
    }
    pdf.text(orgName, pdf.margin + 56, headerTop - 14, { size: 15, font: 'bold', color: palette.text, maxWidth: 320 });
    pdf.text(roleText, pdf.margin + 56, headerTop - 32, { size: 10, color: palette.muted });
    pdf.text(generatedAt.toLocaleDateString(), pdf.width - pdf.margin - 86, headerTop - 14, { size: 9, color: palette.muted });
    pdf.text(`${formatHour(startHour)} - ${formatHour(endHour)}`, pdf.width - pdf.margin - 86, headerTop - 30, { size: 9, font: 'bold', color: palette.text });

    const infoY = headerTop - 66;
    pdf.rect({ x: pdf.margin, y: infoY - 40, width: usableWidth, height: 40, fill: palette.softSurface, stroke: palette.softBorder, borderWidth: 0.5 });
    pdf.text('For', pdf.margin + 12, infoY - 14, { size: 7, font: 'bold', color: palette.muted });
    pdf.text(userName || 'Current User', pdf.margin + 12, infoY - 29, { size: 12, font: 'bold', color: palette.text, maxWidth: 190 });
    pdf.text('Batch', pdf.margin + 230, infoY - 14, { size: 7, font: 'bold', color: palette.muted });
    pdf.text(cohortName || 'Not assigned', pdf.margin + 230, infoY - 29, { size: 10, color: palette.text, maxWidth: 140 });
    pdf.text('Sections', pdf.margin + 400, infoY - 14, { size: 7, font: 'bold', color: palette.muted });
    pdf.text(`${sectionSummary.length} ${sectionSummary.length === 1 ? 'section' : 'sections'} listed`, pdf.margin + 400, infoY - 29, { size: 10, font: 'bold', color: palette.text, maxWidth: 150 });
    pdf.text(`${entries.length} ${entries.length === 1 ? 'slot' : 'slots'}`, pdf.margin + 600, infoY - 29, { size: 10, font: 'bold', color: palette.text, maxWidth: 90 });

    let legendX = pdf.margin;
    let legendY = infoY - 58;
    sectionSummary.slice(0, 10).forEach((section) => {
        const color = getSectionColor(section);
        const parts = getCourseSectionLabelParts({ courseName: section.courseName, sectionName: section.name });
        const measureLabel = (value: string) => pdf.font('bold').widthOfTextAtSize(value, 7);
        const rawWidth = Math.max(measureLabel(parts.courseName || parts.inlineLabel), measureLabel(parts.sectionName || '')) + 24;
        const width = Math.min(170, Math.max(78, rawWidth));
        const visibleCourse = truncateToWidth(parts.courseName || parts.inlineLabel, width - 22, measureLabel);
        const visibleSection = parts.sectionName ? truncateToWidth(parts.sectionName, width - 22, (value) => pdf.font('regular').widthOfTextAtSize(value, 6)) : '';
        if (legendX + width > pdf.width - pdf.margin) {
            legendX = pdf.margin;
            legendY -= 26;
        }
        pdf.rect({ x: legendX, y: legendY - 20, width, height: 22, fill: mixHex(color, palette.sectionTarget, theme === 'dark' ? 0.74 : 0.86), stroke: mixHex(color, palette.sectionTarget, 0.25), borderWidth: 0.6 });
        pdf.rect({ x: legendX + 5, y: legendY - 10, width: 5, height: 5, fill: color });
        pdf.text(visibleCourse, legendX + 14, legendY - 7, { size: 7, font: 'bold', color });
        if (visibleSection) pdf.text(visibleSection, legendX + 14, legendY - 16, { size: 6, color: mixHex(color, palette.text, 0.35) });
        legendX += width + 7;
    });
    if (sectionSummary.length > 10) {
        pdf.text(`+ ${sectionSummary.length - 10} more`, legendX, legendY - 9, { size: 7, font: 'bold', color: palette.muted });
    }

    const gridTop = legendY - 30;
    const gridBottom = pdf.margin;
    const gridHeight = gridTop - gridBottom;
    const timeColumnWidth = 48;
    const headerHeight = 24;
    const bodyTop = gridTop - headerHeight;
    const rowCount = Math.max(1, (endHour - startHour) * 2);
    const rowHeight = (bodyTop - gridBottom) / rowCount;
    const entriesByDay = getEntriesByDay(entries);
    const printableDays = getPrintableDays(entriesByDay);
    const dayIndexByValue = new Map(printableDays.map((day, index) => [day, index]));
    const slotGroupsByDay = getSlotGroupsByDay(entriesByDay);
    const breaksByDay = getBreaksByDay(entries);
    const dayColumnWidth = (usableWidth - timeColumnWidth) / printableDays.length;

    pdf.rect({ x: pdf.margin, y: gridBottom, width: usableWidth, height: gridHeight, fill: palette.surface, stroke: palette.border, borderWidth: 0.6 });
    pdf.rect({ x: pdf.margin, y: bodyTop, width: usableWidth, height: headerHeight, fill: palette.mutedSurface, stroke: palette.border, borderWidth: 0.5 });
    pdf.text('Time', pdf.margin + 12, bodyTop + 9, { size: 7, font: 'bold', color: palette.muted });

    printableDays.forEach((day, index) => {
        const x = pdf.margin + timeColumnWidth + index * dayColumnWidth;
        pdf.line(x, gridBottom, x, gridTop, palette.border, 0.5);
        pdf.text(DAY_NAMES[day], x + 6, bodyTop + 9, { size: 8, font: 'bold', color: palette.text, maxWidth: dayColumnWidth - 12 });
        if ((entriesByDay.get(day)?.length || 0) === 0) {
            pdf.text('Off day', x + 6, bodyTop - 34, { size: 8, font: 'bold', color: palette.muted, maxWidth: dayColumnWidth - 12 });
        }
    });

    for (let index = 0; index < rowCount; index += 1) {
        const y = bodyTop - (index + 1) * rowHeight;
        const isFullHour = index % 2 === 1;
        if (index < rowCount - 1) pdf.line(pdf.margin, y, pdf.width - pdf.margin, y, isFullHour ? palette.grid : palette.gridSoft, isFullHour ? 0.7 : 0.35);
        if (index % 2 === 0) {
            const hour = startHour + index / 2;
            pdf.text(formatHour(hour), pdf.margin + 8, y + rowHeight - 11, { size: 7, font: 'bold', color: palette.muted });
        }
    }

    printableDays.forEach((day, dayIndex) => {
        const dayX = pdf.margin + timeColumnWidth + dayIndex * dayColumnWidth;
        const x = dayX + 4;
        const width = dayColumnWidth - 8;

        breaksByDay.get(day)?.forEach((dayBreak) => {
            const startOffset = Math.max(0, timeToMinutes(dayBreak.startTime) - startHour * 60);
            const duration = Math.max(30, timeToMinutes(dayBreak.endTime) - timeToMinutes(dayBreak.startTime));
            const y = bodyTop - (startOffset / 30) * rowHeight - (duration / 30) * rowHeight + 3;
            const height = Math.max(14, (duration / 30) * rowHeight - 6);

            pdf.rect({ x, y, width, height, fill: palette.mutedSurface, stroke: palette.softBorder, borderWidth: 0.5 });
            pdf.text(`Break ${dayBreak.startTime} - ${dayBreak.endTime}`, x + 5, y + Math.max(7, height / 2 - 2), { size: 6, font: 'bold', color: palette.muted, maxWidth: width - 10 });
        });
    });

    printableDays.forEach((day) => {
        const dayIndex = dayIndexByValue.get(day);
        if (dayIndex === undefined) return;
        const dayX = pdf.margin + timeColumnWidth + dayIndex * dayColumnWidth;
        const x = dayX + 4;
        const width = dayColumnWidth - 8;

        slotGroupsByDay.get(day)?.forEach((slot) => {
            const startOffset = Math.max(0, timeToMinutes(slot.startTime) - startHour * 60);
            const duration = Math.max(30, timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime));
            const slotY = bodyTop - (startOffset / 30) * rowHeight - (duration / 30) * rowHeight + 3;
            const slotHeight = Math.max(8, (duration / 30) * rowHeight - 6);
            const gap = 2;
            const entryCount = Math.max(1, slot.entries.length);
            const cardHeight = Math.max(4, (slotHeight - gap * (entryCount - 1)) / entryCount);

            slot.entries.forEach((entry, entryIndex) => {
                const color = getSectionColor(entry);
                const cardY = slotY + slotHeight - (entryIndex + 1) * cardHeight - entryIndex * gap;
                drawTimetableEntryCard({
                    pdf,
                    entry,
                    x,
                    y: cardY,
                    width,
                    height: cardHeight,
                    color,
                    palette,
                    theme,
                });
            });
        });
    });

    return pdf.saveAsBlob();
}
