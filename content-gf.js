// ==UserScript==
// @name         ECNU-GPA-Plugin
// @namespace    http://tampermonkey.net/
// @version      0.0.2
// @description  Calculate GPA-per-semester and Total GPA
// @author       ECNUer
// @match        *://byyt.ecnu.edu.cn/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const CHECK_INTERVAL = 2000;
    const TARGET_TITLE_KEYWORD = "我的成绩";

    setInterval(() => {
        if (document.title.includes(TARGET_TITLE_KEYWORD) || window.location.href.includes("grade")) {
            calculateAndRender();
        }
    }, CHECK_INTERVAL);

    function getThemeColors() {
        const rootStyles = getComputedStyle(document.documentElement);
        let primaryColor = rootStyles.getPropertyValue('--brand-primary').trim() ||
                           rootStyles.getPropertyValue('--color-primary').trim() ||
                           '#1d78ff';

        const lightBackground = hexToRgba(primaryColor, 0.08);
        const borderColor = hexToRgba(primaryColor, 0.2);

        return {
            primary: primaryColor,
            background: lightBackground,
            border: borderColor
        };
    }

    function hexToRgba(hex, alpha) {
        let c;
        if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
            c = hex.substring(1).split('');
            if(c.length === 3){
                c = [c[0], c[0], c[1], c[1], c[2], c[2]];
            }
            c = '0x' + c.join('');
            return 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+','+alpha+')';
        }
        return hex;
    }

    function calculateAndRender() {
        const tables = document.querySelectorAll('table');
        if (tables.length === 0) return;

        let totalCredits = 0.0;
        let totalQualityPoints = 0.0;

        tables.forEach((table) => {
            const result = calculateTableGPA(table);

            if (result) {
                totalCredits += result.totalCredits;
                totalQualityPoints += result.totalQualityPoints;
                injectGPABanner(table, result);
            }
        });

        if (totalCredits > 0) {
            const totalGPA = (totalQualityPoints / totalCredits).toFixed(2);
            injectTotalBanner(tables[0], {
                gpa: totalGPA,
                totalCredits: totalCredits
            });
        }
    }

    function calculateTableGPA(table) {
        const rows = table.querySelectorAll('tr');

        let totalCredits = 0;
        let totalQualityPoints = 0;
        let validCourses = 0;

        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 3) return;

            const creditText = cells[1].innerText.trim();
            const gpaText = cells[2].innerText.trim();

            const credit = parseFloat(creditText);
            const gpa = parseFloat(gpaText);

            if (!isNaN(credit) && !isNaN(gpa)) {
                totalCredits += credit;
                totalQualityPoints += (credit * gpa);
                validCourses++;
            }
        });

        if (validCourses === 0) return null;

        const finalGPA = (totalQualityPoints / totalCredits).toFixed(2);

        return {
            gpa: finalGPA,
            totalCredits: totalCredits,
            count: validCourses,
            totalQualityPoints: totalQualityPoints
        };
    }

    function injectGPABanner(table, result) {
        if (table.getAttribute('data-gpa-rendered') === 'true') {
             const prev = table.previousElementSibling;
             if (prev && prev.className === 'ecnu-gpa-banner') {
                 return;
             }
        }

        const theme = getThemeColors();
        const banner = document.createElement('div');
        banner.className = 'ecnu-gpa-banner';

        banner.style.cssText = `
            background-color: ${theme.background};
            border: 1px solid ${theme.border};
            border-left: 5px solid ${theme.primary};
            color: #333;
            padding: 12px 20px;
            margin-bottom: 15px;
            border-radius: 4px;
            font-family: "Helvetica Neue", Helvetica, "PingFang SC", "Microsoft YaHei", Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
            margin-top: 10px;
        `;

        banner.innerHTML = generateBannerHTML(result, theme);

        if(table.parentNode) {
            table.parentNode.insertBefore(banner, table);
            table.setAttribute('data-gpa-rendered', 'true');
        }
    }

    function injectTotalBanner(firstTable, result) {
        const theme = getThemeColors();
        const TOTAL_BANNER_ID = 'ecnu-total-gpa-banner';

        let existingBanner = document.getElementById(TOTAL_BANNER_ID);

        let targetBlock = firstTable;

        if (firstTable.parentNode && firstTable.parentNode.parentNode) {
            targetBlock = firstTable.parentNode.parentNode;
            console.log("[调试] 已定位到学期容器:", targetBlock);
        }

        // HTML 内容保持不变
        const htmlContent = `
            <div style="display:flex; align-items:center;">
                <div style="background-color: #fff; color: ${theme.primary}; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; margin-right: 15px; font-size: 18px; font-weight:bold;">Σ</div>
                <div>
                    <div style="font-size: 12px; opacity: 0.9; text-transform: uppercase; letter-spacing: 1px;">Total Cumulative GPA</div>
                    <div style="font-size: 28px; font-weight: bold; font-family: Arial; line-height: 1;">${result.gpa}</div>
                </div>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 12px; opacity: 0.9;">Total Credits</div>
                <div style="font-size: 18px; font-weight: bold;">${result.totalCredits}</div>
            </div>
        `;

        if (existingBanner) {
            existingBanner.innerHTML = htmlContent;
            if (targetBlock.previousElementSibling !== existingBanner) {
                targetBlock.parentNode.insertBefore(existingBanner, targetBlock);
            }
            return;
        }

        const banner = document.createElement('div');
        banner.id = TOTAL_BANNER_ID;
        banner.style.cssText = `
            background: linear-gradient(135deg, ${theme.primary}, ${adjustColorBrightness(theme.primary, -20)});
            color: white;
            padding: 15px 25px;
            margin-bottom: 25px;
            border-radius: 8px;
            font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            margin-top: 10px;
        `;

        banner.innerHTML = htmlContent;

        if (targetBlock && targetBlock.parentNode) {
            targetBlock.parentNode.insertBefore(banner, targetBlock);
        } else {
            firstTable.parentNode.insertBefore(banner, firstTable);
        }
    }
    function generateBannerHTML(result, theme) {
        return `
            <div style="display:flex; align-items:center;">
                <div style="background-color: ${theme.primary}; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 14px;">📊</div>
                <span style="font-size: 16px; font-weight: bold; color: #303133;">本学期 GPA</span>
                <span style="font-size: 26px; font-weight: bold; color: ${theme.primary}; margin-left: 15px; font-family: Arial;">${result.gpa}</span>
            </div>
            <div style="font-size: 13px; color: #606266;">
                纳入计算: <b>${result.count}</b> 门 &nbsp;|&nbsp;
                有效总学分: <b>${result.totalCredits}</b>
            </div>
        `;
    }

    function adjustColorBrightness(hex, percent) {
        var num = parseInt(hex.replace("#",""),16),
        amt = Math.round(2.55 * percent),
        R = (num >> 16) + amt,
        B = (num >> 8 & 0x00FF) + amt,
        G = (num & 0x0000FF) + amt;
        return "#" + (0x1000000 + (R<255?R<1?0:R:255)*0x10000 + (B<255?B<1?0:B:255)*0x100 + (G<255?G<1?0:G:255)).toString(16).slice(1);
    }

})();
