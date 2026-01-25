const CHECK_INTERVAL = 2000;
const TARGET_TITLE_KEYWORD = "我的成绩";

const processedTables = new WeakSet();

setInterval(() => {
    if (document.title.includes(TARGET_TITLE_KEYWORD) || window.location.href.includes("grade")) {
        calculateAndRender();
    }
}, CHECK_INTERVAL);

function calculateAndRender() {

    const tables = document.querySelectorAll('table');

    tables.forEach((table, index) => {
        if (table.getAttribute('data-gpa-rendered') === 'true') {
            // Double check
            const prev = table.previousElementSibling;
            if (prev && prev.className === 'ecnu-gpa-banner') {
                return;
            }
        }

        const result = calculateTableGPA(table);

        if (result && result.totalCredits > 0) {
            injectGPABanner(table, result);
        }
    });
}

function calculateTableGPA(table) {
    const rows = table.querySelectorAll('tr');
    
    let totalCredits = 0;
    let totalQualityPoints = 0;
    let validCourses = 0;

    rows.forEach(row => {
        const cells = row.querySelectorAll('td');

        if (cells.length < 3) return;

        const creditText = cells[1].innerText.trim(); // Credit
        const gpaText = cells[2].innerText.trim();    // Grade Point

        const credit = parseFloat(creditText);
        const gpa = parseFloat(gpaText);

        // Filter courses with no grade point
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
        count: validCourses
    };
}

function injectGPABanner(table, result) {
    const prevSibling = table.previousElementSibling;
    if (prevSibling && prevSibling.className === 'ecnu-gpa-banner') {
        prevSibling.innerHTML = generateBannerHTML(result);
        return;
    }

    const banner = document.createElement('div');
    banner.className = 'ecnu-gpa-banner';
    banner.style.cssText = `
        background-color: #f0f9eb;
        border: 1px solid #e1f3d8;
        border-left: 5px solid #67c23a;
        color: #333;
        padding: 10px 15px;
        margin-bottom: 10px;
        border-radius: 4px;
        font-family: "Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", Arial, sans-serif;
        display: flex;
        align-items: center;
        justify-content: space-between;
    `;

    banner.innerHTML = generateBannerHTML(result);

    table.parentNode.insertBefore(banner, table);

    // de-dup
    table.setAttribute('data-gpa-rendered', 'true');
}

function generateBannerHTML(result) {
    return `
        <div>
            <span style="font-size: 16px; font-weight: bold; color: #303133;">📊 本学期 GPA</span>
            <span style="font-size: 24px; font-weight: bold; color: #67c23a; margin-left: 10px;">${result.gpa}</span>
        </div>
        <div style="font-size: 13px; color: #909399;">
            纳入计算: ${result.count} 门课 | 有效总学分: ${result.totalCredits}
        </div>
    `;
}