import { createPdfBuilder } from './core';
import { getCourseSectionLabelParts, getSectionColor } from '@/lib/utils';

interface TranscriptStudent {
    id: string;
    name: string | null;
    email: string;
    avatarUrl?: string | null;
    avatarUpdatedAt?: string | null;
    registrationNumber?: string | null;
    rollNumber?: string | null;
    currentCohort?: { id: string; name: string } | null;
}

interface TranscriptAssessmentGrade {
    assessmentTitle: string;
    assessmentType: string;
    marksObtained: number;
    totalMarks: number;
    weightage: number;
    percentage: number;
}

interface TranscriptCycleSection {
    sectionId: string;
    sectionName: string;
    sectionColor?: string | null;
    courseName: string;
    enrollmentType: string;
    wasExcluded: boolean;
    grades?: TranscriptAssessmentGrade[];
    totalPercentage: number;
}

interface TranscriptCycle {
    academicCycle: { id: string; name: string; startDate?: string; endDate?: string } | null;
    cohortName: string | null;
    sections?: TranscriptCycleSection[];
    overallPercentage: number;
}

export interface TranscriptPdfInput {
    orgName: string;
    logoUrl?: string | null;
    studentPhotoUrl?: string | null;
    student: TranscriptStudent;
    cycles: TranscriptCycle[];
    cumulativeAverage: number;
    theme?: 'light' | 'dark';
}

const PASS_MARK = 50;
const TRANSCRIPT_PAGE_SIZE = { width: 792, height: 1120 };

function getTranscriptPalette(theme: 'light' | 'dark' = 'light') {
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
            sectionTarget: '#0B0F19',
            cycle: '#172554',
        };
    }

    return {
        page: '#FFFFFF',
        surface: '#FFFFFF',
        softSurface: '#F9FAFB',
        mutedSurface: '#F8FAFC',
        text: '#111827',
        muted: '#6B7280',
        border: '#D1D5DB',
        softBorder: '#E5E7EB',
        sectionTarget: '#FFFFFF',
        cycle: '#EEF2FF',
    };
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

function truncateToWidth(text: string, maxWidth: number, measure: (value: string) => number) {
    if (measure(text) <= maxWidth) return text;
    const suffix = '...';
    let next = text;
    while (next.length > 0 && measure(`${next}${suffix}`) > maxWidth) {
        next = next.slice(0, -1);
    }
    return next ? `${next}${suffix}` : suffix;
}

function roundScore(value: number) {
    return Math.round(value * 100) / 100;
}

function formatDate(value?: string) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getCyclePeriodLabel(cycle: TranscriptCycle) {
    const name = cycle.academicCycle?.name || 'Unassigned Cycle';
    const start = formatDate(cycle.academicCycle?.startDate);
    const end = formatDate(cycle.academicCycle?.endDate);
    if (!start && !end) return name;
    return `${name} (${start || 'Start TBD'} - ${end || 'End TBD'})`;
}

function getLetterGrade(score: number) {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
}

function getAcademicStatus(section: TranscriptCycleSection, assessmentCount: number, weightedScore: number) {
    if (section.wasExcluded) return 'Excluded';
    if (assessmentCount === 0) return 'No grades';
    return weightedScore >= PASS_MARK ? 'Pass' : 'Fail';
}

function getSectionMetrics(section: TranscriptCycleSection) {
    const grades = section.grades || [];
    const marksObtained = roundScore(grades.reduce((sum, grade) => sum + Number(grade.marksObtained || 0), 0));
    const totalMarks = roundScore(grades.reduce((sum, grade) => sum + Number(grade.totalMarks || 0), 0));
    const totalWeight = roundScore(grades.reduce((sum, grade) => sum + Number(grade.weightage || 0), 0));
    const rawPercentage = totalMarks > 0 ? roundScore((marksObtained / totalMarks) * 100) : 0;
    const weightedScore = roundScore(section.totalPercentage || 0);
    const status = getAcademicStatus(section, grades.length, weightedScore);
    const grade = section.wasExcluded || grades.length === 0 ? 'N/A' : getLetterGrade(weightedScore);

    return {
        assessmentCount: grades.length,
        marksObtained,
        totalMarks,
        totalWeight,
        rawPercentage,
        weightedScore,
        grade,
        status,
    };
}

