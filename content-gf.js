// ==UserScript==
// @name         ECNU-GPA-Plugin
// @namespace    http://tampermonkey.net/
// @version      0.1.0
// @description  按学期、学年和总计显示均绩、专绩及学分加权均分
// @author       ECNUer
// @match        *://byyt.ecnu.edu.cn/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
    'use strict';
    const owned = '[data-ecnu-gpa]';
    const text = node => (node?.innerText || node?.textContent || '').trim();
    const normalized = value => value.replace(/\s+/g, '');
    const empty = () => ({ credits: 0, points: 0, count: 0, scoreCredits: 0, scorePoints: 0, scoreCount: 0 });
    const add = (stats, credit, gpa) => { stats.credits += credit; stats.points += credit * gpa; stats.count++; };
    const merge = (a, b) => { for (const key of Object.keys(a)) a[key] += b[key]; };
    const addScore = (stats, credit, score) => { stats.scoreCredits += credit; stats.scorePoints += credit * score; stats.scoreCount++; };
    const average = stats => stats.scoreCredits > 0 ? (stats.scorePoints / stats.scoreCredits).toFixed(2) : '—';
    const number = value => /^\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value) : NaN;
    const gpa = stats => stats.credits > 0 ? (stats.points / stats.credits).toFixed(2) : '—';

    function periodOf(table) {
        const parse = value => {
            const match = value.match(/(20\d{2})\s*[-—–~～至/]\s*(20\d{2})\s*学年(?:\s*第?\s*([一二三123秋春夏])\s*(?:学期|季))?/);
            const season = value.match(/(20\d{2})\s*年?\s*([春秋夏])(?:季|学期)?/);
            if (season) {
                const start = Number(season[1]) - (season[2] === '秋' ? 0 : 1);
                return { year: `${start}-${start + 1}学年`, label: `${season[1]}${season[2]}` };
            }
            if (!match || Number(match[2]) !== Number(match[1]) + 1) return null;
            return { year: `${match[1]}-${match[2]}学年`, label: match[0] };
        };
        // Look only at nearby headings; never borrow a different semester's table.
        let node = table;
        for (let depth = 0; node && depth < 5; depth++, node = node.parentElement) {
            let prev = node.previousElementSibling;
            for (let i = 0; prev && i < 4; i++, prev = prev.previousElementSibling) {
                if (prev.matches(owned)) continue;
                if (prev.matches('table') || prev.querySelector('table')) break;
                const found = parse(text(prev));
                if (found) return found;
            }
            const caption = node === table ? table.caption : null;
            const found = caption && parse(text(caption));
            if (found) return found;
        }
        return { year: null, label: '本学期（学年未识别）' };
    }

    function calculate(table) {
        const rows = [...table.rows].filter(row => row.closest('table') === table);
        let columns;
        let header;
        for (const row of rows) {
            const labels = [...row.cells].map(cell => normalized(text(cell)));
            const credit = labels.findIndex(label => /^(课程)?学分$/.test(label));
            const point = labels.findIndex(label => /^(课程|成绩)?绩点$|^GPA$/i.test(label));
            if (credit >= 0 && point >= 0) {
                columns = { credit, point, score: labels.findIndex(label => /^(成绩|总评成绩|课程成绩)$/.test(label)), name: labels.findIndex(label => /^(课程名称|课程)$/.test(label)), category: labels.findIndex(label => /^(课程类别|课程分类|课程类型|类别)$/.test(label)) };
                header = row;
                break;
            }
        }
        if (!columns) return null;
        const result = { all: empty(), major: empty(), unknown: 0, period: periodOf(table), table };
        for (const row of rows) {
            if (row === header || row.querySelector('table')) continue;
            const cells = [...row.cells];
            if (cells.some(cell => cell.colSpan > 1)) continue;
            const credit = number(text(cells[columns.credit]));
            const point = number(text(cells[columns.point]));
            if (!Number.isFinite(credit) || credit <= 0) continue;
            const score = number(text(cells[columns.score]));
            const hasPoint = Number.isFinite(point);
            const hasScore = Number.isFinite(score) && score <= 100;
            if (!hasPoint && !hasScore) continue;
            if (hasPoint) add(result.all, credit, point);
            if (hasScore) addScore(result.all, credit, score);
            const courseText = text(cells[columns.name]);
            const inlineCategory = courseText.match(/[A-Za-z]+[\dA-Za-z._-]*\s*[|｜]\s*([^|｜\n\r]+)/)?.[1] || '';
            const category = normalized(columns.category >= 0 ? text(cells[columns.category]) : inlineCategory);
            if (!category) result.unknown++;
            else if (/专业|学科基础课/.test(category)) {
                if (hasPoint) add(result.major, credit, point);
                if (hasScore) addScore(result.major, credit, score);
            }
        }
        return result.all.count || result.all.scoreCount ? result : null;
    }

    function banner(title, result, total = false) {
        const node = document.createElement('section');
        node.dataset.ecnuGpa = 'true';
        node.style.cssText = `display:flex;align-items:center;gap:18px;white-space:nowrap;overflow-x:auto;padding:6px 10px;margin:6px 0;border:1px solid #dce5ef;border-left:3px solid #1d78ff;border-radius:3px;background:${total ? '#eaf2ff' : '#f7faff'};color:#26364a;font:12px/1.6 Arial,"Microsoft YaHei",sans-serif;`;
        node.title = '绩点和均分分别按有效学分加权；门数、学分按绩点口径展示。无数字成绩的课程不计均分，不从等级反推，重修按页面记录计入。';
        const heading = document.createElement('strong');
        heading.textContent = title;
        heading.style.cssText = 'font-size:12px;width:130px;flex-shrink:0';
        node.appendChild(heading);
        const group = (stats, professional = false) => {
            const groupNode = document.createElement('span');
            groupNode.style.cssText = 'display:grid;grid-template-columns:80px 112px 60px 88px;align-items:center;flex-shrink:0;font-variant-numeric:tabular-nums';
            const missing = professional && result.unknown;
            const fields = [
                [professional ? '专绩' : '均绩', missing ? '—' : gpa(stats), ''],
                [professional ? '专业均分' : '课程均分', missing ? '—' : average(stats), ''],
                ['', String(stats.count), '门'],
                ['', String(Number(stats.credits.toFixed(3))), '学分']
            ];
            fields.forEach(([label, value, unit], index) => {
                const field = document.createElement('span');
                field.style.cssText = 'display:flex;align-items:baseline;gap:4px;padding:0 7px;' + (index ? 'border-left:1px solid #ccd7e5;' : '');
                if (label) {
                    const labelNode = document.createElement('span');
                    labelNode.textContent = label;
                    field.appendChild(labelNode);
                }
                const digit = document.createElement('span');
                digit.textContent = value;
                digit.style.cssText = 'margin-left:auto;text-align:right;font-variant-numeric:tabular-nums';
                field.appendChild(digit);
                if (unit) {
                    const unitNode = document.createElement('span');
                    unitNode.textContent = unit;
                    field.appendChild(unitNode);
                }
                groupNode.appendChild(field);
            });
            return groupNode;
        };
        const detail = group(result.all);
        detail.title = `均分计入 ${result.all.scoreCount} 门、${Number(result.all.scoreCredits.toFixed(3))} 学分`;
        node.appendChild(detail);
        const major = group(result.major, true);
        major.style.marginLeft = 'auto';
        major.title = `专业均分计入 ${result.major.scoreCount} 门、${Number(result.major.scoreCredits.toFixed(3))} 学分`;
        if (result.unknown) major.title = `${result.unknown} 门课程的类别未识别，暂无法完整计算专绩。`;
        node.appendChild(major);
        return node;
    }

    let signature = '';
    function run() {
        if (!document.title.includes('我的成绩') && !/grade/i.test(location.href)) return;
        const results = [...document.querySelectorAll('table')].filter(table => !table.closest(owned)).map(calculate).filter(Boolean);
        const next = JSON.stringify(results.map(({ all, major, unknown, period }) => ({ all, major, unknown, period })));
        if (next === signature && document.querySelector(owned)) return;
        signature = next;
        document.querySelectorAll(`${owned}, .ecnu-gpa-banner, #ecnu-total-gpa-banner`).forEach(node => node.remove());
        if (!results.length) return;
        const total = { all: empty(), major: empty(), unknown: 0 };
        const years = new Map();
        for (const result of results) {
            merge(total.all, result.all);
            merge(total.major, result.major);
            total.unknown += result.unknown;
            if (result.period.year) {
                if (!years.has(result.period.year)) years.set(result.period.year, { all: empty(), major: empty(), unknown: 0 });
                const year = years.get(result.period.year);
                merge(year.all, result.all);
                merge(year.major, result.major);
                year.unknown += result.unknown;
            }
        }
        const summary = document.createElement('div');
        summary.dataset.ecnuGpa = 'true';
        summary.appendChild(banner('总计', total, true));
        for (const [year, result] of [...years].sort(([a], [b]) => a.localeCompare(b))) summary.appendChild(banner(year, result));
        if (results.some(result => !result.period.year)) {
            const warning = document.createElement('div');
            warning.textContent = '部分学期的学年未识别：已计入总绩点，未计入学年汇总。';
            summary.appendChild(warning);
        }
        // Place the summary before the first semester's surrounding block when safe.
        let anchor = results[0].table;
        while (anchor.parentElement && !['BODY', 'HTML'].includes(anchor.parentElement.tagName)
            && anchor.parentElement.querySelectorAll('table').length === 1) anchor = anchor.parentElement;
        anchor.before(summary);
        for (const result of results) result.table.before(banner(result.period.label, result));
    }
    run();
    setInterval(run, 2000);
})();
