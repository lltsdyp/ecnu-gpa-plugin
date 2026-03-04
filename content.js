const GPACore = {
    config: {
        checkInterval: 2000,
        targetKeyword: "我的成绩"
    },

    getThemeColors: function() {
        const rootStyles = getComputedStyle(document.documentElement);
        let primary = rootStyles.getPropertyValue('--brand-primary').trim() || 
                      rootStyles.getPropertyValue('--color-primary').trim() || 
                      '#1d78ff';
        
        const hexToRgba = (hex, alpha) => {
            let c;
            if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
                c = hex.substring(1).split('');
                if(c.length === 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]];
                c = '0x' + c.join('');
                return 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+','+alpha+')';
            }
            return hex;
        };

        return {
            primary: primary,
            background: hexToRgba(primary, 0.08),
            border: hexToRgba(primary, 0.2)
        };
    },

    calculateTable: function(table) {
        const rows = table.querySelectorAll('tr');
        let stats = { totalCredits: 0, totalQualityPoints: 0, count: 0, gpa: 0 };

        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 3) return;

            const credit = parseFloat(cells[1].innerText.trim());
            const gpa = parseFloat(cells[2].innerText.trim());

            if (!isNaN(credit) && !isNaN(gpa)) {
                stats.totalCredits += credit;
                stats.totalQualityPoints += (credit * gpa);
                stats.count++;
            }
        });

        if (stats.count === 0) return null;
        stats.gpa = (stats.totalQualityPoints / stats.totalCredits).toFixed(2);
        return stats;
    },

    injectBanner: function(table, result) {
        const theme = this.getThemeColors();
        
        const prev = table.previousElementSibling;
        if (prev && prev.className === 'ecnu-gpa-banner') {
            prev.innerHTML = this.generateHTML(result, theme);
            return;
        }

        const banner = document.createElement('div');
        banner.className = 'ecnu-gpa-banner';
        banner.style.cssText = `
            background-color: ${theme.background};
            border: 1px solid ${theme.border};
            border-left: 5px solid ${theme.primary};
            color: #333;
            padding: 12px 20px;
            margin-bottom: 15px;
            margin-top: 10px;
            border-radius: 4px;
            display: flex; align-items: center; justify-content: space-between;
            font-family: Arial, sans-serif;
            box-shadow: 0 2px 6px rgba(0,0,0,0.05);
        `;
        banner.innerHTML = this.generateHTML(result, theme);
        
        if (table.parentNode) {
            table.parentNode.insertBefore(banner, table);
            table.setAttribute('data-gpa-rendered', 'true');
        }
    },

    generateHTML: function(result, theme) {
        return `
            <div style="display:flex; align-items:center;">
                <div style="background-color: ${theme.primary}; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 14px;">📊</div>
                <span style="font-size: 16px; font-weight: bold;">本学期 GPA</span>
                <span style="font-size: 26px; font-weight: bold; color: ${theme.primary}; margin-left: 15px;">${result.gpa}</span>
            </div>
            <div style="font-size: 13px; color: #606266;">
                纳入计算: <b>${result.count}</b> 门 &nbsp;|&nbsp;
                有效总学分: <b>${result.totalCredits}</b>
            </div>
        `;
    },

    run: function() {
        if (!document.title.includes(this.config.targetKeyword) && !window.location.href.includes("grade")) {
            return;
        }

        const tables = document.querySelectorAll('table');
        tables.forEach(table => {
            if (table.getAttribute('data-gpa-rendered') === 'true') {
                 if (table.previousElementSibling?.className === 'ecnu-gpa-banner') return;
            }

            const result = this.calculateTable(table);
            if (result) {
                this.injectBanner(table, result);
            }
        });
    }
};


setInterval(() => {
    GPACore.run();
}, GPACore.config.checkInterval);