export async function createTranscriptPdf({
    orgName,
    logoUrl,
    studentPhotoUrl,
    student,
    cycles,
    cumulativeAverage,
    theme = 'light',
}: TranscriptPdfInput) {
    const pdf = await createPdfBuilder({
        page: TRANSCRIPT_PAGE_SIZE,
        margin: 48,
        title: `${student.name || 'Student'} Transcript`,
        author: orgName,
    });
    const palette = getTranscriptPalette(theme);
    const usableWidth = pdf.width - pdf.margin * 2;
    const table = {
        x: pdf.margin,
        width: usableWidth,
        courseX: pdf.margin + 12,
        marksX: pdf.margin + 194,
        rawX: pdf.margin + 294,
        weightX: pdf.margin + 366,
        scoreX: pdf.margin + 444,
        gradeX: pdf.margin + 542,
        statusX: pdf.margin + 598,
        courseWidth: 160,
        marksWidth: 80,
        rawWidth: 50,
        weightWidth: 55,
        scoreWidth: 70,
        gradeWidth: 35,
        statusWidth: 80,
    };
    let y = pdf.cursorY;

    const drawCell = (
        text: string,
        x: number,
        width: number,
        textY: number,
        options: { size?: number; font?: 'regular' | 'bold'; color?: string } = {},
    ) => {
        const size = options.size ?? 9;
        const font = options.font ?? 'regular';
        const value = truncateToWidth(text, width, (candidate) => pdf.font(font).widthOfTextAtSize(candidate, size));
        pdf.text(value, x, textY, { size, font, color: options.color });
    };

    const drawHeader = async (fullHeader: boolean) => {
        pdf.rect({ x: 0, y: 0, width: pdf.width, height: pdf.height, fill: palette.page });
        const didDrawLogo = logoUrl ? await pdf.imageFromUrl(logoUrl, pdf.margin, y - 38, 38, 38, { rounded: true }) : false;
        if (!didDrawLogo) {
            pdf.text(orgName.slice(0, 1).toUpperCase(), pdf.margin + 12, y - 25, { size: 16, font: 'bold', color: '#2952BF' });
        }
        pdf.text(orgName, pdf.margin + 50, y - 12, { size: 16, font: 'bold', color: palette.text, maxWidth: 430 });
        pdf.text('Official Academic Transcript', pdf.margin + 50, y - 29, { size: 11, color: palette.muted });
        pdf.text(new Date().toLocaleDateString(), pdf.width - pdf.margin - 82, y - 16, { size: 9, color: palette.muted });
        y -= fullHeader ? 62 : 52;
        pdf.cursorY = y;
    };

    const ensureSpace = async (height: number) => {
        if (!pdf.ensureSpace(height)) return;
        y = pdf.cursorY;
        await drawHeader(false);
    };

    await drawHeader(true);

    pdf.rect({ x: pdf.margin, y: y - 74, width: usableWidth, height: 74, fill: palette.softSurface, stroke: palette.softBorder, borderWidth: 0.6 });
    const photoX = pdf.margin + 16;
    const photoY = y - 60;
    const didDrawStudentPhoto = studentPhotoUrl
        ? await pdf.imageFromUrl(studentPhotoUrl, photoX, photoY, 44, 44, { rounded: true })
        : false;
    if (!didDrawStudentPhoto) {
        pdf.text((student.name || 'S').slice(0, 1).toUpperCase(), photoX + 15, photoY + 17, { size: 15, font: 'bold', color: '#2952BF' });
    }
    const studentTextX = pdf.margin + 72;
    pdf.text('Student', studentTextX, y - 20, { size: 8, font: 'bold', color: palette.muted });
    pdf.text(student.name || 'Unnamed Student', studentTextX, y - 40, { size: 14, font: 'bold', color: palette.text, maxWidth: 195 });
    pdf.text(student.email || 'No email recorded', studentTextX, y - 58, { size: 9, color: palette.muted, maxWidth: 195 });
    pdf.text('Batch', pdf.margin + 320, y - 20, { size: 8, font: 'bold', color: palette.muted });
    pdf.text(student.currentCohort?.name || 'Independent', pdf.margin + 320, y - 40, { size: 11, color: palette.text, maxWidth: 155 });
    pdf.text('Registration', pdf.margin + 500, y - 20, { size: 8, font: 'bold', color: palette.muted });
    pdf.text(student.registrationNumber || student.rollNumber || 'N/A', pdf.margin + 500, y - 40, { size: 11, color: palette.text, maxWidth: 105 });
    pdf.text('Overall Average', pdf.margin + 620, y - 20, { size: 8, font: 'bold', color: palette.muted });
    pdf.text(`${cumulativeAverage}%`, pdf.margin + 620, y - 42, { size: 15, font: 'bold', color: palette.text, maxWidth: 70 });
    y -= 92;
    pdf.cursorY = y;

    if (cycles.length === 0) {
        pdf.text('No academic records found for the selected period.', pdf.margin, y, { size: 12, font: 'bold', color: palette.text });
    }

    for (const cycle of cycles) {
        const sections = cycle.sections || [];
        await ensureSpace(78);
        pdf.rect({ x: pdf.margin, y: y - 34, width: usableWidth, height: 34, fill: palette.cycle, stroke: palette.softBorder, borderWidth: 0.5 });
        pdf.text(getCyclePeriodLabel(cycle), pdf.margin + 12, y - 21, { size: 11, font: 'bold', color: palette.text, maxWidth: 460 });
        pdf.text(`${cycle.cohortName || 'No batch'} | ${cycle.overallPercentage || 0}% average`, pdf.width - pdf.margin - 218, y - 21, { size: 9, color: palette.muted, maxWidth: 205 });
        y -= 42;

        pdf.rect({ x: table.x, y: y - 22, width: table.width, height: 28, fill: palette.mutedSurface, stroke: palette.softBorder, borderWidth: 0.6 });
        drawCell('Course / Section', table.courseX, table.courseWidth, y - 10, { size: 8, font: 'bold', color: palette.muted });
        drawCell('Marks', table.marksX, table.marksWidth, y - 10, { size: 8, font: 'bold', color: palette.muted });
        drawCell('Raw %', table.rawX, table.rawWidth, y - 10, { size: 8, font: 'bold', color: palette.muted });
        drawCell('Weight', table.weightX, table.weightWidth, y - 10, { size: 8, font: 'bold', color: palette.muted });
        drawCell('W.Score', table.scoreX, table.scoreWidth, y - 10, { size: 8, font: 'bold', color: palette.muted });
        drawCell('Grade', table.gradeX, table.gradeWidth, y - 10, { size: 8, font: 'bold', color: palette.muted });
        drawCell('Status', table.statusX, table.statusWidth, y - 10, { size: 8, font: 'bold', color: palette.muted });
        y -= 36;
        pdf.cursorY = y;

        if (sections.length === 0) {
            await ensureSpace(24);
            pdf.text('No academic records found for this cycle.', pdf.margin, y, { size: 10, color: palette.muted });
            y -= 28;
            pdf.cursorY = y;
        }

        for (const section of sections) {
            const labelParts = getCourseSectionLabelParts({ courseName: section.courseName, sectionName: section.sectionName });
            const metrics = getSectionMetrics(section);
            const sectionColor = getSectionColor(section.sectionColor);
            const rowHeight = 48;
            await ensureSpace(rowHeight + 10);

            pdf.rect({
                x: table.x,
                y: y - rowHeight + 8,
                width: table.width,
                height: rowHeight,
                fill: mixHex(sectionColor, palette.sectionTarget, 0.9),
                stroke: mixHex(sectionColor, palette.sectionTarget, 0.36),
                borderWidth: 0.7,
            });
            pdf.rect({ x: table.x, y: y - rowHeight + 8, width: 4, height: rowHeight, fill: sectionColor });
            drawCell(labelParts.courseName || labelParts.inlineLabel, table.courseX, table.courseWidth, y - 9, { size: 9, font: 'bold', color: sectionColor });
            if (labelParts.sectionName) {
                drawCell(labelParts.sectionName, table.courseX, table.courseWidth, y - 21, { size: 7, color: mixHex(sectionColor, palette.text, 0.35) });
            }
            drawCell(`${metrics.marksObtained}/${metrics.totalMarks}`, table.marksX, table.marksWidth, y - 10, { size: 9, color: palette.text });
            drawCell(`${metrics.rawPercentage}%`, table.rawX, table.rawWidth, y - 10, { size: 9, color: palette.text });
            drawCell(`${metrics.totalWeight}%`, table.weightX, table.weightWidth, y - 10, { size: 9, color: palette.text });
            drawCell(`${metrics.weightedScore}%`, table.scoreX, table.scoreWidth, y - 10, { size: 9, font: 'bold', color: sectionColor });
            drawCell(metrics.grade, table.gradeX, table.gradeWidth, y - 10, { size: 9, font: 'bold', color: palette.text });
            drawCell(metrics.status, table.statusX, table.statusWidth, y - 10, { size: 9, color: palette.text });
            y -= rowHeight + 6;
            pdf.cursorY = y;
        }

        y -= 14;
        pdf.cursorY = y;
    }

    await ensureSpace(44);
    pdf.rect({ x: pdf.width - pdf.margin - 220, y: y - 38, width: 220, height: 38, fill: palette.softSurface, stroke: palette.softBorder, borderWidth: 0.6 });
    pdf.text(`Overall Average: ${cumulativeAverage}%`, pdf.width - pdf.margin - 205, y - 17, { size: 11, font: 'bold', color: palette.text });
    pdf.text(`Pass mark: ${PASS_MARK}% | A+ 90, A 80, B 70, C 60, D 50`, pdf.margin, y - 17, { size: 8, color: palette.muted });

    return pdf.saveAsBlob();
}
